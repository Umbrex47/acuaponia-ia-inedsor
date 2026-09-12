"""Pruebas de la API REST FastAPI de AquaGia Vision."""

import unittest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient

from api.server import create_app
from config import load_config


class TestApiServer(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_api.db"

        cfg = load_config()
        cfg["camera"]["source"] = "synthetic"
        cfg["database"]["db_path"] = str(self.db_path)
        # Crear app sin arrancar hilo de cámara en fondo para pruebas
        self.app = create_app(cfg, start_camera=False)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_status_endpoint(self):
        response = self.client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")
        self.assertIn("mode", data)

    def test_plants_endpoints(self):
        # 1. Forzar una captura
        cap_res = self.client.post("/api/capture")
        self.assertEqual(cap_res.status_code, 200)

        # 2. Listar todas las plantas
        plants_res = self.client.get("/api/plants")
        self.assertEqual(plants_res.status_code, 200)
        data = plants_res.json()
        self.assertEqual(len(data["plants"]), 9)

        # 3. Detalle de planta P01
        p01_res = self.client.get("/api/plants/P01")
        self.assertEqual(p01_res.status_code, 200)
        p01_data = p01_res.json()
        self.assertEqual(p01_data["plant_id"], "P01")
        self.assertGreater(p01_data["area_cm2"], 0)

        # 4. Ficha de texto de P01
        card_res = self.client.get("/api/plants/P01/card")
        self.assertEqual(card_res.status_code, 200)
        self.assertIn("PLANTA P01", card_res.text)

        # 5. Historial de P01
        hist_res = self.client.get("/api/plants/P01/history")
        self.assertEqual(hist_res.status_code, 200)
        self.assertGreaterEqual(len(hist_res.json()["history"]), 1)

    def test_annotated_frame_endpoint(self):
        self.client.post("/api/capture")
        frame_res = self.client.get("/api/frame/annotated")
        self.assertEqual(frame_res.status_code, 200)
        self.assertEqual(frame_res.headers["content-type"], "image/jpeg")
        self.assertGreater(len(frame_res.content), 1000)

    def test_sensors_and_decision(self):
        sensor_data = {
            "ph": 7.8,
            "ec": 0.6,
            "temperature": 23.5,
            "temperature_air": 25.0,
            "humidity": 65.0,
        }
        res = self.client.post("/api/sensors", json=sensor_data)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")


if __name__ == "__main__":
    unittest.main()
