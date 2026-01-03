import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Calendar, 
  Gift, 
  TrendingUp, 
  Building2, 
  Scissors,
  RefreshCw,
  ArrowLeft,
  UserPlus,
  CheckCircle,
  Percent,
  Clock
} from 'lucide-react';
import { Link } from 'wouter';

export default function LoyaltyReport() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  
  const { data: stats, isLoading, refetch, isRefetching } = trpc.loyalty.detailedStats.useQuery(
    selectedBranch !== 'all' ? { branchId: parseInt(selectedBranch) } : undefined
  );
  
  const { data: branches } = trpc.loyalty.branches.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const overview = stats?.overview || {
    totalCustomers: 0,
    totalVisits: 0,
    totalDiscounts: 0,
    customersThisMonth: 0,
    visitsThisMonth: 0,
    discountsThisMonth: 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/loyalty">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">تقرير برنامج الولاء</h1>
                <p className="text-sm text-muted-foreground">إحصائيات شاملة للعملاء والزيارات</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[140px] md:w-[180px]">
                  <SelectValue placeholder="جميع الفروع" />
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
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-600">{overview.totalCustomers}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{overview.customersThisMonth} هذا الشهر
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الزيارات</p>
                  <p className="text-2xl md:text-3xl font-bold text-green-600">{overview.totalVisits}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{overview.visitsThisMonth} هذا الشهر
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-full">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">الخصومات المستخدمة</p>
                  <p className="text-2xl md:text-3xl font-bold text-amber-600">{overview.totalDiscounts}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{overview.discountsThisMonth} هذا الشهر
                  </p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-full">
                  <Gift className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">معدل التحويل</p>
                  <p className="text-2xl md:text-3xl font-bold text-purple-600">
                    {overview.totalVisits > 0 
                      ? Math.round((overview.totalDiscounts / overview.totalVisits) * 100) 
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    زيارات → خصومات
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Stats & Service Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Branch Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                إحصائيات الفروع
              </CardTitle>
              <CardDescription>أداء كل فرع في برنامج الولاء</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.byBranch && stats.byBranch.length > 0 ? (
                <div className="space-y-3">
                  {stats.byBranch.map((branch) => (
                    <div 
                      key={branch.branchId} 
                      className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{branch.branchName}</span>
                        {branch.pendingVisits > 0 && (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                            <Clock className="h-3 w-3 ml-1" />
                            {branch.pendingVisits} معلقة
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-muted-foreground">{branch.customers} عميل</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-muted-foreground">{branch.visits} زيارة</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Gift className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-muted-foreground">{branch.discounts} خصم</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد بيانات للفروع</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scissors className="h-5 w-5 text-primary" />
                الخدمات الأكثر طلباً
              </CardTitle>
              <CardDescription>توزيع الزيارات حسب نوع الخدمة</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.byService && stats.byService.length > 0 ? (
                <div className="space-y-3">
                  {stats.byService.map((service, index) => (
                    <div key={service.serviceType} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          {service.serviceType}
                        </span>
                        <span className="text-muted-foreground">
                          {service.visits} ({service.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${service.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Scissors className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد بيانات للخدمات</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              الاتجاه الشهري
            </CardTitle>
            <CardDescription>تطور الأداء خلال الأشهر الستة الماضية</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.monthlyTrend && stats.monthlyTrend.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-[500px]">
                  {/* Chart Header */}
                  <div className="flex items-center justify-end gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">عملاء جدد</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">زيارات</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-muted-foreground">خصومات</span>
                    </div>
                  </div>
                  
                  {/* Simple Bar Chart */}
                  <div className="flex items-end justify-between gap-2 h-48 border-b border-border pb-2">
                    {stats.monthlyTrend.map((month, index) => {
                      const maxValue = Math.max(
                        ...stats.monthlyTrend.map(m => Math.max(m.customers, m.visits, m.discounts))
                      ) || 1;
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1">
                          <div className="flex items-end gap-0.5 h-40 w-full justify-center">
                            <div 
                              className="w-3 bg-blue-500 rounded-t transition-all duration-500"
                              style={{ height: `${(month.customers / maxValue) * 100}%`, minHeight: month.customers > 0 ? '4px' : '0' }}
                              title={`عملاء: ${month.customers}`}
                            />
                            <div 
                              className="w-3 bg-green-500 rounded-t transition-all duration-500"
                              style={{ height: `${(month.visits / maxValue) * 100}%`, minHeight: month.visits > 0 ? '4px' : '0' }}
                              title={`زيارات: ${month.visits}`}
                            />
                            <div 
                              className="w-3 bg-amber-500 rounded-t transition-all duration-500"
                              style={{ height: `${(month.discounts / maxValue) * 100}%`, minHeight: month.discounts > 0 ? '4px' : '0' }}
                              title={`خصومات: ${month.discounts}`}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground text-center whitespace-nowrap">
                            {month.month}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Stats Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-right py-2 font-medium text-muted-foreground">الشهر</th>
                          {stats.monthlyTrend.map((month, i) => (
                            <th key={i} className="text-center py-2 font-medium">{month.month}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50">
                          <td className="py-2 text-muted-foreground">عملاء</td>
                          {stats.monthlyTrend.map((month, i) => (
                            <td key={i} className="text-center py-2 text-blue-600">{month.customers}</td>
                          ))}
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-2 text-muted-foreground">زيارات</td>
                          {stats.monthlyTrend.map((month, i) => (
                            <td key={i} className="text-center py-2 text-green-600">{month.visits}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 text-muted-foreground">خصومات</td>
                          {stats.monthlyTrend.map((month, i) => (
                            <td key={i} className="text-center py-2 text-amber-600">{month.discounts}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد بيانات للاتجاه الشهري</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              النشاط الأخير
            </CardTitle>
            <CardDescription>آخر التسجيلات والزيارات في برنامج الولاء</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 10).map((activity, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-full ${
                      activity.type === 'registration' 
                        ? 'bg-blue-500/10 text-blue-600'
                        : activity.type === 'discount'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-green-500/10 text-green-600'
                    }`}>
                      {activity.type === 'registration' ? (
                        <UserPlus className="h-4 w-4" />
                      ) : activity.type === 'discount' ? (
                        <Percent className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{activity.customerName}</p>
                      <p className="text-sm text-muted-foreground truncate">{activity.details}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.date).toLocaleDateString('ar-SA', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      {activity.branchName && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {activity.branchName}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا يوجد نشاط حديث</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
