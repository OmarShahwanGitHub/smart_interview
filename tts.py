"""
tts.py — ElevenLabs text-to-speech helper

Env vars (in .env):
    ELEVEN_API              — required
    ELEVENLABS_VOICE_ID     — optional, defaults to Rachel
"""

import os
import requests

_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

# Sarah — premade voice available on free ElevenLabs API plans
_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"
# Use a premade voice by default so free API plans do not hit library-voice limits.
_ARABIC_VOICE = os.getenv("ELEVENLABS_ARABIC_VOICE_ID", _DEFAULT_VOICE)

_MULTILINGUAL_LANGS = {"spanish", "arabic"}


def speak(text: str, language: str = "english") -> bytes | None:
    api_key = os.getenv("ELEVEN_API")
    if not api_key:
        return None

    lang = language.lower()
    if lang == "arabic":
        voice_id = _ARABIC_VOICE
    else:
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", _DEFAULT_VOICE)

    # eleven_multilingual_v2 handles Spanish, Arabic, and other non-English languages
    model_id = "eleven_multilingual_v2" if lang in _MULTILINGUAL_LANGS else "eleven_turbo_v2"

    try:
        response = requests.post(
            _URL.format(voice_id=voice_id),
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={
                "text": text.strip(),
                "model_id": model_id,
                "voice_settings": {
                    "stability": 0.55,
                    "similarity_boost": 0.75,
                    "style": 0.0,
                    "use_speaker_boost": True,
                },
            },
            timeout=15,
        )
        response.raise_for_status()
        return response.content
    except Exception as e:
        print(f"[tts] ElevenLabs error: {e}")
        return None
