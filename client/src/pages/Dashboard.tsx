import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
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
} from "lucide-react";
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
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: lowStockProducts } = trpc.products.getLowStock.useQuery();

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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                {stat.subValue && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.subValue}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg text-orange-800">
                تنبيه نفاد المخزون
              </CardTitle>
            </div>
            <CardDescription className="text-orange-700">
              {lowStockProducts.length} منتج وصل للحد الأدنى من المخزون
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {lowStockProducts.slice(0, 4).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.sku}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0 mr-2">
                    {product.quantity} {product.unit}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">آخر الفواتير</CardTitle>
              </div>
              <Badge variant="secondary">{stats?.recentInvoices?.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.customerName || "عميل نقدي"}
                        </p>
                      </div>
                      <div className="text-left shrink-0 mr-3">
                        <p className="font-semibold text-green-600">
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
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  لا توجد فواتير حديثة
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Purchase Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">آخر أوامر الشراء</CardTitle>
              </div>
              <Badge variant="secondary">{stats?.recentPurchases?.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {stats?.recentPurchases && stats.recentPurchases.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentPurchases.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.supplierName || "مورد غير محدد"}
                        </p>
                      </div>
                      <div className="text-left shrink-0 mr-3">
                        <p className="font-semibold text-orange-600">
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
                          className="text-xs"
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
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  لا توجد أوامر شراء حديثة
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
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-8 w-20 mt-3" />
              <Skeleton className="h-4 w-24 mt-2" />
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
