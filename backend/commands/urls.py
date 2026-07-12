from django.urls import path
from . import views

urlpatterns = [
   path('garage/confirm/', views.garage_confirm, name='garage-confirm'),
]