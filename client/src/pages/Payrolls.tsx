import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Printer,
  DollarSign,
  Users,
  Calendar,
  Building2,
  Send,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PDF_COLORS, SIGNATURES, PDF_BASE_STYLES } from "@/utils/pdfTemplates";

// أسماء الأشهر بالعربية
const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

// أسماء الحالات بالعربية
const statusNames: Record<string, string> = {
  draft: "مسودة",
  pending: "تحت الإجراء",
  approved: "معتمدة",
  paid: "مدفوعة",
  cancelled: "ملغاة",
};

// ألوان الحالات
const statusColors: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  paid: "bg-blue-500/20 text-blue-400",
  cancelled: "bg-red-500/20 text-red-400",
};

// نوع بيانات الموظف في النموذج
interface EmployeePayrollData {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  position: string;
  baseSalary: number;
  overtimeEnabled: boolean;
  overtimeAmount: number;
  workDays: number;
  absentDays: number;
  absentDeduction: number;
  incentiveAmount: number;
  deductionAmount: number;
  advanceDeduction: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

// الراتب الأساسي الثابت
const BASE_SALARY = 2000;
// قيمة الساعات الإضافية
const OVERTIME_AMOUNT = 1000;

export default function Payrolls() {
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [employeesData, setEmployeesData] = useState<EmployeePayrollData[]>([]);
  const [step, setStep] = useState<'select' | 'form'>('select');

  // جلب البيانات
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: payrolls, isLoading, refetch } = trpc.payrolls.list.useQuery();
  const { data: payrollDetails } = trpc.payrolls.details.useQuery(
    { payrollId: selectedPayroll! },
    { enabled: !!selectedPayroll }
  );
  const { data: branchEmployees } = trpc.employees.listByBranch.useQuery(
    { branchId: selectedBranch! },
    { enabled: !!selectedBranch && step === 'form' }
  );
  
  // جلب السلف غير المخصومة للفرع
  const { data: branchAdvances } = trpc.advancesForPayroll.getForBranch.useQuery(
    { branchId: selectedBranch! },
    { enabled: !!selectedBranch && step === 'form' }
  );

  // تهيئة بيانات الموظفين عند تحميلهم مع السلف تلقائياً
  useEffect(() => {
    if (branchEmployees && branchEmployees.length > 0) {
      const initialData: EmployeePayrollData[] = branchEmployees.map((emp: any) => {
        const baseSalary = BASE_SALARY;
        const overtimeEnabled = false;
        const overtimeAmount = 0;
        const workDays = 30;
        const absentDays = 0;
        const absentDeduction = 0;
        const incentiveAmount = 0;
        const deductionAmount = 0;
        
        // جلب السلف غير المخصومة للموظف تلقائياً
        const employeeAdvances = branchAdvances?.find(a => a.employeeId === emp.id);
        const advanceDeduction = employeeAdvances?.totalAdvances || 0;
        
        const grossSalary = baseSalary;
        const totalDeductions = advanceDeduction;
        const netSalary = baseSalary - totalDeductions;

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.code,
          position: emp.position || '',
          baseSalary,
          overtimeEnabled,
          overtimeAmount,
          workDays,
          absentDays,
          absentDeduction,
          incentiveAmount,
          deductionAmount,
          advanceDeduction,
          grossSalary,
          totalDeductions,
          netSalary,
        };
      });
      setEmployeesData(initialData);
    }
  }, [branchEmployees, branchAdvances]);

  // حساب الراتب لموظف معين
  const calculateSalary = (data: EmployeePayrollData): EmployeePayrollData => {
    const overtime = data.overtimeEnabled ? OVERTIME_AMOUNT : 0;
    const dailyRate = (data.baseSalary + overtime) / 30;
    const absentDays = 30 - data.workDays;
    const absentDeduction = absentDays > 0 ? dailyRate * absentDays : 0;
    const grossSalary = data.baseSalary + overtime + data.incentiveAmount;
    const totalDeductions = data.deductionAmount + data.advanceDeduction + absentDeduction;
    const netSalary = grossSalary - totalDeductions;

    return {
      ...data,
      overtimeAmount: overtime,
      absentDays,
      absentDeduction,
      grossSalary,
      totalDeductions,
      netSalary,
    };
  };

  // تحديث بيانات موظف
  const updateEmployeeData = (index: number, field: keyof EmployeePayrollData, value: any) => {
    setEmployeesData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index] = calculateSalary(updated[index]);
      return updated;
    });
  };

  // Mutations
  const createPayrollMutation = trpc.payrolls.createWithDetails.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء مسيرة الرواتب بنجاح");
      setIsGenerateOpen(false);
      setStep('select');
      setEmployeesData([]);
      setSelectedBranch(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = trpc.payrolls.updateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.payrolls.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف مسيرة الرواتب بنجاح");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // إنشاء مسيرة رواتب
  const handleCreatePayroll = () => {
    if (!selectedBranch) {
      toast.error("يرجى اختيار الفرع");
      return;
    }
    if (employeesData.length === 0) {
      toast.error("لا يوجد موظفين في هذا الفرع");
      return;
    }

    const branch = branches?.find(b => b.id === selectedBranch);
    if (!branch) return;

    // حساب الإجماليات
    const totals = employeesData.reduce((acc, emp) => ({
      totalBaseSalary: acc.totalBaseSalary + emp.baseSalary,
      totalOvertime: acc.totalOvertime + emp.overtimeAmount,
      totalIncentives: acc.totalIncentives + emp.incentiveAmount,
      totalDeductions: acc.totalDeductions + emp.totalDeductions,
      totalNetSalary: acc.totalNetSalary + emp.netSalary,
    }), {
      totalBaseSalary: 0,
      totalOvertime: 0,
      totalIncentives: 0,
      totalDeductions: 0,
      totalNetSalary: 0,
    });

    createPayrollMutation.mutate({
      branchId: selectedBranch,
      branchName: branch.nameAr || branch.name,
      year: selectedYear,
      month: selectedMonth,
      ...totals,
      employeeCount: employeesData.length,
      details: employeesData.map(emp => ({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        employeeCode: emp.employeeCode,
        position: emp.position,
        baseSalary: emp.baseSalary.toFixed(2),
        overtimeEnabled: emp.overtimeEnabled,
        overtimeAmount: emp.overtimeAmount.toFixed(2),
        workDays: emp.workDays,
        absentDays: emp.absentDays,
        absentDeduction: emp.absentDeduction.toFixed(2),
        incentiveAmount: emp.incentiveAmount.toFixed(2),
        deductionAmount: emp.deductionAmount.toFixed(2),
        advanceDeduction: emp.advanceDeduction.toFixed(2),
        grossSalary: emp.grossSalary.toFixed(2),
        totalDeductions: emp.totalDeductions.toFixed(2),
        netSalary: emp.netSalary.toFixed(2),
      })),
    });
  };

  // طباعة المسيرة
  const handlePrint = async (payrollId: number) => {
    try {
      // جلب بيانات المسيرة
      const payroll = payrolls?.find(p => p.id === payrollId);
      if (!payroll) {
        toast.error("لم يتم العثور على المسيرة");
        return;
      }

      // جلب تفاصيل المسيرة
      const detailsResponse = await fetch(`/api/trpc/payrolls.details?input=${encodeURIComponent(JSON.stringify({ payrollId: payrollId }))}`);
      const detailsData = await detailsResponse.json();
      const details = detailsData?.result?.data || [];

      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const monthName = monthNames[payroll.month - 1];
      const statusNames: Record<string, string> = {
        draft: 'مسودة',
        pending: 'تحت الإجراء',
        approved: 'معتمدة',
        paid: 'مدفوعة',
      };

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("يرجى السماح بالنوافذ المنبثقة");
        return;
      }

      const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>مسيرة رواتب - ${payroll.branchName} - ${monthName} ${payroll.year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800;900&display=swap');
    body {
      font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .company-info { display: flex; align-items: center; gap: 15px; }
    .company-info img { height: 50px; width: auto; }
    .company-info h1 { font-size: 24px; color: #000; font-weight: 800; }
    .report-title { text-align: left; }
    .report-title h2 { font-size: 18px; color: #000; font-weight: 700; }
    .report-title p { color: #666; font-size: 11px; }
    .info-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .info-item { text-align: center; }
    .info-item label { display: block; font-size: 10px; color: #666; margin-bottom: 3px; }
    .info-item span { font-size: 22px; font-weight: 900; color: #000000; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #1a1a1a; color: white; padding: 12px 8px; font-size: 13px; font-weight: 700; text-align: center; }
    td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 16px; font-weight: 700; color: #000000; }
    tr:nth-child(even) { background: #f8fafc; }
    .summary-section {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      background: #1a1a1a;
      padding: 20px;
      border-radius: 8px;
      color: white;
      margin-bottom: 20px;
      border: 2px solid #000;
    }
    .summary-item { text-align: center; }
    .summary-item label { display: block; font-size: 10px; opacity: 0.9; margin-bottom: 5px; }
    .summary-item span { font-size: 24px; font-weight: 900; }
    .footer { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 30px; padding-top: 20px; border-top: 2px dashed #e2e8f0; gap: 20px; }
    .signature-box { text-align: center; flex: 1; padding: 15px; background: #f8f9fa; border: 2px solid #e0e0e0; border-radius: 8px; min-height: 160px; }
    .signature-box.has-signature { border-color: #1b5e20; background: #e8f5e9; }
    .signature-box .title { font-size: 10px; color: #607d8b; font-weight: 600; margin-bottom: 10px; text-transform: uppercase; }
    .signature-box .sig-image { height: 80px; display: flex; align-items: center; justify-content: center; }
    .signature-box .sig-image img { max-height: 80px; max-width: 140px; object-fit: contain; }
    .signature-box .line { border-top: 1px solid #333; margin-top: 10px; padding-top: 8px; }
    .signature-box .name { font-size: 12px; font-weight: 700; color: #0f2744; }
    .signature-box .role { font-size: 9px; color: #607d8b; margin-top: 2px; }
    .stamp-box { flex: 0 0 140px; text-align: center; padding: 10px; }
    .stamp-box img { width: 130px; height: 130px; object-fit: contain; }
    .stamp-box .label { font-size: 9px; color: #607d8b; margin-top: 5px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-draft { background: #e2e8f0; color: #475569; }
    .status-paid { background: #dbeafe; color: #1e40af; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <img src="/symbol-ai-logo.png" alt="Symbol AI" />
      <div>
        <h1>Symbol AI</h1>
        <p>نظام إدارة الموارد البشرية</p>
      </div>
    </div>
    <div class="report-title">
      <h2>مسيرة رواتب</h2>
      <p>رقم المسيرة: ${payroll.payrollNumber}</p>
      <p>تاريخ الإنشاء: ${new Date(payroll.createdAt).toLocaleDateString('ar-SA')}</p>
    </div>
  </div>

  <div class="info-section">
    <div class="info-item">
      <label>الفرع</label>
      <span>${payroll.branchName}</span>
    </div>
    <div class="info-item">
      <label>الشهر</label>
      <span>${monthName} ${payroll.year}</span>
    </div>
    <div class="info-item">
      <label>عدد الموظفين</label>
      <span>${payroll.employeeCount}</span>
    </div>
    <div class="info-item">
      <label>الحالة</label>
      <span class="status-badge status-${payroll.status}">${statusNames[payroll.status] || payroll.status}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>اسم الموظف</th>
        <th>الرمز</th>
        <th>الأساسي</th>
        <th>إضافي</th>
        <th>أيام العمل</th>
        <th>خصم غياب</th>
        <th>حوافز</th>
        <th>خصومات</th>
        <th>سلف</th>
        <th>صافي الراتب</th>
      </tr>
    </thead>
    <tbody>
      ${details.map((d: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td>${d.employeeName}</td>
          <td>${d.employeeCode || '-'}</td>
          <td>${parseFloat(d.baseSalary).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</td>
          <td>${parseFloat(d.overtimeAmount || '0').toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</td>
          <td>${d.workDays || 30}</td>
          <td>${parseFloat(d.absentDeduction || '0').toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</td>
          <td>${parseFloat(d.incentiveAmount || '0').toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</td>
          <td>${parseFloat(d.deductionAmount || '0').toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</td>
          <td>${parseFloat(d.advanceDeduction || '0').toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</td>
          <td style="font-weight: bold; color: #166534;">${parseFloat(d.netSalary).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-section">
    <div class="summary-item">
      <label>إجمالي الرواتب الأساسية</label>
      <span>${parseFloat(payroll.totalBaseSalary).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</span>
    </div>
    <div class="summary-item">
      <label>إجمالي الإضافي</label>
      <span>${parseFloat(payroll.totalOvertime).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</span>
    </div>
    <div class="summary-item">
      <label>إجمالي الحوافز</label>
      <span>${parseFloat(payroll.totalIncentives).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</span>
    </div>
    <div class="summary-item">
      <label>إجمالي الخصومات</label>
      <span>${parseFloat(payroll.totalDeductions).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</span>
    </div>
    <div class="summary-item">
      <label>صافي المسيرة</label>
      <span>${parseFloat(payroll.totalNetSalary).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س.</span>
    </div>
  </div>

  <div class="footer">
    <div class="signature-box ${payroll.status === 'approved' || payroll.status === 'paid' ? 'has-signature' : ''}">
      <div class="title">توقيع المشرف العام</div>
      <div class="sig-image">
        ${payroll.status === 'approved' || payroll.status === 'paid' ? '<img src="/signatures/supervisor_signature.png" alt="توقيع المشرف" onerror="this.parentElement.innerHTML=\'<span style=color:#1b5e20>✓ موقّع</span>\'" />' : '<span style="color: #607d8b; font-size: 9px;">في انتظار التوقيع</span>'}
      </div>
      <div class="line">
        <div class="name">سالم الوادعي</div>
        <div class="role">المشرف العام</div>
      </div>
    </div>
    <div class="stamp-box">
      ${payroll.status === 'approved' || payroll.status === 'paid' ? '<img src="/signatures/company_stamp.png" alt="ختم الإدارة" onerror="this.style.display=\'none\'" />' : ''}
      <div class="label">ختم الإدارة</div>
    </div>
    <div class="signature-box ${payroll.status === 'approved' || payroll.status === 'paid' ? 'has-signature' : ''}">
      <div class="title">توقيع المدير العام</div>
      <div class="sig-image">
        ${payroll.status === 'approved' || payroll.status === 'paid' ? '<img src="/signatures/manager_signature.png" alt="توقيع المدير" onerror="this.parentElement.innerHTML=\'<span style=color:#1b5e20>✓ موقّع</span>\'" />' : '<span style="color: #607d8b; font-size: 9px;">في انتظار التوقيع</span>'}
      </div>
      <div class="line">
        <div class="name">عمر المطيري</div>
        <div class="role">المدير العام</div>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    } catch (error) {
      console.error('Print error:', error);
      toast.error("حدث خطأ أثناء الطباعة");
    }
  };

  // طباعة قسيمة راتب فردية - تصميم احترافي موحد
  const handlePrintPayslip = (detail: any, payroll: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة");
      return;
    }

    const monthName = arabicMonths[payroll.month - 1];
    const grossSalary = parseFloat(detail.baseSalary) + parseFloat(detail.overtimeAmount || '0') + parseFloat(detail.incentiveAmount || '0');
    const totalDeductions = parseFloat(detail.absentDeduction || '0') + parseFloat(detail.deductionAmount || '0') + parseFloat(detail.advanceDeduction || '0');
    const isApproved = payroll.status === 'approved';
    
    // التاريخ الهجري
    const hijriDate = new Date().toLocaleDateString('ar-SA-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>قسيمة راتب - ${detail.employeeName} - Symbol AI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800;900&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 15px;
    }
    
    .payslip {
      max-width: 700px;
      margin: 0 auto;
      background: #fff;
      position: relative;
    }
    
    /* العلامة المائية */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 90px;
      font-weight: 900;
      color: rgba(27, 94, 32, 0.05);
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
      letter-spacing: 8px;
    }
    
    /* الهيدر */
    .header {
      background: #1a1a1a;
      color: white;
      padding: 18px 20px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      position: relative;
    }
    
    .status-badge {
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 18px;
      border-radius: 0 0 8px 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    
    .status-approved { background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%); color: white; }
    .status-pending { background: linear-gradient(135deg, #e65100 0%, #f57c00 100%); color: white; }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo {
      width: 50px;
      height: 50px;
      background: white;
      border-radius: 8px;
      padding: 4px;
      object-fit: contain;
    }
    
    .company-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1px;
    }
    
    .company-subtitle {
      font-size: 10px;
      opacity: 0.85;
      margin-top: 2px;
    }
    
    .header-left {
      text-align: left;
      background: rgba(255,255,255,0.1);
      padding: 10px 14px;
      border-radius: 6px;
    }
    
    .doc-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    
    .doc-number {
      font-size: 10px;
      font-family: 'Courier New', monospace;
      background: rgba(0,0,0,0.2);
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 3px;
    }
    
    .doc-date {
      font-size: 9px;
      opacity: 0.8;
    }
    
    /* معلومات الموظف */
    .employee-info {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    
    .info-item {
      text-align: center;
      padding: 8px;
      background: white;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }
    
    .info-label {
      display: block;
      font-size: 9px;
      color: #607d8b;
      margin-bottom: 3px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .info-value {
      font-size: 20px;
      font-weight: 900;
      color: #000000;
    }
    
    /* تفاصيل الراتب */
    .salary-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 15px;
    }
    
    .earnings-box {
      background: #e8f5e9;
      border: 1px solid #a5d6a7;
      border-radius: 8px;
      padding: 12px;
    }
    
    .deductions-box {
      background: #ffebee;
      border: 1px solid #ef9a9a;
      border-radius: 8px;
      padding: 12px;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 10px;
      padding-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .earnings-box .section-title {
      color: #1b5e20;
      border-bottom: 2px solid #1b5e20;
    }
    
    .deductions-box .section-title {
      color: #b71c1c;
      border-bottom: 2px solid #b71c1c;
    }
    
    .salary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed rgba(0,0,0,0.1);
      font-size: 14px;
    }
    
    .salary-row:last-child { border-bottom: none; }
    
    .salary-row .label { color: #000; font-weight: 600; }
    .salary-row .value { font-weight: 900; color: #000000; font-size: 18px; }
    .salary-row .value.positive { color: #000000; }
    .salary-row .value.negative { color: #cc0000; }
    
    .total-row {
      margin-top: 8px;
      padding-top: 8px;
      font-weight: 800;
      font-size: 16px;
    }
    
    .earnings-box .total-row { border-top: 2px solid #1b5e20; }
    .deductions-box .total-row { border-top: 2px solid #b71c1c; }
    
    /* صافي الراتب */
    .net-salary {
      background: #1a1a1a;
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 15px;
      border: 2px solid #000;
    }
    
    .net-salary .label {
      font-size: 11px;
      opacity: 0.9;
      margin-bottom: 4px;
    }
    
    .net-salary .amount {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    
    /* قسم التوقيعات */
    .approval-section {
      border-top: 2px dashed #e0e0e0;
      padding-top: 15px;
      margin-top: 10px;
    }
    
    .approval-header {
      text-align: center;
      margin-bottom: 15px;
    }
    
    .approval-title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 700;
    }
    
    .approval-title.approved {
      background: #e8f5e9;
      color: #1b5e20;
      border: 1px solid #1b5e20;
    }
    
    .approval-title.pending {
      background: #fff3e0;
      color: #e65100;
      border: 1px solid #e65100;
    }
    
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    
    .signature-box {
      flex: 1;
      text-align: center;
      padding: 15px;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      min-height: 160px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .signature-box.has-signature {
      border-color: #1b5e20;
      background: #e8f5e9;
    }
    
    .signature-title {
      font-size: 9px;
      color: #607d8b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 8px;
    }
    
    .signature-image-container {
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .signature-image {
      max-height: 80px;
      max-width: 140px;
      object-fit: contain;
    }
    
    .signature-line {
      width: 70%;
      height: 1px;
      background: #e0e0e0;
      margin: 8px auto;
    }
    
    .signature-name {
      font-size: 11px;
      font-weight: 700;
      color: #0f2744;
    }
    
    .signature-role {
      font-size: 8px;
      color: #607d8b;
      margin-top: 2px;
    }
    
    .stamp-box {
      flex: 0 0 140px;
      text-align: center;
      padding: 8px;
    }
    
    .stamp-image {
      width: 130px;
      height: 130px;
      object-fit: contain;
    }
    
    .stamp-label {
      font-size: 8px;
      color: #607d8b;
      margin-top: 4px;
    }
    
    .pending-signatures {
      text-align: center;
      padding: 20px;
      color: #607d8b;
    }
    
    .pending-signatures .icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    
    .pending-signatures .text {
      font-size: 11px;
    }
    
    .pending-signatures .subtext {
      font-size: 9px;
      margin-top: 4px;
      opacity: 0.8;
    }
    
    /* التذييل */
    .footer {
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #e0e0e0;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8px;
      color: #607d8b;
    }
    
    .footer-logo {
      height: 16px;
      opacity: 0.5;
    }
    
    @media print {
      body { padding: 8px; }
      .watermark { position: absolute; }
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  ${isApproved ? '<div class="watermark">معتمد</div>' : ''}
  
  <div class="payslip">
    <!-- الهيدر -->
    <div class="header">
      <div class="status-badge ${isApproved ? 'status-approved' : 'status-pending'}">
        ${isApproved ? '✓ معتمد' : '⏳ قيد المراجعة'}
      </div>
      <div class="header-right">
        <img src="/symbol-ai-logo.png" alt="Symbol AI" class="logo" onerror="this.style.display='none'" />
        <div>
          <div class="company-name">Symbol AI</div>
          <div class="company-subtitle">صالونات قصه وتخفيف وفروعها</div>
        </div>
      </div>
      <div class="header-left">
        <div class="doc-number">${payroll.payrollNumber}</div>
        <div class="doc-title">قسيمة راتب</div>
        <div class="doc-date">${hijriDate}</div>
        <div class="doc-date">${monthName} ${payroll.year}</div>
      </div>
    </div>
    
    <!-- معلومات الموظف -->
    <div class="employee-info">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">اسم الموظف</span>
          <span class="info-value">${detail.employeeName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">رقم الموظف</span>
          <span class="info-value">${detail.employeeCode || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">الفرع</span>
          <span class="info-value">${payroll.branchName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">الفترة</span>
          <span class="info-value">${monthName} ${payroll.year}</span>
        </div>
      </div>
    </div>
    
    <!-- تفاصيل الراتب -->
    <div class="salary-section">
      <div class="earnings-box">
        <div class="section-title">▲ المستحقات</div>
        <div class="salary-row">
          <span class="label">الراتب الأساسي</span>
          <span class="value positive">${parseFloat(detail.baseSalary).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>
        ${parseFloat(detail.overtimeAmount || '0') > 0 ? `
        <div class="salary-row">
          <span class="label">بدل ساعات إضافية</span>
          <span class="value positive">${parseFloat(detail.overtimeAmount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>` : ''}
        ${parseFloat(detail.incentiveAmount || '0') > 0 ? `
        <div class="salary-row">
          <span class="label">حوافز</span>
          <span class="value positive">${parseFloat(detail.incentiveAmount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>` : ''}
        <div class="salary-row total-row">
          <span class="label">إجمالي المستحقات</span>
          <span class="value positive">${grossSalary.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>
      </div>
      
      <div class="deductions-box">
        <div class="section-title">▼ الاستقطاعات</div>
        ${parseFloat(detail.absentDeduction || '0') > 0 ? `
        <div class="salary-row">
          <span class="label">خصم غياب (${detail.absentDays || 0} يوم)</span>
          <span class="value negative">-${parseFloat(detail.absentDeduction).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>` : ''}
        ${parseFloat(detail.deductionAmount || '0') > 0 ? `
        <div class="salary-row">
          <span class="label">خصومات أخرى</span>
          <span class="value negative">-${parseFloat(detail.deductionAmount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>` : ''}
        ${parseFloat(detail.advanceDeduction || '0') > 0 ? `
        <div class="salary-row">
          <span class="label">سلف مستردة</span>
          <span class="value negative">-${parseFloat(detail.advanceDeduction).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>` : ''}
        ${totalDeductions === 0 ? `
        <div class="salary-row">
          <span class="label" style="color: #1b5e20;">لا توجد استقطاعات</span>
          <span class="value">0.00 ر.س</span>
        </div>` : ''}
        <div class="salary-row total-row">
          <span class="label">إجمالي الاستقطاعات</span>
          <span class="value negative">-${totalDeductions.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
        </div>
      </div>
    </div>
    
    <!-- صافي الراتب -->
    <div class="net-salary">
      <div class="label">صافي الراتب</div>
      <div class="amount">${parseFloat(detail.netSalary).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</div>
    </div>
    
    <!-- قسم التوقيعات والختم -->
    <div class="approval-section">
      <div class="approval-header">
        <div class="approval-title ${isApproved ? 'approved' : 'pending'}">
          ${isApproved ? '✓ تم الاعتماد' : '⏳ قيد المراجعة والاعتماد'}
        </div>
      </div>
      
      ${isApproved ? `
      <div class="signatures-row">
        <div class="signature-box has-signature">
          <div class="signature-title">توقيع المشرف العام</div>
          <div class="signature-image-container">
            <img src="${SIGNATURES.supervisor.image}" alt="توقيع المشرف" class="signature-image" onerror="this.parentElement.innerHTML='<span style=\\'color:#1b5e20\\'>✓ موقّع</span>'" />
          </div>
          <div class="signature-line"></div>
          <div class="signature-name">${SIGNATURES.supervisor.name}</div>
          <div class="signature-role">${SIGNATURES.supervisor.title}</div>
        </div>
        
        <div class="stamp-box">
          <img src="${SIGNATURES.stamp.image}" alt="ختم الإدارة" class="stamp-image" onerror="this.style.display='none'" />
          <div class="stamp-label">ختم الإدارة</div>
        </div>
        
        <div class="signature-box has-signature">
          <div class="signature-title">توقيع المدير العام</div>
          <div class="signature-image-container">
            <img src="${SIGNATURES.manager.image}" alt="توقيع المدير" class="signature-image" onerror="this.parentElement.innerHTML='<span style=\\'color:#1b5e20\\'>✓ موقّع</span>'" />
          </div>
          <div class="signature-line"></div>
          <div class="signature-name">${SIGNATURES.manager.name}</div>
          <div class="signature-role">${SIGNATURES.manager.title}</div>
        </div>
      </div>
      ` : `
      <div class="signatures-row">
        <div class="signature-box">
          <div class="signature-title">توقيع المشرف العام</div>
          <div class="signature-image-container">
            <span style="color: #607d8b; font-size: 9px;">في انتظار التوقيع</span>
          </div>
          <div class="signature-line"></div>
          <div class="signature-name">${SIGNATURES.supervisor.name}</div>
          <div class="signature-role">${SIGNATURES.supervisor.title}</div>
        </div>
        
        <div class="stamp-box">
          <div style="width: 95px; height: 95px; border: 2px dashed #e0e0e0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
            <span style="color: #607d8b; font-size: 9px;">الختم</span>
          </div>
          <div class="stamp-label">ختم الإدارة</div>
        </div>
        
        <div class="signature-box">
          <div class="signature-title">توقيع المدير العام</div>
          <div class="signature-image-container">
            <span style="color: #607d8b; font-size: 9px;">في انتظار التوقيع</span>
          </div>
          <div class="signature-line"></div>
          <div class="signature-name">${SIGNATURES.manager.name}</div>
          <div class="signature-role">${SIGNATURES.manager.title}</div>
        </div>
      </div>
      `}
    </div>
    
    <!-- التذييل -->
    <div class="footer">
      <div class="footer-content">
        <div style="display: flex; align-items: center; gap: 6px;">
          <img src="/symbol-ai-logo.png" alt="Logo" class="footer-logo" onerror="this.style.display='none'" />
          <span>Symbol AI - صالونات قصه وتخفيف وفروعها</span>
        </div>
        <div>جميع الحقوق محفوظة © ${new Date().getFullYear()}</div>
        <div>تم الطباعة: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // تصدير PDF
  const handleExportPDF = async (payrollId: number) => {
    try {
      const response = await fetch(`/api/payroll/export/${payrollId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll-${payrollId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("تم تصدير الملف بنجاح");
      } else {
        toast.error("فشل في تصدير الملف");
      }
    } catch {
      toast.error("حدث خطأ أثناء التصدير");
    }
  };

  // تنسيق المبلغ
  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('ar-SA', { minimumFractionDigits: 2 });
  };

  // تنسيق التاريخ
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ar-SA');
  };

  // حساب الإحصائيات
  // تصفية المسيرات حسب الفترة الزمنية
  const filteredPayrolls = payrolls?.filter(p => {
    if (!filterDateFrom && !filterDateTo) return true;
    const payrollDate = new Date(p.year, p.month - 1, 1);
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      if (payrollDate < fromDate) return false;
    }
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      if (payrollDate > toDate) return false;
    }
    return true;
  });

  const stats = {
    total: filteredPayrolls?.length || 0,
    draft: filteredPayrolls?.filter(p => p.status === 'draft').length || 0,
    pending: filteredPayrolls?.filter(p => p.status === 'pending').length || 0,
    approved: filteredPayrolls?.filter(p => p.status === 'approved').length || 0,
    paid: filteredPayrolls?.filter(p => p.status === 'paid').length || 0,
    totalAmount: filteredPayrolls?.reduce((sum, p) => sum + parseFloat(p.totalNetSalary), 0) || 0,
  };

  // هل الفلتر مفعل؟
  const isFiltered = filterDateFrom || filterDateTo;

  // حساب إجماليات النموذج
  const formTotals = employeesData.reduce((acc, emp) => ({
    totalBaseSalary: acc.totalBaseSalary + emp.baseSalary,
    totalOvertime: acc.totalOvertime + emp.overtimeAmount,
    totalIncentives: acc.totalIncentives + emp.incentiveAmount,
    totalDeductions: acc.totalDeductions + emp.totalDeductions,
    totalNetSalary: acc.totalNetSalary + emp.netSalary,
  }), {
    totalBaseSalary: 0,
    totalOvertime: 0,
    totalIncentives: 0,
    totalDeductions: 0,
    totalNetSalary: 0,
  });

  // التحقق من صلاحية الموافقة
  const canApprove = user?.role === 'admin' || user?.role === 'supervisor';

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* العنوان والإجراءات */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">مسيرات الرواتب</h1>
            <p className="text-sm text-muted-foreground">إدارة وإنشاء مسيرات رواتب الموظفين</p>
          </div>
          <Dialog open={isGenerateOpen} onOpenChange={(open) => {
            setIsGenerateOpen(open);
            if (!open) {
              setStep('select');
              setEmployeesData([]);
              setSelectedBranch(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="ml-2 h-4 w-4" />
                إنشاء مسيرة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className={step === 'form' ? "max-w-6xl max-h-[90vh] overflow-y-auto" : "sm:max-w-md"}>
              <DialogHeader>
                <DialogTitle>
                  {step === 'select' ? 'إنشاء مسيرة رواتب جديدة' : `مسيرة رواتب ${arabicMonths[selectedMonth - 1]} ${selectedYear}`}
                </DialogTitle>
              </DialogHeader>
              
              {step === 'select' ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الفرع</label>
                    <Select
                      value={selectedBranch?.toString() || ""}
                      onValueChange={(v) => setSelectedBranch(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch) => {
                          const hasPayroll = payrolls?.some(
                            (p: any) => p.branchId === branch.id && p.year === selectedYear && p.month === selectedMonth
                          );
                          return (
                            <SelectItem 
                              key={branch.id} 
                              value={branch.id.toString()}
                              disabled={hasPayroll}
                            >
                              {branch.nameAr || branch.name}
                              {hasPayroll && " (توجد مسيرة)"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">السنة</label>
                      <Select
                        value={selectedYear.toString()}
                        onValueChange={(v) => setSelectedYear(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">الشهر</label>
                      <Select
                        value={selectedMonth.toString()}
                        onValueChange={(v) => setSelectedMonth(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {arabicMonths.map((month, index) => (
                            <SelectItem key={index} value={(index + 1).toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!selectedBranch) {
                        toast.error("يرجى اختيار الفرع");
                        return;
                      }
                      // التحقق من عدم وجود مسيرة لهذا الفرع والشهر
                      const existingPayroll = payrolls?.find(
                        (p: any) => p.branchId === selectedBranch && p.year === selectedYear && p.month === selectedMonth
                      );
                      if (existingPayroll) {
                        toast.error(`توجد مسيرة رواتب لهذا الفرع في ${arabicMonths[selectedMonth - 1]} ${selectedYear}`);
                        return;
                      }
                      setStep('form');
                    }}
                  >
                    <Users className="ml-2 h-4 w-4" />
                    عرض الموظفين
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* معلومات المسيرة */}
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span><strong>الفرع:</strong> {branches?.find(b => b.id === selectedBranch)?.nameAr}</span>
                      <span><strong>الشهر:</strong> {arabicMonths[selectedMonth - 1]} {selectedYear}</span>
                      <span><strong>عدد الموظفين:</strong> {employeesData.length}</span>
                    </div>
                  </div>

                  {/* جدول الموظفين */}
                  {employeesData.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="text-center w-8">#</TableHead>
                            <TableHead className="min-w-[120px]">الموظف</TableHead>
                            <TableHead className="text-center w-20">الأساسي</TableHead>
                            <TableHead className="text-center w-20">ساعات إضافية</TableHead>
                            <TableHead className="text-center w-16">أيام العمل</TableHead>
                            <TableHead className="text-center w-20">خصم الغياب</TableHead>
                            <TableHead className="text-center w-20">الحوافز</TableHead>
                            <TableHead className="text-center w-20">الخصومات</TableHead>
                            <TableHead className="text-center w-20">السلف</TableHead>
                            <TableHead className="text-center w-24">المتبقي</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeesData.map((emp, index) => (
                            <TableRow key={emp.employeeId} className="text-xs">
                              <TableCell className="text-center">{index + 1}</TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{emp.employeeName}</div>
                                  <div className="text-muted-foreground text-[10px]">{emp.employeeCode}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium text-green-500">
                                {formatAmount(emp.baseSalary)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Checkbox
                                    checked={emp.overtimeEnabled}
                                    onCheckedChange={(checked) => updateEmployeeData(index, 'overtimeEnabled', checked)}
                                  />
                                  {emp.overtimeEnabled && (
                                    <span className="text-blue-500 text-[10px]">+{OVERTIME_AMOUNT}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  max="30"
                                  value={emp.workDays}
                                  onChange={(e) => updateEmployeeData(index, 'workDays', parseInt(e.target.value) || 0)}
                                  className="w-14 h-7 text-center text-xs p-1"
                                />
                              </TableCell>
                              <TableCell className="text-center text-red-500">
                                {emp.absentDeduction > 0 ? `-${formatAmount(emp.absentDeduction)}` : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  value={emp.incentiveAmount}
                                  onChange={(e) => updateEmployeeData(index, 'incentiveAmount', parseFloat(e.target.value) || 0)}
                                  className="w-16 h-7 text-center text-xs p-1"
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  value={emp.deductionAmount}
                                  onChange={(e) => updateEmployeeData(index, 'deductionAmount', parseFloat(e.target.value) || 0)}
                                  className="w-16 h-7 text-center text-xs p-1"
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  value={emp.advanceDeduction}
                                  onChange={(e) => updateEmployeeData(index, 'advanceDeduction', parseFloat(e.target.value) || 0)}
                                  className="w-16 h-7 text-center text-xs p-1"
                                />
                              </TableCell>
                              <TableCell className="text-center font-bold text-green-500">
                                {formatAmount(emp.netSalary)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>جاري تحميل بيانات الموظفين...</p>
                    </div>
                  )}

                  {/* ملخص الإجماليات */}
                  {employeesData.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs">إجمالي الأساسي</div>
                          <div className="font-bold">{formatAmount(formTotals.totalBaseSalary)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs">إجمالي الإضافي</div>
                          <div className="font-bold text-blue-500">{formatAmount(formTotals.totalOvertime)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs">إجمالي الحوافز</div>
                          <div className="font-bold text-green-500">{formatAmount(formTotals.totalIncentives)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs">إجمالي الخصومات</div>
                          <div className="font-bold text-red-500">{formatAmount(formTotals.totalDeductions)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs">صافي المسيرة</div>
                          <div className="font-bold text-xl text-green-500">{formatAmount(formTotals.totalNetSalary)} ر.س</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* أزرار الإجراءات */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setStep('select')}
                      className="flex-1"
                    >
                      رجوع
                    </Button>
                    <Button
                      onClick={handleCreatePayroll}
                      disabled={createPayrollMutation.isPending || employeesData.length === 0}
                      className="flex-1"
                    >
                      {createPayrollMutation.isPending ? (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="ml-2 h-4 w-4" />
                      )}
                      إرسال للمراجعة
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* الإحصائيات */}
        {isFiltered && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-400">
                الإحصائيات للفترة: {filterDateFrom || 'البداية'} - {filterDateTo || 'النهاية'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              عرض الكل
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <FileText className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الإجمالي</p>
                  <p className="text-lg font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-500/20 rounded-lg">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">مسودات</p>
                  <p className="text-lg font-bold">{stats.draft}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                  <Clock className="h-4 w-4 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تحت الإجراء</p>
                  <p className="text-lg font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-500/20 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">معتمدة</p>
                  <p className="text-lg font-bold">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <DollarSign className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">مدفوعة</p>
                  <p className="text-lg font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                  <DollarSign className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المبالغ</p>
                  <p className="text-sm font-bold">{formatAmount(stats.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* فلتر الفترة الزمنية */}
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">الفترة الزمنية:</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">من:</span>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-[140px] h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">إلى:</span>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-[140px] h-8 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  className="h-8"
                >
                  إعادة تعيين
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* جدول المسيرات */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              قائمة مسيرات الرواتب
              {(filterDateFrom || filterDateTo) && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({filteredPayrolls?.length || 0} مسيرة)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPayrolls && filteredPayrolls.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>رقم المسيرة</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>الشهر</TableHead>
                      <TableHead className="text-center">الموظفين</TableHead>
                      <TableHead>صافي المسيرة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayrolls?.map((payroll) => (
                      <TableRow key={payroll.id} className="text-sm">
                        <TableCell className="font-medium">{payroll.payrollNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{payroll.branchName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {arabicMonths[payroll.month - 1]} {payroll.year}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {payroll.employeeCount}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-green-500">
                          {formatAmount(payroll.totalNetSalary)} ر.س
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColors[payroll.status]}`}>
                            {statusNames[payroll.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(payroll.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setSelectedPayroll(payroll.id);
                                setIsDetailsOpen(true);
                              }}
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {/* أزرار الطباعة والتصدير - فقط للمعتمدة والمدفوعة */}
                            {(payroll.status === 'approved' || payroll.status === 'paid') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handlePrint(payroll.id)}
                                  title="طباعة"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleExportPDF(payroll.id)}
                                  title="تصدير PDF"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {/* إرسال للمراجعة - للمسودات */}
                            {payroll.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'pending' })}
                                title="إرسال للمراجعة"
                              >
                                <Send className="h-3.5 w-3.5 text-yellow-500" />
                              </Button>
                            )}
                            {/* الموافقة/الرفض - للمشرف العام والأدمن فقط */}
                            {payroll.status === 'pending' && canApprove && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'approved' })}
                                  title="اعتماد"
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'cancelled' })}
                                  title="رفض"
                                >
                                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </>
                            )}
                            {/* تحت الإجراء - رسالة للمستخدم العادي */}
                            {payroll.status === 'pending' && !canApprove && (
                              <span className="text-xs text-yellow-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                بانتظار الموافقة
                              </span>
                            )}
                            {/* تأكيد الدفع - للمعتمدة */}
                            {payroll.status === 'approved' && canApprove && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'paid' })}
                                title="تأكيد الدفع"
                              >
                                <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                            )}
                            {/* حذف - للأدمن فقط */}
                            {user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذه المسيرة؟')) {
                                    deleteMutation.mutate({ id: payroll.id });
                                  }
                                }}
                                title="حذف"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">لا توجد مسيرات رواتب</p>
                <p className="text-xs">قم بإنشاء مسيرة جديدة للبدء</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة تفاصيل المسيرة */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل مسيرة الرواتب</DialogTitle>
            </DialogHeader>
            {payrollDetails && payrollDetails.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="text-center">#</TableHead>
                        <TableHead>الموظف</TableHead>
                        <TableHead className="text-center">الأساسي</TableHead>
                        <TableHead className="text-center">إضافي</TableHead>
                        <TableHead className="text-center">أيام العمل</TableHead>
                        <TableHead className="text-center">خصم غياب</TableHead>
                        <TableHead className="text-center">حوافز</TableHead>
                        <TableHead className="text-center">خصومات</TableHead>
                        <TableHead className="text-center">سلف</TableHead>
                        <TableHead className="text-center">إجازات</TableHead>
                        <TableHead className="text-center">الصافي</TableHead>
                        <TableHead className="text-center">طباعة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollDetails.map((detail, index) => (
                        <TableRow key={detail.id} className="text-xs">
                          <TableCell className="text-center">{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{detail.employeeName}</div>
                              <div className="text-muted-foreground text-[10px]">{detail.employeeCode}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{formatAmount(detail.baseSalary)}</TableCell>
                          <TableCell className="text-center text-blue-500">
                            {parseFloat(detail.overtimeAmount) > 0 ? formatAmount(detail.overtimeAmount) : '-'}
                          </TableCell>
                          <TableCell className="text-center">{(detail as any).workDays || 30}</TableCell>
                          <TableCell className="text-center text-red-500">
                            {parseFloat((detail as any).absentDeduction || '0') > 0 ? `-${formatAmount((detail as any).absentDeduction)}` : '-'}
                          </TableCell>
                          <TableCell className="text-center text-green-500">
                            {parseFloat(detail.incentiveAmount) > 0 ? formatAmount(detail.incentiveAmount) : '-'}
                          </TableCell>
                          <TableCell className="text-center text-red-500">
                            {parseFloat(detail.deductionAmount) > 0 ? `-${formatAmount(detail.deductionAmount)}` : '-'}
                          </TableCell>
                          <TableCell className="text-center text-red-500">
                            {parseFloat(detail.advanceDeduction) > 0 ? `-${formatAmount(detail.advanceDeduction)}` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {(detail as any).leaveDays > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="text-orange-500 font-medium">{(detail as any).leaveDays} يوم</span>
                                <span className="text-red-500 text-[10px]">-{formatAmount((detail as any).leaveDeduction || '0')}</span>
                                {(detail as any).leaveType && (
                                  <span className="text-muted-foreground text-[9px]">{(detail as any).leaveType}</span>
                                )}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-500">
                            {formatAmount(detail.netSalary)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                const currentPayroll = payrolls?.find(p => p.id === selectedPayroll);
                                if (currentPayroll) {
                                  handlePrintPayslip(detail, currentPayroll);
                                }
                              }}
                              title="طباعة قسيمة الراتب"
                            >
                              <Printer className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* إجماليات التفاصيل */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">إجمالي الأساسي</div>
                      <div className="font-bold">{formatAmount(payrollDetails.reduce((sum, d) => sum + parseFloat(d.baseSalary), 0))}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">إجمالي الإضافي</div>
                      <div className="font-bold text-blue-500">{formatAmount(payrollDetails.reduce((sum, d) => sum + parseFloat(d.overtimeAmount), 0))}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">إجمالي الخصومات</div>
                      <div className="font-bold text-red-500">{formatAmount(payrollDetails.reduce((sum, d) => sum + parseFloat(d.totalDeductions), 0))}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">خصم الإجازات</div>
                      <div className="font-bold text-orange-500">{formatAmount(payrollDetails.reduce((sum, d) => sum + parseFloat((d as any).leaveDeduction || '0'), 0))}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">صافي المسيرة</div>
                      <div className="font-bold text-xl text-green-500">{formatAmount(payrollDetails.reduce((sum, d) => sum + parseFloat(d.netSalary), 0))} ر.س</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>جاري تحميل التفاصيل...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
