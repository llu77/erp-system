import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ar } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(num);
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [reportType, setReportType] = useState("sales");

  const { data: salesReport, isLoading: salesLoading } = trpc.reports.sales.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
  });

  const { data: purchasesReport, isLoading: purchasesLoading } = trpc.reports.purchases.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
  });

  const { data: inventoryReport, isLoading: inventoryLoading } = trpc.reports.inventory.useQuery();

  const { data: dashboardStats } = trpc.dashboard.stats.useQuery();

  const handleExport = (type: string) => {
    toast.success(`جاري تصدير التقرير كـ ${type === "pdf" ? "PDF" : "Excel"}...`);
    // TODO: Implement actual export functionality
  };

  const setQuickDateRange = (range: string) => {
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (range) {
      case "today":
        start = today;
        break;
      case "week":
        start = subDays(today, 7);
        break;
      case "month":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "quarter":
        start = subDays(today, 90);
        break;
      default:
        start = startOfMonth(today);
    }

    setDateRange({
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>التقارير والإحصائيات</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleExport("excel")}>
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                Excel
              </Button>
              <Button variant="outline" onClick={() => handleExport("pdf")}>
                <Download className="h-4 w-4 ml-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange("today")}>
                اليوم
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange("week")}>
                أسبوع
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange("month")}>
                شهر
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange("quarter")}>
                ربع سنة
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(salesReport?.summary?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {salesReport?.summary?.count || 0} فاتورة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المشتريات</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(purchasesReport?.summary?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {purchasesReport?.summary?.count || 0} أمر شراء
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">صافي الربح</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(
                (salesReport?.summary?.total || 0) - (purchasesReport?.summary?.total || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">للفترة المحددة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">قيمة المخزون</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency((inventoryReport as any)?.totalValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(inventoryReport as any)?.totalProducts || 0} منتج
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different reports */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales">المبيعات</TabsTrigger>
          <TabsTrigger value="purchases">المشتريات</TabsTrigger>
          <TabsTrigger value="inventory">المخزون</TabsTrigger>
          <TabsTrigger value="profit">الأرباح</TabsTrigger>
        </TabsList>

        {/* Sales Report */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">المبيعات اليومية</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {salesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesReport?.dailyData || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="total" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">أفضل المنتجات مبيعاً</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(salesReport as any)?.topProducts?.slice(0, 5).map((product: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span>{product.name}</span>
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{formatCurrency(product.total)}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.quantity} وحدة
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      لا توجد بيانات للفترة المحددة
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Purchases Report */}
        <TabsContent value="purchases" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">المشتريات اليومية</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {purchasesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={purchasesReport?.dailyData || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="total" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">أكثر الموردين تعاملاً</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(purchasesReport as any)?.topSuppliers?.slice(0, 5).map((supplier: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span>{supplier.name}</span>
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{formatCurrency(supplier.total)}</div>
                        <div className="text-xs text-muted-foreground">
                          {supplier.orderCount} طلب
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      لا توجد بيانات للفترة المحددة
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inventory Report */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  منتجات تحتاج إعادة طلب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الكمية الحالية</TableHead>
                        <TableHead>الحد الأدنى</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(inventoryReport as any)?.lowStockProducts?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            لا توجد منتجات تحتاج إعادة طلب
                          </TableCell>
                        </TableRow>
                      ) : (
                        (inventoryReport as any)?.lowStockProducts?.map((product: any) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{product.quantity}</Badge>
                            </TableCell>
                            <TableCell>{product.minQuantity}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">توزيع المخزون حسب الفئة</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {inventoryLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(inventoryReport as any)?.categoryDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {((inventoryReport as any)?.categoryDistribution || []).map(
                          (_: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profit Report */}
        <TabsContent value="profit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تحليل الأرباح</CardTitle>
              <CardDescription>
                مقارنة بين المبيعات والمشتريات وصافي الربح
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[
                    {
                      name: "المبيعات",
                      value: salesReport?.summary?.total || 0,
                    },
                    {
                      name: "المشتريات",
                      value: purchasesReport?.summary?.total || 0,
                    },
                    {
                      name: "الربح",
                      value:
                        (salesReport?.summary?.total || 0) -
                        (purchasesReport?.summary?.total || 0),
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8884d8"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(salesReport?.summary?.total || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingDown className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(purchasesReport?.summary?.total || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">صافي الربح</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(
                      (salesReport?.summary?.total || 0) -
                        (purchasesReport?.summary?.total || 0)
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
