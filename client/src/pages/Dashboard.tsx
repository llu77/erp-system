import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building2 } from "lucide-react";
import {
  Package,
  Users,
  ShoppingCart,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Truck,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
};

export default function Dashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: lowStockProducts } = trpc.products.getLowStock.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  
  // استعلام فروقات البونص (للأدمن فقط)
  const { data: bonusDiscrepancies } = trpc.bonuses.getAllDiscrepancies.useQuery(
    undefined,
    { enabled: user?.role === 'admin' }
  );

  // الحصول على اسم الفرع للمشرفين
  const branchName = user?.branchId && branches 
    ? branches.find(b => b.id === user.branchId)?.nameAr || branches.find(b => b.id === user.branchId)?.name
    : null;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const statsCards = [
    {
      title: "إجمالي المنتجات",
      value: stats?.totalProducts || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "العملاء",
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "الموردين",
      value: stats?.totalSuppliers || 0,
      icon: Truck,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "مبيعات الشهر",
      value: formatCurrency(stats?.monthlySales?.total || 0),
      subValue: `${stats?.monthlySales?.count || 0} فاتورة`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "مشتريات الشهر",
      value: formatCurrency(stats?.monthlyPurchases?.total || 0),
      subValue: `${stats?.monthlyPurchases?.count || 0} طلب`,
      icon: ShoppingCart,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "مبيعات السنة",
      value: formatCurrency(stats?.yearlySales || 0),
      icon: DollarSign,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* تنبيه الفرع للمشرفين */}
      {user?.role === 'supervisor' && branchName && (
        <Alert className="bg-blue-50 border-blue-200">
          <Building2 className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">فرع {branchName}</AlertTitle>
          <AlertDescription className="text-blue-700">
            أنت تشاهد بيانات فرع {branchName} فقط
          </AlertDescription>
        </Alert>
      )}

      {/* تنبيه للمشاهدين */}
      {user?.role === 'viewer' && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">وضع المشاهدة</AlertTitle>
          <AlertDescription className="text-amber-700">
            أنت تشاهد البيانات فقط بدون صلاحية التعديل
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards - تصميم محسن */}
      <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'}`}>
        {statsCards.map((stat, index) => (
          <Card 
            key={index} 
            className="stat-card-enhanced shadow-glow shadow-glow-hover border-0 bg-card/80 backdrop-blur-sm"
          >
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-xl ${stat.bgColor} shadow-sm`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                {stat.subValue && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {stat.subValue}
                  </Badge>
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* تنبيه فروقات البونص */}
      {user?.role === 'admin' && bonusDiscrepancies && bonusDiscrepancies.totalDiscrepancies > 0 && (
        <Card className="border-red-300 bg-red-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-red-600" />
                <CardTitle className="text-lg text-red-800">
                  ⚠️ تنبيه: فروقات في البونص
                </CardTitle>
              </div>
              <Link href="/bonuses">
                <button className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 hover:underline">
                  عرض التفاصيل
                  <ExternalLink className="h-4 w-4" />
                </button>
              </Link>
            </div>
            <CardDescription className="text-red-700">
              الأسبوع {bonusDiscrepancies.weekNumber} - {bonusDiscrepancies.month}/{bonusDiscrepancies.year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-red-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-red-800 font-medium">
                    إجمالي الفروقات: {bonusDiscrepancies.totalDiscrepancies} فرق
                  </span>
                  <Badge variant="destructive">
                    {bonusDiscrepancies.branches.length} فرع
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {bonusDiscrepancies.branches.map((branch) => (
                    <div
                      key={branch.branchId}
                      className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-100"
                    >
                      <span className="text-sm font-medium text-red-900">{branch.branchName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-red-600 border-red-300">
                          {branch.discrepancyCount} فرق
                        </Badge>
                        <span className="text-xs text-red-600">
                          {branch.totalDiff.toFixed(0)} ر.س
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-red-600">
                يرجى مراجعة الإيرادات وإعادة تزامن البونص لكل فرع من صفحة البونص.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alert - تصميم محسن */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <Card className="border-0 shadow-glow overflow-hidden">
          <div className="gradient-warning p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    تنبيه نفاد المخزون
                  </h3>
                  <p className="text-white/80 text-sm">
                    {lowStockProducts.length} منتج وصل للحد الأدنى من المخزون
                  </p>
                </div>
              </div>
              <Link href="/products">
                <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  عرض الكل
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                </Button>
              </Link>
            </div>
          </div>
          <CardContent className="p-4 bg-card">
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
              {lowStockProducts.slice(0, isMobile ? 4 : 5).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border/50 hover:border-orange-300 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0 mr-2 rounded-full">
                    {product.quantity} قطعة
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity - تصميم محسن */}
      <div className={`grid gap-4 sm:gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {/* Recent Invoices */}
        <Card className="shadow-glow border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">آخر الفواتير</CardTitle>
                  <p className="text-xs text-muted-foreground">أحدث المعاملات</p>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {stats?.recentInvoices?.length || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] scrollbar-thin">
              {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentInvoices.map((invoice, idx) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-600">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {invoice.customerName || "عميل نقدي"}
                          </p>
                        </div>
                      </div>
                      <div className="text-left shrink-0 mr-3">
                        <p className="font-semibold text-emerald-600 text-sm">
                          {formatCurrency(parseFloat(invoice.total))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(invoice.invoiceDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground empty-state p-8">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p>لا توجد فواتير حديثة</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Purchase Orders - تصميم محسن */}
        <Card className="shadow-glow border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                  <ShoppingCart className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">آخر أوامر الشراء</CardTitle>
                  <p className="text-xs text-muted-foreground">طلبات المشتريات</p>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {stats?.recentPurchases?.length || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] scrollbar-thin">
              {stats?.recentPurchases && stats.recentPurchases.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentPurchases.map((order, idx) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs font-bold text-orange-600">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {order.supplierName || "مورد غير محدد"}
                          </p>
                        </div>
                      </div>
                      <div className="text-left shrink-0 mr-3">
                        <p className="font-semibold text-orange-600 text-sm">
                          {formatCurrency(parseFloat(order.total))}
                        </p>
                        <Badge
                          variant={
                            order.status === "received"
                              ? "default"
                              : order.status === "pending"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs rounded-full"
                        >
                          {order.status === "received"
                            ? "مستلم"
                            : order.status === "pending"
                            ? "قيد الانتظار"
                            : order.status === "approved"
                            ? "موافق عليه"
                            : order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground empty-state p-8">
                  <ShoppingCart className="h-12 w-12 mb-3 opacity-50" />
                  <p>لا توجد أوامر شراء حديثة</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="shadow-glow border-0">
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-xl skeleton-enhanced" />
              <Skeleton className="h-8 w-20 mt-3 skeleton-enhanced" />
              <Skeleton className="h-4 w-24 mt-2 skeleton-enhanced" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
