"""Mesure d'audience interne, sans cookie : aucune adresse IP ni identifiant durable n'est conservé.

Un visiteur est reconnu le temps d'une journée par une empreinte (IP + navigateur + date + secret),
hachée et tronquée : le lendemain, la même personne a une autre empreinte. On ne stocke que des comptes.
"""
from django.db import models


class PageView(models.Model):
    """Pages vues par jour et par adresse de page."""

    day = models.DateField(db_index=True)
    path = models.CharField(max_length=200)
    views = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["day", "path"], name="pageview_day_path")]


class DailyVisitor(models.Model):
    """Un visiteur unique d'une journée : d'où il vient, sur quel appareil, sa page d'arrivée."""

    class Device(models.TextChoices):
        MOBILE = "mobile", "Mobile"
        DESKTOP = "desktop", "Ordinateur"
        TABLET = "tablet", "Tablette"

    day = models.DateField(db_index=True)
    key = models.CharField(max_length=32)
    source = models.CharField(max_length=20, default="direct")
    device = models.CharField(max_length=10, choices=Device.choices, default=Device.DESKTOP)
    landing = models.CharField(max_length=200, blank=True)
    pages = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["day", "key"], name="visitor_day_key")]
