import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { format, subDays, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from "recharts";
import {
  Brain, Sparkles, TrendingUp, TrendingDown, Users, Target, AlertTriangle,
  Lightbulb, Zap, RefreshCw, ChevronRight, ArrowUpRight, ArrowDownRight,
  DollarSign, Calendar, Building2, BarChart3, PieChart as PieChartIcon,
  Activity, Award, Percent, Calculator, FileText, CheckCircle, XCircle,
  MessageSquare, Send, Bot, User, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// مكون تقرير المقارنة الشهرية للفروع
function MonthlyBranchComparison() {
  const [monthsCount, setMonthsCount] = useState<number>(6);
  
  const { data: comparisonReport, isLoading, refetch } = 
    trpc.bi.getMonthlyComparisonReport.useQuery({ monthsCount });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!comparisonReport) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          لا توجد بيانات للعرض
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* الفلاتر */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">تقرير المقارنة الشهرية</h3>
          <p className="text-sm text-muted-foreground">{comparisonReport.period}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={monthsCount.toString()} onValueChange={(v) => setMonthsCount(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 أشهر</SelectItem>
              <SelectItem value="6">6 أشهر</SelectItem>
              <SelectItem value="12">12 شهر</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* الملخص العام */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
            <p className="text-2xl font-bold text-green-500">
              {formatCurrency(comparisonReport.overallSummary.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
            <p className="text-2xl font-bold text-red-500">
              {formatCurrency(comparisonReport.overallSummary.totalExpenses)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">صافي الربح</p>
            <p className={`text-2xl font-bold ${comparisonReport.overallSummary.totalProfit >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {formatCurrency(comparisonReport.overallSummary.totalProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">متوسط هامش الربح</p>
            <p className="text-2xl font-bold text-purple-500">
              {comparisonReport.overallSummary.avgProfitMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* أفضل وأسوأ فرع */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-green-500" />
              <span className="font-semibold">أفضل فرع</span>
            </div>
            <p className="text-lg font-bold">{comparisonReport.overallSummary.bestBranch.name}</p>
            <p className="text-sm text-muted-foreground">
              ربح: {formatCurrency(comparisonReport.overallSummary.bestBranch.profit)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-semibold">الفرع الأقل ربحية</span>
            </div>
            <p className="text-lg font-bold">{comparisonReport.overallSummary.worstBranch.name}</p>
            <p className="text-sm text-muted-foreground">
              ربح: {formatCurrency(comparisonReport.overallSummary.worstBranch.profit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* رسم بياني للاتجاه الشهري */}
      <Card>
        <CardHeader>
          <CardTitle>الاتجاه الشهري الإجمالي</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={comparisonReport.overallSummary.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="totalRevenue" name="الإيرادات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="totalProfit" name="صافي الربح" stroke="#10b981" strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* تفاصيل كل فرع */}
      {comparisonReport.branches.map((branch) => (
        <Card key={branch.branchId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {branch.branchName}
                </CardTitle>
                <CardDescription>
                  الاتجاه: {branch.summary.overallTrend === 'improving' ? 'تحسن ↑' : 
                         branch.summary.overallTrend === 'declining' ? 'تراجع ↓' : 'مستقر →'}
                  {' | '}اتساق: {branch.summary.consistencyScore}%
                </CardDescription>
              </div>
              <div className="text-left">
                <Badge variant={branch.summary.overallTrend === 'improving' ? 'default' : 
                              branch.summary.overallTrend === 'declining' ? 'destructive' : 'secondary'}>
                  {branch.summary.overallTrend === 'improving' ? 'في تحسن' : 
                   branch.summary.overallTrend === 'declining' ? 'في تراجع' : 'مستقر'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* ملخص الفرع */}
            <div className="grid md:grid-cols-5 gap-4 mb-6">
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
                <p className="text-lg font-bold text-green-500">{formatCurrency(branch.summary.totalRevenue)}</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">إجمالي المصاريف</p>
                <p className="text-lg font-bold text-red-500">{formatCurrency(branch.summary.totalExpenses)}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">صافي الربح</p>
                <p className={`text-lg font-bold ${branch.summary.totalProfit >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                  {formatCurrency(branch.summary.totalProfit)}
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">متوسط هامش الربح</p>
                <p className="text-lg font-bold text-purple-500">{branch.summary.avgProfitMargin.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">متوسط شهري</p>
                <p className="text-lg font-bold text-yellow-500">{formatCurrency(branch.summary.avgMonthlyRevenue)}</p>
              </div>
            </div>

            {/* جدول الأشهر */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشهر</TableHead>
                  <TableHead className="text-left">الإيرادات</TableHead>
                  <TableHead className="text-left">المصاريف</TableHead>
                  <TableHead className="text-left">صافي الربح</TableHead>
                  <TableHead className="text-left">هامش الربح</TableHead>
                  <TableHead className="text-left">معدل النمو</TableHead>
                  <TableHead className="text-left">أيام العمل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branch.months.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell className="font-medium">{month.monthLabel}</TableCell>
                    <TableCell className="text-green-500">{formatCurrency(month.totalRevenue)}</TableCell>
                    <TableCell className="text-red-500">{formatCurrency(month.totalExpenses)}</TableCell>
                    <TableCell className={month.netProfit >= 0 ? 'text-blue-500' : 'text-red-500'}>
                      {formatCurrency(month.netProfit)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={month.profitMargin >= 15 ? 'default' : month.profitMargin >= 5 ? 'secondary' : 'destructive'}>
                        {month.profitMargin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={month.growthRate >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {month.growthRate >= 0 ? '+' : ''}{month.growthRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>{month.daysCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* أفضل وأسوأ شهر */}
            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>أفضل شهر: <strong>{branch.summary.bestMonth}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>أسوأ شهر: <strong>{branch.summary.worstMonth}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* الرؤى والتوصيات */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              الرؤى
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {comparisonReport.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              التوصيات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {comparisonReport.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// دالة آمنة لتنسيق التاريخ
function safeFormatDate(value: any, formatStr: string, options?: { locale?: any }): string {
  try {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return format(date, formatStr, options);
  } catch {
    return String(value);
  }
}

// دالة تنسيق العملة
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(amount);
}

// دالة تنسيق النسبة المئوية
function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// مكون بطاقة الإحصائيات
function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend,
  subtitle
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: any;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
}) {
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-yellow-500';
  const trendBg = trend === 'up' ? 'bg-green-500/10' : trend === 'down' ? 'bg-red-500/10' : 'bg-yellow-500/10';
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${trendBg}`}>
            <Icon className={`h-6 w-6 ${trendColor}`} />
          </div>
        </div>
        {change !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {change >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
              {formatPercent(change)}
            </span>
            <span className="text-xs text-muted-foreground">مقارنة بالفترة السابقة</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// مكون بطاقة الرؤية
function InsightCard({ 
  title, 
  description, 
  type,
  icon: Icon
}: {
  title: string;
  description: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  icon?: any;
}) {
  const colors = {
    success: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
  };
  
  const iconColors = {
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
    info: 'text-blue-500',
  };

  const DefaultIcon = type === 'success' ? CheckCircle : type === 'warning' ? AlertTriangle : type === 'danger' ? XCircle : Lightbulb;
  const DisplayIcon = Icon || DefaultIcon;

  return (
    <div className={`p-4 rounded-lg border ${colors[type]}`}>
      <div className="flex items-start gap-3">
        <DisplayIcon className={`h-5 w-5 mt-0.5 ${iconColors[type]}`} />
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function AIAnalytics() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('month');
  const [forecastDays, setForecastDays] = useState<number>(7);
  
  // الفترة الزمنية المخصصة
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // حساب نطاق التاريخ
  const dateRange = useMemo(() => {
    if (period === 'custom') {
      return {
        start: new Date(customStartDate),
        end: new Date(customEndDate)
      };
    }
    
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
    }
    
    return { start, end };
  }, [period, customStartDate, customEndDate]);

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  const branchId = selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined;

  // جلب تحليل الإيرادات
  const { data: revenueAnalysis, isLoading: loadingRevenue, refetch: refetchRevenue } = 
    trpc.bi.analyzeRevenues.useQuery({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      branchId,
    });

  // جلب تحليل المصاريف
  const { data: expenseAnalysis, isLoading: loadingExpenses } = 
    trpc.bi.analyzeExpenses.useQuery({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      branchId,
    });

  // جلب تحليل أداء الموظفين
  const { data: employeePerformance, isLoading: loadingEmployees } = 
    trpc.bi.analyzeEmployeePerformance.useQuery({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      branchId,
    });

  // جلب تحليل الربحية
  const { data: profitability, isLoading: loadingProfitability } = 
    trpc.bi.analyzeProfitability.useQuery({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      branchId,
    });

  // جلب رؤى AI الشاملة
  const { data: aiInsights, isLoading: loadingInsights, refetch: refetchInsights } = 
    trpc.bi.getComprehensiveInsights.useQuery({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      branchId,
    });

  // جلب التنبؤ بالإيرادات
  const { data: revenueForecast, isLoading: loadingForecast } = 
    trpc.bi.forecastRevenue.useQuery({ branchId, days: forecastDays });

  // جلب إعدادات التكاليف
  const { data: financialSettings } = trpc.bi.getFinancialSettings.useQuery();

  // جلب تحليل الشهر الماضي
  const { data: lastMonthAnalysis, isLoading: loadingLastMonth } = 
    trpc.bi.analyzeLastMonth.useQuery({ branchId });

  // جلب التنبؤ للشهر الحالي
  const { data: currentMonthForecast, isLoading: loadingCurrentMonth } = 
    trpc.bi.forecastCurrentMonth.useQuery({ branchId });

  // جلب تحليل جميع الفروع على حدة
  const { data: branchAnalyses, isLoading: loadingBranchAnalyses } = 
    trpc.bi.analyzeAllBranches.useQuery({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
    });

  // تحديث جميع البيانات
  const handleRefresh = () => {
    refetchRevenue();
    refetchInsights();
    toast.success('تم تحديث البيانات');
  };

  // تحديد جودة البيانات
  const getDataQualityBadge = (quality?: string) => {
    const colors: Record<string, string> = {
      excellent: 'bg-green-500',
      good: 'bg-blue-500',
      fair: 'bg-yellow-500',
      poor: 'bg-red-500',
    };
    const labels: Record<string, string> = {
      excellent: 'ممتازة',
      good: 'جيدة',
      fair: 'مقبولة',
      poor: 'ضعيفة',
    };
    return (
      <Badge className={colors[quality || 'poor']}>
        جودة البيانات: {labels[quality || 'poor']}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7" />
              تحليلات الذكاء الاصطناعي
            </h1>
            <p className="text-muted-foreground">
              تحليلات علمية ودقيقة مبنية على الإيرادات والمصاريف وأداء الموظفين
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[160px]">
                <Building2 className="h-4 w-4 ml-2" />
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches?.map(branch => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month' | 'quarter' | 'custom')}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 ml-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">أسبوع</SelectItem>
                <SelectItem value="month">شهر</SelectItem>
                <SelectItem value="quarter">ربع سنة</SelectItem>
                <SelectItem value="custom">فترة مخصصة</SelectItem>
              </SelectContent>
            </Select>
            
            {/* حقول الفترة المخصصة */}
            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                />
                <span className="text-muted-foreground">إلى</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                />
              </div>
            )}

            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* AI Summary Card */}
        {loadingInsights ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ) : aiInsights && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  ملخص التحليل الذكي
                </CardTitle>
                <div className="flex items-center gap-2">
                  {getDataQualityBadge(aiInsights.dataQuality)}
                  <Badge variant={
                    aiInsights.riskLevel === 'low' ? 'default' :
                    aiInsights.riskLevel === 'medium' ? 'secondary' : 'destructive'
                  }>
                    {aiInsights.riskLevel === 'low' ? 'مخاطر منخفضة' :
                     aiInsights.riskLevel === 'medium' ? 'مخاطر متوسطة' : 'مخاطر عالية'}
                  </Badge>
                  <Badge variant="outline">
                    ثقة التحليل: {aiInsights.confidenceScore}%
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-base mt-2">{aiInsights.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    رؤى الإيرادات
                  </h4>
                  <ul className="space-y-2">
                    {aiInsights.revenueInsights.slice(0, 3).map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    رؤى أداء الموظفين
                  </h4>
                  <ul className="space-y-2">
                    {aiInsights.employeeInsights.slice(0, 3).map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    التوصيات
                  </h4>
                  <ul className="space-y-2">
                    {aiInsights.recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* المخاطر والفرص */}
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-500">
                    <AlertTriangle className="h-4 w-4" />
                    المخاطر المحتملة
                  </h4>
                  <ul className="space-y-1">
                    {aiInsights.risks.map((risk, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {risk}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/20">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-500">
                    <Zap className="h-4 w-4" />
                    الفرص المتاحة
                  </h4>
                  <ul className="space-y-1">
                    {aiInsights.opportunities.map((opp, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {opp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          {/* التبويبات - تصميم محسّن */}
          <div className="bg-card rounded-xl p-2 border shadow-sm">
            <TabsList className="flex flex-wrap gap-1 h-auto bg-transparent p-0">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">نظرة عامة</span>
              </TabsTrigger>
              <TabsTrigger 
                value="revenue" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">الإيرادات</span>
              </TabsTrigger>
              <TabsTrigger 
                value="expenses" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <PieChartIcon className="h-4 w-4" />
                <span className="hidden sm:inline">المصاريف</span>
              </TabsTrigger>
              <TabsTrigger 
                value="employees" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">الموظفين</span>
              </TabsTrigger>
              <TabsTrigger 
                value="comparison" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">الفروع</span>
              </TabsTrigger>
              <TabsTrigger 
                value="forecast" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">التنبؤات</span>
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Symbol AI</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* نظرة عامة */}
          <TabsContent value="overview" className="space-y-4">
            {/* بطاقات الإحصائيات الرئيسية */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="إجمالي الإيرادات"
                value={formatCurrency(revenueAnalysis?.totalRevenue || 0)}
                change={revenueAnalysis?.growthRate}
                icon={DollarSign}
                trend={revenueAnalysis?.trend}
                subtitle={`${revenueAnalysis?.daysCount || 0} يوم عمل`}
              />
              <StatCard
                title="إجمالي المصاريف"
                value={formatCurrency(expenseAnalysis?.totalExpenses || 0)}
                change={expenseAnalysis?.growthRate}
                icon={Activity}
                trend={expenseAnalysis?.trend === 'up' ? 'down' : expenseAnalysis?.trend === 'down' ? 'up' : 'stable'}
              />
              <StatCard
                title="صافي الربح"
                value={formatCurrency(profitability?.netProfit || 0)}
                icon={Target}
                trend={(profitability?.netProfit || 0) > 0 ? 'up' : 'down'}
                subtitle={`هامش الربح: ${(profitability?.profitMargin || 0).toFixed(1)}%`}
              />
              <StatCard
                title="متوسط أداء الموظفين"
                value={`${employeePerformance?.length ? Math.round(employeePerformance.reduce((sum, e) => sum + e.performanceScore, 0) / employeePerformance.length) : 0}/100`}
                icon={Award}
                trend="stable"
                subtitle={`${employeePerformance?.length || 0} موظف نشط`}
              />
            </div>

            {/* الرسوم البيانية */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* رسم الإيرادات اليومية */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    الإيرادات اليومية
                  </CardTitle>
                  <CardDescription>
                    تطور الإيرادات خلال الفترة المحددة
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRevenue ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={revenueAnalysis?.dailyData || []}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => safeFormatDate(v, 'MM/dd')}
                          className="text-xs"
                        />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'الإيراد']}
                          labelFormatter={(label) => safeFormatDate(label, 'EEEE, d MMMM', { locale: ar })}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#3b82f6" 
                          fill="url(#revenueGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* رسم توزيع المصاريف */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    توزيع المصاريف
                  </CardTitle>
                  <CardDescription>
                    توزيع المصاريف حسب الفئة
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={expenseAnalysis?.expensesByCategory || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="amount"
                          nameKey="category"
                          label={({ category, percentage }) => `${category}: ${percentage.toFixed(0)}%`}
                        >
                          {(expenseAnalysis?.expensesByCategory || []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* المقاييس الإحصائية */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  المقاييس الإحصائية للإيرادات
                </CardTitle>
                <CardDescription>
                  تحليل إحصائي دقيق للإيرادات اليومية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">المتوسط الحسابي</p>
                    <p className="text-xl font-bold">{formatCurrency(revenueAnalysis?.statistics?.mean || 0)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">الوسيط</p>
                    <p className="text-xl font-bold">{formatCurrency(revenueAnalysis?.statistics?.median || 0)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">الانحراف المعياري</p>
                    <p className="text-xl font-bold">{formatCurrency(revenueAnalysis?.statistics?.standardDeviation || 0)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">معامل التباين</p>
                    <p className="text-xl font-bold">{(revenueAnalysis?.statistics?.coefficientOfVariation || 0).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">أقل قيمة</p>
                    <p className="text-lg font-bold text-red-500">{formatCurrency(revenueAnalysis?.statistics?.min || 0)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">أعلى قيمة</p>
                    <p className="text-lg font-bold text-green-500">{formatCurrency(revenueAnalysis?.statistics?.max || 0)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">المدى</p>
                    <p className="text-lg font-bold">{formatCurrency(revenueAnalysis?.statistics?.range || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* مقارنة الفروع */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  تحليل كل فرع على حدة
                </CardTitle>
                <CardDescription>مقارنة الأداء المالي لكل فرع</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBranchAnalyses ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : branchAnalyses && branchAnalyses.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الفرع</TableHead>
                          <TableHead className="text-right">الإيرادات</TableHead>
                          <TableHead className="text-right">التكاليف الثابتة</TableHead>
                          <TableHead className="text-right">المصاريف المسجلة</TableHead>
                          <TableHead className="text-right">إجمالي التكاليف</TableHead>
                          <TableHead className="text-right">صافي الربح</TableHead>
                          <TableHead className="text-right">هامش الربح</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {branchAnalyses.map((branch) => (
                          <TableRow key={branch.branchId}>
                            <TableCell className="font-medium">{branch.branchName}</TableCell>
                            <TableCell className="text-blue-500">{formatCurrency(branch.totalRevenue)}</TableCell>
                            <TableCell className="text-muted-foreground">{formatCurrency(branch.fixedCosts)}</TableCell>
                            <TableCell className="text-orange-500">{formatCurrency(branch.recordedExpenses)}</TableCell>
                            <TableCell className="text-red-400">{formatCurrency(branch.totalExpenses)}</TableCell>
                            <TableCell className={branch.netProfit >= 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
                              {formatCurrency(branch.netProfit)}
                            </TableCell>
                            <TableCell className={branch.profitMargin >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {branch.profitMargin.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              {branch.netProfit >= 0 ? (
                                <Badge className="bg-green-500">رابح</Badge>
                              ) : (
                                <Badge className="bg-red-500">خاسر</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* صف الإجمالي */}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>الإجمالي</TableCell>
                          <TableCell className="text-blue-500">
                            {formatCurrency(branchAnalyses.reduce((sum, b) => sum + b.totalRevenue, 0))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatCurrency(branchAnalyses.reduce((sum, b) => sum + b.fixedCosts, 0))}
                          </TableCell>
                          <TableCell className="text-orange-500">
                            {formatCurrency(branchAnalyses.reduce((sum, b) => sum + b.recordedExpenses, 0))}
                          </TableCell>
                          <TableCell className="text-red-400">
                            {formatCurrency(branchAnalyses.reduce((sum, b) => sum + b.totalExpenses, 0))}
                          </TableCell>
                          <TableCell className={branchAnalyses.reduce((sum, b) => sum + b.netProfit, 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {formatCurrency(branchAnalyses.reduce((sum, b) => sum + b.netProfit, 0))}
                          </TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">لا توجد بيانات للفروع</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* تحليل الإيرادات */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard
                title="إجمالي النقد"
                value={formatCurrency(revenueAnalysis?.totalCash || 0)}
                icon={DollarSign}
                trend="stable"
                subtitle={`${revenueAnalysis?.totalRevenue ? ((revenueAnalysis.totalCash / revenueAnalysis.totalRevenue) * 100).toFixed(1) : 0}% من الإجمالي`}
              />
              <StatCard
                title="إجمالي الشبكة"
                value={formatCurrency(revenueAnalysis?.totalNetwork || 0)}
                icon={Activity}
                trend="stable"
                subtitle={`${revenueAnalysis?.totalRevenue ? ((revenueAnalysis.totalNetwork / revenueAnalysis.totalRevenue) * 100).toFixed(1) : 0}% من الإجمالي`}
              />
              <StatCard
                title="متوسط الإيراد اليومي"
                value={formatCurrency(revenueAnalysis?.avgDailyRevenue || 0)}
                icon={BarChart3}
                trend={revenueAnalysis?.trend}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الإيرادات اليومية</CardTitle>
                <CardDescription>
                  جميع الإيرادات المسجلة خلال الفترة المحددة
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRevenue ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={revenueAnalysis?.dailyData || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(v) => safeFormatDate(v, 'MM/dd')}
                      />
                      <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelFormatter={(label) => safeFormatDate(label, 'EEEE, d MMMM yyyy', { locale: ar })}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="الإيراد" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        name="الاتجاه" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* رؤى الإيرادات */}
            <div className="grid md:grid-cols-2 gap-4">
              {aiInsights?.revenueInsights.map((insight, i) => (
                <InsightCard
                  key={i}
                  title={`رؤية ${i + 1}`}
                  description={insight}
                  type={i === 0 ? 'success' : i === 1 ? 'info' : 'warning'}
                />
              ))}
            </div>
          </TabsContent>

          {/* تحليل المصاريف */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard
                title="إجمالي المصاريف"
                value={formatCurrency(expenseAnalysis?.totalExpenses || 0)}
                change={expenseAnalysis?.growthRate}
                icon={Activity}
                trend={expenseAnalysis?.trend === 'up' ? 'down' : 'up'}
              />
              <StatCard
                title="متوسط المصاريف اليومية"
                value={formatCurrency(expenseAnalysis?.avgDailyExpense || 0)}
                icon={Calculator}
                trend="stable"
              />
              <StatCard
                title="نسبة التشغيل"
                value={`${(profitability?.operatingRatio || 0).toFixed(1)}%`}
                icon={Percent}
                trend={(profitability?.operatingRatio || 0) < 70 ? 'up' : 'down'}
                subtitle="المصاريف / الإيرادات"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>توزيع المصاريف حسب الفئة</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={expenseAnalysis?.expensesByCategory || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                        <YAxis dataKey="category" type="category" width={100} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]}>
                          {(expenseAnalysis?.expensesByCategory || []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>تفاصيل المصاريف</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفئة</TableHead>
                        <TableHead className="text-left">المبلغ</TableHead>
                        <TableHead className="text-left">النسبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(expenseAnalysis?.expensesByCategory || []).map((cat, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{cat.category}</TableCell>
                          <TableCell>{formatCurrency(cat.amount)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={cat.percentage} className="w-16 h-2" />
                              <span className="text-sm">{cat.percentage.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* رؤى المصاريف */}
            <div className="grid md:grid-cols-2 gap-4">
              {aiInsights?.expenseInsights.map((insight, i) => (
                <InsightCard
                  key={i}
                  title={`رؤية ${i + 1}`}
                  description={insight}
                  type={i === 0 ? 'warning' : 'info'}
                />
              ))}
            </div>
          </TabsContent>

          {/* أداء الموظفين */}
          <TabsContent value="employees" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <StatCard
                title="عدد الموظفين"
                value={employeePerformance?.length || 0}
                icon={Users}
                trend="stable"
              />
              <StatCard
                title="في تحسن"
                value={employeePerformance?.filter(e => e.trend === 'improving').length || 0}
                icon={TrendingUp}
                trend="up"
              />
              <StatCard
                title="مستقر"
                value={employeePerformance?.filter(e => e.trend === 'stable').length || 0}
                icon={Activity}
                trend="stable"
              />
              <StatCard
                title="في تراجع"
                value={employeePerformance?.filter(e => e.trend === 'declining').length || 0}
                icon={TrendingDown}
                trend="down"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  ترتيب الموظفين حسب الأداء
                </CardTitle>
                <CardDescription>
                  تقييم شامل يعتمد على الإيراد والاتساق والاتجاه
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEmployees ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>الموظف</TableHead>
                        <TableHead>الكود</TableHead>
                        <TableHead className="text-left">إجمالي الإيراد</TableHead>
                        <TableHead className="text-left">متوسط يومي</TableHead>
                        <TableHead className="text-left">أيام العمل</TableHead>
                        <TableHead className="text-left">درجة الأداء</TableHead>
                        <TableHead className="text-left">الاتساق</TableHead>
                        <TableHead>الاتجاه</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(employeePerformance || []).map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell>
                            <Badge variant={emp.rank <= 3 ? 'default' : 'outline'}>
                              {emp.rank}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{emp.employeeName}</TableCell>
                          <TableCell className="text-muted-foreground">{emp.employeeCode}</TableCell>
                          <TableCell>{formatCurrency(emp.totalRevenue)}</TableCell>
                          <TableCell>{formatCurrency(emp.avgDailyRevenue)}</TableCell>
                          <TableCell>{emp.daysWorked}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={emp.performanceScore} 
                                className={`w-16 h-2 ${
                                  emp.performanceScore >= 70 ? '[&>div]:bg-green-500' :
                                  emp.performanceScore >= 40 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                                }`}
                              />
                              <span className="text-sm font-medium">{emp.performanceScore}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{emp.consistency.toFixed(0)}%</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              emp.trend === 'improving' ? 'default' :
                              emp.trend === 'declining' ? 'destructive' : 'secondary'
                            }>
                              {emp.trend === 'improving' ? 'تحسن' :
                               emp.trend === 'declining' ? 'تراجع' : 'مستقر'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* رسم أداء الموظفين */}
            <Card>
              <CardHeader>
                <CardTitle>مقارنة أداء الموظفين</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingEmployees ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={employeePerformance?.slice(0, 10) || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="employeeName" />
                      <YAxis yAxisId="left" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="totalRevenue" name="الإيراد" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="performanceScore" name="درجة الأداء" stroke="#10b981" strokeWidth={2} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* مقارنة الفروع الشهرية */}
          <TabsContent value="comparison" className="space-y-6">
            <MonthlyBranchComparison />
          </TabsContent>

          {/* التنبؤات */}
          <TabsContent value="forecast" className="space-y-6">
            {/* تفاصيل التكاليف الثابتة */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  التكاليف الثابتة الشهرية
                </CardTitle>
                <CardDescription>
                  إجمالي التكاليف الثابتة للفرعين: 32,200 ر.س | لكل فرع: 16,100 ر.س
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-5 gap-4">
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30 text-center">
                    <p className="text-sm text-muted-foreground">رواتب</p>
                    <p className="text-xl font-bold text-blue-500">21,000</p>
                    <p className="text-xs text-muted-foreground">ر.س</p>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30 text-center">
                    <p className="text-sm text-muted-foreground">إيجار محلات</p>
                    <p className="text-xl font-bold text-purple-500">6,600</p>
                    <p className="text-xs text-muted-foreground">ر.س</p>
                  </div>
                  <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30 text-center">
                    <p className="text-sm text-muted-foreground">إيجار سكن</p>
                    <p className="text-xl font-bold text-orange-500">3,200</p>
                    <p className="text-xs text-muted-foreground">ر.س</p>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30 text-center">
                    <p className="text-sm text-muted-foreground">كهرباء</p>
                    <p className="text-xl font-bold text-yellow-500">800</p>
                    <p className="text-xs text-muted-foreground">ر.س</p>
                  </div>
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30 text-center">
                    <p className="text-sm text-muted-foreground">إنترنت</p>
                    <p className="text-xl font-bold text-cyan-500">600</p>
                    <p className="text-xs text-muted-foreground">ر.س</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                  <span className="text-muted-foreground">إجمالي التكاليف الثابتة (للفرعين)</span>
                  <span className="text-xl font-bold">32,200 ر.س</span>
                </div>
              </CardContent>
            </Card>

            {/* تحليل الشهر الماضي */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  تحليل الشهر الماضي ({lastMonthAnalysis?.period?.month || 'ديسمبر 2025'})
                </CardTitle>
                <CardDescription>
                  المتوسط اليومي = إجمالي الإيرادات ÷ {lastMonthAnalysis?.period?.totalDays || 31} يوم
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLastMonth ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                        <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                        <p className="text-2xl font-bold text-blue-500">
                          {formatCurrency(lastMonthAnalysis?.revenue?.total || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {lastMonthAnalysis?.period?.daysRecorded || 0} يوم مسجل
                        </p>
                      </div>
                      <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                        <p className="text-sm text-muted-foreground">المتوسط اليومي</p>
                        <p className="text-2xl font-bold text-purple-500">
                          {formatCurrency(lastMonthAnalysis?.revenue?.dailyAverage || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          إجمالي ÷ {lastMonthAnalysis?.period?.totalDays || 31} يوم
                        </p>
                      </div>
                      <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                        <p className="text-sm text-muted-foreground">إجمالي التكاليف</p>
                        <p className="text-2xl font-bold text-orange-500">
                          {formatCurrency(lastMonthAnalysis?.costs?.totalCosts || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ثابتة: {formatCurrency(lastMonthAnalysis?.costs?.fixedMonthlyCosts || 0)} | متغيرة: {formatCurrency(lastMonthAnalysis?.costs?.variableCosts || 0)}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border ${lastMonthAnalysis?.profit?.status === 'ربح' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <p className="text-sm text-muted-foreground">صافي الربح</p>
                        <p className={`text-2xl font-bold ${lastMonthAnalysis?.profit?.status === 'ربح' ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(lastMonthAnalysis?.profit?.netProfit || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          هامش: {(lastMonthAnalysis?.profit?.profitMargin || 0).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    
                    {/* تفاصيل التكاليف */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-semibold mb-3">تفاصيل التكاليف</h4>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">التكاليف الثابتة:</span>
                          <span className="font-medium">{formatCurrency(lastMonthAnalysis?.costs?.fixedMonthlyCosts || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">تكلفة البضاعة ({lastMonthAnalysis?.costs?.variableCostRate || 30}%):</span>
                          <span className="font-medium">{formatCurrency(lastMonthAnalysis?.costs?.variableCosts || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">مصاريف أخرى:</span>
                          <span className="font-medium">{formatCurrency(lastMonthAnalysis?.costs?.otherExpenses || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* التنبيهات */}
                    {lastMonthAnalysis?.alerts && lastMonthAnalysis.alerts.length > 0 && (
                      <div className="space-y-2">
                        {lastMonthAnalysis.alerts.map((alert: any, i: number) => (
                          <div key={i} className={`p-3 rounded-lg flex items-center gap-2 ${
                            alert.level === 'critical' ? 'bg-red-500/10 border border-red-500/30' :
                            alert.level === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                            'bg-green-500/10 border border-green-500/30'
                          }`}>
                            {alert.level === 'critical' ? <XCircle className="h-5 w-5 text-red-500" /> :
                             alert.level === 'warning' ? <AlertTriangle className="h-5 w-5 text-yellow-500" /> :
                             <CheckCircle className="h-5 w-5 text-green-500" />}
                            <span className={`${
                              alert.level === 'critical' ? 'text-red-500' :
                              alert.level === 'warning' ? 'text-yellow-500' :
                              'text-green-500'
                            }`}>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* نقطة التعادل */}
            {!lastMonthAnalysis?.needsConfiguration && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    نقطة التعادل
                  </CardTitle>
                  <CardDescription>
                    نقطة التعادل = التكاليف الثابتة ÷ (1 - نسبة التكاليف المتغيرة)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                      <p className="text-sm text-muted-foreground">نقطة التعادل اليومية</p>
                      <p className="text-2xl font-bold text-yellow-500">
                        {formatCurrency(lastMonthAnalysis?.breakEven?.daily || 0)}
                      </p>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                      <p className="text-sm text-muted-foreground">نقطة التعادل الشهرية</p>
                      <p className="text-2xl font-bold text-yellow-500">
                        {formatCurrency(lastMonthAnalysis?.breakEven?.monthly || 0)}
                      </p>
                    </div>
                    <div className={`p-4 rounded-lg border ${lastMonthAnalysis?.breakEven?.aboveBreakEven ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                      <p className="text-sm text-muted-foreground">الحالة</p>
                      <p className={`text-2xl font-bold ${lastMonthAnalysis?.breakEven?.aboveBreakEven ? 'text-green-500' : 'text-red-500'}`}>
                        {lastMonthAnalysis?.breakEven?.aboveBreakEven ? 'فوق التعادل ✅' : 'تحت التعادل ⚠️'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* التنبؤ للشهر الحالي */}
            {currentMonthForecast && !('error' in currentMonthForecast) && 'forecast' in currentMonthForecast && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    التنبؤ للشهر الحالي ({currentMonthForecast?.currentMonth?.month})
                  </CardTitle>
                  <CardDescription>
                    اليوم {currentMonthForecast?.currentMonth?.currentDay} من {currentMonthForecast?.currentMonth?.totalDays} | متبقي {currentMonthForecast?.currentMonth?.remainingDays} يوم
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* الإجماليات */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <p className="text-sm text-muted-foreground">الإيرادات الفعلية</p>
                      <p className="text-2xl font-bold text-blue-500">
                        {formatCurrency(currentMonthForecast?.actual?.revenue || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        حتى اليوم {currentMonthForecast?.actual?.daysElapsed}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                      <p className="text-sm text-muted-foreground">الإيرادات المتوقعة</p>
                      <p className="text-2xl font-bold text-purple-500">
                        {formatCurrency(currentMonthForecast?.forecast?.expectedTotalRevenue || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        نهاية الشهر
                      </p>
                    </div>
                    <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                      <p className="text-sm text-muted-foreground">التكاليف المتوقعة</p>
                      <p className="text-2xl font-bold text-orange-500">
                        {formatCurrency(currentMonthForecast?.forecast?.expectedTotalCosts || 0)}
                      </p>
                    </div>
                    <div className={`p-4 rounded-lg border ${currentMonthForecast?.forecast?.status === 'ربح' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                      <p className="text-sm text-muted-foreground">صافي الربح المتوقع</p>
                      <p className={`text-2xl font-bold ${currentMonthForecast?.forecast?.status === 'ربح' ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(currentMonthForecast?.forecast?.expectedNetProfit || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        هامش: {(currentMonthForecast?.forecast?.profitMargin || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* الفترات الثلاث */}
                  <div>
                    <h4 className="font-semibold mb-3">التنبؤ حسب الفترة</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      {currentMonthForecast?.periodForecasts?.map((period: any, i: number) => (
                        <div key={i} className="p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{period.name}</span>
                            <Badge variant="outline">أيام {period.days}</Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">الإيرادات:</span>
                              <span className="text-blue-500">{formatCurrency(period.expectedRevenue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">التكاليف:</span>
                              <span className="text-orange-500">{formatCurrency(period.expectedCosts)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1">
                              <span className="text-muted-foreground">صافي الربح:</span>
                              <span className={period.status === 'ربح' ? 'text-green-500' : 'text-red-500'}>
                                {formatCurrency(period.expectedProfit)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* التنبؤ اليومي */}
                  <div>
                    <h4 className="font-semibold mb-3">التنبؤ اليومي (7 أيام القادمة)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>اليوم</TableHead>
                          <TableHead>الإيرادات المتوقعة</TableHead>
                          <TableHead>التكاليف</TableHead>
                          <TableHead>صافي الربح</TableHead>
                          <TableHead>الثقة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentMonthForecast?.dailyForecasts?.map((day: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{day.date}</TableCell>
                            <TableCell>{day.dayName}</TableCell>
                            <TableCell className="text-blue-500">{formatCurrency(day.expectedRevenue)}</TableCell>
                            <TableCell className="text-orange-500">{formatCurrency(day.expectedCosts)}</TableCell>
                            <TableCell className={day.status === 'ربح' ? 'text-green-500' : 'text-red-500'}>
                              {formatCurrency(day.expectedProfit)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{day.confidence}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* معلومات الحساب */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  معادلات الحساب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <InsightCard
                    title="المتوسط اليومي"
                    description={`المتوسط = إجمالي إيرادات الشهر الماضي ÷ عدد أيام الشهر (${lastMonthAnalysis?.period?.totalDays || 31} يوم)`}
                    type="info"
                    icon={Calculator}
                  />
                  <InsightCard
                    title="نقطة التعادل"
                    description={`نقطة التعادل = التكاليف الثابتة (${formatCurrency(lastMonthAnalysis?.costs?.fixedMonthlyCosts || 0)}) ÷ (1 - نسبة التكاليف ${lastMonthAnalysis?.costs?.variableCostRate || 0}%)`}
                    type="info"
                    icon={Target}
                  />
                  <InsightCard
                    title="صافي الربح"
                    description="صافي الربح = الإيرادات - (التكاليف الثابتة + التكاليف المتغيرة)"
                    type="info"
                    icon={DollarSign}
                  />
                  <InsightCard
                    title="التكاليف المتغيرة"
                    description={`التكاليف المتغيرة = الإيرادات × نسبة تكلفة البضاعة (${lastMonthAnalysis?.costs?.variableCostRate || 0}%)`}
                    type="info"
                    icon={Percent}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* مستشار AI */}
          <TabsContent value="chat" className="space-y-4">
            <AIChatSection branchId={branchId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// مكون المحادثة مع AI
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function AIChatSection({ branchId }: { branchId?: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // جلب الأسئلة المقترحة
  const { data: suggestedQuestions } = trpc.bi.getSuggestedQuestions.useQuery();

  // mutation للمحادثة
  const chatMutation = trpc.bi.chatWithAI.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      setIsLoading(false);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء المحادثة');
      setIsLoading(false);
    },
  });

  // التمرير للأسفل عند إضافة رسالة جديدة
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (message?: string) => {
    const msgToSend = message || inputMessage.trim();
    if (!msgToSend || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: msgToSend }]);
    setInputMessage('');
    setIsLoading(true);

    chatMutation.mutate({
      message: msgToSend,
      conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
      branchId,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[600px]">
      {/* الهيدر */}
      <div className="flex-shrink-0 mb-4">
        <Card className="border-amber-500/30 bg-gradient-to-l from-amber-500/10 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-500">Symbol AI</h2>
                <p className="text-sm text-muted-foreground">مستشارك الذكي لتحليل الأعمال</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* منطقة المحادثة الرئيسية */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* منطقة الرسائل */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">مرحباً بك في Symbol AI</h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                أنا مستشارك الذكي لتحليل بيانات مشروعك. يمكنني مساعدتك في فهم الإيرادات، المصاريف، وتقديم توصيات عملية.
              </p>
              
              {/* الأسئلة المقترحة */}
              <div className="w-full max-w-2xl">
                <p className="text-sm text-muted-foreground mb-3">جرّب أحد هذه الأسئلة:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedQuestions?.slice(0, 6).map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      onClick={() => handleSendMessage(q)}
                      className="h-auto py-3 px-4 text-right justify-start hover:bg-amber-500/10 hover:border-amber-500/50 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 ml-2 flex-shrink-0 text-amber-500" />
                      <span className="text-sm line-clamp-2">{q}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-gradient-to-br from-amber-500 to-orange-600'
                  }`}>
                    {msg.role === 'user' ? <User className="h-5 w-5" /> : <Sparkles className="h-5 w-5 text-white" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-muted rounded-tl-none'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                      <span className="text-sm text-muted-foreground">Symbol AI يفكر...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* منطقة الإدخال */}
        <div className="flex-shrink-0 p-4 border-t bg-background/50 backdrop-blur-sm">
          <div className="flex gap-3 items-end">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="اكتب سؤالك لـ Symbol AI..."
              className="min-h-[50px] max-h-[150px] resize-none rounded-xl border-2 focus:border-amber-500/50"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              size="lg"
              className="h-[50px] w-[50px] rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
