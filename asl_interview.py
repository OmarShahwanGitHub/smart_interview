import streamlit as st
import cv2
import av
import threading
import time
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, RTCConfiguration
from asl.detector import HandDetector
from asl.classifier import SignClassifier
from asl.buffer import SignBuffer

# --- Page Setup ---
st.set_page_config(layout="wide")
st.markdown("""
    <style>
    #MainMenu, footer, header {visibility: hidden;}
    .stApp { background-color: #0f172a; color: white; }
    .q-box { background: #1e293b; padding: 20px; border-radius: 15px; border-left: 5px solid #2563eb; margin-bottom: 20px; }
    </style>
""", unsafe_allow_html=True)

# Get Question from Next.js URL
question = st.query_params.get("question", "Ready for your answer...")

st.markdown(f'<div class="q-box"><b>Interviewer:</b><br><i>"{question}"</i></div>', unsafe_allow_html=True)

class ASLProcessor(VideoProcessorBase):
    def __init__(self):
        self.detector = HandDetector()
        self.classifier = SignClassifier()
        self.buffer = SignBuffer()
        self._lock = threading.Lock()

    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        img = frame.to_ndarray(format="bgr24")
        features, annotated = self.detector.extract(img)
        if features is not None:
            sign, confidence = self.classifier.predict(features)
            with self._lock: self.buffer.push(sign, confidence)
            cv2.putText(annotated, f"{sign} {confidence:.0%}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        # Display text at bottom
        with self._lock: txt = self.buffer.text[-50:]
        cv2.putText(annotated, txt, (10, annotated.shape[0]-20), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
        return av.VideoFrame.from_ndarray(annotated, format="bgr24")

ctx = webrtc_streamer(
    key="asl", 
    video_processor_factory=ASLProcessor,
    rtc_configuration=RTCConfiguration({"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}),
    media_stream_constraints={"video": True, "audio": False}
)

if ctx.video_processor:
    st.info(f"**Detected Text:** {ctx.video_processor.buffer.text}")
    if st.button("Clear Text"): ctx.video_processor.buffer.reset()