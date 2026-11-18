from django.urls import path

from . import views

urlpatterns = [
    path("", views.TrainingList.as_view()),
    path("mine/", views.my_enrollments),
    path("enrollments/<int:pk>/cancel/", views.cancel_enrollment),
    path("enrollments/<int:pk>/certificate/", views.certificate),
    path("certificates/<str:code>/", views.verify_certificate),
    path("sessions/<int:pk>/enroll/", views.enroll),
    path("<slug:slug>/", views.TrainingDetail.as_view()),
]
