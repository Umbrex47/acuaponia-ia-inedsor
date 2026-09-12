"""Pruebas unitarias para análisis de color, hojas, crecimiento y salud."""

import unittest
from datetime import datetime, timedelta, timezone
import numpy as np
import cv2

from analysis.color import extract_color_metrics
from analysis.leaves import estimate_leaf_metrics
from analysis.growth import calculate_growth_rate
from analysis.health import evaluate_plant_health


class TestAnalysis(unittest.TestCase):
    def test_extract_color_metrics(self):
        # Parche 100x100 verde
        patch = np.zeros((100, 100, 3), dtype=np.uint8)
        patch[:, :] = (35, 190, 45)  # Verde
        mask = np.full((100, 100), 255, dtype=np.uint8)

        metrics = extract_color_metrics(patch, mask)
        self.assertGreater(metrics["green_ratio"], 0.85)
        self.assertLess(metrics["yellow_ratio"], 0.05)
        self.assertLess(metrics["brown_ratio"], 0.05)

        # Parche con clorosis (amarillento)
        patch_yellow = np.zeros((100, 100, 3), dtype=np.uint8)
        patch_yellow[:, :] = (30, 200, 210)  # BGR amarillo
        metrics_y = extract_color_metrics(patch_yellow, mask)
        self.assertGreater(metrics_y["yellow_ratio"], 0.70)

    def test_estimate_leaf_metrics(self):
        # Crear una máscara con 3 círculos separados (3 hojas)
        mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(mask, (60, 60), 25, 255, -1)
        cv2.circle(mask, (140, 60), 25, 255, -1)
        cv2.circle(mask, (100, 140), 25, 255, -1)

        leaves = estimate_leaf_metrics(mask)
        self.assertGreaterEqual(leaves["leaf_count"], 3)
        self.assertGreater(leaves["leaf_density_px"], 0.0)

    def test_calculate_growth_rate(self):
        t1 = datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc)
        t2 = t1 + timedelta(days=2)  # Pasaron 2 días

        # Planta creció de 400 cm² a 430 cm² en 2 días (+15 cm²/día, +7.5% total)
        growth = calculate_growth_rate(
            curr_area=430.0,
            prev_area=400.0,
            curr_time_iso=t2.isoformat(),
            prev_time_iso=t1.isoformat(),
        )

        self.assertAlmostEqual(growth["growth_rate_per_day"], 15.0, delta=0.5)
        self.assertAlmostEqual(growth["growth_percent"], 7.5, delta=0.5)
        self.assertAlmostEqual(growth["delta_hours"], 48.0, delta=0.5)

    def test_evaluate_plant_health(self):
        phenotype = {"solidity": 0.85, "area_cm2": 420.0}
        color_healthy = {"green_ratio": 0.85, "yellow_ratio": 0.02, "brown_ratio": 0.01}
        growth_healthy = {"growth_percent": 3.5}

        # Caso 1: Planta saludable
        health_normal = evaluate_plant_health(phenotype, color_healthy, growth_healthy)
        self.assertEqual(health_normal["status"], "normal")
        self.assertGreater(health_normal["health_score"], 0.75)

        # Caso 2: Planta con severa necrosis
        color_necrotic = {"green_ratio": 0.40, "yellow_ratio": 0.10, "brown_ratio": 0.25}
        health_necrotic = evaluate_plant_health(phenotype, color_necrotic, {"growth_percent": -5.0})
        self.assertEqual(health_necrotic["status"], "anomalia")
        self.assertGreater(health_necrotic["anomaly_score"], 0.50)


if __name__ == "__main__":
    unittest.main()
