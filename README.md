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
  Supports English voice, Spanish voice, and American Sign Language.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/Groq-LLaMA_3.3_70B-f97316?style=flat-square" />
  <img src="https://img.shields.io/badge/ElevenLabs-TTS-8b5cf6?style=flat-square" />
  <img src="https://img.shields.io/badge/MediaPipe-ASL-34d399?style=flat-square" />
  <img src="https://img.shields.io/badge/Supabase-Auth-3ecf8e?style=flat-square&logo=supabase" />
  <img src="https://img.shields.io/badge/ChromaDB-RAG-f59e0b?style=flat-square" />
</p>

---

## What It Does

Smart Interview reads your resume and conducts a real mock interview — asking personalized technical questions based on your actual projects, skills, and experience. After each answer, it generates a contextual follow-up using RAG. The whole experience is available in **English**, **Spanish**, or **ASL**.

---

## System Architecture

```
════════════════════════════════════════════════════════════════════════
  FRONTEND  —  Next.js 15 + TypeScript

  Landing Page  -->  Login / Signup  -->  Setup (Resume + Language)  -->  Dashboard

     +----------------------+----------------------+----------------------+
     |   English Voice      |   Spanish Voice      |   ASL Camera         |
     |   Web Speech API     |   Web Speech API     |   MediaStream API    |
     |   (en-US)            |   (es-ES)            |   Camera Frames      |
     +----------+-----------+----------+-----------+----------+-----------+
                |                      |                      |
════════════════╪══════════════════════╪══════════════════════╪════════════
                | transcript           | transcript           | base64 frames
                v                      v                      v
════════════════════════════════════════════════════════════════════════
  BACKEND  —  FastAPI + Python 3.13

  POST /parse-resume          POST /generate-questions    POST /interview/process
  --------------------        ------------------------    -----------------------
  pdfplumber                  Groq LLaMA 3.3 70B          RAG context retrieval
  Section-aware chunking      8 technical questions       Groq follow-up generation
  --> ChromaDB                5 behavioral questions      --> ElevenLabs TTS

  POST /asl/process-frame     POST /screen-resume         POST /tts
  -----------------------     -------------------         ---------
  MediaPipe hand landmarks    4x RandomForest models      ElevenLabs API
  RandomForest classifier     Category prediction         multilingual v2 (ES)
  Letter buffer --> word      Job recommendation          turbo v2 (EN)
                              Skills + education

════════════╤═══════════════════════════╤══════════════════════╤═════════
            |                           |                      |
            v                           v                      v
  ══════════════════     ═══════════════════════     ══════════════════
  RAG Pipeline           Supabase                    ElevenLabs TTS

  pdfplumber             PostgreSQL                  Speaks questions
       |                 User profiles               aloud in EN + ES
  MiniLM embeddings      Language preferences
       |                                             multilingual v2
  ChromaDB store         Auth (email/password)       for Spanish
       |                 Session persistence         turbo v2
  Groq LLaMA 70B                                     for English
  ══════════════════     ═══════════════════════     ══════════════════
```

---

## Key Features

| Feature | Description |
|---|---|
| **Resume-Aware Questions** | Parses your PDF and generates 8 targeted technical questions from your actual experience |
| **RAG Follow-Ups** | Every answer gets a contextual follow-up pulled from your resume via ChromaDB |
| **English Voice** | Web Speech API input + ElevenLabs TTS output |
| **Spanish Voice** | Full end-to-end Spanish — questions translated, responses understood, follow-ups in Spanish |
| **ASL Mode** | Camera-based hand landmark detection via MediaPipe + custom trained RandomForest classifier |
| **Resume Screening** | 4 ML models predict resume category, recommend job roles, and extract skills/education |
| **Interviewer Personas** | Randomized interviewer styles (startup CTO, staff engineer, etc.) per session |
| **Auth + Persistence** | Supabase-backed authentication, profile storage, and language preferences |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | FastAPI, Python 3.13, Uvicorn |
| **LLM** | Groq — LLaMA 3.3 70B (via OpenRouter-compatible client) |
| **RAG** | ChromaDB (in-memory), MiniLM embeddings, pdfplumber |
| **TTS** | ElevenLabs (`eleven_multilingual_v2` for Spanish, `eleven_turbo_v2` for English) |
| **Speech Input** | Web Speech API (`en-US` / `es-ES`) |
| **ASL** | MediaPipe Hand Landmarks + scikit-learn RandomForest classifier |
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
  (English / Spanish / ASL)
        │
        ▼
  Generate Questions
  (8 Technical + 5 Behavioral via Groq)
        │
        ┌──────────────────────────┐
        │      Interview Loop      │
        │                          │
        │  Question spoken (TTS)   │
        │         │                │
        │  User answers            │
        │  (voice / ASL signs)     │
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
- API keys: Groq, ElevenLabs, Supabase, OpenRouter

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Runs on http://localhost:8000
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
GROQ_API_KEY=
OPENROUTER_API_KEY=
ELEVENLABS_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### ASL Classifier (optional)

Download the [ASL Alphabet dataset](https://www.kaggle.com/datasets/grassknoted/asl-alphabet) and extract to `data/asl_alphabet_train/`, then:

```bash
python train_classifier.py
```

---

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
│       │   ├── interview/   # Live interview (Voice + ASL)
│       │   └── screen/      # Resume screening results
│       └── page.tsx         # Landing page
├── rag/
│   ├── parser.py            # PDF extraction + section chunking
│   ├── vectorstore.py       # ChromaDB setup + querying
│   └── interviewer.py       # Groq LLM calls
├── asl/
│   ├── detector.py          # MediaPipe hand landmark extraction
│   ├── classifier.py        # RandomForest sign prediction
│   └── buffer.py            # Letter-to-word assembly
├── data/
│   └── behavioral_questions.json
├── model/                   # Trained ASL + resume screening models
└── train_classifier.py      # ASL model training script
```

---

<p align="center">Built for HackUSF 2026</p>
