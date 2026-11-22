from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.core import seo
from apps.core import views as core

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("sitemap.xml", seo.sitemap),
    path("robots.txt", seo.robots),
    path("apercu/", seo.share_preview),
    path("apercu/<path:path>", seo.share_preview),
    path("api/health/", core.health),
    path("api/cron/scheduled/", core.cron_scheduled),
    path("api/settings/", core.public_settings),
    path("api/search/", core.search),
    path("api/pages/<slug:key>/", core.page),
    path("api/expertise/", core.expertise),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/catalog/", include("apps.catalog.urls")),
    path("api/shop/", include("apps.shop.urls")),
    path("api/reader/", include("apps.reader.urls")),
    path("api/blog/", include("apps.blog.urls")),
    path("api/trainings/", include("apps.trainings.urls")),
    path("api/forms/", include("apps.forms.urls")),
    path("api/newsletter/", include("apps.newsletter.urls")),
    path("api/backoffice/", include("apps.backoffice.urls")),
]

if settings.FILE_STORAGE == "database":
    urlpatterns.append(path("media/<path:path>", core.media_file))
elif settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
