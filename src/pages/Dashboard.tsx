import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, SUPER_ADMIN_EMAILS } from '../store/useAuthStore';
import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import MerchantDashboard from '../components/dashboard/MerchantDashboard';
import CaptainDashboard from '../components/dashboard/CaptainDashboard';
import SupportDashboard from '../components/dashboard/SupportDashboard';
import CustomerDashboard from '../components/dashboard/CustomerDashboard';
import CaptainSettlementManager from '../components/finance/CaptainSettlementManager';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, roles, activeRole } = useAuthStore();

  // Current user permissions
  const approvedRoleNames = roles.filter(r => r.status === 'approved').map(r => r.role);
  const isSuperAdmin = Boolean(
    user?.email &&
    SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) &&
    approvedRoleNames.includes('SUPER_ADMIN')
  );
  const isAdmin = isSuperAdmin || approvedRoleNames.includes('ADMIN');
  const isSupport = isAdmin || approvedRoleNames.includes('SUPPORT');
  const isCaptain = isAdmin || approvedRoleNames.includes('CAPTAIN');
  const isMerchant = isAdmin || approvedRoleNames.some(r => 
    ['RESTAURANT', 'SUPERMARKET', 'FASHION', 'BEAUTY', 'UMRAH', 'CAR_SELLER', 'FOOD_MERCHANT', 'MARKET_MERCHANT', 'FASHION_MERCHANT', 'CARS_MERCHANT', 'TECH_MERCHANT', 'TECH'].includes(r)
  );

  const canAccessRole = (roleId: string): boolean => {
    if (isSuperAdmin) return true;
    if (roleId === 'SUPER_ADMIN') return false;
    if (roleId === 'ADMIN') return isAdmin;
    if (roleId === 'SUPPORT') return isSupport;
    if (roleId === 'CAPTAIN') return isCaptain;
    if (roleId === 'CAPTAIN_FINANCE') return isAdmin;
    if (['RESTAURANT', 'SUPERMARKET', 'FASHION', 'BEAUTY', 'UMRAH', 'CAR_SELLER'].includes(roleId)) return isMerchant;
    if (roleId === 'CUSTOMER') return true;
    return false;
  };

  // Default allowed fallback role
  const defaultAllowedRole = isSuperAdmin
    ? 'SUPER_ADMIN'
    : isAdmin
    ? 'ADMIN'
    : isMerchant
    ? 'RESTAURANT'
    : isCaptain
    ? 'CAPTAIN'
    : isSupport
    ? 'SUPPORT'
    : 'CUSTOMER';

  const effectiveRole = activeRole && canAccessRole(activeRole) ? activeRole : defaultAllowedRole;

  return (
    <div className="space-y-6">
      {/* Render Dedicated Role Dashboard */}
      {effectiveRole === 'SUPER_ADMIN' && <SuperAdminDashboard />}
      {effectiveRole === 'ADMIN' && <AdminDashboard />}
      {['RESTAURANT', 'SUPERMARKET', 'FASHION', 'BEAUTY', 'UMRAH', 'CAR_SELLER', 'CARS_MERCHANT', 'FASHION_MERCHANT'].includes(effectiveRole) && (
        <MerchantDashboard />
      )}
      {effectiveRole === 'CAPTAIN' && <CaptainDashboard />}
      {effectiveRole === 'CAPTAIN_FINANCE' && (
        <CaptainSettlementManager
          title="حیساباتی پارەی لای کاپتن و تۆمارکردنی گەڕاندنەوە (Captain Cash Settlements Hub)"
          showFleetSelector={true}
        />
      )}
      {effectiveRole === 'SUPPORT' && <SupportDashboard />}
      {effectiveRole === 'CUSTOMER' && <CustomerDashboard />}
    </div>
  );
}
