from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from src.config import load_yaml


@dataclass
class CameraCalibration:
    px_per_cm: float
    roi: tuple[int, int, int, int] | None = None

    @classmethod
    def from_file(cls, path: Path) -> CameraCalibration:
        data = load_yaml(path)
        ref = data.get("reference", {})
        width_px = float(ref.get("width_px", 0))
        width_cm = float(ref.get("width_cm", 1))
        if width_px <= 0 or width_cm <= 0:
            raise ValueError(
                f"Calibración inválida en {path}: define reference.width_px y width_cm"
            )
        roi = data.get("roi")
        roi_tuple = tuple(roi) if roi else None
        return cls(px_per_cm=width_px / width_cm, roi=roi_tuple)

    def px_area_to_cm2(self, area_px: float) -> float:
        return area_px / (self.px_per_cm**2)

    def apply_roi(self, image: np.ndarray) -> np.ndarray:
        if self.roi is None:
            return image
        x, y, w, h = self.roi
        return image[y : y + h, x : x + w]
