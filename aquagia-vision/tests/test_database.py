"""Pruebas unitarias de base de datos SQLite y repositorio."""

import unittest
import tempfile
from pathlib import Path

from database.models import Plant, PlantObservation, SensorReading, PlantAlert
from database.repository import VisionRepository


class TestDatabase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_vision.db"
        self.repo = VisionRepository(self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_plant_upsert_and_get(self):
        plant = Plant(id="P01", species="Lactuca sativa", position="Slot 1")
        self.repo.upsert_plant(plant)

        fetched = self.repo.get_plant("P01")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.id, "P01")
        self.assertEqual(fetched.species, "Lactuca sativa")

        all_plants = self.repo.get_all_plants()
        self.assertEqual(len(all_plants), 1)

    def test_observation_history(self):
        # Crear planta
        self.repo.upsert_plant(Plant(id="P01"))

        # Insertar 2 observaciones sucesivas
        obs1 = PlantObservation(
            plant_id="P01",
            timestamp="2026-09-10T10:00:00Z",
            area=2000,
            area_cm2=30.0,
            growth_rate=0.0,
            growth_percent=0.0,
            health_score=0.9,
            status="normal",
        )
        self.repo.add_observation(obs1)

        obs2 = PlantObservation(
            plant_id="P01",
            timestamp="2026-09-11T10:00:00Z",
            area=2200,
            area_cm2=33.0,
            growth_rate=3.0,
            growth_percent=10.0,
            health_score=0.95,
            status="normal",
        )
        self.repo.add_observation(obs2)

        # Obtener última observación
        latest = self.repo.get_latest_observation("P01")
        self.assertIsNotNone(latest)
        self.assertEqual(latest.area_cm2, 33.0)

        # Obtener historial
        history = self.repo.get_plant_history("P01", limit=10)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].area_cm2, 30.0)
        self.assertEqual(history[1].area_cm2, 33.0)

    def test_sensor_and_alert(self):
        # Sensores
        sensor = SensorReading(ph=6.5, ec=1.8, temperature=22.0)
        self.repo.add_sensor_reading(sensor)

        latest_s = self.repo.get_latest_sensor_reading()
        self.assertIsNotNone(latest_s)
        self.assertAlmostEqual(latest_s.ph, 6.5)

        # Alertas
        alert = PlantAlert(
            plant_id="P01",
            severity="warning",
            rule_id="test_rule",
            message="Test message",
            suggested_action="Test action",
        )
        self.repo.add_alert(alert)

        active = self.repo.get_active_alerts("P01")
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].rule_id, "test_rule")


if __name__ == "__main__":
    unittest.main()
