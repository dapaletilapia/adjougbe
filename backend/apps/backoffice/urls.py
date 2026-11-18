from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("works", views.WorkViewSet, basename="bo-works")
router.register("sections", views.SectionViewSet, basename="bo-sections")
router.register("bundles", views.BundleViewSet, basename="bo-bundles")
router.register("promos", views.PromoViewSet, basename="bo-promos")
router.register("orders", views.OrderViewSet, basename="bo-orders")
router.register("users", views.UserViewSet, basename="bo-users")
router.register("posts", views.PostViewSet, basename="bo-posts")
router.register("categories", views.CategoryViewSet, basename="bo-categories")
router.register("comments", views.CommentViewSet, basename="bo-comments")
router.register("reviews", views.ReviewViewSet, basename="bo-reviews")
router.register("trainings", views.TrainingViewSet, basename="bo-trainings")
router.register("sessions", views.SessionViewSet, basename="bo-sessions")
router.register("enrollments", views.EnrollmentViewSet, basename="bo-enrollments")
router.register("forms", views.FormViewSet, basename="bo-forms")
router.register("subscribers", views.SubscriberViewSet, basename="bo-subscribers")
router.register("campaigns", views.CampaignViewSet, basename="bo-campaigns")
router.register("banners", views.BannerViewSet, basename="bo-banners")
router.register("audit", views.AuditLogViewSet, basename="bo-audit")
router.register("alerts", views.AlertViewSet, basename="bo-alerts")
router.register("releases", views.ReleaseNoteViewSet, basename="bo-releases")

urlpatterns = [
    path("dashboard/", views.dashboard),
    path("badges/", views.badges),
    path("finance/export/", views.finance_export),
    path("settings/", views.site_settings),
    path("media/", views.media_upload),
    path("search/", views.search),
    path("", include(router.urls)),
]
