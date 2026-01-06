import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { format, subDays } from "date-fns";
import { ar } from "date-fns/locale";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter
} from "recharts";
import {
  Brain, Sparkles, TrendingUp, TrendingDown, Users, Target, AlertTriangle,
  Lightbulb, Zap, RefreshCw, ChevronRight, ArrowUpRight, ArrowDownRight,
  ShoppingCart, DollarSign, Package, Clock, Calendar, Building2, Star
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

// مكون بطاقة الرؤية
function InsightCard({ 
  title, 
  description, 
  impact, 
  confidence, 
  type,
  action 
}: {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  type: 'opportunity' | 'risk' | 'trend';
  action?: string;
}) {
  const impactColors = {
    high: 'bg-red-500/10 text-red-500 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  const typeIcons = {
    opportunity: <Lightbulb className="h-5 w-5 text-green-500" />,
    risk: <AlertTriangle className="h-5 w-5 text-red-500" />,
    trend: <TrendingUp className="h-5 w-5 text-blue-500" />,
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-muted rounded-lg">
            {typeIcons[type]}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <h4 className="font-semibold">{title}</h4>
              <Badge className={impactColors[impact]}>
                {impact === 'high' ? 'تأثير عالي' : impact === 'medium' ? 'تأثير متوسط' : 'تأثير منخفض'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">الثقة:</span>
                <Progress value={confidence} className="w-20 h-2" />
                <span className="text-xs font-medium">{confidence}%</span>
              </div>
              {action && (
                <Button variant="link" size="sm" className="text-primary">
                  {action}
                  <ChevronRight className="h-4 w-4 mr-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// مكون شريحة العملاء
function CustomerSegmentCard({ 
  segment 
}: { 
  segment: {
    name: string;
    count: number;
    percentage: number;
    avgValue: number;
    description: string;
    color: string;
  }
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: segment.color }}
          />
          <h4 className="font-semibold">{segment.name}</h4>
          <Badge variant="outline">{segment.count} عميل</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{segment.description}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">النسبة</p>
            <p className="text-lg font-bold">{segment.percentage.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">متوسط القيمة</p>
            <p className="text-lg font-bold">{formatCurrency(segment.avgValue)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIAnalytics() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [forecastDays, setForecastDays] = useState<number>(7);

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  const branchId = selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined;

  // جلب التنبؤ بالمبيعات
  const { data: salesForecast, isLoading: loadingForecast, refetch: refetchForecast } = 
    trpc.bi.forecastSales.useQuery({ branchId, days: forecastDays });

  // جلب شرائح العملاء
  const { data: customerSegments, isLoading: loadingSegments } = 
    trpc.bi.getCustomerSegments.useQuery();

  // جلب الكشف عن الشذوذ
  const { data: anomalies, isLoading: loadingAnomalies } = 
    trpc.bi.detectAnomalies.useQuery({
      startDate: subDays(new Date(), 30).toISOString(),
      endDate: new Date().toISOString(),
    });

  // جلب التوصيات الذكية
  const { data: recommendations, isLoading: loadingRecommendations } = 
    trpc.bi.getSmartRecommendations.useQuery();

  // جلب رؤى AI
  const { data: aiInsights, isLoading: loadingInsights } = 
    trpc.bi.getAIInsights.useQuery({ branchId });

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
            <p className="text-muted-foreground">رؤى وتوصيات ذكية مبنية على تحليل البيانات</p>
          </div>
          
          <div className="flex items-center gap-3">
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

            <Button variant="outline" size="icon" onClick={() => refetchForecast()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* AI Summary Card */}
        {aiInsights && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  ملخص الذكاء الاصطناعي
                </CardTitle>
                <Badge variant={
                  aiInsights.riskLevel === 'low' ? 'default' :
                  aiInsights.riskLevel === 'medium' ? 'secondary' : 'destructive'
                }>
                  {aiInsights.riskLevel === 'low' ? 'مخاطر منخفضة' :
                   aiInsights.riskLevel === 'medium' ? 'مخاطر متوسطة' : 'مخاطر عالية'}
                </Badge>
              </div>
              <CardDescription>{aiInsights.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    النتائج الرئيسية
                  </h4>
                  <ul className="space-y-2">
                    {aiInsights.keyFindings.slice(0, 3).map((finding: string, i: number) => (
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
                    {aiInsights.recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    المخاطر
                  </h4>
                  <ul className="space-y-2">
                    {(aiInsights as any).risks?.slice(0, 3).map((risk: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                        {risk}
                      </li>
                    )) || <li className="text-sm text-muted-foreground">لا توجد مخاطر محددة</li>}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="forecast" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              التنبؤ
            </TabsTrigger>
            <TabsTrigger value="segments" className="gap-2">
              <Users className="h-4 w-4" />
              شرائح العملاء
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              الشذوذ
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              التوصيات
            </TabsTrigger>
          </TabsList>

          {/* التنبؤ بالمبيعات */}
          <TabsContent value="forecast" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">التنبؤ بالمبيعات</h3>
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
                  <CardTitle>توقعات المبيعات</CardTitle>
                  <CardDescription>التنبؤ بالمبيعات للأيام القادمة بناءً على البيانات التاريخية</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingForecast ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={(salesForecast as any)?.forecast || salesForecast || []}>
                        <defs>
                          <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => safeFormatDate(v, 'MM/dd', { locale: ar })}
                          className="text-xs"
                        />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'المتوقع']}
                          labelFormatter={(label) => safeFormatDate(label, 'EEEE, d MMMM', { locale: ar })}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="predicted" 
                          stroke="#3b82f6" 
                          fill="url(#forecastGradient)"
                          strokeWidth={2}
                          name="المتوقع"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="upperBound" 
                          stroke="#10b981" 
                          strokeDasharray="5 5"
                          strokeWidth={1}
                          name="الحد الأعلى"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="lowerBound" 
                          stroke="#ef4444" 
                          strokeDasharray="5 5"
                          strokeWidth={1}
                          name="الحد الأدنى"
                        />
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-lg">
                        <DollarSign className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">إجمالي المتوقع</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency((salesForecast as any)?.totalPredicted || 0)}
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
                        <p className="text-sm text-muted-foreground">نسبة الثقة</p>
                        <p className="text-2xl font-bold">
                          {((salesForecast as any)?.confidence || 85).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${
                        ((salesForecast as any)?.trend || 0) >= 0 
                          ? 'bg-green-500/10' 
                          : 'bg-red-500/10'
                      }`}>
                        {((salesForecast as any)?.trend || 0) >= 0 
                          ? <ArrowUpRight className="h-6 w-6 text-green-500" />
                          : <ArrowDownRight className="h-6 w-6 text-red-500" />
                        }
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">الاتجاه</p>
                        <p className={`text-2xl font-bold ${
                          ((salesForecast as any)?.trend || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {((salesForecast as any)?.trend || 0) >= 0 ? '+' : ''}
                          {((salesForecast as any)?.trend || 0).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* شرائح العملاء */}
          <TabsContent value="segments" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">تحليل شرائح العملاء (RFM)</h3>
                <p className="text-sm text-muted-foreground">
                  تصنيف العملاء بناءً على الحداثة (Recency)، التكرار (Frequency)، والقيمة المالية (Monetary)
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>توزيع الشرائح</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSegments ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={(customerSegments as any)?.segments || customerSegments || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="name"
                          label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                        >
                          {((customerSegments as any)?.segments || customerSegments || []).map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>قيمة الشرائح</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSegments ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={(customerSegments as any)?.segments || customerSegments || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="totalValue" name="إجمالي القيمة" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingSegments ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-[180px]" />)
              ) : (
                ((customerSegments as any)?.segments || customerSegments || [])?.map((segment: any, index: number) => (
                  <CustomerSegmentCard 
                    key={segment.name} 
                    segment={{
                      ...segment,
                      color: COLORS[index % COLORS.length]
                    }} 
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* الكشف عن الشذوذ */}
          <TabsContent value="anomalies" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">الكشف عن الشذوذ</h3>
                <p className="text-sm text-muted-foreground">
                  تحديد المعاملات والأنماط غير الطبيعية تلقائيًا
                </p>
              </div>
              <Badge variant={
                ((anomalies as any)?.totalAnomalies || (anomalies as any[])?.length || 0) === 0 ? 'default' :
                ((anomalies as any)?.totalAnomalies || (anomalies as any[])?.length || 0) < 5 ? 'secondary' : 'destructive'
              }>
                {(anomalies as any)?.totalAnomalies || (anomalies as any[])?.length || 0} شذوذ مكتشف
              </Badge>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>توزيع الشذوذ عبر الوقت</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingAnomalies ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => safeFormatDate(v, 'MM/dd')}
                          className="text-xs"
                        />
                        <YAxis dataKey="value" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => safeFormatDate(label, 'yyyy-MM-dd')}
                        />
                        <Scatter 
                          data={(anomalies as any)?.anomalies || anomalies || []} 
                          fill="#ef4444"
                          name="شذوذ"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">أنواع الشذوذ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingAnomalies ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(anomalies as any)?.byType?.map((type: any) => (
                          <div key={type.type} className="flex items-center justify-between">
                            <span className="text-sm">{type.type}</span>
                            <Badge variant="outline">{type.count}</Badge>
                          </div>
                        )) || <p className="text-sm text-muted-foreground">لا توجد بيانات</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* قائمة الشذوذ */}
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الشذوذ المكتشف</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAnomalies ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
) : ((anomalies as any)?.anomalies?.length || (anomalies as any[])?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لم يتم اكتشاف أي شذوذ في الفترة المحددة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {((anomalies as any)?.anomalies || anomalies)?.slice(0, 10).map((anomaly: any, index: number) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium">{anomaly.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(anomaly.date), 'yyyy-MM-dd HH:mm', { locale: ar })}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{formatCurrency(anomaly.value)}</p>
                          <Badge variant={
                            anomaly.severity === 'high' ? 'destructive' :
                            anomaly.severity === 'medium' ? 'secondary' : 'outline'
                          }>
                            {anomaly.severity === 'high' ? 'عالي' :
                             anomaly.severity === 'medium' ? 'متوسط' : 'منخفض'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* التوصيات الذكية */}
          <TabsContent value="recommendations" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">التوصيات الذكية</h3>
                <p className="text-sm text-muted-foreground">
                  توصيات مخصصة بناءً على تحليل أنماط البيانات
                </p>
              </div>
            </div>

            {loadingRecommendations ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[150px]" />)}
              </div>
            ) : (recommendations?.length || 0) === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد توصيات حالياً</p>
                  <p className="text-sm">سيتم إنشاء توصيات عند توفر بيانات كافية للتحليل</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {recommendations?.map((rec, index) => (
                  <InsightCard
                    key={index}
                    title={rec.title}
                    description={rec.description}
                    impact={rec.priority === 'critical' || rec.priority === 'high' ? 'high' : 
                            rec.priority === 'medium' ? 'medium' : 'low'}
                    confidence={rec.confidence || 75}
                    type={rec.priority === 'critical' ? 'risk' : 
                          rec.priority === 'high' ? 'opportunity' : 'trend'}
                    action={rec.actionRequired}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
