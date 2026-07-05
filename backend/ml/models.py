from django.db import models

class MLPrediction(models.Model):
    MODEL_NAMES = [
        ('anomaly_detector', 'Anomaly Detector'),
        ('gas_classifier', 'Gas Leak Severity Classifier'),
        ('seismic_classifier', 'Earthquake vs Vibration Classifier'),
        ('occupancy_predictor', 'Occupancy Predictor'),
        ('energy_forecaster', 'Energy Usage Forecaster'),
    ]

    model_name = models.CharField(max_length=30, choices=MODEL_NAMES)
    input_data = models.JSONField()
    prediction = models.CharField(max_length=100)
    confidence = models.FloatField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.model_name}: {self.prediction} ({self.confidence})"