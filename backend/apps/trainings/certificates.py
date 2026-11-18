"""Attestation de participation en PDF, avec code vérifiable publiquement."""
import io

from django.utils import timezone
from PIL import Image, ImageDraw

from apps.core.emails import front
from apps.reader.rendering import font


def certificate_pdf(enrollment) -> bytes:
    w, h = 1754, 1240  # A4 paysage à 150 dpi
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, w - 40, h - 40], outline=(255, 107, 41), width=6)
    d.rectangle([60, 60, w - 60, h - 60], outline=(47, 104, 183), width=2)

    def center(text, y, f, fill=(14, 15, 19)):
        d.text(((w - f.getlength(text)) / 2, y), text, font=f, fill=fill)

    s = enrollment.session
    center("ATTESTATION DE PARTICIPATION", 190, font("sans", 54), (255, 107, 41))
    center("Nous attestons que", 340, font("serif", 40))
    center(enrollment.user.full_name, 420, font("sans", 76))
    center("a participé à la formation", 560, font("serif", 40))
    center(s.training.title, 630, font("sans", 56), (47, 104, 183))
    center(f"le {timezone.localtime(s.starts_at):%d/%m/%Y} — {s.training.get_format_display()}", 730, font("serif", 36))
    center(f"Formateur : {s.training.trainer}", 800, font("serif", 34))
    code = enrollment.issue_certificate()
    center(f"Code de vérification : {code}", 960, font("sans", 30), (120, 113, 104))
    center(front(f"/attestation/{code}"), 1010, font("sans", 26), (120, 113, 104))
    center("Adjougbe — Possumus", 1090, font("italic", 32), (255, 107, 41))
    buf = io.BytesIO()
    img.save(buf, "PDF", resolution=150)
    return buf.getvalue()
