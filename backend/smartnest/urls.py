from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('devices.urls')),
    path('api/', include('sensors.urls')),
    path('api/', include('alerts.urls')),
    path('api/', include('ml.urls')),
]