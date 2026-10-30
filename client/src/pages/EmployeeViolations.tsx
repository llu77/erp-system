import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Loader2, Plus, Trash2, XCircle, Ban } from "lucide-react";

// أنواع المخالفات الشائعة
const VIOLATION_TYPES = [
  "تأخير عن الدوام",
  "غياب بدون عذر",
  "مغادرة قبل نهاية الدوام",
  "مخالفة تعليمات العمل",
  "إهمال أو إتلاف أدوات",
  "سوء تعامل مع العملاء",
  "مخالفة النظافة والمظهر",
  "أخرى",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار الاعتماد",
  approved: "معتمدة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function EmployeeViolations() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const canCreate = isManager || user?.role === "supervisor";
  const isSupervisor = user?.role === "supervisor" && !!user?.branchId;

  const [branchFilter, setBranchFilter] = useState<string>(isSupervisor ? String(user!.branchId) : "all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    violationDate: todayLocal(),
    violationType: VIOLATION_TYPES[0],
    customType: "",
    amount: "",
    description: "",
  });

  const { data: branches } = trpc.branches.list.useQuery();
  const { data: employees } = trpc.employees.list.useQuery(
    isSupervisor ? { branchId: user!.branchId! } : undefined
  );
  const listQuery = trpc.violations.list.useQuery({
    branchId: branchFilter !== "all" ? parseInt(branchFilter) : undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const createMutation = trpc.violations.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsCreateOpen(false);
      setForm({ employeeId: "", violationDate: todayLocal(), violationType: VIOLATION_TYPES[0], customType: "", amount: "", description: "" });
      listQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const reviewMutation = trpc.violations.review.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      listQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.violations.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      listQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = listQuery.data ?? [];
  const stats = useMemo(() => ({
    pending: rows.filter(r => r.status === "pending").length,
    approvedAmount: rows.filter(r => r.status === "approved").reduce((s, r) => s + parseFloat(r.amount), 0),
    awaitingDeduction: rows.filter(r => r.status === "approved" && !r.isDeductedFromSalary).length,
  }), [rows]);

  const activeEmployees = (employees ?? []).filter((e: any) => e.isActive !== false);

  const submit = () => {
    const amount = parseFloat(form.amount);
    const type = form.violationType === "أخرى" ? form.customType.trim() : form.violationType;
    if (!form.employeeId) return toast.error("يرجى اختيار الموظف");
    if (!type) return toast.error("يرجى تحديد نوع المخالفة");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("يرجى إدخال مبلغ خصم صحيح");
    createMutation.mutate({
      employeeId: parseInt(form.employeeId),
      violationDate: form.violationDate,
      violationType: type,
      amount,
      description: form.description || undefined,
    });
  };

  const formatAmount = (v: string | number) =>
    (typeof v === "string" ? parseFloat(v) : v).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            مخالفات الموظفين
          </h1>
          <p className="text-sm text-muted-foreground">
            المخالفات المعتمدة تُخصم تلقائياً من راتب الموظف في مسيرة الشهر الذي وقعت فيه (أو أول مسيرة مفتوحة بعده)
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="ml-2 h-4 w-4" />
            تسجيل مخالفة
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card/50"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">بانتظار الاعتماد</p>
          <p className="text-lg font-bold text-yellow-500">{stats.pending}</p>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">معتمدة لم تُخصم بعد</p>
          <p className="text-lg font-bold text-orange-500">{stats.awaitingDeduction}</p>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">إجمالي المعتمد</p>
          <p className="text-lg font-bold">{formatAmount(stats.approvedAmount)} ر.س</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">سجل المخالفات</CardTitle>
            <div className="flex flex-wrap gap-2">
              {!isSupervisor && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="الفرع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.nameAr || b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">لا توجد مخالفات</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>نوع المخالفة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الخصم</TableHead>
                    <TableHead>سجلها</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(v => (
                    <TableRow key={v.id} className="text-xs">
                      <TableCell>{new Date(v.violationDate).toLocaleDateString("ar-SA-u-ca-gregory")}</TableCell>
                      <TableCell className="font-medium">{v.employeeName}</TableCell>
                      <TableCell>{v.branchName || "-"}</TableCell>
                      <TableCell>
                        <div>{v.violationType}</div>
                        {v.description && <div className="text-muted-foreground text-[10px]">{v.description}</div>}
                      </TableCell>
                      <TableCell className="font-bold text-red-500">{formatAmount(v.amount)} ر.س</TableCell>
                      <TableCell><Badge className={`text-[10px] ${STATUS_COLORS[v.status]}`}>{STATUS_LABELS[v.status]}</Badge></TableCell>
                      <TableCell>
                        {v.isDeductedFromSalary && v.payrollNumber ? (
                          <span className="text-green-500">في المسيرة {v.payrollNumber}</span>
                        ) : v.status === "approved" ? (
                          <span className="text-orange-500">بانتظار المسيرة</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v.createdByName}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          {isManager && v.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="اعتماد"
                                onClick={() => reviewMutation.mutate({ id: v.id, status: "approved" })}>
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="رفض"
                                onClick={() => {
                                  const notes = prompt("سبب الرفض (اختياري)");
                                  if (notes === null) return; // ألغى المستخدم
                                  reviewMutation.mutate({ id: v.id, status: "rejected", notes: notes || undefined });
                                }}>
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </>
                          )}
                          {isManager && v.status === "approved" && v.payrollStatus !== "approved" && v.payrollStatus !== "paid" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="إلغاء المخالفة"
                              onClick={() => {
                                if (confirm("إلغاء المخالفة؟ إذا كانت في مسيرة مفتوحة سيُعاد حساب راتب الموظف.")) {
                                  reviewMutation.mutate({ id: v.id, status: "cancelled" });
                                }
                              }}>
                              <Ban className="h-3.5 w-3.5 text-orange-500" />
                            </Button>
                          )}
                          {user?.role === "admin" && v.payrollStatus !== "approved" && v.payrollStatus !== "paid" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="حذف"
                              onClick={() => confirm("حذف المخالفة نهائياً؟") && deleteMutation.mutate({ id: v.id })}>
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>تسجيل مخالفة</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">الموظف *</label>
              <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">تاريخ المخالفة *</label>
                <Input type="date" value={form.violationDate} onChange={(e) => setForm({ ...form, violationDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">مبلغ الخصم (ر.س) *</label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">نوع المخالفة *</label>
              <Select value={form.violationType} onValueChange={(v) => setForm({ ...form, violationType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIOLATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.violationType === "أخرى" && (
                <Input placeholder="اكتب نوع المخالفة" value={form.customType} onChange={(e) => setForm({ ...form, customType: e.target.value })} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">التفاصيل</label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {!isManager && (
              <p className="text-xs text-yellow-500">ستُرسل المخالفة للمدير للاعتماد قبل خصمها من الراتب.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
