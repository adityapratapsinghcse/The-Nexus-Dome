from django.urls import path
from . import views

urlpatterns = [
    path('devices/', views.device_list_create, name='device-list-create'),
    path('commands/send/', views.send_command, name='send-command'),
    path('commands/pending/', views.pending_commands, name='pending-commands'),
    path('commands/ack/', views.acknowledge_command, name='acknowledge-command'),
    path('energy/daily/', views.energy_daily, name='energy-daily'),
    path('energy/summary/', views.energy_summary, name='energy-summary'),
    path('devices/register-push-token/', views.register_push_token, name='register-push-token'),
    path('access/cards/', views.rfid_card_list_create, name='rfid-card-list-create'),
    path('access/cards/<int:card_id>/', views.rfid_card_detail, name='rfid-card-detail'),
]