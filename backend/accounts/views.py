from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from .serializers import RegisterSerializer, HouseholdSerializer, MembershipSerializer
from .models import Household, Membership
from django.contrib.auth import authenticate


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    POST /api/auth/register/
    Body: {"username": "...", "email": "...", "password": "...", "household_name": "..."}
    Creates a User + a brand new Household with them as owner, returns a login token.
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        result = serializer.save()
        token, _ = Token.objects.get_or_create(user=result['user'])
        return Response({
            "token": token.key,
            "household": HouseholdSerializer(result['household']).data
        }, status=201)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    POST /api/auth/login/
    Body: {"username": "...", "password": "..."}
    """
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if not user:
        return Response({"error": "Invalid credentials"}, status=401)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_member(request):
    """
    POST /api/auth/invite/
    Body: {"household_id": 1, "username": "family_member_username"}
    Only an owner of the household can invite. Adds an EXISTING registered
    user to the household as a 'member'. (Simple version - no email invite flow yet.)
    """
    household_id = request.data.get('household_id')
    username = request.data.get('username')

    is_owner = Membership.objects.filter(
        user=request.user, household_id=household_id, role='owner'
    ).exists()
    if not is_owner:
        return Response({"error": "Only the household owner can invite members"}, status=403)

    from django.contrib.auth.models import User
    try:
        target_user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "No such user - they must register first"}, status=404)

    membership, created = Membership.objects.get_or_create(
        user=target_user, household_id=household_id, defaults={'role': 'member'}
    )
    return Response(MembershipSerializer(membership).data, status=201 if created else 200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_households(request):
    """
    GET /api/auth/my-households/
    Lists every household this logged-in user belongs to, with their role.
    """
    memberships = Membership.objects.filter(user=request.user)
    return Response(MembershipSerializer(memberships, many=True).data)