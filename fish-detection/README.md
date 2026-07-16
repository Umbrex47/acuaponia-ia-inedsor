# Detección de peces (AquaGia OS)

Pipeline YOLO + SORT basado en el entrenamiento de `D:\ProyectosM\AIPeces`
(dataset Roboflow Aquarium) y listo para reentrenar con AnnotateDeepFish.

## Modelo listo

`models/fish_yolo11s_aquarium.pt` — pesos `best.pt` ya entrenados (yolo11s, mAP50≈0.77).

No se versionan en git (ver `.gitignore` raíz). Copia local desde AIPeces si falta:

```powershell
Copy-Item D:\ProyectosM\AIPeces\runs\detect\training\aquarium_pretrain\weights\best.pt `
  D:\acuaponia\fish-detection\models\fish_yolo11s_aquarium.pt
```

## Reentrenar con DeepFish (upgrade)

1. Crea API key en [Roboflow](https://roboflow.com) (AnnotateDeepFish).
2. Descarga y entrena:

```powershell
cd fish-detection
.\.venv\Scripts\activate   # o crea el venv
pip install -r requirements.txt
$env:ROBOFLOW_API_KEY="..."
python scripts/download_deepfish.py
python scripts/train.py --data datasets/deepfish/data.yaml --model yolo11n.pt --epochs 80 --device cpu
```

3. Actualiza `FISH_DETECT_MODEL` en `camera-publisher/.env` al nuevo `models/fish_yolo_best.pt`.

Plan completo: [docs/fish-detection-plan.md](../docs/fish-detection-plan.md).

## Inferencia en vivo

Lo hace `camera-publisher` con `FISH_DETECT_ENABLED=true` (ver su `.env.example`).
Publica:

- `aquaponic/cameras/fish` — frames (+ overlay)
- `aquaponic/fish/telemetry` — count, behavior (`activityState`: active|normal|low), assessment
