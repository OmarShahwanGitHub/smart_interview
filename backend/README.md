# Smart Interview Backend

FastAPI backend that integrates RAG, ASL recognition, and TTS capabilities.

## Setup

1. **Install Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

2. **Environment Variables**

Make sure your root `.env` file contains:
```env
# Groq API (for RAG question generation)
RAG_API=your_groq_api_key

# ElevenLabs API (for text-to-speech)
ELEVEN_API=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional: Rachel voice

# Supabase (for frontend auth/storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. **Run the Backend**
```bash
cd backend
python main.py
```

Or use uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### 1. Parse Resume
**POST** `/parse-resume`

Upload a PDF resume and extract structured fields + text chunks.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (PDF file)

**Response:**
```json
{
  "fields": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "linkedin": "linkedin.com/in/johndoe",
    "github": "github.com/johndoe"
  },
  "chunks": [
    {"section": "experience", "text": "..."},
    {"section": "skills", "text": "..."}
  ]
}
```

### 2. Generate Questions
**POST** `/generate-questions`

Generate technical (RAG-based) and behavioral questions.

**Request:**
```json
{
  "chunks": [{"section": "experience", "text": "..."}],
  "language": "english"
}
```

**Response:**
```json
{
  "technical_questions": [
    "Tell me about your experience with...",
    "How did you approach..."
  ],
  "behavioral_questions": [
    {
      "id": "bq_001",
      "question": "Tell me about a time...",
      "category": "leadership",
      "difficulty": "intermediate",
      "star_method": true
    }
  ]
}
```

### 3. Process Interview Answer
**POST** `/interview/process`

Process candidate's answer and generate follow-up question with TTS audio.

**Request:**
```json
{
  "session_id": "user_123",
  "question": "Tell me about...",
  "answer": "I worked on...",
  "language": "english"
}
```

**Response:**
```json
{
  "followup_question": "That's interesting. Can you elaborate on...",
  "audio_base64": "base64_encoded_mp3_audio_string"
}
```

### 4. Initialize Interview Session
**POST** `/interview/init-session`

Initialize a session with resume chunks for context retrieval.

**Request:**
```json
{
  "session_id": "user_123",
  "chunks": [{"section": "experience", "text": "..."}]
}
```

**Response:**
```json
{
  "status": "success",
  "session_id": "user_123"
}
```

### 5. ASL Recognition WebSocket
**WS** `/asl/recognize`

Real-time ASL hand gesture recognition.

**Send (JSON):**
```json
{
  "frame": "base64_encoded_image"
}
```

**Receive (JSON):**
```json
{
  "letter": "A",
  "confidence": 0.95,
  "word": "HELLO",
  "buffer": "HELL",
  "annotated_frame": "base64_encoded_annotated_image"
}
```

## Health Check

**GET** `/` or `/health`

Returns API status and available endpoints.

## Architecture

```
frontend/                    backend/
├─ Next.js App              ├─ FastAPI
│  ├─ /api/parse-resume  ──→│  POST /parse-resume
│  ├─ /api/generate-qs   ──→│  POST /generate-questions
│  ├─ /api/interview     ──→│  POST /interview/process
│  └─ Interview page     ──→│  WS /asl/recognize
                             │
                             ├─ rag/
                             │  ├─ parser.py (PDF parsing)
                             │  ├─ interviewer.py (Groq LLM)
                             │  └─ vectorstore.py (ChromaDB)
                             │
                             ├─ asl/
                             │  ├─ detector.py (MediaPipe)
                             │  ├─ classifier.py (sklearn)
                             │  └─ buffer.py (letter buffering)
                             │
                             └─ tts.py (ElevenLabs)
```

## Testing

```bash
# Health check
curl http://localhost:8000/health

# Parse resume
curl -X POST http://localhost:8000/parse-resume \
  -F "file=@/path/to/resume.pdf"

# Generate questions
curl -X POST http://localhost:8000/generate-questions \
  -H "Content-Type: application/json" \
  -d '{"chunks":[{"section":"skills","text":"Python, FastAPI"}],"language":"english"}'
```
