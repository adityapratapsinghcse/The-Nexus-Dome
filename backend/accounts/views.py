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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def household_members(request):
    """
    GET /api/auth/household-members/?household_id=1
    Lists every member of a household (owner + members).
    """
    household_id = request.query_params.get('household_id')

    if not household_id:
        return Response({"error": "Missing household_id parameter"}, status=400)

    is_member = Membership.objects.filter(user=request.user, household_id=household_id).exists()
    if not is_member:
        return Response({"error": "You are not part of this household"}, status=403)

    members = Membership.objects.filter(household_id=household_id).select_related('user').order_by('-role', 'joined_at')
    
    # ADDED 'is_active' so React can separate pending requests from active users!
    data = [{
        "id": m.id,
        "username": m.user.username,
        "role": m.role,
        "is_active": m.is_active, 
        "joined_at": m.joined_at.isoformat() if m.joined_at else ""
    } for m in members]
    
    return Response(data)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_split(request):
    """
    POST /api/auth/register-split/
    Registers a user and maps them either as a Root Owner with a new household 
    or as a Link Member searching by the target Owner's username.
    """
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').strip()
    password = request.data.get('password')
    role_type = request.data.get('role_type') # 'owner' or 'member'
    household_name = request.data.get('household_name', '').strip()
    target_owner_username = request.data.get('target_owner_username', '').strip()

    if not username or not password or not email:
        return Response({"error": "Missing primary credentials."}, status=400)
    
    if User.objects.filter(username=username).exists():
        return Response({"username": ["A user with that username already exists."]}, status=400)

    if len(password) < 6:
        return Response({"password": ["Ensure this field has at least 6 characters."]}, status=400)

    with transaction.atomic():
        user = User.objects.create_user(username=username, email=email, password=password)
        
        if role_type == 'owner':
            household = Household.objects.create(name=household_name if household_name else f"{username}'s Home")
            Membership.objects.create(user=user, household=household, role='owner', is_active=True)
            return Response({"message": "Owner profile initialized successfully.", "household_id": household.id}, status=201)
        
        else:
            if not target_owner_username:
                return Response({"error": "Target Owner Username is required for member routing."}, status=400)
            
            # Find the target owner's membership entry
            try:
                target_owner = User.objects.get(username=target_owner_username)
                owner_membership = Membership.objects.get(user=target_owner, role='owner')
            except (User.DoesNotExist, Membership.DoesNotExist):
                return Response({"error": "Target system owner profile not found. Verify the username."}, status=404)
                
            # Create a pending member request linked to the owner's household
            Membership.objects.create(user=user, household=owner_membership.household, role='member', is_active=False)
            return Response({"message": "Access connection request transmitted to home controller."}, status=201)
        
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    """
    GET /api/auth/search-users/?q=adi
    Live autocomplete filter searching usernames.
    """
    query = request.query_params.get('q', '').strip()
    if len(query) < 2:
        return Response([])
    
    users = User.objects.filter(username__icontains=query).exclude(id=request.user.id)[:5]
    return Response([{"id": u.id, "username": u.username} for u in users])

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def handle_join_request(request):
    """
    POST /api/auth/handle-request/
    Owner action to activate or purge pending household link requests.
    """
    membership_id = request.data.get('membership_id')
    action = request.data.get('action') # 'approve' or 'deny'
    
    try:
        req_membership = Membership.objects.get(id=membership_id)
    except Membership.DoesNotExist:
        return Response({"error": "Target request profile not found."}, status=404)

    # Validate that current execution context user is the owner of that exact household
    is_owner = Membership.objects.filter(user=request.user, household=req_membership.household, role='owner').exists()
    if not is_owner:
        return Response({"error": "Root authentication signature missing."}, status=403)

    if action == 'approve':
        req_membership.is_active = True
        req_membership.save()
        return Response({"message": "Access channel active."})
    elif action == 'deny':
        req_membership.delete()
        return Response({"message": "Access request purged."})
    
    return Response({"error": "Invalid operation value."}, status=400)