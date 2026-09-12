"""Captura de imágenes para AquaGia Vision (Webcam, RTSP, Archivo y Sintético)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, Union

import cv2
import numpy as np

logger = logging.getLogger("AquaGiaVision.Camera")


class CameraCapture:
    """Maneja la captura de frames desde webcam, stream RTSP o generador sintético."""

    def __init__(
        self,
        source: Union[int, str] = 0,
        width: int = 1280,
        height: int = 720,
    ):
        self.source = source
        self.width = width
        self.height = height
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_synthetic = False
        self.static_image_path: Optional[Path] = None

        self._init_source()

    def _init_source(self) -> None:
        source_str = str(self.source).strip().lower()
        if source_str in ("synthetic", "demo", "mock"):
            self.is_synthetic = True
            logger.info("Cámara inicializada en modo SINTÉTICO (cama hidropónica simulada)")
            return

        # Si es un archivo de imagen estático
        p = Path(str(self.source))
        if p.exists() and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
            self.static_image_path = p
            logger.info(f"Cámara inicializada con imagen estática: {p}")
            return

        # Intentar inicializar cv2.VideoCapture
        try:
            if isinstance(self.source, int) or str(self.source).isdigit():
                self.cap = cv2.VideoCapture(int(self.source))
            else:
                self.cap = cv2.VideoCapture(str(self.source))

            if self.cap and self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                logger.info(f"Cámara abierta exitosamente: {self.source}")
            else:
                logger.warning(
                    f"No se pudo abrir la cámara {self.source}. Conmutando a generador SINTÉTICO."
                )
                self.is_synthetic = True
        except Exception as e:
            logger.warning(f"Error abriendo cámara: {e}. Conmutando a modo SINTÉTICO.")
            self.is_synthetic = True

    def get_frame(self) -> np.ndarray:
        """Captura un único frame en formato BGR."""
        if self.is_synthetic:
            return self._generate_synthetic_bed()

        if self.static_image_path:
            img = cv2.imread(str(self.static_image_path))
            if img is not None:
                return cv2.resize(img, (self.width, self.height))

        if self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if ret and frame is not None:
                if frame.shape[1] != self.width or frame.shape[0] != self.height:
                    return cv2.resize(frame, (self.width, self.height))
                return frame

        # Fallback de seguridad
        return self._generate_synthetic_bed()

    def _generate_synthetic_bed(self) -> np.ndarray:
        """Genera una imagen simulada de una cama hidropónica con 9 plantas de lechuga."""
        frame = np.full((self.height, self.width, 3), (35, 30, 25), dtype=np.uint8)

        # Dibujar canaletas / sustrato
        for row in range(3):
            y_center = int(self.height * (0.18 + row * 0.32))
            cv2.rectangle(
                frame,
                (int(self.width * 0.03), y_center - 80),
                (int(self.width * 0.97), y_center + 80),
                (55, 50, 45),
                -1,
            )

        # Dibujar 9 plantas en cuadrícula 3x3
        for r in range(3):
            for c in range(3):
                cx = int(self.width * (0.18 + c * 0.32))
                cy = int(self.height * (0.18 + r * 0.32))
                pid = r * 3 + c + 1

                # Orificio de la cama (soporte de canastilla)
                cv2.circle(frame, (cx, cy), 55, (20, 20, 20), -1)

                # Simular hojas verdes con elipses
                # Introducir una planta con clorosis (P02) y una con necrosis (P06) para pruebas
                if pid == 2:
                    leaf_color = (30, 180, 200)  # Tono amarillento (clorosis)
                elif pid == 6:
                    leaf_color = (25, 110, 120)  # Tono pardo/amarronado (necrosis)
                else:
                    leaf_color = (35, 180, 45)  # Verde saludable

                # Dibujar roseta de 8 a 12 hojas
                num_leaves = 10 if pid != 5 else 14
                for angle in range(0, 360, int(360 / num_leaves)):
                    rad = np.deg2rad(angle)
                    lx = int(cx + 35 * np.cos(rad))
                    ly = int(cy + 35 * np.sin(rad))
                    axes = (42, 22)
                    cv2.ellipse(
                        frame, (lx, ly), axes, angle, 0, 360, leaf_color, -1
                    )
                    # Borde suave
                    cv2.ellipse(
                        frame,
                        (lx, ly),
                        axes,
                        angle,
                        0,
                        360,
                        (int(leaf_color[0] * 0.8), int(leaf_color[1] * 0.8), int(leaf_color[2] * 0.8)),
                        1,
                    )

                # Centro foliar
                cv2.circle(frame, (cx, cy), 18, (45, 215, 60), -1)

        return frame

    def release(self) -> None:
        if self.cap:
            self.cap.release()
            self.cap = None
