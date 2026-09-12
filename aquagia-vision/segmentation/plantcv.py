"""Motor de fenotipado computacional basado en PlantCV / OpenCV ligero."""

from __future__ import annotations

from typing import Any, Dict, Optional

import cv2
import numpy as np


def extract_phenotype_features(
    bgr_roi: np.ndarray,
    mask: np.ndarray,
    px_to_cm2: float = 0.015,
) -> Dict[str, Any]:
    """Extrae características cuantitativas de fenotipado (morfología, forma, área).

    Implementa los principios de PlantCV con máxima eficiencia computacional para edge.
    """
    if bgr_roi is None or mask is None or np.count_nonzero(mask) == 0:
        return {
            "area_px": 0,
            "area_cm2": 0.0,
            "width_px": 0,
            "height_px": 0,
            "perimeter_px": 0.0,
            "solidity": 0.0,
            "aspect_ratio": 0.0,
            "extent": 0.0,
            "centroid": (0, 0),
            "convex_hull_area": 0.0,
        }

    # 1. Área vegetal
    area_px = int(np.count_nonzero(mask))
    area_cm2 = round(area_px * px_to_cm2, 2)

    # 2. Contorno principal
    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return {
            "area_px": area_px,
            "area_cm2": area_cm2,
            "width_px": 0,
            "height_px": 0,
            "perimeter_px": 0.0,
            "solidity": 0.0,
            "aspect_ratio": 0.0,
            "extent": 0.0,
            "centroid": (0, 0),
            "convex_hull_area": 0.0,
        }

    main_cnt = max(contours, key=cv2.contourArea)

    # 3. Geometría y caja envolvente
    x, y, w, h = cv2.boundingRect(main_cnt)
    perimeter = round(float(cv2.arcLength(main_cnt, True)), 2)
    aspect_ratio = round(float(w) / float(h), 3) if h > 0 else 0.0
    rect_area = w * h
    extent = round(float(area_px) / float(rect_area), 3) if rect_area > 0 else 0.0

    # 4. Envolvente convexa y solidez (Solidity = Area / ConvexHullArea)
    hull = cv2.convexHull(main_cnt)
    hull_area = cv2.contourArea(hull)
    solidity = round(float(area_px) / float(hull_area), 3) if hull_area > 0 else 0.0

    # 5. Centroide
    moments = cv2.moments(main_cnt)
    if moments["m00"] != 0:
        cx = int(moments["m10"] / moments["m00"])
        cy = int(moments["m01"] / moments["m00"])
    else:
        cx, cy = x + w // 2, y + h // 2

    return {
        "area_px": area_px,
        "area_cm2": area_cm2,
        "width_px": w,
        "height_px": h,
        "perimeter_px": perimeter,
        "solidity": solidity,
        "aspect_ratio": aspect_ratio,
        "extent": extent,
        "centroid": (cx, cy),
        "convex_hull_area": round(float(hull_area), 1),
    }
