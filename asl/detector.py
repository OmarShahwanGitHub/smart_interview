import time
import urllib.request
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
import numpy as np
from pathlib import Path

HAND_MODEL     = Path("model/hand_landmarker.task")
HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)

# Hand connections for manual drawing (same topology as old solutions API)
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (0, 17), (17, 18), (18, 19), (19, 20),
]


def _ensure_model():
    HAND_MODEL.parent.mkdir(exist_ok=True)
    if not HAND_MODEL.exists():
        print("Downloading hand landmark model (~18 MB)…")
        urllib.request.urlretrieve(HAND_MODEL_URL, HAND_MODEL)


class HandDetector:
    def __init__(self, max_hands: int = 1, detection_conf: float = 0.7, tracking_conf: float = 0.7):
        _ensure_model()
        base_options = mp_python.BaseOptions(model_asset_path=str(HAND_MODEL))
        options = mp_vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.VIDEO,
            num_hands=max_hands,
            min_hand_detection_confidence=detection_conf,
            min_hand_presence_confidence=detection_conf,
            min_tracking_confidence=tracking_conf,
        )
        self._detector = mp_vision.HandLandmarker.create_from_options(options)
        self._start_ms = int(time.time() * 1000)

    def extract(self, frame_bgr: np.ndarray) -> tuple[np.ndarray | None, np.ndarray]:
        """
        Returns (features, annotated_frame).
        features: shape (42,) normalized (x, y) offsets, or None if no hand found.
        """
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int(time.time() * 1000) - self._start_ms
        result = self._detector.detect_for_video(mp_image, timestamp_ms)

        annotated = frame_bgr.copy()

        if not result.hand_landmarks:
            return None, annotated

        lm = result.hand_landmarks[0]
        h, w = frame_bgr.shape[:2]

        # Draw connections
        for a, b in HAND_CONNECTIONS:
            x1, y1 = int(lm[a].x * w), int(lm[a].y * h)
            x2, y2 = int(lm[b].x * w), int(lm[b].y * h)
            cv2.line(annotated, (x1, y1), (x2, y2), (0, 200, 255), 2)

        # Draw landmarks
        for p in lm:
            cx, cy = int(p.x * w), int(p.y * h)
            cv2.circle(annotated, (cx, cy), 5, (255, 255, 255), -1)
            cv2.circle(annotated, (cx, cy), 5, (0, 150, 255), 1)

        # Build normalized feature vector
        xs = [p.x for p in lm]
        ys = [p.y for p in lm]
        min_x, min_y = min(xs), min(ys)

        features = []
        for p in lm:
            features.append(p.x - min_x)
            features.append(p.y - min_y)

        return np.array(features, dtype=np.float32), annotated

    def close(self):
        self._detector.close()
