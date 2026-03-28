"""
Scraper for top 50 behavioral interview questions for tech jobs.
Pulls from multiple sources, deduplicates, and saves to behavioral_questions.json.
"""

import re
import json
import time
import requests
from bs4 import BeautifulSoup
from collections import Counter

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}

# ── helpers ──────────────────────────────────────────────────────────────────

def fetch(url: str, timeout: int = 10) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"  [skip] {url}  —  {e}")
        return None


META_BLACKLIST = re.compile(
    r"^(what are|how to|why do|how do interviewers|tips|step|situation:|task:|action:|result:)",
    re.I,
)

BEHAVIORAL_STARTERS = re.compile(
    r"^(tell me|describe|give me|walk me|have you|can you|what was a time|"
    r"talk about|share an example|think of a time|recall a time|"
    r"how (have you|did you|would you)|why did you)",
    re.I,
)


def looks_like_question(text: str) -> bool:
    text = text.strip()
    if len(text) < 30 or len(text) > 300:
        return False
    if META_BLACKLIST.search(text):
        return False
    return bool(BEHAVIORAL_STARTERS.search(text)) or (
        text.endswith("?") and bool(re.search(r"\ba time\b|\ban example\b|\bsituation\b", text, re.I))
    )


def clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^\d+[\.\)]\s*", "", text)   # strip leading numbering
    if not text.endswith("?"):
        text += "?"
    return text[0].upper() + text[1:]


# ── source scrapers ───────────────────────────────────────────────────────────

def scrape_indeed() -> list[str]:
    url = "https://www.indeed.com/career-advice/interviewing/behavioral-interview-questions"
    soup = fetch(url)
    if not soup:
        return []
    questions = []
    for tag in soup.find_all(["li", "h3", "h4", "p", "strong"]):
        t = tag.get_text(separator=" ")
        if looks_like_question(t):
            questions.append(clean(t))
    print(f"  indeed: {len(questions)} candidates")
    return questions


def scrape_themuse() -> list[str]:
    url = "https://www.themuse.com/advice/behavioral-interview-questions-answers-examples"
    soup = fetch(url)
    if not soup:
        return []
    questions = []
    for tag in soup.find_all(["li", "h2", "h3", "strong", "b"]):
        t = tag.get_text(separator=" ")
        if looks_like_question(t):
            questions.append(clean(t))
    print(f"  themuse: {len(questions)} candidates")
    return questions


def scrape_careersidekick() -> list[str]:
    url = "https://careersidekick.com/behavioral-interview-questions/"
    soup = fetch(url)
    if not soup:
        return []
    questions = []
    for tag in soup.find_all(["li", "h3", "h2", "strong"]):
        t = tag.get_text(separator=" ")
        if looks_like_question(t):
            questions.append(clean(t))
    print(f"  careersidekick: {len(questions)} candidates")
    return questions


def scrape_interviewbit() -> list[str]:
    url = "https://www.interviewbit.com/behavioral-interview-questions/"
    soup = fetch(url)
    if not soup:
        return []
    questions = []
    for tag in soup.find_all(["li", "h3", "h2", "strong", "p"]):
        t = tag.get_text(separator=" ")
        if looks_like_question(t):
            questions.append(clean(t))
    print(f"  interviewbit: {len(questions)} candidates")
    return questions


def scrape_builtin() -> list[str]:
    url = "https://builtin.com/recruiting/behavioral-interview-questions"
    soup = fetch(url)
    if not soup:
        return []
    questions = []
    for tag in soup.find_all(["li", "h3", "h2", "strong"]):
        t = tag.get_text(separator=" ")
        if looks_like_question(t):
            questions.append(clean(t))
    print(f"  builtin: {len(questions)} candidates")
    return questions


def scrape_glassdoor() -> list[str]:
    url = "https://www.glassdoor.com/blog/guide/behavioral-interview-questions/"
    soup = fetch(url)
    if not soup:
        return []
    questions = []
    for tag in soup.find_all(["li", "h3", "h2", "strong", "p"]):
        t = tag.get_text(separator=" ")
        if looks_like_question(t):
            questions.append(clean(t))
    print(f"  glassdoor: {len(questions)} candidates")
    return questions


# ── known top behavioral questions (curated fallback) ────────────────────────
# These are universally recognised across all major interview resources.

CURATED = [
    "Tell me about yourself.",
    "Tell me about a time you faced a significant challenge at work and how you overcame it.",
    "Describe a situation where you had to work with a difficult team member. How did you handle it?",
    "Give me an example of a time you showed leadership.",
    "Tell me about a time you failed. What did you learn from it?",
    "Describe a project you are most proud of.",
    "Tell me about a time you had to meet a tight deadline.",
    "Give me an example of a time you had to adapt to a major change.",
    "Tell me about a time you disagreed with your manager. How did you handle it?",
    "Describe a situation where you had to prioritize multiple tasks at once.",
    "Tell me about a time you went above and beyond for a customer or user.",
    "Give me an example of a goal you set and how you achieved it.",
    "Tell me about a time you had to learn something quickly.",
    "Describe a situation where you received critical feedback. How did you respond?",
    "Tell me about a time you collaborated with a cross-functional team.",
    "Give me an example of a creative solution you came up with to solve a problem.",
    "Tell me about a time you had to make a decision with incomplete information.",
    "Describe a situation where you had to influence someone without direct authority.",
    "Tell me about a time you identified a problem before it became critical.",
    "Give me an example of how you handle conflict on a team.",
    "Tell me about a time you mentored or coached a colleague.",
    "Describe a project where you had to manage ambiguity.",
    "Tell me about a time you had to deliver bad news to a stakeholder.",
    "Give me an example of a time you improved a process.",
    "Tell me about a time you had to work under pressure.",
    "Describe a situation where you made a mistake and how you corrected it.",
    "Tell me about a time you had to persuade someone to see your point of view.",
    "Give me an example of a time you demonstrated ownership over a project.",
    "Tell me about a time you had to balance quality versus speed in your work.",
    "Describe a situation where you had to handle multiple conflicting priorities.",
    "Tell me about your greatest professional achievement.",
    "Give me an example of a time you took initiative without being asked.",
    "Tell me about a time you worked in a fast-paced environment.",
    "Describe how you handle situations where requirements kept changing mid-project.",
    "Tell me about a time you had to build trust with a skeptical stakeholder.",
    "Give me an example of a time you had to give constructive feedback.",
    "Tell me about a time you had to work with limited resources.",
    "Describe a situation where you had to make an unpopular decision.",
    "Tell me about a time you successfully managed a project from start to finish.",
    "Give me an example of a time you helped a struggling teammate.",
    "Tell me about a time you took a calculated risk.",
    "Describe how you stay motivated when working on repetitive tasks.",
    "Tell me about a time you had to quickly gain domain knowledge in an unfamiliar area.",
    "Give me an example of how you manage your time when you have competing deadlines.",
    "Tell me about a situation where you had to negotiate a compromise.",
    "Describe a time when you had to step outside your comfort zone at work.",
    "Tell me about a time you used data to make a decision.",
    "Give me an example of a time your communication skills helped resolve a problem.",
    "Tell me about a time you contributed to improving team culture.",
    "Where do you see yourself in five years, and how does this role fit that vision?",
    "Tell me about a time you had to learn a new technology or tool quickly to complete a project.",
    "Describe a situation where you successfully onboarded or trained a new team member.",
    "Give me an example of a time you used data or metrics to drive a decision.",
    "Tell me about a time your project scope changed significantly mid-way. How did you respond?",
    "Describe a time when you proactively shared knowledge that benefited your team.",
    "Give me an example of a time you had to work with someone whose work style was very different from yours.",
    "Tell me about a time you had to defend a technical decision to non-technical stakeholders.",
    "Describe a time you reduced technical debt or improved code quality in a meaningful way.",
    "Give me an example of a time you volunteered for a task that was outside your job description.",
    "Tell me about a time you received positive feedback from a manager or peer that stood out to you.",
]


# ── deduplication ─────────────────────────────────────────────────────────────

def normalize(text: str) -> str:
    """Lowercase, strip punctuation for similarity comparison."""
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def deduplicate(questions: list[str], target: int = 50) -> list[str]:
    seen_norms: list[str] = []
    unique: list[str] = []
    for q in questions:
        norm = normalize(q)
        # Skip if too similar to something already kept (Jaccard on word sets)
        words = set(norm.split())
        duplicate = False
        for seen in seen_norms:
            seen_words = set(seen.split())
            if not words or not seen_words:
                continue
            jaccard = len(words & seen_words) / len(words | seen_words)
            if jaccard > 0.55:
                duplicate = True
                break
        if not duplicate:
            seen_norms.append(norm)
            unique.append(q)
        if len(unique) >= target:
            break
    return unique


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("Scraping behavioral interview questions...\n")

    all_questions: list[str] = []

    scrapers = [
        scrape_indeed,
        scrape_careersidekick,
        scrape_themuse,
        scrape_interviewbit,
        scrape_builtin,
        scrape_glassdoor,
    ]

    for scraper in scrapers:
        try:
            results = scraper()
            all_questions.extend(results)
        except Exception as e:
            print(f"  [error] {scraper.__name__}: {e}")
        time.sleep(1)   # polite delay between requests

    print(f"\nTotal raw candidates from scraping: {len(all_questions)}")

    # Combine scraped + curated, curated goes last (fills gaps if scraping fails)
    combined = all_questions + CURATED
    top50 = deduplicate(combined, target=50)

    # If we still need more (network failures), pad from curated
    if len(top50) < 50:
        extras = [q for q in CURATED if q not in top50]
        top50 = deduplicate(top50 + extras, target=50)

    print(f"Final unique questions: {len(top50)}\n")

    output = {
        "source": "multi-source scrape + curated (behavioral interview questions, tech jobs)",
        "total": len(top50),
        "questions": [
            {"id": i + 1, "question": q, "category": categorize(q)}
            for i, q in enumerate(top50)
        ],
    }

    out_path = "data/behavioral_questions.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Saved to {out_path}")
    for item in output["questions"]:
        print(f"  {item['id']:>2}. [{item['category']}] {item['question']}")


def categorize(q: str) -> str:
    q_lower = q.lower()
    if any(w in q_lower for w in ["conflict", "disagree", "difficult", "tension"]):
        return "conflict_resolution"
    if any(w in q_lower for w in ["lead", "leadership", "mentor", "coach"]):
        return "leadership"
    if any(w in q_lower for w in ["fail", "mistake", "wrong", "error"]):
        return "failure_and_learning"
    if any(w in q_lower for w in ["deadline", "pressure", "tight", "fast-paced"]):
        return "time_management"
    if any(w in q_lower for w in ["team", "collaborat", "cross-functional", "colleague"]):
        return "teamwork"
    if any(w in q_lower for w in ["achiev", "proud", "success", "accomplish"]):
        return "achievement"
    if any(w in q_lower for w in ["adapt", "change", "ambig", "unknown"]):
        return "adaptability"
    if any(w in q_lower for w in ["communicat", "persuad", "influenc", "present"]):
        return "communication"
    if any(w in q_lower for w in ["problem", "solution", "creat", "innovat", "improv"]):
        return "problem_solving"
    if any(w in q_lower for w in ["priorit", "manag", "organiz", "balanc"]):
        return "prioritization"
    return "general"


if __name__ == "__main__":
    main()
