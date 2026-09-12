"""Detectores de plantas: Modo A (ROIs fijas) y abstracción base."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from segmentation.opencv import crop_roi


@dataclass
class DetectedPlantRegion:
    plant_id: str  # Ej: "P01"
    name: str  # Ej: "Planta 01"
    bbox_norm: Tuple[float, float, float, float]  # (x, y, w, h) normalizados [0.0, 1.0]
    bbox_px: Tuple[int, int, int, int]  # (x, y, w, h) en píxeles
    crop: np.ndarray  # Recorte BGR del ROI
    confidence: float = 1.0
    mode: str = "fixed"  # "fixed" o "yolo"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plant_id": self.plant_id,
            "name": self.name,
            "bbox_norm": list(self.bbox_norm),
            "bbox_px": list(self.bbox_px),
            "confidence": round(self.confidence, 3),
            "mode": self.mode,
        }


class BasePlantDetector(ABC):
    """Interfaz abstracta para detectores de plantas."""

    @abstractmethod
    def detect(self, frame: np.ndarray) -> List[DetectedPlantRegion]:
        """Identifica las plantas en el frame y retorna los recortes individuales."""
        pass


class FixedRoiDetector(BasePlantDetector):
    """Modo A: Identificación de plantas mediante Regiones de Interés (ROIs) fijas.

    Ventajas:
    - Cero consumo de GPU y latencia instantánea (< 5 ms).
    - Asignación determinista de identidad (P01 siempre corresponde a la posición 1).
    - No requiere entrenamiento de modelos de detección.
    """

    def __init__(
        self,
        rois_config: Optional[List[Dict[str, Any]]] = None,
        rois_file: Optional[Path | str] = None,
        rows: int = 3,
        cols: int = 3,
        prefix: str = "P",
    ):
        self.prefix = prefix
        self.rois: List[Dict[str, Any]] = []

        if rois_config:
            self.rois = rois_config
        elif rois_file and Path(rois_file).exists():
            with open(rois_file, "r", encoding="utf-8") as f:
                self.rois = json.load(f)
        else:
            self.rois = self._generate_grid(rows, cols, prefix)

    def _generate_grid(
        self, rows: int, cols: int, prefix: str
    ) -> List[Dict[str, Any]]:
        """Genera una grilla matemática normalizada de NxM plantas con márgenes."""
        grid = []
        margin_x = 0.04
        margin_y = 0.04
        available_w = 1.0 - (margin_x * 2)
        available_h = 1.0 - (margin_y * 2)

        slot_w = available_w / cols
        slot_h = available_h / rows

        count = 1
        for r in range(rows):
            for c in range(cols):
                pid = f"{prefix}{count:02d}"
                x = margin_x + c * slot_w + (slot_w * 0.05)
                y = margin_y + r * slot_h + (slot_h * 0.05)
                w = slot_w * 0.90
                h = slot_h * 0.90
                grid.append(
                    {
                        "id": pid,
                        "name": f"Planta {count:02d}",
                        "x": round(x, 4),
                        "y": round(y, 4),
                        "w": round(w, 4),
                        "h": round(h, 4),
                    }
                )
                count += 1
        return grid

    def detect(self, frame: np.ndarray) -> List[DetectedPlantRegion]:
        if frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        detected = []

        for roi in self.rois:
            pid = roi["id"]
            name = roi.get("name", pid)
            rx, ry, rw, rh = roi["x"], roi["y"], roi["w"], roi["h"]

            px_x = max(0, int(round(rx * w)))
            px_y = max(0, int(round(ry * h)))
            px_w = min(w - px_x, int(round(rw * w)))
            px_h = min(h - px_y, int(round(rh * h)))

            crop = frame[px_y : px_y + px_h, px_x : px_x + px_w].copy()
            detected.append(
                DetectedPlantRegion(
                    plant_id=pid,
                    name=name,
                    bbox_norm=(rx, ry, rw, rh),
                    bbox_px=(px_x, px_y, px_w, px_h),
                    crop=crop,
                    confidence=1.0,
                    mode="fixed",
                )
            )

        return detected
