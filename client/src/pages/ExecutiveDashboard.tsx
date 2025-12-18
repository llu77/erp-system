import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Users, 
  FileText,
  AlertTriangle,
  Package,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw
} from "lucide-react";

export default function ExecutiveDashboard() {
  const [period, setPeriod] = useState("monthly");
  const [dateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return { start, end };
  });

  // جلب مؤشرات الأداء المالي
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = trpc.kpis.calculate.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
  });

  // جلب الاتجاهات الشهرية
  const { data: trends, isLoading: trendsLoading } = trpc.kpis.trends.useQuery({ months: 12 });

  // جلب تقرير ABC
  const { data: abcReport, isLoading: abcLoading } = trpc.kpis.abcReport.useQuery();

  // جلب تنبيهات الأمان غير المقروءة
  const { data: securityAlerts } = trpc.security.unreadAlerts.useQuery();

  // جلب اقتراحات إعادة الطلب
  const { data: reorderSuggestions } = trpc.inventory.reorderSuggestions.pending.useQuery();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // حساب التغير عن الفترة السابقة
  const calculateChange = useMemo(() => {
    if (!trends || trends.length < 2) return null;
    const current = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    
    return {
      sales: previous.sales > 0 ? ((current.sales - previous.sales) / previous.sales) * 100 : 0,
      profit: previous.profit !== 0 ? ((current.profit - previous.profit) / Math.abs(previous.profit)) * 100 : 0,
    };
  }, [trends]);

  return (
    <div className="space-y-6">
      {/* العنوان والتحكم */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم التنفيذية</h1>
          <p className="text-muted-foreground">نظرة شاملة على أداء الأعمال</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="الفترة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">يومي</SelectItem>
              <SelectItem value="weekly">أسبوعي</SelectItem>
              <SelectItem value="monthly">شهري</SelectItem>
              <SelectItem value="yearly">سنوي</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchKpis()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* التنبيهات */}
      {((securityAlerts && securityAlerts.length > 0) || (reorderSuggestions && reorderSuggestions.length > 0)) && (
        <div className="flex flex-wrap gap-2">
          {securityAlerts && securityAlerts.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {securityAlerts.length} تنبيه أمان
            </Badge>
          )}
          {reorderSuggestions && reorderSuggestions.length > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {reorderSuggestions.length} منتج يحتاج إعادة طلب
            </Badge>
          )}
        </div>
      )}

      {/* مؤشرات الأداء الرئيسية */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* إجمالي الإيرادات */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpis?.totalRevenue || 0)}</div>
                {calculateChange && (
                  <p className={`text-xs flex items-center gap-1 ${calculateChange.sales >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculateChange.sales >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(calculateChange.sales)} عن الشهر السابق
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* صافي الربح */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">صافي الربح</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${(kpis?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(kpis?.netProfit || 0)}
                </div>
                {calculateChange && (
                  <p className={`text-xs flex items-center gap-1 ${calculateChange.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculateChange.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(calculateChange.profit)} عن الشهر السابق
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* هامش الربح الإجمالي */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">هامش الربح الإجمالي</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{(kpis?.grossProfitMargin || 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  الربح الإجمالي: {formatCurrency(kpis?.grossProfit || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* هامش الربح الصافي */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">هامش الربح الصافي</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${(kpis?.netProfitMargin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(kpis?.netProfitMargin || 0).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  المصاريف: {formatCurrency(kpis?.totalExpenses || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* مؤشرات إضافية */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* العائد على الاستثمار */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">العائد على الاستثمار (ROI)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className={`text-2xl font-bold ${(kpis?.roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(kpis?.roi || 0).toFixed(1)}%
              </div>
            )}
          </CardContent>
        </Card>

        {/* نسبة السيولة */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نسبة السيولة</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className={`text-2xl font-bold ${(kpis?.currentRatio || 0) >= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                {(kpis?.currentRatio || 0).toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* عدد الفواتير */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عدد الفواتير</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.invoiceCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  متوسط قيمة الطلب: {formatCurrency(kpis?.averageOrderValue || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* عدد العملاء */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">العملاء النشطين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{kpis?.customerCount || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">الاتجاهات</TabsTrigger>
          <TabsTrigger value="abc">تحليل ABC</TabsTrigger>
        </TabsList>

        {/* الاتجاهات الشهرية */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>الاتجاهات الشهرية</CardTitle>
              <CardDescription>مقارنة المبيعات والأرباح والمصاريف خلال آخر 12 شهر</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2 px-3">الشهر</th>
                        <th className="text-right py-2 px-3">المبيعات</th>
                        <th className="text-right py-2 px-3">المصاريف</th>
                        <th className="text-right py-2 px-3">الربح</th>
                        <th className="text-right py-2 px-3">الفواتير</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trends?.map((trend, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3 font-medium">{trend.monthName}</td>
                          <td className="py-2 px-3">{formatCurrency(trend.sales)}</td>
                          <td className="py-2 px-3">{formatCurrency(trend.expenses)}</td>
                          <td className={`py-2 px-3 ${trend.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(trend.profit)}
                          </td>
                          <td className="py-2 px-3">{trend.invoiceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* تحليل ABC */}
        <TabsContent value="abc" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* الفئة A */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">الفئة A</CardTitle>
                  <Badge className="bg-green-500">80% من المبيعات</Badge>
                </div>
                <CardDescription>المنتجات الأكثر مبيعاً</CardDescription>
              </CardHeader>
              <CardContent>
                {abcLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{abcReport?.A?.length || 0} منتج</p>
                    <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto">
                      {abcReport?.A?.slice(0, 5).map((product, i) => (
                        <div key={i} className="flex justify-between py-1 border-b">
                          <span className="truncate">{product.productName}</span>
                          <span>{formatCurrency(parseFloat(product.totalSales || '0'))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الفئة B */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">الفئة B</CardTitle>
                  <Badge className="bg-amber-500">15% من المبيعات</Badge>
                </div>
                <CardDescription>المنتجات المتوسطة</CardDescription>
              </CardHeader>
              <CardContent>
                {abcLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{abcReport?.B?.length || 0} منتج</p>
                    <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto">
                      {abcReport?.B?.slice(0, 5).map((product, i) => (
                        <div key={i} className="flex justify-between py-1 border-b">
                          <span className="truncate">{product.productName}</span>
                          <span>{formatCurrency(parseFloat(product.totalSales || '0'))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الفئة C */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">الفئة C</CardTitle>
                  <Badge variant="secondary">5% من المبيعات</Badge>
                </div>
                <CardDescription>المنتجات الأقل مبيعاً</CardDescription>
              </CardHeader>
              <CardContent>
                {abcLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{abcReport?.C?.length || 0} منتج</p>
                    <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto">
                      {abcReport?.C?.slice(0, 5).map((product, i) => (
                        <div key={i} className="flex justify-between py-1 border-b">
                          <span className="truncate">{product.productName}</span>
                          <span>{formatCurrency(parseFloat(product.totalSales || '0'))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
