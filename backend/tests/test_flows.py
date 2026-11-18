import io
import re
import zipfile

import pyotp
from django.core import mail
from django.test import TestCase, override_settings

from apps.accounts.models import DeviceSession, User
from apps.catalog.models import Section, Work
from apps.forms.models import Form, FormField
from apps.shop.models import Access, Order, PromoCode


def make_work(**kw):
    defaults = dict(title="Punchlines T1", slug="t1", status=Work.Status.PUBLISHED, price_xof=3000,
                    access_mode=Work.AccessMode.PAID, free_extract_count=1)
    defaults.update(kw)
    w = Work.objects.create(**defaults)
    for n in (1, 2, 3):
        s = Section(work=w, number=n, title=f"Série {n}")
        s.content = f"> Punchline secrète numéro {n}\n\nTexte de la série {n}."
        s.save()
    return w


class Base(TestCase):
    def setUp(self):
        self.client.get("/api/auth/csrf/")
        self.user = User.objects.create_user("awa@example.com", "Motdepasse-solide-1", full_name="Awa Koné",
                                             email_verified=True)

    def login(self, client=None, email="awa@example.com", password="Motdepasse-solide-1"):
        c = client or self.client
        return c.post("/api/auth/login/", {"email": email, "password": password}, content_type="application/json")


class AccountTests(Base):
    def test_register_requires_terms_and_sends_verification(self):
        r = self.client.post("/api/auth/register/", {"full_name": "Kofi", "email": "kofi@example.com",
                             "password": "Tres-bon-mot-2026", "accept_terms": False}, content_type="application/json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/auth/register/", {"full_name": "Kofi", "email": "kofi@example.com",
                             "password": "Tres-bon-mot-2026", "accept_terms": True}, content_type="application/json")
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.json()["user"]["email_verified"])
        token = re.search(r"token=([\w:.\-]+)", mail.outbox[0].body).group(1)
        self.assertEqual(self.client.post("/api/auth/verify-email/", {"token": token},
                                          content_type="application/json").status_code, 200)
        self.assertTrue(User.objects.get(email="kofi@example.com").email_verified)

    def test_password_is_hashed_with_argon2(self):
        self.assertTrue(self.user.password.startswith("argon2"))

    @override_settings(LOGIN_MAX_ATTEMPTS=3)
    def test_lockout_after_failed_attempts(self):
        for _ in range(3):
            self.login(password="mauvais")
        self.assertEqual(self.login().status_code, 429)

    @override_settings(MAX_DEVICES_PER_ACCOUNT=2)
    def test_device_limit_closes_oldest_session(self):
        from django.test import Client
        clients = [Client() for _ in range(3)]
        for c in clients:
            self.assertEqual(self.login(c).status_code, 200)
        self.assertEqual(DeviceSession.objects.filter(user=self.user).count(), 2)
        self.assertIsNone(clients[0].get("/api/auth/me/").json()["user"])
        self.assertIsNotNone(clients[2].get("/api/auth/me/").json()["user"])


class PurchaseAndReaderTests(Base):
    def setUp(self):
        super().setUp()
        self.work = make_work()
        self.login()

    def checkout(self, **extra):
        payload = {"items": [{"type": "work", "id": self.work.pk}], "payment_method": "orange_money", **extra}
        return self.client.post("/api/shop/checkout/", payload, content_type="application/json")

    def test_unverified_email_cannot_buy(self):
        self.user.email_verified = False
        self.user.save()
        self.assertEqual(self.checkout().status_code, 403)

    def test_content_is_encrypted_at_rest(self):
        raw = Section.objects.filter(work=self.work).values_list("content_encrypted", flat=True).first()
        self.assertNotIn("Punchline secrète", raw)

    def test_purchase_unlocks_reader_and_watermarks(self):
        sec3 = self.work.sections.get(number=3)
        self.assertEqual(self.client.get(f"/api/reader/sections/{sec3.pk}/manifest/").status_code, 403)
        r = self.checkout()
        self.assertEqual(r.status_code, 201)
        ref = r.json()["order"]["reference"]
        self.assertIn("/paiement/simulation", r.json()["redirect_url"])
        self.client.post(f"/api/shop/orders/{ref}/simulate/", {"outcome": "success"}, content_type="application/json")
        self.assertTrue(Access.objects.filter(user=self.user, work=self.work).exists())
        receipt = mail.outbox[-1]
        self.assertIn(ref, receipt.subject)
        self.assertIn("/bibliotheque", receipt.body)
        self.assertNotIn(".pdf", receipt.body)

        m = self.client.get(f"/api/reader/sections/{sec3.pk}/manifest/").json()
        img = self.client.get(m["pages"][0])
        self.assertEqual(img.status_code, 200)
        self.assertEqual(img["Content-Type"], "image/webp")
        self.assertIn("no-store", img["Cache-Control"])
        # Le texte n'est jamais présent en clair dans la réponse.
        self.assertNotIn(b"Punchline secr", img.content)

    def test_signed_page_url_is_bound_to_session(self):
        from django.test import Client
        sec1 = self.work.sections.get(number=1)
        Access.objects.create(user=self.user, work=self.work, source="manual")
        url = self.client.get(f"/api/reader/sections/{self.work.sections.get(number=2).pk}/manifest/").json()["pages"][0]
        other = Client()
        self.assertEqual(other.get(url).status_code, 403)
        self.assertEqual(self.client.get(url).status_code, 200)
        # Extrait gratuit lisible sans compte.
        m = Client().get(f"/api/reader/sections/{sec1.pk}/manifest/").json()
        self.assertEqual(Client().get(m["pages"][0]).status_code, 200)

    def test_tampered_token_rejected(self):
        Access.objects.create(user=self.user, work=self.work, source="manual")
        url = self.client.get(f"/api/reader/sections/{self.work.sections.get(number=2).pk}/manifest/").json()["pages"][0]
        self.assertEqual(self.client.get(url[:-5] + "AAAA/").status_code, 403)

    def test_failed_payment_gives_no_access(self):
        ref = self.checkout().json()["order"]["reference"]
        self.client.post(f"/api/shop/orders/{ref}/simulate/", {"outcome": "failure"}, content_type="application/json")
        self.assertEqual(Order.objects.get(reference=ref).status, Order.Status.FAILED)
        self.assertFalse(Access.objects.filter(user=self.user, work=self.work).exists())

    def test_promo_code_applies(self):
        PromoCode.objects.create(code="BIENVENUE10", percent_off=10)
        q = self.client.post("/api/shop/quote/", {"items": [{"type": "work", "id": self.work.pk}],
                             "promo_code": "bienvenue10"}, content_type="application/json").json()
        self.assertEqual(q["total"], 2700)

    def test_already_owned_work_not_charged_twice(self):
        Access.objects.create(user=self.user, work=self.work, source="manual")
        self.assertEqual(self.checkout().status_code, 400)


class FreeFormAccessTests(Base):
    def test_form_unlocks_work(self):
        form = Form.objects.create(title="Accès Papos", slug="acces", requires_login=True)
        FormField.objects.create(form=form, key="ville", label="Ville", required=True)
        work = make_work(slug="papos", title="Papos", access_mode=Work.AccessMode.FREE_FORM, price_xof=0,
                         access_form=form)
        self.login()
        r = self.client.post("/api/forms/acces/submit/?work=papos", {"ville": "", "_consent": True},
                             content_type="application/json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/forms/acces/submit/?work=papos", {"ville": "Bouaké", "_consent": True},
                             content_type="application/json")
        self.assertEqual(r.json()["work_unlocked"], "papos")
        self.assertTrue(Access.objects.filter(user=self.user, work=work, source="free_form").exists())


class BackofficeTests(Base):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_superuser("admin@example.com", "Admin-solide-2026", full_name="Adjougbe")

    def test_backoffice_requires_otp(self):
        self.login(email="admin@example.com", password="Admin-solide-2026")
        self.assertEqual(self.client.get("/api/backoffice/dashboard/").status_code, 403)
        secret = self.client.post("/api/auth/otp/setup/").json()["secret"]
        r = self.client.post("/api/auth/otp/verify/", {"code": pyotp.TOTP(secret).now()}, content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/backoffice/dashboard/").status_code, 200)

    def test_reader_cannot_access_backoffice(self):
        self.login()
        self.assertEqual(self.client.get("/api/backoffice/works/").status_code, 403)

    def _otp_login(self):
        self.login(email="admin@example.com", password="Admin-solide-2026")
        secret = self.client.post("/api/auth/otp/setup/").json()["secret"]
        self.client.post("/api/auth/otp/verify/", {"code": pyotp.TOTP(secret).now()}, content_type="application/json")

    def test_import_docx_splits_sections_and_refund_revokes(self):
        self._otp_login()
        work = Work.objects.create(title="T3", slug="t3", price_xof=1000, status=Work.Status.PUBLISHED)
        body = "".join(f"<w:p><w:r><w:t>{t}</w:t></w:r></w:p>" for t in
                       ["Série 1 : Le début", "Première punchline.", "", "Série 2 — La suite", "Deuxième."])
        xml = ('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
               f"<w:body>{body}</w:body></w:document>")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("word/document.xml", xml)
        buf.seek(0)
        buf.name = "t3.docx"
        r = self.client.post(f"/api/backoffice/works/{work.pk}/import_sections/", {"file": buf})
        self.assertEqual(r.json(), {"imported": 2})
        self.assertEqual(work.sections.get(number=2).title, "La suite")

        from apps.shop.services import confirm_payment, create_order
        order = create_order(self.user, [{"type": "work", "id": work.pk}], "wave")
        confirm_payment(order.reference)
        self.assertTrue(Access.objects.get(user=self.user, work=work).is_active)
        r = self.client.post(f"/api/backoffice/orders/{order.pk}/refund/", {"reason": "doublon"},
                             content_type="application/json")
        self.assertEqual(r.json()["status"], "refunded")
        self.assertFalse(Access.objects.get(user=self.user, work=work).is_active)


class DesignFeatureTests(Base):
    """Fonctions ajoutées pour les maquettes du Studio."""

    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_superuser("admin@example.com", "Admin-solide-2026", full_name="Adjougbe")

    def _otp_login(self, client=None):
        c = client or self.client
        self.login(c, email="admin@example.com", password="Admin-solide-2026")
        secret = c.post("/api/auth/otp/setup/").json()["secret"]
        r = c.post("/api/auth/otp/verify/", {"code": pyotp.TOTP(secret).now()}, content_type="application/json")
        return r.json()

    def test_backup_code_works_once(self):
        from django.test import Client
        codes = self._otp_login()["backup_codes"]
        self.assertEqual(len(codes), 8)
        other = Client()
        self.login(other, email="admin@example.com", password="Admin-solide-2026")
        ok = other.post("/api/auth/otp/verify/", {"code": codes[0]}, content_type="application/json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(other.get("/api/backoffice/badges/").status_code, 200)
        third = Client()
        self.login(third, email="admin@example.com", password="Admin-solide-2026")
        again = third.post("/api/auth/otp/verify/", {"code": codes[0]}, content_type="application/json")
        self.assertEqual(again.status_code, 400)

    def test_settings_drive_device_limit(self):
        from django.test import Client
        self._otp_login()
        self.client.patch("/api/backoffice/settings/", {"max_devices_per_account": 1}, content_type="application/json")
        a, b = Client(), Client()
        self.login(a)
        self.login(b)
        self.assertEqual(DeviceSession.objects.filter(user=self.user).count(), 1)
        self.assertIsNone(a.get("/api/auth/me/").json()["user"])

    def test_journal_categories(self):
        self._otp_login()
        work = make_work()
        self.client.post(f"/api/backoffice/users/{self.user.pk}/grant_access/", {"work": work.pk}, content_type="application/json")
        acces = self.client.get("/api/backoffice/audit/?category=acces").json()["results"]
        self.assertEqual([a["action"] for a in acces], ["grant_access"])
        logins = self.client.get("/api/backoffice/audit/?category=connexions").json()["results"]
        self.assertTrue(all(a["action"] == "otp_login" for a in logins) and logins)

    def test_honeypot_rejects_bots(self):
        Form.objects.create(title="Contact", slug="contact")
        r = self.client.post("/api/forms/contact/submit/", {"_consent": True, "_website": "spam"}, content_type="application/json")
        self.assertEqual(r.status_code, 400)


class ClientExtrasTests(Base):
    def test_receipt_only_for_own_paid_orders(self):
        from django.test import Client

        from apps.shop.services import confirm_payment, create_order
        work = make_work()
        order = create_order(self.user, [{"type": "work", "id": work.pk}], "wave")
        self.login()
        self.assertEqual(self.client.get(f"/api/shop/orders/{order.reference}/receipt/").status_code, 404)
        confirm_payment(order.reference)
        r = self.client.get(f"/api/shop/orders/{order.reference}/receipt/")
        self.assertEqual(r["Content-Type"], "application/pdf")
        other = User.objects.create_user("x@example.com", "Motdepasse-solide-2", full_name="X", email_verified=True)
        c = Client()
        c.post("/api/auth/login/", {"email": other.email, "password": "Motdepasse-solide-2"}, content_type="application/json")
        self.assertEqual(c.get(f"/api/shop/orders/{order.reference}/receipt/").status_code, 404)

    def test_search_hides_drafts(self):
        make_work()
        make_work(slug="brouillon", title="Punchlines secrètes", status=Work.Status.DRAFT)
        titles = [w["title"] for w in self.client.get("/api/search/?q=punchlines").json()["works"]]
        self.assertEqual(titles, ["Punchlines T1"])
