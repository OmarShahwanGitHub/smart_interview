import os
import re
import random
from dataclasses import dataclass
from typing import Any

import requests


@dataclass
class OpenSourceLLMClient:
    """Small client for self-hosted open-source LLM servers.

    Defaults to Ollama because it is the quickest way to run Qwen/Llama/Mistral
    locally or on a small VM. Set LLM_PROVIDER=huggingface for Hugging Face's
    OpenAI-compatible router or LLM_PROVIDER=openai-compatible for vLLM, TGI,
    llama.cpp server, or any other compatible deployment.
    """

    provider: str
    base_url: str
    model: str
    api_key: str | None = None
    timeout: int = 120

    def chat(self, messages: list[dict[str, str]], temperature: float, max_tokens: int) -> str:
        if self.provider == "ollama":
            return self._ollama_chat(messages, temperature, max_tokens)
        return self._openai_compatible_chat(messages, temperature, max_tokens)

    def _ollama_chat(self, messages: list[dict[str, str]], temperature: float, max_tokens: int) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        data = self._post(f"{self.base_url}/api/chat", payload)
        content = data.get("message", {}).get("content", "")
        if not content:
            raise RuntimeError(f"Ollama returned no message content: {data}")
        return content.strip()

    def _openai_compatible_chat(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        data = self._post(f"{self.base_url}/chat/completions", payload)
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"LLM server returned an unexpected response: {data}") from exc

    def _post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError as exc:
            raise RuntimeError(
                f"Could not reach the LLM server at {self.base_url}. "
                "Start Ollama/vLLM or set LLM_API_BASE to your hosted model endpoint."
            ) from exc
        except requests.exceptions.Timeout as exc:
            raise RuntimeError(f"LLM request timed out after {self.timeout}s") from exc
        except requests.exceptions.HTTPError as exc:
            detail = response.text[:500] if "response" in locals() else str(exc)
            raise RuntimeError(f"LLM server error from {url}: {detail}") from exc


def get_client() -> OpenSourceLLMClient:
    """Create a client for a self-hosted open-source LLM."""
    provider = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
    model = os.getenv("LLM_MODEL", "qwen2.5:7b-instruct")
    if provider == "ollama":
        default_base_url = "http://localhost:11434"
    elif provider in {"huggingface", "hf"}:
        default_base_url = "https://router.huggingface.co/v1"
        provider = "huggingface"
    else:
        default_base_url = "http://localhost:8001/v1"
    base_url = os.getenv("LLM_API_BASE", default_base_url).rstrip("/")

    return OpenSourceLLMClient(
        provider=provider,
        base_url=base_url,
        model=model,
        api_key=os.getenv("LLM_API_KEY") or os.getenv("HF_TOKEN") or None,
        timeout=int(os.getenv("LLM_TIMEOUT", "120")),
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
    "arabic": "CRITICAL INSTRUCTION: You MUST write every single question in Arabic (Modern Standard Arabic). No English whatsoever.",
    "english": "",
}

_LANG_REMINDER = {
    "spanish": "\nREMINDER: Every question above must be in Spanish. If any question is in English, rewrite it in Spanish.",
    "arabic": "\nREMINDER: Every question above must be in Arabic. If any question is in English, rewrite it in Arabic.",
    "english": "",
}


def generate_questions(chunks: list[dict], client: OpenSourceLLMClient, language: str = "english") -> list[str]:
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

    content = client.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=1.0,
        max_tokens=800,
    )

    lines = content.split("\n")
    questions = []
    for line in lines:
        line = line.strip()
        if line and line[0].isdigit() and ("." in line or ")" in line):
            q = re.split(r"^[\d]+[.)]\s*", line, maxsplit=1)
            questions.append(q[-1].strip() if len(q) > 1 else line)
    return questions


def translate_questions(questions: list[str], client: OpenSourceLLMClient, target_language: str) -> list[str]:
    """Translate a list of questions into the target language."""
    if target_language.lower() == "english":
        return questions

    lang_name = {"spanish": "Spanish", "arabic": "Arabic"}.get(target_language.lower(), target_language)
    numbered = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))

    prompt = f"""Translate these interview questions into {lang_name}.
Keep them natural and conversational — as if a native {lang_name} speaker is asking them.
Return ONLY the numbered list in the same format, nothing else.

{numbered}"""

    content = client.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=800,
    )

    lines = content.split("\n")
    translated = []
    for line in lines:
        line = line.strip()
        if line and line[0].isdigit() and ("." in line or ")" in line):
            q = re.split(r"^[\d]+[.)]\s*", line, maxsplit=1)
            translated.append(q[-1].strip() if len(q) > 1 else line)

    # Fall back to originals if translation count mismatches
    return translated if len(translated) == len(questions) else questions


def generate_followup(
    question: str,
    answer: str,
    context: list[str],
    client: OpenSourceLLMClient,
    language: str = "english",
) -> str:
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

    content = client.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
        max_tokens=150,
    )

    return content.strip()
