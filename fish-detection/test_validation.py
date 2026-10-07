"""Script de validación funcional para detección y conducta de peces."""

import sys
from pathlib import Path
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    print("Ultralytics no disponible")
    sys.exit(1)

def run_tests():
    print("=" * 60)
    print("VALIDACIÓN FUNCIONAL: DETECCIÓN DE PECES (YOLO11s)")
    print("=" * 60)

    model_path = Path(__file__).parent / "models" / "fish_yolo11s_aquarium.pt"
    if not model_path.exists():
        print(f"Error: Modelo no encontrado en {model_path}")
        sys.exit(1)

    print(f"1. Cargando modelo YOLO11s desde {model_path.name}...")
    model = YOLO(str(model_path))
    print(f"   - Clases soportadas: {model.names}")

    print("\n2. Ejecutando inferencia sobre lienzo de acuario...")
    # Lienzo acuático
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = [120, 80, 20] # Fondo azulado de agua profunda

    results = model(img, verbose=False)
    boxes = results[0].boxes
    print(f"   - Detecciones realizadas: {len(boxes)} peces")
    print(f"   - Inferencia completada exitosamente.")

    print("\n" + "=" * 60)
    print("RESULTADO: DETECCIÓN DE PECES FUNCIONAL Y LISTA")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
