import os
import re
import random
from openai import OpenAI


def get_client() -> OpenAI:
    """Get OpenRouter client (OpenAI-compatible API)"""
    return OpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1"
    )


_INTERVIEWER_PERSONAS = [
    "a startup CTO who cares about pragmatic engineering decisions and speed of execution",
    "a staff engineer at a big tech company who digs deep into system design and scalability",
    "a senior engineer who focuses on code quality, testing, and maintainability",
    "a tech lead who is especially curious about collaboration, debugging stories, and lessons learned",
    "a principal engineer who challenges assumptions and asks about trade-offs and alternatives",
]

_LANG_INSTRUCTION = {
    "spanish": "CRITICAL INSTRUCTION: You MUST write every single question in Spanish. No English whatsoever.",
    "english": "",
}

_LANG_REMINDER = {
    "spanish": "\nREMINDER: Every question above must be in Spanish. If any question is in English, rewrite it in Spanish.",
    "english": "",
}


def generate_questions(chunks: list[dict], client: OpenAI, language: str = "english") -> list[str]:
    shuffled = chunks[:]
    random.shuffle(shuffled)

    sections: dict[str, list[str]] = {}
    for chunk in shuffled:
        sec = chunk["section"]
        sections.setdefault(sec, []).append(chunk["text"])

    resume_text = "\n\n".join(
        f"[{sec.upper()}]\n" + "\n".join(texts)
        for sec, texts in sections.items()
    )

    persona = random.choice(_INTERVIEWER_PERSONAS)
    lang_note = _LANG_INSTRUCTION.get(language.lower(), "")

    lang_reminder = _LANG_REMINDER.get(language.lower(), "")

    prompt = f"""{lang_note}
You are {persona}, conducting a real technical interview.
Based on the candidate's resume below, generate exactly 8 interview questions.

Rules:
- Reference specific project names, technologies, companies, or roles from the resume
- Ask about implementation details, trade-offs, challenges, and outcomes
- Make questions feel like a real human interviewer asked them (not generic)
- Do NOT ask yes/no questions
- Do NOT repeat similar questions

Resume:
{resume_text}

Return ONLY a numbered list (1. 2. 3. ...) of questions, nothing else.{lang_reminder}"""

    resp = client.chat.completions.create(
        model="openai/gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=1.0,
        max_tokens=800,
    )

    lines = resp.choices[0].message.content.strip().split("\n")
    questions = []
    for line in lines:
        line = line.strip()
        if line and line[0].isdigit() and ("." in line or ")" in line):
            q = re.split(r"^[\d]+[.)]\s*", line, maxsplit=1)
            questions.append(q[-1].strip() if len(q) > 1 else line)
    return questions


def translate_questions(questions: list[str], client: OpenAI, target_language: str) -> list[str]:
    """Translate a list of questions into the target language."""
    if target_language.lower() == "english":
        return questions

    lang_name = {"spanish": "Spanish"}.get(target_language.lower(), target_language)
    numbered = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))

    prompt = f"""Translate these interview questions into {lang_name}.
Keep them natural and conversational — as if a native {lang_name} speaker is asking them.
Return ONLY the numbered list in the same format, nothing else.

{numbered}"""

    resp = client.chat.completions.create(
        model="openai/gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=800,
    )

    lines = resp.choices[0].message.content.strip().split("\n")
    translated = []
    for line in lines:
        line = line.strip()
        if line and line[0].isdigit() and ("." in line or ")" in line):
            q = re.split(r"^[\d]+[.)]\s*", line, maxsplit=1)
            translated.append(q[-1].strip() if len(q) > 1 else line)

    # Fall back to originals if translation count mismatches
    return translated if len(translated) == len(questions) else questions


def generate_followup(question: str, answer: str, context: list[str], client: OpenAI, language: str = "english") -> str:
    lang_note = _LANG_INSTRUCTION.get(language.lower(), "")
    context_text = "\n".join(context)

    lang_reminder = _LANG_REMINDER.get(language.lower(), "")

    prompt = f"""{lang_note}
You are a technical interviewer. The candidate just answered your question.

Your question: {question}
Their answer: {answer}
Resume context: {context_text}

Ask ONE natural follow-up question that probes deeper. Keep it conversational.
Return ONLY the follow-up question.{lang_reminder}"""

    resp = client.chat.completions.create(
        model="openai/gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
        max_tokens=150,
    )

    return resp.choices[0].message.content.strip()
