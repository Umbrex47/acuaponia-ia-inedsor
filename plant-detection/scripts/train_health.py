"""Entrena clasificador de salud multi-cultivo con PlantVillage."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import models, transforms
from PIL import Image
from tqdm import tqdm

from src.config import ROOT
from src.data.plantvillage import download_plantvillage, find_image_root
from src.models.health import map_plantvillage_class

MODELS_DIR = ROOT / "models"
DEFAULT_OUT = MODELS_DIR / "health_classifier.pt"


class PlantVillageDataset(Dataset):
    def __init__(self, root: Path, transform, max_per_class: int | None = 200):
        self.samples: list[tuple[Path, int]] = []
        self.class_names: list[str] = []
        self.class_to_idx: dict[str, int] = {}

        classes = sorted([d for d in root.iterdir() if d.is_dir()])
        for cls_dir in classes:
            idx = len(self.class_names)
            self.class_names.append(cls_dir.name)
            self.class_to_idx[cls_dir.name] = idx
            images = list(cls_dir.glob("*.jpg")) + list(cls_dir.glob("*.JPG")) + list(
                cls_dir.glob("*.png")
            )
            if max_per_class:
                random.shuffle(images)
                images = images[:max_per_class]
            for img in images:
                self.samples.append((img, idx))

        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        path, label = self.samples[index]
        img = Image.open(path).convert("RGB")
        return self.transform(img), label


def train(
    *,
    epochs: int = 5,
    batch_size: int = 32,
    lr: float = 1e-4,
    max_per_class: int = 150,
    output: Path = DEFAULT_OUT,
) -> Path:
    print("Descargando PlantVillage...")
    raw = download_plantvillage()
    image_root = find_image_root(raw)
    print(f"Dataset en: {image_root}")

    transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(0.2, 0.2, 0.2),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    dataset = PlantVillageDataset(image_root, transform, max_per_class=max_per_class)
    print(f"Imágenes: {len(dataset)} | Clases: {len(dataset.class_names)}")

    val_size = max(int(len(dataset) * 0.15), 1)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(
        dataset, [train_size, val_size], generator=torch.Generator().manual_seed(42)
    )

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    num_classes = len(dataset.class_names)
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)

    best_acc = 0.0
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        for images, labels in tqdm(train_loader, desc=f"Epoch {epoch + 1}/{epochs}"):
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                preds = model(images).argmax(dim=1)
                correct += (preds == labels).sum().item()
                total += labels.size(0)
        acc = correct / max(total, 1)
        print(f"  loss={running_loss / max(len(train_loader), 1):.4f}  val_acc={acc:.3f}")

        if acc >= best_acc:
            best_acc = acc
            class_to_health = {
                i: map_plantvillage_class(name) for i, name in enumerate(dataset.class_names)
            }
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "num_classes": num_classes,
                    "class_names": dataset.class_names,
                    "class_to_health": class_to_health,
                    "val_accuracy": acc,
                },
                output,
            )
            print(f"  → Guardado {output} (acc={acc:.3f})")

    meta_path = output.with_suffix(".json")
    meta_path.write_text(
        json.dumps(
            {
                "classes": len(dataset.class_names),
                "val_accuracy": best_acc,
                "health_mapping": "see checkpoint class_to_health",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Entrenar clasificador de salud (PlantVillage)")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--max-per-class", type=int, default=150)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        max_per_class=args.max_per_class,
        output=args.output,
    )


if __name__ == "__main__":
    main()
