"""
FastAPI Backend for Smart Interview Application

Endpoints:
- POST /parse-resume: Parse resume PDF and extract fields
- POST /generate-questions: Generate technical + behavioral questions
- POST /interview/process: Process answer and generate follow-up with TTS
- POST /screen-resume: ML-based resume screening
- POST /tts: Text-to-speech via ElevenLabs
"""

import os
import sys
import re
import json
import pickle
import tempfile
import base64
import uuid
from pathlib import Path
from typing import List, Dict, Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from rag.parser import parse_resume
from rag.vectorstore import build_vectorstore, query as query_vectorstore
from rag.interviewer import get_client, generate_questions, generate_followup, translate_questions
from tts import speak
from backend.storage import insert_one, object_key, s3_enabled, upload_bytes_to_s3, upsert_one, utc_now

load_dotenv()

app = FastAPI(title="Smart Interview API")

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.getenv("FRONTEND_URL", "http://localhost:3000")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state for interview sessions
interview_sessions: Dict[str, Dict] = {}

# ── ML models for resume screening (loaded once at startup) ──────────────────
_MODELS_DIR = Path(__file__).parent.parent / "models"

def _load_screening_models():
    try:
        return {
            "cat_clf":   pickle.load(open(_MODELS_DIR / "rf_classifier_categorization.pkl", "rb")),
            "cat_tfidf": pickle.load(open(_MODELS_DIR / "tfidf_vectorizer_categorization.pkl", "rb")),
            "job_clf":   pickle.load(open(_MODELS_DIR / "rf_classifier_job_recommendation.pkl", "rb")),
            "job_tfidf": pickle.load(open(_MODELS_DIR / "tfidf_vectorizer_job_recommendation.pkl", "rb")),
        }
    except Exception as e:
        print(f"[screener] Could not load ML models: {e}")
        return None

_screening_models = _load_screening_models()

# ═══════════════════════════════════════════════════════════════════════════
# Request/Response Models
# ═══════════════════════════════════════════════════════════════════════════

class ParsedResume(BaseModel):
    fields: Dict[str, str]
    chunks: List[Dict[str, str]]
    resume_id: Optional[str] = None

class GenerateQuestionsRequest(BaseModel):
    chunks: List[Dict[str, str]]
    language: str = "english"

class QuestionsResponse(BaseModel):
    technical_questions: List[str]
    behavioral_questions: List[Dict]

class ProcessAnswerRequest(BaseModel):
    session_id: str
    question: str
    answer: str
    language: str = "english"
    user_id: Optional[str] = None
    resume_id: Optional[str] = None
    turn_id: Optional[str] = None
    mode: Optional[str] = None
    question_index: Optional[int] = None

class ProcessAnswerResponse(BaseModel):
    followup_question: Optional[str]
    audio_base64: Optional[str]  # Base64 encoded MP3 audio
    turn_id: Optional[str] = None

class InitSessionRequest(BaseModel):
    chunks: List[Dict]
    user_id: Optional[str] = None
    resume_id: Optional[str] = None
    language: str = "english"

class AudioUploadResponse(BaseModel):
    recording_id: Optional[str]
    storage_key: str
    storage_url: str

# ═══════════════════════════════════════════════════════════════════════════
# Endpoint 1: Parse Resume
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/parse-resume", response_model=ParsedResume)
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
):
    """
    Parse uploaded resume PDF and extract structured fields.
    Returns detected fields (name, email, etc.) and text chunks for RAG.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Parse resume into chunks
        chunks = parse_resume(tmp_path)
        os.unlink(tmp_path)

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from PDF. Ensure it's not a scanned image."
            )

        # Extract basic fields from chunks
        fields = extract_fields_from_chunks(chunks)
        resume_id = await insert_one("resumes", {
            "user_id": user_id,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(content),
            "parsed_fields": fields,
            "chunks": chunks,
            "source": "parse-resume",
        })

        return ParsedResume(fields=fields, chunks=chunks, resume_id=resume_id)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing resume: {str(e)}")


def extract_fields_from_chunks(chunks: List[Dict]) -> Dict[str, str]:
    """
    Extract structured fields (name, email, phone, etc.) from resume chunks.
    This is a simple heuristic-based extraction.
    """
    import re

    fields = {
        "name": "",
        "email": "",
        "phone": "",
        "location": "",
        "linkedin": "",
        "github": "",
        "summary": ""
    }

    full_text = " ".join([c["text"] for c in chunks])

    # Email detection
    email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', full_text)
    if email_match:
        fields["email"] = email_match.group(0)

    # Phone detection
    phone_match = re.search(r'\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b', full_text)
    if phone_match:
        fields["phone"] = phone_match.group(0)

    # LinkedIn detection
    linkedin_match = re.search(r'linkedin\.com/in/[\w-]+', full_text, re.IGNORECASE)
    if linkedin_match:
        fields["linkedin"] = linkedin_match.group(0)

    # GitHub detection
    github_match = re.search(r'github\.com/[\w-]+', full_text, re.IGNORECASE)
    if github_match:
        fields["github"] = github_match.group(0)

    # Name detection (heuristic: first line with 2-4 capitalized words)
    lines = full_text.split('\n')
    for line in lines[:5]:  # Check first 5 lines
        words = line.strip().split()
        if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
            fields["name"] = line.strip()
            break

    # Summary (first chunk from summary/objective section)
    for chunk in chunks:
        if chunk["section"] in ["summary", "objective", "about me", "profile"]:
            fields["summary"] = chunk["text"][:200]  # First 200 chars
            break

    return fields


# ═══════════════════════════════════════════════════════════════════════════
# Endpoint 2: Generate Questions
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/generate-questions", response_model=QuestionsResponse)
async def generate_questions_endpoint(request: GenerateQuestionsRequest):
    """
    Generate technical questions (RAG-based) and behavioral questions.
    Technical questions are generated from resume chunks.
    Behavioral questions are loaded from data/behavioral_questions.json.
    """
    try:
        llm_client = get_client()
        language = request.language.lower()

        # Generate technical questions in the requested language
        technical_qs = generate_questions(request.chunks, llm_client, language=language)

        # Load and sample behavioral questions
        behavioral_path = Path(__file__).parent.parent / "data" / "behavioral_questions.json"
        with open(behavioral_path, "r", encoding="utf-8") as f:
            behavioral_data = json.load(f)
        import random
        sampled = random.sample(behavioral_data["questions"], min(5, len(behavioral_data["questions"])))
        behavioral_texts = [q["question"] for q in sampled]

        # Translate behavioral questions if not English
        if language != "english":
            behavioral_texts = translate_questions(behavioral_texts, llm_client, target_language=language)

        # Return behavioral questions as plain strings (already translated)
        behavioral_qs = [{"id": i, "question": q, "category": sampled[i].get("category", ""), "difficulty": sampled[i].get("difficulty", "")}
                         for i, q in enumerate(behavioral_texts)]

        return QuestionsResponse(
            technical_questions=technical_qs,
            behavioral_questions=behavioral_qs
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════
# Endpoint 3: Process Answer & Generate Follow-up
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/interview/process", response_model=ProcessAnswerResponse)
async def process_answer_endpoint(request: ProcessAnswerRequest):
    """
    Process candidate's answer and generate follow-up question.
    Includes TTS audio generation for voice modes.
    """
    try:
        # Get or create session
        if request.session_id not in interview_sessions:
            interview_sessions[request.session_id] = {
                "collection": None,
                "llm": get_client()
            }

        session = interview_sessions[request.session_id]

        # Query vectorstore for context (if collection exists)
        context = []
        if session["collection"]:
            context = query_vectorstore(
                session["collection"],
                request.question + " " + request.answer
            )

        # Generate follow-up question in the same language
        followup = generate_followup(
            request.question,
            request.answer,
            context,
            session["llm"],
            language=request.language,
        )

        audio_base64 = None
        audio_bytes = speak(followup, language=request.language)
        if audio_bytes:
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

        turn_id = request.turn_id or str(uuid.uuid4())
        await upsert_one(
            "interview_turns",
            {"turn_id": turn_id},
            {
                "turn_id": turn_id,
                "session_id": request.session_id,
                "user_id": request.user_id,
                "resume_id": request.resume_id,
                "mode": request.mode,
                "question_index": request.question_index,
                "question": request.question,
                "answer_text": request.answer,
                "followup_question": followup,
                "language": request.language,
            },
        )

        if audio_bytes and s3_enabled():
            await save_recording_bytes(
                data=audio_bytes,
                filename="followup.mp3",
                content_type="audio/mpeg",
                session_id=request.session_id,
                user_id=request.user_id,
                resume_id=request.resume_id,
                turn_id=turn_id,
                kind="followup_question",
                text=followup,
            )

        return ProcessAnswerResponse(
            followup_question=followup,
            audio_base64=audio_base64,
            turn_id=turn_id,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing answer: {str(e)}")


@app.post("/interview/init-session")
async def init_interview_session(session_id: str, request: InitSessionRequest):
    """
    Initialize an interview session with resume chunks for context retrieval.
    """
    try:
        collection = build_vectorstore(request.chunks)
        interview_sessions[session_id] = {
            "collection": collection,
            "llm": get_client()
        }
        await upsert_one(
            "interview_sessions",
            {"session_id": session_id},
            {
                "session_id": session_id,
                "user_id": request.user_id,
                "resume_id": request.resume_id,
                "language": request.language,
                "status": "active",
                "started_at": utc_now(),
            },
        )
        return {"status": "success", "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error initializing session: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════
# Endpoint 4: Text-to-Speech
# ═══════════════════════════════════════════════════════════════════════════

class TTSRequest(BaseModel):
    text: str
    language: str = "english"
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    resume_id: Optional[str] = None
    turn_id: Optional[str] = None
    kind: str = "question"
    persist: bool = False


@app.post("/tts")
async def tts_endpoint(request: TTSRequest):
    """
    Convert text to speech via ElevenLabs.
    Uses a Spanish voice + multilingual model when language='spanish'.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    audio_bytes = speak(request.text, language=request.language)
    if audio_bytes is None:
        raise HTTPException(status_code=503, detail="TTS unavailable — check ELEVEN_API key")

    recording = None
    if request.persist and request.session_id and s3_enabled():
        recording = await save_recording_bytes(
            data=audio_bytes,
            filename=f"{request.kind}.mp3",
            content_type="audio/mpeg",
            session_id=request.session_id,
            user_id=request.user_id,
            resume_id=request.resume_id,
            turn_id=request.turn_id,
            kind=request.kind,
            text=request.text,
        )

    return {
        "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
        "recording": recording,
    }


async def save_recording_bytes(
    *,
    data: bytes,
    filename: str,
    content_type: str,
    session_id: str,
    kind: str,
    user_id: Optional[str] = None,
    resume_id: Optional[str] = None,
    turn_id: Optional[str] = None,
    text: Optional[str] = None,
) -> dict:
    key = object_key(f"interviews/{session_id}/{kind}", filename)
    storage_url = await upload_bytes_to_s3(
        data=data,
        key=key,
        content_type=content_type,
        metadata={
            "session_id": session_id,
            "turn_id": turn_id or "",
            "kind": kind,
        },
    )
    recording_doc = {
        "session_id": session_id,
        "turn_id": turn_id,
        "user_id": user_id,
        "resume_id": resume_id,
        "kind": kind,
        "text": text,
        "mime_type": content_type,
        "size_bytes": len(data),
        "storage_type": "s3",
        "storage_key": key,
        "storage_url": storage_url,
    }
    recording_id = await insert_one("recordings_metadata", recording_doc)

    if turn_id:
        update_field = f"recordings.{kind}"
        await upsert_one(
            "interview_turns",
            {"turn_id": turn_id},
            {
                "turn_id": turn_id,
                "session_id": session_id,
                update_field: {
                    "recording_id": recording_id,
                    "storage_key": key,
                    "storage_url": storage_url,
                    "mime_type": content_type,
                    "size_bytes": len(data),
                },
            },
        )

    return {
        "recording_id": recording_id,
        "storage_key": key,
        "storage_url": storage_url,
    }


@app.post("/interview/recording", response_model=AudioUploadResponse)
async def upload_interview_recording(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    kind: str = Form(...),
    user_id: Optional[str] = Form(None),
    resume_id: Optional[str] = Form(None),
    turn_id: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    question: Optional[str] = Form(None),
    mode: Optional[str] = Form(None),
    question_index: Optional[int] = Form(None),
):
    if kind not in {"answer", "question", "followup_question", "full_session"}:
        raise HTTPException(status_code=400, detail="Invalid recording kind")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    try:
        recording = await save_recording_bytes(
            data=data,
            filename=file.filename or f"{kind}.webm",
            content_type=file.content_type or "application/octet-stream",
            session_id=session_id,
            user_id=user_id,
            resume_id=resume_id,
            turn_id=turn_id,
            kind=kind,
            text=text,
        )
        if turn_id:
            await upsert_one(
                "interview_turns",
                {"turn_id": turn_id},
                {
                    "turn_id": turn_id,
                    "session_id": session_id,
                    "user_id": user_id,
                    "resume_id": resume_id,
                    "mode": mode,
                    "question_index": question_index,
                    "question": question,
                    "answer_text": text if kind == "answer" else None,
                },
            )
        return AudioUploadResponse(**recording)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ═══════════════════════════════════════════════════════════════════════════
# Endpoint 5: ElevenLabs Signed URL (for Conversational AI voice agent)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/elevenlabs/signed-url")
async def get_elevenlabs_signed_url():
    """
    Returns a short-lived signed URL so the frontend can connect to the
    ElevenLabs Conversational AI agent without exposing the API key.
    """
    import requests as _requests

    agent_id = os.getenv("ELEVEN_AGENT_ID")
    api_key = os.getenv("ELEVEN_API")

    if not agent_id or not api_key:
        raise HTTPException(
            status_code=500,
            detail="ELEVEN_AGENT_ID or ELEVEN_API not configured"
        )

    resp = _requests.get(
        f"https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id={agent_id}",
        headers={"xi-api-key": api_key},
    )
    if not resp.ok:
        raise HTTPException(status_code=502, detail="Failed to get signed URL from ElevenLabs")

    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════
# Endpoint 7: Resume Screening (ML models)
# ═══════════════════════════════════════════════════════════════════════════

_SKILLS_LIST = [
    'Python','Data Analysis','Machine Learning','Communication','Project Management',
    'Deep Learning','SQL','Tableau','Java','C++','JavaScript','HTML','CSS','React',
    'Angular','Node.js','MongoDB','Express.js','Git','Research','Statistics',
    'Quantitative Analysis','Qualitative Analysis','SPSS','R','Data Visualization',
    'Matplotlib','Seaborn','Plotly','Pandas','Numpy','Scikit-learn','TensorFlow',
    'Keras','PyTorch','NLTK','Text Mining','Natural Language Processing',
    'Computer Vision','Image Processing','OCR','Speech Recognition',
    'Recommendation Systems','Collaborative Filtering','Reinforcement Learning',
    'Neural Networks','Convolutional Neural Networks','Recurrent Neural Networks',
    'Generative Adversarial Networks','XGBoost','Random Forest','Decision Trees',
    'Support Vector Machines','Linear Regression','Logistic Regression',
    'K-Means Clustering','Apache Hadoop','Apache Spark','MapReduce','Hive',
    'Apache Kafka','ETL','Big Data Analytics','Cloud Computing',
    'Amazon Web Services (AWS)','Microsoft Azure','Google Cloud Platform (GCP)',
    'Docker','Kubernetes','Linux','Shell Scripting','Cybersecurity',
    'Network Security','Penetration Testing','Encryption','CI/CD','DevOps',
    'Agile Methodology','Scrum','Kanban','Software Development','Web Development',
    'Mobile Development','Backend Development','Frontend Development',
    'Full-Stack Development','UI/UX Design','Figma','Sketch','Product Management',
    'Market Research','Business Development','Sales','Marketing','SEO',
    'Google Analytics','Salesforce','HubSpot','Quality Assurance','Selenium',
    'API Testing','Technical Writing','WordPress','Django','Flask','FastAPI',
    'PostgreSQL','MySQL','SQLite','Redis','Elasticsearch','Firebase','AWS Lambda',
    'Blockchain','Smart Contracts','Web3','Swift','Kotlin','Flutter',
    'React Native','Unity','Unreal Engine',
]

_EDUCATION_KEYWORDS = [
    'Computer Science','Information Technology','Software Engineering',
    'Electrical Engineering','Mechanical Engineering','Civil Engineering',
    'Chemical Engineering','Biomedical Engineering','Data Science',
    'Data Analytics','Business Analytics','Cybersecurity','Information Security',
    'Network Engineering','Human-Computer Interaction','Business Administration',
    'Finance','Accounting','Economics','Marketing','Psychology','Mathematics',
    'Statistics','Physics','Biology','Chemistry','Architecture','Graphic Design',
    'Industrial Design','Communication Studies','Journalism','Political Science',
    'International Relations','Public Health','Nursing','Medicine','Pharmacy',
    'Environmental Science','Renewable Energy','Blockchain Technology',
]


def _clean_resume(txt: str) -> str:
    txt = re.sub(r'http\S+\s', ' ', txt)
    txt = re.sub(r'RT|cc', ' ', txt)
    txt = re.sub(r'#\S+\s', ' ', txt)
    txt = re.sub(r'@\S+', '  ', txt)
    txt = re.sub(r'[!"#$%&\'()*+,\-./:;<=>?@\[\\\]^_`{|}~]', ' ', txt)
    txt = re.sub(r'[^\x00-\x7f]', ' ', txt)
    txt = re.sub(r'\s+', ' ', txt)
    return txt.strip()


class ScreenResumeRequest(BaseModel):
    chunks: List[Dict]   # resume chunks from localStorage / RAG parse


@app.post("/screen-resume")
async def screen_resume(request: ScreenResumeRequest):
    """
    Run the 4 ML models on the resume chunks and return:
    - category (resume type)
    - recommended_job
    - skills detected
    - education fields detected
    - contact info (name, email, phone)
    """
    if not _screening_models:
        raise HTTPException(status_code=503, detail="ML screening models not loaded")

    # Reconstruct full resume text from chunks
    full_text = " ".join(c.get("text", "") for c in request.chunks)
    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No text in resume chunks")

    cleaned = _clean_resume(full_text)

    # Category prediction
    cat_vec = _screening_models["cat_tfidf"].transform([cleaned])
    category = _screening_models["cat_clf"].predict(cat_vec)[0]

    # Job recommendation
    job_vec = _screening_models["job_tfidf"].transform([cleaned])
    recommended_job = _screening_models["job_clf"].predict(job_vec)[0]

    # Skills
    skills = [s for s in _SKILLS_LIST
              if re.search(r"\b{}\b".format(re.escape(s)), full_text, re.IGNORECASE)]

    # Education
    education = [kw for kw in _EDUCATION_KEYWORDS
                 if re.search(r"(?i)\b{}\b".format(re.escape(kw)), full_text)]

    # Contact info
    email_m = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", full_text)
    phone_m = re.search(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", full_text)
    name_m  = re.search(r"(\b[A-Z][a-z]+\b)\s(\b[A-Z][a-z]+\b)", full_text)

    return {
        "category": category,
        "recommended_job": recommended_job,
        "skills": skills,
        "education": education,
        "name": name_m.group() if name_m else None,
        "email": email_m.group() if email_m else None,
        "phone": phone_m.group() if phone_m else None,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Smart Interview API",
        "endpoints": [
            "POST /parse-resume",
            "POST /generate-questions",
            "POST /interview/process",
            "POST /interview/init-session",
            "POST /interview/recording"
        ]
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
