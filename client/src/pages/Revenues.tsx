import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  DollarSign, 
  Calendar, 
  Users, 
  Save,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  Download,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ar } from "date-fns/locale";

interface EmployeeRevenueInput {
  employeeId: number;
  employeeName: string;
  cash: string;
  network: string;
  total: string;
}

export default function Revenues() {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isMatched, setIsMatched] = useState(true);
  const [unmatchReason, setUnmatchReason] = useState("");
  const [branchRevenue, setBranchRevenue] = useState({
    cash: "",
    network: "",
    balance: "",
  });
  const [employeeRevenues, setEmployeeRevenues] = useState<EmployeeRevenueInput[]>([]);

  // جلب الفروع
  const { data: branches, isLoading: branchesLoading } = trpc.branches.list.useQuery();

  // الفرع الفعال
  const effectiveBranchId = selectedBranchId || (branches && branches.length > 0 ? branches[0].id : null);

  // جلب موظفي الفرع
  const { data: employees, isLoading: employeesLoading } = trpc.employees.listByBranch.useQuery(
    { branchId: effectiveBranchId! },
    { enabled: !!effectiveBranchId }
  );

  // حفظ الإيرادات
  const saveMutation = trpc.revenues.createDaily.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الإيرادات بنجاح وتحديث البونص تلقائياً");
      // إعادة تعيين النموذج
      setBranchRevenue({ cash: "", network: "", balance: "" });
      setEmployeeRevenues([]);
      setIsMatched(true);
      setUnmatchReason("");
    },
    onError: (error) => {
      toast.error(error.message || "فشل حفظ الإيرادات");
    },
  });

  // إضافة موظف للإيرادات
  const addEmployee = (employeeId: number) => {
    const employee = employees?.find(e => e.id === employeeId);
    if (!employee) return;
    
    if (employeeRevenues.some(er => er.employeeId === employeeId)) {
      toast.error("هذا الموظف مضاف مسبقاً");
      return;
    }

    setEmployeeRevenues([
      ...employeeRevenues,
      {
        employeeId,
        employeeName: employee.name,
        cash: "",
        network: "",
        total: "0",
      },
    ]);
  };

  // تحديث إيراد موظف
  const updateEmployeeRevenue = (index: number, field: "cash" | "network", value: string) => {
    const updated = [...employeeRevenues];
    updated[index][field] = value;
    // حساب الإجمالي
    const cash = parseFloat(updated[index].cash) || 0;
    const network = parseFloat(updated[index].network) || 0;
    updated[index].total = (cash + network).toFixed(2);
    setEmployeeRevenues(updated);
  };

  // حذف موظف
  const removeEmployee = (index: number) => {
    setEmployeeRevenues(employeeRevenues.filter((_, i) => i !== index));
  };

  // حساب إجمالي الفرع
  const calculateBranchTotal = () => {
    const cash = parseFloat(branchRevenue.cash) || 0;
    const network = parseFloat(branchRevenue.network) || 0;
    const balance = parseFloat(branchRevenue.balance) || 0;
    return (cash + network + balance).toFixed(2);
  };

  // حساب إجمالي الموظفين
  const calculateEmployeesTotal = () => {
    return employeeRevenues.reduce((sum, er) => sum + (parseFloat(er.total) || 0), 0).toFixed(2);
  };

  // حفظ الإيرادات
  const handleSave = () => {
    if (!effectiveBranchId) {
      toast.error("يرجى اختيار الفرع");
      return;
    }

    if (employeeRevenues.length === 0) {
      toast.error("يرجى إضافة إيرادات الموظفين");
      return;
    }

    if (!isMatched && !unmatchReason.trim()) {
      toast.error("يرجى تحديد سبب عدم التطابق");
      return;
    }

    saveMutation.mutate({
      branchId: effectiveBranchId,
      date: selectedDate,
      cash: branchRevenue.cash || "0",
      network: branchRevenue.network || "0",
      balance: branchRevenue.balance || "0",
      total: calculateBranchTotal(),
      isMatched,
      unmatchReason: isMatched ? undefined : unmatchReason,
      employeeRevenues: employeeRevenues.map(er => ({
        employeeId: er.employeeId,
        cash: er.cash || "0",
        network: er.network || "0",
        total: er.total,
      })),
    });
  };

  if (branchesLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              إدخال الإيرادات اليومية
            </h1>
            <p className="text-muted-foreground">إدخال إيرادات الفرع والموظفين اليومية</p>
          </div>
        </div>

        {/* اختيار الفرع والتاريخ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              معلومات اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>الفرع</Label>
                <Select
                  value={effectiveBranchId?.toString() || ""}
                  onValueChange={(v) => {
                    setSelectedBranchId(Number(v));
                    setEmployeeRevenues([]);
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* إيرادات الفرع */}
        <Card>
          <CardHeader>
            <CardTitle>إيرادات الفرع</CardTitle>
            <CardDescription>إجمالي إيرادات الفرع لهذا اليوم</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>نقدي</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={branchRevenue.cash}
                  onChange={(e) => setBranchRevenue({ ...branchRevenue, cash: e.target.value })}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>شبكة</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={branchRevenue.network}
                  onChange={(e) => setBranchRevenue({ ...branchRevenue, network: e.target.value })}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>رصيد</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={branchRevenue.balance}
                  onChange={(e) => setBranchRevenue({ ...branchRevenue, balance: e.target.value })}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>الإجمالي</Label>
                <div className="mt-2 p-2 bg-primary/10 rounded-md text-center font-bold text-lg text-primary">
                  {calculateBranchTotal()} ر.س
                </div>
              </div>
            </div>

            {/* التطابق */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isMatched}
                  onCheckedChange={setIsMatched}
                />
                <Label>الإيرادات متطابقة</Label>
              </div>
              {!isMatched && (
                <div className="flex-1">
                  <Input
                    value={unmatchReason}
                    onChange={(e) => setUnmatchReason(e.target.value)}
                    placeholder="سبب عدم التطابق..."
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* إيرادات الموظفين */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  إيرادات الموظفين
                </CardTitle>
                <CardDescription>إيرادات كل موظف لحساب البونص تلقائياً</CardDescription>
              </div>
              {employees && employees.length > 0 && (
                <Select onValueChange={(v) => addEmployee(Number(v))}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="إضافة موظف" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter(e => !employeeRevenues.some(er => er.employeeId === e.id))
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {employeesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : employeeRevenues.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">نقدي</TableHead>
                      <TableHead className="text-right">شبكة</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeRevenues.map((er, index) => (
                      <TableRow key={er.employeeId}>
                        <TableCell className="font-medium">{er.employeeName}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={er.cash}
                            onChange={(e) => updateEmployeeRevenue(index, "cash", e.target.value)}
                            placeholder="0.00"
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={er.network}
                            onChange={(e) => updateEmployeeRevenue(index, "network", e.target.value)}
                            placeholder="0.00"
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          {er.total} ر.س
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEmployee(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={3} className="font-bold">
                        إجمالي الموظفين
                      </TableCell>
                      <TableCell className="font-bold text-primary text-lg">
                        {calculateEmployeesTotal()} ر.س
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* تنبيه عدم التطابق */}
                {calculateBranchTotal() !== calculateEmployeesTotal() && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-yellow-600">تنبيه: عدم تطابق</div>
                      <div className="text-sm text-muted-foreground">
                        إجمالي الفرع ({calculateBranchTotal()} ر.س) لا يتطابق مع إجمالي الموظفين ({calculateEmployeesTotal()} ر.س)
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لم يتم إضافة موظفين بعد</p>
                <p className="text-sm">اختر موظفاً من القائمة أعلاه لإضافة إيراداته</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* زر الحفظ */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleSave}
            disabled={saveMutation.isPending || employeeRevenues.length === 0}
            className="gap-2"
          >
            <Save className="h-5 w-5" />
            {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الإيرادات"}
          </Button>
        </div>

        {/* سجل الإيرادات الشهري */}
        <MonthlyRevenueLog branchId={effectiveBranchId} selectedDate={selectedDate} />
      </div>
    </DashboardLayout>
  );
}

// مكون سجل الإيرادات الشهري
function MonthlyRevenueLog({ branchId, selectedDate }: { branchId: number | null; selectedDate: string }) {
  const [isExporting, setIsExporting] = useState(false);
  
  // حساب أول وآخر يوم في الشهر
  const currentDate = new Date(selectedDate);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const startDateStr = format(monthStart, "yyyy-MM-dd");
  const endDateStr = format(monthEnd, "yyyy-MM-dd");
  const monthName = format(currentDate, "MMMM yyyy", { locale: ar });

  // جلب إيرادات الشهر
  const { data: monthlyRevenues, isLoading } = trpc.revenues.getByDateRange.useQuery(
    { 
      branchId: branchId!, 
      startDate: startDateStr, 
      endDate: endDateStr 
    },
    { enabled: !!branchId }
  );

  // حساب الإجماليات
  const totals = monthlyRevenues?.reduce(
    (acc, rev) => ({
      cash: acc.cash + parseFloat(rev.cash || "0"),
      network: acc.network + parseFloat(rev.network || "0"),
      balance: acc.balance + parseFloat(rev.balance || "0"),
      total: acc.total + parseFloat(rev.total || "0"),
      matched: acc.matched + (rev.isMatched ? 1 : 0),
      unmatched: acc.unmatched + (rev.isMatched ? 0 : 1),
    }),
    { cash: 0, network: 0, balance: 0, total: 0, matched: 0, unmatched: 0 }
  ) || { cash: 0, network: 0, balance: 0, total: 0, matched: 0, unmatched: 0 };

  // دالة تصدير PDF
  const handleExportPDF = async (
    revenues: typeof monthlyRevenues,
    totals: { cash: number; network: number; balance: number; total: number; matched: number; unmatched: number },
    monthName: string,
    monthStart: Date,
    monthEnd: Date
  ) => {
    if (!revenues || revenues.length === 0) return;
    
    setIsExporting(true);
    try {
      // إنشاء محتوى HTML للتقرير
      const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>سجل إيرادات شهر ${monthName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; padding: 40px; background: #fff; color: #1a1a2e; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; }
    .header h1 { color: #0ea5e9; font-size: 28px; margin-bottom: 10px; }
    .header p { color: #64748b; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: #f8fafc; border-radius: 10px; padding: 15px; text-align: center; border: 1px solid #e2e8f0; }
    .summary-card .value { font-size: 20px; font-weight: 700; margin-bottom: 5px; }
    .summary-card .label { font-size: 12px; color: #64748b; }
    .cash { color: #22c55e; }
    .network { color: #3b82f6; }
    .balance { color: #a855f7; }
    .matched { color: #22c55e; }
    .unmatched { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #0ea5e9; color: white; padding: 12px; text-align: right; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    .status-matched { color: #22c55e; font-weight: 600; }
    .status-unmatched { color: #ef4444; font-weight: 600; }
    .total-row { background: #0ea5e9 !important; color: white; font-weight: 700; }
    .total-row td { border: none; }
    .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>سجل إيرادات شهر ${monthName}</h1>
    <p>من ${format(monthStart, "d MMMM", { locale: ar })} إلى ${format(monthEnd, "d MMMM yyyy", { locale: ar })}</p>
  </div>
  
  <div class="summary">
    <div class="summary-card">
      <div class="value cash">${totals.cash.toLocaleString()}</div>
      <div class="label">إجمالي النقدي</div>
    </div>
    <div class="summary-card">
      <div class="value network">${totals.network.toLocaleString()}</div>
      <div class="label">إجمالي الشبكة</div>
    </div>
    <div class="summary-card">
      <div class="value balance">${totals.balance.toLocaleString()}</div>
      <div class="label">إجمالي الرصيد</div>
    </div>
    <div class="summary-card">
      <div class="value matched">${totals.matched}</div>
      <div class="label">أيام متطابقة</div>
    </div>
    <div class="summary-card">
      <div class="value unmatched">${totals.unmatched}</div>
      <div class="label">أيام غير متطابقة</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        <th>اليوم</th>
        <th>نقدي</th>
        <th>شبكة</th>
        <th>رصيد</th>
        <th>الإجمالي</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${revenues.map(rev => {
        const revDate = new Date(rev.date);
        return `
          <tr>
            <td>${format(revDate, "d/M/yyyy")}</td>
            <td>${format(revDate, "EEEE", { locale: ar })}</td>
            <td class="cash">${parseFloat(rev.cash || "0").toLocaleString()}</td>
            <td class="network">${parseFloat(rev.network || "0").toLocaleString()}</td>
            <td class="balance">${parseFloat(rev.balance || "0").toLocaleString()}</td>
            <td><strong>${parseFloat(rev.total || "0").toLocaleString()} ر.س</strong></td>
            <td class="${rev.isMatched ? 'status-matched' : 'status-unmatched'}">
              ${rev.isMatched ? '✓ متطابق' : '✗ غير متطابق'}
            </td>
          </tr>
        `;
      }).join('')}
      <tr class="total-row">
        <td colspan="2">الإجمالي</td>
        <td>${totals.cash.toLocaleString()}</td>
        <td>${totals.network.toLocaleString()}</td>
        <td>${totals.balance.toLocaleString()}</td>
        <td>${totals.total.toLocaleString()} ر.س</td>
        <td>${revenues.length} يوم</td>
      </tr>
    </tbody>
  </table>
  
  <div class="footer">
    <p>تم إنشاء هذا التقرير بواسطة Symbol AI - ${format(new Date(), "d MMMM yyyy - h:mm a", { locale: ar })}</p>
  </div>
</body>
</html>
      `;

      // إنشاء Blob وتحميله
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // فتح نافذة جديدة للطباعة
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      toast.success("تم فتح التقرير للطباعة أو الحفظ ك PDF");
    } catch (error) {
      console.error('Export error:', error);
      toast.error("فشل تصدير التقرير");
    } finally {
      setIsExporting(false);
    }
  };

  if (!branchId) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              سجل إيرادات شهر {monthName}
            </CardTitle>
            <CardDescription>
              من {format(monthStart, "d MMMM", { locale: ar })} إلى {format(monthEnd, "d MMMM yyyy", { locale: ar })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{monthlyRevenues?.length || 0}</div>
              <div className="text-xs text-muted-foreground">يوم مسجل</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{totals.total.toLocaleString()} ر.س</div>
              <div className="text-xs text-muted-foreground">إجمالي الشهر</div>
            </div>
            {monthlyRevenues && monthlyRevenues.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportPDF(monthlyRevenues, totals, monthName, monthStart, monthEnd)}
                disabled={isExporting}
                className="gap-2"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                تصدير PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : monthlyRevenues && monthlyRevenues.length > 0 ? (
          <>
            {/* ملخص الشهر */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">{totals.cash.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">إجمالي النقدي</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">{totals.network.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">إجمالي الشبكة</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">{totals.balance.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">إجمالي الرصيد</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-500">{totals.matched}</div>
                <div className="text-xs text-muted-foreground">متطابق</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-500">{totals.unmatched}</div>
                <div className="text-xs text-muted-foreground">غير متطابق</div>
              </div>
            </div>

            {/* جدول الإيرادات */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">اليوم</TableHead>
                    <TableHead className="text-right">نقدي</TableHead>
                    <TableHead className="text-right">شبكة</TableHead>
                    <TableHead className="text-right">رصيد</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRevenues.map((revenue) => {
                    const revDate = new Date(revenue.date);
                    return (
                      <TableRow key={revenue.id} className={!revenue.isMatched ? "bg-yellow-500/5" : ""}>
                        <TableCell className="font-medium">
                          {format(revDate, "d/M/yyyy")}
                        </TableCell>
                        <TableCell>
                          {format(revDate, "EEEE", { locale: ar })}
                        </TableCell>
                        <TableCell className="text-green-600">
                          {parseFloat(revenue.cash || "0").toLocaleString()}
                        </TableCell>
                        <TableCell className="text-blue-600">
                          {parseFloat(revenue.network || "0").toLocaleString()}
                        </TableCell>
                        <TableCell className="text-purple-600">
                          {parseFloat(revenue.balance || "0").toLocaleString()}
                        </TableCell>
                        <TableCell className="font-bold">
                          {parseFloat(revenue.total || "0").toLocaleString()} ر.س
                        </TableCell>
                        <TableCell>
                          {revenue.isMatched ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              <CheckCircle className="h-3 w-3 ml-1" />
                              متطابق
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                              <XCircle className="h-3 w-3 ml-1" />
                              غير متطابق
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد إيرادات مسجلة لهذا الشهر</p>
            <p className="text-sm">ابدأ بإدخال إيرادات اليوم من النموذج أعلاه</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
