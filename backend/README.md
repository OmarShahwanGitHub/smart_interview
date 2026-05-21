# Smart Interview Backend

FastAPI backend that integrates RAG, resume screening, and TTS capabilities.

## Setup

1. **Install Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

2. **Environment Variables**

Make sure your root `.env` file contains:
```env
# Open-source LLM for question/follow-up generation
# Hugging Face router option:
LLM_PROVIDER=huggingface
LLM_API_BASE=https://router.huggingface.co/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct:fastest
LLM_API_KEY=your_huggingface_token

# Dedicated Hugging Face Inference Endpoint option:
# LLM_PROVIDER=huggingface
# LLM_API_BASE=https://your-endpoint.us-east-1.aws.endpoints.huggingface.cloud/v1
# LLM_MODEL=tgi
# LLM_API_KEY=your_huggingface_token

# Local Ollama option:
LLM_PROVIDER=ollama
LLM_API_BASE=http://localhost:11434
LLM_MODEL=qwen2.5:7b-instruct

# Hosted vLLM/TGI/llama.cpp OpenAI-compatible option:
# LLM_PROVIDER=openai-compatible
# LLM_API_BASE=https://your-llm-host.example.com/v1
# LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
# LLM_API_KEY=optional_if_your_server_requires_it

# ElevenLabs API (for text-to-speech)
ELEVEN_API=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional: Rachel voice

# Supabase (for frontend auth/storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# MongoDB Atlas for parsed resumes, interview sessions, turns, and recording metadata
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net
MONGODB_DB=smart_interview

# S3-compatible audio storage. Works with AWS S3, Cloudflare R2, MinIO, etc.
S3_BUCKET=smart-interview-recordings
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
# Optional for R2/MinIO:
# S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
# Optional public CDN/base URL:
# S3_PUBLIC_BASE_URL=https://cdn.example.com
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

For local LLM testing with Ollama:

```bash
ollama pull qwen2.5:7b-instruct
ollama serve
```

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
  "chunks": [{"section": "experience", "text": "..."}],
  "user_id": "user_123",
  "resume_id": "mongo_resume_id",
  "language": "english"
}
```

**Response:**
```json
{
  "status": "success",
  "session_id": "user_123"
}
```

### 5. Upload Interview Recording
**POST** `/interview/recording`

Stores audio in S3-compatible storage and metadata in MongoDB.

**Request:**
- Content-Type: `multipart/form-data`
- `file`: audio blob, usually `audio/webm`
- `session_id`: interview session id
- `kind`: `answer`, `question`, `followup_question`, or `full_session`
- Optional: `turn_id`, `user_id`, `resume_id`, `text`

**Response:**
```json
{
  "recording_id": "mongo_recording_metadata_id",
  "storage_key": "interviews/session_123/answer/...",
  "storage_url": "s3://bucket/interviews/session_123/answer/..."
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
│  ├─ /api/interview/rec ──→│  POST /interview/recording
│  └─ Interview page     ──→│  POST /tts
                             │
                             ├─ MongoDB Atlas
                             │  ├─ resumes
                             │  ├─ interview_sessions
                             │  ├─ interview_turns
                             │  └─ recordings_metadata
                             │
                             ├─ S3/R2
                             │  └─ answer/question audio blobs
                             │
                             ├─ rag/
                             │  ├─ parser.py (PDF parsing)
                             │  ├─ interviewer.py (open-source LLM)
                             │  └─ vectorstore.py (ChromaDB)
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
