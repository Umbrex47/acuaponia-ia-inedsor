"""Pruebas unitarias de detectores y tracker."""

import unittest
import numpy as np

from detection.detector import FixedRoiDetector
from detection.tracker import CentroidTracker


class TestDetector(unittest.TestCase):
    def test_fixed_roi_detector_grid(self):
        # Frame de prueba 1280x720
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        detector = FixedRoiDetector(rows=3, cols=3, prefix="P")

        regions = detector.detect(frame)
        self.assertEqual(len(regions), 9)

        ids = [r.plant_id for r in regions]
        expected_ids = [f"P{i:02d}" for i in range(1, 10)]
        self.assertEqual(ids, expected_ids)

        for r in regions:
            self.assertEqual(r.mode, "fixed")
            self.assertEqual(r.confidence, 1.0)
            self.assertEqual(len(r.crop.shape), 3)
            self.assertGreater(r.crop.shape[0], 50)
            self.assertGreater(r.crop.shape[1], 50)

    def test_centroid_tracker_persistence(self):
        tracker = CentroidTracker(max_disappeared=5, prefix="P")

        # Frame 1: Dos plantas detectadas
        boxes_f1 = [(100, 100, 50, 50), (300, 300, 60, 60)]
        tracked_f1 = tracker.update(boxes_f1)
        self.assertEqual(len(tracked_f1), 2)
        self.assertIn("P01", tracked_f1)
        self.assertIn("P02", tracked_f1)

        # Frame 2: Las plantas se desplazan ligeramente (5 px)
        boxes_f2 = [(105, 103, 50, 50), (302, 298, 60, 60)]
        tracked_f2 = tracker.update(boxes_f2)
        self.assertEqual(len(tracked_f2), 2)
        # Deben conservar los mismos IDs persistentes P01 y P02
        self.assertIn("P01", tracked_f2)
        self.assertIn("P02", tracked_f2)


if __name__ == "__main__":
    unittest.main()
