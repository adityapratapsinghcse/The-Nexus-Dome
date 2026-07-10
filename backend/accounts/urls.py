from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('invite/', views.invite_member, name='invite-member'),
    path('my-households/', views.my_households, name='my-households'),
    path('household-members/', views.household_members, name='household-members'),
]