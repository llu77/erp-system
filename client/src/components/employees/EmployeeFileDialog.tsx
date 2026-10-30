/**
 * ملف الموظف: البيانات الأساسية، الوثائق (الصورة والإقامة والشهادة الصحية والعقد)،
 * الراتب، وحساب بوابة الموظفين - في نافذة واحدة مرتبطة بالخادم
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  Building2,
  FileSignature,
  HeartPulse,
  IdCard,
  KeyRound,
  Loader2,
  Save,
  Undo2,
  UserCircle,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DOCUMENT_KIND_LABELS,
  describeDocumentExpiry,
  formatArabicDate,
  normalizeIqamaNumber,
  type ExpiringDocumentKind,
} from "@shared/employeeFile";
import type { EmployeeFileData, EmployeeFileTab } from "./types";
import {
  DocumentFileActions,
  DocumentStatusBadge,
  EmployeeAvatar,
  LoadingState,
  QueryErrorState,
  useInvalidateEmployeeFile,
} from "./EmployeeFileParts";
import { PortalAccountTab } from "./PortalAccountTab";
import { SalarySettingsTab } from "./SalarySettingsTab";
import { useSyncedForm } from "./useSyncedForm";
import { canManageEmployees, errorMessage, formatDateTimeAr } from "./utils";

// ==================== البيانات الأساسية ====================

interface BasicForm {
  code: string;
  name: string;
  branchId: string;
  position: string;
  phone: string;
  hireDate: string;
  nationality: string;
  isActive: boolean;
}

function toBasicForm(e: EmployeeFileData["employee"]): BasicForm {
  return {
    code: e.code,
    name: e.name,
    branchId: e.branchId ? String(e.branchId) : "",
    position: e.position ?? "",
    phone: e.phone ?? "",
    hireDate: e.hireDate ?? "",
    nationality: e.nationality ?? "",
    isActive: e.isActive,
  };
}

function BasicInfoTab({
  file,
  canManage,
}: {
  file: EmployeeFileData;
  canManage: boolean;
}) {
  const employeeId = file.employee.id;
  const source = useMemo(() => toBasicForm(file.employee), [file.employee]);
  const { form, update, reset, acceptNext, dirty } = useSyncedForm(source);
  const branchesQuery = trpc.branches.list.useQuery();
  const invalidate = useInvalidateEmployeeFile();

  const save = trpc.employees.update.useMutation({
    onSuccess: async () => {
      acceptNext();
      toast.success("تم حفظ البيانات الأساسية");
      await invalidate(employeeId);
    },
    onError: error => toast.error(errorMessage(error, "تعذر حفظ البيانات")),
  });

  if (!form) return null;

  const handleSave = () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("الكود والاسم مطلوبان");
      return;
    }
    const text = (key: "position" | "phone" | "nationality") =>
      form[key].trim() || null;
    save.mutate({
      id: employeeId,
      ...(form.code !== source.code ? { code: form.code.trim() } : {}),
      ...(form.name !== source.name ? { name: form.name.trim() } : {}),
      ...(form.branchId !== source.branchId && form.branchId
        ? { branchId: Number(form.branchId) }
        : {}),
      ...(form.position !== source.position
        ? { position: text("position") }
        : {}),
      ...(form.phone !== source.phone ? { phone: text("phone") } : {}),
      ...(form.nationality !== source.nationality
        ? { nationality: text("nationality") }
        : {}),
      ...(form.hireDate !== source.hireDate
        ? { hireDate: form.hireDate || null }
        : {}),
      ...(form.isActive !== source.isActive ? { isActive: form.isActive } : {}),
    });
  };

  const busy = save.isPending;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emp-code">كود الموظف *</Label>
          <Input
            id="emp-code"
            value={form.code}
            maxLength={50}
            onChange={e => update("code", e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-name">الاسم *</Label>
          <Input
            id="emp-name"
            value={form.name}
            maxLength={255}
            onChange={e => update("name", e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label>الفرع</Label>
          {branchesQuery.isError ? (
            <div className="flex items-center gap-2 text-sm text-red-600">
              تعذر تحميل الفروع
              <Button
                variant="link"
                size="sm"
                onClick={() => branchesQuery.refetch()}
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <Select
              value={form.branchId || undefined}
              onValueChange={value => update("branchId", value)}
              disabled={busy || !canManage || branchesQuery.isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    branchesQuery.isLoading
                      ? "جاري التحميل..."
                      : (file.branchName ?? "اختر الفرع")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {branchesQuery.data?.map(branch => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.nameAr || branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-position">المسمى الوظيفي</Label>
          <Input
            id="emp-position"
            value={form.position}
            maxLength={100}
            onChange={e => update("position", e.target.value)}
            disabled={busy}
            placeholder="مثال: حلاق"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-phone">رقم الجوال</Label>
          <Input
            id="emp-phone"
            dir="ltr"
            value={form.phone}
            maxLength={50}
            onChange={e => update("phone", e.target.value)}
            disabled={busy}
            placeholder="05xxxxxxxx"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-nationality">الجنسية</Label>
          <Input
            id="emp-nationality"
            value={form.nationality}
            maxLength={100}
            onChange={e => update("nationality", e.target.value)}
            disabled={busy}
            placeholder="مثال: مصري"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-hireDate">تاريخ المباشرة</Label>
          <Input
            id="emp-hireDate"
            type="date"
            value={form.hireDate}
            onChange={e => update("hireDate", e.target.value)}
            disabled={busy}
          />
          {form.hireDate && (
            <p className="text-xs text-muted-foreground">
              {formatArabicDate(form.hireDate)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor="emp-active">الموظف على رأس العمل</Label>
          <Switch
            id="emp-active"
            checked={form.isActive}
            onCheckedChange={checked => update("isActive", checked)}
            disabled={busy || !canManage}
          />
        </div>
      </div>

      <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground dark:bg-slate-800/60 sm:grid-cols-2">
        <span>
          البريد في البوابة:{" "}
          {file.employee.email
            ? `${file.employee.email}${file.employee.emailVerified ? " (موثق)" : ""}`
            : "غير مسجل"}
        </span>
        <span>
          آخر تحديث لبيانات الوثائق:{" "}
          {file.employee.infoSubmittedAt
            ? `${formatDateTimeAr(file.employee.infoSubmittedAt)} (${file.employee.infoSubmittedBy ? "الإدارة" : "الموظف"})`
            : "لم تُسجل"}
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={reset} disabled={!dirty || busy}>
          <Undo2 className="ml-2 h-4 w-4" />
          تراجع
        </Button>
        <Button onClick={handleSave} disabled={!dirty || busy}>
          {busy ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="ml-2 h-4 w-4" />
          )}
          {busy ? "جاري الحفظ..." : "حفظ البيانات"}
        </Button>
      </div>
    </div>
  );
}

// ==================== الوثائق ====================

interface DocumentsForm {
  iqamaNumber: string;
  iqamaExpiryDate: string;
  healthCertExpiryDate: string;
  contractExpiryDate: string;
}

const DOCUMENT_DATE_FIELD: Record<
  ExpiringDocumentKind,
  keyof Omit<DocumentsForm, "iqamaNumber">
> = {
  iqama: "iqamaExpiryDate",
  health: "healthCertExpiryDate",
  contract: "contractExpiryDate",
};

const DOCUMENT_ICONS: Record<ExpiringDocumentKind, typeof IdCard> = {
  iqama: IdCard,
  health: HeartPulse,
  contract: FileSignature,
};

function DocumentsTab({
  file,
  canEdit,
}: {
  file: EmployeeFileData;
  canEdit: boolean;
}) {
  const employeeId = file.employee.id;
  const source = useMemo<DocumentsForm>(
    () => ({
      iqamaNumber: file.documents.iqama.number ?? "",
      iqamaExpiryDate: file.documents.iqama.expiry ?? "",
      healthCertExpiryDate: file.documents.health.expiry ?? "",
      contractExpiryDate: file.documents.contract.expiry ?? "",
    }),
    [file.documents]
  );
  const { form, update, reset, acceptNext, dirty } = useSyncedForm(source);
  const invalidate = useInvalidateEmployeeFile();

  const save = trpc.employees.update.useMutation({
    onSuccess: async () => {
      acceptNext();
      toast.success("تم حفظ بيانات الوثائق");
      await invalidate(employeeId);
    },
    onError: error =>
      toast.error(errorMessage(error, "تعذر حفظ بيانات الوثائق")),
  });

  if (!form) return null;

  const iqamaInvalid =
    !!form.iqamaNumber &&
    !/^\d{1,20}$/.test(normalizeIqamaNumber(form.iqamaNumber));

  const handleSave = () => {
    if (iqamaInvalid) {
      toast.error("رقم الإقامة يجب أن يكون أرقاماً فقط");
      return;
    }
    // الحقول المتغيرة فقط (التاريخ الفارغ يمسح القيمة)
    const changedDate = (field: keyof Omit<DocumentsForm, "iqamaNumber">) =>
      form[field] !== source[field] ? form[field] || null : undefined;
    save.mutate({
      id: employeeId,
      iqamaNumber:
        form.iqamaNumber !== source.iqamaNumber
          ? form.iqamaNumber.trim() || null
          : undefined,
      iqamaExpiryDate: changedDate("iqamaExpiryDate"),
      healthCertExpiryDate: changedDate("healthCertExpiryDate"),
      contractExpiryDate: changedDate("contractExpiryDate"),
    });
  };

  const busy = save.isPending;
  const kinds: ExpiringDocumentKind[] = ["iqama", "health", "contract"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 rounded-lg border p-4 sm:flex-row">
        <EmployeeAvatar
          name={file.employee.name}
          photoUrl={file.documents.photo.url}
          className="h-24 w-24 text-2xl"
        />
        <div className="flex-1 space-y-2 text-center sm:text-right">
          <p className="font-semibold">{DOCUMENT_KIND_LABELS.photo}</p>
          <p className="text-xs text-muted-foreground">
            صورة واضحة للوجه بصيغة JPG أو PNG أو WEBP (حتى 5 ميجابايت)
          </p>
          <DocumentFileActions
            employeeId={employeeId}
            kind="photo"
            url={file.documents.photo.url}
            canEdit={canEdit}
            compact
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {kinds.map(kind => {
          const Icon = DOCUMENT_ICONS[kind];
          const field = DOCUMENT_DATE_FIELD[kind];
          const stored = file.documents[kind];
          // الحالة حسب التاريخ في النموذج (قبل الحفظ) لمعاينة فورية
          const preview = describeDocumentExpiry(kind, form[field] || null);
          return (
            <div key={kind} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  <Icon className="h-4 w-4 text-primary" />
                  {DOCUMENT_KIND_LABELS[kind]}
                </span>
                <DocumentStatusBadge
                  status={preview.status}
                  daysLeft={preview.daysLeft}
                />
              </div>
              {kind === "iqama" && (
                <div className="space-y-1">
                  <Label htmlFor="doc-iqamaNumber">رقم الإقامة</Label>
                  <Input
                    id="doc-iqamaNumber"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={20}
                    value={form.iqamaNumber}
                    onChange={e => update("iqamaNumber", e.target.value)}
                    disabled={!canEdit || busy}
                    aria-invalid={iqamaInvalid}
                    placeholder="2xxxxxxxxx"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor={`doc-${field}`}>تاريخ الانتهاء</Label>
                <Input
                  id={`doc-${field}`}
                  type="date"
                  value={form[field]}
                  onChange={e => update(field, e.target.value)}
                  disabled={!canEdit || busy}
                />
                <p className="text-xs text-muted-foreground">
                  {formatArabicDate(form[field] || null)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  صورة الوثيقة (صورة أو PDF)
                </p>
                <DocumentFileActions
                  employeeId={employeeId}
                  kind={kind}
                  url={stored.imageUrl}
                  canEdit={canEdit}
                  compact
                />
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={reset} disabled={!dirty || busy}>
            <Undo2 className="ml-2 h-4 w-4" />
            تراجع
          </Button>
          <Button onClick={handleSave} disabled={!dirty || busy}>
            {busy ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            {busy ? "جاري الحفظ..." : "حفظ التواريخ ورقم الإقامة"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==================== النافذة ====================

export function EmployeeFileDialog({
  employeeId,
  open,
  onOpenChange,
  initialTab = "basic",
}: {
  employeeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: EmployeeFileTab;
}) {
  const { user } = useAuth();
  const canManage = canManageEmployees(user?.role);
  const [tab, setTab] = useState<EmployeeFileTab>(initialTab);

  const fileQuery = trpc.employees.getFile.useQuery(
    { id: employeeId ?? 0 },
    { enabled: open && !!employeeId }
  );
  const file = fileQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            ملف الموظف
          </DialogTitle>
          <DialogDescription>
            البيانات والوثائق والراتب وحساب بوابة الموظفين
          </DialogDescription>
        </DialogHeader>

        {fileQuery.isLoading ? (
          <LoadingState label="جاري تحميل ملف الموظف..." />
        ) : fileQuery.isError || !file ? (
          <QueryErrorState
            title="تعذر تحميل ملف الموظف"
            error={fileQuery.error}
            onRetry={() => fileQuery.refetch()}
            retrying={fileQuery.isFetching}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-xl border bg-gradient-to-l from-slate-50 to-white p-4 dark:from-slate-900 dark:to-slate-950 sm:flex-row sm:items-center">
              <EmployeeAvatar
                name={file.employee.name}
                photoUrl={file.documents.photo.url}
                className="h-16 w-16 text-lg"
              />
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold">{file.employee.name}</h3>
                  <Badge variant="outline" className="font-mono">
                    {file.employee.code}
                  </Badge>
                  {!file.employee.isActive && (
                    <Badge variant="secondary">غير نشط</Badge>
                  )}
                  {file.salary.isSupervisor && (
                    <Badge className="bg-indigo-600 text-white">مشرف فرع</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {file.branchName ?? "بدون فرع"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {file.employee.position || "بدون مسمى"}
                  </span>
                  <span>{file.establishmentName}</span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <span className="text-xs text-muted-foreground">
                  حالة الوثائق
                </span>
                <DocumentStatusBadge status={file.documents.worstStatus} />
              </div>
            </div>

            <Tabs
              value={tab}
              onValueChange={value => setTab(value as EmployeeFileTab)}
              dir="rtl"
            >
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="basic" className="gap-1">
                  <UserCircle className="h-4 w-4" />
                  البيانات الأساسية
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1">
                  <IdCard className="h-4 w-4" />
                  الوثائق
                </TabsTrigger>
                <TabsTrigger value="salary" className="gap-1">
                  <Wallet className="h-4 w-4" />
                  الراتب
                </TabsTrigger>
                {canManage && (
                  <TabsTrigger value="account" className="gap-1">
                    <KeyRound className="h-4 w-4" />
                    حساب البوابة
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="basic" className="pt-4">
                <BasicInfoTab file={file} canManage={canManage} />
              </TabsContent>
              <TabsContent value="documents" className="pt-4">
                <DocumentsTab file={file} canEdit />
              </TabsContent>
              <TabsContent value="salary" className="pt-4">
                <SalarySettingsTab file={file} canEdit={canManage} />
              </TabsContent>
              {canManage && (
                <TabsContent value="account" className="pt-4">
                  <PortalAccountTab
                    employeeId={file.employee.id}
                    employeeName={file.employee.name}
                  />
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EmployeeFileDialog;
