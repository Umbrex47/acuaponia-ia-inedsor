# Guía de AquaGia Vision (AquaGia OS)

Sistema de visión artificial *edge-first* y bajo consumo para el monitoreo individual de plantas acuapónicas con identidad persistente (`P01`–`Pn`), fenotipado cuantitativo y motor de estado multivariable.

Código fuente y documentación detallada: [`aquagia-vision/`](../aquagia-vision/README.md)

---

## Componentes y Arquitectura

1. **Modo A (Posiciones fijas / ROIs):** Inferencia ultraligera en CPU mediante OpenCV y NumPy (< 30 ms por captura).
2. **Modo B (Posición dinámica):** Detección con YOLO-nano + CentroidTracker para seguimiento de plantas móviles.
3. **Métricas Biométricas:**
   - Cobertura y área foliar ($cm^2$).
   - Tasa de crecimiento temporal: $G = \frac{A_t - A_{t-1}}{\Delta t}$ (%/día y $cm^2/\text{día}$).
   - Conteo foliar por transformada de distancia.
   - Diagnóstico de clorosis (amarillamiento) y necrosis (pardeamiento).
4. **Persistencia:** SQLite local-first (`aquagia_vision.db`).
5. **Motor de Decisión:** Correlación entre visión foliar y parámetros fisicoquímicos del agua (pH, EC, temperatura, oxígeno disuelto).
6. **Integraciones:**
   - Publicación en broker MQTT (`aquaponic/plants/individual` y `aquaponic/plants/telemetry`).
   - Soporte en backend NestJS (`PlantAssessmentService`).
   - Visualizador de grilla interactiva en el Dashboard React (`Plants.jsx`).

---

## Comandos Rápidos

```bash
cd aquagia-vision
python -m venv .venv
source .venv/bin/activate  # o .\.venv\Scripts\activate en Windows
pip install -r requirements.txt

# Ejecución de pruebas unitarias
python -m unittest discover tests

# Análisis manual
python cli.py analyze --output-json telemetria.json --output-image anotada.jpg

# Iniciar servicio demonio
python cli.py daemon --port 8000
```
