import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  ShoppingCart,
  BarChart3,
  Settings,
  Printer,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Store,
  Users,
  Package,
  Receipt,
  Crown,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface POSLayoutProps {
  children: React.ReactNode;
}

const posNavItems = [
  {
    title: 'الكاشير',
    href: '/pos',
    icon: ShoppingCart,
    description: 'نقطة البيع الرئيسية',
  },
  {
    title: 'تقرير اليوم',
    href: '/pos-daily-report',
    icon: BarChart3,
    description: 'إحصائيات ومبيعات اليوم',
  },
  {
    title: 'إعدادات الكاشير',
    href: '/pos-settings',
    icon: Settings,
    description: 'إدارة الأقسام والخدمات',
  },
  {
    title: 'إعدادات الطباعة',
    href: '/pos-print-settings',
    icon: Printer,
    description: 'إعدادات الفاتورة الحرارية',
  },
];

export default function POSLayout({ children }: POSLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';

  return (
    <div className="h-screen flex bg-background overflow-hidden" dir="rtl">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative inset-y-0 right-0 z-50 flex flex-col bg-card border-l transition-all duration-300",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          sidebarCollapsed ? "w-20" : "w-72"
        )}
      >
        {/* Header */}
        <div className={cn(
          "h-16 flex items-center border-b px-4",
          sidebarCollapsed ? "justify-center" : "justify-between"
        )}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-sm">بوابة الكاشير</h2>
                <p className="text-xs text-muted-foreground">Symbol AI</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Store className="h-5 w-5 text-primary" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 hidden lg:flex", sidebarCollapsed && "absolute -left-4 bg-card border shadow-sm")}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-3">
            {posNavItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 h-12",
                      sidebarCollapsed && "justify-center px-0",
                      isActive && "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    {!sidebarCollapsed && (
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      </div>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {!sidebarCollapsed && (
            <>
              <Separator className="my-4 mx-3" />
              
              {/* Quick Stats */}
              <div className="px-3 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground px-2">روابط سريعة</h3>
                {isAdmin && (
                  <Link href="/dashboard">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm">
                      <Crown className="h-4 w-4 text-amber-500" />
                      لوحة التحكم الرئيسية
                    </Button>
                  </Link>
                )}
                {(isAdmin || isSupervisor) && (
                  <Link href="/employees">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm">
                      <Users className="h-4 w-4" />
                      إدارة الموظفين
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}
        </ScrollArea>

        {/* User Section */}
        <div className={cn(
          "border-t p-3",
          sidebarCollapsed && "flex justify-center"
        )}>
          {!sidebarCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {user?.name?.charAt(0) || 'م'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'مستخدم'}</p>
                  <Badge variant="outline" className="text-xs">
                    {user?.role === 'admin' ? 'مدير' : user?.role === 'supervisor' ? 'مشرف' : 'موظف'}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-destructive hover:text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 lg:hidden flex items-center justify-between px-4 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <span className="font-bold">بوابة الكاشير</span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
