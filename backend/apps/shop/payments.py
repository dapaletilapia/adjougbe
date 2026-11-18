"""Passerelles de paiement. « simulated » en développement, CinetPay en recette et production.

CinetPay couvre Orange Money, MTN MoMo, Moov Money, Wave et la carte bancaire en Côte d'Ivoire.
La confirmation fait toujours foi côté serveur (notification + vérification), jamais le retour navigateur.
"""
import json
import logging
import urllib.request

from django.conf import settings

from apps.core.emails import front

from .models import Order, PaymentEvent

log = logging.getLogger(__name__)

CINETPAY_INIT_URL = "https://api-checkout.cinetpay.com/v2/payment"
CINETPAY_CHECK_URL = "https://api-checkout.cinetpay.com/v2/payment/check"


def _post_json(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:  # noqa: S310 — URL fixe de la passerelle
        return json.loads(r.read())


class SimulatedProvider:
    name = "simulated"

    def initiate(self, order: Order) -> str:
        return front(f"/paiement/simulation?ref={order.reference}")

    def check(self, order: Order) -> str:
        return order.status


class CinetPayProvider:
    name = "cinetpay"

    def initiate(self, order: Order) -> str:
        channel = "CREDIT_CARD" if order.payment_method == "card" else "MOBILE_MONEY"
        user = order.user
        payload = {
            "apikey": settings.CINETPAY_API_KEY,
            "site_id": settings.CINETPAY_SITE_ID,
            "transaction_id": order.reference,
            "amount": order.total,
            "currency": "XOF",
            "description": f"Commande {order.reference}",
            "notify_url": settings.BACKEND_PUBLIC_URL.rstrip("/") + "/api/shop/payments/cinetpay/notify/",
            "return_url": front(f"/paiement/retour?ref={order.reference}"),
            "channels": channel,
            "lang": "fr",
            "customer_name": user.full_name,
            "customer_email": user.email,
            "customer_phone_number": user.phone or "",
            "customer_country": "CI",
        }
        data = _post_json(CINETPAY_INIT_URL, payload)
        PaymentEvent.objects.create(order=order, provider=self.name, event="init",
                                    payload={k: v for k, v in data.items() if k != "apikey"})
        if str(data.get("code")) != "201":
            log.error("CinetPay init refusé : %s", data)
            raise RuntimeError(data.get("description") or "Paiement indisponible")
        return data["data"]["payment_url"]

    def check(self, order: Order) -> str:
        data = _post_json(CINETPAY_CHECK_URL, {
            "apikey": settings.CINETPAY_API_KEY, "site_id": settings.CINETPAY_SITE_ID,
            "transaction_id": order.reference,
        })
        PaymentEvent.objects.create(order=order, provider=self.name, event="check", payload=data)
        status = (data.get("data") or {}).get("status")
        if status == "ACCEPTED":
            return Order.Status.PAID
        if status in ("REFUSED", "CANCELED"):
            return Order.Status.FAILED
        return Order.Status.PENDING


def get_provider():
    if settings.PAYMENT_PROVIDER == "cinetpay":
        return CinetPayProvider()
    return SimulatedProvider()
