from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TenantContextViewSet, 
    ActivityRecordViewSet, 
    AuthMeView, 
    SimulationLoginView, 
    SimulationLogoutView,
    ClientOnboardView,
    UserCreateView,
    AdminUserListView,
    AdminUserUpdateView,
    AdminUserDeleteView
)

router = DefaultRouter()
router.register(r'tenants', TenantContextViewSet, basename='tenant')
router.register(r'records', ActivityRecordViewSet, basename='record')

urlpatterns = [
    path('auth/me/', AuthMeView.as_view(), name='auth-me'),
    path('auth/login/', SimulationLoginView.as_view(), name='auth-login'),
    path('auth/logout/', SimulationLogoutView.as_view(), name='auth-logout'),
    path('admin/onboard-client/', ClientOnboardView.as_view(), name='admin-onboard-client'),
    path('admin/create-user/', UserCreateView.as_view(), name='admin-create-user'),
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/users/<int:pk>/', AdminUserUpdateView.as_view(), name='admin-user-update'),
    path('admin/users/<int:pk>/delete/', AdminUserDeleteView.as_view(), name='admin-user-delete'),
    path('', include(router.urls)),
]
