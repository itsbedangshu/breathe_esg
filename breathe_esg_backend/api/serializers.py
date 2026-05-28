from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Tenant, UserProfile, ActivityRecord, AuditLog

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'domain', 'created_at']

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    tenant = serializers.SerializerMethodField()
    assigned_tenants = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'tenant', 'assigned_tenants']

    def get_role(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.role
        return 'ANALYST'

    def get_tenant(self, obj):
        if hasattr(obj, 'profile'):
            return TenantSerializer(obj.profile.tenant).data
        return None

    def get_assigned_tenants(self, obj):
        if hasattr(obj, 'profile'):
            return TenantSerializer(obj.profile.assigned_tenants.all(), many=True).data
        return []

class AuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 
            'action', 
            'field_modified', 
            'original_value', 
            'new_value', 
            'reason', 
            'performed_by_name', 
            'timestamp'
        ]

class ActivityRecordSerializer(serializers.ModelSerializer):
    history = AuditLogSerializer(many=True, read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = ActivityRecord
        fields = [
            'id',
            'tenant_name',
            'source_system',
            'scope_category',
            'raw_payload',
            'raw_value',
            'raw_unit',
            'normalized_value',
            'normalized_unit',
            'calculated_co2e_kg',
            'period_start',
            'period_end',
            'plant_code',
            'file_label',
            'status',
            'status_reason',
            'is_locked',
            'approved_by_name',
            'approved_at',
            'history'
        ]
