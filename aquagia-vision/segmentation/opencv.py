"""Preprocesamiento y segmentación básica con OpenCV para bajo consumo."""

from __future__ import annotations

from typing import List, Optional, Tuple

import cv2
import numpy as np


def compute_exg(bgr: np.ndarray) -> np.ndarray:
    """Calcula el índice de vegetación ExG (Excess Green: 2G - R - B)."""
    b, g, r = cv2.split(bgr.astype(np.float32))
    exg = 2.0 * g - r - b
    return exg


def segment_vegetation(
    bgr: np.ndarray,
    exg_threshold: Optional[float] = None,
    min_area_px: int = 300,
    morph_kernel_size: int = 5,
    morph_iterations: int = 2,
) -> Tuple[np.ndarray, List[np.ndarray]]:
    """Segmenta la vegetación foliar dentro de un ROI o imagen completa.

    Retorna:
        mask (np.ndarray): Máscara binaria uint8 (255 para planta, 0 para fondo).
        contours (list): Lista de contornos externos correspondientes a plantas.
    """
    if bgr is None or bgr.size == 0:
        return np.zeros((1, 1), dtype=np.uint8), []

    # 1. Filtro Gaussiano para reducir ruido de sensor de cámara
    blurred = cv2.GaussianBlur(bgr, (5, 5), 0)

    # 2. ExG
    exg = compute_exg(blurred)
    exg_u8 = cv2.normalize(exg, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    # 3. Umbralización
    if exg_threshold is None:
        # Otsu adaptativo sobre píxeles verdes
        _, binary = cv2.threshold(
            exg_u8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
    else:
        _, binary = cv2.threshold(
            exg_u8, int(exg_threshold), 255, cv2.THRESH_BINARY
        )

    # Filtro adicional en espacio HSV para evitar falsos positivos con agua/reflejos
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
    # Rango de verdes y amarillos vegetales (Hue: 18 a 95)
    lower_plant = np.array([18, 30, 30], dtype=np.uint8)
    upper_plant = np.array([95, 255, 255], dtype=np.uint8)
    color_mask = cv2.inRange(hsv, lower_plant, upper_plant)

    # Combinación lógica (ExG AND HSV)
    combined = cv2.bitwise_and(binary, color_mask)

    # 4. Morfología matemática (Apertura + Cierre)
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (morph_kernel_size, morph_kernel_size)
    )
    clean_mask = cv2.morphologyEx(
        combined, cv2.MORPH_OPEN, kernel, iterations=morph_iterations
    )
    clean_mask = cv2.morphologyEx(
        clean_mask, cv2.MORPH_CLOSE, kernel, iterations=morph_iterations
    )

    # 5. Filtrar componentes por área mínima
    contours, _ = cv2.findContours(
        clean_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    valid_contours = []
    filtered_mask = np.zeros_like(clean_mask)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area >= min_area_px:
            valid_contours.append(cnt)
            cv2.drawContours(filtered_mask, [cnt], -1, 255, thickness=cv2.FILLED)

    valid_contours.sort(key=cv2.contourArea, reverse=True)
    return filtered_mask, valid_contours


def detect_frame_change(
    prev_bgr: Optional[np.ndarray],
    curr_bgr: np.ndarray,
    threshold_pct: float = 3.0,
) -> Tuple[bool, float]:
    """Detecta si hubo cambio relevante entre dos frames consecutivos.

    Optimización edge-first: si el cambio es < threshold_pct, se evita inferencia pesada.
    """
    if prev_bgr is None or curr_bgr is None:
        return True, 100.0

    # Reducir resolución para comparación ultra-rápida
    small_size = (320, 180)
    gray1 = cv2.cvtColor(
        cv2.resize(prev_bgr, small_size), cv2.COLOR_BGR2GRAY
    )
    gray2 = cv2.cvtColor(
        cv2.resize(curr_bgr, small_size), cv2.COLOR_BGR2GRAY
    )

    diff = cv2.absdiff(gray1, gray2)
    _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
    changed_pixels = np.count_nonzero(thresh)
    total_pixels = thresh.size
    change_pct = (changed_pixels / total_pixels) * 100.0

    return (change_pct >= threshold_pct), round(change_pct, 2)


def crop_roi(
    image: np.ndarray,
    bbox: List[float] | Tuple[float, float, float, float],
    normalized: bool = True,
) -> np.ndarray:
    """Recorta un ROI de la imagen usando coordenadas normalizadas [0.0, 1.0] o absolutas."""
    h, w = image.shape[:2]
    x, y, bw, bh = bbox

    if normalized:
        px_x = max(0, int(round(x * w)))
        px_y = max(0, int(round(y * h)))
        px_w = min(w - px_x, int(round(bw * w)))
        px_h = min(h - px_y, int(round(bh * h)))
    else:
        px_x = max(0, int(x))
        px_y = max(0, int(y))
        px_w = min(w - px_x, int(bw))
        px_h = min(h - px_y, int(bh))

    if px_w <= 0 or px_h <= 0:
        return np.zeros((1, 1, 3), dtype=image.dtype)

    return image[px_y : px_y + px_h, px_x : px_x + px_w].copy()
