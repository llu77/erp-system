import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { 
  Trophy,
  Crown,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  User,
  Store,
  Calendar,
  ArrowRight,
  BarChart3,
  Users,
  DollarSign,
  Target,
} from 'lucide-react';
import { Link } from 'wouter';

export default function POSEmployeeRanking() {
  const { user } = useAuth();
  
  // State
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  // Filter branches based on user permissions
  const userBranchId = user?.branchId;
  const isAdmin = user?.role === 'admin';
  
  // Queries
  const { data: allBranches = [] } = trpc.pos.branches.list.useQuery();
  
  // Filter branches
  const branches = useMemo(() => {
    if (isAdmin) return allBranches;
    if (userBranchId) return allBranches.filter(b => b.id === userBranchId);
    return allBranches;
  }, [allBranches, isAdmin, userBranchId]);
  
  // Auto-select branch
  useState(() => {
    if (!isAdmin && userBranchId) {
      setSelectedBranchId(userBranchId);
    } else if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  });
  
  // Query for employee ranking
  const { data: employeesRanking = [], isLoading } = trpc.pos.employees.rankingByRevenue.useQuery(
    { branchId: selectedBranchId!, year: selectedYear, month: selectedMonth },
    { enabled: !!selectedBranchId }
  );
  
  // Calculate totals
  const totalRevenue = useMemo(() => 
    employeesRanking.reduce((sum, emp) => sum + emp.totalRevenue, 0),
    [employeesRanking]
  );
  
  const totalInvoices = useMemo(() => 
    employeesRanking.reduce((sum, emp) => sum + emp.invoiceCount, 0),
    [employeesRanking]
  );
  
  const months = [
    { value: 1, label: 'يناير' },
    { value: 2, label: 'فبراير' },
    { value: 3, label: 'مارس' },
    { value: 4, label: 'أبريل' },
    { value: 5, label: 'مايو' },
    { value: 6, label: 'يونيو' },
    { value: 7, label: 'يوليو' },
    { value: 8, label: 'أغسطس' },
    { value: 9, label: 'سبتمبر' },
    { value: 10, label: 'أكتوبر' },
    { value: 11, label: 'نوفمبر' },
    { value: 12, label: 'ديسمبر' },
  ];
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  
  const getRankStyle = (index: number) => {
    if (index === 0) return { bg: 'bg-gradient-to-br from-amber-500/20 to-amber-600/10', border: 'border-amber-500/50', text: 'text-amber-500', icon: Crown };
    if (index === 1) return { bg: 'bg-gradient-to-br from-slate-400/20 to-slate-500/10', border: 'border-slate-400/50', text: 'text-slate-400', icon: Medal };
    if (index === 2) return { bg: 'bg-gradient-to-br from-orange-600/20 to-orange-700/10', border: 'border-orange-600/50', text: 'text-orange-600', icon: Award };
    return { bg: 'bg-card', border: 'border-border', text: 'text-muted-foreground', icon: null };
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border/50 shadow-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/40 rounded-xl flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">ترتيب الموظفين</h1>
                <p className="text-sm text-muted-foreground">حسب الإيرادات الشهرية</p>
              </div>
            </div>
            
            <Link href="/pos">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="h-4 w-4" />
                العودة للكاشير
              </Button>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="container py-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Branch Selection */}
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-muted-foreground" />
                <Select 
                  value={selectedBranchId?.toString() || ''} 
                  onValueChange={(v) => setSelectedBranchId(Number(v))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Month Selection */}
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Select 
                  value={selectedMonth.toString()} 
                  onValueChange={(v) => setSelectedMonth(Number(v))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Year Selection */}
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold text-primary">{totalRevenue.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
                  <p className="text-2xl font-bold text-emerald-500">{totalInvoices.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">عدد الموظفين</p>
                  <p className="text-2xl font-bold text-amber-500">{employeesRanking.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Ranking List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              ترتيب الموظفين
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : employeesRanking.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">لا توجد بيانات للفترة المحددة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employeesRanking.map((emp, index) => {
                  const style = getRankStyle(index);
                  const IconComponent = style.icon;
                  
                  return (
                    <div 
                      key={emp.employeeId}
                      className={`p-4 rounded-xl border ${style.bg} ${style.border} transition-all hover:scale-[1.01]`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                          index < 3 ? style.bg : 'bg-muted'
                        } border-2 ${style.border}`}>
                          {IconComponent ? (
                            <IconComponent className={`h-6 w-6 ${style.text}`} />
                          ) : (
                            <span className={`text-xl font-bold ${style.text}`}>{emp.rank}</span>
                          )}
                        </div>
                        
                        {/* Employee Photo */}
                        {emp.photoUrl ? (
                          <img 
                            src={emp.photoUrl} 
                            alt={emp.employeeName}
                            className="w-14 h-14 rounded-full object-cover border-2 border-background shadow-md"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background">
                            <User className="h-7 w-7 text-primary" />
                          </div>
                        )}
                        
                        {/* Employee Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-lg">{emp.employeeName}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BarChart3 className="h-4 w-4" />
                              {emp.invoiceCount} فاتورة
                            </span>
                            {emp.invoiceCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Target className="h-4 w-4" />
                                متوسط: {(emp.totalRevenue / emp.invoiceCount).toFixed(0)} ر.س
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Revenue */}
                        <div className="text-left">
                          <p className={`text-2xl font-bold ${style.text}`}>
                            {emp.totalRevenue.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-sm text-muted-foreground">ر.س</span>
                            {emp.changePercentage !== undefined && emp.changePercentage !== 0 && (
                              <Badge 
                                variant={emp.changePercentage > 0 ? 'default' : 'destructive'}
                                className={`text-xs ${emp.changePercentage > 0 ? 'bg-emerald-500' : ''}`}
                              >
                                {emp.changePercentage > 0 ? (
                                  <TrendingUp className="h-3 w-3 ml-1" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 ml-1" />
                                )}
                                {Math.abs(emp.changePercentage)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
