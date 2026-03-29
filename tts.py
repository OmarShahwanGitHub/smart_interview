"""
tts.py — ElevenLabs text-to-speech helper

Env vars (in .env):
    ELEVEN_API              — required
    ELEVENLABS_VOICE_ID     — optional, defaults to Rachel
"""

import os
import requests

_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

# Rachel — works in English AND Spanish with the multilingual model
_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"


def speak(text: str, language: str = "english") -> bytes | None:
    api_key = os.getenv("ELEVEN_API")
    if not api_key:
        return None

    voice_id = os.getenv("ELEVENLABS_VOICE_ID", _DEFAULT_VOICE)

    # eleven_multilingual_v2 handles Spanish (and other languages) natively
    model_id = "eleven_multilingual_v2" if language.lower() == "spanish" else "eleven_turbo_v2"

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
