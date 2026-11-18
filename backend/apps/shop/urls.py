from django.urls import path

from . import views

urlpatterns = [
    path("quote/", views.quote),
    path("checkout/", views.checkout),
    path("orders/", views.my_orders),
    path("orders/<str:reference>/", views.order_detail),
    path("orders/<str:reference>/retry/", views.retry_payment),
    path("orders/<str:reference>/receipt/", views.receipt),
    path("orders/<str:reference>/simulate/", views.simulate_payment),
    path("payments/cinetpay/notify/", views.cinetpay_notify),
    path("gift/redeem/", views.redeem_gift),
]
