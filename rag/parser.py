import pdfplumber
import re

SECTION_KEYWORDS = [
    "skills", "technical skills", "core competencies", "technologies",
    "projects", "personal projects", "academic projects", "notable projects",
    "experience", "work experience", "professional experience", "internship", "internships",
    "education", "academic background",
    "certifications", "awards", "achievements", "honors",
    "summary", "objective", "about me", "profile",
    "publications", "research", "volunteer", "activities",
]


def extract_text(file_path: str) -> str:
    with pdfplumber.open(file_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages)


def detect_sections(text: str) -> dict:
    lines = text.split("\n")
    sections = {}
    current_section = "general"
    current_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        lower = stripped.lower().rstrip(":").strip()
        is_header = (
            lower in SECTION_KEYWORDS
            or any(lower.startswith(k) for k in SECTION_KEYWORDS)
            or (stripped.isupper() and 2 < len(stripped.split()) <= 5)
        )

        if is_header:
            if current_lines:
                sections[current_section] = "\n".join(current_lines)
            current_section = lower
            current_lines = []
        else:
            current_lines.append(stripped)

    if current_lines:
        sections[current_section] = "\n".join(current_lines)

    return sections


def chunk_section(section: str, content: str, max_chars: int = 400) -> list[dict]:
    # Split on bullet points, newlines, or sentence boundaries
    parts = [p.strip() for p in re.split(r"\n+|[•▪‣◦]", content) if p.strip()]

    chunks = []
    current = []
    current_len = 0

    for part in parts:
        if current_len + len(part) > max_chars and current:
            chunks.append({"section": section, "text": " ".join(current)})
            current = [part]
            current_len = len(part)
        else:
            current.append(part)
            current_len += len(part)

    if current:
        chunks.append({"section": section, "text": " ".join(current)})

    return chunks


def parse_resume(file_path: str) -> list[dict]:
    text = extract_text(file_path)
    if not text.strip():
        return []

    sections = detect_sections(text)
    all_chunks = []
    for section, content in sections.items():
        all_chunks.extend(chunk_section(section, content))

    return all_chunks
