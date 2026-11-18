from django.contrib import admin

from .models import AuditLog, Banner, ReleaseNote, SiteSettings

admin.site.register([AuditLog, Banner, ReleaseNote, SiteSettings])
