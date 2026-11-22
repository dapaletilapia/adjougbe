"""Page contact masquée : le texte « À propos » ne renvoie plus vers /contact mais vers le bouton « Inviter Adjougbe ».

Ne touche le texte que s'il contient encore la phrase d'origine (un texte réécrit dans le Studio reste intact).
"""
from django.db import migrations

OLD = '<p>Pour une interview, une conférence, une dédicace ou une formation en entreprise, écrivez-nous depuis la page <a href="/contact">Contact</a>. Réponse sous 48 heures, du lundi au vendredi.</p>'
NEW = '<p>Pour une interview, une conférence, une dédicace ou une formation en entreprise, utilisez le bouton « Inviter Adjougbe » ci-dessous. Réponse sous 48 heures, du lundi au vendredi.</p>'


def update(apps, schema_editor):
    Settings = apps.get_model("core", "SiteSettings")
    for s in Settings.objects.all():
        if OLD in s.about_html:
            s.about_html = s.about_html.replace(OLD, NEW)
            s.save(update_fields=["about_html"])


class Migration(migrations.Migration):
    dependencies = [("core", "0005_default_expertise")]
    operations = [migrations.RunPython(update, migrations.RunPython.noop)]
