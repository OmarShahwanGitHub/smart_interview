import streamlit as st
import tempfile
import os
from dotenv import load_dotenv

load_dotenv()

from rag.parser import parse_resume
from rag.vectorstore import build_vectorstore, query
from rag.interviewer import get_client, generate_questions, generate_followup

st.set_page_config(page_title="Smart Interview", layout="centered")
st.title("Smart Interview")
st.caption("Upload your resume and get interviewed on your actual experience.")

# ── Session state defaults ────────────────────────────────────────────────────
for key, default in {
    "questions": [],
    "q_index": 0,
    "history": [],          # list of {"role": "interviewer"|"candidate", "text": str}
    "collection": None,
    "groq": None,
    "awaiting_followup": False,
    "followup_q": "",
}.items():
    if key not in st.session_state:
        st.session_state[key] = default


# ── Upload screen ─────────────────────────────────────────────────────────────
if not st.session_state.questions:
    uploaded = st.file_uploader("Upload your resume (PDF)", type=["pdf"])

    if uploaded:
        with st.spinner("Reading resume and generating questions..."):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(uploaded.read())
                tmp_path = tmp.name

            chunks = parse_resume(tmp_path)
            os.unlink(tmp_path)

            if not chunks:
                st.error("Couldn't extract text. Make sure your PDF is not a scanned image.")
                st.stop()

            st.session_state.collection = build_vectorstore(chunks)
            st.session_state.groq = get_client()
            st.session_state.questions = generate_questions(chunks, st.session_state.groq)

        st.rerun()

    st.stop()


# ── Interview screen ──────────────────────────────────────────────────────────
questions = st.session_state.questions
idx = st.session_state.q_index
total = len(questions)

# Progress bar
st.progress(idx / total, text=f"Question {min(idx + 1, total)} of {total}")

# Render chat history
for msg in st.session_state.history:
    role = "assistant" if msg["role"] == "interviewer" else "user"
    with st.chat_message(role):
        st.write(msg["text"])

# ── Determine current question ────────────────────────────────────────────────
if idx >= total:
    st.success("That's a wrap! Great practice session.")
    if st.button("Start over"):
        for k in ["questions", "q_index", "history", "collection", "groq",
                  "awaiting_followup", "followup_q"]:
            del st.session_state[k]
        st.rerun()
    st.stop()

current_q = (
    st.session_state.followup_q
    if st.session_state.awaiting_followup
    else questions[idx]
)

# Show the current question if not yet in history
if not st.session_state.history or st.session_state.history[-1]["role"] != "interviewer":
    with st.chat_message("assistant"):
        st.write(current_q)

# ── Answer input ──────────────────────────────────────────────────────────────
answer = st.chat_input("Your answer…")

if answer:
    st.session_state.history.append({"role": "interviewer", "text": current_q})
    st.session_state.history.append({"role": "candidate", "text": answer})

    # Retrieve relevant resume context
    context = query(st.session_state.collection, current_q + " " + answer)

    if not st.session_state.awaiting_followup:
        # Generate one follow-up, then move on after that is answered
        followup = generate_followup(current_q, answer, context, st.session_state.groq)
        st.session_state.followup_q = followup
        st.session_state.awaiting_followup = True
    else:
        # Follow-up answered → next main question
        st.session_state.awaiting_followup = False
        st.session_state.followup_q = ""
        st.session_state.q_index += 1

    st.rerun()

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Session")
    if st.button("Upload new resume"):
        for k in ["questions", "q_index", "history", "collection", "groq",
                  "awaiting_followup", "followup_q"]:
            del st.session_state[k]
        st.rerun()

    st.divider()
    st.subheader("All questions")
    for i, q in enumerate(questions):
        prefix = "✅" if i < idx else ("▶" if i == idx else "○")
        st.caption(f"{prefix} {i+1}. {q[:70]}{'…' if len(q) > 70 else ''}")
