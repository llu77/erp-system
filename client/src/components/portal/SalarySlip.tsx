import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { 
  Loader2, 
  DollarSign, 
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  FileText,
  AlertCircle,
  Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// تعريف نوع jsPDF مع autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface SalarySlipProps {
  employeeId: number;
  employeeName: string;
}

const MONTHS = [
  { value: 1, label: 'يناير', labelEn: 'January' },
  { value: 2, label: 'فبراير', labelEn: 'February' },
  { value: 3, label: 'مارس', labelEn: 'March' },
  { value: 4, label: 'أبريل', labelEn: 'April' },
  { value: 5, label: 'مايو', labelEn: 'May' },
  { value: 6, label: 'يونيو', labelEn: 'June' },
  { value: 7, label: 'يوليو', labelEn: 'July' },
  { value: 8, label: 'أغسطس', labelEn: 'August' },
  { value: 9, label: 'سبتمبر', labelEn: 'September' },
  { value: 10, label: 'أكتوبر', labelEn: 'October' },
  { value: 11, label: 'نوفمبر', labelEn: 'November' },
  { value: 12, label: 'ديسمبر', labelEn: 'December' },
];

// تحميل الشعار كـ base64
async function loadLogoAsBase64(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = () => reject(new Error('Could not load logo'));
    img.src = '/symbol-ai-logo.png';
  });
}

export function SalarySlip({ employeeId, employeeName }: SalarySlipProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // جلب كشف الراتب
  const { data: salarySlip, isLoading, error } = trpc.employeePortal.getSalarySlip.useQuery(
    { employeeId, year: selectedYear, month: selectedMonth },
    { retry: false }
  );

  // جلب سجل الرواتب
  const { data: salaryHistory } = trpc.employeePortal.getSalaryHistory.useQuery(
    { employeeId, limit: 6 }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ر.س';
  };

  const formatCurrencyPDF = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getMonthName = (month: number) => {
    return MONTHS.find(m => m.value === month)?.label || '';
  };

  const getMonthNameEn = (month: number) => {
    return MONTHS.find(m => m.value === month)?.labelEn || '';
  };

  // توليد سنوات للاختيار (آخر 3 سنوات)
  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i);

  // دالة توليد PDF احترافي مع الشعار
  const generatePDF = async () => {
    if (!salarySlip) return;
    
    setIsGeneratingPDF(true);
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // إعداد الخط
      doc.setFont('helvetica');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      
      // ==================== الهيدر مع الشعار ====================
      // خلفية الهيدر
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(0, 0, pageWidth, 50, 'F');
      
      // شريط ذهبي
      doc.setFillColor(245, 158, 11); // amber-500
      doc.rect(0, 50, pageWidth, 3, 'F');
      
      // إضافة الشعار
      try {
        const logoBase64 = await loadLogoAsBase64();
        // الشعار في المنتصف أعلى الهيدر
        const logoWidth = 25;
        const logoHeight = 25;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoBase64, 'PNG', logoX, 5, logoWidth, logoHeight);
      } catch (logoError) {
        console.warn('Could not load logo, continuing without it');
      }
      
      // عنوان الشركة تحت الشعار
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('Symbol AI', pageWidth / 2, 37, { align: 'center' });
      
      doc.setFontSize(11);
      doc.text('Salary Slip', pageWidth / 2, 44, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`${getMonthNameEn(selectedMonth)} ${selectedYear}`, pageWidth / 2, 49, { align: 'center' });
      
      // ==================== معلومات الموظف ====================
      let yPos = 62;
      
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 35, 3, 3, 'F');
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      
      // الصف الأول
      doc.text(`Employee Name: ${salarySlip.employeeName}`, pageWidth - margin - 5, yPos + 10, { align: 'right' });
      doc.text(`Code: ${salarySlip.employeeCode}`, margin + 5, yPos + 10);
      
      // الصف الثاني
      doc.text(`Position: ${salarySlip.position || '-'}`, pageWidth - margin - 5, yPos + 20, { align: 'right' });
      doc.text(`Work Days: ${salarySlip.workDays}`, margin + 5, yPos + 20);
      
      // الصف الثالث
      doc.text(`Payroll No: ${salarySlip.payrollNumber}`, pageWidth - margin - 5, yPos + 30, { align: 'right' });
      const statusText = salarySlip.status === 'approved' ? 'Approved' : 'Pending';
      doc.text(`Status: ${statusText}`, margin + 5, yPos + 30);
      
      yPos += 45;
      
      // ==================== جدول الاستحقاقات ====================
      doc.setFontSize(12);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text('Earnings', pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      
      const earningsData: any[][] = [];
      earningsData.push(['Basic Salary', formatCurrencyPDF(salarySlip.baseSalary)]);
      
      if (salarySlip.overtimeEnabled && salarySlip.overtimeAmount > 0) {
        earningsData.push(['Overtime', formatCurrencyPDF(salarySlip.overtimeAmount)]);
      }
      
      if (salarySlip.incentiveAmount > 0) {
        const incentiveLabel = salarySlip.isSupervisor ? 'Incentive (Supervisor)' : 'Incentive';
        earningsData.push([incentiveLabel, formatCurrencyPDF(salarySlip.incentiveAmount)]);
      }
      
      earningsData.push(['Total Earnings', formatCurrencyPDF(salarySlip.totalEarnings)]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Description', 'Amount (SAR)']],
        body: earningsData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 4,
          halign: 'center',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: [209, 250, 229],
          textColor: [16, 185, 129],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { halign: 'right' },
          1: { halign: 'left' },
        },
        margin: { left: margin, right: margin },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
      
      // ==================== جدول الخصومات ====================
      doc.setFontSize(12);
      doc.setTextColor(239, 68, 68); // red-500
      doc.text('Deductions', pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      
      const deductionsData: any[][] = [];
      
      if (salarySlip.absentDays > 0) {
        deductionsData.push([`Absent Deduction (${salarySlip.absentDays} days)`, formatCurrencyPDF(salarySlip.absentDeduction)]);
      }
      
      if (salarySlip.leaveDays > 0 && salarySlip.leaveDeduction > 0) {
        deductionsData.push([`Leave Deduction (${salarySlip.leaveDays} days)`, formatCurrencyPDF(salarySlip.leaveDeduction)]);
      }
      
      if (salarySlip.advanceDeduction > 0) {
        deductionsData.push(['Advance Deduction', formatCurrencyPDF(salarySlip.advanceDeduction)]);
      }
      
      if (salarySlip.negativeInvoicesDeduction > 0) {
        deductionsData.push(['Negative Invoices', formatCurrencyPDF(salarySlip.negativeInvoicesDeduction)]);
      }
      
      if (salarySlip.deductionAmount > 0) {
        const deductionLabel = salarySlip.deductionReason 
          ? `Other Deductions (${salarySlip.deductionReason})`
          : 'Other Deductions';
        deductionsData.push([deductionLabel, formatCurrencyPDF(salarySlip.deductionAmount)]);
      }
      
      if (deductionsData.length === 0) {
        deductionsData.push(['No Deductions', '0.00']);
      }
      
      deductionsData.push(['Total Deductions', formatCurrencyPDF(salarySlip.totalDeductions)]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Description', 'Amount (SAR)']],
        body: deductionsData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 4,
          halign: 'center',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [239, 68, 68],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: [254, 226, 226],
          textColor: [239, 68, 68],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { halign: 'right' },
          1: { halign: 'left' },
        },
        margin: { left: margin, right: margin },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
      
      // ==================== صافي الراتب ====================
      doc.setFillColor(245, 158, 11); // amber-500
      doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 25, 3, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('Net Salary', pageWidth / 2, yPos + 10, { align: 'center' });
      
      doc.setFontSize(18);
      doc.text(`${formatCurrencyPDF(salarySlip.netSalary)} SAR`, pageWidth / 2, yPos + 20, { align: 'center' });
      
      yPos += 35;
      
      // ==================== التوقيعات ====================
      if (salarySlip.status === 'approved') {
        doc.setFillColor(209, 250, 229); // emerald-100
        doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 8, 2, 2, 'F');
        doc.setTextColor(16, 185, 129);
        doc.setFontSize(10);
        doc.text('APPROVED', pageWidth / 2, yPos + 5.5, { align: 'center' });
        yPos += 15;
      }
      
      // خطوط التوقيع
      doc.setDrawColor(148, 163, 184); // slate-400
      doc.setLineWidth(0.5);
      
      const signWidth = 50;
      const signY = yPos + 15;
      
      // توقيع المدير
      doc.line(margin + 10, signY, margin + 10 + signWidth, signY);
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.text('Manager Signature', margin + 10 + (signWidth / 2), signY + 7, { align: 'center' });
      
      // توقيع الموظف
      doc.line(pageWidth - margin - 10 - signWidth, signY, pageWidth - margin - 10, signY);
      doc.text('Employee Signature', pageWidth - margin - 10 - (signWidth / 2), signY + 7, { align: 'center' });
      
      // ==================== الفوتر ====================
      doc.setFillColor(30, 41, 59);
      doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
      
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      const printDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Printed: ${printDate}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
      doc.text('Symbol AI - Employee Portal', pageWidth / 2, pageHeight - 6, { align: 'center' });
      
      // حفظ الملف
      const fileName = `SalarySlip_${salarySlip.employeeCode}_${selectedYear}_${selectedMonth}.pdf`;
      doc.save(fileName);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error generating PDF:', errorMessage, error);
      alert(`حدث خطأ أثناء إنشاء ملف PDF: ${errorMessage}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* اختيار الشهر والسنة */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            اختر الشهر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="flex-1 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="الشهر" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-24 bg-slate-700 border-slate-600 text-white">
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
          </div>
        </CardContent>
      </Card>

      {/* كشف الراتب */}
      {isLoading ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </CardContent>
        </Card>
      ) : error || !salarySlip ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">لا يوجد كشف راتب لشهر {getMonthName(selectedMonth)} {selectedYear}</p>
            <p className="text-slate-500 text-sm mt-2">قد لا يكون المسير قد صدر بعد</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  كشف راتب {getMonthName(selectedMonth)} {selectedYear}
                </CardTitle>
                <p className="text-slate-400 text-sm mt-1">رقم المسير: {salarySlip.payrollNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={salarySlip.status === 'approved' ? 'default' : 'secondary'}
                  className={salarySlip.status === 'approved' ? 'bg-emerald-500' : 'bg-amber-500'}
                >
                  {salarySlip.status === 'approved' ? 'معتمد' : salarySlip.status === 'paid' ? 'مدفوع' : 'قيد المراجعة'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-1" />
                  ) : (
                    <Download className="h-4 w-4 ml-1" />
                  )}
                  تحميل PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* معلومات الموظف */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-700/30 rounded-lg">
              <div>
                <p className="text-slate-400 text-xs">الاسم</p>
                <p className="text-white font-medium">{salarySlip.employeeName}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">الكود</p>
                <p className="text-white font-medium">{salarySlip.employeeCode}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">المنصب</p>
                <p className="text-white font-medium">{salarySlip.position || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">أيام العمل</p>
                <p className="text-white font-medium">{salarySlip.workDays} يوم</p>
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* الاستحقاقات */}
            <div>
              <h4 className="text-emerald-400 text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                الاستحقاقات
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">الراتب الأساسي</span>
                  <span className="text-white">{formatCurrency(salarySlip.baseSalary)}</span>
                </div>
                {salarySlip.overtimeEnabled && salarySlip.overtimeAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">ساعات إضافية</span>
                    <span className="text-white">{formatCurrency(salarySlip.overtimeAmount)}</span>
                  </div>
                )}
                {salarySlip.incentiveAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      {salarySlip.isSupervisor ? 'حوافز (مشرف)' : 'حوافز'}
                    </span>
                    <span className="text-white">{formatCurrency(salarySlip.incentiveAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium pt-2 border-t border-slate-700">
                  <span className="text-emerald-400">إجمالي الاستحقاقات</span>
                  <span className="text-emerald-400">{formatCurrency(salarySlip.totalEarnings)}</span>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* الخصومات */}
            <div>
              <h4 className="text-red-400 text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                الخصومات
              </h4>
              <div className="space-y-2">
                {salarySlip.absentDays > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصم الغياب ({salarySlip.absentDays} يوم)</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.absentDeduction)}</span>
                  </div>
                )}
                {salarySlip.leaveDays > 0 && salarySlip.leaveDeduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصم الإجازات ({salarySlip.leaveDays} يوم)</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.leaveDeduction)}</span>
                  </div>
                )}
                {salarySlip.advanceDeduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصم السلفة</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.advanceDeduction)}</span>
                  </div>
                )}
                {salarySlip.negativeInvoicesDeduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">فواتير سالبة</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.negativeInvoicesDeduction)}</span>
                  </div>
                )}
                {salarySlip.deductionAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      {salarySlip.deductionReason ? `خصومات أخرى (${salarySlip.deductionReason})` : 'خصومات أخرى'}
                    </span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.deductionAmount)}</span>
                  </div>
                )}
                {salarySlip.totalDeductions === 0 && (
                  <p className="text-slate-500 text-sm">لا توجد خصومات</p>
                )}
                <div className="flex justify-between text-sm font-medium pt-2 border-t border-slate-700">
                  <span className="text-red-400">إجمالي الخصومات</span>
                  <span className="text-red-400">-{formatCurrency(salarySlip.totalDeductions)}</span>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* صافي الراتب */}
            <div className="bg-amber-500/20 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                  <span className="text-white font-medium">صافي الراتب</span>
                </div>
                <span className="text-2xl font-bold text-amber-500">
                  {formatCurrency(salarySlip.netSalary)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* سجل الرواتب السابقة */}
      {salaryHistory && salaryHistory.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              سجل الرواتب السابقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {salaryHistory.map((record, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => {
                    setSelectedYear(record.year);
                    setSelectedMonth(record.month);
                  }}
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {getMonthName(record.month)} {record.year}
                    </p>
                    <p className="text-slate-400 text-xs">رقم المسير: {record.payrollNumber}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-amber-500 font-medium">{formatCurrency(record.netSalary)}</p>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        record.status === 'approved' 
                          ? 'border-emerald-500 text-emerald-500' 
                          : record.status === 'paid'
                          ? 'border-blue-500 text-blue-500'
                          : 'border-amber-500 text-amber-500'
                      }`}
                    >
                      {record.status === 'approved' ? 'معتمد' : record.status === 'paid' ? 'مدفوع' : 'قيد المراجعة'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
