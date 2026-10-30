import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Users, 
  Calendar,
  Building2,
  RefreshCw,
  CreditCard,
  Banknote,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Download,
  Loader2,
  FileText
} from "lucide-react";
import {
  PDF_BASE_STYLES,
  getPDFHeader,
  getPDFFooter,
  getPDFInfoSection,
  getPDFSummarySection,
  getPDFTable,
  getPDFSectionTitle,
  getPDFApprovalSection,
  createPDFDocument,
  openPrintWindow,
  formatCurrency as pdfFormatCurrency
} from "@/utils/pdfTemplates";

export default function ExecutiveDashboard() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year" | "custom">("month");
  const [isExporting, setIsExporting] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  
  // حساب نطاق التاريخ بناءً على الفترة المختارة
  const dateRange = useMemo(() => {
    // إذا كانت فترة مخصصة
    if (period === "custom" && customDateFrom && customDateTo) {
      return {
        start: new Date(customDateFrom),
        end: new Date(customDateTo + "T23:59:59")
      };
    }
    
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case "week":
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start.setMonth(start.getMonth() - 1);
        break;
      case "quarter":
        start.setMonth(start.getMonth() - 3);
        break;
      case "year":
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    
    return { start, end };
  }, [period, customDateFrom, customDateTo]);

  // حساب نطاق الفترة السابقة للمقارنة
  const previousDateRange = useMemo(() => {
    const end = new Date(dateRange.start);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    
    switch (period) {
      case "week":
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start.setMonth(start.getMonth() - 1);
        break;
      case "quarter":
        start.setMonth(start.getMonth() - 3);
        break;
      case "year":
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    
    return { start, end };
  }, [dateRange, period]);

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // جلب مؤشرات الأداء
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = trpc.executiveDashboard.kpis.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
    branchId: selectedBranch !== "all" ? parseInt(selectedBranch) : undefined,
  });

  // جلب المقارنة مع الفترة السابقة
  const { data: comparison } = trpc.executiveDashboard.compare.useQuery({
    currentStart: dateRange.start.toISOString(),
    currentEnd: dateRange.end.toISOString(),
    previousStart: previousDateRange.start.toISOString(),
    previousEnd: previousDateRange.end.toISOString(),
    branchId: selectedBranch !== "all" ? parseInt(selectedBranch) : undefined,
  });

  // جلب أداء الموظفين
  const { data: employeesPerformance, isLoading: employeesLoading } = trpc.executiveDashboard.employeesPerformance.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
    branchId: selectedBranch !== "all" ? parseInt(selectedBranch) : undefined,
  });

  // جلب بيانات الرسم البياني
  const { data: chartData } = trpc.executiveDashboard.dailyChart.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
    branchId: selectedBranch !== "all" ? parseInt(selectedBranch) : undefined,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getPeriodLabel = (): string => {
    switch (period) {
      case "week": return "الأسبوع الماضي";
      case "month": return "الشهر الماضي";
      case "quarter": return "الربع الماضي";
      case "year": return "السنة الماضية";
      case "custom": return "الفترة السابقة";
      default: return "الشهر الماضي";
    }
  };

  const getPeriodName = (): string => {
    switch (period) {
      case "week": return "أسبوع";
      case "month": return "شهر";
      case "quarter": return "ربع سنة";
      case "year": return "سنة";
      case "custom": return "فترة مخصصة";
      default: return "شهر";
    }
  };

  const getSelectedBranchName = () => {
    if (selectedBranch === "all") return "جميع الفروع";
    return branches?.find(b => b.id.toString() === selectedBranch)?.name || "";
  };

  // دالة تصدير PDF
  const handleExportPDF = async () => {
    if (!kpis) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }

    setIsExporting(true);
    try {
      const branchName = getSelectedBranchName();
      const periodName = getPeriodName();
      const startDateStr = dateRange.start.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
      const endDateStr = dateRange.end.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

      // إنشاء محتوى HTML للتقرير
      const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير لوحة التحكم التنفيذية - ${branchName}</title>
  <style>
    ${PDF_BASE_STYLES}
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .kpi-card {
      background: #f5f5f5;
      border: 2px solid #000;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .kpi-card.revenue { border-top: 4px solid #000; }
    .kpi-card.profit { border-top: 4px solid #000; }
    .kpi-card.expenses { border-top: 4px solid #000; }
    .kpi-card.margin { border-top: 4px solid #000; }
    
    .kpi-label {
      font-size: 12px;
      color: #333;
      margin-bottom: 8px;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .kpi-value {
      font-size: 32px;
      font-weight: 900;
      color: #000000;
      letter-spacing: -0.5px;
    }
    
    .kpi-value.positive { color: #000000; }
    .kpi-value.negative { color: #cc0000; }
    .kpi-value.neutral { color: #000000; }
    
    .kpi-change {
      font-size: 11px;
      margin-top: 8px;
      padding: 4px 8px;
      border-radius: 20px;
      display: inline-block;
    }
    
    .kpi-change.up { background: #dcfce7; color: #166534; }
    .kpi-change.down { background: #fee2e2; color: #991b1b; }
    
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #000;
      margin: 25px 0 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #000;
    }
    
    .payment-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .payment-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 15px;
      text-align: center;
    }
    
    .payment-card .label { font-size: 11px; color: #64748b; }
    .payment-card .value { font-size: 28px; font-weight: 900; margin: 8px 0; color: #000000; }
    .payment-card .percent { font-size: 12px; color: #64748b; }
    
    .payment-card.cash .value { color: #000000; }
    .payment-card.network .value { color: #000000; }
    .payment-card.balance .value { color: #000000; }
    
    .employee-row {
      display: flex;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .employee-row:last-child { border-bottom: none; }
    
    .employee-rank {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      margin-left: 15px;
    }
    
    .rank-1 { background: #fef08a; color: #854d0e; }
    .rank-2 { background: #e2e8f0; color: #475569; }
    .rank-3 { background: #fed7aa; color: #9a3412; }
    .rank-other { background: #f1f5f9; color: #64748b; }
    
    .employee-info { flex: 1; }
    .employee-name { font-weight: 700; color: #000; font-size: 14px; }
    .employee-branch { font-size: 11px; color: #333; }
    .employee-revenue { font-weight: 900; color: #000000; font-size: 20px; }
    .employee-stats { font-size: 11px; color: #333; }
    
    .comparison-section {
      background: #1a1a1a;
      color: white;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 25px;
      border: 2px solid #000;
    }
    
    .comparison-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 15px;
      opacity: 0.9;
    }
    
    .comparison-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    
    .comparison-item { text-align: center; }
    .comparison-label { font-size: 11px; opacity: 0.8; }
    .comparison-value { font-size: 28px; font-weight: 900; margin-top: 5px; }
    
    @media print {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .payment-grid { grid-template-columns: repeat(3, 1fr); }
    }
  </style>
</head>
<body>
  ${getPDFHeader('تقرير لوحة التحكم التنفيذية', { reportNumber: `RPT-EXEC-${Date.now()}`, branchName })}
  
  ${getPDFInfoSection([
    { label: 'الفرع', value: branchName },
    { label: 'الفترة', value: periodName },
    { label: 'من تاريخ', value: startDateStr },
    { label: 'إلى تاريخ', value: endDateStr },
    { label: 'أيام العمل', value: kpis.daysCount || 0 },
  ])}
  
  <!-- مؤشرات الأداء الرئيسية -->
  <div class="section-title">📊 مؤشرات الأداء الرئيسية (KPIs)</div>
  <div class="kpi-grid">
    <div class="kpi-card revenue">
      <div class="kpi-label">إجمالي الإيرادات</div>
      <div class="kpi-value positive">${pdfFormatCurrency(kpis.totalRevenue || 0)}</div>
      ${comparison ? `<div class="kpi-change ${comparison.changes.revenueChange >= 0 ? 'up' : 'down'}">
        ${comparison.changes.revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(comparison.changes.revenueChange).toFixed(1)}% عن ${getPeriodLabel()}
      </div>` : ''}
    </div>
    
    <div class="kpi-card profit">
      <div class="kpi-label">صافي الربح</div>
      <div class="kpi-value ${(kpis.netProfit || 0) >= 0 ? 'positive' : 'negative'}">${pdfFormatCurrency(kpis.netProfit || 0)}</div>
      ${comparison ? `<div class="kpi-change ${comparison.changes.profitChange >= 0 ? 'up' : 'down'}">
        ${comparison.changes.profitChange >= 0 ? '↑' : '↓'} ${Math.abs(comparison.changes.profitChange).toFixed(1)}% عن ${getPeriodLabel()}
      </div>` : ''}
    </div>
    
    <div class="kpi-card expenses">
      <div class="kpi-label">إجمالي الالتزامات</div>
      <div class="kpi-value neutral">${pdfFormatCurrency(kpis.totalObligations || 0)}</div>
      <div class="kpi-change" style="font-size: 10px; background: #f5f5f5; padding: 4px 8px;">
        مصاريف: ${pdfFormatCurrency(kpis.totalExpenses || 0)} | رواتب: ${pdfFormatCurrency(kpis.totalSalaries || 0)}
      </div>
    </div>
    
    <div class="kpi-card margin">
      <div class="kpi-label">هامش الربح</div>
      <div class="kpi-value ${(kpis.profitMargin || 0) >= 0 ? 'positive' : 'negative'}">${(kpis.profitMargin || 0).toFixed(1)}%</div>
      <div class="kpi-change">متوسط يومي: ${pdfFormatCurrency(kpis.averageDailyRevenue || 0)}</div>
    </div>
  </div>
  
  <!-- تفاصيل طرق الدفع -->
  <div class="section-title">💳 تفاصيل طرق الدفع</div>
  <div class="payment-grid">
    <div class="payment-card cash">
      <div class="label">إجمالي النقدي</div>
      <div class="value">${pdfFormatCurrency(kpis.totalCash || 0)}</div>
      <div class="percent">${(kpis.cashPercentage || 0).toFixed(1)}% من الإجمالي</div>
    </div>
    <div class="payment-card network">
      <div class="label">إجمالي الشبكة</div>
      <div class="value">${pdfFormatCurrency(kpis.totalNetwork || 0)}</div>
      <div class="percent">${(kpis.networkPercentage || 0).toFixed(1)}% من الإجمالي</div>
    </div>
    <div class="payment-card balance">
      <div class="label">إجمالي الرصيد</div>
      <div class="value">${pdfFormatCurrency(kpis.totalBalance || 0)}</div>
      <div class="percent">من ${kpis.daysCount || 0} يوم عمل</div>
    </div>
  </div>
  
  ${comparison ? `
  <!-- مقارنة مع الفترة السابقة -->
  <div class="comparison-section">
    <div class="comparison-title">📈 مقارنة مع ${getPeriodLabel()}</div>
    <div class="comparison-grid">
      <div class="comparison-item">
        <div class="comparison-label">تغير الإيرادات</div>
        <div class="comparison-value">${comparison.changes.revenueChange >= 0 ? '+' : ''}${comparison.changes.revenueChange.toFixed(1)}%</div>
      </div>
      <div class="comparison-item">
        <div class="comparison-label">تغير الأرباح</div>
        <div class="comparison-value">${comparison.changes.profitChange >= 0 ? '+' : ''}${comparison.changes.profitChange.toFixed(1)}%</div>
      </div>
      <div class="comparison-item">
        <div class="comparison-label">تغير المصاريف</div>
        <div class="comparison-value">${comparison.changes.expensesChange >= 0 ? '+' : ''}${comparison.changes.expensesChange.toFixed(1)}%</div>
      </div>
    </div>
  </div>
  ` : ''}
  
  ${employeesPerformance && employeesPerformance.length > 0 ? `
  <!-- أداء الموظفين -->
  <div class="section-title">👥 أداء الموظفين (أفضل 10)</div>
  <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    ${employeesPerformance.slice(0, 10).map((emp, index) => {
      const branch = branches?.find(b => b.id === emp.branchId);
      return `
      <div class="employee-row">
        <div class="employee-rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}">
          ${index + 1}
        </div>
        <div class="employee-info">
          <div class="employee-name">${emp.employeeName} <span style="color: #64748b; font-size: 11px;">(${emp.employeeCode})</span></div>
          ${branch && selectedBranch === "all" ? `<div class="employee-branch">${branch.name}</div>` : ''}
        </div>
        <div style="text-align: left;">
          <div class="employee-revenue">${pdfFormatCurrency(emp.totalRevenue)}</div>
          <div class="employee-stats">${emp.daysWorked} يوم | متوسط: ${pdfFormatCurrency(emp.averageDaily)}</div>
        </div>
      </div>
      `;
    }).join('')}
  </div>
  ` : ''}
  
  <!-- قسم التوقيعات والختم -->
  ${getPDFApprovalSection({
    isApproved: true,
    showStamp: true,
    showSupervisorSignature: true,
    showManagerSignature: true,
    approvalDate: new Date().toLocaleDateString('ar-SA')
  })}
  
  ${getPDFFooter(undefined, { branchName })}
</body>
</html>
      `;

      openPrintWindow(htmlContent);
      toast.success("تم فتح التقرير للطباعة أو الحفظ كـ PDF");
    } catch (error) {
      console.error('Export error:', error);
      toast.error("فشل تصدير التقرير");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* العنوان والتحكم */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.25) 100%)' }}>
              <BarChart3 className="h-6 w-6 text-purple-500" />
            </div>
            لوحة التحكم التنفيذية
          </h1>
          <p className="text-muted-foreground mt-1">نظرة شاملة على أداء الأعمال - {getSelectedBranchName()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* اختيار الفرع */}
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[160px]">
              <Building2 className="h-4 w-4 ml-2" />
              <SelectValue placeholder="اختر الفرع" />
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
          
          {/* اختيار الفترة */}
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 ml-2" />
              <SelectValue placeholder="الفترة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">أسبوع</SelectItem>
              <SelectItem value="month">شهر</SelectItem>
              <SelectItem value="quarter">ربع سنة</SelectItem>
              <SelectItem value="year">سنة</SelectItem>
              <SelectItem value="custom">فترة مخصصة</SelectItem>
            </SelectContent>
          </Select>
          
          {/* حقول التاريخ المخصص */}
          {period === "custom" && (
            <>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-input bg-background"
                placeholder="من"
              />
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-input bg-background"
                placeholder="إلى"
              />
            </>
          )}
          
          <Button variant="outline" size="icon" onClick={() => refetchKpis()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          {/* زر تصدير PDF */}
          <Button
            variant="default"
            onClick={handleExportPDF}
            disabled={isExporting || kpisLoading || !kpis}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            طباعة التقرير
          </Button>
        </div>
      </div>

      {/* شريط الفترة المحددة */}
      {period === "custom" && customDateFrom && customDateTo && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-blue-400">
              الإحصائيات للفترة: {new Date(customDateFrom).toLocaleDateString('ar-SA')} - {new Date(customDateTo).toLocaleDateString('ar-SA')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPeriod("month");
              setCustomDateFrom("");
              setCustomDateTo("");
            }}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            إعادة تعيين
          </Button>
        </div>
      )}

      {/* مؤشرات الأداء الرئيسية - تصميم محسن */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* إجمالي الإيرادات */}
        <Card className="kpi-card bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(kpis?.totalRevenue || 0)}
                </div>
                {comparison && (
                  <p className={`text-xs flex items-center gap-1 mt-1 ${comparison.changes.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {comparison.changes.revenueChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {formatPercent(comparison.changes.revenueChange)} عن {getPeriodLabel()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.daysCount || 0} يوم مسجل
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* صافي الربح */}
        <Card className={`kpi-card bg-gradient-to-br ${(kpis?.netProfit || 0) >= 0 ? 'from-blue-500/10 to-blue-600/5' : 'from-red-500/10 to-red-600/5'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">صافي الربح</CardTitle>
            {(kpis?.netProfit || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-blue-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${(kpis?.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(kpis?.netProfit || 0)}
                </div>
                {comparison && (
                  <p className={`text-xs flex items-center gap-1 mt-1 ${comparison.changes.profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {comparison.changes.profitChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {formatPercent(comparison.changes.profitChange)} عن {getPeriodLabel()}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* إجمالي الالتزامات (مصاريف + رواتب) */}
        <Card className="kpi-card bg-gradient-to-br from-amber-500/10 to-amber-600/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الالتزامات</CardTitle>
            <Wallet className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(kpis?.totalObligations || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>مصاريف:</span>
                    <span className="font-medium">{formatCurrency(kpis?.totalExpenses || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>رواتب:</span>
                    <span className="font-medium">{formatCurrency(kpis?.totalSalaries || 0)}</span>
                  </div>
                  {kpis?.payrollMonth && kpis?.payrollYear && (
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      مسير {kpis.payrollMonth}/{kpis.payrollYear} - {kpis.payrollEmployeeCount || 0} موظف
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* هامش الربح */}
        <Card className="kpi-card bg-gradient-to-br from-purple-500/10 to-purple-600/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">هامش الربح</CardTitle>
            <Percent className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${(kpis?.profitMargin || 0) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  {(kpis?.profitMargin || 0).toFixed(1)}%
                </div>
                <Progress 
                  value={Math.max(0, Math.min(100, kpis?.profitMargin || 0))} 
                  className="h-2 mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  متوسط يومي: {formatCurrency(kpis?.averageDailyRevenue || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* تفاصيل الإيرادات */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* النقدي */}
        <Card className="shadow-glow border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي النقدي</CardTitle>
            <Banknote className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(kpis?.totalCash || 0)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={kpis?.cashPercentage || 0} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground">{(kpis?.cashPercentage || 0).toFixed(1)}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* الشبكة */}
        <Card className="shadow-glow border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الشبكة</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(kpis?.totalNetwork || 0)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={kpis?.networkPercentage || 0} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground">{(kpis?.networkPercentage || 0).toFixed(1)}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* الرصيد */}
        <Card className="shadow-glow border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الرصيد</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(kpis?.totalBalance || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  من {kpis?.daysCount || 0} يوم عمل
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* إحصائيات سندات القبض */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* عدد السندات */}
        <Card className="stat-card-enhanced shadow-glow border-0 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عدد السندات</CardTitle>
            <FileText className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-cyan-600">
                  {kpis?.receiptVouchersCount || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  سند مستلم في الفترة
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* إجمالي السندات */}
        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي السندات</CardTitle>
            <CreditCard className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(kpis?.totalReceiptVouchersAmount || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  مبالغ مستلمة (كاش)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* الكاش المتبقي */}
        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الكاش المتبقي</CardTitle>
            <Wallet className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-rose-600">
                  {formatCurrency((kpis?.totalCash || 0) - (kpis?.totalReceiptVouchersAmount || 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  الرصيد = الكاش - السندات
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* أداء الموظفين */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                أداء الموظفين
              </CardTitle>
              <CardDescription>
                ترتيب الموظفين حسب الإيرادات - {getSelectedBranchName()}
              </CardDescription>
            </div>
            <Badge variant="outline">
              {employeesPerformance?.length || 0} موظف
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {employeesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : employeesPerformance && employeesPerformance.length > 0 ? (
            <div className="space-y-3">
              {employeesPerformance.map((emp, index) => {
                const maxRevenue = employeesPerformance[0]?.totalRevenue || 1;
                const percentage = (emp.totalRevenue / maxRevenue) * 100;
                const branch = branches?.find(b => b.id === emp.branchId);
                
                return (
                  <div key={emp.employeeId} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 text-yellow-950' :
                      index === 1 ? 'bg-gray-400 text-gray-950' :
                      index === 2 ? 'bg-amber-600 text-amber-950' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{emp.employeeName}</span>
                          <Badge variant="outline" className="text-xs">{emp.employeeCode}</Badge>
                          {branch && selectedBranch === "all" && (
                            <Badge variant="secondary" className="text-xs">{branch.name}</Badge>
                          )}
                        </div>
                        <span className="font-bold text-emerald-600">{formatCurrency(emp.totalRevenue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={percentage} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {emp.daysWorked} يوم | متوسط: {formatCurrency(emp.averageDaily)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>لا توجد بيانات إيرادات للموظفين في هذه الفترة</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* الرسم البياني للإيرادات اليومية */}
      {chartData && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الإيرادات اليومية</CardTitle>
            <CardDescription>
              تطور الإيرادات خلال الفترة المحددة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-1">
              {chartData.map((day, index) => {
                const maxTotal = Math.max(...chartData.map(d => d.total));
                const height = maxTotal > 0 ? (day.total / maxTotal) * 100 : 0;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t hover:from-emerald-600 hover:to-emerald-500 transition-colors cursor-pointer group relative"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${day.date}: ${formatCurrency(day.total)}`}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
                        {formatCurrency(day.total)}
                      </div>
                    </div>
                    {chartData.length <= 14 && (
                      <span className="text-[10px] text-muted-foreground rotate-45 origin-left">
                        {new Date(day.date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
