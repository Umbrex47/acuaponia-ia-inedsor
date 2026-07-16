# Plan: IA de plantas → anomalías → correo (AquaGia OS)

Estado: implementado en monorepo (`plant-detection/` + `camera-publisher/plant_ai` + `PlantAssessmentService`).

## Datasets

- **PlantVillage** — clasificación principal (`scripts/train_health.py`)
- **PlantDoc** — YOLO upgrade (`scripts/download_plantdoc.py`, `train_detect.py`)
- **Fotos propias** — fine-tune de la cama hidropónica

## Hipótesis de probabilidad

| id | Mensaje |
|----|---------|
| `fungal_infection` | Probabilidad de X% de infección fúngica |
| `abnormal_color_nutrient` | Probabilidad de X% de color anormal o deficiencia nutricional |
| `leaf_spot_disease` | Probabilidad de X% de manchas patológicas |
| `plant_stress` | Probabilidad de X% de estrés hídrico o ambiental |

## MQTT

- `aquaponic/cameras/plants`
- `aquaponic/plants/telemetry` — count, findings, assessment

## Correo

`PlantAssessmentService` — umbral `PLANT_ASSESS_MAIL_THRESHOLD`, cooldown `PLANT_ASSESS_MAIL_COOLDOWN_MS`.
Endpoints: `GET/POST /decision/plant-assessment`.
