from django.urls import path
from . import views

urlpatterns = [
    path('alerts/', views.alert_list, name='alert-list'),
    path('alerts/read/', views.mark_alert_read, name='mark-alert-read'),
    path('access/verify/', views.verify_access, name='verify-access'),
    path('access/log/', views.access_log_list, name='access-log-list'),
]