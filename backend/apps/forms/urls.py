from django.urls import path

from . import views

urlpatterns = [
    path("<slug:slug>/", views.form_detail),
    path("<slug:slug>/submit/", views.form_submit),
]
