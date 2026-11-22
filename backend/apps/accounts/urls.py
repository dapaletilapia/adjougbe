from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf),
    path("me/", views.me),
    path("register/", views.register),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("google/", views.google_login),
    path("verify-email/", views.verify_email),
    path("resend-verification/", views.resend_verification),
    path("password-reset/", views.password_reset),
    path("password-reset/confirm/", views.password_reset_confirm),
    path("password/", views.change_password),
    path("profile/", views.profile),
    path("devices/", views.devices),
    path("devices/<int:pk>/", views.device_delete),
    path("export/", views.export_data),
    path("deletion-request/", views.deletion_request),
    path("otp/setup/", views.otp_setup),
    path("otp/verify/", views.otp_verify),
]
