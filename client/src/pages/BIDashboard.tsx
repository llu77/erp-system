import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, DollarSign, ShoppingCart, Users, Package,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Brain, Sparkles, Target,
  RefreshCw, Download, Calendar, Building2, BarChart3, PieChart as PieChartIcon,
  Activity, Zap, Bell, ChevronRight
} from "lucide-react";

// ألوان الرسوم البيانية
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// دالة تنسيق الأرقام
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

// دالة تنسيق العملة
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(amount);
}

// مكون KPI Card
function KPICard({ 
  title, 
  value, 
  previousValue, 
  change, 
  changePercent, 
  trend, 
  icon: Icon, 
  color = 'blue',
  loading = false 
}: {
  title: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ElementType;
  color?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    red: 'bg-red-500/10 text-red-500',
    purple: 'bg-purple-500/10 text-purple-500',
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">{formatCurrency(value)}</h3>
          <div className="flex items-center gap-2">
            {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-green-500" />}
            {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-red-500" />}
            {trend === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
            <span className={`text-sm font-medium ${
              trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
            }`}>
              {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">مقارنة بالفترة السابقة</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// مكون التنبيهات
function AlertsCard({ alerts }: { alerts: { type: string; message: string; priority: 'low' | 'medium' | 'high' }[] }) {
  const priorityColors = {
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    high: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          التنبيهات
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد تنبيهات</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div key={index} className={`p-3 rounded-lg border ${priorityColors[alert.priority]}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// مكون أفضل الفروع
function TopBranchesCard({ branches, loading }: { 
  branches: { branchId: number; branchName: string; sales: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxSales = Math.max(...branches.map(b => b.sales), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5" />
          أفضل الفروع
        </CardTitle>
      </CardHeader>
      <CardContent>
        {branches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
        ) : (
          <div className="space-y-4">
            {branches.map((branch, index) => (
              <div key={branch.branchId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-yellow-950' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-amber-600 text-amber-50' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-medium">{branch.branchName}</span>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(branch.sales)}</span>
                </div>
                <Progress value={(branch.sales / maxSales) * 100} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BIDashboard() {
  // حالة الفلاتر
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // حساب التواريخ
  const dates = useMemo(() => {
    const end = new Date();
    let start: Date;
    
    switch (dateRange) {
      case 'today':
        start = new Date();
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = subDays(end, 7);
        break;
      case 'month':
        start = startOfMonth(end);
        break;
      case 'quarter':
        start = subMonths(end, 3);
        break;
      case 'year':
        start = subMonths(end, 12);
        break;
      default:
        start = startOfMonth(end);
    }
    
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [dateRange]);

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // جلب البيانات
  const branchId = selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined;
  
  const { data: executiveSummary, isLoading: loadingExecutive, refetch: refetchExecutive } = 
    trpc.bi.getExecutiveSummary.useQuery({
      ...dates,
      branchId,
    });

  const { data: salesAnalytics, isLoading: loadingSales } = 
    trpc.bi.getSalesAnalytics.useQuery({
      ...dates,
      branchId,
      groupBy: dateRange === 'year' ? 'month' : dateRange === 'quarter' ? 'week' : 'day',
    });

  const { data: inventoryAnalytics, isLoading: loadingInventory } = 
    trpc.bi.getInventoryAnalytics.useQuery({ branchId });

  const { data: financialAnalytics, isLoading: loadingFinancial } = 
    trpc.bi.getFinancialAnalytics.useQuery({
      ...dates,
      branchId,
    });

  const { data: aiInsights, isLoading: loadingAI } = 
    trpc.bi.getAIInsights.useQuery({ branchId });

  const { data: recommendations, isLoading: loadingRecommendations } = 
    trpc.bi.getSmartRecommendations.useQuery();

  // تحديث البيانات
  const handleRefresh = () => {
    refetchExecutive();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-7 w-7" />
              لوحة التحليلات المتقدمة
            </h1>
            <p className="text-muted-foreground">تحليلات شاملة للأعمال مع رؤى الذكاء الاصطناعي</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* فلتر الفترة */}
            <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 ml-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">الأسبوع</SelectItem>
                <SelectItem value="month">الشهر</SelectItem>
                <SelectItem value="quarter">الربع</SelectItem>
                <SelectItem value="year">السنة</SelectItem>
              </SelectContent>
            </Select>

            {/* فلتر الفرع */}
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

            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="إجمالي المبيعات"
            value={executiveSummary?.totalSales.value || 0}
            previousValue={executiveSummary?.totalSales.previousValue || 0}
            change={executiveSummary?.totalSales.change || 0}
            changePercent={executiveSummary?.totalSales.changePercent || 0}
            trend={executiveSummary?.totalSales.trend || 'stable'}
            icon={DollarSign}
            color="green"
            loading={loadingExecutive}
          />
          <KPICard
            title="إجمالي المصروفات"
            value={executiveSummary?.totalExpenses.value || 0}
            previousValue={executiveSummary?.totalExpenses.previousValue || 0}
            change={executiveSummary?.totalExpenses.change || 0}
            changePercent={executiveSummary?.totalExpenses.changePercent || 0}
            trend={executiveSummary?.totalExpenses.trend || 'stable'}
            icon={ShoppingCart}
            color="red"
            loading={loadingExecutive}
          />
          <KPICard
            title="صافي الربح"
            value={executiveSummary?.netProfit.value || 0}
            previousValue={executiveSummary?.netProfit.previousValue || 0}
            change={executiveSummary?.netProfit.change || 0}
            changePercent={executiveSummary?.netProfit.changePercent || 0}
            trend={executiveSummary?.netProfit.trend || 'stable'}
            icon={TrendingUp}
            color="blue"
            loading={loadingExecutive}
          />
          <KPICard
            title="عدد الفواتير"
            value={executiveSummary?.totalInvoices.value || 0}
            previousValue={executiveSummary?.totalInvoices.previousValue || 0}
            change={executiveSummary?.totalInvoices.change || 0}
            changePercent={executiveSummary?.totalInvoices.changePercent || 0}
            trend={executiveSummary?.totalInvoices.trend || 'stable'}
            icon={Package}
            color="purple"
            loading={loadingExecutive}
          />
        </div>

        {/* AI Insights Card */}
        {aiInsights && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                رؤى الذكاء الاصطناعي
                <Badge variant={
                  aiInsights.riskLevel === 'low' ? 'default' :
                  aiInsights.riskLevel === 'medium' ? 'secondary' : 'destructive'
                }>
                  {aiInsights.riskLevel === 'low' ? 'مخاطر منخفضة' :
                   aiInsights.riskLevel === 'medium' ? 'مخاطر متوسطة' : 'مخاطر عالية'}
                </Badge>
              </CardTitle>
              <CardDescription>{aiInsights.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    النتائج الرئيسية
                  </h4>
                  <ul className="space-y-2">
                    {aiInsights.keyFindings.map((finding, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    التوصيات
                  </h4>
                  <ul className="space-y-2">
                    {aiInsights.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts Section */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              المبيعات
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="h-4 w-4" />
              المخزون
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              المالية
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Brain className="h-4 w-4" />
              الذكاء الاصطناعي
            </TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Sales Trend Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>اتجاه المبيعات</CardTitle>
                  <CardDescription>المبيعات اليومية خلال الفترة المحددة</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSales ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={salesAnalytics?.salesByDay || []}>
                        <defs>
                          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => format(new Date(v), 'MM/dd', { locale: ar })}
                          className="text-xs"
                        />
                        <YAxis tickFormatter={formatNumber} className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'المبيعات']}
                          labelFormatter={(label) => format(new Date(label), 'EEEE, d MMMM', { locale: ar })}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="sales" 
                          stroke="#3b82f6" 
                          fill="url(#salesGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top Branches */}
              <TopBranchesCard 
                branches={executiveSummary?.topBranches || []} 
                loading={loadingExecutive}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle>أفضل المنتجات</CardTitle>
                  <CardDescription>المنتجات الأكثر مبيعاً</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSales ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={salesAnalytics?.topProducts?.slice(0, 5) || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={formatNumber} />
                        <YAxis dataKey="productName" type="category" width={100} className="text-xs" />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), 'المبيعات']} />
                        <Bar dataKey="sales" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top Customers */}
              <Card>
                <CardHeader>
                  <CardTitle>أفضل العملاء</CardTitle>
                  <CardDescription>العملاء الأكثر شراءً</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSales ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={salesAnalytics?.topCustomers?.slice(0, 5) || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={formatNumber} />
                        <YAxis dataKey="customerName" type="category" width={100} className="text-xs" />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), 'المشتريات']} />
                        <Bar dataKey="sales" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <Package className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                      <p className="text-2xl font-bold">{inventoryAnalytics?.totalProducts || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">قيمة المخزون</p>
                      <p className="text-2xl font-bold">{formatCurrency(inventoryAnalytics?.totalValue || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/10 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">مخزون منخفض</p>
                      <p className="text-2xl font-bold">{inventoryAnalytics?.lowStockProducts || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-lg">
                      <Package className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">نفاد المخزون</p>
                      <p className="text-2xl font-bold">{inventoryAnalytics?.outOfStockProducts || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* ABC Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>تحليل ABC</CardTitle>
                  <CardDescription>تصنيف المنتجات حسب القيمة</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingInventory ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'فئة A (80%)', value: inventoryAnalytics?.abcAnalysis?.A?.value || 0, count: inventoryAnalytics?.abcAnalysis?.A?.count || 0 },
                            { name: 'فئة B (15%)', value: inventoryAnalytics?.abcAnalysis?.B?.value || 0, count: inventoryAnalytics?.abcAnalysis?.B?.count || 0 },
                            { name: 'فئة C (5%)', value: inventoryAnalytics?.abcAnalysis?.C?.value || 0, count: inventoryAnalytics?.abcAnalysis?.C?.count || 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, count }) => `${name}: ${count} منتج`}
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#10b981" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Products by Category */}
              <Card>
                <CardHeader>
                  <CardTitle>المنتجات حسب الفئة</CardTitle>
                  <CardDescription>توزيع المنتجات على الفئات</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingInventory ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={inventoryAnalytics?.productsByCategory?.slice(0, 6) || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="categoryName" className="text-xs" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="عدد المنتجات" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Reorder Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  اقتراحات إعادة الطلب
                </CardTitle>
                <CardDescription>المنتجات التي تحتاج إعادة طلب</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingInventory ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : inventoryAnalytics?.reorderSuggestions?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد منتجات تحتاج إعادة طلب</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-2 px-4">المنتج</th>
                          <th className="text-right py-2 px-4">المخزون الحالي</th>
                          <th className="text-right py-2 px-4">الحد الأدنى</th>
                          <th className="text-right py-2 px-4">الكمية المقترحة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryAnalytics?.reorderSuggestions?.slice(0, 10).map((item) => (
                          <tr key={item.productId} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-4 font-medium">{item.productName}</td>
                            <td className="py-2 px-4">
                              <Badge variant={item.currentStock === 0 ? 'destructive' : 'secondary'}>
                                {item.currentStock}
                              </Badge>
                            </td>
                            <td className="py-2 px-4">{item.reorderPoint}</td>
                            <td className="py-2 px-4 font-bold text-primary">{item.suggestedQuantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">الإيرادات</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(financialAnalytics?.revenue || 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">تكلفة البضاعة</p>
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(financialAnalytics?.costOfGoodsSold || 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">إجمالي الربح</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {formatCurrency(financialAnalytics?.grossProfit || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    هامش: {(financialAnalytics?.grossMargin || 0).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">صافي الربح</p>
                  <p className="text-2xl font-bold text-purple-500">
                    {formatCurrency(financialAnalytics?.netProfit || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    هامش: {(financialAnalytics?.netMargin || 0).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Revenue vs Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle>الإيرادات مقابل المصروفات</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingFinancial ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={financialAnalytics?.revenueVsExpenses || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => format(new Date(v), 'MM/dd')}
                          className="text-xs"
                        />
                        <YAxis tickFormatter={formatNumber} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" name="الإيرادات" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="expenses" name="المصروفات" stroke="#ef4444" strokeWidth={2} />
                        <Line type="monotone" dataKey="profit" name="الربح" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Expenses by Category */}
              <Card>
                <CardHeader>
                  <CardTitle>المصروفات حسب الفئة</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingFinancial ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={financialAnalytics?.expensesByCategory || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="amount"
                          nameKey="category"
                          label={({ category, percentage }) => `${category}: ${percentage.toFixed(0)}%`}
                        >
                          {financialAnalytics?.expensesByCategory?.map((_, index) => (
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
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Smart Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    التوصيات الذكية
                  </CardTitle>
                  <CardDescription>توصيات مبنية على تحليل البيانات</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRecommendations ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                  ) : recommendations?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">لا توجد توصيات حالياً</p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {recommendations?.map((rec, index) => (
                        <div 
                          key={index} 
                          className={`p-4 rounded-lg border ${
                            rec.priority === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                            rec.priority === 'high' ? 'border-yellow-500/50 bg-yellow-500/5' :
                            rec.priority === 'medium' ? 'border-blue-500/50 bg-blue-500/5' :
                            'border-muted'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-semibold">{rec.title}</h4>
                            <Badge variant={
                              rec.priority === 'critical' ? 'destructive' :
                              rec.priority === 'high' ? 'default' : 'secondary'
                            }>
                              {rec.priority === 'critical' ? 'حرج' :
                               rec.priority === 'high' ? 'عالي' :
                               rec.priority === 'medium' ? 'متوسط' : 'منخفض'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-primary">الإجراء: {rec.actionRequired}</span>
                            <span className="text-green-500">التأثير: {rec.expectedImpact}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alerts */}
              <AlertsCard alerts={executiveSummary?.alerts || []} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
