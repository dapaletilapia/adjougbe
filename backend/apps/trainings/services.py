from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.emails import front, send

from .models import Enrollment, TrainingSession


def _details(enr: Enrollment) -> str:
    s = enr.session
    where = s.location or "En ligne"
    link = f"\nLien de connexion : {s.meeting_link}" if s.meeting_link else ""
    return (f"{s.training.title}\nDate : {timezone.localtime(s.starts_at):%d/%m/%Y à %H:%M}\n"
            f"Lieu : {where}{link}")


def send_enrollment_confirmation(enr: Enrollment):
    send(enr.user.email, f"Inscription confirmée — {enr.session.training.title}",
         f"Bonjour {enr.user.full_name},\n\nVotre inscription est confirmée.\n\n{_details(enr)}\n\n"
         f"Retrouvez vos formations ici : {front('/compte/formations')}\n\nAdjougbe")


def send_reminder(enr: Enrollment, when: str):
    send(enr.user.email, f"Rappel : {enr.session.training.title} {when}",
         f"Bonjour {enr.user.full_name},\n\nPetit rappel : votre formation commence {when}.\n\n{_details(enr)}\n\nÀ tout de suite !")


@transaction.atomic
def enroll(user, session: TrainingSession, form_response=None) -> Enrollment:
    session = TrainingSession.objects.select_for_update().select_related("training").get(pk=session.pk)
    if session.status in (TrainingSession.Status.DONE, TrainingSession.Status.CANCELLED):
        raise ValidationError({"detail": "Cette session n'accepte plus d'inscriptions."})
    existing = Enrollment.objects.filter(user=user, session=session).first()
    if existing and existing.status in (Enrollment.Status.CONFIRMED, Enrollment.Status.WAITLIST):
        raise ValidationError({"detail": "Vous êtes déjà inscrit à cette session."})
    enr = existing or Enrollment(user=user, session=session)
    enr.form_response = form_response or enr.form_response
    if session.seats_left == 0 and not (existing and existing.status == Enrollment.Status.PENDING_PAYMENT):
        enr.status = Enrollment.Status.WAITLIST
        enr.save()
        send(user.email, f"Liste d'attente — {session.training.title}",
             f"Bonjour {user.full_name},\n\nLa session est complète : vous êtes sur liste d'attente. "
             "Nous vous écrivons dès qu'une place se libère.")
        return enr
    enr.status = Enrollment.Status.CONFIRMED if session.effective_price == 0 else Enrollment.Status.PENDING_PAYMENT
    enr.save()
    if enr.status == Enrollment.Status.CONFIRMED:
        send_enrollment_confirmation(enr)
    return enr


def promote_waitlist(session: TrainingSession):
    """Une place se libère : le premier de la liste d'attente est prévenu."""
    while session.seats_left > 0:
        nxt = session.enrollments.filter(status=Enrollment.Status.WAITLIST).order_by("created_at").first()
        if not nxt:
            return
        nxt.status = Enrollment.Status.CONFIRMED if session.effective_price == 0 else Enrollment.Status.PENDING_PAYMENT
        nxt.save(update_fields=["status"])
        send(nxt.user.email, f"Une place s'est libérée — {session.training.title}",
             f"Bonjour {nxt.user.full_name},\n\nUne place s'est libérée pour vous. "
             f"Finalisez votre inscription : {front('/compte/formations')}")
