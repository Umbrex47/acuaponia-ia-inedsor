"""
Descarga AnnotateDeepFish (YOLO) desde Roboflow Universe.

Requiere ROBOFLOW_API_KEY en el entorno.
https://universe.roboflow.com/deepfish/annotatedeepfish
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", default=os.environ.get("ROBOFLOW_API_KEY", ""))
    parser.add_argument("--out", default=str(ROOT / "datasets" / "deepfish"))
    args = parser.parse_args()

    if not args.api_key:
        raise SystemExit(
            "Define ROBOFLOW_API_KEY o pasa --api-key para descargar AnnotateDeepFish."
        )

    from roboflow import Roboflow

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    rf = Roboflow(api_key=args.api_key)
    project = rf.workspace("deepfish").project("annotatedeepfish")
    version = project.version(1)
    dataset = version.download("yolov8", location=str(out))
    print(f"Dataset listo en {dataset.location}")
    print("Entrena con: python scripts/train.py --data <ruta>/data.yaml --model yolo11n.pt")


if __name__ == "__main__":
    main()
