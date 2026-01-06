import { useState, useMemo } from "react";
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
  Activity, Award, Percent, Calculator, FileText, CheckCircle, XCircle
} from "lucide-react";
import { toast } from "sonner";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [forecastDays, setForecastDays] = useState<number>(7);

  // حساب نطاق التاريخ
  const dateRange = useMemo(() => {
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
  }, [period]);

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

            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 ml-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">أسبوع</SelectItem>
                <SelectItem value="month">شهر</SelectItem>
                <SelectItem value="quarter">ربع سنة</SelectItem>
              </SelectContent>
            </Select>

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="revenue" className="gap-2">
              <DollarSign className="h-4 w-4" />
              الإيرادات
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <PieChartIcon className="h-4 w-4" />
              المصاريف
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              أداء الموظفين
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              التنبؤات
            </TabsTrigger>
          </TabsList>

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

          {/* التنبؤات */}
          <TabsContent value="forecast" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">التنبؤ بالإيرادات</h3>
              <Select 
                value={forecastDays.toString()} 
                onValueChange={(v) => setForecastDays(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <Calendar className="h-4 w-4 ml-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 أيام</SelectItem>
                  <SelectItem value="14">14 يوم</SelectItem>
                  <SelectItem value="30">30 يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>توقعات الإيرادات</CardTitle>
                  <CardDescription>
                    التنبؤ بالإيرادات للأيام القادمة بناءً على البيانات التاريخية والخوارزميات الإحصائية
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingForecast ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={revenueForecast || []}>
                        <defs>
                          <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => safeFormatDate(v, 'MM/dd')}
                        />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), '']}
                          labelFormatter={(label) => safeFormatDate(label, 'EEEE, d MMMM', { locale: ar })}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="predicted" 
                          name="المتوقع"
                          stroke="#8b5cf6" 
                          fill="url(#forecastGradient)"
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="upperBound" 
                          name="الحد الأعلى"
                          stroke="#10b981" 
                          strokeDasharray="5 5"
                          strokeWidth={1}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="lowerBound" 
                          name="الحد الأدنى"
                          stroke="#ef4444" 
                          strokeDasharray="5 5"
                          strokeWidth={1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-500/10 rounded-lg">
                        <DollarSign className="h-6 w-6 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">إجمالي المتوقع</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(
                            (revenueForecast || []).reduce((sum, f) => sum + f.predicted, 0)
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/10 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">متوسط الثقة</p>
                        <p className="text-2xl font-bold">
                          {(revenueForecast || []).length > 0 
                            ? Math.round((revenueForecast || []).reduce((sum, f) => sum + f.confidence, 0) / (revenueForecast || []).length)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">تفاصيل التنبؤ</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(revenueForecast || []).slice(0, 5).map((forecast, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {safeFormatDate(forecast.date, 'EEE d/M', { locale: ar })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(forecast.predicted)}</span>
                          <Badge variant="outline" className="text-xs">
                            {forecast.confidence}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  ملاحظات حول التنبؤ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <InsightCard
                    title="منهجية التنبؤ"
                    description="يستخدم التنبؤ الانحدار الخطي والمتوسطات المتحركة بناءً على بيانات آخر 60 يوم. تقل الثقة كلما ابتعدنا في المستقبل."
                    type="info"
                    icon={Calculator}
                  />
                  <InsightCard
                    title="حدود الثقة"
                    description="الحد الأعلى والأدنى يمثلان نطاق الثقة 95% بناءً على الانحراف المعياري التاريخي."
                    type="info"
                    icon={BarChart3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
