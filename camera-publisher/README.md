# Camera Publisher (Python → MQTT)

Captura frames de una o varias cámaras con OpenCV y los publica por **MQTT**
en el mismo broker que usa el backend de Aquaponic OS. El dashboard los muestra
en los paneles de **Peces** y **Plantas** sin cambios adicionales.

## Cómo encaja en el sistema

```
[Cámara/Webcam] → camera_publisher.py → MQTT (aquaponic/cameras/{fish|plants})
                                          │
                          ┌───────────────┴───────────────┐
                          ▼                               ▼
                 Backend NestJS (WS)              Frontend (MQTT-WS directo)
                          │                               │
                          └──────────► Dashboard ◄────────┘
```

Cada frame se envía como JPEG en base64 dentro de un *data URI*, que el
componente `CameraFeed` del frontend usa directamente como `src` de la imagen.

**Topic:** `aquaponic/cameras/<target>` (target = `fish` o `plants`)

**Payload:**

```json
{ "fish": { "cameraUrl": "data:image/jpeg;base64,...", "cameraStatus": "ok" } }
```

## Requisitos

- Python 3.9+
- Un broker MQTT en marcha (el mismo de `backend/.env`, por defecto
  `mqtt://localhost:1883`).

## Instalación

```bash
cd camera-publisher
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # luego edita .env
```

## Configuración (`.env`)

| Variable           | Descripción                                              |
| ------------------ | -------------------------------------------------------- |
| `MQTT_HOST`/`PORT` | Broker MQTT (igual que el backend)                       |
| `MQTT_TOPIC_PREFIX`| Prefijo de topics, debe coincidir (`aquaponic`)          |
| `CAMERAS`          | JSON con la lista de cámaras (ver abajo)                 |
| `CAMERA_TARGET`/`CAMERA_SOURCE` | Alternativa simple para una sola cámara     |
| `FPS`              | Cuadros por segundo a publicar (5 recomendado)           |
| `JPEG_QUALITY`     | Calidad JPEG 10–100 (60 equilibra tamaño/calidad)        |
| `FRAME_WIDTH`/`HEIGHT` | Redimensiona; altura 0 conserva la relación de aspecto |
| `RETAIN`           | `true` deja el último frame disponible a nuevos clientes |

### Una cámara

```env
CAMERA_TARGET=fish
CAMERA_SOURCE=0
```

### Dos cámaras (pecera + cultivo)

```env
CAMERAS=[{"target":"fish","source":0},{"target":"plants","source":1}]
```

`source` puede ser:

- un **índice** de webcam: `0`, `1`, …
- una **URL/RTSP**: `"rtsp://usuario:clave@192.168.1.50:554/stream"`
- una **ruta de archivo** de video: `"./demo.mp4"`

## Uso

```bash
python camera_publisher.py
```

Detén con `Ctrl + C` (publica `cameraStatus: "off"` al salir).

## Notas

- Para muchos FPS o alta resolución, considera transmitir por HTTP/RTSP y enviar
  solo la URL por MQTT; base64 sobre MQTT es práctico a bajo FPS.
- En Windows, las webcams por índice se abren con DirectShow automáticamente.
- Si el broker exige TLS o credenciales, configúralas en `.env`.
