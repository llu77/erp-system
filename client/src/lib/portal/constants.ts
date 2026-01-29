/**
 * Portal Constants - Shared across Employee and Admin portals
 */

// Request type names in Arabic
export const REQUEST_TYPE_NAMES: Record<string, string> = {
  advance: 'سلفة',
  vacation: 'إجازة',
  arrears: 'صرف متأخرات',
  permission: 'استئذان',
  objection: 'اعتراض على مخالفة',
  resignation: 'استقالة',
} as const;

// Request type icons (Lucide icon names)
export const REQUEST_TYPE_ICONS: Record<string, string> = {
  advance: 'Wallet',
  vacation: 'Calendar',
  arrears: 'DollarSign',
  permission: 'Clock',
  objection: 'AlertCircle',
  resignation: 'LogOut',
} as const;

// Status names in Arabic
export const STATUS_NAMES: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
} as const;

// Status colors (Tailwind classes)
export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
} as const;

// Status badge variants
export const STATUS_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
} as const;

// Document status thresholds (days)
export const DOCUMENT_THRESHOLDS = {
  EXPIRED: 0,
  CRITICAL: 7,    // Less than 7 days
  WARNING: 30,    // Less than 30 days
  UPCOMING: 60,   // Less than 60 days
} as const;

// Document status colors
export const DOCUMENT_STATUS_COLORS = {
  expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  critical: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  valid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  missing: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
} as const;

// Document type names in Arabic
export const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  iqama: 'الإقامة',
  healthCert: 'الشهادة الصحية',
  contract: 'عقد العمل',
} as const;

// Portal tabs configuration
export const EMPLOYEE_PORTAL_TABS = [
  { id: 'assistant', label: 'المساعد', icon: 'Bot' },
  { id: 'requests', label: 'طلباتي', icon: 'FileText' },
  { id: 'salary', label: 'الراتب', icon: 'Wallet' },
  { id: 'leaves', label: 'الإجازات', icon: 'CalendarDays' },
  { id: 'bonus', label: 'البونص', icon: 'Gift' },
  { id: 'profile', label: 'ملفي', icon: 'UserCircle' },
] as const;

export const ADMIN_PORTAL_TABS = [
  { id: 'dashboard', label: 'الرئيسية', icon: 'Home' },
  { id: 'requests', label: 'الطلبات', icon: 'FileText' },
  { id: 'employees', label: 'الموظفين', icon: 'Users' },
  { id: 'documents', label: 'الوثائق', icon: 'IdCard' },
  { id: 'reports', label: 'التقارير', icon: 'BarChart3' },
  { id: 'myProfile', label: 'ملفي', icon: 'UserCircle' },
] as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;
