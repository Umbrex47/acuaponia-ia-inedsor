# Detección / salud de plantas (AquaGia OS)

Pipeline portado desde `D:\AquaGia\IAPlantass`:

1. Segmentación ExG (vegetación)
2. Clasificador EfficientNet (PlantVillage) o heurísticas de color
3. Assessment con probabilidades (hongo, color anormal, manchas, estrés)

## Datasets

| Dataset | Uso |
|---------|-----|
| [PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset) | Entrenar `health_classifier.pt` |
| [PlantDoc (Roboflow)](https://universe.roboflow.com/joseph-nelson/plantdoc) | Upgrade YOLO boxes |
| Fotos propias de la cama | Fine-tune |

Plan: [docs/plant-detection-plan.md](../docs/plant-detection-plan.md)

## Entrenar (PlantVillage)

```powershell
cd plant-detection
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
$env:PYTHONPATH="."
# Requiere ~/.kaggle/kaggle.json
python scripts/train_health.py --epochs 10 --max-per-class 200
```

Salida: `models/health_classifier.pt`

## PlantDoc (upgrade detección)

```powershell
$env:ROBOFLOW_API_KEY="..."
python scripts/download_plantdoc.py
python scripts/train_detect.py --data datasets/plantdoc/data.yaml --epochs 80
```

## Inferencia CLI

```powershell
$env:PYTHONPATH="."
python scripts/analyze.py ruta/foto.jpg --output-json out.json --output-image out.jpg
```

## Cámara en vivo

`camera-publisher` con `PLANT_DETECT_ENABLED=true` → topic `aquaponic/plants/telemetry`.
