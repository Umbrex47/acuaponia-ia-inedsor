"""
Publicador de cámara para Aquaponic OS.

Captura frames de una o varias cámaras (webcam, RTSP, archivo) con OpenCV,
los codifica como JPEG en base64 y los publica por MQTT en el mismo broker
que usa el backend. El dashboard los muestra en los paneles de Peces/Plantas.

Topic publicado:  {PREFIX}/cameras/{target}
Payload (JSON):   {"<target>": {"cameraUrl": "data:image/jpeg;base64,...",
                                 "cameraStatus": "ok"}}

donde <target> es "fish" o "plants" (las claves que entiende el frontend).
"""

from __future__ import annotations

import base64
import json
import os
import signal
import sys
import threading
import time
from dataclasses import dataclass

import cv2  # type: ignore
import paho.mqtt.client as mqtt

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # python-dotenv es opcional
    pass


VALID_TARGETS = {"fish", "plants"}


def _env(key: str, default: str = "") -> str:
    value = os.environ.get(key)
    return value if value not in (None, "") else default


def _env_int(key: str, default: int) -> int:
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


def _env_bool(key: str, default: bool = False) -> bool:
    return _env(key, "true" if default else "false").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


@dataclass
class CameraConfig:
    target: str
    source: object  # int (índice) o str (URL/RTSP/ruta)


@dataclass
class AppConfig:
    host: str
    port: int
    username: str
    password: str
    client_id: str
    prefix: str
    cameras: list[CameraConfig]
    fps: int
    jpeg_quality: int
    width: int
    height: int
    retain: bool

    @property
    def topic_prefix(self) -> str:
        return self.prefix.rstrip("/")


def load_config() -> AppConfig:
    cameras: list[CameraConfig] = []

    raw = _env("CAMERAS")
    if raw:
        try:
            for item in json.loads(raw):
                target = str(item.get("target", "")).strip()
                source = item.get("source", 0)
                if target not in VALID_TARGETS:
                    print(f"[WARN] target inválido '{target}', se omite", flush=True)
                    continue
                cameras.append(CameraConfig(target=target, source=source))
        except (json.JSONDecodeError, AttributeError, TypeError) as err:
            print(f"[WARN] CAMERAS mal formado ({err}); uso CAMERA_TARGET/SOURCE", flush=True)

    if not cameras:
        target = _env("CAMERA_TARGET", "fish")
        source_raw = _env("CAMERA_SOURCE", "0")
        source: object = int(source_raw) if source_raw.isdigit() else source_raw
        if target not in VALID_TARGETS:
            target = "fish"
        cameras.append(CameraConfig(target=target, source=source))

    return AppConfig(
        host=_env("MQTT_HOST", "localhost"),
        port=_env_int("MQTT_PORT", 1883),
        username=_env("MQTT_USERNAME"),
        password=_env("MQTT_PASSWORD"),
        client_id=_env("MQTT_CLIENT_ID", "aquaponic-camera-py"),
        prefix=_env("MQTT_TOPIC_PREFIX", "aquaponic"),
        cameras=cameras,
        fps=max(1, _env_int("FPS", 5)),
        jpeg_quality=min(100, max(10, _env_int("JPEG_QUALITY", 60))),
        width=_env_int("FRAME_WIDTH", 640),
        height=_env_int("FRAME_HEIGHT", 0),
        retain=_env_bool("RETAIN", False),
    )


def build_mqtt_client(cfg: AppConfig) -> mqtt.Client:
    # Compatibilidad con paho-mqtt 1.x y 2.x.
    try:
        client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2, client_id=cfg.client_id  # type: ignore[attr-defined]
        )
    except (AttributeError, TypeError):
        client = mqtt.Client(client_id=cfg.client_id)

    if cfg.username:
        client.username_pw_set(cfg.username, cfg.password or None)

    def on_connect(_c, _u, _f, rc, *_args):
        ok = rc == 0 or getattr(rc, "is_failure", True) is False
        print(f"[MQTT] {'Conectado' if ok else f'Error de conexión ({rc})'} a "
              f"{cfg.host}:{cfg.port}", flush=True)

    def on_disconnect(_c, _u, *_args):
        print("[MQTT] Desconectado, reintentando…", flush=True)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.reconnect_delay_set(min_delay=1, max_delay=10)
    return client


class CameraStreamer(threading.Thread):
    """Captura y publica una sola cámara en su propio hilo."""

    def __init__(self, cfg: AppConfig, cam: CameraConfig, client: mqtt.Client,
                 stop_event: threading.Event):
        super().__init__(daemon=True, name=f"cam-{cam.target}")
        self.cfg = cfg
        self.cam = cam
        self.client = client
        self.stop_event = stop_event
        self.topic = f"{cfg.topic_prefix}/cameras/{cam.target}"
        self.encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), cfg.jpeg_quality]

    def _open_capture(self) -> "cv2.VideoCapture | None":
        source = self.cam.source
        # En Windows, las webcams por índice abren mejor con DirectShow.
        if isinstance(source, int) and os.name == "nt":
            cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(source)

        if not cap.isOpened():
            cap.release()
            return None

        if self.cfg.width > 0:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.cfg.width)
        if self.cfg.height > 0:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cfg.height)
        return cap

    def _resize(self, frame):
        w = self.cfg.width
        h = self.cfg.height
        if w <= 0 and h <= 0:
            return frame
        fh, fw = frame.shape[:2]
        if h <= 0:  # conservar relación de aspecto a partir del ancho
            h = max(1, int(fw and fh * w / fw))
        if w <= 0:
            w = max(1, int(fh and fw * h / fh))
        if (fw, fh) == (w, h):
            return frame
        return cv2.resize(frame, (w, h), interpolation=cv2.INTER_AREA)

    def _publish(self, status: str, data_uri: str | None = None) -> None:
        body = {self.cam.target: {"cameraStatus": status}}
        if data_uri is not None:
            body[self.cam.target]["cameraUrl"] = data_uri
        self.client.publish(
            self.topic, json.dumps(body), qos=0, retain=self.cfg.retain
        )

    def run(self) -> None:
        period = 1.0 / self.cfg.fps
        cap: "cv2.VideoCapture | None" = None
        print(f"[{self.cam.target}] publicando en {self.topic} "
              f"(fuente={self.cam.source!r}, {self.cfg.fps} fps)", flush=True)

        while not self.stop_event.is_set():
            start = time.monotonic()

            if cap is None:
                cap = self._open_capture()
                if cap is None:
                    print(f"[{self.cam.target}] no se pudo abrir la cámara, "
                          f"reintento en 3s", flush=True)
                    self._publish("off")
                    self.stop_event.wait(3)
                    continue

            ok, frame = cap.read()
            if not ok or frame is None:
                print(f"[{self.cam.target}] frame inválido, reabriendo cámara", flush=True)
                self._publish("warn")
                cap.release()
                cap = None
                self.stop_event.wait(1)
                continue

            frame = self._resize(frame)
            ok, buffer = cv2.imencode(".jpg", frame, self.encode_params)
            if ok:
                b64 = base64.b64encode(buffer.tobytes()).decode("ascii")
                self._publish("ok", f"data:image/jpeg;base64,{b64}")

            # Mantener el FPS objetivo.
            elapsed = time.monotonic() - start
            if elapsed < period:
                self.stop_event.wait(period - elapsed)

        if cap is not None:
            cap.release()
        self._publish("off")
        print(f"[{self.cam.target}] detenido", flush=True)


def main() -> int:
    cfg = load_config()
    client = build_mqtt_client(cfg)

    try:
        client.connect(cfg.host, cfg.port, keepalive=30)
    except OSError as err:
        print(f"[MQTT] No se pudo conectar a {cfg.host}:{cfg.port} → {err}", flush=True)
        return 1

    client.loop_start()

    stop_event = threading.Event()

    def handle_signal(_signum, _frame):
        print("\nDeteniendo…", flush=True)
        stop_event.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    streamers = [CameraStreamer(cfg, cam, client, stop_event) for cam in cfg.cameras]
    for s in streamers:
        s.start()

    try:
        while not stop_event.is_set():
            time.sleep(0.5)
    finally:
        stop_event.set()
        for s in streamers:
            s.join(timeout=5)
        client.loop_stop()
        client.disconnect()

    return 0


if __name__ == "__main__":
    sys.exit(main())
