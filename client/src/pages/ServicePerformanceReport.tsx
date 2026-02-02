import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  FileText,
  Download,
  Calendar,
  Store,
  Scissors,
  DollarSign,
  ShoppingCart,
  Award,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export default function ServicePerformanceReport() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userBranchId = user?.branchId;
  
  // State
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(
    isAdmin ? undefined : userBranchId || undefined
  );
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  // حساب تواريخ الفترة
  const dateRange = useMemo(() => {
    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, [selectedYear, selectedMonth]);
  
  // Queries
  const { data: branches = [] } = trpc.pos.branches.list.useQuery();
  
  const { data: topServices = [], isLoading: isLoadingServices } = trpc.pos.servicePerformance.topServices.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    branchId: selectedBranchId,
    limit: 20,
  });
  
  const { data: categoryPerformance = [], isLoading: isLoadingCategories } = trpc.pos.servicePerformance.byCategory.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    branchId: selectedBranchId,
  });
  
  const { data: summary, isLoading: isLoadingSummary } = trpc.pos.servicePerformance.summary.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    branchId: selectedBranchId,
  });
  
  const { data: dailyData = [], isLoading: isLoadingDaily } = trpc.pos.servicePerformance.daily.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    branchId: selectedBranchId,
  });
  
  // فلترة الفروع حسب صلاحيات المستخدم
  const filteredBranches = useMemo(() => {
    if (isAdmin) return branches;
    if (userBranchId) return branches.filter(b => b.id === userBranchId);
    return branches;
  }, [branches, isAdmin, userBranchId]);
  
  // حساب أعلى إيراد للخدمات للـ Progress bar
  const maxRevenue = useMemo(() => {
    if (topServices.length === 0) return 1;
    return Math.max(...topServices.map(s => s.totalRevenue));
  }, [topServices]);
  
  // حساب إجمالي إيرادات الفئات
  const totalCategoryRevenue = useMemo(() => {
    return categoryPerformance.reduce((sum, cat) => sum + cat.totalRevenue, 0);
  }, [categoryPerformance]);
  
  // تنسيق الأرقام
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ar-SA').format(Math.round(num));
  };
  
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(num);
  };
  
  // أسماء الأشهر
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  
  // تصدير PDF
  const handleExportPDF = () => {
    const branchName = selectedBranchId 
      ? branches.find(b => b.id === selectedBranchId)?.nameAr || 'جميع الفروع'
      : 'جميع الفروع';
    const monthName = monthNames[selectedMonth - 1];
    
    // فتح نافذة جديدة للتصدير
    const url = `/api/reports/service-performance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&branchId=${selectedBranchId || ''}&branchName=${encodeURIComponent(branchName)}&month=${monthName}&year=${selectedYear}`;
    window.open(url, '_blank');
  };
  
  const isLoading = isLoadingServices || isLoadingCategories || isLoadingSummary || isLoadingDaily;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">تقرير أداء الخدمات</h1>
            <p className="text-muted-foreground">تحليل شامل للخدمات الأكثر طلباً وإيراداتها</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* فلتر الفرع */}
            {isAdmin && (
              <Select 
                value={selectedBranchId?.toString() || 'all'} 
                onValueChange={(v) => setSelectedBranchId(v === 'all' ? undefined : Number(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <Store className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {filteredBranches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* فلتر الشهر */}
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 ml-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* فلتر السنة */}
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* زر التصدير */}
            <Button onClick={handleExportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              تصدير PDF
            </Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold">
                    {isLoadingSummary ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(summary?.totalRevenue || 0)}
                  </p>
                  {summary && summary.revenueChange !== 0 && (
                    <div className={`flex items-center gap-1 text-sm ${summary.revenueChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.revenueChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {Math.abs(summary.revenueChange)}% عن الفترة السابقة
                    </div>
                  )}
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الخدمات المقدمة</p>
                  <p className="text-2xl font-bold">
                    {isLoadingSummary ? <Loader2 className="h-6 w-6 animate-spin" /> : formatNumber(summary?.totalServices || 0)}
                  </p>
                  {summary && summary.servicesChange !== 0 && (
                    <div className={`flex items-center gap-1 text-sm ${summary.servicesChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.servicesChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {Math.abs(summary.servicesChange)}% عن الفترة السابقة
                    </div>
                  )}
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Scissors className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">عدد الفواتير</p>
                  <p className="text-2xl font-bold">
                    {isLoadingSummary ? <Loader2 className="h-6 w-6 animate-spin" /> : formatNumber(summary?.totalInvoices || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    متوسط {formatCurrency(summary?.averageInvoiceValue || 0)} / فاتورة
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-full">
                  <FileText className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">الخدمات الفريدة</p>
                  <p className="text-2xl font-bold">
                    {isLoadingSummary ? <Loader2 className="h-6 w-6 animate-spin" /> : formatNumber(summary?.uniqueServices || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">خدمة مختلفة</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <ShoppingCart className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Services */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                الخدمات الأكثر طلباً
              </CardTitle>
              <CardDescription>ترتيب الخدمات حسب عدد الطلبات</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingServices ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : topServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                  <p>لا توجد بيانات للفترة المحددة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topServices.slice(0, 10).map((service, index) => (
                    <div key={service.serviceId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={index < 3 ? 'default' : 'secondary'}
                            className={index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : ''}
                          >
                            #{service.rank}
                          </Badge>
                          <div>
                            <p className="font-medium">{service.serviceNameAr}</p>
                            <p className="text-sm text-muted-foreground">{service.serviceName}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{formatNumber(service.totalQuantity)} طلب</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(service.totalRevenue)}</p>
                        </div>
                      </div>
                      <Progress 
                        value={(service.totalRevenue / maxRevenue) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Category Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                أداء الأقسام
              </CardTitle>
              <CardDescription>توزيع الإيرادات حسب القسم</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCategories ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : categoryPerformance.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                  <p>لا توجد بيانات</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {categoryPerformance.map((category) => {
                    const percentage = totalCategoryRevenue > 0 
                      ? (category.totalRevenue / totalCategoryRevenue) * 100 
                      : 0;
                    return (
                      <div key={category.categoryId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: category.categoryColor || '#6366f1' }}
                            />
                            <span className="font-medium">{category.categoryNameAr}</span>
                          </div>
                          <span className="text-sm font-bold">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{formatNumber(category.totalQuantity)} خدمة</span>
                          <span>{formatCurrency(category.totalRevenue)}</span>
                        </div>
                        <Progress 
                          value={percentage} 
                          className="h-2"
                          style={{ 
                            // @ts-ignore
                            '--progress-background': category.categoryColor || '#6366f1' 
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Daily Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              الأداء اليومي
            </CardTitle>
            <CardDescription>تطور الإيرادات والخدمات خلال الشهر</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDaily ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : dailyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
                <p>لا توجد بيانات للفترة المحددة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-3 px-4 font-medium">التاريخ</th>
                      <th className="text-right py-3 px-4 font-medium">الإيرادات</th>
                      <th className="text-right py-3 px-4 font-medium">الخدمات</th>
                      <th className="text-right py-3 px-4 font-medium">الفواتير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((day) => (
                      <tr key={day.date} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          {new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-3 px-4 font-medium">{formatCurrency(day.totalRevenue)}</td>
                        <td className="py-3 px-4">{formatNumber(day.totalServices)}</td>
                        <td className="py-3 px-4">{formatNumber(day.invoiceCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-bold">
                      <td className="py-3 px-4">الإجمالي</td>
                      <td className="py-3 px-4">{formatCurrency(dailyData.reduce((sum, d) => sum + d.totalRevenue, 0))}</td>
                      <td className="py-3 px-4">{formatNumber(dailyData.reduce((sum, d) => sum + d.totalServices, 0))}</td>
                      <td className="py-3 px-4">{formatNumber(dailyData.reduce((sum, d) => sum + d.invoiceCount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
