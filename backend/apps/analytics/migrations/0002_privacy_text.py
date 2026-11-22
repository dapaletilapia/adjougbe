"""Politique de confidentialité : remplace la note « à mettre à jour » par la description de la mesure d'audience.

Ne touche le texte que s'il contient encore la phrase d'origine (un texte réécrit dans le Studio reste intact).
"""
from django.db import migrations

OLD = "<p>Le Site utilise uniquement les cookies nécessaires à son fonctionnement (session de connexion, sécurité). [Mettre à jour si des outils de mesure d'audience sont ajoutés.]</p>"
NEW = "<p>Le Site utilise uniquement les cookies nécessaires à son fonctionnement (session de connexion, sécurité).</p>\n<p>Pour connaître sa fréquentation, le Site utilise une mesure d'audience interne, sans cookie et sans outil tiers : il compte les pages vues, la provenance (par exemple WhatsApp ou un moteur de recherche) et le type d'appareil. Votre adresse IP n'est jamais enregistrée ; elle sert seulement, le jour même, à calculer une empreinte anonyme qui change chaque jour. Les statistiques produites sont des totaux qui ne permettent pas de vous identifier. Si votre navigateur envoie le signal « Do Not Track », aucune mesure n'est faite.</p>"


def update(apps, schema_editor):
    Settings = apps.get_model("core", "SiteSettings")
    for s in Settings.objects.all():
        if OLD in s.privacy_html:
            s.privacy_html = s.privacy_html.replace(OLD, NEW)
            s.save(update_fields=["privacy_html"])


class Migration(migrations.Migration):
    dependencies = [("analytics", "0001_initial"), ("core", "0005_default_expertise")]
    operations = [migrations.RunPython(update, migrations.RunPython.noop)]
