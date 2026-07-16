from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from src.calibration.camera import CameraCalibration
from src.config import ROOT, load_config
from src.models.health import HealthClassifier, HealthResult
from src.models.state import GrowthState, estimate_growth_state
from src.segmentation.plants import PlantRegion, segment_plants

_HEALTH_SCORE = {
    "healthy": 1.0,
    "stressed": 0.55,
    "nutrient_deficient": 0.45,
    "diseased": 0.25,
    "unknown": 0.5,
}


@dataclass
class PlantAnalysis:
    id: int
    bbox: list[int]
    centroid: list[int]
    health: dict[str, Any]
    size: dict[str, Any]
    state: dict[str, Any]
    overall_score: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class PlantAnalysisPipeline:
    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or load_config()
        self.calibration: CameraCalibration | None = None

        cal_path = ROOT / self.config["camera"]["calibration_file"]
        if cal_path.exists():
            self.calibration = CameraCalibration.from_file(cal_path)

        health_cfg = self.config["health"]
        model_path = ROOT / health_cfg["model_path"]
        self.health_classifier = HealthClassifier(
            model_path if model_path.exists() else None,
            input_size=health_cfg.get("input_size", 224),
            fallback_heuristics=health_cfg.get("fallback_heuristics", True),
        )

        seg_cfg = self.config["segmentation"]
        self.seg_params = {
            "exg_threshold": seg_cfg.get("exg_threshold"),
            "min_area_px": seg_cfg.get("min_plant_area_px", 2500),
            "max_plants": seg_cfg.get("max_plants", 20),
        }
        self.state_cfg = self.config.get("state", {})

    def analyze(self, image: np.ndarray) -> dict[str, Any]:
        bgr = image.copy()
        if self.calibration:
            bgr = self.calibration.apply_roi(bgr)

        regions = segment_plants(bgr, **self.seg_params)
        total_area = sum(r.area_px for r in regions) or 1

        plants: list[PlantAnalysis] = []
        for region in regions:
            x, y, w, h = region.bbox
            crop = bgr[y : y + h, x : x + w]
            if crop.size == 0:
                continue

            health: HealthResult = self.health_classifier.predict(crop)
            growth: GrowthState = estimate_growth_state(
                region.area_px,
                total_area,
                seedling_max=self.state_cfg.get("seedling_max", 0.08),
                vegetative_max=self.state_cfg.get("vegetative_max", 0.35),
                flowering_max=self.state_cfg.get("flowering_max", 0.65),
            )

            size_data: dict[str, Any] = {
                "leaf_area_px": region.area_px,
                "area_fraction": round(region.area_px / total_area, 4),
            }
            if self.calibration:
                cm2 = self.calibration.px_area_to_cm2(region.area_px)
                size_data["leaf_area_cm2"] = round(cm2, 2)
                equiv_diameter_cm = 2 * (cm2 / 3.14159) ** 0.5
                size_data["equiv_diameter_cm"] = round(equiv_diameter_cm, 2)

            score = (
                _HEALTH_SCORE.get(health.label, 0.5) * 0.7
                + growth.confidence * 0.3
            )

            plants.append(
                PlantAnalysis(
                    id=region.id,
                    bbox=[x, y, w, h],
                    centroid=list(region.centroid),
                    health={
                        "label": health.label,
                        "confidence": round(health.confidence, 3),
                        "method": health.method,
                        "details": health.details,
                    },
                    size=size_data,
                    state={
                        "stage": growth.stage,
                        "confidence": round(growth.confidence, 3),
                        "area_fraction": growth.area_fraction,
                    },
                    overall_score=round(score, 3),
                )
            )

        healthy_count = sum(1 for p in plants if p.health["label"] == "healthy")
        avg_health = (
            sum(_HEALTH_SCORE.get(p.health["label"], 0.5) for p in plants) / len(plants)
            if plants
            else 0.0
        )

        return {
            "plants": [p.to_dict() for p in plants],
            "summary": {
                "total_plants": len(plants),
                "healthy_count": healthy_count,
                "avg_health_score": round(avg_health, 3),
                "calibrated": self.calibration is not None,
                "health_method": (
                    "model"
                    if self.health_classifier.model is not None
                    else "heuristic"
                ),
            },
        }

    def analyze_file(self, path: Path) -> dict[str, Any]:
        bgr = cv2.imread(str(path))
        if bgr is None:
            raise ValueError(f"No se pudo leer la imagen: {path}")
        return self.analyze(bgr)

    def draw_annotations(self, image: np.ndarray, result: dict[str, Any]) -> np.ndarray:
        out = image.copy()
        if self.calibration:
            out = self.calibration.apply_roi(out)

        colors = {
            "healthy": (0, 200, 0),
            "stressed": (0, 200, 255),
            "nutrient_deficient": (0, 165, 255),
            "diseased": (0, 0, 220),
            "unknown": (128, 128, 128),
        }

        for plant in result["plants"]:
            x, y, w, h = plant["bbox"]
            label = plant["health"]["label"]
            color = colors.get(label, (255, 255, 255))
            cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)
            text = f"#{plant['id']} {label} | {plant['state']['stage']}"
            cv2.putText(out, text, (x, max(y - 8, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        return out
