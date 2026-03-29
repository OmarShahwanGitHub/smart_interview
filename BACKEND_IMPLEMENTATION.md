# Backend Implementation Guide

This guide explains exactly what each API route needs to do and how to implement it.

The frontend automatically reads `NEXT_PUBLIC_*` variables from this file.

---

## Backend Server Setup

### 1. Create FastAPI Server

**File**: `backend/main.py`

```python
from fastapi import FastAPI, File, UploadFile, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from root .env
load_dotenv(Path(__file__).parent.parent / ".env")

# Add parent directory to path to import rag/ and asl/ modules
sys.path.append(str(Path(__file__).parent.parent))

from rag.parser import parse_resume
from rag.interviewer import get_client, generate_questions, generate_followup
from rag.vectorstore import build_vectorstore, query
from asl.detector import HandDetector
from asl.classifier import SignClassifier
from asl.buffer import SignBuffer

app = FastAPI(title="Smart Interview Backend")

# Allow Next.js frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Smart Interview Backend API", "status": "running"}

# Your endpoints will go here (see below)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 2. Install Dependencies

```bash
pip install fastapi uvicorn websockets python-multipart supabase elevenlabs
```

---

## API Route 1: Parse Resume

### What the Frontend Sends

```http
POST http://localhost:8000/parse-resume
Content-Type: multipart/form-data

Body:
- file: (PDF file)
- user_id: "550e8400-e29b-41d4-a716-446655440000"
```

### What You Need to Return

```json
{
  "field": "Software Engineering",
  "parsed_data": {
    "sections": {
      "skills": "Python, JavaScript, React...",
      "experience": "Software Engineer at Google...",
      "education": "BS Computer Science, MIT..."
    },
    "chunks": [
      {"section": "skills", "text": "Python, JavaScript..."},
      {"section": "experience", "text": "Software Engineer..."}
    ]
  }
}
```

### Implementation

**Add to `backend/main.py`:**

```python
import tempfile
from supabase import create_client, Client

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)

class ParseResumeResponse(BaseModel):
    field: str
    parsed_data: dict

@app.post("/parse-resume", response_model=ParseResumeResponse)
async def parse_resume_endpoint(file: UploadFile = File(...)):
    """
    1. Save uploaded PDF temporarily
    2. Parse it using existing rag/parser.py
    3. Detect field using ML or keyword matching
    4. Return structured data
    """
    try:
        # Save PDF temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Parse resume using existing parser
        chunks = parse_resume(tmp_path)

        if not chunks:
            raise HTTPException(status_code=400, detail="Could not parse resume")

        # Detect field from resume content
        field = detect_field_from_chunks(chunks)

        # Structure parsed data
        sections = {}
        for chunk in chunks:
            section = chunk["section"]
            if section not in sections:
                sections[section] = []
            sections[section].append(chunk["text"])

        # Combine section texts
        structured_sections = {
            section: " ".join(texts)
            for section, texts in sections.items()
        }

        # Clean up temp file
        os.unlink(tmp_path)

        return {
            "field": field,
            "parsed_data": {
                "sections": structured_sections,
                "chunks": chunks
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def detect_field_from_chunks(chunks: list[dict]) -> str:
    """
    Detect candidate's field from resume chunks.

    Options:
    1. Use LLM (Groq) to analyze and categorize
    2. Use keyword matching
    3. Use a classifier model
    """
    # Option 1: Use Groq LLM (RECOMMENDED)
    from groq import Groq

    client = Groq(api_key=os.getenv("RAG_API"))

    # Combine all text
    full_text = " ".join([chunk["text"] for chunk in chunks])

    prompt = f"""Based on this resume, identify the candidate's primary field.
Choose ONE from: Software Engineering, Data Science, Product Management, UI/UX Design, DevOps Engineering, Backend Engineering, Frontend Engineering, Full-Stack Engineering, Machine Learning Engineering, Cloud Architecture, Cybersecurity, Mobile Development, Game Development, QA Engineering, Site Reliability Engineering.

Resume:
{full_text[:2000]}

Return ONLY the field name, nothing else."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=50,
    )

    field = response.choices[0].message.content.strip()
    return field


    # Option 2: Simple keyword matching (fallback)
    # all_text = " ".join([c["text"].lower() for c in chunks])
    #
    # field_keywords = {
    #     "Software Engineering": ["software engineer", "full stack", "backend", "frontend"],
    #     "Data Science": ["data scientist", "machine learning", "data analysis", "python"],
    #     "Product Management": ["product manager", "roadmap", "stakeholder", "agile"],
    #     "UI/UX Design": ["ui designer", "ux designer", "figma", "sketch"],
    #     "DevOps Engineering": ["devops", "kubernetes", "docker", "ci/cd"],
    # }
    #
    # scores = {}
    # for field, keywords in field_keywords.items():
    #     score = sum(keyword in all_text for keyword in keywords)
    #     scores[field] = score
    #
    # return max(scores, key=scores.get)
```

**What this does:**
1. Receives PDF from frontend
2. Uses your existing `rag/parser.py` to extract text and section
3. Uses Groq LLM to intelligently detect the candidate's field
4. Returns structured data back to frontend

---

## API Route 2: Generate Questions

### What the Frontend Sends

```http
POST http://localhost:8000/generate-questions
Content-Type: application/json

{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "field": "Software Engineering",
  "language": "english"
}
```

### What You Need to Return

```json
{
  "questions": [
    "Tell me about your experience with React at Company X.",
    "How did you approach the microservices architecture in Project Y?",
    "Describe a challenging bug you fixed recently.",
    "What's your experience with AWS and cloud deployment?",
    "Tell me about a time you faced a significant challenge at work.",
    "Describe a situation where you had to work with a difficult team member.",
    "Give me an example of a time you showed leadership.",
    "Tell me about a time you failed. What did you learn?"
  ]
}
```

### Implementation

**Add to `backend/main.py`:**

```python
import json
import random

class GenerateQuestionsRequest(BaseModel):
    user_id: str
    field: str
    language: str

class GenerateQuestionsResponse(BaseModel):
    questions: list[str]

@app.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions_endpoint(request: GenerateQuestionsRequest):
    """
    1. Get user's resume from Supabase
    2. Generate 4 technical questions using RAG
    3. Get 4 behavioral questions from database
    4. Combine and return
    """
    try:
        # 1. Get user's resume from Supabase
        resume_data = supabase.table("resumes") \
            .select("*") \
            .eq("user_id", request.user_id) \
            .order("upload_date", desc=True) \
            .limit(1) \
            .execute()

        if not resume_data.data:
            raise HTTPException(status_code=404, detail="No resume found for user")

        chunks = resume_data.data[0]["parsed_data"]["chunks"]

        # 2. Generate technical questions using existing RAG system
        groq_client = get_client()
        technical_questions = generate_questions(chunks, groq_client)

        # Take first 4 technical questions
        technical_questions = technical_questions[:4]

        # 3. Load behavioral questions
        behavioral_questions_path = Path(__file__).parent.parent / "data" / "behavioral_questions.json"
        with open(behavioral_questions_path, "r") as f:
            behavioral_data = json.load(f)

        # Randomly select 4 behavioral questions
        all_behavioral = [q["question"] for q in behavioral_data["questions"]]
        behavioral_questions = random.sample(all_behavioral, min(4, len(all_behavioral)))

        # 4. Combine questions
        all_questions = technical_questions + behavioral_questions

        return {"questions": all_questions}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**What this does:**
1. Fetches the user's resume from Supabase
2. Uses your existing `rag/interviewer.py` to generate personalized technical questions
3. Loads behavioral questions from `data/behavioral_questions.json`
4. Combines 4 technical + 4 behavioral = 8 total questions
5. Returns to frontend

---

## API Route 3: Process Interview & Generate Follow-ups

### What the Frontend Sends

```http
POST http://localhost:8000/interview/process
Content-Type: application/json

{
  "question": "Tell me about your experience with React.",
  "answer": "I've been working with React for 3 years at Google. I built a dashboard that serves 10k users...",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "language": "english"
}
```

### What You Need to Return

```json
{
  "followup_question": "That's impressive! Can you tell me more about how you optimized the dashboard for performance?",
  "audio_url": "https://karmrtgjvxlyesvlpahg.supabase.co/storage/v1/object/public/audio/abc123.mp3"
}
```

### Implementation

**Add to `backend/main.py`:**

```python
from elevenlabs.client import ElevenLabs
import uuid

# Initialize ElevenLabs client
eleven_client = ElevenLabs(api_key=os.getenv("ELEVEN_API"))

class InterviewRequest(BaseModel):
    question: str
    answer: str
    user_id: str
    language: str

class InterviewResponse(BaseModel):
    followup_question: str
    audio_url: str | None

@app.post("/interview/process", response_model=InterviewResponse)
async def process_interview(request: InterviewRequest):
    """
    1. Get user's resume context
    2. Generate follow-up question using RAG
    3. Convert follow-up to speech using ElevenLabs
    4. Upload audio to Supabase storage
    5. Return follow-up text + audio URL
    """
    try:
        # 1. Get resume context
        resume_data = supabase.table("resumes") \
            .select("parsed_data") \
            .eq("user_id", request.user_id) \
            .order("upload_date", desc=True) \
            .limit(1) \
            .execute()

        if not resume_data.data:
            raise HTTPException(status_code=404, detail="No resume found")

        chunks = resume_data.data[0]["parsed_data"]["chunks"]

        # 2. Generate follow-up question
        groq_client = get_client()

        # Query relevant resume context
        collection = build_vectorstore(chunks)
        context_chunks = query(collection, request.question + " " + request.answer)

        followup = generate_followup(
            request.question,
            request.answer,
            context_chunks,
            groq_client
        )

        # 3. Convert to speech (only if not ASL)
        audio_url = None
        if request.language != "asl":
            audio_url = await text_to_speech(followup, request.language, request.user_id)

        return {
            "followup_question": followup,
            "audio_url": audio_url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def text_to_speech(text: str, language: str, user_id: str) -> str:
    """
    Convert text to speech using ElevenLabs and upload to Supabase storage.
    """
    # Select voice and model based on language
    if language == "spanish":
        voice_id = "21m00Tcm4TlvDq8ikWAM"  # Replace with Spanish voice
        model_id = "eleven_multilingual_v2"
    else:  # english
        voice_id = "21m00Tcm4TlvDq8ikWAM"  # Replace with preferred voice
        model_id = "eleven_monolingual_v1"

    # Generate speech
    audio = eleven_client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=model_id,
    )

    # Collect audio bytes
    audio_bytes = b"".join(audio)

    # Upload to Supabase storage
    file_name = f"{user_id}/{uuid.uuid4()}.mp3"

    supabase.storage.from_("audio").upload(
        file_name,
        audio_bytes,
        {"content-type": "audio/mpeg"}
    )

    # Get public URL
    audio_url = supabase.storage.from_("audio").get_public_url(file_name)

    return audio_url
```

**What this does:**
1. Fetches user's resume for context
2. Uses your existing `rag/interviewer.py` to generate intelligent follow-up
3. Converts the follow-up text to speech using ElevenLabs
4. Uploads the audio file to Supabase storage
5. Returns both text and audio URL to frontend

**Note**: You'll need to create an `audio` storage bucket in Supabase (same way you created `resumes` bucket).

---

## API Route 4: ASL Recognition (WebSocket)

### What the Frontend Sends

- Opens WebSocket connection to `ws://localhost:8000/asl/recognize`
- Sends video frames as JPEG blobs every 100ms
- Each frame is a binary blob (image/jpeg)

### What You Need to Return

```json
{
  "text": "hello my name is john",
  "last_sign": "n",
  "confidence": 0.85
}
```

### Implementation

**Add to `backend/main.py`:**

```python
import cv2
import numpy as np

# Initialize ASL components globally
hand_detector = HandDetector()
sign_classifier = SignClassifier()

@app.websocket("/asl/recognize")
async def asl_recognize(websocket: WebSocket):
    """
    1. Accept WebSocket connection
    2. Receive video frames from frontend
    3. Detect hand landmarks
    4. Classify sign
    5. Send recognized text back
    """
    await websocket.accept()

    # Create a buffer for this connection
    buffer = SignBuffer()

    try:
        while True:
            # Receive frame from frontend
            frame_bytes = await websocket.receive_bytes()

            # Decode JPEG image
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            # Detect hand landmarks
            features, _ = hand_detector.extract(frame)

            # Default response
            response = {
                "text": buffer.text,
                "last_sign": "",
                "confidence": 0.0
            }

            # If hand detected, classify sign
            if features is not None:
                sign, confidence = sign_classifier.predict(features)

                # Add to buffer
                accepted = buffer.push(sign, confidence)

                response = {
                    "text": buffer.text,
                    "last_sign": sign,
                    "confidence": float(confidence)
                }

            # Send response back to frontend
            await websocket.send_json(response)

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()
```

**What this does:**
1. Accepts WebSocket connection from frontend
2. Receives video frames continuously
3. Uses your existing `asl/detector.py` to detect hand landmarks
4. Uses your existing `asl/classifier.py` to recognize signs
5. Uses your existing `asl/buffer.py` to build stable text output
6. Sends recognized text back to frontend in real-time

---

## Running Everything

### Terminal 1: Backend
```bash
# From project root
python backend/main.py

# Should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev

# Should see:
# ▲ Next.js 15.2.2
# - Local:        http://localhost:3000
```

### Terminal 3: Test
```bash
# Test backend is running
curl http://localhost:8000

# Should return:
# {"message":"Smart Interview Backend API","status":"running"}
```

---

## Testing Each Route

### Test 1: Parse Resume
```bash
curl -X POST http://localhost:8000/parse-resume \
  -F "file=@/path/to/resume.pdf"

# Expected response:
# {
#   "field": "Software Engineering",
#   "parsed_data": {...}
# }
```

### Test 2: Generate Questions
```bash
curl -X POST http://localhost:8000/generate-questions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "field": "Software Engineering",
    "language": "english"
  }'

# Expected response:
# {
#   "questions": ["Question 1", "Question 2", ...]
# }
```

### Test 3: Process Interview
```bash
curl -X POST http://localhost:8000/interview/process \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Tell me about your experience",
    "answer": "I worked at Google...",
    "user_id": "your-user-id",
    "language": "english"
  }'

# Expected response:
# {
#   "followup_question": "Can you tell me more...",
#   "audio_url": "https://..."
# }
```

---

## Supabase Storage Setup for Audio

You need to create an `audio` bucket in Supabase:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `audio`
4. **Make it Public** (so frontend can play audio)
5. Click "Create bucket"

### Set Storage Policies

```sql
-- Allow anyone to read audio files
CREATE POLICY "Anyone can read audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'audio');

-- Allow authenticated users to upload audio
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio');
```

---

## Complete File Structure

```
smart_interview/
├── .env                           # ✅ All environment variables here
├── backend/
│   └── main.py                    # ⚠️ CREATE THIS
├── rag/                           # ✅ Already exists
│   ├── parser.py
│   ├── interviewer.py
│   └── vectorstore.py
├── asl/                           # ✅ Already exists
│   ├── detector.py
│   ├── classifier.py
│   └── buffer.py
├── data/                          # ✅ Already exists
│   └── behavioral_questions.json
├── frontend/                      # ✅ Complete
│   ├── src/
│   │   ├── app/
│   │   │   └── api/               # Frontend API routes (proxy to backend)
│   │   ├── components/
│   │   └── lib/
│   └── package.json
└── model/                         # ⚠️ Missing - need ASL model
    └── asl_classifier.pkl         # Train with train_classifier.py
```

---

## Troubleshooting

### "Module not found" errors
```bash
# Make sure you're in the right directory
cd smart_interview
python backend/main.py
```

### "Invalid API key" for Groq/ElevenLabs
- Check `.env` has correct keys (no spaces, no quotes)
- Try: `cat .env` to verify

### CORS errors in browser
- Make sure backend allows `http://localhost:3000` in CORS
- Check browser console for specific error

### ASL model not found
```bash
# Train the classifier first
python train_classifier.py
# This creates model/asl_classifier.pkl
```

---

## Next Steps

1. **Create `backend/main.py`** - Copy the code from this guide
2. **Test each endpoint** - Use curl commands above
3. **Update frontend API routes** - Replace mock data with real backend calls
4. **Test full flow** - Signup → Upload → Interview
5. **Deploy** - When ready, deploy backend and frontend

Your teammates now have everything they need to implement the backend! 🚀
