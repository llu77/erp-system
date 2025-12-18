import { useState, useMemo } from "react";
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
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Calculator,
  Minus,
  Plus,
  Equal,
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
import { ExportReports } from "@/components/ExportReports";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(num);
};

const formatNumber = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ar-SA").format(num);
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [activeTab, setActiveTab] = useState("sales");

  const { data: salesReport, isLoading: salesLoading } = trpc.reports.sales.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
  });

  const { data: purchasesReport, isLoading: purchasesLoading } = trpc.reports.purchases.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
  });

  const { data: inventoryReport, isLoading: inventoryLoading } = trpc.reports.inventory.useQuery();
  
  const { data: expenses = [] } = trpc.expenses.list.useQuery();
  const { data: payrolls = [] } = trpc.payrolls.list.useQuery();

  // حساب تقرير الأرباح والخسائر
  const profitLossReport = useMemo(() => {
    const totalSales = salesReport?.summary?.total || 0;
    const totalPurchases = purchasesReport?.summary?.total || 0;
    
    // تصفية المصاريف حسب التاريخ
    const filteredExpenses = expenses.filter((e: any) => {
      const expenseDate = new Date(e.expenseDate);
      return expenseDate >= new Date(dateRange.startDate) && expenseDate <= new Date(dateRange.endDate);
    });
    
    // تصفية الرواتب حسب التاريخ
    const filteredPayrolls = payrolls.filter((p: any) => {
      const payrollDate = new Date(p.periodEnd);
      return payrollDate >= new Date(dateRange.startDate) && payrollDate <= new Date(dateRange.endDate);
    });
    
    // تجميع المصاريف حسب الفئة
    const expensesByCategory: Record<string, number> = {};
    filteredExpenses.forEach((e: any) => {
      const category = e.category || "أخرى";
      expensesByCategory[category] = (expensesByCategory[category] || 0) + parseFloat(e.amount || 0);
    });
    
    const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);
    const totalPayroll = filteredPayrolls.reduce((sum: number, p: any) => sum + parseFloat(p.totalNet || 0), 0);
    
    const grossProfit = totalSales - totalPurchases;
    const operatingExpenses = totalExpenses + totalPayroll;
    const netProfit = grossProfit - operatingExpenses;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    
    return {
      revenue: {
        sales: totalSales,
        total: totalSales,
      },
      costOfGoods: {
        purchases: totalPurchases,
        total: totalPurchases,
      },
      grossProfit,
      operatingExpenses: {
        byCategory: expensesByCategory,
        payroll: totalPayroll,
        total: operatingExpenses,
      },
      netProfit,
      profitMargin,
    };
  }, [salesReport, purchasesReport, expenses, payrolls, dateRange]);

  // بيانات التصدير حسب التبويب النشط
  const getExportData = () => {
    switch (activeTab) {
      case "sales":
        return {
          title: `تقرير المبيعات - من ${dateRange.startDate} إلى ${dateRange.endDate}`,
          headers: ["التاريخ", "عدد الفواتير", "الإجمالي"],
          rows: (salesReport?.dailyData || []).map((d: any) => [
            d.date,
            d.count || 1,
            formatCurrency(d.total),
          ]),
          summary: [
            { label: "إجمالي المبيعات", value: formatCurrency(salesReport?.summary?.total || 0) },
            { label: "عدد الفواتير", value: salesReport?.summary?.count || 0 },
          ],
        };
      case "purchases":
        return {
          title: `تقرير المشتريات - من ${dateRange.startDate} إلى ${dateRange.endDate}`,
          headers: ["التاريخ", "عدد الطلبات", "الإجمالي"],
          rows: (purchasesReport?.dailyData || []).map((d: any) => [
            d.date,
            d.count || 1,
            formatCurrency(d.total),
          ]),
          summary: [
            { label: "إجمالي المشتريات", value: formatCurrency(purchasesReport?.summary?.total || 0) },
            { label: "عدد الطلبات", value: purchasesReport?.summary?.count || 0 },
          ],
        };
      case "inventory":
        return {
          title: "تقرير المخزون",
          headers: ["المنتج", "الكمية الحالية", "الحد الأدنى", "القيمة"],
          rows: ((inventoryReport as any)?.products || []).map((p: any) => [
            p.name,
            p.quantity,
            p.minQuantity,
            formatCurrency(p.value || 0),
          ]),
          summary: [
            { label: "إجمالي قيمة المخزون", value: formatCurrency((inventoryReport as any)?.totalValue || 0) },
            { label: "عدد المنتجات", value: (inventoryReport as any)?.totalProducts || 0 },
          ],
        };
      case "profit":
        return {
          title: `تقرير الأرباح والخسائر - من ${dateRange.startDate} إلى ${dateRange.endDate}`,
          headers: ["البند", "المبلغ"],
          rows: [
            ["إجمالي المبيعات", formatCurrency(profitLossReport.revenue.sales)],
            ["تكلفة البضاعة المباعة", formatCurrency(profitLossReport.costOfGoods.total)],
            ["إجمالي الربح", formatCurrency(profitLossReport.grossProfit)],
            ["مصاريف التشغيل", formatCurrency(profitLossReport.operatingExpenses.total)],
            ["الرواتب والأجور", formatCurrency(profitLossReport.operatingExpenses.payroll)],
            ...Object.entries(profitLossReport.operatingExpenses.byCategory).map(([cat, val]) => [
              cat,
              formatCurrency(val),
            ]),
            ["صافي الربح", formatCurrency(profitLossReport.netProfit)],
          ],
          summary: [
            { label: "هامش الربح", value: `${profitLossReport.profitMargin.toFixed(2)}%` },
          ],
        };
      default:
        return {
          title: "تقرير",
          headers: [],
          rows: [],
        };
    }
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
            <ExportReports
              data={getExportData()}
              filename={`report-${activeTab}-${dateRange.startDate}`}
            />
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
            <div className={`text-2xl font-bold ${profitLossReport.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(profitLossReport.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              هامش الربح: {profitLossReport.profitMargin.toFixed(1)}%
            </p>
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales">المبيعات</TabsTrigger>
          <TabsTrigger value="purchases">المشتريات</TabsTrigger>
          <TabsTrigger value="inventory">المخزون</TabsTrigger>
          <TabsTrigger value="profit">الأرباح والخسائر</TabsTrigger>
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

        {/* Profit & Loss Report */}
        <TabsContent value="profit" className="space-y-4">
          {/* تقرير الأرباح والخسائر التفصيلي */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <CardTitle>قائمة الدخل (الأرباح والخسائر)</CardTitle>
              </div>
              <CardDescription>
                للفترة من {format(new Date(dateRange.startDate), "dd MMMM yyyy", { locale: ar })} إلى {format(new Date(dateRange.endDate), "dd MMMM yyyy", { locale: ar })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* الإيرادات */}
                <div className="space-y-2">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-green-600">
                    <Plus className="h-5 w-5" />
                    الإيرادات
                  </h3>
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span>إيرادات المبيعات</span>
                      <span className="font-semibold">{formatCurrency(profitLossReport.revenue.sales)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-green-200 dark:border-green-800 font-bold">
                      <span>إجمالي الإيرادات</span>
                      <span className="text-green-600">{formatCurrency(profitLossReport.revenue.total)}</span>
                    </div>
                  </div>
                </div>

                {/* تكلفة البضاعة المباعة */}
                <div className="space-y-2">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-orange-600">
                    <Minus className="h-5 w-5" />
                    تكلفة البضاعة المباعة
                  </h3>
                  <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span>المشتريات</span>
                      <span className="font-semibold">{formatCurrency(profitLossReport.costOfGoods.purchases)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-orange-200 dark:border-orange-800 font-bold">
                      <span>إجمالي تكلفة البضاعة</span>
                      <span className="text-orange-600">{formatCurrency(profitLossReport.costOfGoods.total)}</span>
                    </div>
                  </div>
                </div>

                {/* إجمالي الربح */}
                <div className="bg-blue-100 dark:bg-blue-950/30 rounded-lg p-4">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span className="flex items-center gap-2">
                      <Equal className="h-5 w-5" />
                      إجمالي الربح (الهامش)
                    </span>
                    <span className={profitLossReport.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}>
                      {formatCurrency(profitLossReport.grossProfit)}
                    </span>
                  </div>
                </div>

                {/* مصاريف التشغيل */}
                <div className="space-y-2">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-red-600">
                    <Minus className="h-5 w-5" />
                    مصاريف التشغيل
                  </h3>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span>الرواتب والأجور</span>
                      <span className="font-semibold">{formatCurrency(profitLossReport.operatingExpenses.payroll)}</span>
                    </div>
                    {Object.entries(profitLossReport.operatingExpenses.byCategory).map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span>{category}</span>
                        <span className="font-semibold">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-red-200 dark:border-red-800 font-bold">
                      <span>إجمالي مصاريف التشغيل</span>
                      <span className="text-red-600">{formatCurrency(profitLossReport.operatingExpenses.total)}</span>
                    </div>
                  </div>
                </div>

                {/* صافي الربح */}
                <div className={`rounded-lg p-6 ${profitLossReport.netProfit >= 0 ? 'bg-green-100 dark:bg-green-950/30' : 'bg-red-100 dark:bg-red-950/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xl flex items-center gap-2">
                      <Equal className="h-6 w-6" />
                      صافي الربح (الخسارة)
                    </span>
                    <span className={`font-bold text-2xl ${profitLossReport.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(profitLossReport.netProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                    <span>هامش الربح الصافي</span>
                    <span className={profitLossReport.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {profitLossReport.profitMargin.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ملخص بطاقات */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(profitLossReport.revenue.total)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingDown className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">إجمالي التكاليف</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(profitLossReport.costOfGoods.total + profitLossReport.operatingExpenses.total)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className={profitLossReport.netProfit >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-red-50 dark:bg-red-950/20"}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <DollarSign className={`h-8 w-8 mx-auto mb-2 ${profitLossReport.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
                  <p className="text-sm text-muted-foreground">صافي الربح</p>
                  <p className={`text-2xl font-bold ${profitLossReport.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(profitLossReport.netProfit)}
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
