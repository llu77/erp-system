/**
 * PortalHeader - Unified header for Employee and Admin portals
 */

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  LogOut, 
  Bell, 
  Settings,
  ChevronLeft,
  Shield,
  User
} from 'lucide-react';
import { getInitials } from '@/lib/portal/utils';
import type { PortalUser, UserRole } from '@/lib/portal/types';
import { DocumentStatusSummary } from './DocumentStatusCard';

interface PortalHeaderProps {
  user: PortalUser;
  title?: string;
  showDocumentStatus?: boolean;
  documentStatus?: {
    expiredCount: number;
    criticalCount: number;
    warningCount: number;
  };
  onLogout: () => void;
  onSettingsClick?: () => void;
  onNotificationsClick?: () => void;
  onDocumentStatusClick?: () => void;
  onBackClick?: () => void;
  showBackButton?: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'موظف',
  supervisor: 'مشرف',
  admin: 'مدير',
};

const ROLE_COLORS: Record<UserRole, string> = {
  employee: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  supervisor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export function PortalHeader({
  user,
  title,
  showDocumentStatus = false,
  documentStatus,
  onLogout,
  onSettingsClick,
  onNotificationsClick,
  onDocumentStatusClick,
  onBackClick,
  showBackButton = false,
}: PortalHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {showBackButton && onBackClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBackClick}
                className="text-slate-400 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            
            {/* Logo/Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {title || 'بوابة الموظفين'}
                </h1>
                {user.branchName && (
                  <p className="text-xs text-slate-400">
                    فرع {user.branchName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Center Section - Document Status */}
          {showDocumentStatus && documentStatus && (
            <div className="hidden md:block">
              <DocumentStatusSummary
                expiredCount={documentStatus.expiredCount}
                criticalCount={documentStatus.criticalCount}
                warningCount={documentStatus.warningCount}
                onClick={onDocumentStatusClick}
              />
            </div>
          )}

          {/* Right Section - User Info & Actions */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            {onNotificationsClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNotificationsClick}
                className="text-slate-400 hover:text-white relative"
              >
                <Bell className="h-5 w-5" />
                {/* Notification badge - can be dynamic */}
              </Button>
            )}

            {/* Settings */}
            {onSettingsClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSettingsClick}
                className="text-slate-400 hover:text-white"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}

            {/* User Profile */}
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 text-white text-sm">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-white">
                  {user.name}
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${ROLE_COLORS[user.role]} border`}
                >
                  {user.isSupervisor ? (
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[user.role]}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {ROLE_LABELS[user.role]}
                    </span>
                  )}
                </Badge>
              </div>
            </div>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="text-slate-400 hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
