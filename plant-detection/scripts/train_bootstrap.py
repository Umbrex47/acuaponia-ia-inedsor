"""
Entrena un clasificador bootstrap (heurística → etiquetas sintéticas) cuando
PlantVillage no está disponible. Útil para generar health_classifier.pt local.
Para producción usa: python scripts/train_health.py (PlantVillage / Kaggle).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "models" / "health_classifier.pt"

LABELS = ["healthy", "stressed", "diseased", "nutrient_deficient"]


def _make_leaf(label: str, size: int = 224) -> np.ndarray:
    img = np.zeros((size, size, 3), dtype=np.uint8)
    if label == "healthy":
        img[:] = (40, 160, 50)
        cv2.ellipse(img, (112, 112), (80, 100), 0, 0, 360, (30, 180, 60), -1)
    elif label == "nutrient_deficient":
        img[:] = (40, 140, 160)
        cv2.ellipse(img, (112, 112), (80, 100), 0, 0, 360, (40, 200, 220), -1)
    elif label == "diseased":
        img[:] = (30, 100, 40)
        cv2.ellipse(img, (112, 112), (80, 100), 0, 0, 360, (20, 120, 40), -1)
        for _ in range(25):
            x, y = np.random.randint(40, 180, 2)
            cv2.circle(img, (int(x), int(y)), 6, (20, 40, 90), -1)
    else:
        img[:] = (60, 90, 70)
        cv2.ellipse(img, (112, 112), (70, 90), 0, 0, 360, (50, 100, 80), -1)
    return img


class SynthDataset(Dataset):
    def __init__(self, n_per_class: int = 40):
        self.samples: list[tuple[np.ndarray, int]] = []
        self.transform = transforms.Compose(
            [
                transforms.ToPILImage(),
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ]
        )
        for idx, label in enumerate(LABELS):
            for _ in range(n_per_class):
                self.samples.append((_make_leaf(label), idx))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, i: int):
        bgr, y = self.samples[i]
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        return self.transform(rgb), y


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch", type=int, default=16)
    args = parser.parse_args()

    ds = SynthDataset(40)
    loader = DataLoader(ds, batch_size=args.batch, shuffle=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = models.efficientnet_b0(weights=None)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(LABELS))
    model.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()

    model.train()
    for epoch in range(args.epochs):
        total = 0.0
        for x, y in tqdm(loader, desc=f"epoch {epoch+1}"):
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            logits = model(x)
            loss = loss_fn(logits, y)
            loss.backward()
            opt.step()
            total += float(loss)
        print(f"epoch {epoch+1} loss={total/len(loader):.4f}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    class_to_health = {i: LABELS[i] for i in range(len(LABELS))}
    torch.save(
        {
            "model_state": model.state_dict(),
            "num_classes": len(LABELS),
            "class_to_health": class_to_health,
            "class_names": LABELS,
            "bootstrap": True,
        },
        OUT,
    )
    meta = OUT.with_suffix(".json")
    meta.write_text(json.dumps({"labels": LABELS, "bootstrap": True}, indent=2), encoding="utf-8")
    print(f"Guardado {OUT} (bootstrap). Preferible reentrenar con PlantVillage.")


if __name__ == "__main__":
    main()
