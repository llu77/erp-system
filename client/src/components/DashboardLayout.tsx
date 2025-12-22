import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelRight,
  Users,
  Package,
  ShoppingCart,
  FileText,
  Truck,
  UserCircle,
  BarChart3,
  Bell,
  Settings,
  Building2,
  Gift,
  DollarSign,
  Send,
  ClipboardList,
  FilePlus,
  Wallet,
  Receipt,
  Shield,
  Lock,
  Boxes,
  TrendingUp,
  Mail,
  Calendar,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { NotificationBell } from "./NotificationBell";

// تعريف الصلاحيات:
// admin: كل الصلاحيات
// manager: إدارة كاملة
// employee: موظف عادي
// supervisor: مشرف فرع - إدخال فقط بدون تعديل أو حذف
// viewer: مشاهد - مشاهدة وطباعة فقط

const menuItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
  { icon: Users, label: "المستخدمين", path: "/users", roles: ["admin"] },
  { icon: Building2, label: "الفروع", path: "/branches", roles: ["admin", "manager", "viewer"] },
  { icon: UserCircle, label: "الموظفين", path: "/employees", roles: ["admin", "manager", "viewer"] },
  { icon: Package, label: "المنتجات", path: "/products", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
  { icon: Settings, label: "الفئات", path: "/categories", roles: ["admin", "manager", "viewer"] },
  { icon: Users, label: "العملاء", path: "/customers", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
  { icon: Truck, label: "الموردين", path: "/suppliers", roles: ["admin", "manager", "viewer"] },
  { icon: FileText, label: "الفواتير", path: "/invoices", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
  { icon: ShoppingCart, label: "المشتريات", path: "/purchases", roles: ["admin", "manager", "supervisor", "viewer"] },
  { icon: DollarSign, label: "الإيرادات", path: "/revenues", roles: ["admin", "manager", "supervisor", "viewer"] },
  { icon: Gift, label: "البونص", path: "/bonuses", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
  { icon: Send, label: "طلبات البونص", path: "/bonus-requests", roles: ["admin"] },

  { icon: BarChart3, label: "التقارير", path: "/reports", roles: ["admin", "manager", "supervisor", "viewer"] },
  { icon: Bell, label: "إرسال إشعار", path: "/notifications/send", roles: ["admin", "manager"] },
  { icon: FilePlus, label: "تقديم طلب", path: "/submit-request", roles: ["admin", "manager", "employee", "supervisor"] },
  { icon: ClipboardList, label: "إدارة الطلبات", path: "/manage-requests", roles: ["admin", "manager", "supervisor", "viewer"] },
  { icon: Wallet, label: "مسيرات الرواتب", path: "/payrolls", roles: ["admin", "manager", "viewer"] },
  { icon: Receipt, label: "المصاريف", path: "/expenses", roles: ["admin", "manager", "supervisor", "viewer"] },
  { icon: Settings, label: "الإعدادات", path: "/settings", roles: ["admin"] },
  { icon: BarChart3, label: "الأرباح والخسائر", path: "/profit-loss", roles: ["admin", "manager", "viewer"] },
  { icon: TrendingUp, label: "لوحة التحكم التنفيذية", path: "/executive-dashboard", roles: ["admin", "manager", "viewer"] },
  { icon: Shield, label: "تنبيهات الأمان", path: "/security-alerts", roles: ["admin"] },
  { icon: Lock, label: "إدارة الصلاحيات", path: "/permissions", roles: ["admin"] },
  { icon: Boxes, label: "المخزون المتقدم", path: "/advanced-inventory", roles: ["admin", "manager", "viewer"] },
  { icon: BarChart3, label: "لوحة المبيعات", path: "/sales-dashboard", roles: ["admin", "manager", "viewer"] },
  { icon: Mail, label: "إعدادات التقارير", path: "/report-settings", roles: ["admin"] },
  { icon: Users, label: "بوابة الموظفين", path: "/hr-onboarding", roles: ["admin", "manager", "employee", "supervisor"] },
  { icon: Calendar, label: "مراقب النظام", path: "/scheduler", roles: ["admin"] },
  { icon: Mail, label: "مستلمي الإشعارات", path: "/notification-recipients", roles: ["admin"] },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    // توجيه المستخدم غير المسجل إلى صفحة تسجيل الدخول المحلية
    window.location.href = '/login';
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  const getRoleLabel = (role: string | undefined) => {
    switch (role) {
      case "admin":
        return "مسؤول";
      case "manager":
        return "مدير";
      case "employee":
        return "موظف";
      case "supervisor":
        return "مشرف فرع";
      case "viewer":
        return "مشاهد";
      default:
        return "مستخدم";
    }
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarRight =
        sidebarRef.current?.getBoundingClientRect().right ?? 0;
      const newWidth = sidebarRight - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || "employee");
  });

  return (
    <div className="flex min-h-screen w-full" dir="rtl">
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-l-0 border-r"
          side="right"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="تبديل القائمة"
              >
                <PanelRight className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img src="/symbol-ai-logo.png" alt="Symbol AI" className="h-8 w-8 object-contain shrink-0" />
                  <span className="font-bold tracking-tight truncate text-primary">
                    Symbol AI
                  </span>
                </div>
              ) : (
                <img src="/symbol-ai-logo.png" alt="Symbol AI" className="h-6 w-6 object-contain" />
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-2">
              {filteredMenuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-right group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "م"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "مستخدم"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {getRoleLabel(user?.role)}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="flex flex-col items-start">
                  <span className="font-medium">{user?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="flex-1">
        <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg" />}
            <h1 className="font-semibold text-lg">
              {activeMenuItem?.label ?? "لوحة التحكم"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </div>
  );
}
