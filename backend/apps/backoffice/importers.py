"""Import en masse des séries et histoires depuis un fichier Word, Excel ou texte.

Découpage automatique : une nouvelle section commence à chaque ligne du type
« Série 12 », « Série 12 : Titre », « Histoire 3 — Titre », « Chapitre 4 » ou « ## 5. Titre ».
Dans Excel : colonnes numéro, titre, contenu (une ligne par section, en-tête facultatif).
"""
import io
import re
import zipfile
from defusedxml import ElementTree

import openpyxl

HEADING = re.compile(
    r"^\s*(?:#+\s*)?(?:s[ée]rie|histoire|chapitre|papo)?\s*n?°?\s*(\d{1,4})\s*(?:[.:)\-–—]\s*(.*))?$",
    re.IGNORECASE,
)
STRICT_HEADING = re.compile(r"^\s*(?:#+\s*)?(?:s[ée]rie|histoire|chapitre|papo)\s*n?°?\s*\d", re.IGNORECASE)
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_paragraphs(data: bytes) -> list[str]:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = ElementTree.fromstring(z.read("word/document.xml"))
    paras = []
    for p in root.iter(f"{W_NS}p"):
        paras.append("".join(t.text or "" for t in p.iter(f"{W_NS}t")))
    return paras


def split_sections(lines: list[str]) -> list[dict]:
    """Regroupe les paragraphes en sections à partir des intertitres numérotés."""
    use_strict = any(STRICT_HEADING.match(line) for line in lines)
    sections, current = [], None
    for raw in lines:
        line = raw.rstrip()
        is_heading = (STRICT_HEADING.match(line) if use_strict else re.match(r"^\s*#+\s*\d", line)) and HEADING.match(line)
        if is_heading:
            m = HEADING.match(line)
            current = {"number": int(m.group(1)), "title": (m.group(2) or "").strip(), "paras": []}
            sections.append(current)
        elif current is not None:
            current["paras"].append(line.strip())
    out = []
    for s in sections:
        # Paragraphes séparés par une ligne vide ; on retire les vides consécutifs.
        text = re.sub(r"\n{3,}", "\n\n", "\n\n".join(p for p in s["paras"]).strip())
        out.append({"number": s["number"], "title": s["title"], "content": text})
    return out


def xlsx_sections(data: bytes) -> list[dict]:
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.active
    out = []
    for row in ws.iter_rows(values_only=True):
        if not row or row[0] is None:
            continue
        try:
            number = int(row[0])
        except (TypeError, ValueError):
            continue  # ligne d'en-tête
        title = str(row[1] or "").strip() if len(row) > 1 else ""
        content = str(row[2] or "").strip() if len(row) > 2 else ""
        out.append({"number": number, "title": title, "content": content})
    return out


def parse_upload(name: str, data: bytes) -> list[dict]:
    lower = name.lower()
    if lower.endswith(".docx"):
        return split_sections(docx_paragraphs(data))
    if lower.endswith(".xlsx"):
        return xlsx_sections(data)
    if lower.endswith((".txt", ".md")):
        return split_sections(data.decode("utf-8", errors="replace").splitlines())
    raise ValueError("Format accepté : .docx, .xlsx, .txt ou .md")
