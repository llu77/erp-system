import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  DollarSign,
  Building2,
  Calendar,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Banknote,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  PiggyBank,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// أسماء طرق الدفع
const paymentMethodNames: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
  credit_card: "بطاقة ائتمان",
  other: "أخرى",
};

// أيقونات طرق الدفع
const paymentMethodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  bank_transfer: <Building2 className="h-4 w-4" />,
  check: <FileText className="h-4 w-4" />,
  credit_card: <CreditCard className="h-4 w-4" />,
  other: <Wallet className="h-4 w-4" />,
};

// ألوان طرق الدفع
const paymentMethodColors: Record<string, string> = {
  cash: "bg-green-500/10 text-green-500 border-green-500/20",
  bank_transfer: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  check: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  credit_card: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

// أسماء الأشهر
const monthNames = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export default function CashFlowReport() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    expenses: true,
    vouchers: true,
    revenues: false,
  });

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // جلب تقرير التدفق النقدي الشهري
  const { data: monthlyReport, isLoading: isLoadingMonthly, refetch: refetchMonthly } = 
    trpc.cashFlow.monthlyReport.useQuery({
      year: selectedYear,
      month: selectedMonth,
    }, {
      enabled: !selectedBranchId,
    });

  // جلب التدفق النقدي لفرع محدد
  const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
  // حساب آخر يوم في الشهر بدون مشاكل timezone
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  
  const { data: branchCashFlow, isLoading: isLoadingBranch, refetch: refetchBranch } = 
    trpc.cashFlow.branchCashFlow.useQuery({
      branchId: selectedBranchId!,
      startDate,
      endDate,
    }, {
      enabled: !!selectedBranchId,
    });

  const isLoading = selectedBranchId ? isLoadingBranch : isLoadingMonthly;

  // تصدير PDF
  const exportPDF = trpc.cashFlow.exportPDF.useMutation({
    onSuccess: (data) => {
      // فتح الملف في نافذة جديدة
      window.open(data.url, '_blank');
      toast.success('تم تصدير التقرير بنجاح');
    },
    onError: (error) => {
      toast.error('فشل في تصدير التقرير: ' + error.message);
    },
  });

  const handleExportPDF = () => {
    exportPDF.mutate({
      year: selectedYear,
      month: selectedMonth,
      branchId: selectedBranchId || undefined,
    });
  };

  // حساب الإجماليات
  const totals = useMemo(() => {
    if (selectedBranchId && branchCashFlow) {
      return {
        cashRevenue: branchCashFlow.summary.totalCashRevenue,
        cashExpenses: branchCashFlow.summary.totalCashExpenses,
        cashVouchers: branchCashFlow.summary.totalCashVouchers,
        remainingCash: branchCashFlow.summary.remainingCash,
        cashRetentionRate: branchCashFlow.summary.cashRetentionRate,
      };
    }
    if (monthlyReport) {
      return {
        cashRevenue: monthlyReport.totals.cashRevenue,
        cashExpenses: monthlyReport.totals.cashExpenses,
        cashVouchers: monthlyReport.totals.cashVouchers,
        remainingCash: monthlyReport.totals.remainingCash,
        cashRetentionRate: monthlyReport.totals.cashRetentionRate,
      };
    }
    return {
      cashRevenue: 0,
      cashExpenses: 0,
      cashVouchers: 0,
      remainingCash: 0,
      cashRetentionRate: "0.00",
    };
  }, [selectedBranchId, branchCashFlow, monthlyReport]);

  // تجميع المصاريف حسب طريقة الدفع
  const expensesByMethod = useMemo(() => {
    if (selectedBranchId && branchCashFlow) {
      return branchCashFlow.expenses.byPaymentMethod;
    }
    if (monthlyReport) {
      // تجميع من جميع الفروع
      const combined: Record<string, { count: number; total: number }> = {
        cash: { count: 0, total: 0 },
        bank_transfer: { count: 0, total: 0 },
        check: { count: 0, total: 0 },
        credit_card: { count: 0, total: 0 },
        other: { count: 0, total: 0 },
      };
      for (const branch of monthlyReport.branches) {
        if (branch.cashFlow?.expenses.byPaymentMethod) {
          for (const [method, data] of Object.entries(branch.cashFlow.expenses.byPaymentMethod)) {
            if (combined[method]) {
              combined[method].count += (data as any).count || 0;
              combined[method].total += (data as any).total || 0;
            }
          }
        }
      }
      return combined;
    }
    return {};
  }, [selectedBranchId, branchCashFlow, monthlyReport]);

  // تجميع السندات حسب طريقة الدفع
  const vouchersByMethod = useMemo(() => {
    if (selectedBranchId && branchCashFlow) {
      return branchCashFlow.vouchers.byPaymentMethod;
    }
    if (monthlyReport) {
      // تجميع من جميع الفروع
      const combined: Record<string, { count: number; total: number }> = {
        cash: { count: 0, total: 0 },
        bank_transfer: { count: 0, total: 0 },
        check: { count: 0, total: 0 },
        credit_card: { count: 0, total: 0 },
        other: { count: 0, total: 0 },
      };
      for (const branch of monthlyReport.branches) {
        if (branch.cashFlow?.vouchers.byPaymentMethod) {
          for (const [method, data] of Object.entries(branch.cashFlow.vouchers.byPaymentMethod)) {
            if (combined[method]) {
              combined[method].count += (data as any).count || 0;
              combined[method].total += (data as any).total || 0;
            }
          }
        }
      }
      return combined;
    }
    return {};
  }, [selectedBranchId, branchCashFlow, monthlyReport]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ر.س';
  };

  // قائمة السنوات
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان والفلاتر */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PiggyBank className="h-6 w-6 text-primary" />
              تقرير التدفق النقدي
            </h1>
            <p className="text-muted-foreground mt-1">
              تتبع الكاش: الإيرادات النقدية - المصاريف النقدية - سندات القبض النقدية
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* اختيار الفرع */}
            <Select
              value={selectedBranchId?.toString() || "all"}
              onValueChange={(value) => setSelectedBranchId(value === "all" ? null : parseInt(value))}
            >
              <SelectTrigger className="w-[180px]">
                <Building2 className="h-4 w-4 ml-2" />
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* اختيار الشهر */}
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 ml-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* اختيار السنة */}
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* زر التحديث */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => selectedBranchId ? refetchBranch() : refetchMonthly()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {/* زر تصدير PDF */}
            <Button
              variant="default"
              onClick={handleExportPDF}
              disabled={isLoading || exportPDF.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {exportPDF.isPending ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 ml-2" />
              )}
              تصدير PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="mr-2">جاري تحميل التقرير...</span>
          </div>
        ) : (
          <>
            {/* بطاقات الملخص */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* إيرادات الكاش */}
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4 text-green-500" />
                    إيرادات الكاش
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">
                    {formatCurrency(totals.cashRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    إجمالي الإيرادات النقدية للفترة
                  </p>
                </CardContent>
              </Card>

              {/* المصاريف النقدية */}
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                    المصاريف النقدية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {formatCurrency(totals.cashExpenses)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    إجمالي المصاريف المدفوعة نقداً
                  </p>
                </CardContent>
              </Card>

              {/* سندات القبض النقدية */}
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-orange-500" />
                    سندات القبض النقدية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">
                    {formatCurrency(totals.cashVouchers)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    إجمالي سندات القبض النقدية
                  </p>
                </CardContent>
              </Card>

              {/* الكاش المتبقي */}
              <Card className={`border-2 ${totals.remainingCash >= 0 ? 'border-primary/50 bg-primary/5' : 'border-red-500/50 bg-red-500/10'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wallet className={`h-4 w-4 ${totals.remainingCash >= 0 ? 'text-primary' : 'text-red-500'}`} />
                    الكاش المتبقي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${totals.remainingCash >= 0 ? 'text-primary' : 'text-red-500'}`}>
                    {formatCurrency(totals.remainingCash)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    نسبة الاحتفاظ: {totals.cashRetentionRate}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* معادلة التدفق النقدي */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  معادلة التدفق النقدي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-center gap-4 text-lg">
                  <div className="flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-lg">
                    <span className="text-green-500 font-bold">{formatCurrency(totals.cashRevenue)}</span>
                    <span className="text-muted-foreground text-sm">إيرادات</span>
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground">-</span>
                  <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-lg">
                    <span className="text-red-500 font-bold">{formatCurrency(totals.cashExpenses)}</span>
                    <span className="text-muted-foreground text-sm">مصاريف</span>
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground">-</span>
                  <div className="flex items-center gap-2 bg-orange-500/10 px-4 py-2 rounded-lg">
                    <span className="text-orange-500 font-bold">{formatCurrency(totals.cashVouchers)}</span>
                    <span className="text-muted-foreground text-sm">سندات</span>
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground">=</span>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${totals.remainingCash >= 0 ? 'bg-primary/10' : 'bg-red-500/10'}`}>
                    <span className={`font-bold ${totals.remainingCash >= 0 ? 'text-primary' : 'text-red-500'}`}>
                      {formatCurrency(totals.remainingCash)}
                    </span>
                    <span className="text-muted-foreground text-sm">متبقي</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* تفاصيل المصاريف حسب طريقة الدفع */}
            <Collapsible open={expandedSections.expenses} onOpenChange={() => toggleSection('expenses')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        المصاريف حسب طريقة الدفع
                      </CardTitle>
                      {expandedSections.expenses ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {Object.entries(expensesByMethod).map(([method, data]: [string, any]) => (
                        <Card key={method} className={`border ${paymentMethodColors[method]}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-2">
                              {paymentMethodIcons[method]}
                              <span className="font-medium">{paymentMethodNames[method]}</span>
                            </div>
                            <div className="text-xl font-bold">
                              {formatCurrency(data?.total || 0)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {data?.count || 0} مصروف
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* تفاصيل سندات القبض حسب طريقة الدفع */}
            <Collapsible open={expandedSections.vouchers} onOpenChange={() => toggleSection('vouchers')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-orange-500" />
                        سندات القبض حسب طريقة الدفع
                      </CardTitle>
                      {expandedSections.vouchers ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {Object.entries(vouchersByMethod).map(([method, data]: [string, any]) => (
                        <Card key={method} className={`border ${paymentMethodColors[method]}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-2">
                              {paymentMethodIcons[method]}
                              <span className="font-medium">{paymentMethodNames[method]}</span>
                            </div>
                            <div className="text-xl font-bold">
                              {formatCurrency(data?.total || 0)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {data?.count || 0} سند
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* تفاصيل السندات */}
            {selectedBranchId && branchCashFlow && branchCashFlow.vouchers.byPaymentMethod && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    تفاصيل سندات القبض
                  </CardTitle>
                  <CardDescription>
                    جميع سندات القبض للفترة المحددة
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">رقم السند</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">المستفيد</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">طريقة الدفع</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(branchCashFlow.vouchers.byPaymentMethod).flatMap(([method, data]: [string, any]) =>
                        (data?.vouchers || []).map((voucher: any) => (
                          <TableRow key={voucher.id}>
                            <TableCell className="font-medium">{voucher.voucherNumber}</TableCell>
                            <TableCell>{new Date(voucher.voucherDate).toLocaleDateString('ar-SA')}</TableCell>
                            <TableCell>{voucher.beneficiaryName}</TableCell>
                            <TableCell className="font-bold text-primary">
                              {formatCurrency(parseFloat(voucher.totalAmount))}
                            </TableCell>
                            <TableCell>
                              <Badge className={paymentMethodColors[method]}>
                                {paymentMethodIcons[method]}
                                <span className="mr-1">{paymentMethodNames[method]}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={voucher.status === 'paid' ? 'default' : voucher.status === 'approved' ? 'secondary' : 'outline'}>
                                {voucher.status === 'draft' ? 'مسودة' : voucher.status === 'approved' ? 'معتمد' : voucher.status === 'paid' ? 'مدفوع' : voucher.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* تفاصيل المصاريف */}
            {selectedBranchId && branchCashFlow && branchCashFlow.expenses.byPaymentMethod && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    تفاصيل المصاريف
                  </CardTitle>
                  <CardDescription>
                    جميع المصاريف للفترة المحددة
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">طريقة الدفع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(branchCashFlow.expenses.byPaymentMethod).flatMap(([method, data]: [string, any]) =>
                        (data?.expenses || []).map((expense: any) => (
                          <TableRow key={expense.id}>
                            <TableCell>{new Date(expense.date).toLocaleDateString('ar-SA')}</TableCell>
                            <TableCell className="font-medium">{expense.description}</TableCell>
                            <TableCell>{expense.category}</TableCell>
                            <TableCell className="font-bold text-red-500">
                              {formatCurrency(parseFloat(expense.amount))}
                            </TableCell>
                            <TableCell>
                              <Badge className={paymentMethodColors[method]}>
                                {paymentMethodIcons[method]}
                                <span className="mr-1">{paymentMethodNames[method]}</span>
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* تفاصيل الفروع (إذا كان عرض جميع الفروع) */}
            {!selectedBranchId && monthlyReport && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    التدفق النقدي حسب الفرع
                  </CardTitle>
                  <CardDescription>
                    مقارنة التدفق النقدي بين الفروع لشهر {monthNames[selectedMonth - 1]} {selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">إيرادات الكاش</TableHead>
                        <TableHead className="text-right">المصاريف النقدية</TableHead>
                        <TableHead className="text-right">سندات القبض</TableHead>
                        <TableHead className="text-right">الكاش المتبقي</TableHead>
                        <TableHead className="text-right">نسبة الاحتفاظ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.branches.map((branch) => (
                        <TableRow key={branch.branchId}>
                          <TableCell className="font-medium">{branch.branchName}</TableCell>
                          <TableCell className="text-green-500">
                            {formatCurrency(branch.cashFlow?.summary.totalCashRevenue || 0)}
                          </TableCell>
                          <TableCell className="text-red-500">
                            {formatCurrency(branch.cashFlow?.summary.totalCashExpenses || 0)}
                          </TableCell>
                          <TableCell className="text-orange-500">
                            {formatCurrency(branch.cashFlow?.summary.totalCashVouchers || 0)}
                          </TableCell>
                          <TableCell className={branch.cashFlow?.summary.remainingCash && branch.cashFlow.summary.remainingCash >= 0 ? 'text-primary font-bold' : 'text-red-500 font-bold'}>
                            {formatCurrency(branch.cashFlow?.summary.remainingCash || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={parseFloat(branch.cashFlow?.summary.cashRetentionRate || "0") >= 50 ? "default" : "destructive"}>
                              {branch.cashFlow?.summary.cashRetentionRate || "0"}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
