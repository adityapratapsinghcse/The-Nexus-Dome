from django.db import models
from django.contrib.auth.models import User

class Household(models.Model):
    name = models.CharField(max_length=100)  # e.g. "The Sharma House"
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Membership(models.Model):
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('member', 'Member'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='members')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    fcm_token = models.CharField(max_length=255, blank=True, null=True)  # this user's phone push token
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'household')

    def __str__(self):
        return f"{self.user.username} - {self.household.name} ({self.role})"