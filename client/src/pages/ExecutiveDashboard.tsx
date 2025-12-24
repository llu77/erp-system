import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  BarChart3
} from "lucide-react";

export default function ExecutiveDashboard() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");
  
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

  const getSelectedBranchName = () => {
    if (selectedBranch === "all") return "جميع الفروع";
    return branches?.find(b => b.id.toString() === selectedBranch)?.name || "";
  };

  return (
    <div className="space-y-6">
      {/* العنوان والتحكم */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم التنفيذية</h1>
          <p className="text-muted-foreground">نظرة شاملة على أداء الأعمال - {getSelectedBranchName()}</p>
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
        </div>
      </div>

      {/* مؤشرات الأداء الرئيسية */}
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
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.daysCount || 0} يوم مسجل
                </p>
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

        {/* إجمالي المصاريف */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المصاريف</CardTitle>
            <Wallet className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(kpis?.totalExpenses || 0)}
                </div>
                {comparison && (
                  <p className={`text-xs flex items-center gap-1 mt-1 ${comparison.changes.expensesChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {comparison.changes.expensesChange <= 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {formatPercent(comparison.changes.expensesChange)} عن {getPeriodLabel()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.expensesCount || 0} مصروف
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* هامش الربح */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
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
