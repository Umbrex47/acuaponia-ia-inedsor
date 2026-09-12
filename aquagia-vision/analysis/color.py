"""Análisis cuantitativo de color, clorosis y necrosis foliar."""

from __future__ import annotations

from typing import Any, Dict

import cv2
import numpy as np


def extract_color_metrics(
    bgr_crop: np.ndarray,
    mask: np.ndarray,
) -> Dict[str, Any]:
    """Calcula métricas de color exclusivamente en la región enmascarada de la planta.

    Retorna:
        green_ratio: Proporción de follaje verde saludable [0.0, 1.0].
        yellow_ratio: Proporción de clorosis / amarilleo [0.0, 1.0].
        brown_ratio: Proporción de necrosis / pardeamiento [0.0, 1.0].
        mean_hue: Tono HSV promedio (0-179).
        mean_saturation: Saturación HSV promedio (0-255).
        mean_brightness: Brillo/Valor HSV promedio (0-255).
    """
    if bgr_crop is None or mask is None:
        return {
            "green_ratio": 0.0,
            "yellow_ratio": 0.0,
            "brown_ratio": 0.0,
            "mean_hue": 0.0,
            "mean_saturation": 0.0,
            "mean_brightness": 0.0,
        }

    plant_pixels = np.count_nonzero(mask)
    if plant_pixels == 0:
        return {
            "green_ratio": 0.0,
            "yellow_ratio": 0.0,
            "brown_ratio": 0.0,
            "mean_hue": 0.0,
            "mean_saturation": 0.0,
            "mean_brightness": 0.0,
        }

    hsv = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # 1. Rango Verde Saludable: Hue 35 a 85
    lower_green = np.array([35, 40, 40], dtype=np.uint8)
    upper_green = np.array([85, 255, 255], dtype=np.uint8)
    green_mask = cv2.inRange(hsv, lower_green, upper_green)
    green_in_plant = cv2.bitwise_and(green_mask, mask)
    green_pixels = np.count_nonzero(green_in_plant)
    green_ratio = round(green_pixels / plant_pixels, 3)

    # 2. Rango Amarillo / Clorosis: Hue 20 a 34
    lower_yellow = np.array([20, 40, 40], dtype=np.uint8)
    upper_yellow = np.array([34, 255, 255], dtype=np.uint8)
    yellow_mask = cv2.inRange(hsv, lower_yellow, upper_yellow)
    yellow_in_plant = cv2.bitwise_and(yellow_mask, mask)
    yellow_pixels = np.count_nonzero(yellow_in_plant)
    yellow_ratio = round(yellow_pixels / plant_pixels, 3)

    # 3. Rango Pardo / Necrosis: Hue 10 a 20 con saturación media o brillo bajo
    lower_brown = np.array([10, 30, 20], dtype=np.uint8)
    upper_brown = np.array([20, 200, 150], dtype=np.uint8)
    brown_mask = cv2.inRange(hsv, lower_brown, upper_brown)
    # También necrosis oscura (V < 40)
    dark_mask = (v < 40).astype(np.uint8) * 255
    necrosis_combined = cv2.bitwise_or(brown_mask, dark_mask)
    necrosis_in_plant = cv2.bitwise_and(necrosis_combined, mask)
    brown_pixels = np.count_nonzero(necrosis_in_plant)
    brown_ratio = round(brown_pixels / plant_pixels, 3)

    # 4. Promedios dentro de la máscara
    valid_indices = mask > 0
    mean_hue = round(float(np.mean(h[valid_indices])), 1)
    mean_sat = round(float(np.mean(s[valid_indices])), 1)
    mean_val = round(float(np.mean(v[valid_indices])), 1)

    return {
        "green_ratio": min(1.0, green_ratio),
        "yellow_ratio": min(1.0, yellow_ratio),
        "brown_ratio": min(1.0, brown_ratio),
        "mean_hue": mean_hue,
        "mean_saturation": mean_sat,
        "mean_brightness": mean_val,
    }
