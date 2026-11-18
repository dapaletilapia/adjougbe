"""Reçu de commande en PDF (maquette 13g), généré à la demande."""
import io

from django.utils import timezone
from PIL import Image, ImageDraw

from apps.reader.rendering import font

INK, MUTED, BLUE, ORANGE = (14, 15, 19), (107, 110, 120), (47, 104, 183), (255, 107, 41)


def receipt_pdf(order) -> bytes:
    w, h = 1240, 1754  # A4 portrait à 150 dpi
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 14], fill=BLUE)
    x = 120
    d.text((x, 110), "Adjougbe", font=font("sans", 54), fill=BLUE)
    d.text((x, 175), "POSSUMUS", font=font("sans", 22), fill=ORANGE)
    lbl = "REÇU"
    d.text((w - x - font("sans", 26).getlength(lbl), 130), lbl, font=font("sans", 26), fill=MUTED)
    paid = timezone.localtime(order.paid_at or order.created_at)
    d.text((x, 300), f"{order.total:,} FCFA".replace(",", " "), font=font("sans", 72), fill=INK)
    d.text((x, 395), f"Payé le {paid:%d/%m/%Y à %H:%M} · {order.get_payment_method_display()}", font=font("serif", 30), fill=MUTED)

    def dashed(y):
        for xx in range(x, w - x, 24):
            d.line([(xx, y), (xx + 12, y)], fill=(225, 227, 232), width=3)

    dashed(480)
    rows = [("Commande", order.reference), ("Client", order.user.full_name), ("E-mail", order.user.email)]
    rows += [("Article", f"{i.label} — {i.line_total:,} F".replace(",", " ")) for i in order.items.all()]
    if order.discount:
        rows.append(("Remise", f"− {order.discount:,} F".replace(",", " ")))
    if order.provider_reference:
        rows.append(("Référence opérateur", order.provider_reference))
    rows.append(("Statut", order.get_status_display()))
    y = 530
    f = font("sans", 28)
    for k, v in rows:
        d.text((x, y), k, font=font("serif", 28), fill=MUTED)
        v = v if f.getlength(v) < 640 else v[:48] + "…"
        d.text((w - x - f.getlength(v), y), v, font=f, fill=INK)
        y += 62
    dashed(y + 20)
    d.text((x, y + 70), "Vos œuvres se lisent en ligne depuis votre bibliothèque : aucun fichier n'est joint.",
           font=font("serif", 24), fill=MUTED)
    d.text((x, h - 140), "Adjougbe · Abidjan, Côte d'Ivoire · Paiements sécurisés en FCFA", font=font("sans", 22), fill=MUTED)
    buf = io.BytesIO()
    img.save(buf, "PDF", resolution=150)
    return buf.getvalue()
