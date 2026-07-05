from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/sensors/(?P<household_id>\d+)/$', consumers.SensorConsumer.as_asgi()),
    re_path(r'ws/alerts/(?P<household_id>\d+)/$', consumers.AlertConsumer.as_asgi()),
]