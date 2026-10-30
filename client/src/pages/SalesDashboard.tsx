import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  RefreshCw,
  Building2,
  Banknote,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Target,
  Wallet,
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
  getPDFApprovalSection,
  openPrintWindow,
  formatCurrency as pdfFormatCurrency
} from "@/utils/pdfTemplates";

export default function SalesDashboard() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");
  const [isExporting, setIsExporting] = useState(false);

  // حساب نطاق التاريخ بناءً على الفترة المختارة
  const dateRange = useMemo(() => {
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
  }, [period]);

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

  const getPeriodLabel = () => {
    switch (period) {
      case "week": return "الأسبوع الماضي";
      case "month": return "الشهر الماضي";
      case "quarter": return "الربع الماضي";
      case "year": return "السنة الماضية";
    }
  };

  const getPeriodName = () => {
    switch (period) {
      case "week": return "أسبوع";
      case "month": return "شهر";
      case "quarter": return "ربع سنة";
      case "year": return "سنة";
    }
  };

  const getSelectedBranchName = () => {
    if (selectedBranch === "all") return "جميع الفروع";
    return branches?.find(b => b.id.toString() === selectedBranch)?.name || "";
  };

  // حساب أفضل يوم مبيعات
  const bestDay = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    return chartData.reduce((best, day) => day.total > best.total ? day : best, chartData[0]);
  }, [chartData]);

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
  <title>تقرير لوحة الإيرادات - ${branchName}</title>
  <style>
    ${PDF_BASE_STYLES}
    
    .revenue-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .summary-card {
      background: #f5f5f5;
      border: 2px solid #000;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .summary-card.total { border-top: 4px solid #000; }
    .summary-card.profit { border-top: 4px solid #000; }
    .summary-card.average { border-top: 4px solid #000; }
    .summary-card.best { border-top: 4px solid #000; }
    
    .summary-label {
      font-size: 12px;
      color: #333;
      margin-bottom: 8px;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .summary-value {
      font-size: 32px;
      font-weight: 900;
      color: #000000;
    }
    
    .summary-value.green { color: #000; }
    .summary-value.blue { color: #000; }
    .summary-value.purple { color: #000; }
    .summary-value.amber { color: #000; }
    .summary-value.red { color: #cc0000; }
    
    .summary-change {
      font-size: 11px;
      margin-top: 8px;
      padding: 4px 8px;
      border-radius: 20px;
      display: inline-block;
    }
    
    .summary-change.up { background: #dcfce7; color: #166534; }
    .summary-change.down { background: #fee2e2; color: #991b1b; }
    
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #000;
      margin: 25px 0 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #000;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .payment-methods {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .payment-card {
      background: #fff;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
    }
    
    .payment-card .icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px;
      font-size: 18px;
    }
    
    .payment-card.cash .icon { background: #dcfce7; color: #22c55e; }
    .payment-card.network .icon { background: #dbeafe; color: #3b82f6; }
    .payment-card.balance .icon { background: #f3e8ff; color: #8b5cf6; }
    
    .payment-card .label { font-size: 12px; color: #333; font-weight: 600; }
    .payment-card .value { font-size: 28px; font-weight: 900; margin: 8px 0; color: #000000; }
    .payment-card .percent { font-size: 12px; color: #333; }
    
    .payment-card.cash .value { color: #000; }
    .payment-card.network .value { color: #000; }
    .payment-card.balance .value { color: #000; }
    
    .progress-bar {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    
    .progress-bar .fill {
      height: 100%;
      border-radius: 4px;
    }
    
    .progress-bar .fill.green { background: linear-gradient(90deg, #22c55e, #4ade80); }
    .progress-bar .fill.blue { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .progress-bar .fill.purple { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
    
    .employee-table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .employee-table th {
      background: #1a1a1a;
      color: white;
      padding: 12px 15px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
    }
    
    .employee-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #e2e8f0;
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      color: #000000;
    }
    
    .employee-table tr:last-child td { border-bottom: none; }
    .employee-table tr:nth-child(even) { background: #f8fafc; }
    
    .rank-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
    }
    
    .rank-1 { background: #fef08a; color: #854d0e; }
    .rank-2 { background: #e2e8f0; color: #475569; }
    .rank-3 { background: #fed7aa; color: #9a3412; }
    .rank-other { background: #f1f5f9; color: #64748b; }
    
    .revenue-value { font-weight: 700; color: #22c55e; }
    .average-value { color: #6366f1; }
    
    .daily-chart {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 25px;
    }
    
    .chart-bars {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 150px;
      padding: 10px 0;
    }
    
    .chart-bar {
      flex: 1;
      background: linear-gradient(to top, #22c55e, #4ade80);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
    }
    
    .comparison-box {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 25px;
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
    .comparison-value { font-size: 18px; font-weight: 700; margin-top: 5px; }
    
    @media print {
      .revenue-summary { grid-template-columns: repeat(2, 1fr); }
      .payment-methods { grid-template-columns: repeat(3, 1fr); }
    }
  </style>
</head>
<body>
  ${getPDFHeader('تقرير لوحة الإيرادات', { reportNumber: `RPT-REV-${Date.now()}`, branchName })}
  
  ${getPDFInfoSection([
    { label: 'الفرع', value: branchName },
    { label: 'الفترة', value: periodName },
    { label: 'من تاريخ', value: startDateStr },
    { label: 'إلى تاريخ', value: endDateStr },
    { label: 'أيام العمل', value: kpis.daysCount || 0 },
  ])}
  
  <!-- ملخص الإيرادات -->
  <div class="section-title">📊 ملخص الإيرادات</div>
  <div class="revenue-summary">
    <div class="summary-card total">
      <div class="summary-label">إجمالي الإيرادات</div>
      <div class="summary-value green">${pdfFormatCurrency(kpis.totalRevenue || 0)}</div>
      ${comparison ? `<div class="summary-change ${comparison.changes.revenueChange >= 0 ? 'up' : 'down'}">
        ${comparison.changes.revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(comparison.changes.revenueChange).toFixed(1)}%
      </div>` : ''}
    </div>
    
    <div class="summary-card profit">
      <div class="summary-label">صافي الربح</div>
      <div class="summary-value ${(kpis.netProfit || 0) >= 0 ? 'blue' : 'red'}">${pdfFormatCurrency(kpis.netProfit || 0)}</div>
      ${comparison ? `<div class="summary-change ${comparison.changes.profitChange >= 0 ? 'up' : 'down'}">
        ${comparison.changes.profitChange >= 0 ? '↑' : '↓'} ${Math.abs(comparison.changes.profitChange).toFixed(1)}%
      </div>` : ''}
    </div>
    
    <div class="summary-card average">
      <div class="summary-label">متوسط الإيراد اليومي</div>
      <div class="summary-value purple">${pdfFormatCurrency(kpis.averageDailyRevenue || 0)}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 5px;">من ${kpis.daysCount || 0} يوم عمل</div>
    </div>
    
    <div class="summary-card best">
      <div class="summary-label">أفضل يوم مبيعات</div>
      <div class="summary-value amber">${bestDay ? pdfFormatCurrency(bestDay.total) : '-'}</div>
      ${bestDay ? `<div style="font-size: 11px; color: #64748b; margin-top: 5px;">${new Date(bestDay.date).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' })}</div>` : ''}
    </div>
  </div>
  
  <!-- طرق الدفع -->
  <div class="section-title">💳 تفاصيل طرق الدفع</div>
  <div class="payment-methods">
    <div class="payment-card cash">
      <div class="icon">💵</div>
      <div class="label">إجمالي النقدي</div>
      <div class="value">${pdfFormatCurrency(kpis.totalCash || 0)}</div>
      <div class="percent">${(kpis.cashPercentage || 0).toFixed(1)}% من الإجمالي</div>
      <div class="progress-bar">
        <div class="fill green" style="width: ${kpis.cashPercentage || 0}%"></div>
      </div>
    </div>
    
    <div class="payment-card network">
      <div class="icon">💳</div>
      <div class="label">إجمالي الشبكة</div>
      <div class="value">${pdfFormatCurrency(kpis.totalNetwork || 0)}</div>
      <div class="percent">${(kpis.networkPercentage || 0).toFixed(1)}% من الإجمالي</div>
      <div class="progress-bar">
        <div class="fill blue" style="width: ${kpis.networkPercentage || 0}%"></div>
      </div>
    </div>
    
    <div class="payment-card balance">
      <div class="icon">💰</div>
      <div class="label">إجمالي الرصيد</div>
      <div class="value">${pdfFormatCurrency(kpis.totalBalance || 0)}</div>
      <div class="percent">هامش الربح: ${(kpis.profitMargin || 0).toFixed(1)}%</div>
      <div class="progress-bar">
        <div class="fill purple" style="width: ${Math.min(100, kpis.profitMargin || 0)}%"></div>
      </div>
    </div>
  </div>
  
  ${comparison ? `
  <!-- مقارنة مع الفترة السابقة -->
  <div class="comparison-box">
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
  
  ${chartData && chartData.length > 0 ? `
  <!-- الرسم البياني للإيرادات اليومية -->
  <div class="section-title">📈 الإيرادات اليومية</div>
  <div class="daily-chart">
    <div class="chart-bars">
      ${chartData.map(day => {
        const maxTotal = Math.max(...chartData.map(d => d.total));
        const height = maxTotal > 0 ? (day.total / maxTotal) * 100 : 0;
        return `<div class="chart-bar" style="height: ${Math.max(height, 2)}%;" title="${day.date}: ${pdfFormatCurrency(day.total)}"></div>`;
      }).join('')}
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 10px;">
      <span>${chartData.length > 0 ? new Date(chartData[0].date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : ''}</span>
      <span>${chartData.length > 0 ? new Date(chartData[chartData.length - 1].date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : ''}</span>
    </div>
  </div>
  ` : ''}
  
  ${employeesPerformance && employeesPerformance.length > 0 ? `
  <!-- أداء الموظفين -->
  <div class="section-title">👥 أداء الموظفين (أفضل 10)</div>
  <table class="employee-table">
    <thead>
      <tr>
        <th style="width: 60px;">الترتيب</th>
        <th>الموظف</th>
        <th>الكود</th>
        ${selectedBranch === "all" ? '<th>الفرع</th>' : ''}
        <th>إجمالي الإيرادات</th>
        <th>أيام العمل</th>
        <th>المتوسط اليومي</th>
      </tr>
    </thead>
    <tbody>
      ${employeesPerformance.slice(0, 10).map((emp, index) => {
        const branch = branches?.find(b => b.id === emp.branchId);
        return `
        <tr>
          <td><span class="rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}">${index + 1}</span></td>
          <td style="font-weight: 600;">${emp.employeeName}</td>
          <td>${emp.employeeCode}</td>
          ${selectedBranch === "all" ? `<td>${branch?.name || '-'}</td>` : ''}
          <td class="revenue-value">${pdfFormatCurrency(emp.totalRevenue)}</td>
          <td>${emp.daysWorked} يوم</td>
          <td class="average-value">${pdfFormatCurrency(emp.averageDaily)}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            لوحة تحكم المبيعات
          </h1>
          <p className="text-muted-foreground">تحليل أداء المبيعات والإيرادات - {getSelectedBranchName()}</p>
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
            </SelectContent>
          </Select>
          
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

      {/* بطاقات الملخص الرئيسية */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* إجمالي الإيرادات */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
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
              </>
            )}
          </CardContent>
        </Card>

        {/* صافي الربح */}
        <Card className={`bg-gradient-to-br ${(kpis?.netProfit || 0) >= 0 ? 'from-blue-500/10 to-blue-600/5 border-blue-500/20' : 'from-red-500/10 to-red-600/5 border-red-500/20'}`}>
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

        {/* متوسط الإيراد اليومي */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط الإيراد اليومي</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(kpis?.averageDailyRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  من {kpis?.daysCount || 0} يوم عمل
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* أفضل يوم */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أفضل يوم مبيعات</CardTitle>
            <Calendar className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : bestDay ? (
              <>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(bestDay.total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(bestDay.date).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">لا توجد بيانات</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* تفاصيل طرق الدفع */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* النقدي */}
        <Card>
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
        <Card>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الرصيد</CardTitle>
            <Wallet className="h-4 w-4 text-purple-600" />
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
                  هامش الربح: {(kpis?.profitMargin || 0).toFixed(1)}%
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* الرسم البياني للإيرادات اليومية */}
      <Card>
        <CardHeader>
          <CardTitle>الإيرادات اليومية</CardTitle>
          <CardDescription>
            تطور الإيرادات خلال الفترة المحددة - {getSelectedBranchName()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kpisLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData && chartData.length > 0 ? (
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
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد بيانات إيرادات في هذه الفترة</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              {employeesPerformance.slice(0, 10).map((emp, index) => {
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
    </div>
  );
}
