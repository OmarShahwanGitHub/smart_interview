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

```mermaid
graph LR

    %% ── USER ENTRY ──────────────────────────────────────────────
    USER(["👤 User"])

    subgraph FRONTEND["🖥️  Frontend  ·  Next.js 15 + TypeScript"]
        direction TB
        LP["Landing Page"]
        AUTH["Login / Signup"]
        SETUP["Setup\n───────────\nResume Upload\nLanguage Select"]
        DASH["Dashboard"]

        subgraph MODES["Interview Modes"]
            direction TB
            ENG["🎤 English\nVoice Interview"]
            ESP["🌎 Spanish\nVoice Interview"]
            ASL_UI["🤟 ASL\nCamera Interview"]
        end

        SCREEN_PAGE["📄 Resume\nScreening"]
    end

    subgraph SUPA_DB["🗄️  Supabase"]
        direction TB
        SUPA_AUTH["Auth\n(email / password)"]
        SUPA_DB2["PostgreSQL\nprofiles · preferences"]
    end

    subgraph BACKEND["⚙️  FastAPI Backend  ·  Python 3.13"]
        direction TB
        EP_PARSE["POST /parse-resume\npdfplumber"]
        EP_GENQ["POST /generate-questions\nGroq LLaMA 3.3 70B"]
        EP_PROC["POST /interview/process\nRAG follow-up"]
        EP_TTS["POST /tts\nElevenLabs"]
        EP_ASL["POST /asl/process-frame"]
        EP_SCREEN["POST /screen-resume\n4× ML Models"]
    end

    subgraph RAG["🧠  RAG Pipeline"]
        direction LR
        CHUNKS["Section-Aware\nChunker"]
        EMBED["MiniLM\nEmbeddings"]
        CHROMA["ChromaDB\nVectorstore"]
        LLM["Groq\nLLaMA 3.3 70B"]
        CHUNKS --> EMBED --> CHROMA
        CHROMA -->|context retrieval| LLM
    end

    subgraph ASL_PIPE["🤟  ASL Pipeline"]
        direction LR
        MP["MediaPipe\nHand Landmarks"]
        CLF["RandomForest\nSign Classifier"]
        BUF["Letter Buffer\nWord Assembly"]
        MP --> CLF --> BUF
    end

    subgraph VOICE["🔊  Voice Layer"]
        direction TB
        SPEECH["Web Speech API\nen-US / es-ES"]
        ELEVEN["ElevenLabs TTS\nmultilingual v2"]
    end

    %% ── CONNECTIONS ─────────────────────────────────────────────

    USER --> LP --> AUTH
    AUTH <--> SUPA_AUTH
    AUTH --> SETUP --> DASH

    SETUP -->|PDF upload| EP_PARSE --> CHUNKS
    SETUP -->|language pref| SUPA_DB2

    DASH --> MODES
    DASH --> SCREEN_PAGE

    ENG -->|speech input| SPEECH
    ESP -->|speech input| SPEECH
    SPEECH -->|transcript| EP_PROC

    ENG -->|questions| EP_GENQ
    ESP -->|questions| EP_GENQ
    EP_GENQ --> LLM

    EP_PROC --> LLM
    EP_PROC -->|audio| EP_TTS --> ELEVEN
    ELEVEN -->|spoken question| ENG
    ELEVEN -->|spoken question| ESP

    ASL_UI -->|camera frames| EP_ASL --> MP
    BUF -->|signed text| EP_PROC

    SCREEN_PAGE -->|chunks| EP_SCREEN

    %% ── STYLES ──────────────────────────────────────────────────
    style FRONTEND  fill:#1e1b4b,stroke:#6366f1,color:#e0e7ff
    style BACKEND   fill:#052e16,stroke:#22c55e,color:#dcfce7
    style RAG       fill:#1c1917,stroke:#f97316,color:#ffedd5
    style ASL_PIPE  fill:#0f172a,stroke:#34d399,color:#d1fae5
    style VOICE     fill:#1e1a2e,stroke:#8b5cf6,color:#ede9fe
    style SUPA_DB   fill:#0f172a,stroke:#38bdf8,color:#e0f2fe
    style MODES     fill:#2d1f4e,stroke:#a78bfa,color:#ede9fe
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
