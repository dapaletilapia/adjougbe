from django.urls import path

from . import views

urlpatterns = [
    path("library/", views.library),
    path("works/<slug:slug>/toc/", views.toc),
    path("works/<slug:slug>/claim/", views.claim),
    path("sections/<int:pk>/manifest/", views.manifest),
    path("page/<str:token>/", views.page_image),
    path("progress/", views.save_progress),
    path("bookmarks/", views.bookmarks),
    path("bookmarks/<int:pk>/", views.bookmark_delete),
]
