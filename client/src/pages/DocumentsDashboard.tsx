import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { 
  FileWarning, 
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
  Phone,
  IdCard,
  Heart,
  FileSignature
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
  iqamaNumber: string | null;
  iqamaExpiryDate: Date | null;
  iqamaImageUrl: string | null;
  healthCertExpiryDate: Date | null;
  healthCertImageUrl: string | null;
  contractExpiryDate: Date | null;
  contractImageUrl: string | null;
  isActive: boolean;
}

export default function DocumentsDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDocument | null>(null);
  const [uploadType, setUploadType] = useState<'iqama' | 'healthCert' | 'contract'>('iqama');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  
  const { data: documentsData, isLoading, refetch } = trpc.employees.getExpiringDocuments.useQuery();
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
  
  const formatDate = (date: Date | null) => {
    if (!date) return 'غير محدد';
    return new Date(date).toLocaleDateString('ar-SA');
  };
  
  const getDaysRemaining = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    const expiry = new Date(date);
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };
  
  const getStatusBadge = (date: Date | null) => {
    const days = getDaysRemaining(date);
    if (days === null) return <Badge variant="outline">غير محدد</Badge>;
    if (days < 0) return <Badge variant="destructive">منتهية</Badge>;
    if (days <= 7) return <Badge variant="destructive">أقل من أسبوع</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500">أقل من شهر</Badge>;
    if (days <= 60) return <Badge className="bg-yellow-500">أقل من شهرين</Badge>;
    return <Badge variant="secondary">سارية</Badge>;
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
  
  const generatePDFReport = async () => {
    if (!documentsData) return;
    
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Load images
    const loadImage = (src: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
      });
    };
    
    try {
      const [logoData, stampData, supervisorSigData, managerSigData] = await Promise.all([
        loadImage('/symbol-ai-logo.png'),
        loadImage('/signatures/company_stamp.png'),
        loadImage('/signatures/supervisor_signature.png'),
        loadImage('/signatures/manager_signature.png'),
      ]);
      
      // Header with logo
      doc.addImage(logoData, 'PNG', pageWidth / 2 - 15, 5, 30, 15);
      
      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Employee Documents Status Report', pageWidth / 2, 28, { align: 'center' });
      
      // Subtitle
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Symbol AI - Human Resources Management', pageWidth / 2, 34, { align: 'center' });
      
      // Date
      doc.setFontSize(9);
      doc.text(`Report Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, 40, { align: 'center' });
      
      // Decorative line
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(1);
      doc.line(14, 44, pageWidth - 14, 44);
      
      // Summary Cards
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Summary', 14, 52);
      
      // Summary boxes
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(14, 55, 60, 18, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(185, 28, 28);
      doc.text('Expired Documents', 44, 62, { align: 'center' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(documentsData.summary.totalExpired), 44, 70, { align: 'center' });
      
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(80, 55, 60, 18, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 83, 9);
      doc.text('Expiring Soon', 110, 62, { align: 'center' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(documentsData.summary.totalExpiring), 110, 70, { align: 'center' });
      
      doc.setFillColor(219, 234, 254);
      doc.roundedRect(146, 55, 60, 18, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 64, 175);
      doc.text('Iqama Issues', 176, 62, { align: 'center' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(documentsData.summary.expiredIqamaCount + documentsData.summary.expiringIqamaCount), 176, 70, { align: 'center' });
      
      doc.setFillColor(243, 232, 255);
      doc.roundedRect(212, 55, 60, 18, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 33, 168);
      doc.text('Contract Issues', 242, 62, { align: 'center' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(documentsData.summary.expiredContractCount + documentsData.summary.expiringContractCount), 242, 70, { align: 'center' });
      
      let yPos = 80;
    
    // Expired Documents Table
    if (documentsData.summary.totalExpired > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Expired Documents', 14, yPos);
      yPos += 6;
      
      const expiredData: string[][] = [];
      
      documentsData.expired.iqama.forEach(emp => {
        expiredData.push([emp.name, emp.branchName, 'Iqama', formatDate(emp.iqamaExpiryDate), 'Expired']);
      });
      documentsData.expired.healthCert.forEach(emp => {
        expiredData.push([emp.name, emp.branchName, 'Health Cert', formatDate(emp.healthCertExpiryDate), 'Expired']);
      });
      documentsData.expired.contract.forEach(emp => {
        expiredData.push([emp.name, emp.branchName, 'Contract', formatDate(emp.contractExpiryDate), 'Expired']);
      });
      
      if (expiredData.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Employee', 'Branch', 'Document Type', 'Expiry Date', 'Status']],
          body: expiredData,
          theme: 'striped',
          headStyles: { fillColor: [220, 53, 69] },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
    }
    
    // Expiring Documents Table
    if (documentsData.summary.totalExpiring > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Expiring Soon', 14, yPos);
      yPos += 6;
      
      const expiringData: string[][] = [];
      
      documentsData.expiring.iqama.forEach(emp => {
        const days = getDaysRemaining(emp.iqamaExpiryDate);
        expiringData.push([emp.name, emp.branchName, 'Iqama', formatDate(emp.iqamaExpiryDate), `${days} days`]);
      });
      documentsData.expiring.healthCert.forEach(emp => {
        const days = getDaysRemaining(emp.healthCertExpiryDate);
        expiringData.push([emp.name, emp.branchName, 'Health Cert', formatDate(emp.healthCertExpiryDate), `${days} days`]);
      });
      documentsData.expiring.contract.forEach(emp => {
        const days = getDaysRemaining(emp.contractExpiryDate);
        expiringData.push([emp.name, emp.branchName, 'Contract', formatDate(emp.contractExpiryDate), `${days} days`]);
      });
      
      if (expiringData.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Employee', 'Branch', 'Document Type', 'Expiry Date', 'Days Remaining']],
          body: expiringData,
          theme: 'striped',
          headStyles: { fillColor: [255, 193, 7] },
        });
      }
    }
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }
    
    // Add signatures and stamp at the bottom of last page
    const lastPageHeight = doc.internal.pageSize.getHeight();
    
    // Stamp in center
    doc.addImage(stampData, 'PNG', pageWidth / 2 - 20, lastPageHeight - 55, 40, 40);
    
    // Supervisor signature on right
    doc.addImage(supervisorSigData, 'PNG', pageWidth - 80, lastPageHeight - 50, 50, 25);
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('General Supervisor', pageWidth - 55, lastPageHeight - 22, { align: 'center' });
    doc.text('Salem Al-Wadei', pageWidth - 55, lastPageHeight - 18, { align: 'center' });
    
    // Manager signature on left
    doc.addImage(managerSigData, 'PNG', 30, lastPageHeight - 50, 50, 25);
    doc.text('Manager', 55, lastPageHeight - 22, { align: 'center' });
    doc.text('Omar Al-Mutairi', 55, lastPageHeight - 18, { align: 'center' });
    
    doc.save('Documents_Status_Report.pdf');
    toast.success('تم تحميل التقرير بنجاح');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('حدث خطأ أثناء إنشاء التقرير');
    }
  };
  
  const filterEmployees = (employees: EmployeeDocument[]) => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(term) ||
      emp.code.toLowerCase().includes(term) ||
      emp.branchName.toLowerCase().includes(term)
    );
  };
  
  const renderEmployeeTable = (employees: EmployeeDocument[], documentType: 'iqama' | 'healthCert' | 'contract') => {
    const filtered = filterEmployees(employees);
    
    if (filtered.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>لا توجد وثائق منتهية أو قريبة الانتهاء</p>
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
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الموظف</TableHead>
            <TableHead>الفرع</TableHead>
            <TableHead>تاريخ الانتهاء</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>الصورة</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((emp) => (
            <TableRow key={emp.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-xs text-muted-foreground">{emp.code}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  {emp.branchName}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {formatDate(getExpiryDate(emp))}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(getExpiryDate(emp))}</TableCell>
              <TableCell>
                {getImageUrl(emp) ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={getImageUrl(emp)!} target="_blank" rel="noopener noreferrer">
                      <Eye className="w-4 h-4 ml-1" />
                      عرض
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-sm">لا توجد صورة</span>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
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
          ))}
        </TableBody>
      </Table>
    );
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">لوحة تحكم الوثائق</h1>
            <p className="text-muted-foreground">متابعة حالة وثائق الموظفين والتنبيهات</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث
            </Button>
            <Button onClick={generatePDFReport}>
              <Download className="w-4 h-4 ml-2" />
              تصدير PDF
            </Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                وثائق منتهية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {documentsData?.summary.totalExpired || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                قريبة الانتهاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {documentsData?.summary.totalExpiring || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <IdCard className="w-5 h-5 text-blue-500" />
                إقامات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <span className="text-red-600">{documentsData?.summary.expiredIqamaCount || 0} منتهية</span>
                <span className="text-orange-600">{documentsData?.summary.expiringIqamaCount || 0} قريبة</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-purple-500" />
                عقود
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <span className="text-red-600">{documentsData?.summary.expiredContractCount || 0} منتهية</span>
                <span className="text-orange-600">{documentsData?.summary.expiringContractCount || 0} قريبة</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الكود أو الفرع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="expired" className="space-y-4">
          <TabsList>
            <TabsTrigger value="expired" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              منتهية ({documentsData?.summary.totalExpired || 0})
            </TabsTrigger>
            <TabsTrigger value="expiring" className="gap-2">
              <Clock className="w-4 h-4" />
              قريبة الانتهاء ({documentsData?.summary.totalExpiring || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="expired" className="space-y-4">
            <Tabs defaultValue="iqama">
              <TabsList>
                <TabsTrigger value="iqama">
                  <IdCard className="w-4 h-4 ml-1" />
                  الإقامة ({documentsData?.expired.iqama.length || 0})
                </TabsTrigger>
                <TabsTrigger value="healthCert">
                  <Heart className="w-4 h-4 ml-1" />
                  الشهادة الصحية ({documentsData?.expired.healthCert.length || 0})
                </TabsTrigger>
                <TabsTrigger value="contract">
                  <FileSignature className="w-4 h-4 ml-1" />
                  عقد العمل ({documentsData?.expired.contract.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="iqama">
                <Card>
                  <CardHeader>
                    <CardTitle>إقامات منتهية</CardTitle>
                    <CardDescription>الموظفون الذين انتهت صلاحية إقامتهم</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderEmployeeTable(documentsData?.expired.iqama || [], 'iqama')}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="healthCert">
                <Card>
                  <CardHeader>
                    <CardTitle>شهادات صحية منتهية</CardTitle>
                    <CardDescription>الموظفون الذين انتهت صلاحية شهادتهم الصحية</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderEmployeeTable(documentsData?.expired.healthCert || [], 'healthCert')}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="contract">
                <Card>
                  <CardHeader>
                    <CardTitle>عقود عمل منتهية</CardTitle>
                    <CardDescription>الموظفون الذين انتهت عقود عملهم</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderEmployeeTable(documentsData?.expired.contract || [], 'contract')}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
          
          <TabsContent value="expiring" className="space-y-4">
            <Tabs defaultValue="iqama">
              <TabsList>
                <TabsTrigger value="iqama">
                  <IdCard className="w-4 h-4 ml-1" />
                  الإقامة ({documentsData?.expiring.iqama.length || 0})
                </TabsTrigger>
                <TabsTrigger value="healthCert">
                  <Heart className="w-4 h-4 ml-1" />
                  الشهادة الصحية ({documentsData?.expiring.healthCert.length || 0})
                </TabsTrigger>
                <TabsTrigger value="contract">
                  <FileSignature className="w-4 h-4 ml-1" />
                  عقد العمل ({documentsData?.expiring.contract.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="iqama">
                <Card>
                  <CardHeader>
                    <CardTitle>إقامات قريبة الانتهاء</CardTitle>
                    <CardDescription>الموظفون الذين ستنتهي إقامتهم خلال شهر</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderEmployeeTable(documentsData?.expiring.iqama || [], 'iqama')}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="healthCert">
                <Card>
                  <CardHeader>
                    <CardTitle>شهادات صحية قريبة الانتهاء</CardTitle>
                    <CardDescription>الموظفون الذين ستنتهي شهادتهم الصحية خلال أسبوع</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderEmployeeTable(documentsData?.expiring.healthCert || [], 'healthCert')}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="contract">
                <Card>
                  <CardHeader>
                    <CardTitle>عقود عمل قريبة الانتهاء</CardTitle>
                    <CardDescription>الموظفون الذين ستنتهي عقودهم خلال شهرين</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderEmployeeTable(documentsData?.expiring.contract || [], 'contract')}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
        
        {/* Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>رفع صورة الوثيقة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>الموظف</Label>
                <p className="text-sm text-muted-foreground">{selectedEmployee?.name}</p>
              </div>
              <div>
                <Label>نوع الوثيقة</Label>
                <p className="text-sm text-muted-foreground">
                  {uploadType === 'iqama' ? 'الإقامة' : uploadType === 'healthCert' ? 'الشهادة الصحية' : 'عقد العمل'}
                </p>
              </div>
              <div>
                <Label htmlFor="file">اختر الصورة</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploadMutation.isPending}
                />
              </div>
              {uploadMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري الرفع...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}
