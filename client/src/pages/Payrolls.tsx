import { useState, useMemo, Fragment } from "react";
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
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Printer,
  DollarSign,
  Users,
  Calendar,
  Building2,
  Send,
  Clock,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronLeft,
  RefreshCw,
  Pencil,
  RotateCcw,
  FileDown,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  calculatePayrollLine,
  sumPayrollTotals,
  isPayrollEditable,
  parseLinkedItems,
  parseJsonArray,
  LEAVE_KIND_LABELS,
  type PayrollLineResult,
  type PayrollLeaveItem,
  type PayrollAdvanceItem,
  type PayrollViolationItem,
} from "@shared/payroll";
import {
  buildPayrollSheetHtml,
  buildPayslipDocumentHtml,
  openPrintWindow,
  writeAndPrint,
  writePrintDocument,
  writePrintLoading,
} from "@/lib/payrollPrint";
import { downloadBase64Pdf } from "@/lib/downloadPdf";

// أسماء الأشهر بالعربية
const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

// أسماء الحالات
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

// المدخلات اليدوية لكل موظف في نموذج الإنشاء
interface LineInputs {
  overtimeEnabled: boolean;
  workDays: number;
  incentiveAmount: number;
  otherDeduction: number;
  otherDeductionReason: string | null;
  deferredAdvanceIds: number[];
  deferredViolationIds: number[];
}

type PreviewLine = {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  position: string | null;
  isSupervisor: boolean;
  overtimeRate: number;
  inputs: LineInputs & { notes: string | null };
  advances: Array<PayrollAdvanceItem & { deferred: boolean }>;
  violations: Array<PayrollViolationItem & { deferred: boolean }>;
  leaves: Array<{ requestId: number; kind: keyof typeof LEAVE_KIND_LABELS; type: string; days: number; startDate: string; endDate: string }>;
  negativeInvoices: Array<{ id: number; invoiceNumber: string; amount: number; reason: string | null; invoiceDate: string }>;
  calc: PayrollLineResult;
};

/** نفس معادلة الخادم لحساب السطر فوراً أثناء التعديل */
function recomputeLine(line: PreviewLine, inputs: LineInputs): PayrollLineResult {
  const deferredAdv = new Set(inputs.deferredAdvanceIds);
  const deferredVio = new Set(inputs.deferredViolationIds);
  return calculatePayrollLine({
    baseSalary: line.calc.baseSalary,
    overtimeEnabled: inputs.overtimeEnabled,
    overtimeRate: line.overtimeRate,
    workDays: inputs.workDays,
    incentiveAmount: inputs.incentiveAmount,
    otherDeduction: inputs.otherDeduction,
    advanceDeduction: line.advances.filter(a => !deferredAdv.has(a.id)).reduce((s, a) => s + a.amount, 0),
    violationsDeduction: line.violations.filter(v => !deferredVio.has(v.id)).reduce((s, v) => s + v.amount, 0),
    negativeInvoicesDeduction: line.negativeInvoices.reduce((s, i) => s + i.amount, 0),
    leaves: line.leaves.map(l => ({ type: l.kind, days: l.days })),
  });
}

const toggleId = (list: number[], id: number) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

/** البنود المخصومة والمؤجلة معاً (لعرضها في نافذة التعديل) */
function allLinked<T extends { id: number }>(raw: string | null | undefined): T[] {
  const parsed = parseLinkedItems<T>(raw);
  const seen = new Set(parsed.items.map(i => i.id));
  return [...parsed.items, ...parsed.deferredItems.filter(i => !seen.has(i.id))];
}

export default function Payrolls() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const currentYear = new Date().getFullYear();
  const [pickedBranch, setSelectedBranch] = useState<number | null>(null);
  // مشرف الفرع يعمل على فرعه فقط
  const supervisorBranchId = user?.role === 'supervisor' && user?.branchId ? user.branchId : null;
  const selectedBranch = supervisorBranchId ?? pickedBranch;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'form'>('select');
  const [inputsByEmployee, setInputsByEmployee] = useState<Record<number, LineInputs>>({});
  const [expandedEmployee, setExpandedEmployee] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<any | null>(null);
  const [editInputs, setEditInputs] = useState<(LineInputs & { notes: string | null }) | null>(null);

  const role = user?.role;
  const isManager = role === 'admin' || role === 'manager';
  const canEdit = isManager || role === 'supervisor';

  // جلب البيانات
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: payrolls, isLoading, refetch } = trpc.payrolls.list.useQuery();
  const { data: payrollDetails, refetch: refetchDetails } = trpc.payrolls.details.useQuery(
    { payrollId: selectedPayroll! },
    { enabled: !!selectedPayroll }
  );

  // المعاينة محسوبة في الخادم (الإعدادات + السلف + المخالفات + الإجازات + الفواتير السالبة)
  const previewQuery = trpc.payrolls.preview.useQuery(
    { branchId: selectedBranch!, year: selectedYear, month: selectedMonth },
    { enabled: !!selectedBranch && step === 'form', refetchOnWindowFocus: false, staleTime: 60_000 }
  );
  const previewLines = (previewQuery.data?.lines ?? []) as PreviewLine[];

  const getInputs = (line: PreviewLine): LineInputs => inputsByEmployee[line.employeeId] ?? {
    overtimeEnabled: line.inputs.overtimeEnabled,
    workDays: line.inputs.workDays,
    incentiveAmount: line.inputs.incentiveAmount,
    otherDeduction: line.inputs.otherDeduction,
    otherDeductionReason: line.inputs.otherDeductionReason,
    deferredAdvanceIds: line.inputs.deferredAdvanceIds,
    deferredViolationIds: line.inputs.deferredViolationIds,
  };

  const updateInputs = (line: PreviewLine, patch: Partial<LineInputs>) => {
    setInputsByEmployee(prev => ({ ...prev, [line.employeeId]: { ...getInputs(line), ...patch } }));
  };

  const formRows = useMemo(
    () => previewLines.map(line => {
      const inputs = getInputs(line);
      return { line, inputs, calc: recomputeLine(line, inputs) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewLines, inputsByEmployee]
  );
  const formTotals = sumPayrollTotals(formRows.map(r => r.calc));

  const resetForm = () => {
    setStep('select');
    setInputsByEmployee({});
    setExpandedEmployee(null);
    setSelectedBranch(null);
  };

  // Mutations
  const createPayrollMutation = trpc.payrolls.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsGenerateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const updateStatusMutation = trpc.payrolls.updateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void utils.payrolls.list.invalidate();
      void utils.payrolls.details.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message);
      // رفض الاعتماد لتغير الأرقام (CONFLICT) يأتي بعد إعادة احتساب المسير؛
      // نعرض الأرقام الجديدة حتى لا يُعتمد المسير بأرقام لم يرها المدير
      void utils.payrolls.list.invalidate();
      void utils.payrolls.details.invalidate();
    },
  });

  const deleteMutation = trpc.payrolls.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const recalculateMutation = trpc.payrolls.recalculate.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
      refetchDetails();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const updateLineMutation = trpc.payrolls.updateLine.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setEditingDetail(null);
      setEditInputs(null);
      refetch();
      refetchDetails();
    },
    onError: (error: any) => toast.error(error.message),
  });

  // إنشاء مسيرة رواتب: إرسال المدخلات اليدوية فقط والخادم يحسب كل المبالغ
  const handleCreatePayroll = () => {
    if (!selectedBranch) {
      toast.error("يرجى اختيار الفرع");
      return;
    }
    if (formRows.length === 0) {
      toast.error("لا يوجد موظفين نشطين في هذا الفرع");
      return;
    }
    const missingReason = formRows.find(r => r.inputs.otherDeduction > 0 && !r.inputs.otherDeductionReason?.trim());
    if (missingReason) {
      toast.error(`يرجى كتابة سبب الخصم للموظف ${missingReason.line.employeeName}`);
      setExpandedEmployee(missingReason.line.employeeId);
      return;
    }
    createPayrollMutation.mutate({
      branchId: selectedBranch,
      year: selectedYear,
      month: selectedMonth,
      adjustments: formRows.map(({ line, inputs }) => ({ employeeId: line.employeeId, ...inputs })),
    });
  };

  // طباعة المسيرة الكاملة
  const handlePrint = async (payrollId: number) => {
    const payroll = payrolls?.find(p => p.id === payrollId);
    if (!payroll) {
      toast.error("لم يتم العثور على المسيرة");
      return;
    }
    // فتح النافذة مباشرة من حدث النقر لتجنب حظر النوافذ المنبثقة
    const win = openPrintWindow();
    if (!win) {
      toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }
    try {
      const details = await utils.payrolls.details.fetch({ payrollId });
      if (!details || details.length === 0) {
        win.close();
        toast.error("لا توجد تفاصيل لهذه المسيرة");
        return;
      }
      writeAndPrint(win, buildPayrollSheetHtml(payroll, details));
    } catch (error: any) {
      win.close();
      toast.error(error?.message || "حدث خطأ أثناء الطباعة");
    }
  };

  // طباعة مسيرة راتب فردية للموظف: بيانات الخادم (ملف الموظف + لقطة المسيرة) بنفس قالب PDF الرسمي
  const handlePrintPayslip = async (detail: any, payroll: any) => {
    // فتح النافذة مباشرة من حدث النقر لتجنب حظر النوافذ المنبثقة
    const win = openPrintWindow();
    if (!win) {
      toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }
    writePrintLoading(win);
    try {
      const data = await utils.payrolls.payslipDocument.fetch({ payrollId: payroll.id, employeeId: detail.employeeId });
      writePrintDocument(win, buildPayslipDocumentHtml(data));
    } catch (error: any) {
      win.close();
      toast.error(error?.message || "تعذر تجهيز مسيرة راتب الموظف للطباعة");
    }
  };

  // تحميل مسيرة راتب الموظف PDF (مولّدة في الخادم)
  const payslipPdfMutation = trpc.payrolls.payslipPdf.useMutation();
  const payslipPdfPendingFor = payslipPdfMutation.isPending ? payslipPdfMutation.variables?.employeeId ?? null : null;
  const handleDownloadPayslipPdf = async (detail: any, payroll: any) => {
    const toastId = `payslip-pdf-${payroll.id}-${detail.employeeId}`;
    try {
      toast.loading("جاري توليد ملف PDF...", { id: toastId });
      const result = await payslipPdfMutation.mutateAsync({ payrollId: payroll.id, employeeId: detail.employeeId });
      downloadBase64Pdf(result.pdf, result.filename);
      toast.success("تم تحميل مسيرة راتب الموظف", { id: toastId });
    } catch (error: any) {
      toast.error(error?.message || "فشل توليد ملف PDF", { id: toastId });
    }
  };

  const openEditDetail = (detail: any) => {
    setEditingDetail(detail);
    setEditInputs({
      overtimeEnabled: !!detail.overtimeEnabled,
      workDays: detail.workDays ?? 30,
      incentiveAmount: parseFloat(detail.incentiveAmount || '0'),
      otherDeduction: parseFloat(detail.deductionAmount || '0'),
      otherDeductionReason: detail.deductionReason ?? null,
      deferredAdvanceIds: parseLinkedItems<PayrollAdvanceItem>(detail.advanceDetails).deferredIds,
      deferredViolationIds: parseLinkedItems<PayrollViolationItem>(detail.violationsDetails).deferredIds,
      notes: detail.notes ?? null,
    });
  };

  const saveEditDetail = () => {
    if (!editingDetail || !editInputs) return;
    if (editInputs.otherDeduction > 0 && !editInputs.otherDeductionReason?.trim()) {
      toast.error("يرجى كتابة سبب الخصومات الأخرى");
      return;
    }
    updateLineMutation.mutate({ detailId: editingDetail.id, ...editInputs });
  };

  // تنسيق المبلغ
  const formatAmount = (amount: string | number | null | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    return (Number.isFinite(num) ? num : 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const deduction = (amount: string | number | null | undefined) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    return num && num > 0 ? `-${formatAmount(num)}` : '-';
  };

  // تنسيق التاريخ
  const formatDate = (date: Date | string) => new Date(date).toLocaleDateString('ar-SA');

  // تصفية المسيرات حسب الفترة الزمنية
  // المقارنة بالسنة والشهر فقط (تجنب انزياح المنطقة الزمنية عند تحويل "YYYY-MM-DD" إلى تاريخ)
  const monthKey = (value: string) => {
    const [y, m] = value.split('-').map(Number);
    return y * 100 + m;
  };
  const filteredPayrolls = payrolls?.filter(p => {
    if (!filterDateFrom && !filterDateTo) return true;
    const key = p.year * 100 + p.month;
    if (filterDateFrom && key < monthKey(filterDateFrom)) return false;
    if (filterDateTo && key > monthKey(filterDateTo)) return false;
    return true;
  });

  const stats = {
    total: filteredPayrolls?.length || 0,
    draft: filteredPayrolls?.filter(p => p.status === 'draft').length || 0,
    pending: filteredPayrolls?.filter(p => p.status === 'pending').length || 0,
    approved: filteredPayrolls?.filter(p => p.status === 'approved').length || 0,
    paid: filteredPayrolls?.filter(p => p.status === 'paid').length || 0,
    // المبالغ للمسيرات المعتمدة والمدفوعة فقط
    totalAmount: filteredPayrolls
      ?.filter(p => p.status === 'approved' || p.status === 'paid')
      .reduce((sum, p) => sum + parseFloat(p.totalNetSalary), 0) || 0,
  };

  const isFiltered = filterDateFrom || filterDateTo;
  const currentPayroll = payrolls?.find(p => p.id === selectedPayroll);
  const currentEditable = !!currentPayroll && isPayrollEditable(currentPayroll.status) && canEdit;
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const editPreview = editingDetail && editInputs ? calculatePayrollLine({
    baseSalary: parseFloat(editingDetail.baseSalary || '0'),
    overtimeEnabled: editInputs.overtimeEnabled,
    // عند تفعيل الإضافي من التعديل يُعتمد المبلغ النهائي من إعدادات الموظف في الخادم
    overtimeRate: parseFloat(editingDetail.overtimeAmount || '0') > 0 ? parseFloat(editingDetail.overtimeAmount) : 1000,
    workDays: editInputs.workDays,
    incentiveAmount: editInputs.incentiveAmount,
    otherDeduction: editInputs.otherDeduction,
    advanceDeduction: allLinked<PayrollAdvanceItem>(editingDetail.advanceDetails)
      .filter(a => !editInputs.deferredAdvanceIds.includes(a.id)).reduce((s, a) => s + a.amount, 0),
    violationsDeduction: allLinked<PayrollViolationItem>(editingDetail.violationsDetails)
      .filter(v => !editInputs.deferredViolationIds.includes(v.id)).reduce((s, v) => s + v.amount, 0),
    negativeInvoicesDeduction: parseFloat(editingDetail.negativeInvoicesDeduction || '0'),
    leaves: parseJsonArray<PayrollLeaveItem>(editingDetail.leaveDetails).map(l => ({ type: l.kind, days: l.days })),
  }) : null;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* العنوان والإجراءات */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">مسيرات الرواتب</h1>
            <p className="text-sm text-muted-foreground">
              تُحسب الرواتب تلقائياً: الساعات الإضافية، السلف المعتمدة، المخالفات، الإجازات، والفواتير السالبة
            </p>
          </div>
          {canEdit && (
            <Dialog open={isGenerateOpen} onOpenChange={(open) => {
              setIsGenerateOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="ml-2 h-4 w-4" />
                  إنشاء مسيرة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className={step === 'form' ? "max-w-7xl max-h-[92vh] overflow-y-auto" : "sm:max-w-md"}>
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
                        disabled={!!supervisorBranchId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفرع" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches?.map((branch) => {
                            const hasPayroll = payrolls?.some(
                              (p: any) => p.branchId === branch.id && p.year === selectedYear && p.month === selectedMonth && p.status !== 'cancelled'
                            );
                            return (
                              <SelectItem key={branch.id} value={branch.id.toString()} disabled={hasPayroll}>
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
                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((year) => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">الشهر</label>
                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {arabicMonths.map((month, index) => (
                              <SelectItem key={index} value={(index + 1).toString()}>{month}</SelectItem>
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
                        const existingPayroll = payrolls?.find(
                          (p: any) => p.branchId === selectedBranch && p.year === selectedYear && p.month === selectedMonth && p.status !== 'cancelled'
                        );
                        if (existingPayroll) {
                          toast.error(`توجد مسيرة رواتب لهذا الفرع في ${arabicMonths[selectedMonth - 1]} ${selectedYear}`);
                          return;
                        }
                        setInputsByEmployee({});
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
                        <span><strong>عدد الموظفين:</strong> {formRows.length}</span>
                        <span className="text-xs text-muted-foreground">
                          اضغط على اسم الموظف لعرض تفاصيل السلف والمخالفات والإجازات وتأجيل أي بند
                        </span>
                      </div>
                    </div>

                    {(previewQuery.data?.excludedEmployees?.length ?? 0) > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-500">
                        مستبعدون لوجودهم في مسيرة أخرى لنفس الشهر (منقولون بين الفروع):{' '}
                        {previewQuery.data!.excludedEmployees.map(e => `${e.employeeName} (${e.payrollNumber})`).join('، ')}
                      </div>
                    )}

                    {previewQuery.data?.existingPayroll && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        توجد مسيرة لهذا الشهر بالفعل: {previewQuery.data.existingPayroll.payrollNumber}
                      </div>
                    )}

                    {/* جدول الموظفين */}
                    {previewQuery.isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p>جاري احتساب الرواتب...</p>
                      </div>
                    ) : previewQuery.error ? (
                      <div className="text-center py-8 text-red-400 text-sm">{previewQuery.error.message}</div>
                    ) : formRows.length > 0 ? (
                      <div className="overflow-x-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-xs">
                              <TableHead className="text-center w-8">#</TableHead>
                              <TableHead className="min-w-[140px]">الموظف</TableHead>
                              <TableHead className="text-center">الأساسي</TableHead>
                              <TableHead className="text-center">ساعات إضافية</TableHead>
                              <TableHead className="text-center">الحوافز</TableHead>
                              <TableHead className="text-center" title="أيام الإجازة المعتمدة لا تُحتسب غياباً">أيام العمل</TableHead>
                              <TableHead className="text-center">الغياب</TableHead>
                              <TableHead className="text-center">الإجازات</TableHead>
                              <TableHead className="text-center">السلف</TableHead>
                              <TableHead className="text-center">المخالفات</TableHead>
                              <TableHead className="text-center">فواتير سالبة</TableHead>
                              <TableHead className="text-center">خصومات أخرى</TableHead>
                              <TableHead className="text-center">الصافي</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {formRows.map(({ line, inputs, calc }, index) => {
                              const expanded = expandedEmployee === line.employeeId;
                              return (
                                <Fragment key={line.employeeId}>
                                  <TableRow className="text-xs">
                                    <TableCell className="text-center">{index + 1}</TableCell>
                                    <TableCell>
                                      <button
                                        type="button"
                                        className="flex items-center gap-1 text-right"
                                        onClick={() => setExpandedEmployee(expanded ? null : line.employeeId)}
                                      >
                                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                                        <div>
                                          <div className="font-medium">{line.employeeName}</div>
                                          <div className="text-muted-foreground text-[10px]">{line.employeeCode}{line.isSupervisor ? ' - مشرف' : ''}</div>
                                        </div>
                                      </button>
                                    </TableCell>
                                    <TableCell className="text-center font-medium">{formatAmount(calc.baseSalary)}</TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Checkbox
                                          checked={inputs.overtimeEnabled}
                                          onCheckedChange={(checked) => updateInputs(line, { overtimeEnabled: checked === true })}
                                        />
                                        {inputs.overtimeEnabled && (
                                          <span className="text-blue-500 text-[10px]">+{formatAmount(line.overtimeRate)}</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={inputs.incentiveAmount}
                                        onChange={(e) => updateInputs(line, { incentiveAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                                        className="w-16 h-7 text-center text-xs p-1"
                                      />
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={inputs.workDays}
                                        onChange={(e) => updateInputs(line, { workDays: Math.min(30, Math.max(0, parseInt(e.target.value) || 0)) })}
                                        className="w-14 h-7 text-center text-xs p-1"
                                      />
                                    </TableCell>
                                    <TableCell className="text-center text-red-500">{deduction(calc.absentDeduction)}</TableCell>
                                    <TableCell className="text-center text-orange-500" title={line.leaves.map(l => `${LEAVE_KIND_LABELS[l.kind]}: ${l.days} يوم`).join(' | ')}>
                                      {calc.leaveDays > 0 ? (
                                        <div className="flex flex-col items-center">
                                          <span>{deduction(calc.leaveDeduction)}</span>
                                          <span className="text-[9px] text-muted-foreground">{calc.leaveDays} يوم</span>
                                        </div>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-red-500">
                                      {line.advances.length > 0 ? (
                                        <div className="flex flex-col items-center">
                                          <span>{deduction(calc.advanceDeduction)}</span>
                                          <span className="text-[9px] text-muted-foreground">{line.advances.length - inputs.deferredAdvanceIds.length} سلفة</span>
                                        </div>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-red-500">{deduction(calc.violationsDeduction)}</TableCell>
                                    <TableCell className="text-center text-red-500">{deduction(calc.negativeInvoicesDeduction)}</TableCell>
                                    <TableCell className="text-center">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={inputs.otherDeduction}
                                        onChange={(e) => {
                                          updateInputs(line, { otherDeduction: Math.max(0, parseFloat(e.target.value) || 0) });
                                          if ((parseFloat(e.target.value) || 0) > 0) setExpandedEmployee(line.employeeId);
                                        }}
                                        className="w-16 h-7 text-center text-xs p-1"
                                      />
                                    </TableCell>
                                    <TableCell className={`text-center font-bold ${calc.netSalary < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                      {formatAmount(calc.netSalary)}
                                    </TableCell>
                                  </TableRow>
                                  {expanded && (
                                    <TableRow className="bg-muted/30">
                                      <TableCell colSpan={13}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs p-2">
                                          <div>
                                            <div className="font-bold mb-1">السلف المعتمدة</div>
                                            {line.advances.length === 0 ? <div className="text-muted-foreground">لا توجد سلف</div> : line.advances.map(a => (
                                              <label key={a.id} className="flex items-center gap-2 py-0.5">
                                                <Checkbox
                                                  checked={!inputs.deferredAdvanceIds.includes(a.id)}
                                                  onCheckedChange={() => updateInputs(line, { deferredAdvanceIds: toggleId(inputs.deferredAdvanceIds, a.id) })}
                                                  disabled={!isManager}
                                                />
                                                <span>{a.title} — {formatAmount(a.amount)} ر.س</span>
                                                {inputs.deferredAdvanceIds.includes(a.id) && <Badge variant="outline" className="text-[9px]">مؤجلة</Badge>}
                                              </label>
                                            ))}
                                          </div>
                                          <div>
                                            <div className="font-bold mb-1">المخالفات المعتمدة</div>
                                            {line.violations.length === 0 ? <div className="text-muted-foreground">لا توجد مخالفات</div> : line.violations.map(v => (
                                              <label key={v.id} className="flex items-center gap-2 py-0.5">
                                                <Checkbox
                                                  checked={!inputs.deferredViolationIds.includes(v.id)}
                                                  onCheckedChange={() => updateInputs(line, { deferredViolationIds: toggleId(inputs.deferredViolationIds, v.id) })}
                                                  disabled={!isManager}
                                                />
                                                <span>{v.violationType} ({v.violationDate}) — {formatAmount(v.amount)} ر.س</span>
                                              </label>
                                            ))}
                                          </div>
                                          <div>
                                            <div className="font-bold mb-1">الإجازات والفواتير السالبة</div>
                                            {line.leaves.map(l => (
                                              <div key={l.requestId}>إجازة {LEAVE_KIND_LABELS[l.kind]}: {l.days} يوم ({l.startDate} → {l.endDate})</div>
                                            ))}
                                            {line.negativeInvoices.map(i => (
                                              <div key={i.id}>فاتورة {i.invoiceNumber}: {formatAmount(i.amount)} ر.س {i.reason ? `- ${i.reason}` : ''}</div>
                                            ))}
                                            {line.leaves.length === 0 && line.negativeInvoices.length === 0 && <div className="text-muted-foreground">لا يوجد</div>}
                                          </div>
                                          <div className="space-y-1">
                                            <div className="font-bold">سبب الخصومات الأخرى {inputs.otherDeduction > 0 && <span className="text-red-500">*</span>}</div>
                                            <Input
                                              value={inputs.otherDeductionReason ?? ''}
                                              placeholder="مثال: تلف أدوات"
                                              onChange={(e) => updateInputs(line, { otherDeductionReason: e.target.value })}
                                              className="h-7 text-xs"
                                            />
                                            <div className="text-muted-foreground">
                                              الإجمالي {formatAmount(calc.grossSalary)} − الخصومات {formatAmount(calc.totalDeductions)} = {formatAmount(calc.netSalary)}
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">لا يوجد موظفين نشطين في هذا الفرع</div>
                    )}

                    {/* ملخص الإجماليات */}
                    {formRows.length > 0 && (
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
                      <Button variant="outline" onClick={() => { setStep('select'); setInputsByEmployee({}); }} className="flex-1">
                        رجوع
                      </Button>
                      <Button
                        onClick={handleCreatePayroll}
                        disabled={createPayrollMutation.isPending || previewQuery.isFetching || formRows.length === 0 || !!previewQuery.data?.existingPayroll}
                        className="flex-1"
                      >
                        {createPayrollMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
                        إرسال للمراجعة
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
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
              onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              عرض الكل
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'الإجمالي', value: stats.total, icon: FileText, bg: 'bg-blue-500/20', fg: 'text-blue-400' },
            { label: 'مسودات', value: stats.draft, icon: Calendar, bg: 'bg-gray-500/20', fg: 'text-gray-400' },
            { label: 'تحت الإجراء', value: stats.pending, icon: Clock, bg: 'bg-yellow-500/20', fg: 'text-yellow-400' },
            { label: 'معتمدة', value: stats.approved, icon: CheckCircle, bg: 'bg-green-500/20', fg: 'text-green-400' },
            { label: 'مدفوعة', value: stats.paid, icon: DollarSign, bg: 'bg-blue-500/20', fg: 'text-blue-400' },
          ].map(({ label, value, icon: Icon, bg, fg }) => (
            <Card key={label} className="bg-card/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 ${bg} rounded-lg`}>
                    <Icon className={`h-4 w-4 ${fg}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                  <DollarSign className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المعتمد والمدفوع</p>
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
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px] h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">إلى:</span>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px] h-8 text-sm" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }} className="h-8">
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
              {isFiltered && (
                <span className="text-xs text-muted-foreground font-normal">({filteredPayrolls?.length || 0} مسيرة)</span>
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
                      <TableHead>الإضافي</TableHead>
                      <TableHead>الخصومات</TableHead>
                      <TableHead>صافي المسيرة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayrolls.map((payroll) => (
                      <TableRow key={payroll.id} className="text-sm">
                        <TableCell className="font-medium">{payroll.payrollNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{payroll.branchName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{arabicMonths[payroll.month - 1]} {payroll.year}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {payroll.employeeCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-blue-500">{formatAmount(payroll.totalOvertime)}</TableCell>
                        <TableCell className="text-xs text-red-500">{formatAmount(payroll.totalDeductions)}</TableCell>
                        <TableCell className="font-bold text-green-500">{formatAmount(payroll.totalNetSalary)} ر.س</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColors[payroll.status]}`}>{statusNames[payroll.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(payroll.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setSelectedPayroll(payroll.id); setIsDetailsOpen(true); }}
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {payroll.status !== 'cancelled' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrint(payroll.id)} title="طباعة المسيرة">
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {payroll.status === 'draft' && canEdit && (
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
                            {payroll.status === 'pending' && isManager && (
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
                                  onClick={() => {
                                    if (confirm('سيتم رفض المسيرة وتحرير السلف والمخالفات المرتبطة بها. متابعة؟')) {
                                      updateStatusMutation.mutate({ id: payroll.id, status: 'cancelled' });
                                    }
                                  }}
                                  title="رفض"
                                >
                                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </>
                            )}
                            {payroll.status === 'pending' && !isManager && (
                              <span className="text-xs text-yellow-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                بانتظار الاعتماد
                              </span>
                            )}
                            {payroll.status === 'approved' && isManager && (
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
                            {user?.role === 'admin' && payroll.status !== 'paid' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذه المسيرة؟ سيتم تحرير السلف والمخالفات المرتبطة بها.')) {
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
          <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                تفاصيل مسيرة الرواتب
                {currentPayroll && (
                  <>
                    <span className="text-sm text-muted-foreground">{currentPayroll.payrollNumber} — {currentPayroll.branchName} — {arabicMonths[currentPayroll.month - 1]} {currentPayroll.year}</span>
                    <Badge className={`text-xs ${statusColors[currentPayroll.status]}`}>{statusNames[currentPayroll.status]}</Badge>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            {currentEditable && (
              <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg p-2 text-xs">
                <span className="text-muted-foreground">
                  المسيرة مفتوحة: أي سلفة أو مخالفة أو إجازة تُعتمد الآن تُضاف تلقائياً. يمكنك أيضاً تعديل سطر أي موظف.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recalculateMutation.isPending}
                  onClick={() => currentPayroll && recalculateMutation.mutate({ id: currentPayroll.id })}
                >
                  {recalculateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <RefreshCw className="h-3 w-3 ml-1" />}
                  إعادة الحساب
                </Button>
              </div>
            )}
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
                        <TableHead className="text-center">حوافز</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                        <TableHead className="text-center">أيام العمل</TableHead>
                        <TableHead className="text-center">غياب</TableHead>
                        <TableHead className="text-center">إجازات</TableHead>
                        <TableHead className="text-center">سلف</TableHead>
                        <TableHead className="text-center">مخالفات</TableHead>
                        <TableHead className="text-center">فواتير سالبة</TableHead>
                        <TableHead className="text-center">أخرى</TableHead>
                        <TableHead className="text-center">الصافي</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollDetails.map((detail, index) => (
                        <TableRow key={detail.id} className="text-xs">
                          <TableCell className="text-center">{index + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{detail.employeeName}</div>
                            <div className="text-muted-foreground text-[10px]">{detail.employeeCode}</div>
                            {detail.notes && <div className="text-muted-foreground text-[10px]">{detail.notes}</div>}
                          </TableCell>
                          <TableCell className="text-center">{formatAmount(detail.baseSalary)}</TableCell>
                          <TableCell className="text-center text-blue-500">{parseFloat(detail.overtimeAmount) > 0 ? formatAmount(detail.overtimeAmount) : '-'}</TableCell>
                          <TableCell className="text-center text-green-500">{parseFloat(detail.incentiveAmount) > 0 ? formatAmount(detail.incentiveAmount) : '-'}</TableCell>
                          <TableCell className="text-center font-medium">{formatAmount(detail.grossSalary)}</TableCell>
                          <TableCell className="text-center">{detail.workDays}</TableCell>
                          <TableCell className="text-center text-red-500">{deduction(detail.absentDeduction)}</TableCell>
                          <TableCell className="text-center">
                            {detail.leaveDays > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="text-orange-500">{deduction(detail.leaveDeduction)}</span>
                                <span className="text-muted-foreground text-[9px]">{detail.leaveDays} يوم {detail.leaveType || ''}</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center text-red-500" title={parseLinkedItems<PayrollAdvanceItem>(detail.advanceDetails).items.map(a => `${a.title}: ${a.amount}`).join(' | ')}>
                            {deduction(detail.advanceDeduction)}
                          </TableCell>
                          <TableCell className="text-center text-red-500" title={parseLinkedItems<PayrollViolationItem>(detail.violationsDetails).items.map(v => `${v.violationType}: ${v.amount}`).join(' | ')}>
                            {deduction(detail.violationsDeduction)}
                          </TableCell>
                          <TableCell className="text-center text-orange-500">{deduction(detail.negativeInvoicesDeduction)}</TableCell>
                          <TableCell className="text-center text-red-500" title={detail.deductionReason || ''}>{deduction(detail.deductionAmount)}</TableCell>
                          <TableCell className={`text-center font-bold ${parseFloat(detail.netSalary) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatAmount(detail.netSalary)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              {currentEditable && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDetail(detail)} title="تعديل">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => currentPayroll && handlePrintPayslip(detail, currentPayroll)}
                                title="طباعة مسيرة راتب الموظف"
                              >
                                <Printer className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => currentPayroll && handleDownloadPayslipPdf(detail, currentPayroll)}
                                disabled={payslipPdfPendingFor === detail.employeeId}
                                title="تحميل مسيرة راتب الموظف PDF"
                                aria-label="تحميل مسيرة راتب الموظف PDF"
                              >
                                {payslipPdfPendingFor === detail.employeeId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileDown className="h-3.5 w-3.5 text-emerald-600" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* إجماليات التفاصيل - مطابقة لإجماليات المسيرة */}
                {currentPayroll && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                      <div className="text-center">
                        <div className="text-muted-foreground text-xs">إجمالي الأساسي</div>
                        <div className="font-bold">{formatAmount(currentPayroll.totalBaseSalary)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground text-xs">إجمالي الإضافي</div>
                        <div className="font-bold text-blue-500">{formatAmount(currentPayroll.totalOvertime)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground text-xs">إجمالي الحوافز</div>
                        <div className="font-bold text-green-500">{formatAmount(currentPayroll.totalIncentives)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground text-xs">إجمالي الخصومات</div>
                        <div className="font-bold text-red-500">{formatAmount(currentPayroll.totalDeductions)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground text-xs">صافي المسيرة</div>
                        <div className="font-bold text-xl text-green-500">{formatAmount(currentPayroll.totalNetSalary)} ر.س</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>جاري تحميل التفاصيل...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* نافذة تعديل سطر موظف */}
        <Dialog open={!!editingDetail} onOpenChange={(open) => { if (!open) { setEditingDetail(null); setEditInputs(null); } }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>تعديل راتب {editingDetail?.employeeName}</DialogTitle>
            </DialogHeader>
            {editingDetail && editInputs && (
              <div className="space-y-3 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={editInputs.overtimeEnabled}
                    onCheckedChange={(c) => setEditInputs({ ...editInputs, overtimeEnabled: c === true })}
                  />
                  ساعات إضافية (حسب إعدادات الموظف)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">أيام العمل (0-30)</label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      value={editInputs.workDays}
                      onChange={(e) => setEditInputs({ ...editInputs, workDays: Math.min(30, Math.max(0, parseInt(e.target.value) || 0)) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">الحوافز</label>
                    <Input
                      type="number"
                      min="0"
                      value={editInputs.incentiveAmount}
                      onChange={(e) => setEditInputs({ ...editInputs, incentiveAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">خصومات أخرى</label>
                    <Input
                      type="number"
                      min="0"
                      value={editInputs.otherDeduction}
                      onChange={(e) => setEditInputs({ ...editInputs, otherDeduction: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">سبب الخصم</label>
                    <Input
                      value={editInputs.otherDeductionReason ?? ''}
                      onChange={(e) => setEditInputs({ ...editInputs, otherDeductionReason: e.target.value })}
                    />
                  </div>
                </div>
                {isManager && allLinked<PayrollAdvanceItem>(editingDetail.advanceDetails).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold">السلف المخصومة (ألغِ التحديد لتأجيل السلفة لمسيرة لاحقة)</div>
                    {allLinked<PayrollAdvanceItem>(editingDetail.advanceDetails).map(a => (
                      <label key={a.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!editInputs.deferredAdvanceIds.includes(a.id)}
                          onCheckedChange={() => setEditInputs({ ...editInputs, deferredAdvanceIds: toggleId(editInputs.deferredAdvanceIds, a.id) })}
                        />
                        {a.title} — {formatAmount(a.amount)} ر.س
                      </label>
                    ))}
                  </div>
                )}
                {isManager && allLinked<PayrollViolationItem>(editingDetail.violationsDetails).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold">المخالفات المخصومة</div>
                    {allLinked<PayrollViolationItem>(editingDetail.violationsDetails).map(v => (
                      <label key={v.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!editInputs.deferredViolationIds.includes(v.id)}
                          onCheckedChange={() => setEditInputs({ ...editInputs, deferredViolationIds: toggleId(editInputs.deferredViolationIds, v.id) })}
                        />
                        {v.violationType} ({v.violationDate}) — {formatAmount(v.amount)} ر.س
                      </label>
                    ))}
                  </div>
                )}
                {isManager && (editInputs.deferredAdvanceIds.length > 0 || editInputs.deferredViolationIds.length > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditInputs({ ...editInputs, deferredAdvanceIds: [], deferredViolationIds: [] })}
                  >
                    <RotateCcw className="h-3 w-3 ml-1" />
                    إلغاء تأجيل جميع البنود المؤجلة
                  </Button>
                )}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">ملاحظات</label>
                  <Textarea
                    rows={2}
                    value={editInputs.notes ?? ''}
                    onChange={(e) => setEditInputs({ ...editInputs, notes: e.target.value })}
                  />
                </div>
                {editPreview && (
                  <div className="bg-muted/50 rounded p-2 text-xs">
                    الصافي المتوقع بعد التعديل: <b>{formatAmount(editPreview.netSalary)} ر.س</b>
                    <span className="text-muted-foreground"> (يُعتمد الرقم النهائي بعد الحفظ من الخادم)</span>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingDetail(null); setEditInputs(null); }}>إلغاء</Button>
              <Button onClick={saveEditDetail} disabled={updateLineMutation.isPending}>
                {updateLineMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                حفظ وإعادة الحساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
