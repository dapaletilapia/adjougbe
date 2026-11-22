from rest_framework import serializers

from .models import Enrollment, Training, TrainingSession


class SessionSerializer(serializers.ModelSerializer):
    ends_at = serializers.DateTimeField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_label = serializers.SerializerMethodField()
    seats_left = serializers.IntegerField(read_only=True)
    effective_price = serializers.IntegerField(read_only=True)

    class Meta:
        model = TrainingSession
        fields = ["id", "starts_at", "ends_at", "location", "capacity", "seats_left", "status", "status_label",
                  "effective_price"]

    def get_status_label(self, obj):
        return TrainingSession.Status(obj.status).label


class SessionCardSerializer(SessionSerializer):
    training = serializers.SerializerMethodField()

    class Meta(SessionSerializer.Meta):
        fields = SessionSerializer.Meta.fields + ["training"]

    def get_training(self, obj):
        t = obj.training
        return {"slug": t.slug, "title": t.title, "format": t.format, "format_label": t.get_format_display(),
                "cover": t.cover.url if t.cover else None, "theme": t.theme, "organizer": t.organizer,
                "registration_mode": t.registration_mode}


class TrainingCardSerializer(serializers.ModelSerializer):
    format_label = serializers.CharField(source="get_format_display", read_only=True)
    next_session = serializers.SerializerMethodField()

    class Meta:
        model = Training
        fields = ["id", "slug", "title", "theme", "format", "format_label", "summary", "duration_label", "cover",
                  "price_xof", "is_free", "next_session", "author_role", "organizer", "registration_mode",
                  "external_registration_url"]

    def get_next_session(self, obj):
        from django.utils import timezone
        s = obj.sessions.filter(ends_at__gte=timezone.now(), is_cancelled=False).first()
        return SessionSerializer(s).data if s else None


class TrainingDetailSerializer(TrainingCardSerializer):
    sessions = serializers.SerializerMethodField()
    registration_form = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta(TrainingCardSerializer.Meta):
        fields = TrainingCardSerializer.Meta.fields + ["objectives", "audience", "program", "trainer", "faq",
                                                       "testimonials", "sessions", "registration_form"]

    def get_sessions(self, obj):
        return SessionSerializer(obj.sessions.filter(is_cancelled=False), many=True).data


class MyEnrollmentSerializer(serializers.ModelSerializer):
    session = SessionCardSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    meeting_link = serializers.SerializerMethodField()
    order_reference = serializers.CharField(source="order.reference", default=None)
    number = serializers.SerializerMethodField()
    paid = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ["id", "number", "status", "status_label", "session", "meeting_link", "attended", "certificate_code",
                  "order_reference", "paid", "created_at"]

    def get_number(self, obj):
        return f"FOR-{obj.created_at:%y}-{obj.pk:04d}"

    def get_paid(self, obj):
        if obj.order and obj.order.status == "paid":
            return {"amount": obj.order.total, "method": obj.order.get_payment_method_display()}
        return None

    def get_meeting_link(self, obj):
        return obj.session.meeting_link if obj.status == Enrollment.Status.CONFIRMED else ""
