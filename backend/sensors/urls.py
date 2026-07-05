from django.urls import path
from . import views

urlpatterns = [
    path('sensors/data/', views.ingest_sensor_data, name='ingest-sensor-data'),
    path('sensors/latest/', views.latest_readings, name='latest-readings'),
    path('sensors/history/', views.sensor_history, name='sensor-history'),
]