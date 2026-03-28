# Smart Interview

An AI-powered mock interview app that reads your resume and asks you personalized technical questions based on your actual projects, skills, and experience — just like a real recruiter would.

## How it works

1. **Upload your resume** (PDF)
2. The app parses it into sections (Skills, Projects, Experience, Education, etc.)
3. Chunks are embedded and stored in an in-memory vector database (ChromaDB)
4. A Groq-powered LLM generates 8 targeted interview questions referencing your specific work
5. For each question, it generates a follow-up based on your answer
6. Questions vary between sessions — different interviewer personas and shuffled context mean no two sessions are identical

## Stack

| Layer | Tool |
|---|---|
| UI | Streamlit |
| LLM | Groq (`llama-3.3-70b-versatile`) |
| Vector DB | ChromaDB (in-memory) |
| PDF Parsing | pdfplumber |
| Embeddings | ChromaDB default (MiniLM) |

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/FaresIbrahim32/smart_interview.git
cd smart_interview
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Add your Groq API key

Create a `.env` file in the project root:

```
RAG_API=your_groq_api_key_here
```

Get a free API key at [console.groq.com](https://console.groq.com).

### 5. Run the app

```bash
streamlit run app.py
```

## Features

- **Section-aware chunking** — resume is split by detected sections so questions are targeted
- **Randomized personas** — each session picks a different interviewer style (startup CTO, staff engineer, etc.)
- **Follow-up questions** — after each answer, a contextual follow-up is generated
- **Progress tracking** — sidebar shows all questions with completion status
- **No data stored** — everything is in-memory, cleared when you close the session

## Project structure

```
smart_interview/
├── app.py               # Streamlit UI and interview loop
├── requirements.txt
├── rag/
│   ├── parser.py        # PDF extraction and section-based chunking
│   ├── vectorstore.py   # ChromaDB setup and querying
│   └── interviewer.py   # Groq LLM calls for question and follow-up generation
```
