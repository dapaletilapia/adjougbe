from django.urls import path

from . import views

urlpatterns = [
    path("works/", views.WorkList.as_view()),
    path("works/<slug:slug>/", views.WorkDetail.as_view()),
    path("works/<slug:slug>/reviews/", views.post_review),
    path("bundles/", views.BundleList.as_view()),
]
