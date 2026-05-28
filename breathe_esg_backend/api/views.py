from datetime import datetime
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authentication import SessionAuthentication, BasicAuthentication

from .models import Tenant, UserProfile, ActivityRecord, AuditLog
from .serializers import (
    TenantSerializer, 
    UserSerializer, 
    ActivityRecordSerializer, 
    AuditLogSerializer
)
from .parsers import ingest_sap_data, ingest_utility_data, ingest_travel_data

class TenantContextViewSet(viewsets.ModelViewSet):
    """
    Lists available tenants for analyst context simulation switching.
    """
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [AllowAny]

class AuthMeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            return Response(UserSerializer(request.user).data)
        return Response({"authenticated": False}, status=status.HTTP_200_OK)

class SimulationLoginView(APIView):
    """
    Simulates simple Enterprise SSO session authentication.
    Returns available mock profiles to switch between instantly.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # List profiles to easily test switching roles/tenants
        profiles = UserProfile.objects.all()
        data = []
        for p in profiles:
            data.append({
                "username": p.user.username,
                "email": p.user.email,
                "role": p.role,
                "tenant_name": p.tenant.name if p.tenant else "N/A",
                "tenant_id": str(p.tenant.id) if p.tenant else "",
                "assigned_tenant_ids": [str(t.id) for t in p.assigned_tenants.all()]
            })
        return Response(data)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        if not email or not password:
            return Response({"error": "Missing email or password"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Query by email
        user = User.objects.filter(email=email).first()
        if not user:
            return Response({"error": "Invalid email or password"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Authenticate using standard Django auth
        authenticated_user = authenticate(username=user.username, password=password)
        if authenticated_user:
            login(request, authenticated_user)
            return Response(UserSerializer(authenticated_user).data)
        
        return Response({"error": "Invalid email or password"}, status=status.HTTP_400_BAD_REQUEST)

class SimulationLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({"success": True})

class ActivityRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ActivityRecordSerializer
    permission_classes = [AllowAny] # Using simulated cookie login

    def get_base_queryset(self):
        """Returns the base queryset restricted by tenant access rules without applying filters."""
        tenant_param = self.request.query_params.get('tenant_id')
        if hasattr(self.request, 'user') and self.request.user.is_authenticated and hasattr(self.request.user, 'profile'):
            profile = self.request.user.profile
            if profile.role == 'ADMIN':
                if tenant_param:
                    return ActivityRecord.objects.filter(tenant_id=tenant_param)
                return ActivityRecord.objects.all()
            elif profile.role == 'CLIENT':
                return ActivityRecord.objects.filter(tenant=profile.tenant)
            elif profile.role == 'ANALYST':
                allowed_tenants = profile.assigned_tenants.all()
                if tenant_param:
                    if allowed_tenants.filter(id=tenant_param).exists():
                        return ActivityRecord.objects.filter(tenant_id=tenant_param)
                    return ActivityRecord.objects.none()
                return ActivityRecord.objects.filter(tenant__in=allowed_tenants)
        
        # Fallback for prototype session simulation switching
        if tenant_param:
            return ActivityRecord.objects.filter(tenant_id=tenant_param)
        return ActivityRecord.objects.all()

    def get_queryset(self):
        queryset = self.get_base_queryset()

        # Apply rich filtering logic
        source_system = self.request.query_params.get('source_system')
        scope_category = self.request.query_params.get('scope_category')
        status_val = self.request.query_params.get('status')
        search_query = self.request.query_params.get('search')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        file_label = self.request.query_params.get('file_label')
        plant_code = self.request.query_params.get('plant_code')
        sort_by = self.request.query_params.get('sort_by')

        if source_system:
            queryset = queryset.filter(source_system=source_system)
        if scope_category:
            queryset = queryset.filter(scope_category=scope_category)
        if status_val:
            queryset = queryset.filter(status=status_val)
        if file_label:
            queryset = queryset.filter(file_label=file_label)
        if plant_code:
            queryset = queryset.filter(plant_code=plant_code)
        if start_date and end_date:
            queryset = queryset.filter(period_start__gte=start_date, period_end__lte=end_date)
        
        if search_query:
            queryset = queryset.filter(
                Q(raw_payload__icontains=search_query) |
                Q(status_reason__icontains=search_query) |
                Q(plant_code__icontains=search_query) |
                Q(file_label__icontains=search_query)
            )
            
        if sort_by == 'emissions_desc':
            queryset = queryset.order_by('-calculated_co2e_kg')
        elif sort_by == 'emissions_asc':
            queryset = queryset.order_by('calculated_co2e_kg')
        elif sort_by == 'date_desc':
            queryset = queryset.order_by('-period_start')
        elif sort_by == 'date_asc':
            queryset = queryset.order_by('period_start')
        else:
            queryset = queryset.order_by('-id')

        return queryset.order_index() if hasattr(queryset, 'order_index') else queryset.order_by('-period_start', '-calculated_co2e_kg')

    @action(detail=False, methods=['get'])
    def filter_options(self, request):
        """
        Returns dynamic filter metadata (e.g. distinct file labels and plant codes) for the given tenant.
        """
        qs = self.get_base_queryset()
        
        # distinct() in PostgreSQL works across single fields nicely or we can just use values_list and set
        file_labels = list(qs.exclude(file_label__isnull=True).exclude(file_label='').values_list('file_label', flat=True).distinct())
        plant_codes = list(qs.exclude(plant_code__isnull=True).exclude(plant_code='').values_list('plant_code', flat=True).distinct())

        return Response({
            'file_labels': file_labels,
            'plant_codes': plant_codes
        })

    @action(detail=False, methods=['post'], url_path='upload')
    def upload_file(self, request):
        """
        Ingests CSV files. Auto-detects the source type from CSV headers.
        Accepts an optional file_label to tag records for filtering.
        """
        file_obj = request.FILES.get('file')
        tenant_id = request.data.get('tenant_id')
        file_label = request.data.get('file_label', '').strip()

        if not file_obj:
            return Response(
                {"error": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve tenant
        if tenant_id:
            tenant = Tenant.objects.filter(id=tenant_id).first()
        elif request.user.is_authenticated and hasattr(request.user, 'profile'):
            tenant = request.user.profile.tenant
        else:
            tenant = Tenant.objects.first()

        if not tenant:
            return Response({"error": "Please select a client."}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve user profile
        user = request.user if request.user.is_authenticated else User.objects.first()

        file_content = file_obj.read().decode('utf-8')

        # Auto-detect source type from CSV headers
        import csv, io
        sample = io.StringIO(file_content)
        try:
            reader = csv.DictReader(sample)
            headers = set(h.strip() for h in (reader.fieldnames or []))
        except:
            return Response({"error": "Could not read CSV headers."}, status=status.HTTP_400_BAD_REQUEST)

        # Match known header patterns
        sap_headers = {'BUDAT', 'WERKS', 'MATNR', 'MENGE', 'MEINS'}
        utility_headers = {'Account_Number', 'Usage_kWh', 'Billing_Start_Date'}
        travel_headers = {'Employee_ID', 'Segment_Departure_Airport', 'Cabin_Class'}

        if sap_headers.issubset(headers):
            source_type = 'SAP'
        elif utility_headers.issubset(headers):
            source_type = 'UTILITY'
        elif travel_headers.issubset(headers):
            source_type = 'TRAVEL'
        else:
            return Response(
                {"error": f"Could not detect data format. Headers found: {', '.join(sorted(headers))}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if source_type == 'SAP':
                records = ingest_sap_data(file_content, tenant, user)
            elif source_type == 'UTILITY':
                records = ingest_utility_data(file_content, tenant, user)
            else:
                records = ingest_travel_data(file_content, tenant, user)
        except Exception as e:
            return Response({"error": f"Processing failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Stamp file_label on all created records
        if file_label:
            for rec in records:
                rec.file_label = file_label
                rec.save(update_fields=['file_label']) if rec.pk else None

        return Response(ActivityRecordSerializer(records, many=True).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """
        Custom update handles double-entry audit logging on modifications.
        """
        instance = self.get_object()
        if instance.is_locked:
            return Response({"error": "Cannot edit a locked record."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else User.objects.first()
        reason = request.data.get('reason', 'Compliance analyst manual correction')

        # Intercept modified fields to generate specific audit trail logs
        modified_fields = []
        for field, new_val in request.data.items():
            if field == 'reason':
                continue
            orig_val = getattr(instance, field, None)
            
            # Format and comparison logic
            str_new = str(new_val)
            str_orig = str(orig_val)
            if str_new != str_orig:
                modified_fields.append((field, str_orig, str_new))

        # Check recalculation triggers (quantity or period updates)
        response = super().update(request, *args, **kwargs)
        
        # Save was successful, save explicit audit history details
        instance.refresh_from_db()
        
        # Recalculate carbon dynamically if quantity fields changed
        if any(f[0] in ['normalized_value', 'raw_value'] for f in modified_fields):
            if instance.source_system == 'SAP':
                instance.calculated_co2e_kg = instance.normalized_value * Decimal('2.68')
            elif instance.source_system == 'UTILITY':
                # Map standard utility factors
                instance.calculated_co2e_kg = instance.normalized_value * Decimal('0.35')
            elif instance.source_system == 'TRAVEL':
                instance.calculated_co2e_kg = instance.normalized_value * Decimal('0.15')
            instance.save()

        for field, orig, new in modified_fields:
            AuditLog.objects.create(
                tenant=instance.tenant,
                record=instance,
                action='EDIT',
                field_modified=field,
                original_value=orig,
                new_value=new,
                reason=reason,
                performed_by=user
            )

        return Response(ActivityRecordSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Locks the record from future edits, certifying compliance.
        """
        record = self.get_object()
        if record.is_locked:
            return Response({"error": "Record is already approved and locked."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else User.objects.first()

        record.is_locked = True
        record.status = 'APPROVED'
        record.approved_by = user
        record.approved_at = timezone.now()
        record.save()

        # Log locking action in history trail
        AuditLog.objects.create(
            tenant=record.tenant,
            record=record,
            action='APPROVE',
            reason="Analyst signed off and cryptographically locked compliance records",
            performed_by=user
        )

        return Response(ActivityRecordSerializer(record).data)

class ClientOnboardView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        name = request.data.get('name')
        domain = request.data.get('domain')
        if not name or not domain:
            return Response({"error": "Missing name or domain"}, status=status.HTTP_400_BAD_REQUEST)
        if Tenant.objects.filter(domain=domain).exists():
            return Response({"error": "Client with this domain already exists"}, status=status.HTTP_400_BAD_REQUEST)
        tenant = Tenant.objects.create(name=name, domain=domain)
        # Auto-assign new tenant to all admin users so it appears in their scope immediately
        admin_profiles = UserProfile.objects.filter(role='ADMIN')
        for profile in admin_profiles:
            profile.assigned_tenants.add(tenant)
        return Response(TenantSerializer(tenant).data, status=status.HTTP_201_CREATED)

class UserCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email', '')
        password = request.data.get('password', 'password123')
        role = request.data.get('role')
        tenant_id = request.data.get('tenant_id')
        assigned_tenant_ids = request.data.get('assigned_tenant_ids', [])

        if not username or not role or not tenant_id:
            return Response({"error": "Missing username, role, or home tenant"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "User already exists"}, status=status.HTTP_400_BAD_REQUEST)

        tenant = Tenant.objects.filter(id=tenant_id).first()
        if not tenant:
            return Response({"error": "Selected home tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        profile = UserProfile.objects.create(user=user, tenant=tenant, role=role)

        if assigned_tenant_ids:
            tenants = Tenant.objects.filter(id__in=assigned_tenant_ids)
            profile.assigned_tenants.set(tenants)

        return Response({
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": profile.role,
            "tenant_name": tenant.name
        }, status=status.HTTP_201_CREATED)

class AdminUserListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        users = User.objects.all().select_related('profile')
        return Response(UserSerializer(users, many=True).data)

class AdminUserUpdateView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request, pk):
        user = User.objects.filter(id=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        
        role = request.data.get('role')
        tenant_id = request.data.get('tenant_id')
        assigned_tenant_ids = request.data.get('assigned_tenant_ids')

        profile = getattr(user, 'profile', None)
        if not profile:
            return Response({"error": "User profile not found"}, status=status.HTTP_400_BAD_REQUEST)

        if role:
            profile.role = role
        if tenant_id:
            tenant = Tenant.objects.filter(id=tenant_id).first()
            if tenant:
                profile.tenant = tenant
        
        profile.save()

        if assigned_tenant_ids is not None:
            tenants = Tenant.objects.filter(id__in=assigned_tenant_ids)
            profile.assigned_tenants.set(tenants)

        return Response(UserSerializer(user).data)

class AdminUserDeleteView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request, pk):
        user = User.objects.filter(id=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent self deletion of current admin to protect workspace demo
        if request.user.is_authenticated and request.user.id == user.id:
            return Response({"error": "Cannot delete your own active session account"}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response({"success": True})
