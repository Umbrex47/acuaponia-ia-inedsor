"""Modo B: Detección dinámica de plantas con YOLO-nano y CentroidTracker."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np

from detection.detector import BasePlantDetector, DetectedPlantRegion
from detection.tracker import CentroidTracker

logger = logging.getLogger("AquaGiaVision.YOLO")


class YoloPlantDetector(BasePlantDetector):
    """Modo B: Identificación de plantas en movimiento o posición variable con YOLO-nano."""

    def __init__(
        self,
        model_path: str | Path = "models/yolov8n_plants.pt",
        conf_threshold: float = 0.35,
        iou_threshold: float = 0.45,
        tracker_max_disappeared: int = 15,
        prefix: str = "P",
    ):
        self.model_path = Path(model_path)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.tracker = CentroidTracker(
            max_disappeared=tracker_max_disappeared, prefix=prefix
        )
        self.model = None

        self._load_model()

    def _load_model(self) -> None:
        try:
            from ultralytics import YOLO  # type: ignore

            if self.model_path.exists():
                self.model = YOLO(str(self.model_path))
                logger.info(f"Modelo YOLO cargado desde {self.model_path}")
            else:
                # Si no existe modelo local, usar yolov8n base
                logger.warning(
                    f"No se encontró {self.model_path}. Intentando cargar 'yolov8n.pt' para plantas/objetos"
                )
                self.model = YOLO("yolov8n.pt")
        except Exception as e:
            logger.warning(
                f"Ultralytics no disponible o error al cargar modelo YOLO: {e}. Modo B requerirá pesos válidos."
            )
            self.model = None

    def detect(self, frame: np.ndarray) -> List[DetectedPlantRegion]:
        if frame is None or frame.size == 0 or self.model is None:
            return []

        h, w = frame.shape[:2]
        results = self.model(
            frame,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            verbose=False,
        )

        detected_rects: List[Tuple[int, int, int, int]] = []
        confidences: List[float] = []

        for r in results:
            boxes = r.boxes
            for box in boxes:
                # Coordenadas en píxeles (x1, y1, x2, y2)
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                bx = max(0, int(x1))
                by = max(0, int(y1))
                bw = min(w - bx, int(x2 - x1))
                bh = min(h - by, int(y2 - y1))

                if bw > 15 and bh > 15:
                    detected_rects.append((bx, by, bw, bh))
                    confidences.append(float(box.conf[0].cpu().numpy()))

        # Actualizar tracker para mantener IDs persistentes (P01, P02...)
        tracked_objects = self.tracker.update(detected_rects)

        regions: List[DetectedPlantRegion] = []
        for pid, (bx, by, bw, bh) in tracked_objects.items():
            crop = frame[by : by + bh, bx : bx + bw].copy()
            norm_bbox = (bx / w, by / h, bw / w, bh / h)

            regions.append(
                DetectedPlantRegion(
                    plant_id=pid,
                    name=f"Planta {pid}",
                    bbox_norm=norm_bbox,
                    bbox_px=(bx, by, bw, bh),
                    crop=crop,
                    confidence=0.85,
                    mode="yolo",
                )
            )

        # Ordenar por id (P01, P02, ...)
        regions.sort(key=lambda r: r.plant_id)
        return regions
