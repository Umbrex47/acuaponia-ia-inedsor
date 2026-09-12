"""Gestor de ciclo periódico edge-first para AquaGia Vision."""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime
from typing import Callable, Optional

import numpy as np

from camera.capture import CameraCapture
from segmentation.opencv import detect_frame_change

logger = logging.getLogger("AquaGiaVision.CameraManager")


class CameraManager:
    """Ejecuta el ciclo de captura periódica de bajo consumo en segundo plano."""

    def __init__(
        self,
        camera: CameraCapture,
        on_frame_captured: Callable[[np.ndarray], None],
        day_interval_sec: float = 30.0,
        night_interval_sec: float = 300.0,
        day_start_hour: int = 6,
        night_start_hour: int = 20,
        change_detection_enabled: bool = True,
        change_threshold_pct: float = 3.0,
    ):
        self.camera = camera
        self.callback = on_frame_captured
        self.day_interval = day_interval_sec
        self.night_interval = night_interval_sec
        self.day_start = day_start_hour
        self.night_start = night_start_hour
        self.change_detection = change_detection_enabled
        self.change_threshold = change_threshold_pct

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._prev_frame: Optional[np.ndarray] = None
        self._last_capture_time = 0.0

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="AquaGia-CameraManager")
        self._thread.start()
        logger.info("CameraManager iniciado en segundo plano")

    def stop(self) -> None:
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        self.camera.release()
        logger.info("CameraManager detenido")

    def capture_now(self) -> np.ndarray:
        """Fuerza una captura y procesamiento inmediato."""
        frame = self.camera.get_frame()
        self._prev_frame = frame
        self._last_capture_time = time.monotonic()
        self.callback(frame)
        return frame

    def _loop(self) -> None:
        while self._running:
            try:
                # 1. Determinar intervalo según hora local (día vs noche)
                current_hour = datetime.now().hour
                is_day = self.day_start <= current_hour < self.night_start
                interval = self.day_interval if is_day else self.night_interval

                # 2. Capturar frame
                frame = self.camera.get_frame()

                # 3. Detección de cambios (opcional para ahorro de recursos)
                should_process = True
                if self.change_detection and self._prev_frame is not None:
                    changed, pct = detect_frame_change(
                        self._prev_frame, frame, self.change_threshold
                    )
                    # Forzar procesamiento si ha pasado más de 10 veces el intervalo mínimo
                    force_refresh = (time.monotonic() - self._last_capture_time) > (interval * 3)
                    should_process = changed or force_refresh

                if should_process:
                    self._prev_frame = frame.copy()
                    self._last_capture_time = time.monotonic()
                    self.callback(frame)

                # 4. Dormir hasta el siguiente intervalo periódico (cero consumo de CPU)
                # Dormir en micro-bloques para responder rápidamente a stop()
                sleep_steps = int(interval * 2)
                for _ in range(sleep_steps):
                    if not self._running:
                        break
                    time.sleep(0.5)

            except Exception as e:
                logger.error(f"Error en loop de CameraManager: {e}", exc_info=True)
                time.sleep(5.0)
