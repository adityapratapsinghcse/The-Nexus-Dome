import secrets
from django.db import models


def generate_device_key():
    return secrets.token_hex(32)


class Device(models.Model):
    DEVICE_TYPES = [
        ('esp32', 'ESP32 Main Board'),
        ('arduino_uno', 'Arduino Uno Slave Board'),
    ]

    household = models.ForeignKey('accounts.Household', on_delete=models.CASCADE, related_name='devices')
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=DEVICE_TYPES, default='esp32')
    location = models.CharField(max_length=100, blank=True)
    device_key = models.CharField(max_length=64, unique=True, editable=False, default=generate_device_key)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    garage_status = models.CharField(
        max_length=10,
        choices=[
            ('vacant', 'Vacant'),
            ('occupied', 'Occupied'),
            ('pending', 'Awaiting Confirmation'),
            ('opening', 'Opening'),
        ],
        default='vacant',
    )
    # Separate from garage_status: garage_status tracks the car-detected /
    # confirmation-prompt workflow. gate_status tracks the physical servo
    # gate position, which can also be changed by a manual Open/Close
    # button regardless of whether a car was ever detected.
    gate_status = models.CharField(
        max_length=10,
        choices=[('open', 'Open'), ('closed', 'Closed')],
        default='closed',
    )
    door_status = models.CharField(
        max_length=10,
        choices=[('locked', 'Locked'), ('unlocked', 'Unlocked')],
        default='locked',
    )

    def __str__(self):
        return f"{self.name} ({self.household.name})"

class Command(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('acknowledged', 'Acknowledged'),
        ('failed', 'Failed'),
    ]

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='commands')
    action = models.CharField(max_length=50)   # e.g. "light_on", "fan_off", "unlock_door"
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.action} -> {self.device.name} [{self.status}]"
    
class EnergyLog(models.Model):
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='energy_logs')
    on_duration_mins = models.FloatField(default=0)
    estimated_kwh = models.FloatField(default=0)
    date = models.DateField()

    class Meta:
        ordering = ['-date']
        unique_together = ('device', 'date')

    def __str__(self):
        return f"{self.device.name} - {self.date}: {self.estimated_kwh} kWh"
    
class RFIDCard(models.Model):
    household = models.ForeignKey('accounts.Household', on_delete=models.CASCADE, related_name='rfid_cards')
    uid = models.CharField(max_length=50)
    label = models.CharField(max_length=100, blank=True)  # e.g. "Aditya's card"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('household', 'uid')

    def __str__(self):
        return f"{self.label or self.uid} ({'active' if self.is_active else 'revoked'})"