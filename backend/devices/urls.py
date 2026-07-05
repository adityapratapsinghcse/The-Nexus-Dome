from django.urls import path
from . import views

urlpatterns = [
    path('devices/', views.device_list_create, name='device-list-create'),
    path('commands/send/', views.send_command, name='send-command'),
    path('commands/pending/', views.pending_commands, name='pending-commands'),
    path('commands/ack/', views.acknowledge_command, name='acknowledge-command'),
    path('energy/daily/', views.energy_daily, name='energy-daily'),
    path('energy/summary/', views.energy_summary, name='energy-summary'),
]