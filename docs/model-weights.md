# Pesos de modelos (IA peces y plantas)

Los archivos `.pt` **no se versionan en git** (son grandes). Descárgalos o genéralos localmente y colócalos en las rutas indicadas.

## Resumen rápido

| IA | Archivo local | Origen recomendado | Tamaño aprox. |
|----|---------------|--------------------|---------------|
| Peces | `fish-detection/models/fish_yolo11s_aquarium.pt` | Entrenamiento AIPeces / Aquarium (Roboflow) | ~72 MB |
| Plantas | `plant-detection/models/health_classifier.pt` | PlantVillage (`train_health.py`) o bootstrap | ~20–30 MB |
| Plantas (upgrade) | `plant-detection/models/plant_yolo_best.pt` | PlantDoc YOLO | ~6–20 MB |

Base Ultralytics (se descarga sola al entrenar): `yolo11n.pt`, `yolo11s.pt`.

---

## 1. Peces — detección YOLO

### Recomendado (MVP actual)

- **Archivo:** `fish-detection/models/fish_yolo11s_aquarium.pt`
- **Arquitectura:** YOLOv11s (detect)
- **Dataset:** [Roboflow Aquarium](https://public.roboflow.ai/object-detection/aquarium) (7 clases; en inferencia se filtra `fish`)
- **Métricas de referencia:** mAP50 ≈ 0.77 (entrenamiento AIPeces)

**Cómo obtenerlo**

```powershell
# Si ya entrenaste en AIPeces:
Copy-Item D:\ProyectosM\AIPeces\runs\detect\training\aquarium_pretrain\weights\best.pt `
  D:\acuaponia\fish-detection\models\fish_yolo11s_aquarium.pt
```

O reentrenar:

```powershell
cd fish-detection
python scripts/train.py --data datasets/aquarium/data.yaml --model yolo11s.pt --epochs 80
# Copia el best.pt resultante a models/fish_yolo11s_aquarium.pt
```

### Upgrade recomendado (mejor underwater)

| Paso | Qué | Resultado |
|------|-----|-----------|
| 1 | AnnotateDeepFish (Roboflow) | Dataset YOLO 1 clase `fish` |
| 2 | `python scripts/download_deepfish.py` | `datasets/deepfish/` |
| 3 | `python scripts/train.py --data ... --model yolo11n.pt` | `models/fish_yolo_best.pt` |

Enlace dataset: https://universe.roboflow.com/deepfish/annotatedeepfish  
Repo referencia: https://github.com/alzayats/DeepFish

**Env del publisher**

```env
FISH_DETECT_ENABLED=true
FISH_DETECT_MODEL=../fish-detection/models/fish_yolo11s_aquarium.pt
# Tras DeepFish:
# FISH_DETECT_MODEL=../fish-detection/models/fish_yolo_best.pt
```

---

## 2. Plantas — clasificador de salud

### Recomendado (producción)

- **Archivo:** `plant-detection/models/health_classifier.pt`
- **Arquitectura:** EfficientNet-B0
- **Dataset:** [PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset) (~54k hojas)
- **Clases internas:** `healthy` \| `stressed` \| `diseased` \| `nutrient_deficient`

```powershell
cd plant-detection
.\.venv\Scripts\activate
$env:PYTHONPATH="."
# Requiere ~/.kaggle/kaggle.json
pip install -r requirements.txt
python scripts/train_health.py --epochs 10 --max-per-class 200
```

### Bootstrap (sin Kaggle, solo para demos)

```powershell
python scripts/train_bootstrap.py --epochs 3
```

Genera el mismo path `models/health_classifier.pt`, pero **no sustituye** PlantVillage en producción.

### Upgrade detección localizada (YOLO)

| Paso | Qué | Resultado |
|------|-----|-----------|
| 1 | PlantDoc en Roboflow | Boxes sana/enferma |
| 2 | `python scripts/download_plantdoc.py` | `datasets/plantdoc/` |
| 3 | `python scripts/train_detect.py` | `models/plant_yolo_best.pt` |

Enlace: https://universe.roboflow.com/joseph-nelson/plantdoc

**Env del publisher**

```env
PLANT_DETECT_ENABLED=true
PLANT_DETECT_MODEL=../plant-detection/models/health_classifier.pt
```

Sin `.pt`, el publisher usa **heurísticas de color** (sigue funcionando, menos preciso).

---

## 3. Checklist local

```text
acuaponia/
├── fish-detection/models/
│   └── fish_yolo11s_aquarium.pt     # obligatorio para detección peces
└── plant-detection/models/
    └── health_classifier.pt         # recomendado para plantas
```

Verifica:

```powershell
Test-Path fish-detection\models\fish_yolo11s_aquarium.pt
Test-Path plant-detection\models\health_classifier.pt
```

---

## 4. Docs relacionados

- [docs/fish-detection-plan.md](./fish-detection-plan.md)
- [docs/plant-detection-plan.md](./plant-detection-plan.md)
- [fish-detection/README.md](../fish-detection/README.md)
- [plant-detection/README.md](../plant-detection/README.md)
