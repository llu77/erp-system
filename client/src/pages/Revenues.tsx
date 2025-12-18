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
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

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
      </div>
    </DashboardLayout>
  );
}
