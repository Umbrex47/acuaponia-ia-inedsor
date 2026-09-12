"""Pruebas de integración del pipeline completo de AquaGia Vision."""

import unittest
import tempfile
from pathlib import Path
import numpy as np

from camera.capture import CameraCapture
from config import load_config
from pipeline import AquaGiaVisionPipeline


class TestPipeline(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_pipe.db"

        self.cfg = load_config()
        self.cfg["database"]["db_path"] = str(self.db_path)
        self.cfg["system"]["mode"] = "fixed"

        self.pipeline = AquaGiaVisionPipeline(self.cfg)
        self.cam = CameraCapture(source="synthetic")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_pipeline_full_cycle(self):
        frame = self.cam.get_frame()
        self.assertIsNotNone(frame)
        self.assertEqual(frame.shape[:2], (720, 1280))

        # 1. Primera pasada de análisis
        result1 = self.pipeline.analyze(frame, persist=True)

        self.assertIn("summary", result1)
        self.assertIn("plants", result1)
        plants1 = result1["plants"]

        self.assertEqual(len(plants1), 9)
        p01 = plants1[0]
        self.assertEqual(p01["plant_id"], "P01")
        self.assertGreater(p01["area_cm2"], 5.0)
        self.assertGreater(p01["green_coverage_pct"], 50)
        self.assertGreaterEqual(p01["leaf_count"], 1)
        self.assertIn("status", p01)

        # 2. Segunda pasada con leve crecimiento
        result2 = self.pipeline.analyze(frame, persist=True)
        plants2 = result2["plants"]
        self.assertEqual(len(plants2), 9)

        # Verificar anotaciones
        annotated = self.pipeline.get_last_annotated_frame()
        self.assertIsNotNone(annotated)
        self.assertEqual(annotated.shape, frame.shape)

        # Verificar ficha formateada en texto (Section 1 del requerimiento)
        card_text = self.pipeline.history_mgr.format_text_tree("P01")
        self.assertIn("PLANTA P01", card_text)
        self.assertIn("Área vegetal:", card_text)
        self.assertIn("Cobertura verde:", card_text)
        self.assertIn("Crecimiento:", card_text)
        self.assertIn("Número de hojas:", card_text)
        self.assertIn("Última actualización:", card_text)


if __name__ == "__main__":
    unittest.main()
