from rest_framework import serializers

from apps.accounts.models import DeviceSession, User
from apps.blog.models import Category, Comment
from apps.catalog.models import Bundle, Review, Section, Work
from apps.core.models import AuditLog, Banner, ExpertiseArea, ReleaseNote, SiteSettings
from apps.newsletter.models import Campaign, Subscriber
from apps.reader.models import AbuseAlert
from apps.shop.models import Access, Order, PromoCode
from apps.trainings.models import Enrollment, Training, TrainingSession


class AdminWorkSerializer(serializers.ModelSerializer):
    sections_count = serializers.IntegerField(source="sections.count", read_only=True)
    sales_count = serializers.SerializerMethodField()
    readers_count = serializers.SerializerMethodField()
    access_form_id = serializers.PrimaryKeyRelatedField(source="access_form", allow_null=True, required=False,
                                                        queryset=Work._meta.get_field("access_form").related_model.objects.all())
    related_ids = serializers.PrimaryKeyRelatedField(source="related", many=True, required=False,
                                                     queryset=Work.objects.all())

    class Meta:
        model = Work
        fields = ["id", "slug", "title", "subtitle", "kind", "cover", "cover_color", "summary", "format_label",
                  "price_xof", "price_eur", "promo_price_xof", "promo_ends_at", "access_mode", "access_form_id",
                  "free_extract_count", "status", "release_date", "edition", "is_featured", "position",
                  "related_ids", "seo_description", "buyers_group_link", "sections_count", "sales_count",
                  "readers_count", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False}}

    def get_sales_count(self, obj):
        return Access.objects.filter(work=obj, source=Access.Source.PURCHASE).count()

    def get_readers_count(self, obj):
        return Access.objects.filter(work=obj, revoked_at__isnull=True).count()


class AdminSectionSerializer(serializers.ModelSerializer):
    content = serializers.CharField(write_only=True, required=False, allow_blank=True)
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ["id", "work", "number", "title", "content", "preview", "word_count", "edition", "updated_at"]
        read_only_fields = ["word_count", "edition"]

    def get_preview(self, obj):
        # Extrait court pour l'administration ; le texte complet s'obtient via ?full=1.
        if self.context.get("full"):
            return obj.content
        return obj.content[:240]

    def create(self, data):
        content = data.pop("content", "")
        s = Section(**data)
        s.content = content
        s.save()
        return s

    def update(self, s, data):
        content = data.pop("content", None)
        for k, v in data.items():
            setattr(s, k, v)
        if content is not None and content != s.content:
            s.content = content
            s.edition += 1  # correction de texte = nouvelle édition, sans perte de progression
        s.save()
        return s


class AdminBundleSerializer(serializers.ModelSerializer):
    work_ids = serializers.PrimaryKeyRelatedField(source="works", many=True, queryset=Work.objects.all())
    full_price_xof = serializers.IntegerField(read_only=True)

    class Meta:
        model = Bundle
        fields = ["id", "title", "slug", "description", "work_ids", "price_xof", "full_price_xof", "is_active"]


class AdminPromoSerializer(serializers.ModelSerializer):
    work_ids = serializers.PrimaryKeyRelatedField(source="works", many=True, queryset=Work.objects.all(), required=False)

    class Meta:
        model = PromoCode
        fields = ["id", "code", "description", "percent_off", "amount_off_xof", "starts_at", "ends_at", "max_uses",
                  "used_count", "min_total_xof", "work_ids", "is_active", "created_at"]
        read_only_fields = ["used_count"]

    def validate(self, attrs):
        if not attrs.get("percent_off") and not attrs.get("amount_off_xof") and not self.instance:
            raise serializers.ValidationError("Indiquez un pourcentage ou un montant de remise.")
        if attrs.get("percent_off") and attrs["percent_off"] > 100:
            raise serializers.ValidationError({"percent_off": "100 % maximum."})
        if "code" in attrs:
            attrs["code"] = attrs["code"].strip().upper()
        return attrs


class AdminOrderSerializer(serializers.ModelSerializer):
    customer = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_label = serializers.CharField(source="get_payment_method_display", read_only=True)
    promo = serializers.CharField(source="promo_code.code", default=None)
    history = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["id", "reference", "customer", "status", "status_label", "subtotal", "discount", "total",
                  "currency", "payment_method", "payment_method_label", "provider", "provider_reference", "promo",
                  "items", "created_at", "paid_at", "refund_reason", "is_gift", "gift_recipient_email", "history"]

    def get_history(self, obj):
        labels = {"init": "Demande envoyée à l'opérateur", "notify": "Notification de l'opérateur reçue",
                  "check": "Statut vérifié auprès de l'opérateur", "success": "Paiement confirmé (simulation)",
                  "failure": "Échec du paiement (simulation)"}
        events = [{"at": obj.created_at, "label": "Commande créée"}]
        events += [{"at": e.created_at, "label": labels.get(e.event, e.event)} for e in obj.payment_events.all()]
        if obj.paid_at:
            events.append({"at": obj.paid_at, "label": "Paiement confirmé · accès débloqué"})
        if obj.status == Order.Status.REFUNDED:
            events.append({"at": obj.updated_at, "label": f"Remboursée · {obj.refund_reason}"})
        return sorted(events, key=lambda e: e["at"], reverse=True)

    def get_customer(self, obj):
        return {"id": obj.user_id, "name": obj.user.full_name, "email": obj.user.email, "phone": obj.user.phone}

    def get_items(self, obj):
        return [{"label": i.label, "unit_price": i.unit_price, "quantity": i.quantity} for i in obj.items.all()]


class AdminUserSerializer(serializers.ModelSerializer):
    orders_count = serializers.IntegerField(read_only=True)
    total_spent = serializers.IntegerField(read_only=True)
    works_count = serializers.IntegerField(read_only=True)
    devices_count = serializers.IntegerField(read_only=True)
    open_alerts = serializers.IntegerField(read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "country", "city", "role", "role_label", "email_verified",
                  "newsletter_consent", "preferences", "is_blocked", "is_active", "otp_enabled", "date_joined",
                  "last_seen_at", "orders_count", "total_spent", "works_count", "devices_count", "open_alerts",
                  "deletion_requested_at", "deletion_reason"]
        read_only_fields = ["email", "date_joined", "last_seen_at", "otp_enabled", "deletion_requested_at", "deletion_reason"]


class DeviceAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceSession
        fields = ["id", "label", "ip_address", "created_at", "last_seen_at"]


class AdminCommentSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="user.full_name", read_only=True)
    author_email = serializers.CharField(source="user.email", read_only=True)
    post_title = serializers.CharField(source="post.title", read_only=True)
    post_slug = serializers.CharField(source="post.slug", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "body", "status", "author", "author_email", "post_title", "post_slug", "is_author_reply",
                  "parent", "created_at"]
        read_only_fields = ["body", "is_author_reply", "parent"]


class AdminReviewSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="user.full_name", read_only=True)
    work_title = serializers.CharField(source="work.title", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "rating", "body", "status", "author", "work_title", "created_at"]
        read_only_fields = ["rating", "body"]


class AdminCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class AdminSessionSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)
    seats_taken = serializers.IntegerField(read_only=True)
    seats_left = serializers.IntegerField(read_only=True)
    waitlist_count = serializers.SerializerMethodField()
    training_title = serializers.CharField(source="training.title", read_only=True)

    class Meta:
        model = TrainingSession
        fields = ["id", "training", "training_title", "starts_at", "ends_at", "location", "meeting_link",
                  "capacity", "price_xof", "registrations_open", "is_cancelled", "status", "seats_taken",
                  "seats_left", "waitlist_count"]

    def get_waitlist_count(self, obj):
        return obj.enrollments.filter(status=Enrollment.Status.WAITLIST).count()

    def validate(self, attrs):
        start = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        end = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"ends_at": "La fin doit être après le début."})
        return attrs


class AdminTrainingSerializer(serializers.ModelSerializer):
    sessions = AdminSessionSerializer(many=True, read_only=True)
    registration_form_id = serializers.PrimaryKeyRelatedField(
        source="registration_form", allow_null=True, required=False,
        queryset=Training._meta.get_field("registration_form").related_model.objects.all())
    enrollments_count = serializers.SerializerMethodField()

    class Meta:
        model = Training
        fields = ["id", "slug", "title", "theme", "format", "summary", "context", "objectives", "audience", "program",
                  "duration_label", "trainer", "cover", "price_xof", "faq", "testimonials", "registration_form_id",
                  "is_published", "sessions", "enrollments_count", "created_at", "author_role", "organizer",
                  "registration_mode", "external_registration_url"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_external_registration_url(self, value):
        if value and not value.startswith("https://"):
            raise serializers.ValidationError("Le lien doit commencer par https://")
        return value

    def validate(self, attrs):
        mode = attrs.get("registration_mode", getattr(self.instance, "registration_mode", Training.Registration.SITE))
        url = attrs.get("external_registration_url", getattr(self.instance, "external_registration_url", ""))
        if mode == Training.Registration.EXTERNAL and not url:
            raise serializers.ValidationError({"external_registration_url": "Indiquez le lien du formulaire de l'organisateur."})
        return attrs

    def get_enrollments_count(self, obj):
        return Enrollment.objects.filter(session__training=obj, status=Enrollment.Status.CONFIRMED).count()


class AdminEnrollmentSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    answers = serializers.JSONField(source="form_response.data", default=None, read_only=True)
    order_reference = serializers.CharField(source="order.reference", default=None, read_only=True)
    payment = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ["id", "name", "email", "phone", "status", "status_label", "attended", "certificate_code",
                  "answers", "order_reference", "payment", "created_at"]
        read_only_fields = ["certificate_code"]

    def get_payment(self, obj):
        if not obj.order:
            return {"label": "Gratuit", "ok": True}
        short = {"orange_money": "Orange", "mtn_momo": "MTN", "moov_money": "Moov", "wave": "Wave", "card": "Carte"}
        if obj.order.status == "paid":
            return {"label": f"{short.get(obj.order.payment_method, obj.order.payment_method)} ✓", "ok": True}
        return {"label": "En attente" if obj.order.status == "pending" else obj.order.get_status_display(), "ok": False}


class AdminSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscriber
        fields = ["id", "email", "source", "preferences", "is_active", "consent_at", "created_at"]


class AdminCampaignSerializer(serializers.ModelSerializer):
    segment_label = serializers.CharField(source="get_segment_display", read_only=True)

    class Meta:
        model = Campaign
        fields = ["id", "subject", "body", "segment", "segment_label", "sent_at", "recipients_count", "created_at"]
        read_only_fields = ["sent_at", "recipients_count"]


class AdminBannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ["id", "title", "subtitle", "image", "link_url", "link_label", "placement", "starts_at", "ends_at",
                  "is_active", "position"]


class AdminExpertiseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpertiseArea
        fields = ["id", "title", "description", "icon", "position", "is_published"]

    def validate_icon(self, value):
        # Nom d'icône Flaticon : lettres, chiffres et tirets seulement (utilisé dans une classe CSS).
        import re
        if not re.fullmatch(r"[a-z0-9-]{1,40}", value or ""):
            raise serializers.ValidationError("Icône invalide.")
        return value


class AdminSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        exclude = ["id"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.CharField(source="actor.full_name", default="Système")

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "action", "target_type", "target_id", "summary", "ip_address", "created_at"]


class AlertSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = AbuseAlert
        fields = ["id", "user_id", "user_email", "kind", "kind_label", "detail", "resolved", "created_at"]
        read_only_fields = ["kind", "detail"]


class ReleaseNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReleaseNote
        fields = ["id", "version", "released_at", "content", "delivered_by"]
