import base64
import cv2
import numpy as np
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from asl.detector import HandDetector
from asl.classifier import SignClassifier
from asl.buffer import SignBuffer

app = FastAPI()

# Allow your Next.js frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize your local ASL models
detector = HandDetector()
classifier = SignClassifier()
sessions = {} # Dictionary to store SignBuffers per session

@app.post("/asl/process-frame")
async def process_frame(request: Request):
    data = await request.json()
    session_id = data.get("session_id", "default")
    frame_b64 = data.get("frame").split(",")[1] # Remove data:image/jpeg;base64,
    
    # 1. Decode Image
    img_bytes = base64.b64decode(frame_b64)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 2. Get or Create Session Buffer
    if session_id not in sessions:
        sessions[session_id] = SignBuffer()
    buffer = sessions[session_id]

    # 3. Process
    features, _ = detector.extract(img)
    sign, confidence = "None", 0.0
    
    if features is not None:
        sign, confidence = classifier.predict(features)
        buffer.push(sign, confidence)

    return {
        "buffer": buffer.text,
        "last_sign": sign,
        "confidence": confidence
    }

@app.post("/asl/reset")
async def reset_buffer(session_id: str):
    if session_id in sessions:
        sessions[session_id].reset()
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)