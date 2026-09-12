"""Tracker de centroides para persistencia de identidad de plantas."""

from __future__ import annotations

from typing import Dict, List, Tuple
import numpy as np


class CentroidTracker:
    """Mantiene la identidad de plantas (P01, P02...) entre frames sucesivos.

    Diseñado para ser ultra-ligero: no requiere redes neuronales complejas ni Kalman Filter,
    utiliza distancia euclidiana entre centroides con ventana de persistencia.
    """

    def __init__(self, max_disappeared: int = 15, prefix: str = "P"):
        self.next_object_id = 1
        self.objects: Dict[str, Tuple[int, int]] = {}  # id -> centroid (cx, cy)
        self.disappeared: Dict[str, int] = {}
        self.max_disappeared = max_disappeared
        self.prefix = prefix

    def register(self, centroid: Tuple[int, int]) -> str:
        plant_id = f"{self.prefix}{self.next_object_id:02d}"
        self.objects[plant_id] = centroid
        self.disappeared[plant_id] = 0
        self.next_object_id += 1
        return plant_id

    def deregister(self, plant_id: str) -> None:
        if plant_id in self.objects:
            del self.objects[plant_id]
        if plant_id in self.disappeared:
            del self.disappeared[plant_id]

    def update(self, rects: List[Tuple[int, int, int, int]]) -> Dict[str, Tuple[int, int, int, int]]:
        """Actualiza el tracker con las nuevas cajas detectadas (x, y, w, h).

        Retorna:
            Dict[plant_id, (x, y, w, h)]
        """
        # Si no hay cajas detectadas en este frame
        if len(rects) == 0:
            for plant_id in list(self.disappeared.keys()):
                self.disappeared[plant_id] += 1
                if self.disappeared[plant_id] > self.max_disappeared:
                    self.deregister(plant_id)
            return {}

        # Calcular centroides de entrada
        input_centroids = np.zeros((len(rects), 2), dtype="int")
        for i, (x, y, w, h) in enumerate(rects):
            input_centroids[i] = (int(x + w / 2.0), int(y + h / 2.0))

        # Si actualmente no estamos rastreando ningún objeto, registrar todos
        if len(self.objects) == 0:
            matched_dict = {}
            for i in range(len(rects)):
                plant_id = self.register(tuple(input_centroids[i]))
                matched_dict[plant_id] = rects[i]
            return matched_dict

        # Emparejar centroides existentes con los nuevos mediante distancia euclidiana
        object_ids = list(self.objects.keys())
        object_centroids = list(self.objects.values())

        # Matriz de distancias
        D = np.linalg.norm(
            np.array(object_centroids)[:, np.newaxis] - input_centroids, axis=2
        )

        rows = D.min(axis=1).argsort()
        cols = D.argmin(axis=1)[rows]

        used_rows = set()
        used_cols = set()
        matched_dict = {}

        for row, col in zip(rows, cols):
            if row in used_rows or col in used_cols:
                continue

            # Umbral de distancia máxima razonable (ej. 150 px)
            if D[row, col] > 180:
                continue

            plant_id = object_ids[row]
            self.objects[plant_id] = tuple(input_centroids[col])
            self.disappeared[plant_id] = 0
            matched_dict[plant_id] = rects[col]

            used_rows.add(row)
            used_cols.add(col)

        unused_rows = set(range(0, D.shape[0])).difference(used_rows)
        unused_cols = set(range(0, D.shape[1])).difference(used_cols)

        # Para objetos existentes no detectados en este frame
        for row in unused_rows:
            plant_id = object_ids[row]
            self.disappeared[plant_id] += 1
            if self.disappeared[plant_id] > self.max_disappeared:
                self.deregister(plant_id)

        # Para nuevas detecciones
        for col in unused_cols:
            plant_id = self.register(tuple(input_centroids[col]))
            matched_dict[plant_id] = rects[col]

        return matched_dict
