import time
from collections import Counter

CONFIRM_FRAMES = 8    # shorter confirmation window for real-time signing
AGREEMENT = 0.6       # allow some frame noise while keeping stability
MIN_CONFIDENCE = 0.45 # classifier confidence threshold
SIGN_COOLDOWN = 0.35  # seconds between accepted signs


class SignBuffer:
    """
    Accumulates per-frame sign predictions into a stable text string.

    A sign is accepted when it dominates recent frames with enough agreement and
    confidence. The buffer is intentionally tolerant of a few noisy frames so the
    webcam flow still feels responsive.
    """

    def __init__(self):
        self._recent: list[str] = []
        self.text: str = ""
        self._last_accepted: float = 0.0
        self.last_sign: str = ""

    def push(self, sign: str | None, confidence: float) -> bool:
        """Push a prediction. Returns True if a new sign was accepted."""
        if not sign:
            self._decay_recent()
            return False

        if confidence < MIN_CONFIDENCE:
            self._decay_recent()
            return False

        self._recent.append(sign)
        if len(self._recent) > CONFIRM_FRAMES:
            self._recent.pop(0)

        if len(self._recent) < CONFIRM_FRAMES:
            return False

        dominant, count = Counter(self._recent).most_common(1)[0]
        if count / len(self._recent) < AGREEMENT:
            return False

        now = time.time()
        if now - self._last_accepted < SIGN_COOLDOWN and dominant == self.last_sign:
            return False

        self._accept(dominant)
        self._last_accepted = now
        self._recent.clear()
        self.last_sign = dominant
        return True

    def _decay_recent(self):
        if self._recent:
            self._recent.pop(0)

    def _accept(self, sign: str):
        if sign == "del":
            self.text = self.text[:-1]
        elif sign == "space":
            if self.text and not self.text.endswith(" "):
                self.text += " "
        elif len(sign) == 1:
            self.text += sign.lower()
        else:
            self.text = self.text.rstrip() + " " + sign.replace("_", " ") + " "

    def reset(self):
        self._recent.clear()
        self.text = ""
        self._last_accepted = 0.0
        self.last_sign = ""
