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

  // تهيئة بيانات الموظفين عند تحميلهم
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
        const advanceDeduction = 0;
        const grossSalary = baseSalary;
        const totalDeductions = 0;
        const netSalary = baseSalary;

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
  }, [branchEmployees]);

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
  const handlePrint = (payrollId: number) => {
    window.open(`/api/payroll/print/${payrollId}`, '_blank');
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
  const stats = {
    total: payrolls?.length || 0,
    draft: payrolls?.filter(p => p.status === 'draft').length || 0,
    pending: payrolls?.filter(p => p.status === 'pending').length || 0,
    approved: payrolls?.filter(p => p.status === 'approved').length || 0,
    paid: payrolls?.filter(p => p.status === 'paid').length || 0,
    totalAmount: payrolls?.reduce((sum, p) => sum + parseFloat(p.totalNetSalary), 0) || 0,
  };

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

        {/* جدول المسيرات */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              قائمة مسيرات الرواتب
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : payrolls && payrolls.length > 0 ? (
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
                    {payrolls.map((payroll) => (
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
                        <TableHead className="text-center">الصافي</TableHead>
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
                          <TableCell className="text-center font-bold text-green-500">
                            {formatAmount(detail.netSalary)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* إجماليات التفاصيل */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
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
