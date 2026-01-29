import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';
import { 
  AlertTriangle, 
  Clock, 
  FileText, 
  Eye,
  Search,
  RefreshCw,
  Calendar,
  User,
  Building,
  IdCard,
  Heart,
  FileSignature,
  CheckCircle2,
  XCircle,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EmployeeDocument {
  id: number;
  code: string;
  name: string;
  branchId: number;
  branchName: string;
  phone: string | null;
  position: string | null;
  photoUrl: string | null;
  iqamaNumber: string | null;
  iqamaExpiryDate: Date | null;
  iqamaImageUrl: string | null;
  healthCertExpiryDate: Date | null;
  healthCertImageUrl: string | null;
  contractExpiryDate: Date | null;
  contractImageUrl: string | null;
  isActive: boolean;
}

// حساب الأيام المتبقية
function getDaysRemaining(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiryDate = new Date(date);
  expiryDate.setHours(0, 0, 0, 0);
  const diffTime = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// تنسيق التاريخ
function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// الحصول على لون الحالة
function getStatusColor(days: number | null): string {
  if (days === null) return 'bg-gray-100 text-gray-600';
  if (days < 0) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
  if (days <= 7) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
  if (days <= 30) return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
  if (days <= 60) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
  return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
}

// الحصول على نص الحالة
function getStatusText(days: number | null): string {
  if (days === null) return 'غير محدد';
  if (days < 0) return `منتهية منذ ${Math.abs(days)} يوم`;
  if (days === 0) return 'تنتهي اليوم!';
  if (days === 1) return 'تنتهي غداً!';
  return `${days} يوم متبقي`;
}

// مكون التقويم المرئي
function DocumentCalendar({ employees, selectedBranch }: { 
  employees: EmployeeDocument[]; 
  selectedBranch: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // جمع جميع الوثائق مع تواريخها
  const allDocuments = useMemo(() => {
    const docs: Array<{
      employeeId: number;
      employeeName: string;
      employeeCode: string;
      branchId: number;
      branchName: string;
      documentType: 'iqama' | 'healthCert' | 'contract';
      documentName: string;
      expiryDate: Date;
    }> = [];
    
    const filteredEmployees = selectedBranch === 'all' 
      ? employees 
      : employees.filter(e => e.branchId === parseInt(selectedBranch));
    
    filteredEmployees.forEach(emp => {
      if (emp.iqamaExpiryDate) {
        docs.push({
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.code,
          branchId: emp.branchId,
          branchName: emp.branchName,
          documentType: 'iqama',
          documentName: 'الإقامة',
          expiryDate: new Date(emp.iqamaExpiryDate),
        });
      }
      if (emp.healthCertExpiryDate) {
        docs.push({
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.code,
          branchId: emp.branchId,
          branchName: emp.branchName,
          documentType: 'healthCert',
          documentName: 'الشهادة الصحية',
          expiryDate: new Date(emp.healthCertExpiryDate),
        });
      }
      if (emp.contractExpiryDate) {
        docs.push({
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.code,
          branchId: emp.branchId,
          branchName: emp.branchName,
          documentType: 'contract',
          documentName: 'عقد العمل',
          expiryDate: new Date(emp.contractExpiryDate),
        });
      }
    });
    
    return docs;
  }, [employees, selectedBranch]);
  
  // أيام الشهر الحالي
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: Array<{ date: Date | null; documents: typeof allDocuments }> = [];
    
    // أيام فارغة قبل بداية الشهر
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, documents: [] });
    }
    
    // أيام الشهر
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const docsOnDay = allDocuments.filter(doc => {
        const docDate = new Date(doc.expiryDate);
        return docDate.getDate() === day && 
               docDate.getMonth() === month && 
               docDate.getFullYear() === year;
      });
      days.push({ date, documents: docsOnDay });
    }
    
    return days;
  }, [currentMonth, allDocuments]);
  
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  
  const dayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  
  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const goToToday = () => {
    setCurrentMonth(new Date());
  };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const getDocumentColor = (type: 'iqama' | 'healthCert' | 'contract') => {
    switch (type) {
      case 'iqama': return 'bg-blue-500';
      case 'healthCert': return 'bg-green-500';
      case 'contract': return 'bg-purple-500';
    }
  };
  
  const getDocumentIcon = (type: 'iqama' | 'healthCert' | 'contract') => {
    switch (type) {
      case 'iqama': return <IdCard className="w-3 h-3" />;
      case 'healthCert': return <Heart className="w-3 h-3" />;
      case 'contract': return <FileSignature className="w-3 h-3" />;
    }
  };
  
  return (
    <div className="space-y-4">
      {/* رأس التقويم */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            اليوم
          </Button>
        </div>
        
        <h3 className="text-xl font-bold text-black dark:text-white">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>إقامة</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>شهادة صحية</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span>عقد</span>
          </div>
        </div>
      </div>
      
      {/* شبكة التقويم */}
      <div className="grid grid-cols-7 gap-1">
        {/* أسماء الأيام */}
        {dayNames.map((day, i) => (
          <div key={i} className="p-2 text-center font-bold text-muted-foreground bg-slate-100 dark:bg-slate-800 rounded">
            {day}
          </div>
        ))}
        
        {/* أيام الشهر */}
        {calendarDays.map((day, i) => {
          if (!day.date) {
            return <div key={i} className="p-2 min-h-[100px] bg-slate-50 dark:bg-slate-900/50 rounded"></div>;
          }
          
          const isToday = day.date.getTime() === today.getTime();
          const isPast = day.date < today;
          const hasExpired = day.documents.some(d => new Date(d.expiryDate) < today);
          
          return (
            <div 
              key={i} 
              className={`p-2 min-h-[100px] rounded border transition-all ${
                isToday ? 'border-2 border-primary bg-primary/5' :
                hasExpired ? 'border-red-300 bg-red-50 dark:bg-red-950/30' :
                day.documents.length > 0 ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/30' :
                'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <div className={`text-sm font-bold mb-1 ${
                isToday ? 'text-primary' :
                isPast ? 'text-muted-foreground' :
                'text-black dark:text-white'
              }`}>
                {day.date.getDate()}
              </div>
              
              <div className="space-y-1">
                {day.documents.slice(0, 3).map((doc, j) => (
                  <div 
                    key={j}
                    className={`text-xs p-1 rounded text-white flex items-center gap-1 truncate ${getDocumentColor(doc.documentType)}`}
                    title={`${doc.employeeName} - ${doc.documentName}`}
                  >
                    {getDocumentIcon(doc.documentType)}
                    <span className="truncate">{doc.employeeName}</span>
                  </div>
                ))}
                {day.documents.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{day.documents.length - 3} أخرى
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DocumentsDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDocument | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: documentsData, isLoading, refetch } = trpc.employees.getExpiringDocuments.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  
  // تحويل البيانات إلى قائمة موظفين موحدة
  const allEmployees = useMemo(() => {
    if (!documentsData || !documentsData.expired || !documentsData.expiring) return [];
    
    const employeeMap = new Map<number, EmployeeDocument>();
    
    // جمع جميع الموظفين من expired و expiring
    const addEmployees = (emps: any[]) => {
      emps.forEach(emp => {
        if (!employeeMap.has(emp.id)) {
          employeeMap.set(emp.id, {
            id: emp.id,
            code: emp.code,
            name: emp.name,
            branchId: emp.branchId,
            branchName: emp.branchName || 'غير محدد',
            phone: emp.phone,
            position: emp.position,
            photoUrl: null,
            iqamaNumber: emp.iqamaNumber,
            iqamaExpiryDate: emp.iqamaExpiryDate,
            iqamaImageUrl: emp.iqamaImageUrl,
            healthCertExpiryDate: emp.healthCertExpiryDate,
            healthCertImageUrl: emp.healthCertImageUrl,
            contractExpiryDate: emp.contractExpiryDate,
            contractImageUrl: emp.contractImageUrl,
            isActive: emp.isActive ?? true,
          });
        }
      });
    };
    
    addEmployees(documentsData.expired.iqama || []);
    addEmployees(documentsData.expired.healthCert || []);
    addEmployees(documentsData.expired.contract || []);
    addEmployees(documentsData.expiring.iqama || []);
    addEmployees(documentsData.expiring.healthCert || []);
    addEmployees(documentsData.expiring.contract || []);
    
    return Array.from(employeeMap.values());
  }, [documentsData]);
  
  // حساب الإحصائيات
  const stats = useMemo(() => {
    if (!documentsData?.summary) {
      return {
        totalExpired: 0,
        totalExpiring: 0,
        expiredIqama: 0,
        expiredHealthCert: 0,
        expiredContract: 0,
        expiringIqama: 0,
        expiringHealthCert: 0,
        expiringContract: 0,
      };
    }
    
    return {
      totalExpired: documentsData.summary.totalExpired || 0,
      totalExpiring: documentsData.summary.totalExpiring || 0,
      expiredIqama: documentsData.summary.expiredIqamaCount || 0,
      expiredHealthCert: documentsData.summary.expiredHealthCertCount || 0,
      expiredContract: documentsData.summary.expiredContractCount || 0,
      expiringIqama: documentsData.summary.expiringIqamaCount || 0,
      expiringHealthCert: documentsData.summary.expiringHealthCertCount || 0,
      expiringContract: documentsData.summary.expiringContractCount || 0,
    };
  }, [documentsData]);
  
  // فلترة الموظفين
  const filteredEmployees = useMemo(() => {
    let result = allEmployees;
    
    // فلتر الفرع
    if (selectedBranch !== 'all') {
      result = result.filter(e => e.branchId === parseInt(selectedBranch));
    }
    
    // فلتر البحث
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.name.toLowerCase().includes(term) ||
        e.code.toLowerCase().includes(term) ||
        (e.iqamaNumber && e.iqamaNumber.toLowerCase().includes(term))
      );
    }
    
    // فلتر التبويب
    if (activeTab === 'expired') {
      result = result.filter(e => {
        const iqamaDays = getDaysRemaining(e.iqamaExpiryDate);
        const healthDays = getDaysRemaining(e.healthCertExpiryDate);
        const contractDays = getDaysRemaining(e.contractExpiryDate);
        return (iqamaDays !== null && iqamaDays < 0) ||
               (healthDays !== null && healthDays < 0) ||
               (contractDays !== null && contractDays < 0);
      });
    } else if (activeTab === 'expiring') {
      result = result.filter(e => {
        const iqamaDays = getDaysRemaining(e.iqamaExpiryDate);
        const healthDays = getDaysRemaining(e.healthCertExpiryDate);
        const contractDays = getDaysRemaining(e.contractExpiryDate);
        return (iqamaDays !== null && iqamaDays >= 0 && iqamaDays <= 30) ||
               (healthDays !== null && healthDays >= 0 && healthDays <= 30) ||
               (contractDays !== null && contractDays >= 0 && contractDays <= 30);
      });
    }
    
    return result;
  }, [allEmployees, selectedBranch, searchTerm, activeTab]);
  
  // تصدير PDF
  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.text('Documents Expiry Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, 14, 28);
    
    const tableData = filteredEmployees.map(emp => [
      emp.code,
      emp.name,
      emp.branchName,
      formatDate(emp.iqamaExpiryDate),
      getStatusText(getDaysRemaining(emp.iqamaExpiryDate)),
      formatDate(emp.healthCertExpiryDate),
      getStatusText(getDaysRemaining(emp.healthCertExpiryDate)),
      formatDate(emp.contractExpiryDate),
      getStatusText(getDaysRemaining(emp.contractExpiryDate)),
    ]);
    
    autoTable(doc, {
      head: [['Code', 'Name', 'Branch', 'Iqama Expiry', 'Iqama Status', 'Health Cert', 'Health Status', 'Contract', 'Contract Status']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    
    doc.save('documents-report.pdf');
    toast.success('تم تصدير التقرير بنجاح');
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white">لوحة تحكم الوثائق</h1>
          <p className="text-muted-foreground mt-1">متابعة وثائق جميع الموظفين والتنبيهات</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
          <Button onClick={exportPDF}>
            <Download className="w-4 h-4 ml-2" />
            تصدير PDF
          </Button>
        </div>
      </div>
      
      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-300">
              <XCircle className="w-5 h-5" />
              وثائق منتهية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700 dark:text-red-300">{stats.totalExpired}</div>
            <div className="text-sm text-red-600 dark:text-red-400 mt-1">
              إقامة: {stats.expiredIqama} | صحية: {stats.expiredHealthCert} | عقد: {stats.expiredContract}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="w-5 h-5" />
              قريبة من الانتهاء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">{stats.totalExpiring}</div>
            <div className="text-sm text-orange-600 dark:text-orange-400 mt-1">
              إقامة: {stats.expiringIqama} | صحية: {stats.expiringHealthCert} | عقد: {stats.expiringContract}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Users className="w-5 h-5" />
              إجمالي الموظفين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{allEmployees.length}</div>
            <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              موظف يحتاج متابعة
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
              <Shield className="w-5 h-5" />
              نسبة الامتثال
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {allEmployees.length > 0 ? Math.round(((allEmployees.length - stats.totalExpired) / allEmployees.length) * 100) : 100}%
            </div>
            <Progress 
              value={allEmployees.length > 0 ? ((allEmployees.length - stats.totalExpired) / allEmployees.length) * 100 : 100} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      </div>
      
      {/* الفلاتر */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] max-w-[400px]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الكود أو رقم الإقامة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>
        
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-[200px]">
            <Building className="w-4 h-4 ml-2" />
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
      </div>
      
      {/* التبويبات */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            الكل ({allEmployees.length})
          </TabsTrigger>
          <TabsTrigger value="expired" className="text-red-600">
            منتهية ({stats.totalExpired})
          </TabsTrigger>
          <TabsTrigger value="expiring" className="text-orange-600">
            قريبة من الانتهاء ({stats.totalExpiring})
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 ml-1" />
            التقويم
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-4">
          <EmployeesTable employees={filteredEmployees} onViewEmployee={setSelectedEmployee} />
        </TabsContent>
        
        <TabsContent value="expired" className="mt-4">
          <EmployeesTable employees={filteredEmployees} onViewEmployee={setSelectedEmployee} />
        </TabsContent>
        
        <TabsContent value="expiring" className="mt-4">
          <EmployeesTable employees={filteredEmployees} onViewEmployee={setSelectedEmployee} />
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                تقويم انتهاء الوثائق
              </CardTitle>
              <CardDescription>عرض مرئي لتواريخ انتهاء الوثائق</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentCalendar employees={allEmployees} selectedBranch={selectedBranch} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* نافذة تفاصيل الموظف */}
      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              تفاصيل وثائق الموظف
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              {/* معلومات الموظف */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedEmployee.name}</h3>
                  <p className="text-muted-foreground">{selectedEmployee.code} | {selectedEmployee.branchName}</p>
                  {selectedEmployee.position && (
                    <p className="text-sm text-muted-foreground">{selectedEmployee.position}</p>
                  )}
                </div>
              </div>
              
              {/* الوثائق */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* الإقامة */}
                <Card className={getStatusColor(getDaysRemaining(selectedEmployee.iqamaExpiryDate))}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <IdCard className="w-4 h-4" />
                      الإقامة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{selectedEmployee.iqamaNumber || '-'}</div>
                    <div className="text-sm mt-1">
                      <div>تاريخ الانتهاء: {formatDate(selectedEmployee.iqamaExpiryDate)}</div>
                      <div className="font-bold mt-1">{getStatusText(getDaysRemaining(selectedEmployee.iqamaExpiryDate))}</div>
                    </div>
                    {selectedEmployee.iqamaImageUrl && (
                      <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                        <a href={selectedEmployee.iqamaImageUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4 ml-1" />
                          عرض الصورة
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
                
                {/* الشهادة الصحية */}
                <Card className={getStatusColor(getDaysRemaining(selectedEmployee.healthCertExpiryDate))}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      الشهادة الصحية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm mt-1">
                      <div>تاريخ الانتهاء: {formatDate(selectedEmployee.healthCertExpiryDate)}</div>
                      <div className="font-bold mt-1">{getStatusText(getDaysRemaining(selectedEmployee.healthCertExpiryDate))}</div>
                    </div>
                    {selectedEmployee.healthCertImageUrl && (
                      <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                        <a href={selectedEmployee.healthCertImageUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4 ml-1" />
                          عرض الصورة
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
                
                {/* العقد */}
                <Card className={getStatusColor(getDaysRemaining(selectedEmployee.contractExpiryDate))}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileSignature className="w-4 h-4" />
                      عقد العمل
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm mt-1">
                      <div>تاريخ الانتهاء: {formatDate(selectedEmployee.contractExpiryDate)}</div>
                      <div className="font-bold mt-1">{getStatusText(getDaysRemaining(selectedEmployee.contractExpiryDate))}</div>
                    </div>
                    {selectedEmployee.contractImageUrl && (
                      <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                        <a href={selectedEmployee.contractImageUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4 ml-1" />
                          عرض الصورة
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// مكون جدول الموظفين
function EmployeesTable({ 
  employees, 
  onViewEmployee 
}: { 
  employees: EmployeeDocument[]; 
  onViewEmployee: (emp: EmployeeDocument) => void;
}) {
  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-bold">لا توجد وثائق تحتاج متابعة</h3>
          <p className="text-muted-foreground">جميع الوثائق سارية المفعول</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الموظف</TableHead>
              <TableHead className="text-right">الفرع</TableHead>
              <TableHead className="text-center">الإقامة</TableHead>
              <TableHead className="text-center">الشهادة الصحية</TableHead>
              <TableHead className="text-center">العقد</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => {
              const iqamaDays = getDaysRemaining(emp.iqamaExpiryDate);
              const healthDays = getDaysRemaining(emp.healthCertExpiryDate);
              const contractDays = getDaysRemaining(emp.contractExpiryDate);
              
              return (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold">{emp.name}</div>
                        <div className="text-sm text-muted-foreground">{emp.code}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{emp.branchName}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={getStatusColor(iqamaDays)}>
                      {getStatusText(iqamaDays)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={getStatusColor(healthDays)}>
                      {getStatusText(healthDays)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={getStatusColor(contractDays)}>
                      {getStatusText(contractDays)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" onClick={() => onViewEmployee(emp)}>
                      <Eye className="w-4 h-4 ml-1" />
                      تفاصيل
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
