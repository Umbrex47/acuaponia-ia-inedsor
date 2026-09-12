# AquaGia Vision

## Monitoreo Individual de Plantas con Visión Artificial de Bajo Consumo

AquaGia Vision es un sistema de visión artificial *edge-first y lightweight* diseñado para responder a la pregunta fundamental del sistema acuapónico:

> **"¿Cuál es el estado de cada planta individual del sistema acuapónico y cómo ha evolucionado a lo largo del tiempo?"**

A diferencia de los enfoques tradicionales que procesan una imagen global sin diferenciar ejemplares, AquaGia Vision otorga a cada planta una **identidad persistente** (`P01`, `P02`, ... `Pn`) y un **historial temporal independiente**, permitiendo cuantificar su evolución biométrica en hardware modesto (2–4 núcleos CPU, 2–4 GB RAM, sin GPU).

---

## 1. Principios de Diseño

1. **Edge-first y Bajo Consumo:** No analiza vídeo continuo a 30 FPS. Realiza capturas periódicas (30–60 s de día, 5–15 min de noche o por detección de cambios en la escena) y duerme entre ciclos para evitar calentamiento y gasto energético.
2. **Prioridad Modo A (Sin IA pesada):** Emplea Regiones de Interés (ROIs) fijas sobre la cama acuapónica mediante OpenCV y NumPy. No requiere GPU, no requiere entrenamiento y se ejecuta en < 30 ms.
3. **Modo B Opcional (YOLO-nano + Tracker):** Activación dinámica de detección por objetos y seguimiento de centroides únicamente cuando las plantas cambian de posición o se desplazan.
4. **Desacoplamiento entre Medición y Decisión:** La visión extrae variables fenotípicas cuantificables. Un motor de reglas correlaciona la visión con los sensores fisicoquímicos (pH, EC, temperatura, oxígeno disuelto) y el historial para sugerir acciones de manejo.

---

## 2. Ficha Técnica por Planta

Cada planta almacena y actualiza su historial biométrico:

```text
PLANTA P01
├── Estado: saludable
├── Área vegetal: 243.16 cm²
├── Cobertura verde: 100 %
├── Crecimiento: +4.2 %/día
├── Número de hojas: 12
└── Última actualización: 14:30
```

### Métricas Calculadas:
* **Área foliar:** En píxeles y calibrada a $cm^2$.
* **Tasa de crecimiento temporal:** $G = \frac{A_t - A_{t-1}}{\Delta t}$ en $cm^2/\text{día}$ y $\%/\text{día}$.
* **Color y sanidad:**
  * `green_ratio`: Porcentaje de follaje verde activo.
  * `yellow_ratio`: Detección temprana de clorosis (deficiencia de nutrientes/hierro o desbalance de pH).
  * `brown_ratio`: Detección de necrosis foliar, pudrición o manchas patológicas.
  * `mean_hue`, `mean_saturation`, `mean_brightness`: Estadísticas en espacio HSV.
* **Hojas y forma:**
  * `leaf_count`: Estimación mediante transformada de distancia euclidiana y picos morfológicos.
  * `solidity`: Relación área/envolvente convexa para evaluar vigor y compacidad de la roseta.
* **Estados individuales:** 🟢 `NORMAL`, 🟡 `ATENCIÓN`, 🟠 `ESTRÉS`, 🔴 `ANOMALÍA`.

---

## 3. Estructura del Software

```text
aquagia-vision/
├── config/
│   ├── config.yaml               # Configuración central (modos, intervalos, umbrales)
│   └── default_rois.json         # Grilla 3x3 normalizada para P01..P09
├── camera/
│   ├── capture.py                # Captura OpenCV (Webcam, RTSP, imagen estática y generador sintético)
│   └── camera_manager.py         # Scheduler periódico edge-first (día 30s / noche 300s / detección de cambios)
├── detection/
│   ├── detector.py               # BasePlantDetector y FixedRoiDetector (Modo A: sin GPU ni modelos pesados)
│   ├── tracker.py                # CentroidTracker con persistencia de IDs euclidiana
│   └── yolo.py                   # YoloPlantDetector (Modo B: YOLO-nano dinámico opcional)
├── segmentation/
│   ├── opencv.py                 # ExG (2G - R - B), Otsu adaptativo, morfología elíptica y change detection
│   └── plantcv.py                # Fenotipado: solidez, aspect ratio, envolvente convexa y centroide
├── analysis/
│   ├── color.py                  # green_ratio, yellow_ratio (clorosis), brown_ratio (necrosis), HSV
│   ├── leaves.py                 # Estimación de hojas por transformada de distancia y defectos de convexidad
│   ├── growth.py                 # Tasa G = (At - At-1)/Δt en cm²/día, %/día y aceleración
│   └── health.py                 # Health score [0..1], anomaly score [0..1] y estados (NORMAL, ATENCIÓN, ESTRÉS, ANOMALÍA)
├── plants/
│   ├── identity.py               # PlantIdentityManager (registro persistente de identidades P01..Pn)
│   └── history.py                # PlantHistoryManager (evolución temporal y formateo de ficha en árbol)
├── decision/
│   ├── rules.py                  # Reglas desacopladas (correlación visión + pH/EC/temperatura/DO)
│   └── model.py                  # DecisionEngine y generación de alertas accionables
├── database/
│   ├── models.py                 # Modelos Plant, PlantObservation, SensorReading, PlantAlert
│   └── repository.py             # Repositorio SQLite local-first con pooling limpio
├── api/
│   └── server.py                 # Servidor FastAPI REST + frame anotado JPEG + lifespan
├── pipeline.py                   # Orquestador del ciclo completo de análisis visual
├── cli.py                        # CLI con comandos `analyze`, `status` y `daemon`
├── Dockerfile                    # Contenedor Docker para despliegue Linux ARM/x86
├── aquagia-vision.service.example# Plantilla de servicio systemd para Linux/Raspberry Pi
└── tests/                        # Suite con 22 pruebas unitarias e integrales
```

---

## 4. Instalación y Puesta en Marcha

### En Linux (Raspberry Pi / Ubuntu / Debian):

1. **Instalar paquetes del sistema:**
   ```bash
   sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip libgl1 libglib2.0-0 v4l-utils
   sudo usermod -aG video $USER
   ```

2. **Crear entorno virtual e instalar requerimientos:**
   ```bash
   cd aquagia-vision
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Ejecutar pruebas unitarias (22 tests):**
   ```bash
   python -m unittest discover tests
   ```

---

## 5. Guía de Uso

### 5.1 CLI (Línea de Comandos)

* **Analizar una captura actual (o sintética de prueba):**
  ```bash
  python cli.py analyze --output-json telemetria.json --output-image anotada.jpg
  ```

* **Analizar una imagen local en Modo A (ROIs fijas) o Modo B (YOLO):**
  ```bash
  python cli.py analyze --image /ruta/foto_cama.jpg --mode fixed
  ```

* **Consultar el estado actual del historial en la base de datos SQLite:**
  ```bash
  python cli.py status
  ```

* **Iniciar el demonio con API REST y scheduler en segundo plano:**
  ```bash
  python cli.py daemon --port 8000
  ```

---

### 5.2 API REST FastAPI

Al iniciar el servidor en el puerto `8000`:

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Estado del servicio, modo activo y métricas del último ciclo. |
| `GET` | `/api/plants` | Resumen completo de todas las plantas individuales (`P01` a `P09`). |
| `GET` | `/api/plants/{id}` | Ficha técnica de la planta solicitada (ej. `/api/plants/P01`). |
| `GET` | `/api/plants/{id}/card` | Ficha en texto plano formateada en árbol. |
| `GET` | `/api/plants/{id}/history` | Historial cronológico para graficar curvas de crecimiento. |
| `POST` | `/api/capture` | Fuerza una captura y análisis inmediato. |
| `GET` | `/api/frame/annotated` | Transmite el último frame con cajas, etiquetas de estado y colores. |
| `POST` | `/api/config/mode` | Conmuta dinámicamente entre `{"mode": "fixed"}` y `{"mode": "yolo"}`. |
| `POST` | `/api/sensors` | Inyecta lectura de sensores (`ph`, `ec`, `temperature`, `oxygen`, etc.). |
| `GET` | `/api/alerts` | Lista alertas activas del cultivo generadas por el motor de decisión. |

Documentación interactiva disponible en `http://localhost:8000/docs`.

---

### 5.3 Despliegue en Producción (Linux Systemd)

Para iniciar automáticamente en cada reinicio del sistema:

1. Copiar la plantilla de servicio:
   ```bash
   sudo cp aquagia-vision.service.example /etc/systemd/system/aquagia-vision.service
   ```
2. Habilitar e iniciar:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now aquagia-vision
   ```
3. Inspeccionar logs:
   ```bash
   journalctl -u aquagia-vision -f
   ```

---

### 5.4 Despliegue con Docker

```bash
docker build -t aquagia-vision .
docker run -d \
  --name aquagia-vision \
  --restart unless-stopped \
  --device /dev/video0:/dev/video0 \
  -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  aquagia-vision
```

---

## 6. Configuración de Regiones (ROIs)

Para adaptar la grilla a la geometría de tu cama acuapónica, edita [`config/default_rois.json`](file:///G:/Proyectos%20Inedsor/aquaponics-system/aquagia-vision/config/default_rois.json) con coordenadas normalizadas (`x`, `y`, `w`, `h` entre `0.0` y `1.0`):

```json
[
  {"id": "P01", "name": "Planta 01", "x": 0.05, "y": 0.05, "w": 0.26, "h": 0.26},
  {"id": "P02", "name": "Planta 02", "x": 0.37, "y": 0.05, "w": 0.26, "h": 0.26}
]
```
Esto garantiza que la calibración funcione independientemente de si la cámara captura a 720p, 1080p o 4K.

---

## 7. Integración con AquaGia OS

* **`camera-publisher`:** El archivo `plant_ai/analyzer.py` integra automáticamente `aquagia-vision` y emite por MQTT el topic `aquaponic/plants/telemetry` con la estructura de compatibilidad y el nuevo arreglo `individual`.
* **Backend NestJS:** El servicio `PlantAssessmentService` procesa las alertas individuales de cada planta y correlaciona con las alertas de correo y Telegram.
* **Frontend React:** La página `Plants.jsx` incluye la grilla interactiva para seleccionar cada planta (`P01`–`P09`) e inspeccionar su evolución en tiempo real.
