import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  PieChart,
  Calendar,
  RefreshCw,
  Mail,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

export default function SalesDashboard() {
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3months' | 'year'>('month');
  const [emailSending, setEmailSending] = useState(false);

  // حساب التواريخ بناءً على النطاق المحدد
  const { startDate, endDate, previousStartDate, previousEndDate } = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date, prevStart: Date, prevEnd: Date;
    
    switch (dateRange) {
      case 'week':
        start = subDays(now, 7);
        end = now;
        prevStart = subDays(now, 14);
        prevEnd = subDays(now, 7);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
        break;
      case '3months':
        start = subMonths(now, 3);
        end = now;
        prevStart = subMonths(now, 6);
        prevEnd = subMonths(now, 3);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        prevStart = new Date(now.getFullYear() - 1, 0, 1);
        prevEnd = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
    }
    
    return { startDate: start, endDate: end, previousStartDate: prevStart, previousEndDate: prevEnd };
  }, [dateRange]);

  // جلب بيانات المبيعات اليومية
  const { data: dailySales, isLoading: dailyLoading } = trpc.scheduledReports.dailySales.useQuery({
    startDate,
    endDate,
  });

  // جلب أفضل المنتجات
  const { data: topProducts, isLoading: productsLoading } = trpc.scheduledReports.topProducts.useQuery({
    limit: 10,
    startDate,
    endDate,
  });

  // جلب أفضل العملاء
  const { data: topCustomers, isLoading: customersLoading } = trpc.scheduledReports.topCustomers.useQuery({
    limit: 10,
    startDate,
    endDate,
  });

  // جلب المبيعات حسب الفئة
  const { data: salesByCategory, isLoading: categoryLoading } = trpc.scheduledReports.salesByCategory.useQuery({
    startDate,
    endDate,
  });

  // جلب مؤشرات الأداء
  const { data: kpis, isLoading: kpisLoading } = trpc.kpis.calculate.useQuery({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  // إرسال التقرير الأسبوعي
  const sendWeeklyReport = trpc.scheduledReports.sendWeekly.useMutation({
    onSuccess: () => {
      toast.success('تم إرسال التقرير الأسبوعي بنجاح');
      setEmailSending(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setEmailSending(false);
    },
  });

  const formatCurrency = (value: number | string | null | undefined) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatNumber = (value: number | string | null | undefined) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat('ar-SA').format(num);
  };

  // حساب إجمالي المبيعات
  const totalSales = dailySales?.reduce((sum, day) => sum + parseFloat(String(day.totalSales || 0)), 0) || 0;
  const totalOrders = dailySales?.reduce((sum, day) => sum + (day.invoiceCount || 0), 0) || 0;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  // حساب أعلى يوم مبيعات
  const maxSalesDay = dailySales?.reduce((max, day) => 
    parseFloat(String(day.totalSales || 0)) > parseFloat(String(max?.totalSales || 0)) ? day : max
  , dailySales?.[0]);

  // ألوان للرسوم البيانية
  const chartColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
  ];

  return (
    <div className="space-y-6">
      {/* العنوان والفلاتر */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            لوحة تحكم المبيعات
          </h1>
          <p className="text-muted-foreground">تحليل أداء المبيعات والرسوم البيانية التفاعلية</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">آخر أسبوع</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="3months">آخر 3 أشهر</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            onClick={() => {
              setEmailSending(true);
              sendWeeklyReport.mutate({ email: 'info@symbolai.net' });
            }}
            disabled={emailSending}
          >
            <Mail className={`h-4 w-4 ml-2 ${emailSending ? 'animate-pulse' : ''}`} />
            إرسال تقرير
          </Button>
        </div>
      </div>

      {/* بطاقات الملخص */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  {dateRange === 'week' ? 'آخر 7 أيام' : dateRange === 'month' ? 'هذا الشهر' : dateRange === '3months' ? 'آخر 3 أشهر' : 'هذه السنة'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عدد الطلبات</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatNumber(totalOrders)}</div>
                <p className="text-xs text-muted-foreground">طلب</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط قيمة الطلب</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(avgOrderValue)}</div>
                <p className="text-xs text-muted-foreground">لكل طلب</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أعلى يوم مبيعات</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : maxSalesDay ? (
              <>
                <div className="text-2xl font-bold">{formatCurrency(maxSalesDay.totalSales)}</div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(maxSalesDay.date), 'dd MMM yyyy', { locale: ar })}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">لا توجد بيانات</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* المبيعات اليومية */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>المبيعات اليومية</CardTitle>
            <CardDescription>تطور المبيعات خلال الفترة المحددة</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : dailySales && dailySales.length > 0 ? (
              <div className="h-64">
                <div className="flex h-full items-end gap-1">
                  {dailySales.map((day, index) => {
                    const maxValue = Math.max(...dailySales.map(d => parseFloat(String(d.totalSales || 0))));
                    const height = maxValue > 0 ? (parseFloat(String(day.totalSales || 0)) / maxValue) * 100 : 0;
                    return (
                      <div
                        key={index}
                        className="flex-1 bg-primary/80 hover:bg-primary rounded-t transition-all cursor-pointer group relative"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${format(new Date(day.date), 'dd/MM', { locale: ar })}: ${formatCurrency(day.totalSales)}`}
                      >
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                          <div className="font-medium">{format(new Date(day.date), 'dd MMM', { locale: ar })}</div>
                          <div>{formatCurrency(day.totalSales)}</div>
                          <div className="text-muted-foreground">{day.invoiceCount} طلب</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{dailySales[0] ? format(new Date(dailySales[0].date), 'dd/MM', { locale: ar }) : ''}</span>
                  <span>{dailySales[dailySales.length - 1] ? format(new Date(dailySales[dailySales.length - 1].date), 'dd/MM', { locale: ar }) : ''}</span>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                لا توجد بيانات مبيعات في هذه الفترة
              </div>
            )}
          </CardContent>
        </Card>

        {/* أفضل المنتجات */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              أفضل المنتجات مبيعاً
            </CardTitle>
            <CardDescription>المنتجات الأكثر مبيعاً في الفترة المحددة</CardDescription>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topProducts && topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => {
                  const maxRevenue = Math.max(...topProducts.map(p => parseFloat(String(p.totalRevenue || 0))));
                  const percentage = maxRevenue > 0 ? (parseFloat(String(product.totalRevenue || 0)) / maxRevenue) * 100 : 0;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium truncate max-w-[150px]">{product.name}</span>
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold">{formatCurrency(product.totalRevenue)}</div>
                          <div className="text-xs text-muted-foreground">{formatNumber(product.totalQuantity)} وحدة</div>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: chartColors[index % chartColors.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد بيانات منتجات</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* أفضل العملاء */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              أفضل العملاء
            </CardTitle>
            <CardDescription>العملاء الأكثر شراءً في الفترة المحددة</CardDescription>
          </CardHeader>
          <CardContent>
            {customersLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topCustomers && topCustomers.length > 0 ? (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => {
                  const maxPurchases = Math.max(...topCustomers.map(c => parseFloat(String(c.totalPurchases || 0))));
                  const percentage = maxPurchases > 0 ? (parseFloat(String(customer.totalPurchases || 0)) / maxPurchases) * 100 : 0;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium truncate max-w-[150px]">{customer.name}</span>
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold">{formatCurrency(customer.totalPurchases)}</div>
                          <div className="text-xs text-muted-foreground">{customer.invoiceCount} طلب</div>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: chartColors[index % chartColors.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد بيانات عملاء</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* المبيعات حسب الفئة */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              المبيعات حسب الفئة
            </CardTitle>
            <CardDescription>توزيع المبيعات على فئات المنتجات</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : salesByCategory && salesByCategory.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {/* الرسم البياني الدائري */}
                <div className="flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {(() => {
                        const total = salesByCategory.reduce((sum, cat) => sum + parseFloat(String(cat.totalSales || 0)), 0);
                        let currentAngle = 0;
                        return salesByCategory.map((category, index) => {
                          const percentage = total > 0 ? (parseFloat(String(category.totalSales || 0)) / total) * 100 : 0;
                          const angle = (percentage / 100) * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;
                          
                          // حساب نقاط القوس
                          const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const endX = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                          const endY = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);
                          const largeArc = angle > 180 ? 1 : 0;
                          
                          return (
                            <path
                              key={index}
                              d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                              fill={chartColors[index % chartColors.length]}
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-lg font-bold">{formatCurrency(salesByCategory.reduce((sum, cat) => sum + parseFloat(String(cat.totalSales || 0)), 0))}</div>
                        <div className="text-xs text-muted-foreground">إجمالي</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* قائمة الفئات */}
                <div className="space-y-2">
                  {salesByCategory.map((category, index) => {
                    const total = salesByCategory.reduce((sum, cat) => sum + parseFloat(String(cat.totalSales || 0)), 0);
                    const percentage = total > 0 ? (parseFloat(String(category.totalSales || 0)) / total) * 100 : 0;
                    return (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: chartColors[index % chartColors.length] }}
                          />
                          <span className="text-sm">{category.categoryName || 'بدون فئة'}</span>
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium">{formatCurrency(category.totalSales)}</div>
                          <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد بيانات فئات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
