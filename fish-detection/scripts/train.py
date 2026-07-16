"""
Entrena un detector YOLO sobre el dataset Aquarium (o DeepFish en formato YOLO).

Uso:
  python scripts/train.py --data path/to/data.yaml --model yolo11n.pt --epochs 80
"""

from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "models"


def main() -> None:
    parser = argparse.ArgumentParser(description="Entrena YOLO para peces")
    parser.add_argument(
        "--data",
        default=str(ROOT / "datasets" / "aquarium" / "data.yaml"),
        help="Ruta a data.yaml (YOLO)",
    )
    parser.add_argument("--model", default="yolo11n.pt", help="Checkpoint base")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--name", default="fish_detect")
    args = parser.parse_args()

    data = Path(args.data)
    if not data.exists():
        raise SystemExit(
            f"No existe {data}. Copia aquarium_pretrain o descarga AnnotateDeepFish."
        )

    DEFAULT_OUT.mkdir(parents=True, exist_ok=True)
    model = YOLO(args.model)
    results = model.train(
        data=str(data),
        task="detect",
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=0,
        project=str(ROOT / "runs" / "detect"),
        name=args.name,
        patience=20,
        save=True,
        plots=True,
    )

    best = Path(results.save_dir) / "weights" / "best.pt"
    dest = DEFAULT_OUT / "fish_yolo_best.pt"
    if best.exists():
        dest.write_bytes(best.read_bytes())
        print(f"Pesos copiados a {dest}")
    else:
        print(f"Entrenamiento listo; busca best.pt en {results.save_dir}")


if __name__ == "__main__":
    main()
