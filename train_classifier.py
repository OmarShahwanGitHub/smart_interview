"""
Train the ASL sign classifier.

Steps:
  1. Download the ASL Alphabet dataset from Kaggle:
       https://www.kaggle.com/datasets/grassknoted/asl-alphabet
     Extract to:  data/asl_alphabet_train/
     Structure:   data/asl_alphabet_train/<LABEL>/<image>.jpg

  2. For common interview words (hello, yes, no, etc.) you can record your
     own images or source them from WLASL / other ASL datasets.

  3. Run:  python train_classifier.py

Output: model/asl_classifier.pkl
"""

import pickle
import urllib.request
from typing import Optional
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

DATA_DIR       = Path("data/asl_alphabet_train")
MODEL_DIR      = Path("model")
MODEL_OUT      = MODEL_DIR / "asl_classifier.pkl"
HAND_MODEL     = MODEL_DIR / "hand_landmarker.task"
HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)


def ensure_hand_model():
    """Download the MediaPipe hand landmark model if not present."""
    MODEL_DIR.mkdir(exist_ok=True)
    if not HAND_MODEL.exists():
        print("Downloading hand landmark model (~18 MB)…")
        urllib.request.urlretrieve(HAND_MODEL_URL, HAND_MODEL)
        print("Done.\n")


def create_detector():
    ensure_hand_model()
    base_options = mp_python.BaseOptions(model_asset_path=str(HAND_MODEL))
    options = mp_vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=mp_vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.3,
        min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    )
    return mp_vision.HandLandmarker.create_from_options(options)


def extract_landmarks(image_path: str, detector) -> Optional[np.ndarray]:
    img = cv2.imread(image_path)
    if img is None:
        return None

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect(mp_image)

    if not result.hand_landmarks:
        return None

    lm = result.hand_landmarks[0]
    xs = [p.x for p in lm]
    ys = [p.y for p in lm]
    min_x, min_y = min(xs), min(ys)

    features = []
    for p in lm:
        features.append(p.x - min_x)
        features.append(p.y - min_y)

    return np.array(features, dtype=np.float32)


def collect_data():
    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"Data directory not found: {DATA_DIR}\n"
            "Download ASL Alphabet dataset from Kaggle and extract to data/asl_alphabet_train/"
        )

    MAX_PER_CLASS = 500  # more than enough for RandomForest on 42 features

    label_dirs = sorted([d for d in DATA_DIR.iterdir() if d.is_dir()])
    print(f"Found {len(label_dirs)} classes (capped at {MAX_PER_CLASS} images each)\n")

    X, y = [], []
    detector = create_detector()

    for label_dir in label_dirs:
        label = label_dir.name
        images = list(label_dir.glob("*.jpg")) + list(label_dir.glob("*.png"))
        images = images[:MAX_PER_CLASS]  # cap before processing
        count = 0

        for img_path in images:
            features = extract_landmarks(str(img_path), detector)
            if features is not None:
                X.append(features)
                y.append(label)
                count += 1

        print(f"  {label}: {count} / {len(images)} samples")

    detector.close()

    if not X:
        raise RuntimeError(
            "No hand landmarks extracted from any image. "
            "Check that DATA_DIR points to the right folder and images contain visible hands."
        )

    detected_labels = sorted(set(y))
    return np.array(X), np.array(y), detected_labels


def train(X, y):
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=True, stratify=y, random_state=42
        )
    except ValueError:
        print("Warning: some classes have too few samples for stratified split, using random split.")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=True, random_state=42
        )

    print(f"\nTraining on {len(X_train)} samples, testing on {len(X_test)}…")

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        n_jobs=-1,
        random_state=42,
    )
    clf.fit(X_train, y_train)

    preds    = clf.predict(X_test)
    accuracy = accuracy_score(y_test, preds)
    print(f"Test accuracy: {accuracy:.2%}")

    return clf


def main():
    MODEL_DIR.mkdir(exist_ok=True)

    print("Collecting landmark features from images…")
    X, y, labels = collect_data()

    clf = train(X, y)

    with open(MODEL_OUT, "wb") as f:
        pickle.dump({"model": clf, "labels": labels}, f)

    print(f"\nModel saved to {MODEL_OUT}")


if __name__ == "__main__":
    main()
