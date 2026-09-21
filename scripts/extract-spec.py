"""Convert the PVI CAP spec docx into the question CSV used by seed.

Confidential source. Do not print question text. Counts only.
"""

from __future__ import annotations

import csv
import re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SRC_XML = Path(r"d:\pvi\pvi-cap\.tmp-docx\word\document.xml")
OUT_CSV = Path(r"d:\pvi\pvi-cap\data\pvi-cap-questions.csv")

SCALE_HDMA = "3 — Independent|2 — With Prompt|1 — Needs Support|0 — Not Applicable"
SCALE_III = "3 — Frequently chooses independently|2 — Sometimes chooses independently|1 — Rarely chooses (only with prompting)|0 — Never chooses / avoids"
SCALE_CALP = "3 — Independent|2 — With Prompts|1 — Needs Support|0 — Not Applicable"
SCALE_FSIC = "3 — Independent|2 — With Prompt|1 — Needs Support|0 — Not Applicable"
SCALE_BWRS = "3 — Consistent|2 — Emerging|1 — Needs support|0 — Not yet"
SCALE_FREQ5 = "5 — Always|4 — Often|3 — Sometimes|2 — Rarely|1 — Never"
SCALE_COMFORT = "5 — Very Comfortable|4 — Comfortable|3 — Neutral|2 — Uncomfortable|1 — Very Uncomfortable"
SCALE_ENJOY = "5 — Enjoys a lot|4 — Enjoys|3 — Neutral|2 — Slightly enjoys|1 — Does not enjoy"
SCALE_CONF = "5 — Very confident|4 — Confident|3 — Neutral|2 — Slightly confident|1 — Not confident"

SKIP_EXACT = {
    "instructions",
    "instruction",
    "scoring",
    "rating scale",
    "rating options",
    "guidance for parents, caregivers, teachers, and professionals",
    "consent statement (mandatory checkbox)",
    "please read carefully before proceeding:",
    "the information collected through this assessment will be used to:",
}

SKIP_PREFIX = (
    "tool –",
    "welcome to the pvi",
    "thank you for participating",
    "unlike traditional",
    "your responses will remain",
    "the assessment may take",
    "we appreciate your time",
    "there are no right",
    "most questions can be answered",
    "this document is used",
    "fill in the scores",
    "evaluates developmental",
    "includes communication",
    "the interest identification",
    "the cognitive ability",
    "the functional skills",
    "the bwrs",
    "the goal of fsic",
    "guidelines for completing",
    "base your responses",
    "base your ratings",
    "rate the learner",
    "if the learner",
    "if you are unsure",
    "consider the learner",
    "consider how they",
    "consider activities",
    "consider whether",
    "answer each question",
    "focus on what",
    "do not base",
    "honest and accurate",
    "be honest",
    "avoid comparing",
    "think about how",
    "please approach",
    "assess actual",
    "remember that independence",
    "when completing",
    "keep this question",
    "remember, a low score",
    "your observations",
    "scoring interpretation",
    "the total score",
    "future career foundation",
    "career relevance",
    "what the learner is naturally",
    "what kind of work",
    "where the learner performs",
    "how the learner learns",
    "a learner may enjoy",
    "for each activity, rate",
    "the environmental preference",
    "i. multiple intelligence",
    "ii. vakt",
    "iii. work preference",
    "iv. environmental",
    "section c – top five",
    "section c - top five",
    "rank the learner",
    "identify developmental",
    "understand personal",
    "assess functional",
    "determine cognitive",
    "map suitable",
    "develop individualized",
    "1. purpose",
    "2. not a medical",
    "3. recommendations",
    "4. accuracy",
    "5. confidentiality",
    "6. intellectual",
    "7. no guarantee",
    "8. voluntary",
)

STAGE_PATTERNS = [
    (re.compile(r"early childhood", re.I), "EARLY_CHILDHOOD"),
    (re.compile(r"pre[-\s]?skill", re.I), "PRE_SKILL"),
    (re.compile(r"basic( skill| stage)?", re.I), "BASIC"),
    (re.compile(r"intermediate", re.I), "INTERMEDIATE"),
    (re.compile(r"advanced", re.I), "ADVANCED"),
]

TOOL_PATTERNS = [
    (re.compile(r"HDMA|Holistic Development Milestone", re.I), "HDMA"),
    (re.compile(r"Interest Identification|Tool\s*[–-]?\s*2\s*III|2III", re.I), "III"),
    (re.compile(r"CALP|Cognitive Ability & Learning", re.I), "CALP"),
    (re.compile(r"FSIC|Functional Skills & Independence", re.I), "FSIC"),
    (re.compile(r"BWRS|Behavioural & Workplace Readiness", re.I), "BWRS"),
    (re.compile(r"VLAP|Vocational Learning & Aptitude", re.I), "VLAP"),
]


def texts(el: ET.Element) -> str:
    return "".join((t.text or "") for t in el.iter(f"{W}t"))


def clean(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u2013", "-").replace("\u2014", "-")
    return re.sub(r"\s+", " ", value).strip()


def table_rows(tbl: ET.Element) -> list[list[str]]:
    rows: list[list[str]] = []
    for tr in tbl.findall(f"{W}tr"):
        cells = [clean(texts(tc)) for tc in tr.findall(f"{W}tc")]
        if any(cells):
            rows.append(cells)
    return rows


def is_stage_header(text: str) -> str | None:
    if len(text) > 90:
        return None
    if not re.search(r"stage|years|checklist|0-6|0–6|6-10|11-15|16-20|21", text, re.I):
        if not re.match(r"^(Early Childhood|Pre-Skill|Basic|Intermediate|Advanced)\b", text, re.I):
            return None
    for pattern, stage in STAGE_PATTERNS:
        if pattern.search(text):
            return stage
    return None


def is_tool_header(text: str) -> str | None:
    if "Tool" not in text and "TOOL" not in text:
        return None
    for pattern, code in TOOL_PATTERNS:
        if pattern.search(text):
            return code
    return None


def is_section_header(text: str) -> bool:
    if 3 <= len(text) <= 90 and re.match(r"^\d{1,2}[\.)]\s+\S", text):
        return True
    if re.match(r"^section\s+[a-d]\b", text, re.I):
        return True
    titled = (
        "Communication Skills",
        "Mathematical Skills",
        "Functional Academics",
        "Computer Skills",
        "Activities of Daily Living",
        "Personality Development",
        "Sex Education",
        "Self-Advocacy",
        "Safety",
        "Financial Literacy",
        "Soft Skills",
        "Physical Fitness",
        "Vocational Exposure",
        "Independent Living",
        "Creative Interests",
        "Construction",
        "Household Activities",
        "Nature & Animals",
        "Technology",
        "Social Interests",
        "Pretend Occupations",
        "Sensory Interests",
        "Environmental Preferences",
        "Attention & Engagement",
        "Early Vocational Indicators",
        "Verbal-Linguistic",
        "Logical-Mathematical",
        "Visual-Spatial",
        "Bodily-Kinesthetic",
        "Musical",
        "Interpersonal",
        "Intrapersonal",
        "Naturalistic",
        "Emotional Intelligence",
        "Visual Learning",
        "Auditory Learning",
        "Kinesthetic",
        "Tactile",
        "Personal Hygiene",
        "Oral Hygiene",
        "Toileting",
        "Bathing",
        "Dressing",
        "Eating",
        "Emotional Regulation",
        "Social Communication",
        "Instruction Following",
        "Peer Interaction",
        "Multiple Intelligence",
        "VAKT Learning",
        "Work Preference",
        "Environmental Preference",
        "Parent/Caregiver",
        "Standardized Behavioural Interest",
        "Top Five Interests",
        "Emerging Vocational",
        "Career Readiness",
        "Vocational Readiness",
    )
    return any(text.lower().startswith(t.lower()) or t.lower() in text.lower() for t in titled) and len(text) <= 100


def skip_text(text: str) -> bool:
    low = text.lower().strip()
    if low in SKIP_EXACT:
        return True
    if any(low.startswith(p) for p in SKIP_PREFIX):
        return True
    if low.startswith("0 =") or low.startswith("1 =") or low.startswith("2 =") or low.startswith("3 ="):
        return True
    if re.match(r"^[0-5]\s*[–-]\s*(never|rarely|sometimes|often|always|independent|with prompt)", low):
        return True
    if "highly developed" in low or "highly preferred" in low:
        return True
    if low.startswith("independent (") or low.startswith("with prompts") or low.startswith("needs support"):
        return True
    if "not applicable (n/a)" in low:
        return True
    return False


def looks_like_item(text: str) -> bool:
    t = text.strip()
    if len(t) < 12 or len(t) > 420:
        return False
    if skip_text(t):
        return False
    if is_section_header(t) and not t.endswith("?"):
        return False
    if is_stage_header(t) or is_tool_header(t):
        return False
    if t.endswith("?"):
        return True
    if re.match(r"^(does|can|is|are|has|have|do |what |which |where |when |who |how |if |please |describe |list )", t, re.I):
        return True
    if re.match(
        r"^(enjoys|prefers|pretends|returns|stays|completes|shows|washes|uses|retrieves|applies|brushes|"
        r"recognizes|communicates|walks|pulls|sits|wipes|flushes|identifies|expresses|recovers|accepts|"
        r"waits|seeks|greets|responds|maintains|requests|listens|takes|introduces|follows|stops|"
        r"participates|shares|invites|comforts|learns|remembers|notices|understands|organizes|builds|"
        r"imagines|creates|thinks|asks|likes|explains|helps|makes|resolves|motivates|adjusts|"
        r"demonstrates|sets|handles|controls|observes|classifies|cares|pays|talks|benefits|"
        r"understands|feels|covers|dries|blows|disposes|rinses|stores|continues)",
        t,
        re.I,
    ):
        return True
    # statement items (FSIC / BWRS / VLAP)
    if 18 <= len(t) <= 220 and t[0].isupper() and t.endswith("."):
        return True
    return False


def section_title(raw: str) -> str:
    t = re.sub(r"^\d{1,2}[\.)]\s+", "", raw).strip()
    t = re.sub(r"^section\s+[a-d]\s*[–-]\s*", "", t, flags=re.I)
    t = re.sub(r"\s*\(.*?\)\s*$", "", t).strip()
    return t[:80] or "General"


def default_scale(tool: str, section: str) -> tuple[str, str, str]:
    sec = section.lower()
    if tool == "III" and ("interview" in sec or "qualitative" in sec or "top five" in sec or "vocational indicator" in sec or "career" in sec):
        return "FREE_TEXT", "", "true"
    if tool == "III":
        return "SCALE", SCALE_III, "false"
    if tool == "HDMA":
        return "SCALE", SCALE_HDMA, "false"
    if tool == "CALP":
        return "SCALE", SCALE_CALP, "false"
    if tool == "FSIC":
        return "SCALE", SCALE_FSIC, "false"
    if tool == "BWRS":
        return "SCALE", SCALE_BWRS, "false"
    if "environmental" in sec or "comfort" in sec:
        return "SCALE", SCALE_COMFORT, "false"
    if "enjoyment" in sec:
        return "SCALE", SCALE_ENJOY, "false"
    if "confidence" in sec:
        return "SCALE", SCALE_CONF, "false"
    return "SCALE", SCALE_FREQ5, "false"


def split_bullets(text: str) -> list[str]:
    if "•" not in text:
        return [text]
    parts = [clean(p) for p in re.split(r"•", text)]
    return [p for p in parts if looks_like_item(p)]


class Bank:
    def __init__(self) -> None:
        self.rows: list[dict[str, str]] = []
        self.tool = ""
        self.stage = ""
        self.section = "General"
        self.seq: Counter[str] = Counter()

    def add(self, prompt: str, *, tool: str | None = None, section: str | None = None, qtype: str | None = None, options: str | None = None, qualitative: str | None = None) -> None:
        tool = tool or self.tool
        if not tool:
            return
        if tool != "VLAP" and not self.stage:
            return
        section = section or self.section
        if qtype is None:
            qtype, options, qualitative = default_scale(tool, section)
        self.seq[tool] += 1
        self.rows.append(
            {
                "toolCode": tool,
                "sectionTitle": section[:80],
                "indicatorCode": f"{tool}-{self.seq[tool]:04d}",
                "prompt": prompt,
                "type": qtype,
                "options": options or "",
                "stages": "" if tool in {"VLAP"} else self.stage,
                "isQualitative": qualitative or "false",
            }
        )


def extract_tables(rows: list[list[str]], bank: Bank) -> None:
    if not rows:
        return
    header = [c.lower() for c in rows[0]]
    joined = " | ".join(header)
    if header and header[0] == "score":
        return
    question_col = None
    for name in ("assessment question", "skill description"):
        if name in header:
            question_col = header.index(name)
            break
    subdomain_col = header.index("cognitive subdomain") if "cognitive subdomain" in header else None
    if question_col is not None:
        current_domain = bank.section
        for row in rows[1:]:
            if subdomain_col is not None and subdomain_col < len(row) and row[subdomain_col]:
                current_domain = row[subdomain_col]
            prompt = row[question_col] if question_col < len(row) else ""
            if looks_like_item(prompt):
                qtype, options, qualitative = default_scale(bank.tool or "CALP", current_domain)
                bank.add(prompt, section=current_domain, qtype=qtype, options=options, qualitative=qualitative)
        return
    if "activity" in header and ("enjoyment" in joined or "confidence" in joined):
        act_col = header.index("activity")
        for row in rows[1:]:
            activity = row[act_col] if act_col < len(row) else ""
            if len(activity) < 3:
                continue
            bank.add(
                f"How much does the learner enjoy: {activity}?",
                section="Work Preference - Enjoyment",
                qtype="SCALE",
                options=SCALE_ENJOY,
                qualitative="false",
            )
            bank.add(
                f"How confident is the learner with: {activity}?",
                section="Work Preference - Confidence",
                qtype="SCALE",
                options=SCALE_CONF,
                qualitative="false",
            )
        return
    if ("environment" in header or "preference" in header) and "comfort" in joined:
        label_col = 0
        for row in rows[1:]:
            label = row[label_col] if row else ""
            if looks_like_item(label) or (4 <= len(label) <= 80):
                bank.add(
                    f"How comfortable is the learner in this setting: {label}?",
                    section="Environmental Preference",
                    qtype="SCALE",
                    options=SCALE_COMFORT,
                    qualitative="false",
                )
        return
    if "motivation" in joined:
        label_col = 0
        for row in rows[1:]:
            label = row[label_col] if row else ""
            if 4 <= len(label) <= 120:
                bank.add(
                    f"Rate this motivation factor: {label}",
                    section="Motivation",
                    qtype="SCALE",
                    options=SCALE_FREQ5,
                    qualitative="false",
                )


def main() -> None:
    root = ET.parse(SRC_XML).getroot()
    body = root.find(f"{W}body")
    assert body is not None
    sdt = body.find(f"{W}sdt")
    container = sdt.find(f"{W}sdtContent") if sdt is not None else body
    assert container is not None

    bank = Bank()

    def walk(el: ET.Element) -> None:
        for child in list(el):
            tag = child.tag
            if tag == f"{W}p":
                text = clean(texts(child))
                if not text:
                    continue
                tool = is_tool_header(text)
                if tool:
                    bank.tool = tool
                    bank.stage = ""
                    bank.section = "General"
                    continue
                stage = is_stage_header(text)
                if stage:
                    bank.stage = stage
                    continue
                if skip_text(text):
                    continue
                if is_section_header(text) and not text.endswith("?"):
                    bank.section = section_title(text)
                    if "top five" in text.lower():
                        bank.add(
                            "List the learner's top five interests, in order.",
                            qtype="FREE_TEXT",
                            options="",
                            qualitative="true",
                        )
                    continue
                for piece in split_bullets(text):
                    if looks_like_item(piece):
                        bank.add(piece)
            elif tag == f"{W}tbl":
                extract_tables(table_rows(child), bank)
            else:
                walk(child)

    walk(container)

    OUT_CSV.parent.mkdir(exist_ok=True)
    fields = ["toolCode", "sectionTitle", "indicatorCode", "prompt", "type", "options", "stages", "isQualitative"]
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(bank.rows)

    counts: Counter[str] = Counter()
    stage_counts: Counter[str] = Counter()
    for row in bank.rows:
        counts[row["toolCode"]] += 1
        stage_counts[f"{row['toolCode']}:{row['stages'] or 'ALL'}"] += 1
    print(f"csv={OUT_CSV} total={len(bank.rows)}")
    for code, n in counts.most_common():
        print(f"  {code} {n}")
    print("by_stage")
    for key, n in sorted(stage_counts.items()):
        print(f"  {key} {n}")


if __name__ == "__main__":
    main()
