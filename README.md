<h1 align="center">
  <br>
  <img src="https://img.shields.io/badge/Smart-Interview-6366f1?style=for-the-badge&logoColor=white" alt="Smart Interview" width="300"/>
  <br>
  Smart Interview
  <br>
</h1>

<p align="center">
  <strong>AI-powered mock interview platform — personalized, multilingual, and fully accessible.</strong>
  <br />
  Supports English, Spanish, and Arabic voice interview practice.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/Open_Source_LLM-Qwen%2FLlama%2FMistral-f97316?style=flat-square" />
  <img src="https://img.shields.io/badge/ElevenLabs-TTS-8b5cf6?style=flat-square" />
  <img src="https://img.shields.io/badge/Supabase-Auth-3ecf8e?style=flat-square&logo=supabase" />
  <img src="https://img.shields.io/badge/ChromaDB-RAG-f59e0b?style=flat-square" />
</p>

---

## What It Does

Smart Interview reads your resume and conducts a real mock interview — asking personalized technical questions based on your actual projects, skills, and experience. After each answer, it generates a contextual follow-up using RAG. The experience is available in **English**, **Spanish**, or **Arabic**.

---

## System Architecture

```
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║                      FRONTEND  --  Next.js 15 + TypeScript                                 ║
║                                                                                            ║
║   Landing Page  -->  Login / Signup  -->  Setup (Resume + Language)  -->  Dashboard        ║
║                                                                                            ║
║        +──────────────────────+──────────────────────+──────────────────────+              ║
║        |   English Voice      |   Spanish Voice      |   Arabic Voice       |              ║
║        |   Web Speech API     |   Web Speech API     |   Web Speech API     |              ║
║        |   en-US              |   es-ES              |   ar-SA              |              ║
║        +─────────┬────────────+──────────┬───────────+──────────┬───────────+              ║
║                  |                       |                      |                          ║
╚══════════════════╪═══════════════════════╪══════════════════════╪══════════════════════════╝
                   |  transcript           |  transcript          |  transcript
                   v                       v                      v
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║                      BACKEND  --  FastAPI + Python 3.13                                    ║
║                                                                                            ║
║   POST /parse-resume         POST /generate-questions    POST /interview/process           ║
║   ───────────────────        ──────────────────────────  ─────────────────────────         ║
║   pdfplumber                 Self-hosted Qwen/Llama      RAG context retrieval             ║
║   Section-aware chunking     8 technical questions       Open-source LLM follow-ups        ║
║   Store in ChromaDB          5 behavioral questions      Speak via ElevenLabs TTS          ║
║                                                                                            ║
║   POST /screen-resume        POST /tts                                                     ║
║   ──────────────────────     ─────────────────                                             ║
║   4x RandomForest models     ElevenLabs API                                                ║
║   Category prediction        multilingual v2 (ES/AR)                                       ║
║   Job recommendation         turbo v2 (EN)                                                 ║
║   Skills + education                                                                       ║
╚═══════════════╤══════════════════════════╤══════════════════════╤══════════════════════════╝
                |                          |                      |
                v                          v                      v
╔══════════════════════╗    ╔══════════════════════════╗    ╔══════════════════════╗
║    RAG PIPELINE      ║    ║       SUPABASE           ║    ║     ELEVENLABS       ║
║                      ║    ║                          ║    ║                      ║
║  pdfplumber          ║    ║  PostgreSQL              ║    ║  Speaks questions    ║
║       |              ║    ║  User profiles           ║    ║  aloud in EN + ES    ║
║  MiniLM Embeddings   ║    ║  Language preferences    ║    ║                      ║
║       |              ║    ║                          ║    ║  multilingual v2     ║
║  ChromaDB Vectorstore║    ║  Auth (email/password)   ║    ║  for Spanish         ║
║       |              ║    ║  Session persistence     ║    ║                      ║
║  Qwen/Llama/Mistral  ║    ║                          ║    ║  turbo v2            ║
║                      ║    ║                          ║    ║  for English         ║
╚══════════════════════╝    ╚══════════════════════════╝    ╚══════════════════════╝
```

---

## Key Features

| Feature | Description |
|---|---|
| **Resume-Aware Questions** | Parses your PDF and generates 8 targeted technical questions from your actual experience |
| **RAG Follow-Ups** | Every answer gets a contextual follow-up pulled from your resume via ChromaDB |
| **English Voice** | Web Speech API input + ElevenLabs TTS output |
| **Spanish Voice** | Full end-to-end Spanish — questions translated, responses understood, follow-ups in Spanish |
| **Resume Screening** | 4 ML models predict resume category, recommend job roles, and extract skills/education |
| **Interviewer Personas** | Randomized interviewer styles (startup CTO, staff engineer, etc.) per session |
| **Auth + Persistence** | Supabase-backed authentication, profile storage, and language preferences |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | FastAPI, Python 3.13, Uvicorn |
| **LLM** | Self-hosted open-source model via Ollama by default, or vLLM/TGI/llama.cpp with an OpenAI-compatible endpoint |
| **RAG** | ChromaDB (in-memory), MiniLM embeddings, pdfplumber |
| **TTS** | ElevenLabs (`eleven_multilingual_v2` for Spanish, `eleven_turbo_v2` for English) |
| **Speech Input** | Web Speech API (`en-US` / `es-ES` / `ar-SA`) |
| **Auth & DB** | Supabase (PostgreSQL + Auth) |
| **3D / Visuals** | React Three Fiber, Three.js |

---

## Interview Flow

```
Upload Resume (PDF)
        │
        ▼
   Parse + Chunk ──► ChromaDB Vectorstore
        │
        ▼
  Select Language
  (English / Spanish / Arabic)
        │
        ▼
  Generate Questions
  (8 Technical + 5 Behavioral via open-source LLM)
        │
        ┌──────────────────────────┐
        │      Interview Loop      │
        │                          │
        │  Question spoken (TTS)   │
        │         │                │
        │  User answers            │
        │  (voice or typed text)    │
        │         │                │
        │  RAG retrieves context   │
        │         │                │
        │  Follow-up generated     │
        │         │                │
        │  Next question ◄─────────┘
        └──────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 20+
- Local or hosted open-source LLM server: Ollama, vLLM, TGI, llama.cpp server, or compatible
- API keys: ElevenLabs and Supabase

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Runs on http://localhost:8000
```

By default the backend expects Ollama at `http://localhost:11434` with `qwen2.5:7b-instruct`:

```bash
ollama pull qwen2.5:7b-instruct
ollama serve
```

For an online deployment, run a model server such as vLLM and point the backend at it:

```env
LLM_PROVIDER=openai-compatible
LLM_API_BASE=https://your-llm-host.example.com/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
LLM_API_KEY=optional_if_your_server_requires_it
```

Or use Hugging Face's OpenAI-compatible router:

```env
LLM_PROVIDER=huggingface
LLM_API_BASE=https://router.huggingface.co/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct:fastest
LLM_API_KEY=your_huggingface_token
```

For a dedicated Hugging Face Inference Endpoint, use the endpoint URL with `/v1`:

```env
LLM_PROVIDER=huggingface
LLM_API_BASE=https://your-endpoint.us-east-1.aws.endpoints.huggingface.cloud/v1
LLM_MODEL=tgi
LLM_API_KEY=your_huggingface_token
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Environment Variables

Create a `.env` in the project root:

```env
LLM_PROVIDER=huggingface
LLM_API_BASE=https://router.huggingface.co/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct:fastest
LLM_API_KEY=
ELEVENLABS_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
MONGODB_URI=
MONGODB_DB=smart_interview
S3_BUCKET=
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
# S3_ENDPOINT_URL=        # optional for R2/MinIO
# S3_PUBLIC_BASE_URL=     # optional CDN/base URL
```

MongoDB stores parsed resumes, interview sessions, turns, transcripts, and recording metadata.
S3-compatible storage stores the actual interview audio files.

## Project Structure

```
smart_interview/
├── backend/
│   ├── main.py              # FastAPI app — all endpoints
│   └── requirements.txt
├── frontend/
│   └── src/app/
│       ├── (auth)/          # Login + Signup
│       ├── (dashboard)/
│       │   ├── dashboard/   # Main hub
│       │   ├── setup/       # Resume upload + language selection
│       │   ├── interview/   # Live voice interview
│       │   └── screen/      # Resume screening results
│       └── page.tsx         # Landing page
├── rag/
│   ├── parser.py            # PDF extraction + section chunking
│   ├── vectorstore.py       # ChromaDB setup + querying
│   └── interviewer.py       # Open-source LLM calls
├── data/
│   └── behavioral_questions.json
└── models/                  # Trained resume screening models
```

---

<p align="center">Built for HackUSF 2026</p>
