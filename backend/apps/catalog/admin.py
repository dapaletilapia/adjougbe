from django.contrib import admin

from .models import Bundle, Review, Section, Work

admin.site.register([Work, Section, Bundle, Review])
