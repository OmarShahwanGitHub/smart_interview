import os
import time
import threading
import cv2
import av
import streamlit as st
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
from elevenlabs.client import ElevenLabs

load_dotenv()

from asl.detector import HandDetector
from asl.classifier import SignClassifier
from asl.buffer import SignBuffer

try:
    from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, RTCConfiguration
except ImportError:
    st.error("Missing dependency: `pip install streamlit-webrtc`")
    st.stop()

# ── Config ────────────────────────────────────────────────────────────────────

AUDIO_CONTENT = {
    "English": {
        "greeting": (
            "Hi, good morning! Welcome, and thank you for coming in today. "
            "My name is Alex and I'll be your interviewer. "
            "We're really excited to have you here. "
            "This will be a conversation, so please take your time. "
            "Go ahead and introduce yourself whenever you're ready."
        ),
        "transition": (
            "That's great, really nice to meet you! "
            "Sounds like you've had some amazing experience. "
            "Alright, let's get started with the interview. "
            "I'm going to ask you a few technical questions — just be yourself and take your time."
        ),
        "greeting_audio":   Path("videos/greeting_en.mp3"),
        "transition_audio": Path("videos/transition_en.mp3"),
        "model":            "eleven_monolingual_v1",
        "voice_id":         "21m00Tcm4TlvDq8ikWAM",
        "whisper_lang":     "en",
    },
    "Spanish": {
        "greeting": (
            "¡Hola, buenos días! Bienvenido, y gracias por venir hoy. "
            "Mi nombre es Alex y seré tu entrevistador. "
            "Estamos muy emocionados de tenerte aquí. "
            "Esta será una conversación, así que tómate tu tiempo. "
            "Preséntate cuando estés listo."
        ),
        "transition": (
            "¡Qué bien, mucho gusto en conocerte! "
            "Parece que tienes una experiencia increíble. "
            "Muy bien, comencemos con la entrevista. "
            "Voy a hacerte algunas preguntas técnicas — sé tú mismo y tómate tu tiempo."
        ),
        "greeting_audio":   Path("videos/greeting_es.mp3"),
        "transition_audio": Path("videos/transition_es.mp3"),
        "model":            "eleven_multilingual_v2",
        "voice_id":         "21m00Tcm4TlvDq8ikWAM",
        "whisper_lang":     "es",
    },
}

RTC_CONFIG = RTCConfiguration(
    {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
)

# ── Clients ───────────────────────────────────────────────────────────────────

@st.cache_resource
def get_eleven_client():
    return ElevenLabs(api_key=os.getenv("ELEVEN_API"))

@st.cache_resource
def get_groq_client():
    return Groq(api_key=os.getenv("RAG_API"))


# ── ElevenLabs TTS ────────────────────────────────────────────────────────────

def generate_audio(text: str, output_path: Path, voice_id: str, model_id: str):
    if output_path.exists():
        return
    output_path.parent.mkdir(exist_ok=True)
    audio = get_eleven_client().text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=model_id,
    )
    with open(output_path, "wb") as f:
        for chunk in audio:
            f.write(chunk)


def play_audio(path: Path):
    with open(path, "rb") as f:
        st.audio(f.read(), format="audio/mp3", autoplay=True)


# ── Groq Whisper STT ──────────────────────────────────────────────────────────

def transcribe(audio_bytes: bytes, lang: str) -> str:
    result = get_groq_client().audio.transcriptions.create(
        file=("response.wav", audio_bytes),
        model="whisper-large-v3",
        language=lang,
    )
    return result.text.strip()


# ── ASL Video Processor ───────────────────────────────────────────────────────

class ASLProcessor(VideoProcessorBase):
    def __init__(self):
        self.detector   = HandDetector()
        self.classifier = SignClassifier()
        self.buffer     = SignBuffer()
        self._lock      = threading.Lock()

    @property
    def text(self) -> str:
        with self._lock:
            return self.buffer.text

    def reset(self):
        with self._lock:
            self.buffer.reset()

    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        img = frame.to_ndarray(format="bgr24")
        features, annotated = self.detector.extract(img)

        if features is not None:
            sign, confidence = self.classifier.predict(features)
            with self._lock:
                self.buffer.push(sign, confidence)
            color = (0, 255, 100) if confidence >= 0.6 else (0, 180, 255)
            cv2.putText(annotated, f"{sign}  {confidence:.0%}", (12, 44),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 2)

        with self._lock:
            display_text = self.buffer.text[-60:]
        cv2.rectangle(annotated, (0, annotated.shape[0] - 50),
                      (annotated.shape[1], annotated.shape[0]), (0, 0, 0), -1)
        cv2.putText(annotated, display_text, (10, annotated.shape[0] - 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

        return av.VideoFrame.from_ndarray(annotated, format="bgr24")


# ── Page ──────────────────────────────────────────────────────────────────────

st.set_page_config(page_title="Smart Interview", layout="centered")
st.title("Smart Interview")

# ── Session state ─────────────────────────────────────────────────────────────

for k, v in {
    "asl_state":      "intro_audio",
    "candidate_text": "",
    "audio_ready":    False,
    "language":       "English",
    "mode":           "Standard",
}.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Top controls ──────────────────────────────────────────────────────────────

col_mode, col_lang = st.columns(2)

mode = col_mode.radio("Mode", ["Standard", "ASL (Deaf / Mute)"], horizontal=True,
                      index=0 if st.session_state.mode == "Standard" else 1)

lang = col_lang.selectbox("Interviewer language", list(AUDIO_CONTENT.keys()),
                           index=list(AUDIO_CONTENT.keys()).index(st.session_state.language))

# Reset if mode or language changed
if mode != st.session_state.mode or lang != st.session_state.language:
    st.session_state.mode         = mode
    st.session_state.language     = lang
    st.session_state.audio_ready  = False
    st.session_state.asl_state    = "intro_audio"
    st.session_state.candidate_text = ""

content   = AUDIO_CONTENT[st.session_state.language]
is_asl    = st.session_state.mode == "ASL (Deaf / Mute)"

# ── Pre-generate audio ────────────────────────────────────────────────────────

if not st.session_state.audio_ready:
    with st.spinner(f"Preparing {lang} audio…"):
        generate_audio(content["greeting"],   content["greeting_audio"],
                       content["voice_id"],   content["model"])
        generate_audio(content["transition"], content["transition_audio"],
                       content["voice_id"],   content["model"])
    st.session_state.audio_ready = True

st.divider()

# ── State machine ─────────────────────────────────────────────────────────────

state = st.session_state.asl_state

# ── 1. Greeting ───────────────────────────────────────────────────────────────
if state == "intro_audio":
    st.subheader("Interviewer Greeting")
    play_audio(content["greeting_audio"])

    # Always show text — deaf users read it, hearing users have it as reference
    st.info(content["greeting"])

    st.divider()
    if st.button("I'm ready to respond →", type="primary"):
        st.session_state.asl_state = "live_response"
        st.rerun()

# ── 2. Response ───────────────────────────────────────────────────────────────
elif state == "live_response":

    if is_asl:
        # ── ASL mode: webcam signing ──────────────────────────────────────────
        st.subheader("Your Turn — Sign Your Response")
        st.caption("Sign into the camera. Use **space** to separate words, **del** to backspace.")

        ctx = webrtc_streamer(
            key="asl-live",
            video_processor_factory=ASLProcessor,
            rtc_configuration=RTC_CONFIG,
            media_stream_constraints={"video": True, "audio": False},
            async_processing=True,
        )

        text_box  = st.empty()
        col1, col2 = st.columns(2)
        clear_btn = col1.button("Clear text")
        done_btn  = col2.button("Done responding →", type="primary")

        if ctx.state.playing and ctx.video_processor:
            if clear_btn:
                ctx.video_processor.reset()
            while ctx.state.playing:
                current = ctx.video_processor.text
                text_box.markdown(f"**Detected:** {current or '_Start signing…_'}")
                time.sleep(0.15)

        if done_btn:
            if ctx.video_processor:
                st.session_state.candidate_text = ctx.video_processor.text
            st.session_state.asl_state = "transition_audio"
            st.rerun()

    else:
        # ── Standard mode: microphone ─────────────────────────────────────────
        st.subheader("Your Turn — Speak Your Response")
        st.caption("Record your response using the microphone below.")

        audio_input = st.audio_input("Record your response")

        if audio_input:
            with st.spinner("Transcribing…"):
                text = transcribe(audio_input.getvalue(), content["whisper_lang"])
            st.session_state.candidate_text = text
            st.success(f"You said: **{text}**")

            if st.button("Continue →", type="primary"):
                st.session_state.asl_state = "transition_audio"
                st.rerun()

# ── 3. Transition ─────────────────────────────────────────────────────────────
elif state == "transition_audio":
    st.subheader("Interviewer Response")
    if st.session_state.candidate_text:
        label = "You signed" if is_asl else "You said"
        st.info(f"{label}: **{st.session_state.candidate_text.strip()}**")

    play_audio(content["transition_audio"])
    st.info(content["transition"])  # show text for deaf users

    st.divider()
    if st.button("Continue to interview →", type="primary"):
        st.session_state.asl_state = "done"
        st.rerun()

# ── 4. Done ───────────────────────────────────────────────────────────────────
elif state == "done":
    st.success("Intro segment complete. Proceeding to the main interview.")
    st.write(f"Candidate intro captured: **{st.session_state.candidate_text.strip()}**")
    if st.button("Restart"):
        st.session_state.asl_state      = "intro_audio"
        st.session_state.candidate_text = ""
        st.rerun()
