"""Pruebas unitarias para el motor de decisiones y reglas causa-raíz."""

import unittest
import tempfile
from pathlib import Path

from database.repository import VisionRepository
from decision.model import DecisionEngine
from decision.rules import evaluate_rules


class TestDecision(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_decision.db"
        self.repo = VisionRepository(self.db_path)
        self.engine = DecisionEngine(self.repo)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_rule_chlorosis_high_ph(self):
        # Planta con clorosis y pH alto (7.6)
        plant_obs = {
            "plant_id": "P03",
            "yellow_ratio": 0.22,
            "brown_ratio": 0.01,
            "growth_percent": -0.5,
            "status": "atencion",
            "health_score": 0.60,
        }
        sensor = {"ph": 7.6, "ec": 1.2, "temperature": 21.0}

        evals = evaluate_rules(plant_obs, sensor)
        self.assertEqual(len(evals), 1)
        self.assertEqual(evals[0].rule_id, "nutrient_chlorosis")
        self.assertEqual(evals[0].severity, "critical")
        self.assertIn("6.2", evals[0].suggested_action)

    def test_rule_necrosis_high_humidity(self):
        # Planta con necrosis y humedad alta
        plant_obs = {
            "plant_id": "P05",
            "yellow_ratio": 0.02,
            "brown_ratio": 0.15,
            "growth_percent": 0.0,
            "status": "anomalia",
            "health_score": 0.40,
        }
        sensor = {"humidity": 85.0}

        evals = evaluate_rules(plant_obs, sensor)
        self.assertEqual(len(evals), 1)
        self.assertEqual(evals[0].rule_id, "fungal_necrosis_risk")
        self.assertEqual(evals[0].severity, "critical")

    def test_decision_engine_analyze_plant(self):
        plant_obs = {
            "plant_id": "P01",
            "yellow_ratio": 0.20,
            "brown_ratio": 0.0,
            "growth_percent": -1.0,
            "status": "atencion",
            "health_score": 0.65,
        }
        sensor = {"ph": 7.5}

        result = self.engine.analyze_plant(plant_obs, sensor, persist_alerts=True)
        self.assertTrue(result.has_alert)
        self.assertEqual(len(result.recommended_actions), 1)

        alerts = self.repo.get_active_alerts("P01")
        self.assertEqual(len(alerts), 1)


if __name__ == "__main__":
    unittest.main()
