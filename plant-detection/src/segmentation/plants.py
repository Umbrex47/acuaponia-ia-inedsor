from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class PlantRegion:
    id: int
    mask: np.ndarray
    bbox: tuple[int, int, int, int]  # x, y, w, h
    area_px: int
    centroid: tuple[int, int]


def _excess_green(bgr: np.ndarray) -> np.ndarray:
    b, g, r = cv2.split(bgr.astype(np.float32))
    return 2.0 * g - r - b


def segment_plants(
    bgr: np.ndarray,
    *,
    exg_threshold: float | None = None,
    min_area_px: int = 2500,
    max_plants: int = 20,
) -> list[PlantRegion]:
    """Segmenta plantas por índice ExG — no requiere etiquetas (cámara fija)."""
    exg = _excess_green(bgr)
    exg_u8 = cv2.normalize(exg, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    if exg_threshold is None:
        threshold, _ = cv2.threshold(exg_u8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        threshold = int(exg_threshold)

    _, binary = cv2.threshold(exg_u8, threshold, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=2)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)
    regions: list[PlantRegion] = []

    for label in range(1, num_labels):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area < min_area_px:
            continue
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        w = int(stats[label, cv2.CC_STAT_WIDTH])
        h = int(stats[label, cv2.CC_STAT_HEIGHT])
        mask = (labels == label).astype(np.uint8) * 255
        cx, cy = int(centroids[label][0]), int(centroids[label][1])
        regions.append(
            PlantRegion(
                id=len(regions) + 1,
                mask=mask,
                bbox=(x, y, w, h),
                area_px=area,
                centroid=(cx, cy),
            )
        )

    regions.sort(key=lambda r: r.area_px, reverse=True)
    return regions[:max_plants]
