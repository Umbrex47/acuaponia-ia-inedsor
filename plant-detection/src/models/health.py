from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import models, transforms

# Mapeo PlantVillage → categorías generales de salud (multi-cultivo)
HEALTH_CATEGORIES = ("healthy", "stressed", "diseased", "nutrient_deficient")

# Palabras clave en nombres de clase PlantVillage
_DISEASE_KEYWORDS = (
    "blight",
    "rust",
    "spot",
    "mold",
    "virus",
    "mites",
    "rot",
    "scab",
    "curl",
    "mosaic",
    "wilt",
    "canker",
    "smut",
    "ergot",
    "septoria",
    "powdery",
    "downy",
    "anthracnose",
    "bacterial",
)
_NUTRIENT_KEYWORDS = ("yellow", "chlorosis", "deficien")
_STRESS_KEYWORDS = ("water", "stress", "drought", "heat")


@dataclass
class HealthResult:
    label: str
    confidence: float
    method: str  # "model" | "heuristic"
    details: dict | None = None


def map_plantvillage_class(class_name: str) -> str:
    lower = class_name.lower().replace("___", " ").replace("_", " ")
    if "healthy" in lower:
        return "healthy"
    if any(k in lower for k in _NUTRIENT_KEYWORDS):
        return "nutrient_deficient"
    if any(k in lower for k in _DISEASE_KEYWORDS):
        return "diseased"
    if any(k in lower for k in _STRESS_KEYWORDS):
        return "stressed"
    return "diseased"


class HealthClassifier:
    def __init__(
        self,
        model_path: Path | None,
        *,
        input_size: int = 224,
        fallback_heuristics: bool = True,
        device: str | None = None,
    ):
        self.input_size = input_size
        self.fallback_heuristics = fallback_heuristics
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model: nn.Module | None = None
        self.class_to_health: dict[int, str] = {}

        self.transform = transforms.Compose(
            [
                transforms.ToPILImage(),
                transforms.Resize((input_size, input_size)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ]
        )

        if model_path and model_path.exists():
            self._load(model_path)

    def _load(self, path: Path) -> None:
        checkpoint = torch.load(path, map_location=self.device, weights_only=False)
        num_classes = checkpoint["num_classes"]
        self.class_to_health = {
            int(k): v for k, v in checkpoint.get("class_to_health", {}).items()
        }

        backbone = models.efficientnet_b0(weights=None)
        backbone.classifier[1] = nn.Linear(backbone.classifier[1].in_features, num_classes)
        backbone.load_state_dict(checkpoint["model_state"])
        backbone.eval().to(self.device)
        self.model = backbone

    def _heuristic_health(self, crop_bgr: np.ndarray) -> HealthResult:
        """Estimación sin modelo: color foliar y textura básica."""
        hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (25, 40, 40), (95, 255, 255))
        if mask.sum() < 100:
            return HealthResult("stressed", 0.5, "heuristic", {"reason": "low_vegetation"})

        green_ratio = mask.mean() / 255.0
        mean_hue = cv2.mean(hsv, mask=mask)[0]
        mean_sat = cv2.mean(hsv, mask=mask)[1]

        yellow_mask = cv2.inRange(hsv, (15, 50, 50), (35, 255, 255))
        yellow_ratio = yellow_mask.sum() / max(mask.sum(), 1)

        brown_mask = cv2.inRange(hsv, (5, 50, 20), (25, 255, 180))
        brown_ratio = brown_mask.sum() / max(mask.sum(), 1)

        if brown_ratio > 0.15:
            return HealthResult(
                "diseased",
                min(0.55 + brown_ratio, 0.85),
                "heuristic",
                {"brown_ratio": round(float(brown_ratio), 3)},
            )
        if yellow_ratio > 0.2 or mean_hue < 30:
            return HealthResult(
                "nutrient_deficient",
                min(0.5 + yellow_ratio, 0.8),
                "heuristic",
                {"yellow_ratio": round(float(yellow_ratio), 3)},
            )
        if green_ratio > 0.25 and mean_sat > 60:
            return HealthResult(
                "healthy",
                min(0.6 + green_ratio * 0.3, 0.9),
                "heuristic",
                {"green_ratio": round(float(green_ratio), 3)},
            )
        return HealthResult(
            "stressed",
            0.65,
            "heuristic",
            {"green_ratio": round(float(green_ratio), 3), "saturation": round(float(mean_sat), 1)},
        )

    def predict(self, crop_bgr: np.ndarray) -> HealthResult:
        if self.model is None:
            if self.fallback_heuristics:
                return self._heuristic_health(crop_bgr)
            return HealthResult("unknown", 0.0, "none")

        tensor = self.transform(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
        tensor = tensor.unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
            idx = int(probs.argmax())
            conf = float(probs[idx])

        health = self.class_to_health.get(idx, map_plantvillage_class(str(idx)))
        return HealthResult(health, conf, "model")
