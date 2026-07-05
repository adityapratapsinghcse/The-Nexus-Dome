from rest_framework import serializers
from .models import MLPrediction

class MLPredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLPrediction
        fields = ['id', 'model_name', 'input_data', 'prediction', 'confidence', 'timestamp']
        read_only_fields = ['id', 'timestamp']