from django.db import models
from devices.models import Device

class SensorReading(models.Model):
    SENSOR_TYPES = [
        ('temperature', 'Temperature'),
        ('humidity', 'Humidity'),
        ('distance', 'Ultrasonic Distance'),
        ('motion', 'PIR Motion'),
        ('window', 'Reed Switch / Window'),
        ('gas', 'MQ-2 Gas'),
        ('flame', 'Flame Sensor'),
        ('water', 'Water Leak'),
        ('current', 'ACS712 Current'),
        ('light', 'LDR Light Level'),
        ('vibration', 'MPU6050 Vibration'),
    ]

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='readings')
    sensor_type = models.CharField(max_length=20, choices=SENSOR_TYPES)
    value = models.FloatField()
    unit = models.CharField(max_length=20, blank=True)  # e.g. "C", "%", "cm", "A"
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['sensor_type', 'timestamp']),
            models.Index(fields=['device', 'timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.sensor_type}={self.value}{self.unit} @ {self.timestamp}"