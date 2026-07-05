from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import Device


class DeviceKeyAuthentication(BaseAuthentication):
    """
    Used only on device-facing endpoints (sensor ingest, command polling).
    ESP32 sends header: X-Device-Key: <the device's secret key>
    On success, sets request.device (not request.user - there's no user here).
    """

    def authenticate(self, request):
        key = request.headers.get('X-Device-Key')
        if not key:
            return None  # let it fall through - view will reject if device auth is required

        try:
            device = Device.objects.get(device_key=key)
        except Device.DoesNotExist:
            raise AuthenticationFailed('Invalid device key')

        return (None, device)  # (user, auth) - DRF convention; we read request.auth as the device