from django.urls import path

from . import views

urlpatterns = [
    path("home/", views.home),
    path("posts/", views.PostList.as_view()),
    path("posts/<slug:slug>/", views.post_detail),
    path("posts/<slug:slug>/comments/", views.comments),
    path("posts/<slug:slug>/react/", views.react),
    path("posts/<slug:slug>/share/", views.track_share),
    path("posts/<slug:slug>/card.png", views.quote_card),
    path("categories/", views.categories),
    path("punchline-du-jour/", views.punchline_of_the_day),
]
