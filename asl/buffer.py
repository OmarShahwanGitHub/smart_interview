import time
from collections import Counter

CONFIRM_FRAMES = 18   # consecutive frames a sign must dominate before it's accepted
AGREEMENT = 0.75      # fraction of recent frames that must agree
MIN_CONFIDENCE = 0.60  # classifier confidence threshold
SIGN_COOLDOWN = 0.9   # seconds between accepted signs


class SignBuffer:
    """
    Accumulates per-frame sign predictions into a stable text string.

    A sign is accepted when it dominates CONFIRM_FRAMES recent frames
    with >= AGREEMENT fraction and the classifier confidence >= MIN_CONFIDENCE.
    """

    def __init__(self):
        self._recent: list[str] = []
        self.text: str = ""
        self._last_accepted: float = 0.0
        self.last_sign: str = ""

    def push(self, sign: str, confidence: float) -> bool:
        """Push a prediction. Returns True if a new sign was accepted."""
        if confidence < MIN_CONFIDENCE:
            self._recent.clear()
            return False

        self._recent.append(sign)
        if len(self._recent) > CONFIRM_FRAMES:
            self._recent.pop(0)

        if len(self._recent) < CONFIRM_FRAMES:
            return False

        dominant, count = Counter(self._recent).most_common(1)[0]
        if count / CONFIRM_FRAMES < AGREEMENT:
            return False

        now = time.time()
        if now - self._last_accepted < SIGN_COOLDOWN:
            return False

        self._accept(dominant)
        self._last_accepted = now
        self._recent.clear()
        self.last_sign = dominant
        return True

    def _accept(self, sign: str):
        if sign == "del":
            self.text = self.text[:-1]
        elif sign == "space":
            if self.text and not self.text.endswith(" "):
                self.text += " "
        elif len(sign) == 1:
            # Single letter — append directly
            self.text += sign.lower()
        else:
            # Full word (from fixed vocab)
            self.text = self.text.rstrip() + " " + sign.replace("_", " ") + " "

    def reset(self):
        self._recent.clear()
        self.text = ""
        self._last_accepted = 0.0
        self.last_sign = ""
