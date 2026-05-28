import uuid
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='users')
    role = models.CharField(
        max_length=50, 
        choices=[('ADMIN', 'Admin'), ('CLIENT', 'Client'), ('ANALYST', 'Analyst'), ('AUDITOR', 'Auditor')],
        default='ANALYST'
    )
    assigned_tenants = models.ManyToManyField(Tenant, blank=True, related_name='assigned_analysts')

    def __str__(self):
        return f"{self.user.username} ({self.role}) - {self.tenant.name}"

class ActivityRecord(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('SUSPICIOUS', 'Suspicious Data'),
        ('FAILED', 'Failed Ingestion'),
        ('APPROVED', 'Approved & Locked'),
    ]

    SOURCE_CHOICES = [
        ('SAP', 'SAP MM Procurement'),
        ('UTILITY', 'Utility Electricity Portal'),
        ('TRAVEL', 'Concur Flight Travel Log'),
    ]

    SCOPE_CHOICES = [
        ('Scope 1', 'Scope 1 - Direct Emissions'),
        ('Scope 2', 'Scope 2 - Indirect Grid'),
        ('Scope 3', 'Scope 3 - Value Chain Travel'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='records')
    source_system = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    scope_category = models.CharField(max_length=50, choices=SCOPE_CHOICES)
    
    # Raw Payload Storage for complete audit verification
    raw_payload = models.JSONField(help_text="Unmodified incoming raw payload block")
    raw_value = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    raw_unit = models.CharField(max_length=50, null=True, blank=True)
    
    # Normalized Core Metrics
    normalized_value = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    normalized_unit = models.CharField(max_length=50, null=True, blank=True)
    calculated_co2e_kg = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    
    # Log Interval Details
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    plant_code = models.CharField(max_length=100, null=True, blank=True)
    
    # User-provided upload label (used as a filterable tag)
    file_label = models.CharField(max_length=255, blank=True, null=True)
    
    # Status Audit States
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='PENDING')
    status_reason = models.TextField(blank=True, null=True)
    
    # Mutability Locking Guards
    is_locked = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_records')
    approved_at = models.DateTimeField(null=True, blank=True)
    def clean(self):
        # Prevent any saves/modifications on locked rows
        if self.pk:
            original = ActivityRecord.objects.filter(pk=self.pk).first()
            if original and original.is_locked:
                raise ValidationError("Cannot modify or save a locked compliance record.")
        super().clean()

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.source_system} - {self.scope_category} - {self.calculated_co2e_kg} kg CO2e ({self.status})"

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_logs')
    record = models.ForeignKey(ActivityRecord, on_delete=models.CASCADE, related_name='history')
    action = models.CharField(max_length=50) # INGEST, EDIT, APPROVE, REJECT
    field_modified = models.CharField(max_length=100, blank=True, null=True)
    original_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    reason = models.TextField(help_text="Justification for this update")
    performed_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='actions')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} on {self.record.id} by {self.performed_by.username}"
