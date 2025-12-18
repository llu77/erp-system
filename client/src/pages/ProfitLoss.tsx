import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Download,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

// تنسيق المبالغ بالريال السعودي
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// تنسيق النسبة المئوية
const formatPercent = (value: number) => {
  return new Intl.NumberFormat("ar-SA", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
};

// ألوان الرسوم البيانية
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function ProfitLossPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [year, setYear] = useState(currentYear.toString());
  const [month, setMonth] = useState(currentMonth.toString());
  const [reportType, setReportType] = useState<"monthly" | "yearly">("monthly");

  // جلب البيانات
  const { data: invoicesData } = trpc.invoices.list.useQuery();
  const { data: purchasesData } = trpc.purchaseOrders.list.useQuery();
  const { data: expensesData } = trpc.expenses.list.useQuery();
  const { data: payrollsData } = trpc.payrolls.list.useQuery();

  // حساب الإيرادات
  const calculateRevenue = () => {
    if (!invoicesData) return { total: 0, byMonth: [] as { month: string; amount: number }[] };
    
    const filteredInvoices = invoicesData.filter((inv: any) => {
      const invDate = new Date(inv.createdAt);
      if (reportType === "yearly") {
        return invDate.getFullYear() === parseInt(year);
      }
      return invDate.getFullYear() === parseInt(year) && invDate.getMonth() + 1 === parseInt(month);
    });

    const total = filteredInvoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
    
    // تجميع حسب الشهر
    const byMonth: { month: string; amount: number }[] = [];
    if (reportType === "yearly") {
      for (let m = 1; m <= 12; m++) {
        const monthInvoices = invoicesData.filter((inv: any) => {
          const d = new Date(inv.createdAt);
          return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === m;
        });
        byMonth.push({
          month: new Date(parseInt(year), m - 1).toLocaleDateString("ar-SA", { month: "short" }),
          amount: monthInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0),
        });
      }
    }
    
    return { total, byMonth };
  };

  // حساب تكلفة المشتريات
  const calculatePurchases = () => {
    if (!purchasesData) return { total: 0, byMonth: [] as { month: string; amount: number }[] };
    
    const filteredPurchases = purchasesData.filter((po: any) => {
      const poDate = new Date(po.createdAt);
      if (reportType === "yearly") {
        return poDate.getFullYear() === parseInt(year);
      }
      return poDate.getFullYear() === parseInt(year) && poDate.getMonth() + 1 === parseInt(month);
    });

    const total = filteredPurchases.reduce((sum: number, po: any) => sum + (po.total || 0), 0);
    
    const byMonth: { month: string; amount: number }[] = [];
    if (reportType === "yearly") {
      for (let m = 1; m <= 12; m++) {
        const monthPurchases = purchasesData.filter((po: any) => {
          const d = new Date(po.createdAt);
          return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === m;
        });
        byMonth.push({
          month: new Date(parseInt(year), m - 1).toLocaleDateString("ar-SA", { month: "short" }),
          amount: monthPurchases.reduce((s: number, p: any) => s + (p.total || 0), 0),
        });
      }
    }
    
    return { total, byMonth };
  };

  // حساب المصاريف التشغيلية
  const calculateExpenses = () => {
    if (!expensesData) return { total: 0, byCategory: [] as { name: string; value: number }[] };
    
    const filteredExpenses = expensesData.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      if (reportType === "yearly") {
        return expDate.getFullYear() === parseInt(year);
      }
      return expDate.getFullYear() === parseInt(year) && expDate.getMonth() + 1 === parseInt(month);
    });

    const total = filteredExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
    
    // تجميع حسب الفئة
    const categoryMap: Record<string, number> = {};
    filteredExpenses.forEach((exp: any) => {
      const cat = exp.category || "أخرى";
      categoryMap[cat] = (categoryMap[cat] || 0) + (exp.amount || 0);
    });
    
    const byCategory = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    
    return { total, byCategory };
  };

  // حساب الرواتب
  const calculatePayroll = () => {
    if (!payrollsData) return 0;
    
    const filteredPayrolls = payrollsData.filter((pr: any) => {
      if (reportType === "yearly") {
        return pr.year === parseInt(year);
      }
      return pr.year === parseInt(year) && pr.month === parseInt(month);
    });

    return filteredPayrolls.reduce((sum: number, pr: any) => sum + (pr.totalNet || 0), 0);
  };

  const revenue = calculateRevenue();
  const purchases = calculatePurchases();
  const expenses = calculateExpenses();
  const payroll = calculatePayroll();

  // حساب إجمالي الربح
  const grossProfit = revenue.total - purchases.total;
  const grossProfitMargin = revenue.total > 0 ? (grossProfit / revenue.total) * 100 : 0;

  // حساب صافي الربح
  const totalOperatingExpenses = expenses.total + payroll;
  const netProfit = grossProfit - totalOperatingExpenses;
  const netProfitMargin = revenue.total > 0 ? (netProfit / revenue.total) * 100 : 0;

  // بيانات الرسم البياني الشهري
  const monthlyChartData = revenue.byMonth.map((r, i) => ({
    month: r.month,
    إيرادات: r.amount,
    مشتريات: purchases.byMonth[i]?.amount || 0,
    ربح: r.amount - (purchases.byMonth[i]?.amount || 0),
  }));

  // تصدير التقرير
  const exportReport = (format: "pdf" | "excel") => {
    const reportData = {
      period: reportType === "yearly" ? `سنة ${year}` : `${month}/${year}`,
      revenue: revenue.total,
      purchases: purchases.total,
      grossProfit,
      grossProfitMargin,
      expenses: expenses.total,
      payroll,
      netProfit,
      netProfitMargin,
    };

    if (format === "excel") {
      // تصدير Excel
      const csvContent = `تقرير الأرباح والخسائر
الفترة,${reportData.period}

البيان,المبلغ
الإيرادات,${reportData.revenue}
تكلفة المبيعات,${reportData.purchases}
إجمالي الربح,${reportData.grossProfit}
هامش الربح الإجمالي,${reportData.grossProfitMargin.toFixed(1)}%

المصاريف التشغيلية,${reportData.expenses}
الرواتب والأجور,${reportData.payroll}
إجمالي المصاريف,${reportData.expenses + reportData.payroll}

صافي الربح,${reportData.netProfit}
هامش صافي الربح,${reportData.netProfitMargin.toFixed(1)}%`;

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `profit-loss-${reportData.period}.csv`;
      link.click();
    } else {
      // طباعة PDF
      window.print();
    }
  };

  const categoryNames: Record<string, string> = {
    rent: "إيجار",
    utilities: "مرافق",
    salaries: "رواتب",
    marketing: "تسويق",
    maintenance: "صيانة",
    supplies: "مستلزمات",
    transportation: "نقل",
    insurance: "تأمين",
    taxes: "ضرائب",
    other: "أخرى",
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <Card className="print:shadow-none print:border-0">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>تقرير الأرباح والخسائر</CardTitle>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" onClick={() => exportReport("excel")}>
                <Download className="h-4 w-4 ml-2" />
                Excel
              </Button>
              <Button variant="outline" onClick={() => exportReport("pdf")}>
                <FileText className="h-4 w-4 ml-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="print:hidden">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>نوع التقرير</Label>
              <Select value={reportType} onValueChange={(v: "monthly" | "yearly") => setReportType(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="yearly">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>السنة</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reportType === "monthly" && (
              <div className="space-y-2">
                <Label>الشهر</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(2024, i).toLocaleDateString("ar-SA", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">الإيرادات</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(revenue.total)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تكلفة المبيعات</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(purchases.total)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الربح</p>
                <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatCurrency(grossProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  هامش: {formatPercent(grossProfitMargin)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${netProfit >= 0 ? "from-emerald-500/10 to-emerald-600/5 border-emerald-200" : "from-red-500/10 to-red-600/5 border-red-200"}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">صافي الربح</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(netProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  هامش: {formatPercent(netProfitMargin)}
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full ${netProfit >= 0 ? "bg-emerald-100" : "bg-red-100"} flex items-center justify-center`}>
                {netProfit >= 0 ? (
                  <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income Statement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              قائمة الدخل
            </CardTitle>
            <CardDescription>
              {reportType === "yearly" ? `سنة ${year}` : `${new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("ar-SA", { month: "long", year: "numeric" })}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* الإيرادات */}
              <div className="flex justify-between items-center py-2 border-b">
                <span className="font-semibold">الإيرادات</span>
                <span className="font-bold text-green-600">{formatCurrency(revenue.total)}</span>
              </div>

              {/* تكلفة المبيعات */}
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">(-) تكلفة المبيعات</span>
                <span className="text-red-600">{formatCurrency(purchases.total)}</span>
              </div>

              {/* إجمالي الربح */}
              <div className="flex justify-between items-center py-2 bg-muted/50 px-2 rounded">
                <span className="font-semibold">إجمالي الربح</span>
                <span className={`font-bold ${grossProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatCurrency(grossProfit)}
                </span>
              </div>

              <Separator />

              {/* المصاريف التشغيلية */}
              <div className="space-y-2">
                <span className="font-semibold">المصاريف التشغيلية:</span>
                <div className="flex justify-between items-center py-1 pr-4">
                  <span className="text-muted-foreground">المصاريف العامة</span>
                  <span>{formatCurrency(expenses.total)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pr-4">
                  <span className="text-muted-foreground">الرواتب والأجور</span>
                  <span>{formatCurrency(payroll)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t">
                  <span className="text-muted-foreground">(-) إجمالي المصاريف</span>
                  <span className="text-red-600">{formatCurrency(totalOperatingExpenses)}</span>
                </div>
              </div>

              <Separator />

              {/* صافي الربح */}
              <div className={`flex justify-between items-center py-3 px-2 rounded ${netProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <span className="font-bold text-lg">صافي الربح</span>
                <span className={`font-bold text-xl ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              توزيع المصاريف
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.byCategory.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={expenses.byCategory.map((c) => ({
                        ...c,
                        name: categoryNames[c.name] || c.name,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenses.byCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                لا توجد مصاريف في هذه الفترة
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart (for yearly reports) */}
      {reportType === "yearly" && monthlyChartData.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              الاتجاه الشهري
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="إيرادات" fill="#10b981" />
                  <Bar dataKey="مشتريات" fill="#ef4444" />
                  <Bar dataKey="ربح" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>المؤشرات الرئيسية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">هامش الربح الإجمالي</p>
              <p className={`text-2xl font-bold ${grossProfitMargin >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {formatPercent(grossProfitMargin)}
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">هامش صافي الربح</p>
              <p className={`text-2xl font-bold ${netProfitMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatPercent(netProfitMargin)}
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">نسبة المصاريف للإيرادات</p>
              <p className="text-2xl font-bold text-orange-600">
                {revenue.total > 0 ? formatPercent((totalOperatingExpenses / revenue.total) * 100) : "0%"}
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">معدل التكلفة</p>
              <p className="text-2xl font-bold text-purple-600">
                {revenue.total > 0 ? formatPercent((purchases.total / revenue.total) * 100) : "0%"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
