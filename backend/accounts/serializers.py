from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Household, Membership


class HouseholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Household
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class MembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    household_name = serializers.CharField(source='household.name', read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'username', 'household', 'household_name', 'role', 'joined_at']
        read_only_fields = ['id', 'username', 'household_name', 'joined_at']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    household_name = serializers.CharField()  # creating account = creating your household as owner

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )
        household = Household.objects.create(name=validated_data['household_name'])
        Membership.objects.create(user=user, household=household, role='owner')
        return {'user': user, 'household': household}