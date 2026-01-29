import { useState, useMemo } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';
import { 
  AlertTriangle, 
  Clock, 
  FileText, 
  Upload, 
  Download, 
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
  TrendingUp,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeDocument {
  id: number;
  code: string;
  name: string;
  branchId: number;
  branchName: string;
  phone: string | null;
  position: string | null;
  iqamaNumber: string | null;
  iqamaExpiryDate: Date | null;
  iqamaImageUrl: string | null;
  healthCertExpiryDate: Date | null;
  healthCertImageUrl: string | null;
  contractExpiryDate: Date | null;
  contractImageUrl: string | null;
  isActive: boolean;
}

// مكون التقويم المرئي
function DocumentCalendar({ documentsData, selectedBranch }: { 
  documentsData: any; 
  selectedBranch: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // جمع جميع الوثائق مع تواريخها
  const allDocuments = useMemo(() => {
    if (!documentsData) return [];
    
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
    
    // الإقامات
    [...(documentsData.expired?.iqama || []), ...(documentsData.expiring?.iqama || [])].forEach(emp => {
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
    });
    
    // الشهادات الصحية
    [...(documentsData.expired?.healthCert || []), ...(documentsData.expiring?.healthCert || [])].forEach(emp => {
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
    });
    
    // العقود
    [...(documentsData.expired?.contract || []), ...(documentsData.expiring?.contract || [])].forEach(emp => {
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
    
    // فلتر حسب الفرع
    if (selectedBranch !== 'all') {
      const branchId = parseInt(selectedBranch);
      return docs.filter(d => d.branchId === branchId);
    }
    
    return docs;
  }, [documentsData, selectedBranch]);
  
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
      
      {/* ملخص الشهر */}
      {allDocuments.length > 0 && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-bold mb-2 text-black dark:text-white">ملخص الشهر</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">إقامات:</span>
              <span className="font-bold mr-2 text-blue-600">
                {allDocuments.filter(d => d.documentType === 'iqama' && 
                  new Date(d.expiryDate).getMonth() === currentMonth.getMonth() &&
                  new Date(d.expiryDate).getFullYear() === currentMonth.getFullYear()
                ).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">شهادات صحية:</span>
              <span className="font-bold mr-2 text-green-600">
                {allDocuments.filter(d => d.documentType === 'healthCert' && 
                  new Date(d.expiryDate).getMonth() === currentMonth.getMonth() &&
                  new Date(d.expiryDate).getFullYear() === currentMonth.getFullYear()
                ).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">عقود:</span>
              <span className="font-bold mr-2 text-purple-600">
                {allDocuments.filter(d => d.documentType === 'contract' && 
                  new Date(d.expiryDate).getMonth() === currentMonth.getMonth() &&
                  new Date(d.expiryDate).getFullYear() === currentMonth.getFullYear()
                ).length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentsDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDocument | null>(null);
  const [uploadType, setUploadType] = useState<'iqama' | 'healthCert' | 'contract'>('iqama');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  
  const { data: documentsData, isLoading, refetch } = trpc.employees.getExpiringDocuments.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const uploadMutation = trpc.employees.uploadDocumentImage.useMutation({
    onSuccess: () => {
      toast.success('تم رفع الصورة بنجاح');
      refetch();
      setIsUploadDialogOpen(false);
    },
    onError: (error) => {
      toast.error('فشل رفع الصورة: ' + error.message);
    },
  });
  
  // حساب الإحصائيات المتقدمة
  const advancedStats = useMemo(() => {
    if (!documentsData) return null;
    
    const totalEmployees = new Set([
      ...documentsData.expired.iqama.map(e => e.id),
      ...documentsData.expired.healthCert.map(e => e.id),
      ...documentsData.expired.contract.map(e => e.id),
      ...documentsData.expiring.iqama.map(e => e.id),
      ...documentsData.expiring.healthCert.map(e => e.id),
      ...documentsData.expiring.contract.map(e => e.id),
    ]).size;
    
    const criticalCount = documentsData.summary.totalExpired;
    const warningCount = documentsData.summary.totalExpiring;
    
    // حساب نسبة الامتثال (افتراضي 100 موظف)
    const assumedTotalEmployees = Math.max(totalEmployees * 2, 20);
    const complianceRate = Math.max(0, Math.round(((assumedTotalEmployees - totalEmployees) / assumedTotalEmployees) * 100));
    
    return {
      totalAffectedEmployees: totalEmployees,
      criticalCount,
      warningCount,
      complianceRate,
      iqamaIssues: documentsData.summary.expiredIqamaCount + documentsData.summary.expiringIqamaCount,
      healthCertIssues: documentsData.summary.expiredHealthCertCount + documentsData.summary.expiringHealthCertCount,
      contractIssues: documentsData.summary.expiredContractCount + documentsData.summary.expiringContractCount,
    };
  }, [documentsData]);
  
  const formatDate = (date: Date | null) => {
    if (!date) return 'غير محدد';
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const formatDateShort = (date: Date | null) => {
    if (!date) return 'غير محدد';
    return new Date(date).toLocaleDateString('ar-SA');
  };
  
  const getDaysRemaining = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(date);
    expiry.setHours(0, 0, 0, 0);
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };
  
  const getStatusBadge = (date: Date | null) => {
    const days = getDaysRemaining(date);
    if (days === null) return <Badge variant="outline" className="text-slate-500">غير محدد</Badge>;
    if (days < 0) return <Badge variant="destructive" className="bg-red-600 text-white font-bold">منتهية منذ {Math.abs(days)} يوم</Badge>;
    if (days === 0) return <Badge variant="destructive" className="bg-red-600 text-white font-bold animate-pulse">تنتهي اليوم!</Badge>;
    if (days <= 7) return <Badge variant="destructive" className="bg-red-500 text-white font-semibold">{days} أيام متبقية</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500 text-white font-semibold">{days} يوم متبقي</Badge>;
    if (days <= 60) return <Badge className="bg-yellow-500 text-black font-semibold">{days} يوم متبقي</Badge>;
    return <Badge variant="secondary" className="bg-green-100 text-green-700 font-semibold">سارية</Badge>;
  };
  
  const getUrgencyLevel = (date: Date | null): 'critical' | 'high' | 'medium' | 'low' | 'none' => {
    const days = getDaysRemaining(date);
    if (days === null) return 'none';
    if (days < 0) return 'critical';
    if (days <= 7) return 'high';
    if (days <= 30) return 'medium';
    if (days <= 60) return 'low';
    return 'none';
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployee) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await uploadMutation.mutateAsync({
        employeeId: selectedEmployee.id,
        documentType: uploadType,
        base64Data: base64,
        fileName: file.name,
        contentType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };
  
  // تصدير تقرير الوثائق عبر API
  const exportDocumentsReport = trpc.cashFlow.exportDocumentsReport.useMutation({
    onSuccess: (data) => {
      const printWindow = window.open(data.url, '_blank', 'width=1000,height=700');
      if (printWindow) {
        printWindow.focus();
        toast.success('تم فتح التقرير للطباعة - اضغط Ctrl+P للطباعة');
      } else {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      toast.error('فشل في تصدير التقرير: ' + error.message);
    },
  });
  
  const generatePDFReport = () => {
    if (!documentsData) return;
    
    const branchId = selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined;
    exportDocumentsReport.mutate({ branchId });
  };
  
  const filterEmployees = (employees: EmployeeDocument[]) => {
    let filtered = employees;
    
    // فلتر الفرع
    if (selectedBranch !== 'all') {
      const branchId = parseInt(selectedBranch);
      filtered = filtered.filter(emp => emp.branchId === branchId);
    }
    
    // فلتر البحث
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().includes(term) ||
        emp.code.toLowerCase().includes(term) ||
        emp.branchName.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };
  
  const renderEmployeeTable = (employees: EmployeeDocument[], documentType: 'iqama' | 'healthCert' | 'contract') => {
    const filtered = filterEmployees(employees);
    
    if (filtered.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-lg font-medium">لا توجد وثائق تحتاج إلى متابعة</p>
          <p className="text-sm mt-1">جميع الوثائق سارية المفعول</p>
        </div>
      );
    }
    
    const getExpiryDate = (emp: EmployeeDocument) => {
      switch (documentType) {
        case 'iqama': return emp.iqamaExpiryDate;
        case 'healthCert': return emp.healthCertExpiryDate;
        case 'contract': return emp.contractExpiryDate;
      }
    };
    
    const getImageUrl = (emp: EmployeeDocument) => {
      switch (documentType) {
        case 'iqama': return emp.iqamaImageUrl;
        case 'healthCert': return emp.healthCertImageUrl;
        case 'contract': return emp.contractImageUrl;
      }
    };
    
    // ترتيب حسب الأولوية (الأكثر إلحاحاً أولاً)
    const sortedEmployees = [...filtered].sort((a, b) => {
      const daysA = getDaysRemaining(getExpiryDate(a)) ?? 999;
      const daysB = getDaysRemaining(getExpiryDate(b)) ?? 999;
      return daysA - daysB;
    });
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="font-bold text-black dark:text-white">الموظف</TableHead>
              <TableHead className="font-bold text-black dark:text-white">الفرع</TableHead>
              <TableHead className="font-bold text-black dark:text-white">تاريخ الانتهاء</TableHead>
              <TableHead className="font-bold text-black dark:text-white">الحالة</TableHead>
              <TableHead className="font-bold text-black dark:text-white">الصورة</TableHead>
              <TableHead className="font-bold text-black dark:text-white">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.map((emp) => {
              const urgency = getUrgencyLevel(getExpiryDate(emp));
              const rowClass = urgency === 'critical' ? 'bg-red-50 dark:bg-red-950/30' : 
                              urgency === 'high' ? 'bg-orange-50 dark:bg-orange-950/30' : '';
              
              return (
                <TableRow key={emp.id} className={rowClass}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        urgency === 'critical' ? 'bg-red-100 text-red-600' :
                        urgency === 'high' ? 'bg-orange-100 text-orange-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-black dark:text-white">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.code}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-black dark:text-white">{emp.branchName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-black dark:text-white">{formatDate(getExpiryDate(emp))}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(getExpiryDate(emp))}</TableCell>
                  <TableCell>
                    {getImageUrl(emp) ? (
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800" asChild>
                        <a href={getImageUrl(emp)!} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4 ml-1" />
                          عرض
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        لا توجد صورة
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary hover:text-white"
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setUploadType(documentType);
                        setIsUploadDialogOpen(true);
                      }}
                    >
                      <Upload className="w-4 h-4 ml-1" />
                      رفع صورة
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري تحميل بيانات الوثائق...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-xl">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <Shield className="w-8 h-8 text-amber-400" />
            لوحة تحكم الوثائق
          </h1>
          <p className="text-slate-300 mt-2">متابعة حالة وثائق الموظفين والتنبيهات - تحديث فوري</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()} className="bg-transparent border-white/30 text-white hover:bg-white/10">
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
          <Button onClick={generatePDFReport} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
            <Download className="w-4 h-4 ml-2" />
            تصدير PDF
          </Button>
        </div>
      </div>
      
      {/* Summary Cards - تصميم محسن */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/40 dark:to-red-900/20 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <div className="p-2 bg-red-200 dark:bg-red-800 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              وثائق منتهية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl lg:text-5xl font-black text-red-600 dark:text-red-400">
              {documentsData?.summary.totalExpired || 0}
            </div>
            <p className="text-sm text-red-600/70 mt-1">تتطلب إجراء فوري</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950/40 dark:to-amber-900/20 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <div className="p-2 bg-orange-200 dark:bg-orange-800 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              قريبة الانتهاء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl lg:text-5xl font-black text-orange-600 dark:text-orange-400">
              {documentsData?.summary.totalExpiring || 0}
            </div>
            <p className="text-sm text-orange-600/70 mt-1">خلال 30-60 يوم</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/20 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
                <IdCard className="w-5 h-5" />
              </div>
              إقامات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-red-600">{documentsData?.summary.expiredIqamaCount || 0}</span>
                <span className="text-sm text-red-600">منتهية</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-orange-600">{documentsData?.summary.expiringIqamaCount || 0}</span>
                <span className="text-sm text-orange-600">قريبة</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/20 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <FileSignature className="w-5 h-5" />
              </div>
              عقود
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-red-600">{documentsData?.summary.expiredContractCount || 0}</span>
                <span className="text-sm text-red-600">منتهية</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-orange-600">{documentsData?.summary.expiringContractCount || 0}</span>
                <span className="text-sm text-orange-600">قريبة</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* إحصائيات إضافية */}
      {advancedStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-slate-50 dark:bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                الموظفون المتأثرون
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-black dark:text-white">{advancedStats.totalAffectedEmployees}</div>
              <p className="text-xs text-muted-foreground">موظف يحتاج متابعة</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-50 dark:bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                الشهادات الصحية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-2xl font-bold text-red-600">{documentsData?.summary.expiredHealthCertCount || 0}</span>
                  <span className="text-sm text-muted-foreground mr-1">منتهية</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-orange-600">{documentsData?.summary.expiringHealthCertCount || 0}</span>
                  <span className="text-sm text-muted-foreground mr-1">قريبة</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-50 dark:bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                نسبة الامتثال التقديرية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">{advancedStats.complianceRate}%</div>
                <Progress value={advancedStats.complianceRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Search & Branch Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الكود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-12 h-12 text-lg border-2"
          />
        </div>
        
        <div className="w-full sm:w-64">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="h-12 text-lg border-2">
              <Building className="w-5 h-5 ml-2 text-muted-foreground" />
              <SelectValue placeholder="جميع الفروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-medium">جميع الفروع</span>
              </SelectItem>
              {branches?.map((branch) => (
                <SelectItem key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="expired" className="space-y-4">
        <TabsList className="h-12 p-1 bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="expired" className="gap-2 h-10 px-6 data-[state=active]:bg-red-500 data-[state=active]:text-white">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold">منتهية ({documentsData?.summary.totalExpired || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="expiring" className="gap-2 h-10 px-6 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <Clock className="w-5 h-5" />
            <span className="font-bold">قريبة الانتهاء ({documentsData?.summary.totalExpiring || 0})</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expired" className="space-y-4">
          <Tabs defaultValue="iqama">
            <TabsList className="bg-red-50 dark:bg-red-950/30">
              <TabsTrigger value="iqama" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <IdCard className="w-4 h-4 ml-1" />
                الإقامة ({documentsData?.expired.iqama.length || 0})
              </TabsTrigger>
              <TabsTrigger value="healthCert" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <Heart className="w-4 h-4 ml-1" />
                الشهادة الصحية ({documentsData?.expired.healthCert.length || 0})
              </TabsTrigger>
              <TabsTrigger value="contract" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <FileSignature className="w-4 h-4 ml-1" />
                عقد العمل ({documentsData?.expired.contract.length || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="iqama">
              <Card className="border-red-200">
                <CardHeader className="bg-red-50 dark:bg-red-950/30 rounded-t-lg">
                  <CardTitle className="text-red-700 dark:text-red-400">إقامات منتهية</CardTitle>
                  <CardDescription>الموظفون الذين انتهت صلاحية إقامتهم - يتطلب إجراء فوري</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {renderEmployeeTable(documentsData?.expired.iqama || [], 'iqama')}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="healthCert">
              <Card className="border-red-200">
                <CardHeader className="bg-red-50 dark:bg-red-950/30 rounded-t-lg">
                  <CardTitle className="text-red-700 dark:text-red-400">شهادات صحية منتهية</CardTitle>
                  <CardDescription>الموظفون الذين انتهت صلاحية شهادتهم الصحية</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {renderEmployeeTable(documentsData?.expired.healthCert || [], 'healthCert')}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="contract">
              <Card className="border-red-200">
                <CardHeader className="bg-red-50 dark:bg-red-950/30 rounded-t-lg">
                  <CardTitle className="text-red-700 dark:text-red-400">عقود عمل منتهية</CardTitle>
                  <CardDescription>الموظفون الذين انتهت عقود عملهم</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {renderEmployeeTable(documentsData?.expired.contract || [], 'contract')}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
        
        <TabsContent value="expiring" className="space-y-4">
          <Tabs defaultValue="iqama">
            <TabsList className="bg-orange-50 dark:bg-orange-950/30">
              <TabsTrigger value="iqama" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                <IdCard className="w-4 h-4 ml-1" />
                الإقامة ({documentsData?.expiring.iqama.length || 0})
              </TabsTrigger>
              <TabsTrigger value="healthCert" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                <Heart className="w-4 h-4 ml-1" />
                الشهادة الصحية ({documentsData?.expiring.healthCert.length || 0})
              </TabsTrigger>
              <TabsTrigger value="contract" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                <FileSignature className="w-4 h-4 ml-1" />
                عقد العمل ({documentsData?.expiring.contract.length || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="iqama">
              <Card className="border-orange-200">
                <CardHeader className="bg-orange-50 dark:bg-orange-950/30 rounded-t-lg">
                  <CardTitle className="text-orange-700 dark:text-orange-400">إقامات قريبة الانتهاء</CardTitle>
                  <CardDescription>الموظفون الذين ستنتهي إقامتهم خلال 30 يوم</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {renderEmployeeTable(documentsData?.expiring.iqama || [], 'iqama')}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="healthCert">
              <Card className="border-orange-200">
                <CardHeader className="bg-orange-50 dark:bg-orange-950/30 rounded-t-lg">
                  <CardTitle className="text-orange-700 dark:text-orange-400">شهادات صحية قريبة الانتهاء</CardTitle>
                  <CardDescription>الموظفون الذين ستنتهي شهادتهم الصحية خلال أسبوع</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {renderEmployeeTable(documentsData?.expiring.healthCert || [], 'healthCert')}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="contract">
              <Card className="border-orange-200">
                <CardHeader className="bg-orange-50 dark:bg-orange-950/30 rounded-t-lg">
                  <CardTitle className="text-orange-700 dark:text-orange-400">عقود عمل قريبة الانتهاء</CardTitle>
                  <CardDescription>الموظفون الذين ستنتهي عقودهم خلال شهرين</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {renderEmployeeTable(documentsData?.expiring.contract || [], 'contract')}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      
      {/* Calendar View */}
      <Card className="border-2 border-slate-200 dark:border-slate-700">
        <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <CardTitle className="flex items-center gap-3 text-xl">
            <CalendarDays className="w-6 h-6 text-primary" />
            تقويم تواريخ انتهاء الوثائق
          </CardTitle>
          <CardDescription>عرض مرئي لتواريخ انتهاء الوثائق خلال الأشهر القادمة</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <DocumentCalendar documentsData={documentsData} selectedBranch={selectedBranch} />
        </CardContent>
      </Card>
      
      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              رفع صورة الوثيقة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Label className="text-muted-foreground">الموظف</Label>
              <p className="text-lg font-bold text-black dark:text-white">{selectedEmployee?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedEmployee?.code}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Label className="text-muted-foreground">نوع الوثيقة</Label>
              <p className="text-lg font-bold text-black dark:text-white">
                {uploadType === 'iqama' ? 'الإقامة' : uploadType === 'healthCert' ? 'الشهادة الصحية' : 'عقد العمل'}
              </p>
            </div>
            <div>
              <Label htmlFor="file" className="text-base font-medium">اختر الصورة</Label>
              <Input
                id="file"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadMutation.isPending}
                className="mt-2 h-12"
              />
            </div>
            {uploadMutation.isPending && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-blue-700 dark:text-blue-400 font-medium">جاري الرفع...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
