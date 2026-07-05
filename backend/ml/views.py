from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import MLPrediction
from .serializers import MLPredictionSerializer


@api_view(['GET'])
def predict_anomaly(request):
    """
    GET /api/ml/predict/anomaly/
    Placeholder until Phase 6 trains the real Isolation Forest model.
    """
    return Response({
        "model_name": "anomaly_detector",
        "prediction": "normal",
        "confidence": None,
        "note": "Placeholder response - real model trains in Phase 6"
    })


@api_view(['GET'])
def predict_gas(request):
    return Response({
        "model_name": "gas_classifier",
        "prediction": "safe",
        "confidence": None,
        "note": "Placeholder response - real model trains in Phase 6"
    })


@api_view(['GET'])
def ml_status(request):
    """
    GET /api/ml/status/
    Shows whether each model has been trained yet.
    """
    predictions = MLPrediction.objects.all()[:5]
    return Response({
        "models_trained": predictions.exists(),
        "recent_predictions": MLPredictionSerializer(predictions, many=True).data
    })