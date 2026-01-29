import { useState, useMemo } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
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
  Loader2,
  Upload,
  Image,
  ArrowUpDown,
  Filter,
  List,
  Grid3X3,
  CheckCircle,
  AlertCircle
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
  if (days === null) return 'bg-gray-500/20 text-gray-400';
  if (days < 0) return 'bg-red-500/20 text-red-400';
  if (days <= 7) return 'bg-red-500/20 text-red-400';
  if (days <= 30) return 'bg-orange-500/20 text-orange-400';
  if (days <= 60) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-green-500/20 text-green-400';
}

// الحصول على نص الحالة
function getStatusText(days: number | null): string {
  if (days === null) return 'غير محدد';
  if (days < 0) return `منتهية منذ ${Math.abs(days)} يوم`;
  if (days === 0) return 'تنتهي اليوم!';
  if (days === 1) return 'تنتهي غداً!';
  return `${days} يوم متبقي`;
}

// حالة الوثيقة
function getDocumentStatus(days: number | null): 'expired' | 'expiring' | 'valid' | 'missing' {
  if (days === null) return 'missing';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

// مكون بطاقة الموظف للعرض الشبكي
function EmployeeCard({ employee, onView }: { employee: EmployeeDocument; onView: () => void }) {
  const iqamaDays = getDaysRemaining(employee.iqamaExpiryDate);
  const healthDays = getDaysRemaining(employee.healthCertExpiryDate);
  const contractDays = getDaysRemaining(employee.contractExpiryDate);
  
  const iqamaStatus = getDocumentStatus(iqamaDays);
  const healthStatus = getDocumentStatus(healthDays);
  const contractStatus = getDocumentStatus(contractDays);
  
  const hasExpired = iqamaStatus === 'expired' || healthStatus === 'expired' || contractStatus === 'expired';
  const hasExpiring = iqamaStatus === 'expiring' || healthStatus === 'expiring' || contractStatus === 'expiring';
  
  return (
    <Card className={`cursor-pointer hover:shadow-lg transition-all ${
      hasExpired ? 'border-red-500/50 bg-red-950/20' :
      hasExpiring ? 'border-orange-500/50 bg-orange-950/20' :
      'border-green-500/30 bg-green-950/10'
    }`} onClick={onView}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white">{employee.name}</h3>
              <p className="text-sm text-slate-400">{employee.code}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {employee.branchName}
          </Badge>
        </div>
        
        <div className="space-y-2">
          {/* الإقامة */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <IdCard className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">الإقامة</span>
            </div>
            <Badge className={getStatusColor(iqamaDays)}>
              {getStatusText(iqamaDays)}
            </Badge>
          </div>
          
          {/* الشهادة الصحية */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="text-slate-300">الشهادة الصحية</span>
            </div>
            <Badge className={getStatusColor(healthDays)}>
              {getStatusText(healthDays)}
            </Badge>
          </div>
          
          {/* العقد */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300">العقد</span>
            </div>
            <Badge className={getStatusColor(contractDays)}>
              {getStatusText(contractDays)}
            </Badge>
          </div>
        </div>
        
        <Button variant="outline" size="sm" className="w-full mt-3" onClick={(e) => { e.stopPropagation(); onView(); }}>
          <Eye className="w-4 h-4 ml-2" />
          عرض التفاصيل
        </Button>
      </CardContent>
    </Card>
  );
}

// مكون جدول الموظفين
function EmployeesTable({ 
  employees, 
  onViewEmployee,
  sortField,
  sortDirection,
  onSort
}: { 
  employees: EmployeeDocument[]; 
  onViewEmployee: (emp: EmployeeDocument) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-slate-800 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : 'text-slate-500'}`} />
      </div>
    </TableHead>
  );
  
  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-800/50 hover:bg-slate-800/50">
            <SortHeader field="code">الكود</SortHeader>
            <SortHeader field="name">الاسم</SortHeader>
            <SortHeader field="branch">الفرع</SortHeader>
            <SortHeader field="iqama">الإقامة</SortHeader>
            <SortHeader field="health">الشهادة الصحية</SortHeader>
            <SortHeader field="contract">العقد</SortHeader>
            <TableHead className="text-center">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                لا يوجد موظفين مطابقين للبحث
              </TableCell>
            </TableRow>
          ) : (
            employees.map((emp) => {
              const iqamaDays = getDaysRemaining(emp.iqamaExpiryDate);
              const healthDays = getDaysRemaining(emp.healthCertExpiryDate);
              const contractDays = getDaysRemaining(emp.contractExpiryDate);
              
              return (
                <TableRow key={emp.id} className="hover:bg-slate-800/30">
                  <TableCell className="font-mono text-sm">{emp.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <span className="font-medium">{emp.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {emp.branchName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={`${getStatusColor(iqamaDays)} text-xs`}>
                        {getStatusText(iqamaDays)}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(emp.iqamaExpiryDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={`${getStatusColor(healthDays)} text-xs`}>
                        {getStatusText(healthDays)}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(emp.healthCertExpiryDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={`${getStatusColor(contractDays)} text-xs`}>
                        {getStatusText(contractDays)}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(emp.contractExpiryDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => onViewEmployee(emp)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// مكون نافذة تفاصيل الموظف مع رفع الصور
function EmployeeDocumentsModal({ 
  employee, 
  onClose,
  onRefresh
}: { 
  employee: EmployeeDocument | null; 
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const uploadMutation = trpc.employees.uploadDocumentImage.useMutation({
    onSuccess: () => {
      toast.success('تم رفع الصورة بنجاح');
      onRefresh();
      setUploadingDoc(null);
    },
    onError: (error) => {
      toast.error(error.message || 'فشل رفع الصورة');
      setUploadingDoc(null);
    }
  });
  
  if (!employee) return null;
  
  const handleFileUpload = async (docType: 'iqama' | 'healthCert' | 'contract', file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الملف يجب أن يكون أقل من 5 ميجابايت');
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('نوع الملف غير مدعوم. يرجى رفع صورة (JPG, PNG, WebP) أو PDF');
      return;
    }
    
    setUploadingDoc(docType);
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await uploadMutation.mutateAsync({
        employeeId: employee.id,
        documentType: docType,
        base64Data: base64,
        fileName: file.name,
        contentType: file.type
      });
    };
    reader.readAsDataURL(file);
  };
  
  const DocumentSection = ({ 
    title, 
    icon: Icon, 
    iconColor,
    expiryDate, 
    imageUrl, 
    docType 
  }: { 
    title: string; 
    icon: any; 
    iconColor: string;
    expiryDate: Date | null; 
    imageUrl: string | null; 
    docType: 'iqama' | 'healthCert' | 'contract';
  }) => {
    const days = getDaysRemaining(expiryDate);
    const status = getDocumentStatus(days);
    
    return (
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            <span className="font-medium">{title}</span>
          </div>
          <Badge className={getStatusColor(days)}>
            {status === 'expired' ? 'منتهية' : 
             status === 'expiring' ? 'قريبة من الانتهاء' : 
             status === 'valid' ? 'سارية' : 'غير محددة'}
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">تاريخ الانتهاء:</span>
            <span>{formatDate(expiryDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">الأيام المتبقية:</span>
            <span className={days !== null && days < 0 ? 'text-red-400' : days !== null && days <= 30 ? 'text-orange-400' : 'text-green-400'}>
              {getStatusText(days)}
            </span>
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-2">
          {imageUrl ? (
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                <Image className="w-4 h-4 ml-2" />
                عرض الصورة
              </a>
            </Button>
          ) : (
            <span className="text-xs text-slate-500 flex-1">لا توجد صورة</span>
          )}
          
          <label className="flex-1">
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(docType, file);
              }}
              disabled={uploadingDoc === docType}
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              disabled={uploadingDoc === docType}
              asChild
            >
              <span>
                {uploadingDoc === docType ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 ml-2" />
                )}
                {imageUrl ? 'تحديث' : 'رفع'}
              </span>
            </Button>
          </label>
        </div>
      </div>
    );
  };
  
  return (
    <Dialog open={!!employee} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div>
              <div className="text-lg">{employee.name}</div>
              <div className="text-sm text-slate-400 font-normal">{employee.code} - {employee.branchName}</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 mt-4">
          <DocumentSection
            title="الإقامة"
            icon={IdCard}
            iconColor="text-blue-400"
            expiryDate={employee.iqamaExpiryDate}
            imageUrl={employee.iqamaImageUrl}
            docType="iqama"
          />
          
          <DocumentSection
            title="الشهادة الصحية"
            icon={Heart}
            iconColor="text-pink-400"
            expiryDate={employee.healthCertExpiryDate}
            imageUrl={employee.healthCertImageUrl}
            docType="healthCert"
          />
          
          <DocumentSection
            title="عقد العمل"
            icon={FileSignature}
            iconColor="text-purple-400"
            expiryDate={employee.contractExpiryDate}
            imageUrl={employee.contractImageUrl}
            docType="contract"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// الصفحة الرئيسية
export default function DocumentsDashboard() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDocument | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // التحقق من الصلاحيات
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isViewer = user?.role === 'viewer';
  const userBranchId = user?.branchId;
  
  // جلب جميع الموظفين مع وثائقهم
  const { data: allEmployeesData, isLoading, refetch } = trpc.employees.getDocumentsDashboard.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  
  // تحويل البيانات إلى قائمة موظفين موحدة
  const allEmployees = useMemo(() => {
    if (!allEmployeesData) return [];
    
    // تحويل البيانات
    let employees = allEmployeesData.map((emp: any) => ({
      id: emp.id,
      code: emp.code,
      name: emp.name,
      branchId: emp.branchId,
      branchName: emp.branchName || 'غير محدد',
      phone: emp.phone,
      position: emp.position,
      photoUrl: emp.photoUrl,
      iqamaNumber: emp.documents?.find((d: any) => d.type === 'iqama')?.number || null,
      iqamaExpiryDate: emp.documents?.find((d: any) => d.type === 'iqama')?.expiryDate || null,
      iqamaImageUrl: emp.documents?.find((d: any) => d.type === 'iqama')?.imageUrl || null,
      healthCertExpiryDate: emp.documents?.find((d: any) => d.type === 'healthCert')?.expiryDate || null,
      healthCertImageUrl: emp.documents?.find((d: any) => d.type === 'healthCert')?.imageUrl || null,
      contractExpiryDate: emp.documents?.find((d: any) => d.type === 'contract')?.expiryDate || null,
      contractImageUrl: emp.documents?.find((d: any) => d.type === 'contract')?.imageUrl || null,
      isActive: emp.isActive ?? true,
    }));
    
    // المشرف يرى فقط موظفي فرعه
    if (isSupervisor && userBranchId) {
      employees = employees.filter(emp => emp.branchId === userBranchId);
    }
    
    return employees;
  }, [allEmployeesData, isSupervisor, userBranchId]);
  
  // حساب الإحصائيات
  const stats = useMemo(() => {
    if (!allEmployees.length) {
      return {
        totalEmployees: 0,
        totalExpired: 0,
        totalExpiring: 0,
        totalValid: 0,
        employeesWithExpired: 0,
        employeesWithExpiring: 0,
        employeesAllValid: 0,
        complianceRate: 0,
      };
    }
    
    let totalExpired = 0, totalExpiring = 0, totalValid = 0;
    let employeesWithExpired = 0, employeesWithExpiring = 0, employeesAllValid = 0;
    
    allEmployees.forEach(emp => {
      const iqamaDays = getDaysRemaining(emp.iqamaExpiryDate);
      const healthDays = getDaysRemaining(emp.healthCertExpiryDate);
      const contractDays = getDaysRemaining(emp.contractExpiryDate);
      
      const iqamaStatus = getDocumentStatus(iqamaDays);
      const healthStatus = getDocumentStatus(healthDays);
      const contractStatus = getDocumentStatus(contractDays);
      
      // إحصائيات الوثائق
      [iqamaStatus, healthStatus, contractStatus].forEach(status => {
        if (status === 'expired') totalExpired++;
        else if (status === 'expiring') totalExpiring++;
        else if (status === 'valid') totalValid++;
      });
      
      // إحصائيات الموظفين
      const hasExpired = iqamaStatus === 'expired' || healthStatus === 'expired' || contractStatus === 'expired';
      const hasExpiring = iqamaStatus === 'expiring' || healthStatus === 'expiring' || contractStatus === 'expiring';
      
      if (hasExpired) employeesWithExpired++;
      else if (hasExpiring) employeesWithExpiring++;
      else employeesAllValid++;
    });
    
    const totalDocs = allEmployees.length * 3;
    const complianceRate = totalDocs > 0 ? Math.round((totalValid / totalDocs) * 100) : 0;
    
    return {
      totalEmployees: allEmployees.length,
      totalExpired,
      totalExpiring,
      totalValid,
      employeesWithExpired,
      employeesWithExpiring,
      employeesAllValid,
      complianceRate,
    };
  }, [allEmployees]);
  
  // فلترة الموظفين
  const filteredEmployees = useMemo(() => {
    let result = [...allEmployees];
    
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
        const iqamaStatus = getDocumentStatus(getDaysRemaining(e.iqamaExpiryDate));
        const healthStatus = getDocumentStatus(getDaysRemaining(e.healthCertExpiryDate));
        const contractStatus = getDocumentStatus(getDaysRemaining(e.contractExpiryDate));
        return iqamaStatus === 'expired' || healthStatus === 'expired' || contractStatus === 'expired';
      });
    } else if (activeTab === 'expiring') {
      result = result.filter(e => {
        const iqamaStatus = getDocumentStatus(getDaysRemaining(e.iqamaExpiryDate));
        const healthStatus = getDocumentStatus(getDaysRemaining(e.healthCertExpiryDate));
        const contractStatus = getDocumentStatus(getDaysRemaining(e.contractExpiryDate));
        const hasExpired = iqamaStatus === 'expired' || healthStatus === 'expired' || contractStatus === 'expired';
        const hasExpiring = iqamaStatus === 'expiring' || healthStatus === 'expiring' || contractStatus === 'expiring';
        return !hasExpired && hasExpiring;
      });
    } else if (activeTab === 'valid') {
      result = result.filter(e => {
        const iqamaStatus = getDocumentStatus(getDaysRemaining(e.iqamaExpiryDate));
        const healthStatus = getDocumentStatus(getDaysRemaining(e.healthCertExpiryDate));
        const contractStatus = getDocumentStatus(getDaysRemaining(e.contractExpiryDate));
        const hasExpired = iqamaStatus === 'expired' || healthStatus === 'expired' || contractStatus === 'expired';
        const hasExpiring = iqamaStatus === 'expiring' || healthStatus === 'expiring' || contractStatus === 'expiring';
        return !hasExpired && !hasExpiring;
      });
    }
    
    // الترتيب
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ar');
          break;
        case 'branch':
          comparison = a.branchName.localeCompare(b.branchName, 'ar');
          break;
        case 'iqama':
          const iqamaA = getDaysRemaining(a.iqamaExpiryDate) ?? 9999;
          const iqamaB = getDaysRemaining(b.iqamaExpiryDate) ?? 9999;
          comparison = iqamaA - iqamaB;
          break;
        case 'health':
          const healthA = getDaysRemaining(a.healthCertExpiryDate) ?? 9999;
          const healthB = getDaysRemaining(b.healthCertExpiryDate) ?? 9999;
          comparison = healthA - healthB;
          break;
        case 'contract':
          const contractA = getDaysRemaining(a.contractExpiryDate) ?? 9999;
          const contractB = getDaysRemaining(b.contractExpiryDate) ?? 9999;
          comparison = contractA - contractB;
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [allEmployees, selectedBranch, searchTerm, activeTab, sortField, sortDirection]);
  
  // تبديل الترتيب
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
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
    <div className="space-y-4 p-4 md:p-6">
      {/* العنوان */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">لوحة الوثائق</h1>
          <p className="text-slate-400 mt-1">متابعة وثائق جميع الموظفين</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <Download className="w-4 h-4 ml-2" />
            تصدير
          </Button>
        </div>
      </div>
      
      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Users className="w-8 h-8 text-blue-400" />
              <div className="text-left">
                <div className="text-2xl font-bold text-white">{stats.totalEmployees}</div>
                <div className="text-xs text-slate-400">إجمالي الموظفين</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-950/30 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <XCircle className="w-8 h-8 text-red-400" />
              <div className="text-left">
                <div className="text-2xl font-bold text-red-400">{stats.employeesWithExpired}</div>
                <div className="text-xs text-slate-400">وثائق منتهية</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-950/30 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <AlertTriangle className="w-8 h-8 text-orange-400" />
              <div className="text-left">
                <div className="text-2xl font-bold text-orange-400">{stats.employeesWithExpiring}</div>
                <div className="text-xs text-slate-400">قريبة من الانتهاء</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-950/30 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div className="text-left">
                <div className="text-2xl font-bold text-green-400">{stats.complianceRate}%</div>
                <div className="text-xs text-slate-400">نسبة الامتثال</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* الفلاتر */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث بالاسم أو الكود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 bg-slate-800/50 border-slate-700"
            />
          </div>
        </div>
        
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-full md:w-[180px] bg-slate-800/50 border-slate-700">
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
        
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* التبويبات */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/50">
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">
            <Users className="w-4 h-4 ml-1 hidden md:inline" />
            الكل ({stats.totalEmployees})
          </TabsTrigger>
          <TabsTrigger value="expired" className="data-[state=active]:bg-red-900/50 text-red-400">
            <XCircle className="w-4 h-4 ml-1 hidden md:inline" />
            منتهية ({stats.employeesWithExpired})
          </TabsTrigger>
          <TabsTrigger value="expiring" className="data-[state=active]:bg-orange-900/50 text-orange-400">
            <AlertTriangle className="w-4 h-4 ml-1 hidden md:inline" />
            قريبة ({stats.employeesWithExpiring})
          </TabsTrigger>
          <TabsTrigger value="valid" className="data-[state=active]:bg-green-900/50 text-green-400">
            <CheckCircle className="w-4 h-4 ml-1 hidden md:inline" />
            سارية ({stats.employeesAllValid})
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-4">
          {filteredEmployees.length === 0 ? (
            <Card className="bg-slate-800/30 border-slate-700">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">لا يوجد موظفين</h3>
                <p className="text-slate-500">لا يوجد موظفين مطابقين لمعايير البحث</p>
              </CardContent>
            </Card>
          ) : viewMode === 'table' ? (
            <EmployeesTable 
              employees={filteredEmployees} 
              onViewEmployee={setSelectedEmployee}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEmployees.map(emp => (
                <EmployeeCard 
                  key={emp.id} 
                  employee={emp} 
                  onView={() => setSelectedEmployee(emp)} 
                />
              ))}
            </div>
          )}
        </div>
      </Tabs>
      
      {/* عدد النتائج */}
      <div className="text-sm text-slate-400 text-center">
        عرض {filteredEmployees.length} من {stats.totalEmployees} موظف
      </div>
      
      {/* نافذة تفاصيل الموظف */}
      <EmployeeDocumentsModal 
        employee={selectedEmployee} 
        onClose={() => setSelectedEmployee(null)} 
        onRefresh={refetch}
      />
    </div>
  );
}
