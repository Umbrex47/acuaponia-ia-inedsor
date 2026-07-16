"""
Publicador de cámara para Aquaponic OS.

Captura frames (webcam, RTSP, archivo) con OpenCV, los codifica como JPEG
base64 y los publica por MQTT. Con FISH_DETECT_ENABLED=true, la cámara
`fish` corre YOLO+SORT, analiza conducta y publica telemetría en
{PREFIX}/fish/telemetry.
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
from pathlib import Path

import cv2  # type: ignore
import paho.mqtt.client as mqtt

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass


VALID_TARGETS = {"fish", "plants"}
ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = (
    ROOT.parent / "fish-detection" / "models" / "fish_yolo11s_aquarium.pt"
)


def _env(key: str, default: str = "") -> str:
    value = os.environ.get(key)
    return value if value not in (None, "") else default


def _env_int(key: str, default: int) -> int:
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    try:
        return float(_env(key, str(default)))
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
    source: object


@dataclass
class DetectConfig:
    enabled: bool
    model_path: Path
    conf: float
    every_n: int
    overlay: bool
    class_name: str
    window_sec: float
    surface_band: float
    activity_low: float
    activity_high: float
    surface_thr: float
    assess_interval_sec: float
    telemetry_every_sec: float


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
    detect: DetectConfig

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

    model_raw = _env("FISH_DETECT_MODEL", str(DEFAULT_MODEL))
    detect = DetectConfig(
        enabled=_env_bool("FISH_DETECT_ENABLED", False),
        model_path=Path(model_raw),
        conf=_env_float("FISH_DETECT_CONF", 0.35),
        every_n=max(1, _env_int("FISH_DETECT_EVERY_N", 2)),
        overlay=_env_bool("FISH_DETECT_OVERLAY", True),
        class_name=_env("FISH_DETECT_CLASS", "fish"),
        window_sec=_env_float("FISH_BEHAVIOR_WINDOW_SEC", 180),
        surface_band=_env_float("FISH_SURFACE_BAND", 0.25),
        activity_low=_env_float("FISH_ACTIVITY_LOW", 0.08),
        activity_high=_env_float("FISH_ACTIVITY_HIGH", 0.35),
        surface_thr=_env_float("FISH_SURFACE_THR", 0.55),
        assess_interval_sec=_env_float("FISH_ASSESS_INTERVAL_SEC", 90),
        telemetry_every_sec=_env_float("FISH_TELEMETRY_EVERY_SEC", 5),
    )

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
        detect=detect,
    )


def build_mqtt_client(cfg: AppConfig) -> mqtt.Client:
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
        print(
            f"[MQTT] {'Conectado' if ok else f'Error de conexión ({rc})'} a "
            f"{cfg.host}:{cfg.port}",
            flush=True,
        )

    def on_disconnect(_c, _u, *_args):
        print("[MQTT] Desconectado, reintentando…", flush=True)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.reconnect_delay_set(min_delay=1, max_delay=10)
    return client


class CameraStreamer(threading.Thread):
    """Captura y publica una sola cámara en su propio hilo."""

    def __init__(
        self,
        cfg: AppConfig,
        cam: CameraConfig,
        client: mqtt.Client,
        stop_event: threading.Event,
    ):
        super().__init__(daemon=True, name=f"cam-{cam.target}")
        self.cfg = cfg
        self.cam = cam
        self.client = client
        self.stop_event = stop_event
        self.topic = f"{cfg.topic_prefix}/cameras/{cam.target}"
        self.telemetry_topic = f"{cfg.topic_prefix}/fish/telemetry"
        self.encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), cfg.jpeg_quality]
        self._detector = None
        self._analyzer = None
        self._frame_i = 0
        self._last_telemetry = 0.0
        self._last_result = None

        if cam.target == "fish" and cfg.detect.enabled:
            self._init_detector()

    def _init_detector(self) -> None:
        dcfg = self.cfg.detect
        if not dcfg.model_path.exists():
            print(
                f"[fish] modelo no encontrado: {dcfg.model_path} "
                "(detección desactivada)",
                flush=True,
            )
            return
        try:
            from fish_ai.analyzer import BehaviorAnalyzer
            from fish_ai.detector import FishDetector

            self._detector = FishDetector(
                dcfg.model_path,
                conf=dcfg.conf,
                class_name=dcfg.class_name,
            )
            self._analyzer = BehaviorAnalyzer(
                window_sec=dcfg.window_sec,
                surface_band=dcfg.surface_band,
                activity_low=dcfg.activity_low,
                activity_high=dcfg.activity_high,
                surface_thr=dcfg.surface_thr,
                assess_interval_sec=dcfg.assess_interval_sec,
            )
            print(
                f"[fish] detección activa ({dcfg.model_path.name}, "
                f"conf={dcfg.conf})",
                flush=True,
            )
        except Exception as err:
            print(f"[fish] no se pudo cargar el detector: {err}", flush=True)
            self._detector = None
            self._analyzer = None

    def _open_capture(self) -> "cv2.VideoCapture | None":
        source = self.cam.source
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
        if h <= 0:
            h = max(1, int(fw and fh * w / fw))
        if w <= 0:
            w = max(1, int(fh and fw * h / fh))
        if (fw, fh) == (w, h):
            return frame
        return cv2.resize(frame, (w, h), interpolation=cv2.INTER_AREA)

    def _publish_camera(self, status: str, data_uri: str | None = None) -> None:
        body = {self.cam.target: {"cameraStatus": status}}
        if data_uri is not None:
            body[self.cam.target]["cameraUrl"] = data_uri
        self.client.publish(
            self.topic, json.dumps(body), qos=0, retain=self.cfg.retain
        )

    def _publish_telemetry(self, result, force_assessment: bool = False) -> None:
        fish: dict = {
            "count": result.count,
            "detections": result.detections,
            "confidenceAvg": result.confidence_avg,
            "detector": "yolo11s-aquarium+sort",
            "cameraStatus": "ok",
            "mood": result.mood,
            "behavior": result.behavior,
        }
        if result.assessment is not None or force_assessment:
            if result.assessment is not None:
                fish["assessment"] = result.assessment
        payload = {
            "fish": fish,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "camera-publisher",
        }
        self.client.publish(
            self.telemetry_topic,
            json.dumps(payload),
            qos=0,
            retain=False,
        )

    def _process_fish(self, frame):
        from fish_ai.overlay import draw_tracks

        dcfg = self.cfg.detect
        self._frame_i += 1
        run_now = self._frame_i % dcfg.every_n == 0

        if run_now and self._detector and self._analyzer:
            tracks, detections, conf_avg = self._detector.process(frame)
            result = self._analyzer.update(
                tracks, detections, conf_avg, frame.shape[0]
            )
            self._last_result = result
        else:
            result = self._last_result

        out = frame
        if result is not None and dcfg.overlay:
            out = draw_tracks(frame, result.overlay_tracks, result.count)

        now = time.monotonic()
        if result is not None and (
            now - self._last_telemetry >= dcfg.telemetry_every_sec
            or (result.assessment is not None)
        ):
            self._publish_telemetry(result)
            self._last_telemetry = now

        return out

    def run(self) -> None:
        period = 1.0 / self.cfg.fps
        cap: "cv2.VideoCapture | None" = None
        print(
            f"[{self.cam.target}] publicando en {self.topic} "
            f"(fuente={self.cam.source!r}, {self.cfg.fps} fps)",
            flush=True,
        )

        while not self.stop_event.is_set():
            start = time.monotonic()

            if cap is None:
                cap = self._open_capture()
                if cap is None:
                    print(
                        f"[{self.cam.target}] no se pudo abrir la cámara, "
                        f"reintento en 3s",
                        flush=True,
                    )
                    self._publish_camera("off")
                    self.stop_event.wait(3)
                    continue

            ok, frame = cap.read()
            if not ok or frame is None:
                print(
                    f"[{self.cam.target}] frame inválido, reabriendo cámara",
                    flush=True,
                )
                self._publish_camera("warn")
                cap.release()
                cap = None
                self.stop_event.wait(1)
                continue

            frame = self._resize(frame)

            if self.cam.target == "fish" and self._detector is not None:
                frame = self._process_fish(frame)

            ok, buffer = cv2.imencode(".jpg", frame, self.encode_params)
            if ok:
                b64 = base64.b64encode(buffer.tobytes()).decode("ascii")
                self._publish_camera("ok", f"data:image/jpeg;base64,{b64}")

            elapsed = time.monotonic() - start
            if elapsed < period:
                self.stop_event.wait(period - elapsed)

        if cap is not None:
            cap.release()
        self._publish_camera("off")
        print(f"[{self.cam.target}] detenido", flush=True)


def main() -> int:
    cfg = load_config()
    client = build_mqtt_client(cfg)

    try:
        client.connect(cfg.host, cfg.port, keepalive=30)
    except OSError as err:
        print(
            f"[MQTT] No se pudo conectar a {cfg.host}:{cfg.port} → {err}",
            flush=True,
        )
        return 1

    client.loop_start()
    stop_event = threading.Event()

    def handle_signal(_signum, _frame):
        print("\nDeteniendo…", flush=True)
        stop_event.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    streamers = [
        CameraStreamer(cfg, cam, client, stop_event) for cam in cfg.cameras
    ]
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
