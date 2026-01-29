/**
 * PortalNavigation - Tab-based navigation for portals
 */

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Bot,
  FileText,
  Wallet,
  CalendarDays,
  Gift,
  UserCircle,
  Home,
  Users,
  IdCard,
  BarChart3
} from 'lucide-react';
import { EMPLOYEE_PORTAL_TABS, ADMIN_PORTAL_TABS } from '@/lib/portal/constants';
import type { TabConfig, UserRole } from '@/lib/portal/types';

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
  Bot: <Bot className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  Wallet: <Wallet className="h-4 w-4" />,
  CalendarDays: <CalendarDays className="h-4 w-4" />,
  Gift: <Gift className="h-4 w-4" />,
  UserCircle: <UserCircle className="h-4 w-4" />,
  Home: <Home className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  IdCard: <IdCard className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
};

interface PortalNavigationProps {
  role: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  badges?: Record<string, number>;
  customTabs?: TabConfig[];
  className?: string;
}

export function PortalNavigation({
  role,
  activeTab,
  onTabChange,
  badges = {},
  customTabs,
  className = '',
}: PortalNavigationProps) {
  // Get tabs based on role or use custom tabs
  const tabs = customTabs || (role === 'employee' 
    ? EMPLOYEE_PORTAL_TABS 
    : ADMIN_PORTAL_TABS
  );

  return (
    <div className={`bg-slate-900/50 border-b border-slate-800 ${className}`}>
      <div className="container mx-auto px-4">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="bg-transparent h-auto p-0 gap-1 flex-wrap justify-start">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                disabled={'disabled' in tab ? tab.disabled : false}
                className="
                  data-[state=active]:bg-orange-500/20 
                  data-[state=active]:text-orange-400 
                  data-[state=active]:border-orange-500/30
                  data-[state=inactive]:text-slate-400
                  data-[state=inactive]:hover:text-white
                  data-[state=inactive]:hover:bg-slate-800/50
                  border border-transparent
                  rounded-lg px-4 py-2.5
                  transition-all duration-200
                  flex items-center gap-2
                "
              >
                {ICON_MAP[tab.icon] || null}
                <span className="hidden sm:inline">{tab.label}</span>
                {badges[tab.id] && badges[tab.id] > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="h-5 min-w-5 px-1.5 text-xs bg-red-500"
                  >
                    {badges[tab.id]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * PortalTabContent - Wrapper for tab content with consistent styling
 */
interface PortalTabContentProps {
  children: React.ReactNode;
  className?: string;
}

export function PortalTabContent({ children, className = '' }: PortalTabContentProps) {
  return (
    <div className={`container mx-auto px-4 py-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * PortalEmptyState - Empty state for tabs with no content
 */
interface PortalEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function PortalEmptyState({
  icon,
  title,
  description,
  action,
}: PortalEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-slate-400 max-w-md mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
