import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Users,
  TrendingUp,
  DollarSign,
  Award,
  FileText,
  Download,
  Calendar,
  Building2,
  Trophy,
  Medal,
  Star,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030110188/symbol-logo.png";

interface EmployeePerformance {
  rank: number;
  employeeId: number;
  employeeName: string;
  employeePhoto: string | null;
  employeePosition: string;
  totalRevenue: number;
  invoiceCount: number;
  serviceCount: number;
  averageInvoiceValue: number;
  cashAmount: number;
  cardAmount: number;
}

export default function POSEmployeeStats() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // State
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>('all');
  
  // Queries
  const { data: branches = [] } = trpc.branches.list.useQuery();
  // Calculate date range for the selected month
  const startDate = useMemo(() => {
    return new Date(selectedYear, selectedMonth - 1, 1).toISOString();
  }, [selectedMonth, selectedYear]);
  
  const endDate = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();
  }, [selectedMonth, selectedYear]);
  
  const { data: employeesData = [], isLoading } = trpc.pos.employeePerformance.topEmployees.useQuery({
    startDate,
    endDate,
    branchId: selectedBranchId === 'all' ? undefined : selectedBranchId,
    limit: 50,
  });
  
  const reportData = useMemo(() => ({
    employees: employeesData,
  }), [employeesData]);
  
  // Calculate stats
  const stats = useMemo(() => {
    if (!reportData?.employees) return { totalRevenue: 0, totalInvoices: 0, avgPerEmployee: 0, topEmployee: null };
    
    const totalRevenue = reportData.employees.reduce((sum: number, e: { totalRevenue: number }) => sum + e.totalRevenue, 0);
    const totalInvoices = reportData.employees.reduce((sum: number, e: { invoiceCount: number }) => sum + e.invoiceCount, 0);
    const avgPerEmployee = reportData.employees.length > 0 ? totalRevenue / reportData.employees.length : 0;
    const topEmployee = reportData.employees.length > 0 ? reportData.employees[0] : null;
    
    return { totalRevenue, totalInvoices, avgPerEmployee, topEmployee };
  }, [reportData]);
  
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
  
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  
  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <Star className="h-4 w-4 text-muted-foreground" />;
  };
  
  const handleExportPDF = () => {
    const params = new URLSearchParams({
      month: selectedMonth.toString(),
      year: selectedYear.toString(),
    });
    if (selectedBranchId !== 'all') {
      params.append('branchId', selectedBranchId.toString());
    }
    window.open(`/api/reports/employee-performance?${params.toString()}`, '_blank');
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header with Logo */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Symbol AI" className="h-14 w-14 rounded-xl shadow-lg" />
            <div>
              <h1 className="text-2xl font-bold text-white">إحصائيات الموظفين</h1>
              <p className="text-slate-400 mt-1">تقرير أداء الموظفين الشهري</p>
            </div>
          </div>
          
          <Button
            onClick={handleExportPDF}
            className="bg-primary hover:bg-primary/90 gap-2"
            size="lg"
          >
            <Download className="h-5 w-5" />
            تصدير PDF
          </Button>
        </div>
        
        {/* Filters */}
        <Card className="border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(v) => setSelectedMonth(Number(v))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="الشهر" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="السنة" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedBranchId.toString()}
                    onValueChange={(v) => setSelectedBranchId(v === 'all' ? 'all' : Number(v))}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="جميع الفروع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/20">
                  <DollarSign className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold text-green-400">
                    {stats.totalRevenue.toLocaleString()} ر.س
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <FileText className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">عدد الفواتير</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.totalInvoices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <Users className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الموظفون النشطون</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {reportData?.employees?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <TrendingUp className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">متوسط الإيراد/موظف</p>
                  <p className="text-2xl font-bold text-amber-400">
                    {stats.avgPerEmployee.toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Top Employee Card */}
        {stats.topEmployee && (
          <Card className="bg-gradient-to-l from-yellow-500/10 via-amber-500/5 to-transparent border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-yellow-500/50">
                    {stats.topEmployee.employeePhoto ? (
                      <img 
                        src={stats.topEmployee.employeePhoto} 
                        alt={stats.topEmployee.employeeName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center">
                        <Users className="h-10 w-10 text-yellow-500" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-2 -right-2">
                    <Trophy className="h-8 w-8 text-yellow-500 drop-shadow-lg" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-yellow-500/80 font-medium">الموظف الأفضل أداءً</p>
                  <h3 className="text-2xl font-bold text-white">{stats.topEmployee.employeeName}</h3>
                  <p className="text-muted-foreground">{stats.topEmployee.employeePosition || 'موظف'}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                      {stats.topEmployee.totalRevenue.toLocaleString()} ر.س
                    </Badge>
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-500/80">
                      {stats.topEmployee.invoiceCount} فاتورة
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Employees Table */}
        <Card className="border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              ترتيب الموظفين حسب الأداء
            </CardTitle>
            <CardDescription>
              {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-center font-bold w-16">#</TableHead>
                    <TableHead className="text-right font-bold">الموظف</TableHead>
                    <TableHead className="text-right font-bold">الفرع</TableHead>
                    <TableHead className="text-right font-bold">الإيرادات</TableHead>
                    <TableHead className="text-center font-bold">الفواتير</TableHead>
                    <TableHead className="text-right font-bold">متوسط الفاتورة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        جاري التحميل...
                      </TableCell>
                    </TableRow>
                  ) : !reportData?.employees?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>لا توجد بيانات للفترة المحددة</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.employees.map((employee: EmployeePerformance, index: number) => (
                      <TableRow 
                        key={employee.employeeId} 
                        className={`hover:bg-muted/30 transition-colors ${index < 3 ? 'bg-muted/10' : ''}`}
                      >
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            {getRankIcon(index)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-600">
                              {employee.employeePhoto ? (
                                <img 
                                  src={employee.employeePhoto} 
                                  alt={employee.employeeName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <Users className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold">{employee.employeeName}</p>
                              <p className="text-sm text-muted-foreground">{employee.employeePosition || 'موظف'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">الفرع</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-lg text-primary">
                            {employee.totalRevenue.toLocaleString()} ر.س
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{employee.invoiceCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">
                            {employee.invoiceCount > 0 
                              ? (employee.totalRevenue / employee.invoiceCount).toFixed(0) 
                              : 0} ر.س
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
