import { useState, useMemo, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  BarChart3,
  Users,
  DollarSign,
  Target,
  Sparkles,
  Flame,
  Star,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import POSNavHeader from '@/components/POSNavHeader';

// Memoized Employee Card Component for better performance
const EmployeeRankCard = memo(({ 
  emp, 
  index, 
  maxRevenue 
}: { 
  emp: {
    employeeId: number;
    employeeName: string;
    photoUrl?: string | null;
    totalRevenue: number;
    invoiceCount: number;
    cashAmount?: number;
    networkAmount?: number;
    rank: number;
    changePercentage?: number;
  };
  index: number;
  maxRevenue: number;
}) => {
  const getRankStyle = (idx: number) => {
    if (idx === 0) return { 
      bg: 'bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-amber-600/10', 
      border: 'border-amber-500/50 shadow-amber-500/20 shadow-lg', 
      text: 'text-amber-500', 
      icon: Crown,
      glow: 'ring-2 ring-amber-500/30'
    };
    if (idx === 1) return { 
      bg: 'bg-gradient-to-br from-slate-400/20 via-gray-400/15 to-slate-500/10', 
      border: 'border-slate-400/50 shadow-slate-400/20 shadow-md', 
      text: 'text-slate-400', 
      icon: Medal,
      glow: 'ring-2 ring-slate-400/30'
    };
    if (idx === 2) return { 
      bg: 'bg-gradient-to-br from-orange-600/20 via-amber-600/15 to-orange-700/10', 
      border: 'border-orange-600/50 shadow-orange-600/20 shadow-md', 
      text: 'text-orange-600', 
      icon: Award,
      glow: 'ring-2 ring-orange-600/30'
    };
    return { 
      bg: 'bg-card hover:bg-muted/50', 
      border: 'border-border', 
      text: 'text-muted-foreground', 
      icon: null,
      glow: ''
    };
  };

  const style = getRankStyle(index);
  const IconComponent = style.icon;
  const progressPercentage = maxRevenue > 0 ? (emp.totalRevenue / maxRevenue) * 100 : 0;
  const avgPerInvoice = emp.invoiceCount > 0 ? emp.totalRevenue / emp.invoiceCount : 0;

  return (
    <div 
      className={`p-4 rounded-xl border-2 ${style.bg} ${style.border} ${style.glow} transition-all duration-300 hover:scale-[1.01] hover:shadow-xl`}
    >
      <div className="flex items-center gap-4">
        {/* Rank Badge */}
        <div className={`relative w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
          index < 3 ? style.bg : 'bg-muted'
        } border-2 ${style.border}`}>
          {IconComponent ? (
            <>
              <IconComponent className={`h-7 w-7 ${style.text}`} />
              {index === 0 && (
                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-amber-400 animate-pulse" />
              )}
            </>
          ) : (
            <span className={`text-xl font-bold ${style.text}`}>{emp.rank}</span>
          )}
        </div>
        
        {/* Employee Photo */}
        <div className="relative">
          {emp.photoUrl ? (
            <img 
              src={emp.photoUrl} 
              alt={emp.employeeName}
              className="w-16 h-16 rounded-full object-cover border-3 border-background shadow-lg"
              loading="lazy"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border-3 border-background shadow-lg">
              <User className="h-8 w-8 text-primary" />
            </div>
          )}
          {index < 3 && (
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${
              index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : 'bg-orange-600'
            } flex items-center justify-center text-white text-xs font-bold shadow-md`}>
              {index + 1}
            </div>
          )}
        </div>
        
        {/* Employee Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-lg truncate">{emp.employeeName}</p>
            {index === 0 && <Flame className="h-5 w-5 text-orange-500 animate-bounce" />}
          </div>
          
          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-full">
              <BarChart3 className="h-3.5 w-3.5" />
              {emp.invoiceCount} فاتورة
            </span>
            <span className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-full">
              <Target className="h-3.5 w-3.5" />
              متوسط: {avgPerInvoice.toFixed(0)} ر.س
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-2">
            <Progress 
              value={progressPercentage} 
              className={`h-2 ${index === 0 ? '[&>div]:bg-amber-500' : index === 1 ? '[&>div]:bg-slate-400' : index === 2 ? '[&>div]:bg-orange-600' : ''}`}
            />
          </div>
        </div>
        
        {/* Revenue */}
        <div className="text-left min-w-[140px]">
          <p className={`text-2xl font-bold ${style.text}`}>
            {emp.totalRevenue.toLocaleString()}
          </p>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-sm text-muted-foreground">ر.س</span>
            {emp.changePercentage !== undefined && emp.changePercentage !== 0 && (
              <Badge 
                variant={emp.changePercentage > 0 ? 'default' : 'destructive'}
                className={`text-xs gap-1 ${emp.changePercentage > 0 ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
              >
                {emp.changePercentage > 0 ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {Math.abs(emp.changePercentage)}%
              </Badge>
            )}
          </div>
          
          {/* Payment Methods */}
          {(emp.cashAmount !== undefined || emp.networkAmount !== undefined) && (
            <div className="flex gap-2 mt-2 justify-end text-xs">
              {emp.cashAmount !== undefined && (
                <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded">
                  كاش: {emp.cashAmount.toLocaleString()}
                </span>
              )}
              {emp.networkAmount !== undefined && (
                <span className="bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">
                  شبكة: {emp.networkAmount.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

EmployeeRankCard.displayName = 'EmployeeRankCard';

// Summary Card Component
const SummaryCard = memo(({ 
  icon: Icon, 
  title, 
  value, 
  suffix,
  gradient 
}: { 
  icon: React.ElementType;
  title: string;
  value: number | string;
  suffix?: string;
  gradient: string;
}) => (
  <Card className={`${gradient} border-0 overflow-hidden relative`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
    <CardContent className="pt-6 relative">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg">
          <Icon className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-sm text-white/80">{title}</p>
          <p className="text-3xl font-bold text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
            {suffix && <span className="text-lg mr-1">{suffix}</span>}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
));

SummaryCard.displayName = 'SummaryCard';

export default function POSEmployeeRanking() {
  const { user } = useAuth();
  
  // State
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Filter branches based on user permissions
  const userBranchId = user?.branchId;
  const isAdmin = user?.role === 'admin';
  
  // Queries with optimized stale time
  const { data: allBranches = [] } = trpc.pos.branches.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Filter branches
  const branches = useMemo(() => {
    if (isAdmin) return allBranches;
    if (userBranchId) return allBranches.filter(b => b.id === userBranchId);
    return allBranches;
  }, [allBranches, isAdmin, userBranchId]);
  
  // Auto-select branch
  useMemo(() => {
    if (!selectedBranchId) {
      if (!isAdmin && userBranchId) {
        setSelectedBranchId(userBranchId);
      } else if (branches.length > 0) {
        setSelectedBranchId(branches[0].id);
      }
    }
  }, [branches, isAdmin, userBranchId, selectedBranchId]);
  
  // Query for employee ranking with optimized options
  const { data: employeesRanking = [], isLoading } = trpc.pos.employees.rankingByRevenue.useQuery(
    { branchId: selectedBranchId!, year: selectedYear, month: selectedMonth },
    { 
      enabled: !!selectedBranchId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      refetchOnWindowFocus: false,
    }
  );
  
  // Memoized calculations
  const { totalRevenue, totalInvoices, maxRevenue, avgRevenue } = useMemo(() => {
    const total = employeesRanking.reduce((sum, emp) => sum + emp.totalRevenue, 0);
    const invoices = employeesRanking.reduce((sum, emp) => sum + emp.invoiceCount, 0);
    const max = employeesRanking.length > 0 ? Math.max(...employeesRanking.map(e => e.totalRevenue)) : 0;
    const avg = employeesRanking.length > 0 ? total / employeesRanking.length : 0;
    return { totalRevenue: total, totalInvoices: invoices, maxRevenue: max, avgRevenue: avg };
  }, [employeesRanking]);
  
  // Handlers
  const handleBranchChange = useCallback((value: string) => {
    setSelectedBranchId(Number(value));
  }, []);
  
  const handleMonthChange = useCallback((value: string) => {
    setSelectedMonth(Number(value));
  }, []);
  
  const handleYearChange = useCallback((value: string) => {
    setSelectedYear(Number(value));
  }, []);
  
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  
  const months = useMemo(() => [
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
  ], []);
  
  const years = useMemo(() => 
    Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i),
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" dir="rtl">
      {/* POS Navigation Header */}
      <div className="print:hidden">
        <POSNavHeader 
          title="ترتيب الموظفين" 
          subtitle="حسب الإيرادات الشهرية"
          icon={<Trophy className="h-5 w-5 text-amber-500" />}
        />
      </div>
      
      {/* Sub Header with Print Button */}
      <div className="h-12 bg-card/50 border-b flex items-center justify-end px-6 print:hidden">
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة
        </Button>
      </div>
      
      <main className="container py-6 space-y-6">
        {/* Filters Card */}
        <Card className="border-2 border-dashed border-border/50 bg-card/50 backdrop-blur print:hidden">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Branch Selection */}
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                <Store className="h-5 w-5 text-primary mr-2" />
                <Select 
                  value={selectedBranchId?.toString() || ''} 
                  onValueChange={handleBranchChange}
                >
                  <SelectTrigger className="w-[200px] border-0 bg-transparent">
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
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                <Calendar className="h-5 w-5 text-primary mr-2" />
                <Select 
                  value={selectedMonth.toString()} 
                  onValueChange={handleMonthChange}
                >
                  <SelectTrigger className="w-[140px] border-0 bg-transparent">
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
              <div className="bg-muted/50 rounded-lg p-1">
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={handleYearChange}
                >
                  <SelectTrigger className="w-[100px] border-0 bg-transparent">
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
            </div>
          </CardContent>
        </Card>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={DollarSign}
            title="إجمالي الإيرادات"
            value={totalRevenue}
            suffix="ر.س"
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          />
          <SummaryCard
            icon={BarChart3}
            title="إجمالي الفواتير"
            value={totalInvoices}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          />
          <SummaryCard
            icon={Users}
            title="عدد الموظفين"
            value={employeesRanking.length}
            gradient="bg-gradient-to-br from-purple-500 to-purple-700"
          />
          <SummaryCard
            icon={Target}
            title="متوسط الإيراد"
            value={avgRevenue.toFixed(0)}
            suffix="ر.س"
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          />
        </div>
        
        {/* Top 3 Podium (for print and visual appeal) */}
        {employeesRanking.length >= 3 && (
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 to-slate-800">
            <CardContent className="pt-8 pb-6">
              <div className="flex items-end justify-center gap-4">
                {/* Second Place */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    {employeesRanking[1]?.photoUrl ? (
                      <img 
                        src={employeesRanking[1].photoUrl} 
                        alt={employeesRanking[1].employeeName}
                        className="w-20 h-20 rounded-full object-cover border-4 border-slate-400 shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-400/20 flex items-center justify-center border-4 border-slate-400">
                        <User className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                    <Medal className="absolute -bottom-2 -right-2 h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-white font-bold text-center">{employeesRanking[1]?.employeeName}</p>
                  <p className="text-slate-400 text-sm">{employeesRanking[1]?.totalRevenue.toLocaleString()} ر.س</p>
                  <div className="w-24 h-20 bg-gradient-to-t from-slate-400/30 to-slate-400/10 rounded-t-lg mt-2 flex items-center justify-center">
                    <span className="text-4xl font-bold text-slate-400">2</span>
                  </div>
                </div>
                
                {/* First Place */}
                <div className="flex flex-col items-center -mt-8">
                  <div className="relative mb-2">
                    <Sparkles className="absolute -top-4 left-1/2 -translate-x-1/2 h-6 w-6 text-amber-400 animate-pulse" />
                    {employeesRanking[0]?.photoUrl ? (
                      <img 
                        src={employeesRanking[0].photoUrl} 
                        alt={employeesRanking[0].employeeName}
                        className="w-28 h-28 rounded-full object-cover border-4 border-amber-500 shadow-xl shadow-amber-500/30"
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-amber-500/20 flex items-center justify-center border-4 border-amber-500">
                        <User className="h-14 w-14 text-amber-500" />
                      </div>
                    )}
                    <Crown className="absolute -bottom-2 -right-2 h-10 w-10 text-amber-500" />
                  </div>
                  <p className="text-white font-bold text-lg text-center">{employeesRanking[0]?.employeeName}</p>
                  <p className="text-amber-500 font-bold">{employeesRanking[0]?.totalRevenue.toLocaleString()} ر.س</p>
                  <div className="w-28 h-28 bg-gradient-to-t from-amber-500/30 to-amber-500/10 rounded-t-lg mt-2 flex items-center justify-center">
                    <span className="text-5xl font-bold text-amber-500">1</span>
                  </div>
                </div>
                
                {/* Third Place */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    {employeesRanking[2]?.photoUrl ? (
                      <img 
                        src={employeesRanking[2].photoUrl} 
                        alt={employeesRanking[2].employeeName}
                        className="w-20 h-20 rounded-full object-cover border-4 border-orange-600 shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-orange-600/20 flex items-center justify-center border-4 border-orange-600">
                        <User className="h-10 w-10 text-orange-600" />
                      </div>
                    )}
                    <Award className="absolute -bottom-2 -right-2 h-8 w-8 text-orange-600" />
                  </div>
                  <p className="text-white font-bold text-center">{employeesRanking[2]?.employeeName}</p>
                  <p className="text-orange-500 text-sm">{employeesRanking[2]?.totalRevenue.toLocaleString()} ر.س</p>
                  <div className="w-24 h-16 bg-gradient-to-t from-orange-600/30 to-orange-600/10 rounded-t-lg mt-2 flex items-center justify-center">
                    <span className="text-4xl font-bold text-orange-600">3</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Ranking List */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                قائمة الترتيب الكاملة
              </CardTitle>
              <Badge variant="outline" className="text-muted-foreground">
                {employeesRanking.length} موظف
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : employeesRanking.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="w-24 h-24 mx-auto mb-6 bg-muted/50 rounded-full flex items-center justify-center">
                  <Trophy className="h-12 w-12 opacity-30" />
                </div>
                <p className="text-xl font-medium">لا توجد بيانات للفترة المحددة</p>
                <p className="text-sm mt-2">جرب اختيار شهر أو فرع مختلف</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employeesRanking.map((emp, index) => (
                  <EmployeeRankCard 
                    key={emp.employeeId}
                    emp={emp}
                    index={index}
                    maxRevenue={maxRevenue}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      {/* Print Styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
