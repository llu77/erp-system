import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { MobileCard, MobileCardList, Trash2 as Trash2Icon } from "@/components/ui/mobile-card-view";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, FolderOpen, IdCard, Loader2, Plus, Search, Trash2, UserCircle, Users } from "lucide-react";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  EXPIRING_DOCUMENT_KINDS,
  describeDocumentExpiry,
  formatDaysLeft,
  worstDocumentStatus,
  type DocumentExpiryInfo,
  type DocumentStatus,
  type ExpiringDocumentKind,
} from "@shared/employeeFile";
import { EmployeeFileDialog } from "@/components/employees/EmployeeFileDialog";
import {
  DocumentStatusBadge,
  EmployeeAvatar,
  LoadingState,
  QueryErrorState,
} from "@/components/employees/EmployeeFileParts";
import type { EmployeeListItem } from "@/components/employees/types";
import {
  DOCUMENT_STATUS_DOT,
  canManageEmployees,
  canOpenEmployeeFiles,
  errorMessage,
} from "@/components/employees/utils";

interface NewEmployeeForm {
  code: string;
  name: string;
  branchId: string;
  position: string;
  phone: string;
  hireDate: string;
  nationality: string;
}

const EMPTY_NEW_EMPLOYEE: NewEmployeeForm = {
  code: "",
  name: "",
  branchId: "",
  position: "",
  phone: "",
  hireDate: "",
  nationality: "",
};

type EmployeeRow = EmployeeListItem & {
  docs: Record<ExpiringDocumentKind, DocumentExpiryInfo>;
  worstStatus: DocumentStatus;
};

const EXPIRY_FIELD: Record<ExpiringDocumentKind, "iqamaExpiryDate" | "healthCertExpiryDate" | "contractExpiryDate"> = {
  iqama: "iqamaExpiryDate",
  health: "healthCertExpiryDate",
  contract: "contractExpiryDate",
};

function PortalBadge({ employee }: { employee: EmployeeListItem }) {
  if (employee.username && employee.hasPortalAccess) {
    return <Badge className="bg-emerald-600 text-white">مفعّل</Badge>;
  }
  if (employee.username) {
    return (
      <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-300">
        موقوف
      </Badge>
    );
  }
  return <Badge variant="secondary">لا يوجد</Badge>;
}

function DocumentDots({ docs }: { docs: EmployeeRow["docs"] }) {
  return (
    <div className="flex items-center gap-1.5">
      {EXPIRING_DOCUMENT_KINDS.map(kind => (
        <span
          key={kind}
          className={`h-2.5 w-2.5 rounded-full ${DOCUMENT_STATUS_DOT[docs[kind].status]}`}
          title={`${DOCUMENT_KIND_LABELS[kind]}: ${docs[kind].expiry ? formatDaysLeft(docs[kind].daysLeft) : DOCUMENT_STATUS_LABELS.missing}`}
        />
      ))}
    </div>
  );
}

export default function Employees() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const role = user?.role;
  const canManage = canManageEmployees(role);
  const canOpen = canOpenEmployeeFiles(role);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("all");
  const [filterDocStatus, setFilterDocStatus] = useState<"all" | DocumentStatus>("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [fileEmployeeId, setFileEmployeeId] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState<NewEmployeeForm>(EMPTY_NEW_EMPLOYEE);
  const [deleting, setDeleting] = useState<EmployeeListItem | null>(null);

  const employeesQuery = trpc.employees.list.useQuery({ withImages: true }, { enabled: canOpen });
  const branchesQuery = trpc.branches.list.useQuery(undefined, { enabled: canOpen });
  const utils = trpc.useUtils();

  const createMutation = trpc.employees.create.useMutation({
    onSuccess: async () => {
      toast.success("تم إضافة الموظف بنجاح");
      setShowAddDialog(false);
      setNewEmployee(EMPTY_NEW_EMPLOYEE);
      await Promise.all([utils.employees.list.invalidate(), utils.employees.getDocumentsOverview.invalidate()]);
    },
    onError: error => toast.error(errorMessage(error, "فشل إضافة الموظف")),
  });

  const deleteMutation = trpc.employees.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الموظف بنجاح");
      setDeleting(null);
      await Promise.all([utils.employees.list.invalidate(), utils.employees.getDocumentsOverview.invalidate()]);
    },
    onError: error => toast.error(errorMessage(error, "فشل حذف الموظف")),
  });

  // حالة الوثائق لكل موظف (حسب يوم الرياض)
  const rows = useMemo<EmployeeRow[]>(() => {
    return (employeesQuery.data ?? []).map(employee => {
      const docs = Object.fromEntries(
        EXPIRING_DOCUMENT_KINDS.map(kind => [kind, describeDocumentExpiry(kind, employee[EXPIRY_FIELD[kind]])])
      ) as EmployeeRow["docs"];
      return {
        ...employee,
        docs,
        worstStatus: worstDocumentStatus(EXPIRING_DOCUMENT_KINDS.map(kind => docs[kind].status)),
      };
    });
  }, [employeesQuery.data]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows
      .filter(row => {
        const matchesSearch =
          !term ||
          row.name.toLowerCase().includes(term) ||
          row.code.toLowerCase().includes(term) ||
          (row.phone ?? "").toLowerCase().includes(term) ||
          (row.iqamaNumber ?? "").includes(term) ||
          (row.position ?? "").toLowerCase().includes(term);
        const matchesBranch = filterBranchId === "all" || String(row.branchId) === filterBranchId;
        const matchesStatus = filterDocStatus === "all" || row.worstStatus === filterDocStatus;
        const matchesActive =
          filterActive === "all" || (filterActive === "active" ? row.isActive : !row.isActive);
        return matchesSearch && matchesBranch && matchesStatus && matchesActive;
      })
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "ar"));
  }, [rows, searchTerm, filterBranchId, filterDocStatus, filterActive]);

  const statusCounts = useMemo(() => {
    const counts: Record<DocumentStatus, number> = { expired: 0, critical: 0, warning: 0, missing: 0, valid: 0 };
    rows.filter(r => r.isActive).forEach(r => counts[r.worstStatus]++);
    return counts;
  }, [rows]);

  const handleCreate = () => {
    if (!newEmployee.code.trim() || !newEmployee.name.trim()) {
      toast.error("الكود والاسم مطلوبان");
      return;
    }
    createMutation.mutate({
      code: newEmployee.code.trim(),
      name: newEmployee.name.trim(),
      branchId: newEmployee.branchId ? Number(newEmployee.branchId) : undefined,
      position: newEmployee.position.trim() || null,
      phone: newEmployee.phone.trim() || null,
      hireDate: newEmployee.hireDate || null,
      nationality: newEmployee.nationality.trim() || null,
      isActive: true,
    });
  };

  if (authLoading) return <LoadingState />;

  if (!canOpen) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Users className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h3 className="mb-2 text-lg font-medium">غير مصرح</h3>
          <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤول والمدير ومشرف الفرع فقط</p>
        </CardContent>
      </Card>
    );
  }

  const branches = branchesQuery.data ?? [];
  const showBranchFilter = role !== "supervisor";
  const activeCount = rows.filter(r => r.isActive).length;

  const openFile = (id: number) => setFileEmployeeId(id);

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="kpi-icon bg-gradient-to-br from-blue-500 to-blue-600">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إدارة الموظفين</h1>
            <p className="text-sm text-muted-foreground">ملف كل موظف: البيانات والوثائق والراتب وحساب البوابة</p>
          </div>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setNewEmployee(EMPTY_NEW_EMPLOYEE);
              setShowAddDialog(true);
            }}
            className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg hover:from-blue-600 hover:to-blue-700"
          >
            <Plus className="h-4 w-4" />
            إضافة موظف
          </Button>
        )}
      </div>

      {/* ملخص حالة الوثائق (الموظفون النشطون) */}
      {employeesQuery.data && (
        <div className="flex flex-wrap gap-2">
          {(["expired", "critical", "warning", "missing", "valid"] as DocumentStatus[]).map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterDocStatus(current => (current === status ? "all" : status))}
              aria-pressed={filterDocStatus === status}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 transition-opacity ${filterDocStatus !== "all" && filterDocStatus !== status ? "opacity-50" : ""}`}
            >
              <DocumentStatusBadge status={status} />
              <span className="text-sm font-bold">{statusCounts[status]}</span>
            </button>
          ))}
        </div>
      )}

      {/* البحث والفلترة */}
      <Card className="card-professional">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الكود أو الجوال أو رقم الإقامة..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            {showBranchFilter && (
              <Select value={filterBranchId} onValueChange={setFilterBranchId}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={String(branch.id)}>
                      {branch.nameAr || branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterDocStatus} onValueChange={value => setFilterDocStatus(value as typeof filterDocStatus)}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="حالة الوثائق" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل حالات الوثائق</SelectItem>
                {(["expired", "critical", "warning", "missing", "valid"] as DocumentStatus[]).map(status => (
                  <SelectItem key={status} value={status}>
                    {DOCUMENT_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActive} onValueChange={value => setFilterActive(value as typeof filterActive)}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">على رأس العمل</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
                <SelectItem value="all">الكل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {branchesQuery.isError && showBranchFilter && (
            <p className="mt-2 text-xs text-red-600">
              تعذر تحميل الفروع.{" "}
              <button type="button" className="underline" onClick={() => branchesQuery.refetch()}>
                إعادة المحاولة
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* جدول الموظفين */}
      <Card className="card-professional">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-blue-500" />
                قائمة الموظفين
              </CardTitle>
              <CardDescription>{filteredRows.length} موظف</CardDescription>
            </div>
            <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-500">
              {activeCount} نشط
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {employeesQuery.isLoading ? (
            <LoadingState label="جاري تحميل الموظفين..." />
          ) : employeesQuery.isError ? (
            <QueryErrorState
              title="تعذر تحميل الموظفين"
              error={employeesQuery.error}
              onRetry={() => employeesQuery.refetch()}
              retrying={employeesQuery.isFetching}
            />
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-medium">لا يوجد موظفون مطابقون</h3>
              <p className="text-muted-foreground">غيّر البحث أو الفلاتر{canManage ? " أو أضف موظفاً جديداً" : ""}</p>
            </div>
          ) : isMobile ? (
            <MobileCardList
              items={filteredRows}
              emptyMessage="لا يوجد موظفون"
              emptyIcon={<Users className="h-12 w-12" />}
              renderCard={employee => (
                <MobileCard
                  key={employee.id}
                  onClick={() => openFile(employee.id)}
                  fields={[
                    { label: "الاسم", value: employee.name, isTitle: true },
                    { label: "الكود", value: employee.code, isSubtitle: true },
                    { label: "الفرع", value: employee.branchName ?? "-" },
                    { label: "المسمى", value: employee.position || "-" },
                    { label: "الوثائق", value: <DocumentStatusBadge status={employee.worstStatus} /> },
                    { label: "البوابة", value: <PortalBadge employee={employee} /> },
                  ]}
                  statusBadge={{
                    label: employee.isActive ? "نشط" : "غير نشط",
                    variant: employee.isActive ? "default" : "secondary",
                  }}
                  actions={[
                    { label: "ملف الموظف", icon: <FolderOpen className="h-4 w-4" />, onClick: () => openFile(employee.id) },
                    ...(canManage
                      ? [
                          {
                            label: "حذف",
                            icon: <Trash2Icon className="h-4 w-4" />,
                            onClick: () => setDeleting(employee),
                            variant: "destructive" as const,
                          },
                        ]
                      : []),
                  ]}
                />
              )}
            />
          ) : (
            <div className="table-professional overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">المسمى</TableHead>
                    <TableHead className="text-right">الوثائق</TableHead>
                    <TableHead className="text-right">حساب البوابة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="w-40 text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(employee => (
                    <TableRow
                      key={employee.id}
                      className={`cursor-pointer ${employee.isActive ? "" : "opacity-60"}`}
                      onClick={() => openFile(employee.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar name={employee.name} photoUrl={employee.photoUrl} />
                          <div>
                            <div className="font-medium">{employee.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{employee.code}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {employee.branchName ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>{employee.position || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <DocumentStatusBadge status={employee.worstStatus} />
                          <DocumentDots docs={employee.docs} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <PortalBadge employee={employee} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? "default" : "secondary"}>
                          {employee.isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => openFile(employee.id)} className="gap-1">
                            <FolderOpen className="h-4 w-4" />
                            ملف الموظف
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleting(employee)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="حذف الموظف"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* ملف الموظف */}
      {fileEmployeeId !== null && (
        <EmployeeFileDialog
          key={fileEmployeeId}
          employeeId={fileEmployeeId}
          open
          onOpenChange={open => !open && setFileEmployeeId(null)}
        />
      )}

      {/* إضافة موظف */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              إضافة موظف جديد
            </DialogTitle>
            <DialogDescription>
              بعد الإضافة افتح "ملف الموظف" لرفع الصورة والوثائق وضبط الراتب وحساب البوابة
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-code">كود الموظف *</Label>
              <Input
                id="new-code"
                value={newEmployee.code}
                maxLength={50}
                onChange={e => setNewEmployee({ ...newEmployee, code: e.target.value })}
                placeholder="EMP001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">الاسم *</Label>
              <Input
                id="new-name"
                value={newEmployee.name}
                maxLength={255}
                onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select value={newEmployee.branchId || undefined} onValueChange={value => setNewEmployee({ ...newEmployee, branchId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={branchesQuery.isLoading ? "جاري التحميل..." : "اختر الفرع"} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={String(branch.id)}>
                      {branch.nameAr || branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-position">المسمى الوظيفي</Label>
              <Input
                id="new-position"
                value={newEmployee.position}
                maxLength={100}
                onChange={e => setNewEmployee({ ...newEmployee, position: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">رقم الجوال</Label>
              <Input
                id="new-phone"
                dir="ltr"
                value={newEmployee.phone}
                maxLength={50}
                onChange={e => setNewEmployee({ ...newEmployee, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-nationality">الجنسية</Label>
              <Input
                id="new-nationality"
                value={newEmployee.nationality}
                maxLength={100}
                onChange={e => setNewEmployee({ ...newEmployee, nationality: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-hireDate">تاريخ المباشرة</Label>
              <Input
                id="new-hireDate"
                type="date"
                value={newEmployee.hireDate}
                onChange={e => setNewEmployee({ ...newEmployee, hireDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={createMutation.isPending}>
              إلغاء
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}
              {createMutation.isPending ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <Dialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              حذف الموظف
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف {deleting?.name}؟ لا يمكن التراجع عن هذا الإجراء. لإيقاف موظف ترك العمل
              يُفضّل تعطيله من ملفه بدلاً من الحذف.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && deleteMutation.mutate({ id: deleting.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <IdCard className="h-3.5 w-3.5" />
        النقاط الملونة: الإقامة ثم الشهادة الصحية ثم العقد
      </p>
    </div>
  );
}
