"""Rendu des pages protégées en images, avec filigrane nominatif.

Le texte n'est jamais envoyé au navigateur : chaque page est une image générée à la demande.
Format du contenu source :
  - paragraphes séparés par une ligne vide ;
  - « # Titre » pour un intertitre ;
  - « > texte » pour une punchline mise en avant.
"""
import io
import math
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path(settings.BASE_DIR) / "assets" / "fonts"

PAGE_W, PAGE_H = 900, 1300
MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM = 80, 110, 120
SIZES = {"s": 30, "m": 36, "l": 44, "xl": 52}
THEMES = {
    "light": {"bg": (255, 255, 255), "fg": (14, 15, 19), "muted": (107, 110, 120), "accent": (47, 104, 183)},
    "sepia": {"bg": (246, 236, 216), "fg": (58, 42, 26), "muted": (128, 104, 80), "accent": (196, 84, 20)},
    "dark": {"bg": (14, 15, 19), "fg": (232, 234, 240), "muted": (154, 157, 166), "accent": (255, 107, 41)},
}


@lru_cache(maxsize=32)
def font(kind: str, size: int):
    files = {"serif": "SourceSerif4.ttf", "italic": "SourceSerif4-Italic.ttf", "sans": "Poppins-SemiBold.ttf"}
    path = FONT_DIR / files[kind]
    try:
        f = ImageFont.truetype(str(path), size)
        try:
            f.set_variation_by_name({"serif": "Regular", "italic": "Italic", "sans": "SemiBold"}[kind])
        except Exception:  # police non variable ou nom absent : on garde le style par défaut
            pass
        return f
    except OSError:
        return ImageFont.load_default(size=size)


def _wrap(text: str, fnt, max_width: int) -> list[str]:
    words, lines, current = text.split(), [], ""
    for w in words:
        trial = f"{current} {w}".strip()
        if fnt.getlength(trial) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines or [""]


def layout(title: str, content: str, size_key: str) -> list[list[tuple]]:  # noqa: C901
    """Découpe le texte en pages. Chaque ligne : (style, texte, hauteur)."""
    base = SIZES.get(size_key, SIZES["m"])
    max_w = PAGE_W - 2 * MARGIN_X
    usable = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM
    blocks: list[tuple] = [("title", title)] if title else []
    for para in [p.strip() for p in content.replace("\r\n", "\n").split("\n\n") if p.strip()]:
        if para.startswith("# "):
            blocks.append(("heading", para[2:].strip()))
        elif para.startswith("> "):
            q = " ".join(line.lstrip("> ").strip() for line in para.splitlines())
            blocks.append(("quote", q if q.startswith("«") else f"« {q} »"))
        else:
            blocks.append(("body", " ".join(para.splitlines())))

    styles = {
        "title": ("sans", int(base * 1.25), 1.3, base * 1.2),
        "heading": ("sans", int(base * 0.95), 1.35, base * 0.6),
        "quote": ("sans", int(base * 1.0), 1.45, base * 0.5),
        "body": ("serif", base, 1.5, base * 0.7),
    }
    pages, page, y = [], [], 0.0
    for style, text in blocks:
        fam, fsize, lh, gap = styles[style]
        fnt = font(fam, fsize)
        indent = 0
        for line in _wrap(text, fnt, max_w - indent):
            h = fsize * lh
            if y + h > usable and page:
                pages.append(page)
                page, y = [], 0.0
            page.append((style, line, h, fam, fsize, indent))
            y += h
        if page:
            page.append(("gap", "", gap, fam, fsize, 0))
            y += gap
            if style == "quote":
                page.append(("divider", "", base * 1.0, fam, fsize, 0))
                y += base * 1.0
    if page:
        pages.append(page)
    return pages or [[]]


def paginate(section, size_key: str) -> list:
    key = f"reader:layout:{section.pk}:{section.edition}:{section.updated_at.timestamp()}:{size_key}"
    pages = cache.get(key)
    if pages is None:
        # L'en-tête de page affiche déjà « SÉRIE 01 » : on n'ajoute un titre que s'il est réel.
        pages = layout(section.title or "", section.content, size_key)
        cache.set(key, pages, 60 * 60)
    return pages


def render_page(section, page_index: int, size_key: str, theme_key: str, watermark: str, footer) -> bytes:
    pages = paginate(section, size_key)
    page_index = max(0, min(page_index, len(pages) - 1))
    th = THEMES.get(theme_key, THEMES["light"])
    img = Image.new("RGB", (PAGE_W, PAGE_H), th["bg"])
    draw = ImageDraw.Draw(img)

    # En-tête : « SÉRIE 47 » à gauche, « PAGE 3 / 6 » à droite (maquette 14a).
    head = font("sans", 20)
    unit = "SÉRIE" if section.work.kind == "punchlines" else "HISTOIRE"
    left = f"{unit} {section.number:02d}"
    num = f"PAGE {page_index + 1} / {len(pages)}"
    draw.text((MARGIN_X, 52), left, font=head, fill=th["muted"])
    draw.text((PAGE_W - MARGIN_X - head.getlength(num), 52), num, font=head, fill=th["muted"])

    y = MARGIN_TOP
    for style, text, h, fam, fsize, indent in pages[page_index]:
        if style == "gap":
            y += h
            continue
        if style == "divider":
            draw.rounded_rectangle([MARGIN_X, y, MARGIN_X + 44, y + 4], radius=2, fill=(255, 107, 41))
            y += h
            continue
        color = th["accent"] if style in ("title", "heading") else th["fg"]
        draw.text((MARGIN_X + indent, y), text, font=font(fam, fsize), fill=color)
        y += h

    _apply_watermark(img, watermark, th)
    # Pied de page nominatif : lecteur à gauche, référence de commande à droite (maquette 14a).
    foot = font("sans", 18)
    draw = ImageDraw.Draw(img)
    left, right = footer if isinstance(footer, tuple) else (footer, "")
    while foot.getlength(left) > PAGE_W - 2 * MARGIN_X - foot.getlength(right) - 30 and len(left) > 10:
        left = left[:-2]
    draw.text((MARGIN_X, PAGE_H - 70), left, font=foot, fill=th["muted"])
    if right:
        draw.text((PAGE_W - MARGIN_X - foot.getlength(right), PAGE_H - 70), right, font=foot, fill=th["muted"])

    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=82, method=4)
    return buf.getvalue()


def _apply_watermark(img: Image.Image, text: str, th: dict):
    """Filigrane diagonal répété, visible mais n'empêchant pas la lecture."""
    layer = Image.new("RGBA", (PAGE_W * 2, PAGE_H * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font("sans", 26)
    r, g, b = (21, 96, 220) if th["bg"][0] > 200 else th["fg"]
    step_x = int(f.getlength(text)) + 120
    for row, yy in enumerate(range(0, PAGE_H * 2, 170)):
        offset = (row % 2) * step_x // 2
        for xx in range(-step_x, PAGE_W * 2, step_x):
            d.text((xx + offset, yy), text, font=f, fill=(r, g, b, 30))
    layer = layer.rotate(math.degrees(math.atan(PAGE_H / PAGE_W)) - 20, resample=Image.BICUBIC)
    left, top = (layer.width - PAGE_W) // 2, (layer.height - PAGE_H) // 2
    img.paste(layer.crop((left, top, left + PAGE_W, top + PAGE_H)), (0, 0), layer.crop((left, top, left + PAGE_W, top + PAGE_H)))


def render_quote_card(text: str, signature: str = "Adjougbe", site: str = "adjougbe.ci", fmt: str = "square") -> bytes:
    """Visuel de citation partageable (WhatsApp, Instagram, TikTok)."""
    w, h = (1080, 1920) if fmt == "story" else (1080, 1080)
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    top, bottom = (4, 28, 92), (21, 96, 220)  # #041C5C -> #1560DC
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    d.rectangle([0, h - 18, w, h], fill=(255, 107, 41))
    size = 64 if len(text) < 120 else 52 if len(text) < 220 else 42
    f = font("italic", size)
    lines = _wrap(text, f, w - 200)
    total = len(lines) * size * 1.4
    y = (h - total) / 2 - 40
    d.text((96, y - size * 2.6), "«", font=font("serif", size * 2), fill=(255, 107, 41))
    for line in lines:
        d.text((100, y), line, font=f, fill=(250, 246, 238))
        y += size * 1.4
    d.text((100, y + 40), f"— {signature}", font=font("sans", 36), fill=(255, 107, 41))
    foot = font("sans", 30)
    d.text((w - 100 - foot.getlength(site), h - 90), site, font=foot, fill=(200, 214, 240))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()
