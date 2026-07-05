from django.db import models
from devices.models import Device

class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    ALERT_TYPES = [
        ('gas_leak', 'Gas Leak'),
        ('fire', 'Fire / Flame'),
        ('water_leak', 'Water Leak'),
        ('overcurrent', 'Current Overload'),
        ('intrusion', 'Motion / Intrusion'),
        ('window_open', 'Window / Door Open'),
        ('vibration', 'Vibration / Seismic'),
        ('rfid_denied', 'RFID Access Denied'),
        ('system', 'System / Hardware Fault'),
    ]

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    type = models.CharField(max_length=20, choices=ALERT_TYPES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='warning')
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.severity.upper()}] {self.type}: {self.message}"

from devices.models import Device

class AccessLog(models.Model):
    METHOD_CHOICES = [
        ('rfid', 'RFID Card'),
        ('keypad', 'Keypad PIN'),
    ]

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='access_logs', null=True, blank=True)
    rfid_uid = models.CharField(max_length=50, blank=True)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default='rfid')
    granted = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        status = "GRANTED" if self.granted else "DENIED"
        return f"{self.method} {self.rfid_uid} - {status} @ {self.timestamp}"