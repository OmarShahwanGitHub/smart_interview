# Smart Interview - Full Stack Integration Guide

This guide explains how the Next.js frontend connects to the FastAPI backend.

## Current Status

### ✅ Frontend Complete
- Full authentication system (login/signup)
- Resume upload and user configuration
- Dashboard with interview launcher
- Interview session page with camera/mic permissions
- API route structure ready for integration

### 🔄 Backend Integration Needed

Your teammates need to connect:
1. **RAG System** - Resume parsing and technical question generation
2. **ElevenLabs API** - Text-to-speech for questions
3. **Behavioral Questions** - Loading from `data/behavioral_questions.json`
4. **ASL Recognition** - Real-time sign language detection

## Integration Points

### 1. Resume Parsing API

**File**: `frontend/src/app/api/parse-resume/route.ts`

**What it needs:**
```typescript
// Replace the mock with:
const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL;
const backendFormData = new FormData();
backendFormData.append('file', file);

const response = await fetch(`${pythonApiUrl}/parse-resume`, {
  method: 'POST',
  body: backendFormData,
});

const { field, parsed_data } = await response.json();
```

**Expected Python endpoint:**
```
POST /parse-resume
Content-Type: multipart/form-data

Body:
- file: PDF file

Response:
{
  "field": "Software Engineering",
  "parsed_data": {
    "sections": ["skills", "experience", "education"],
    "chunks": [...]
  }
}
```

**Python implementation needed:**
- Use existing `rag/parser.py`
- Extract text and detect sections
- Use ML/RAG to detect field from resume content
- Return structured data

---

### 2. Question Generation API

**File**: `frontend/src/app/api/generate-questions/route.ts`

**What it needs:**
```typescript
const response = await fetch(`${pythonApiUrl}/generate-questions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    field: field,
    language: language
  }),
});

const { questions } = await response.json();
```

**Expected Python endpoint:**
```
POST /generate-questions
Content-Type: application/json

Body:
{
  "user_id": "uuid",
  "field": "Software Engineering",
  "language": "english"
}

Response:
{
  "questions": [
    "Technical question 1...",
    "Technical question 2...",
    "Behavioral question 1...",
    ...
  ]
}
```

**Python implementation needed:**
- Load user's resume from Supabase using `user_id`
- Use existing `rag/interviewer.py` to generate technical questions
- Load behavioral questions from `data/behavioral_questions.json`
- Mix and return 8 questions total (e.g., 4 technical + 4 behavioral)

---

### 3. Interview Processing API

**File**: `frontend/src/app/api/interview/route.ts`

**What it needs:**
```typescript
const response = await fetch(`${pythonApiUrl}/interview/process`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: question,
    answer: answer,
    user_id: userId,
    language: language
  }),
});

const { followup_question, audio_url } = await response.json();
```

**Expected Python endpoint:**
```
POST /interview/process
Content-Type: application/json

Body:
{
  "question": "Tell me about your experience...",
  "answer": "I worked on...",
  "user_id": "uuid",
  "language": "english"
}

Response:
{
  "followup_question": "Can you tell me more about...",
  "audio_url": "https://..."  // ElevenLabs generated audio
}
```

**Python implementation needed:**
- Use existing `rag/interviewer.py` `generate_followup()` function
- Call ElevenLabs API to convert follow-up text to speech
- Return both text and audio URL
- Store session data in Supabase `interview_sessions` table

---

## ElevenLabs Integration

### Text-to-Speech for Questions

Your teammates have ElevenLabs API access. Integrate it in the Python backend:

```python
from elevenlabs.client import ElevenLabs
import os

client = ElevenLabs(api_key=os.getenv("ELEVEN_API"))

def generate_speech(text: str, language: str):
    voice_id = "21m00Tcm4TlvDq8ikWAM"  # Or choose based on language
    model_id = "eleven_monolingual_v1" if language == "english" else "eleven_multilingual_v2"

    audio = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=model_id,
    )

    # Save to temp file or upload to Supabase storage
    # Return URL
    return audio_url
```

**Where to call it:**
- When generating questions (`/generate-questions` endpoint)
- When generating follow-ups (`/interview/process` endpoint)

---

## ASL Recognition Integration

### Real-Time Sign Recognition

The frontend captures video from the user's camera. Your teammates need to:

1. **Create WebSocket endpoint** in Python backend
2. **Stream video frames** from frontend to backend
3. **Use existing ASL classifier** (`asl/classifier.py`)
4. **Return recognized text** in real-time

**Frontend changes needed** (in `frontend/src/app/(dashboard)/interview/page.tsx`):

```typescript
// Add WebSocket connection
const ws = new WebSocket('ws://localhost:8000/asl/recognize');

// Capture frames from video
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const captureFrame = () => {
  if (videoRef.current) {
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx?.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      ws.send(blob); // Send frame to backend
    }, 'image/jpeg', 0.8);
  }
};

// Capture at 10 FPS
setInterval(captureFrame, 100);

// Receive recognized text
ws.onmessage = (event) => {
  const { text } = JSON.parse(event.data);
  setRecognizedText(text);
};
```

**Python WebSocket endpoint needed:**
```python
from fastapi import FastAPI, WebSocket
from asl.detector import HandDetector
from asl.classifier import SignClassifier
from asl.buffer import SignBuffer
import cv2
import numpy as np

app = FastAPI()
detector = HandDetector()
classifier = SignClassifier()
buffer = SignBuffer()

@app.websocket("/asl/recognize")
async def recognize_asl(websocket: WebSocket):
    await websocket.accept()

    while True:
        # Receive frame
        frame_bytes = await websocket.receive_bytes()

        # Decode image
        nparr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Detect and classify
        features, _ = detector.extract(img)
        if features is not None:
            sign, confidence = classifier.predict(features)
            buffer.push(sign, confidence)

        # Send recognized text
        await websocket.send_json({
            "text": buffer.text
        })
```

---

## Python Backend Setup

### Create FastAPI Server

**File**: Create `backend/main.py`

```python
from fastapi import FastAPI, File, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow Next.js frontend to call APIs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    # Use rag/parser.py
    pass

@app.post("/generate-questions")
async def generate_questions(data: dict):
    # Use rag/interviewer.py + data/behavioral_questions.json
    pass

@app.post("/interview/process")
async def process_interview(data: dict):
    # Use rag/interviewer.py + ElevenLabs
    pass

@app.websocket("/asl/recognize")
async def asl_recognize(websocket: WebSocket):
    # Use asl/detector.py + asl/classifier.py
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Install Python Dependencies

```bash
pip install fastapi uvicorn websockets python-multipart
```

### Run Backend

```bash
python backend/main.py
```

---

## Environment Variables

**All environment variables are in the root `.env` file** (already configured):

```env
RAG_API=your_groq_api_key
ELEVEN_API=your_elevenlabs_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Both frontend and backend read from this single file.

---

## Testing the Full Stack

### 1. Start Backend
```bash
cd backend
python main.py
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Test Flow
1. Go to http://localhost:3000
2. Sign up with email/password
3. Upload a resume (PDF)
4. See detected field
5. Start interview
6. Grant camera/mic permission
7. See questions rendered
8. Speak/sign responses
9. Get follow-ups

---

## Supabase Access from Python

Your Python backend needs to read/write to Supabase:

```python
from supabase import create_client, Client
import os

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")  # Use service_role key for backend
)

# Example: Get user's resume
resume = supabase.table("resumes") \
    .select("*") \
    .eq("user_id", user_id) \
    .single() \
    .execute()

# Example: Store interview session
supabase.table("interview_sessions").insert({
    "user_id": user_id,
    "questions": questions,
    "answers": answers,
    "feedback": feedback
}).execute()
```

---

## Quick Start Checklist

- [ ] Set up Supabase (follow `SUPABASE_SETUP.md`)
- [ ] Create `.env.local` in `frontend/` with Supabase keys
- [ ] Run `npm install` and `npm run dev` in `frontend/`
- [ ] Create `backend/main.py` with FastAPI
- [ ] Create `.env` in root with API keys
- [ ] Implement `/parse-resume` endpoint using existing `rag/parser.py`
- [ ] Implement `/generate-questions` using `rag/interviewer.py`
- [ ] Implement `/interview/process` with ElevenLabs integration
- [ ] Implement `/asl/recognize` WebSocket with ASL classifier
- [ ] Test end-to-end flow

---

## Questions?

- **Frontend issues**: Check `frontend/README.md`
- **Supabase setup**: See `SUPABASE_SETUP.md`
- **Backend structure**: This file (integration points above)

The frontend is production-ready and waiting for your backend APIs!
