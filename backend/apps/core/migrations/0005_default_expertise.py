"""Domaines d'intervention proposés, créés une seule fois : une suppression dans le Studio reste définitive."""
from django.db import migrations


def create_defaults(apps, schema_editor):
    from apps.core.content_fr import EXPERTISE
    Area = apps.get_model("core", "ExpertiseArea")
    if not Area.objects.exists():
        Area.objects.bulk_create(Area(title=t, description=d, icon=i, position=n) for n, (t, d, i) in enumerate(EXPERTISE))


class Migration(migrations.Migration):
    dependencies = [("core", "0004_expertisearea")]
    operations = [migrations.RunPython(create_defaults, migrations.RunPython.noop)]
