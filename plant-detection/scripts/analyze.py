"""CLI para analizar una imagen local."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

from src.pipeline import PlantAnalysisPipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="Analizar salud/tamaño/estado de plantas")
    parser.add_argument("image", type=Path, help="Ruta a la imagen")
    parser.add_argument("--output-json", type=Path, help="Guardar resultado JSON")
    parser.add_argument("--output-image", type=Path, help="Guardar imagen anotada")
    args = parser.parse_args()

    pipeline = PlantAnalysisPipeline()
    result = pipeline.analyze_file(args.image)

    print(json.dumps(result, indent=2, ensure_ascii=False))

    if args.output_json:
        args.output_json.write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    if args.output_image:
        bgr = cv2.imread(str(args.image))
        annotated = pipeline.draw_annotations(bgr, result)
        cv2.imwrite(str(args.output_image), annotated)
        print(f"Anotación guardada en {args.output_image}")


if __name__ == "__main__":
    main()
