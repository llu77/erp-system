import { useState, useRef } from 'react';
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
  TrendingDown,
  Building2, 
  Scissors,
  RefreshCw,
  ArrowLeft,
  UserPlus,
  CheckCircle,
  Percent,
  Clock,
  Printer,
  CalendarDays
} from 'lucide-react';
import { Link } from 'wouter';

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'all';

const periodLabels: Record<PeriodType, string> = {
  week: 'أسبوع',
  month: 'شهر',
  quarter: 'ربع سنة',
  year: 'سنة',
  all: 'الكل',
};

const periodPreviousLabels: Record<PeriodType, string> = {
  week: 'الأسبوع الماضي',
  month: 'الشهر الماضي',
  quarter: 'الربع الماضي',
  year: 'السنة الماضية',
  all: '',
};

export default function LoyaltyReport() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month');
  const reportRef = useRef<HTMLDivElement>(null);
  
  const { data: stats, isLoading, refetch, isRefetching } = trpc.loyalty.detailedStats.useQuery({
    period: selectedPeriod,
    branchId: selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined,
  });
  
  const { data: branches } = trpc.loyalty.branches.useQuery();

  const handlePrint = () => {
    const printContent = reportRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>تقرير برنامج الولاء</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { color: #666; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .stat-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; }
          .stat-value { font-size: 28px; font-weight: bold; color: #333; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          .stat-change { font-size: 11px; margin-top: 5px; }
          .stat-change.positive { color: #22c55e; }
          .stat-change.negative { color: #ef4444; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background: #f5f5f5; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير برنامج الولاء</h1>
          <p>الفترة: ${periodLabels[selectedPeriod]} | ${selectedBranch === 'all' ? 'جميع الفروع' : branches?.find(b => b.id.toString() === selectedBranch)?.name}</p>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats?.overview.totalCustomers || 0}</div>
            <div class="stat-label">إجمالي العملاء</div>
            <div class="stat-change ${(stats?.overview.customersChange || 0) >= 0 ? 'positive' : 'negative'}">
              ${stats?.overview.customersChange || 0}% عن ${periodPreviousLabels[selectedPeriod]}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.overview.totalVisits || 0}</div>
            <div class="stat-label">إجمالي الزيارات</div>
            <div class="stat-change ${(stats?.overview.visitsChange || 0) >= 0 ? 'positive' : 'negative'}">
              ${stats?.overview.visitsChange || 0}% عن ${periodPreviousLabels[selectedPeriod]}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.overview.totalDiscounts || 0}</div>
            <div class="stat-label">الخصومات المستخدمة</div>
            <div class="stat-change ${(stats?.overview.discountsChange || 0) >= 0 ? 'positive' : 'negative'}">
              ${stats?.overview.discountsChange || 0}% عن ${periodPreviousLabels[selectedPeriod]}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.overview.daysInPeriod || 0}</div>
            <div class="stat-label">أيام الفترة</div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">إحصائيات الفروع</div>
          <table>
            <thead>
              <tr>
                <th>الفرع</th>
                <th>العملاء</th>
                <th>الزيارات</th>
                <th>الخصومات</th>
                <th>معلقة</th>
              </tr>
            </thead>
            <tbody>
              ${stats?.byBranch.map(b => `
                <tr>
                  <td>${b.branchName}</td>
                  <td>${b.customers}</td>
                  <td>${b.visits}</td>
                  <td>${b.discounts}</td>
                  <td>${b.pendingVisits}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">الخدمات الأكثر طلباً</div>
          <table>
            <thead>
              <tr>
                <th>الخدمة</th>
                <th>الزيارات</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              ${stats?.byService.map(s => `
                <tr>
                  <td>${s.serviceType}</td>
                  <td>${s.visits}</td>
                  <td>${s.percentage}%</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <p>Symbol AI - نظام إدارة برنامج الولاء</p>
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

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
    periodCustomers: 0,
    periodVisits: 0,
    periodDiscounts: 0,
    customersChange: 0,
    visitsChange: 0,
    discountsChange: 0,
    daysInPeriod: 0,
  };

  const ChangeIndicator = ({ value, label }: { value: number; label: string }) => {
    const isPositive = value >= 0;
    return (
      <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span>{Math.abs(value)}% عن {label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" ref={reportRef}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as PeriodType)}>
                <SelectTrigger className="w-[120px]">
                  <CalendarDays className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="الفترة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">أسبوع</SelectItem>
                  <SelectItem value="month">شهر</SelectItem>
                  <SelectItem value="quarter">ربع سنة</SelectItem>
                  <SelectItem value="year">سنة</SelectItem>
                  <SelectItem value="all">الكل</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[140px]">
                  <Building2 className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="الفرع" />
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
              <Button variant="default" className="gap-2" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                طباعة التقرير
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
                    +{overview.periodCustomers} في الفترة
                  </p>
                  {selectedPeriod !== 'all' && (
                    <ChangeIndicator value={overview.customersChange} label={periodPreviousLabels[selectedPeriod]} />
                  )}
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
                    +{overview.periodVisits} في الفترة
                  </p>
                  {selectedPeriod !== 'all' && (
                    <ChangeIndicator value={overview.visitsChange} label={periodPreviousLabels[selectedPeriod]} />
                  )}
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
                    +{overview.periodDiscounts} في الفترة
                  </p>
                  {selectedPeriod !== 'all' && (
                    <ChangeIndicator value={overview.discountsChange} label={periodPreviousLabels[selectedPeriod]} />
                  )}
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
                  <p className="text-sm text-muted-foreground">أيام الفترة</p>
                  <p className="text-2xl md:text-3xl font-bold text-purple-600">{overview.daysInPeriod}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    يوم مسجل
                  </p>
                  <p className="text-xs text-muted-foreground">
                    معدل: {overview.daysInPeriod > 0 ? (overview.periodVisits / overview.daysInPeriod).toFixed(1) : 0} زيارة/يوم
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <CalendarDays className="h-6 w-6 text-purple-600" />
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
