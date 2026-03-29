import pickle
import numpy as np
from pathlib import Path

MODEL_PATH = Path(__file__).parent.parent / "model" / "asl_classifier.pkl"

# 26 letters + space + del + common interview words
FALLBACK_LABELS = (
    list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    + ["space", "del"]
    + ["hello", "yes", "no", "thank_you", "please",
       "name", "experience", "skills", "work", "learn", "help", "good"]
)


class SignClassifier:
    def __init__(self, model_path: str | None = None):
        path = Path(model_path) if model_path else MODEL_PATH
        if not path.exists():
            raise FileNotFoundError(
                f"No model found at {path}.\n"
                "Run `python train_classifier.py` first to train the classifier."
            )
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.model = data["model"]
        self.labels = data.get("labels", FALLBACK_LABELS)

    def predict(self, features: np.ndarray) -> tuple[str, float]:
        """Returns (label, confidence) for the given landmark features."""
        proba = self.model.predict_proba([features])[0]
        idx = int(np.argmax(proba))
        return self.labels[idx], float(proba[idx])
