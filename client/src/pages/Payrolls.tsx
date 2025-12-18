import { useState } from "react";
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
} from "lucide-react";

// أسماء الأشهر بالعربية
const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

// أسماء الحالات بالعربية
const statusNames: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  approved: "معتمدة",
  paid: "مدفوعة",
  cancelled: "ملغاة",
};

// ألوان الحالات
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  paid: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function Payrolls() {
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // جلب البيانات
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: payrolls, isLoading, refetch } = trpc.payrolls.list.useQuery();
  const { data: payrollDetails } = trpc.payrolls.details.useQuery(
    { payrollId: selectedPayroll! },
    { enabled: !!selectedPayroll }
  );

  // Mutations
  const generateMutation = trpc.payrolls.generate.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء مسيرة الرواتب بنجاح");
      setIsGenerateOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = trpc.payrolls.updateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.payrolls.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف مسيرة الرواتب بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // إنشاء مسيرة رواتب
  const handleGenerate = () => {
    if (!selectedBranch) {
      toast.error("يرجى اختيار الفرع");
      return;
    }
    const branch = branches?.find(b => b.id === selectedBranch);
    if (!branch) return;

    generateMutation.mutate({
      branchId: selectedBranch,
      branchName: branch.nameAr || branch.name,
      year: selectedYear,
      month: selectedMonth,
    });
  };

  // طباعة المسيرة
  const handlePrint = (payrollId: number) => {
    // فتح نافذة الطباعة
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
    approved: payrolls?.filter(p => p.status === 'approved').length || 0,
    paid: payrolls?.filter(p => p.status === 'paid').length || 0,
    totalAmount: payrolls?.reduce((sum, p) => sum + parseFloat(p.totalNetSalary), 0) || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان والإجراءات */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">مسيرات الرواتب</h1>
            <p className="text-muted-foreground">إدارة وإنشاء مسيرات رواتب الموظفين</p>
          </div>
          <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                إنشاء مسيرة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>إنشاء مسيرة رواتب جديدة</DialogTitle>
              </DialogHeader>
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
                      {branches?.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.nameAr || branch.name}
                        </SelectItem>
                      ))}
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
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="ml-2 h-4 w-4" />
                  )}
                  إنشاء المسيرة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المسيرات</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">مسودات</p>
                  <p className="text-2xl font-bold">{stats.draft}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">معتمدة</p>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">مدفوعة</p>
                  <p className="text-2xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المبالغ</p>
                  <p className="text-lg font-bold">{formatAmount(stats.totalAmount)} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* جدول المسيرات */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              قائمة مسيرات الرواتب
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : payrolls && payrolls.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم المسيرة</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>الشهر</TableHead>
                      <TableHead>عدد الموظفين</TableHead>
                      <TableHead>إجمالي الرواتب</TableHead>
                      <TableHead>صافي المسيرة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>تاريخ الإنشاء</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrolls.map((payroll) => (
                      <TableRow key={payroll.id}>
                        <TableCell className="font-medium">{payroll.payrollNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {payroll.branchName}
                          </div>
                        </TableCell>
                        <TableCell>
                          {arabicMonths[payroll.month - 1]} {payroll.year}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {payroll.employeeCount}
                          </div>
                        </TableCell>
                        <TableCell>{formatAmount(payroll.totalBaseSalary)} ر.س</TableCell>
                        <TableCell className="font-bold text-green-600">
                          {formatAmount(payroll.totalNetSalary)} ر.س
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[payroll.status]}>
                            {statusNames[payroll.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(payroll.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPayroll(payroll.id);
                                setIsDetailsOpen(true);
                              }}
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrint(payroll.id)}
                              title="طباعة"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExportPDF(payroll.id)}
                              title="تصدير PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {payroll.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'pending' })}
                                title="إرسال للمراجعة"
                              >
                                <CheckCircle className="h-4 w-4 text-yellow-600" />
                              </Button>
                            )}
                            {payroll.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'approved' })}
                                  title="اعتماد"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'cancelled' })}
                                  title="إلغاء"
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {payroll.status === 'approved' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateStatusMutation.mutate({ id: payroll.id, status: 'paid' })}
                                title="تأكيد الدفع"
                              >
                                <DollarSign className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {payroll.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذه المسيرة؟')) {
                                    deleteMutation.mutate({ id: payroll.id });
                                  }
                                }}
                                title="حذف"
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
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
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد مسيرات رواتب</p>
                <p className="text-sm">قم بإنشاء مسيرة جديدة للبدء</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة تفاصيل المسيرة */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل مسيرة الرواتب</DialogTitle>
            </DialogHeader>
            {payrollDetails && payrollDetails.length > 0 ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>اسم الموظف</TableHead>
                      <TableHead>الرمز</TableHead>
                      <TableHead>المنصب</TableHead>
                      <TableHead>الراتب الأساسي</TableHead>
                      <TableHead>ساعات إضافية</TableHead>
                      <TableHead>حوافز</TableHead>
                      <TableHead>خصومات</TableHead>
                      <TableHead>سلف</TableHead>
                      <TableHead>صافي الراتب</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollDetails.map((detail, index) => (
                      <TableRow key={detail.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{detail.employeeName}</TableCell>
                        <TableCell>{detail.employeeCode}</TableCell>
                        <TableCell>{detail.position || '-'}</TableCell>
                        <TableCell>{formatAmount(detail.baseSalary)}</TableCell>
                        <TableCell>{formatAmount(detail.overtimeAmount)}</TableCell>
                        <TableCell>{formatAmount(detail.incentiveAmount)}</TableCell>
                        <TableCell>{formatAmount(detail.deductionAmount)}</TableCell>
                        <TableCell>{formatAmount(detail.advanceDeduction)}</TableCell>
                        <TableCell className="font-bold text-green-600">
                          {formatAmount(detail.netSalary)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
