"""Tâches planifiées, à lancer toutes les 10 minutes (cron ou systemd timer) :

    */10 * * * * cd /srv/adjougbe/backend && .venv/bin/python manage.py run_scheduled
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.emails import front, send
from apps.shop.models import Order
from apps.trainings.models import Enrollment, TrainingSession
from apps.trainings.services import send_reminder


class Command(BaseCommand):
    help = "Relance des paniers abandonnés et rappels avant les formations."

    def handle(self, *args, **opts):
        now = timezone.now()
        # Panier abandonné : paiement non terminé après 24 h, relance unique.
        carts = Order.objects.filter(status__in=[Order.Status.PENDING, Order.Status.FAILED],
                                     created_at__lte=now - timedelta(hours=24),
                                     created_at__gte=now - timedelta(days=7),
                                     reminder_sent_at__isnull=True).select_related("user")
        n_carts = 0
        for o in carts:
            send(o.user.email, "Votre commande vous attend — Adjougbe",
                 f"Bonjour {o.user.full_name},\n\nVotre commande {o.reference} n'a pas été finalisée. "
                 f"Vous pouvez la reprendre ici : {front('/compte/commandes')}\n\nAdjougbe")
            o.reminder_sent_at = now
            o.save(update_fields=["reminder_sent_at"])
            n_carts += 1

        # Rappels 24 h et 1 h avant chaque session.
        n_rem = 0
        for field, delta, label in [("reminder_24h_sent", timedelta(hours=24), "demain"),
                                    ("reminder_1h_sent", timedelta(hours=1), "dans une heure")]:
            sessions = TrainingSession.objects.filter(is_cancelled=False, starts_at__gt=now,
                                                      starts_at__lte=now + delta, **{field: False})
            for s in sessions:
                for e in s.enrollments.filter(status=Enrollment.Status.CONFIRMED).select_related("user", "session__training"):
                    send_reminder(e, label)
                    n_rem += 1
                setattr(s, field, True)
                s.save(update_fields=[field])
        self.stdout.write(f"{n_carts} relance(s) panier, {n_rem} rappel(s) formation.")
