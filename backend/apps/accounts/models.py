from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.READER)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_superuser=True, is_staff=True, role=User.Role.ADMIN, email_verified=True)
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        READER = "reader", "Lecteur"
        ADMIN = "admin", "Administrateur"
        EDITOR = "editor", "Éditeur / community manager"
        ACCOUNTANT = "accountant", "Comptable"
        ASSISTANT = "assistant", "Assistant"

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    country = models.CharField(max_length=80, blank=True, default="Côte d'Ivoire")
    city = models.CharField(max_length=80, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.READER)

    email_verified = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    newsletter_consent = models.BooleanField(default=False)
    # Préférences de contenu : humour, société, formations…
    preferences = models.JSONField(default=list, blank=True)
    google_sub = models.CharField(max_length=64, blank=True, db_index=True)

    # Double authentification (TOTP) — obligatoire pour les comptes à privilèges.
    otp_secret = models.CharField(max_length=64, blank=True)
    otp_enabled = models.BooleanField(default=False)
    otp_backup_codes = models.JSONField(default=list, blank=True, help_text="Empreintes des codes de secours")

    # Protection contre la force brute.
    failed_login_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    is_blocked = models.BooleanField(default=False, help_text="Bloqué par l'administrateur")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False, help_text="Accès à l'admin Django technique")
    date_joined = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    # Suppression de compte : le lecteur la demande, seul le super administrateur l'exécute.
    deletion_requested_at = models.DateTimeField(null=True, blank=True)
    deletion_reason = models.CharField(max_length=500, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["-date_joined"]
        verbose_name = "utilisateur"

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def is_staff_role(self) -> bool:
        return self.is_superuser or self.role != self.Role.READER

    @property
    def is_locked(self) -> bool:
        return bool(self.locked_until and self.locked_until > timezone.now())


class DeviceSession(models.Model):
    """Appareil connecté : limite le nombre de sessions simultanées (par défaut 2)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    session_key = models.CharField(max_length=64, unique=True)
    label = models.CharField(max_length=120, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"{self.user.email} — {self.label}"


def describe_user_agent(ua: str) -> str:
    ua_l = ua.lower()
    os_name = next((n for k, n in [("android", "Android"), ("iphone", "iPhone"), ("ipad", "iPad"),
                                   ("windows", "Windows"), ("mac os", "Mac"), ("linux", "Linux")] if k in ua_l), "Appareil")
    browser = next((n for k, n in [("edg/", "Edge"), ("chrome", "Chrome"), ("firefox", "Firefox"),
                                   ("safari", "Safari")] if k in ua_l), "Navigateur")
    return f"{browser} sur {os_name}"
