"""Pruebas unitarias de segmentación y OpenCV."""

import unittest
import numpy as np
import cv2

from segmentation.opencv import (
    compute_exg,
    segment_vegetation,
    detect_frame_change,
    crop_roi,
)
from segmentation.plantcv import extract_phenotype_features


class TestSegmentation(unittest.TestCase):
    def setUp(self):
        # Crear un parche de 200x200 con fondo gris y una planta verde en el centro
        self.image = np.full((200, 200, 3), (60, 60, 60), dtype=np.uint8)
        # Planta verde (BGR: B=30, G=200, R=40)
        cv2.circle(self.image, (100, 100), 40, (30, 200, 40), -1)

    def test_compute_exg(self):
        exg = compute_exg(self.image)
        self.assertEqual(exg.shape, (200, 200))
        # En el centro (planta verde), 2G - R - B = 2*200 - 40 - 30 = 330 > 0
        self.assertGreater(exg[100, 100], 100)
        # En el fondo gris, 2*60 - 60 - 60 = 0
        self.assertAlmostEqual(exg[10, 10], 0, delta=5)

    def test_segment_vegetation(self):
        mask, contours = segment_vegetation(self.image, min_area_px=100)
        self.assertEqual(mask.shape, (200, 200))
        self.assertGreater(len(contours), 0)
        # El centro debe estar segmentado como planta (255)
        self.assertEqual(mask[100, 100], 255)
        # La esquina debe ser fondo (0)
        self.assertEqual(mask[10, 10], 0)

    def test_detect_frame_change(self):
        img2 = self.image.copy()
        changed, pct = detect_frame_change(self.image, img2, threshold_pct=3.0)
        self.assertFalse(changed)
        self.assertEqual(pct, 0.0)

        # Modificar una región grande
        cv2.rectangle(img2, (0, 0), (100, 100), (255, 255, 255), -1)
        changed, pct = detect_frame_change(self.image, img2, threshold_pct=3.0)
        self.assertTrue(changed)
        self.assertGreater(pct, 5.0)

    def test_crop_roi(self):
        # Recortar cuarto central [0.25, 0.25, 0.5, 0.5]
        crop = crop_roi(self.image, (0.25, 0.25, 0.5, 0.5), normalized=True)
        self.assertEqual(crop.shape[:2], (100, 100))

    def test_extract_phenotype_features(self):
        mask, _ = segment_vegetation(self.image, min_area_px=100)
        features = extract_phenotype_features(self.image, mask, px_to_cm2=0.01)
        self.assertGreater(features["area_px"], 2000)
        self.assertGreater(features["area_cm2"], 20.0)
        self.assertGreater(features["solidity"], 0.8)
        self.assertAlmostEqual(features["centroid"][0], 100, delta=5)
        self.assertAlmostEqual(features["centroid"][1], 100, delta=5)


if __name__ == "__main__":
    unittest.main()
