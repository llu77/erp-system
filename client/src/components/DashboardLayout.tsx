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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
  Settings,
  Building2,
  Gift,
  DollarSign,
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
  MinusCircle,
  ChevronDown,
  ChevronLeft,
  Banknote,
  Store,
  LineChart,
  FolderOpen,
  ListOrdered,
  ClipboardCheck,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { NotificationBell } from "./NotificationBell";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// تعريف الصلاحيات:
// admin: كل الصلاحيات
// manager: إدارة كاملة
// employee: موظف عادي
// supervisor: مشرف فرع - إدخال فقط بدون تعديل أو حذف
// viewer: مشاهد - مشاهدة وطباعة فقط

// هيكل القائمة الجديد مع التصنيفات
type MenuItem = {
  icon: any;
  label: string;
  path?: string;
  roles: string[];
  children?: MenuItem[];
};

const menuStructure: MenuItem[] = [
  // لوحة التحكم الرئيسية
  { 
    icon: LayoutDashboard, 
    label: "لوحة التحكم", 
    path: "/", 
    roles: ["admin", "manager", "employee", "supervisor", "viewer"] 
  },
  
  // المتابعة والتقارير
  {
    icon: LineChart,
    label: "المتابعة",
    roles: ["admin", "manager", "viewer"],
    children: [
      { icon: TrendingUp, label: "لوحة التحكم التنفيذية", path: "/executive-dashboard", roles: ["admin", "manager", "viewer"] },
      { icon: BarChart3, label: "الأرباح والخسائر", path: "/profit-loss", roles: ["admin", "manager", "viewer"] },
      { icon: Store, label: "لوحة المبيعات", path: "/sales-dashboard", roles: ["admin", "manager", "viewer"] },
      { icon: BarChart3, label: "التقارير", path: "/reports", roles: ["admin", "manager", "supervisor", "viewer"] },
    ]
  },
  
  // المبيعات
  {
    icon: Receipt,
    label: "المبيعات",
    roles: ["admin", "manager", "employee", "supervisor", "viewer"],
    children: [
      { icon: FileText, label: "الفواتير", path: "/invoices", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
      { icon: MinusCircle, label: "فواتير الموظفين", path: "/employee-invoices", roles: ["admin", "manager", "supervisor"] },
      { icon: Users, label: "العملاء", path: "/customers", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
    ]
  },
  
  // المعاملات المالية
  {
    icon: Banknote,
    label: "المعاملات المالية",
    roles: ["admin", "manager", "supervisor", "viewer"],
    children: [
      { icon: DollarSign, label: "الإيرادات", path: "/revenues", roles: ["admin", "manager", "supervisor", "viewer"] },
      { icon: Receipt, label: "المصاريف", path: "/expenses", roles: ["admin", "manager", "supervisor", "viewer"] },
      { icon: Gift, label: "البونص", path: "/bonuses", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
      { icon: Wallet, label: "مسيرات الرواتب", path: "/payrolls", roles: ["admin", "manager", "viewer"] },
    ]
  },
  
  // المخزون
  {
    icon: Boxes,
    label: "المخزون",
    roles: ["admin", "manager", "employee", "supervisor", "viewer"],
    children: [
      { icon: Package, label: "المنتجات", path: "/products", roles: ["admin", "manager", "employee", "supervisor", "viewer"] },
      { icon: ShoppingCart, label: "المشتريات", path: "/purchases", roles: ["admin", "manager", "supervisor", "viewer"] },
      { icon: ClipboardList, label: "الجرد الفعلي", path: "/inventory-counting", roles: ["admin", "manager", "supervisor"] },
      { icon: FileText, label: "تقرير فروقات الجرد", path: "/inventory-variance-report", roles: ["admin", "manager", "viewer"] },
      { icon: FolderOpen, label: "الفئات", path: "/categories", roles: ["admin", "manager", "viewer"] },
    ]
  },
  
  // الطلبات
  {
    icon: ListOrdered,
    label: "الطلبات",
    roles: ["admin", "manager", "employee", "supervisor", "viewer"],
    children: [
      { icon: FilePlus, label: "تقديم طلب", path: "/submit-request", roles: ["admin", "manager", "employee", "supervisor"] },
      { icon: ClipboardList, label: "إدارة الطلبات", path: "/manage-requests", roles: ["admin", "manager", "supervisor", "viewer"] },
      { icon: Gift, label: "طلبات البونص", path: "/bonus-requests", roles: ["admin"] },
    ]
  },
  
  // إدارة الموارد
  {
    icon: Building2,
    label: "إدارة الموارد",
    roles: ["admin", "manager", "viewer"],
    children: [
      { icon: Building2, label: "الفروع", path: "/branches", roles: ["admin", "manager", "viewer"] },
      { icon: UserCircle, label: "الموظفين", path: "/employees", roles: ["admin", "manager", "viewer"] },
      { icon: Truck, label: "الموردين", path: "/suppliers", roles: ["admin", "manager", "viewer"] },
      { icon: Users, label: "بوابة الموظفين", path: "/hr-onboarding", roles: ["admin", "manager", "employee", "supervisor"] },
    ]
  },
  
  // إدارة المهام
  {
    icon: ClipboardCheck,
    label: "إدارة المهام",
    path: "/task-management",
    roles: ["admin", "manager"],
  },
  
  // إعدادات النظام (للأدمن فقط)
  {
    icon: Settings,
    label: "إعدادات النظام",
    roles: ["admin"],
    children: [
      { icon: Users, label: "المستخدمين", path: "/users", roles: ["admin"] },
      { icon: Lock, label: "إدارة الصلاحيات", path: "/permissions", roles: ["admin"] },
      { icon: Shield, label: "تنبيهات الأمان", path: "/security-alerts", roles: ["admin"] },
      { icon: Mail, label: "إعدادات التقارير", path: "/report-settings", roles: ["admin"] },
      { icon: Mail, label: "مستلمي الإشعارات", path: "/notification-recipients", roles: ["admin"] },
      { icon: Calendar, label: "مراقب النظام", path: "/scheduler", roles: ["admin"] },
      { icon: Settings, label: "الإعدادات", path: "/settings", roles: ["admin"] },
    ]
  },
];

// قائمة مسطحة للبحث عن العنصر النشط
const flatMenuItems = menuStructure.flatMap(item => 
  item.children ? [item, ...item.children] : [item]
).filter(item => item.path);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
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
  const activeMenuItem = flatMenuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();
  
  // حالة فتح/إغلاق القوائم الفرعية
  const [openMenus, setOpenMenus] = useState<string[]>(() => {
    // فتح القائمة التي تحتوي على الصفحة الحالية تلقائياً
    const parentMenu = menuStructure.find(menu => 
      menu.children?.some(child => child.path === location)
    );
    return parentMenu ? [parentMenu.label] : [];
  });

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

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

  // تصفية القائمة حسب صلاحيات المستخدم
  const filterMenuByRole = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter(item => item.roles.includes(user?.role || "employee"))
      .map(item => ({
        ...item,
        children: item.children ? filterMenuByRole(item.children) : undefined
      }))
      .filter(item => !item.children || item.children.length > 0);
  };

  const filteredMenu = filterMenuByRole(menuStructure);

  // إخفاء "إدارة الطلبات" من مشرفي الفروع (الذين لديهم branchId)
  const finalMenu = filteredMenu.map(item => {
    if (item.children) {
      return {
        ...item,
        children: item.children.filter(child => {
          if (child.path === "/manage-requests" && user?.role === "supervisor" && user?.branchId) {
            return false;
          }
          return true;
        })
      };
    }
    return item;
  }).filter(item => !item.children || item.children.length > 0);

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

  // فتح القائمة الأب عند تغيير الصفحة
  useEffect(() => {
    const parentMenu = menuStructure.find(menu => 
      menu.children?.some(child => child.path === location)
    );
    if (parentMenu && !openMenus.includes(parentMenu.label)) {
      setOpenMenus(prev => [...prev, parentMenu.label]);
    }
  }, [location]);

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

          <SidebarContent className="gap-0 overflow-y-auto">
            <SidebarMenu className="px-2 py-2">
              {finalMenu.map((item) => {
                // عنصر بدون أطفال (رابط مباشر)
                if (!item.children) {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path!)}
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
                }

                // عنصر مع أطفال (قائمة قابلة للطي)
                const isOpen = openMenus.includes(item.label);
                const hasActiveChild = item.children.some(child => child.path === location);

                return (
                  <Collapsible
                    key={item.label}
                    open={isOpen}
                    onOpenChange={() => toggleMenu(item.label)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal ${hasActiveChild ? "bg-accent/50" : ""}`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${hasActiveChild ? "text-primary" : ""}`}
                          />
                          <span className={hasActiveChild ? "font-medium" : ""}>{item.label}</span>
                          <ChevronDown
                            className={`mr-auto h-4 w-4 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="mr-4 border-r border-border/50 pr-2">
                          {item.children.map((child) => {
                            const isChildActive = location === child.path;
                            return (
                              <SidebarMenuSubItem key={child.path}>
                                <SidebarMenuSubButton
                                  onClick={() => setLocation(child.path!)}
                                  isActive={isChildActive}
                                  className={`h-9 transition-all ${isChildActive ? "bg-primary/10 text-primary font-medium" : ""}`}
                                >
                                  <child.icon className={`h-3.5 w-3.5 ${isChildActive ? "text-primary" : "text-muted-foreground"}`} />
                                  <span>{child.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-right group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
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
