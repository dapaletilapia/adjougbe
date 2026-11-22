# Données des tests de bout en bout, chargées par e2e/run.sh après seed_demo (base jetable).
import os
from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import User
from apps.trainings.models import Training, TrainingSession

# Studio : double authentification déjà configurée, avec le secret tiré au hasard par run.sh.
admin = User.objects.get(email="admin@adjougbe.local")
admin.otp_secret = os.environ["E2E_OTP_SECRET"]
admin.otp_enabled = True
admin.save(update_fields=["otp_secret", "otp_enabled"])

# Formation d'une organisation partenaire : inscription sur son formulaire.
t, _ = Training.objects.update_or_create(slug="forum-leadership-e2e", defaults=dict(
    title="Forum du leadership", theme="Leadership", format="onsite", is_published=True,
    summary="Conférence d'Adjougbe au Forum du leadership.", author_role="speaker",
    organizer="Institut Partenaire", registration_mode="external",
    external_registration_url="https://exemple.org/inscription-forum", price_xof=10000))
if not t.sessions.exists():
    start = timezone.now() + timedelta(days=9)
    TrainingSession.objects.create(training=t, starts_at=start, ends_at=start + timedelta(hours=3),
                                   location="Plateau, Abidjan")
print("seed e2e ok")
