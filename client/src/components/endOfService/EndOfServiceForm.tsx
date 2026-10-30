/**
 * نموذج إنهاء الخدمة (إنشاء جديد أو تعديل مسودة)
 * الخطوة 1: اختيار موظف نشط - الخطوة 2: البيانات مع معاينة حية للحساب من الخادم
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Calculator,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Search,
  UserCircle,
  UserX,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  END_OF_SERVICE_FIXED_AWARD,
  getEndOfServiceStatusLabel,
  parseDateOnly,
} from "@shared/endOfService";
import { roundMoney, todayVoucherDate } from "@shared/vouchers";
import { CalculationBreakdown } from "./CalculationBreakdown";
import type { EosDefaults, EosFormInput, EosPreview } from "./types";
import { errorMessage, formatDays, formatSar, retryUnlessFinal } from "./utils";

// ==================== حالة النموذج ====================

interface FormState {
  hireDate: string;
  contractEndDate: string;
  lastWorkingDay: string;
  letterDate: string;
  nationality: string;
  idNumber: string;
  baseSalary: string;
  fixedAllowances: string;
  salaryManual: boolean;
  salaryDays: string;
  salaryNote: string;
  otherAdditions: string;
  otherAdditionsNote: string;
  otherDeductions: string;
  otherDeductionsNote: string;
  notes: string;
}

type FieldKey = keyof FormState | "employee";
type FieldErrors = Partial<Record<FieldKey, string>>;

const MAX_AMOUNT = 10_000_000;
const MAX_DAYS = 100_000;

function emptyState(): FormState {
  return {
    hireDate: "",
    contractEndDate: "",
    lastWorkingDay: "",
    letterDate: todayVoucherDate(),
    nationality: "",
    idNumber: "",
    baseSalary: "",
    fixedAllowances: "",
    salaryManual: false,
    salaryDays: "",
    salaryNote: "",
    otherAdditions: "",
    otherAdditionsNote: "",
    otherDeductions: "",
    otherDeductionsNote: "",
    notes: "",
  };
}

const numberText = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

function stateFromDefaults(d: EosDefaults): FormState {
  const contractEndDate = d.employee.contractEndDate ?? "";
  return {
    ...emptyState(),
    hireDate: d.employee.hireDate ?? "",
    contractEndDate,
    lastWorkingDay: contractEndDate,
    nationality: d.employee.nationality ?? "",
    idNumber: d.employee.idNumber ?? "",
    baseSalary: numberText(d.wage.baseSalary),
    fixedAllowances: numberText(d.wage.fixedAllowances),
  };
}

function stateFromForm(f: EosFormInput): FormState {
  const salaryManual =
    f.salaryDaysOverride !== null && f.salaryDaysOverride !== undefined;
  return {
    hireDate: f.hireDate,
    contractEndDate: f.contractEndDate,
    lastWorkingDay: f.lastWorkingDay,
    letterDate: f.letterDate,
    nationality: f.nationality ?? "",
    idNumber: f.idNumber ?? "",
    baseSalary: numberText(f.baseSalary),
    fixedAllowances: numberText(f.fixedAllowances),
    salaryManual,
    salaryDays: salaryManual ? numberText(f.salaryDaysOverride) : "",
    salaryNote: f.salaryNote ?? "",
    otherAdditions: f.otherAdditions ? String(f.otherAdditions) : "",
    otherAdditionsNote: f.otherAdditionsNote ?? "",
    otherDeductions: f.otherDeductions ? String(f.otherDeductions) : "",
    otherDeductionsNote: f.otherDeductionsNote ?? "",
    notes: f.notes ?? "",
  };
}

/** رقم غير سالب من نص (الفارغ = القيمة الافتراضية) */
function parseNonNegative(
  text: string,
  max: number,
  emptyValue: number | null
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: emptyValue };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > max) return { ok: false };
  return { ok: true, value: n };
}

const textOrNull = (value: string) => value.trim() || null;

/**
 * تحويل الحالة إلى مدخلات الخادم
 * - errors: كل أخطاء الحفظ
 * - previewInput: مدخلات صالحة للحساب (تتجاهل الملاحظات الإلزامية) أو null
 */
function buildInput(
  employeeId: number | null,
  s: FormState
): { previewInput: EosFormInput | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  let calcValid = true;
  const fail = (key: FieldKey, message: string, affectsCalc: boolean) => {
    if (!errors[key]) errors[key] = message;
    if (affectsCalc) calcValid = false;
  };

  if (!employeeId) fail("employee", "اختر الموظف", true);

  const dates: Array<[keyof FormState, string]> = [
    ["hireDate", "تاريخ مباشرة العمل"],
    ["contractEndDate", "تاريخ انتهاء العقد"],
    ["lastWorkingDay", "آخر يوم عمل"],
    ["letterDate", "تاريخ الخطاب"],
  ];
  for (const [key, label] of dates) {
    const value = String(s[key]).trim();
    if (!value) fail(key, `${label} مطلوب`, true);
    else if (!parseDateOnly(value)) fail(key, `${label} غير صحيح`, true);
  }
  if (
    !errors.hireDate &&
    !errors.lastWorkingDay &&
    s.lastWorkingDay < s.hireDate
  ) {
    fail("lastWorkingDay", "آخر يوم عمل يجب أن يكون بعد تاريخ المباشرة", true);
  }

  const baseSalary = parseNonNegative(s.baseSalary, MAX_AMOUNT, null);
  if (!baseSalary.ok || baseSalary.value === null)
    fail("baseSalary", "الراتب الأساسي مطلوب ويجب أن يكون رقماً صحيحاً", true);
  const fixedAllowances = parseNonNegative(s.fixedAllowances, MAX_AMOUNT, 0);
  if (!fixedAllowances.ok)
    fail("fixedAllowances", "قيمة البدلات غير صحيحة", true);

  let salaryOverride: number | null = null;
  if (s.salaryManual) {
    const r = parseNonNegative(s.salaryDays, MAX_DAYS, null);
    if (!r.ok || r.value === null)
      fail("salaryDays", "أدخل أيام الأجر المستحق", false);
    else salaryOverride = r.value;
    if (!s.salaryNote.trim())
      fail("salaryNote", "سبب تعديل أيام الأجر مطلوب", false);
  }

  const otherAdditions = parseNonNegative(s.otherAdditions, MAX_AMOUNT, 0);
  if (!otherAdditions.ok)
    fail("otherAdditions", "قيمة الإضافات غير صحيحة", true);
  else if ((otherAdditions.value ?? 0) > 0 && !s.otherAdditionsNote.trim())
    fail("otherAdditionsNote", "اكتب بيان الإضافات الأخرى", false);

  const otherDeductions = parseNonNegative(s.otherDeductions, MAX_AMOUNT, 0);
  if (!otherDeductions.ok)
    fail("otherDeductions", "قيمة الخصومات غير صحيحة", true);
  else if ((otherDeductions.value ?? 0) > 0 && !s.otherDeductionsNote.trim())
    fail("otherDeductionsNote", "اكتب بيان الخصومات الأخرى", false);

  if (!calcValid || !employeeId) return { previewInput: null, errors };

  const num = (r: ReturnType<typeof parseNonNegative>) =>
    r.ok ? (r.value ?? 0) : 0;
  return {
    errors,
    previewInput: {
      employeeId,
      hireDate: s.hireDate.trim(),
      contractEndDate: s.contractEndDate.trim(),
      lastWorkingDay: s.lastWorkingDay.trim(),
      letterDate: s.letterDate.trim(),
      nationality: textOrNull(s.nationality),
      idNumber: textOrNull(s.idNumber),
      baseSalary: num(baseSalary),
      fixedAllowances: num(fixedAllowances),
      salaryDaysOverride: salaryOverride,
      salaryNote: s.salaryManual ? textOrNull(s.salaryNote) : null,
      otherAdditions: num(otherAdditions),
      otherAdditionsNote:
        num(otherAdditions) > 0 ? textOrNull(s.otherAdditionsNote) : null,
      otherDeductions: num(otherDeductions),
      otherDeductionsNote:
        num(otherDeductions) > 0 ? textOrNull(s.otherDeductionsNote) : null,
      notes: textOrNull(s.notes),
    },
  };
}

// ==================== مكونات مساعدة ====================

function Field({
  label,
  required,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-sm font-semibold border-b pb-1.5 mb-3">{children}</h3>
  );
}

/** الخطوة 1: اختيار موظف نشط */
function EmployeePicker({
  onSelect,
}: {
  onSelect: (employeeId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const employeesQuery = trpc.employees.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const employees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (employeesQuery.data ?? [])
      .filter(e => e.isActive)
      .filter(
        e =>
          !term ||
          e.name.toLowerCase().includes(term) ||
          e.code.toLowerCase().includes(term)
      );
  }, [employeesQuery.data, search]);

  return (
    <div className="space-y-3">
      <div>
        <SectionTitle>الخطوة 1: اختيار الموظف</SectionTitle>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث باسم الموظف أو الكود"
            className="pr-10"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          تظهر الموظفون النشطون فقط
        </p>
      </div>

      {employeesQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : employeesQuery.error ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-red-600 text-sm">
            تعذر تحميل الموظفين: {employeesQuery.error.message}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => employeesQuery.refetch()}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة المحاولة
          </Button>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {search.trim()
            ? "لا يوجد موظف نشط يطابق البحث"
            : "لا يوجد موظفون نشطون"}
        </div>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border divide-y">
          {employees.map(e => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e.id)}
              className="w-full text-right px-3 py-2.5 hover:bg-muted/60 focus:bg-muted/60 focus:outline-none flex items-center gap-3"
            >
              <UserCircle className="w-8 h-8 text-muted-foreground shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{e.name}</span>
                <span className="block text-xs text-muted-foreground">
                  <span className="font-mono">{e.code}</span>
                  {e.branchName ? ` - ${e.branchName}` : ""}
                  {e.position ? ` - ${e.position}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** لوحة المعاينة الحية للحساب */
function PreviewPanel({
  ready,
  debouncing,
  query,
  notes,
}: {
  ready: boolean;
  debouncing: boolean;
  query: {
    data?: EosPreview;
    error: { message: string } | null;
    isFetching: boolean;
    isLoading: boolean;
  };
  notes: Parameters<typeof CalculationBreakdown>[0]["notes"];
}) {
  const updating = ready && (debouncing || query.isFetching);
  return (
    <div className="rounded-xl border bg-muted/20 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          الحساب المبدئي للمخالصة
        </h3>
        {updating && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            جاري التحديث
          </span>
        )}
      </div>

      {!ready ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          أكمل التواريخ والأجر لعرض الحساب
        </p>
      ) : query.error && !debouncing ? (
        <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {query.error.message}
        </div>
      ) : query.data ? (
        <div
          className={
            updating ? "opacity-60 transition-opacity" : "transition-opacity"
          }
        >
          <CalculationBreakdown
            calculation={query.data.calculation}
            advances={query.data.advances}
            violations={query.data.violations}
            lastPayroll={query.data.lastPayroll}
            notes={notes}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        يُحسب على الخادم بنفس دالة الحفظ: مكافأة نهاية الخدمة مبلغ ثابت{" "}
        {formatSar(END_OF_SERVICE_FIXED_AWARD)} حسب سياسة المنشأة، وأجر اليوم = الأجر
        الشهري ÷ 30.
      </p>
    </div>
  );
}

// ==================== النموذج ====================

export interface EndOfServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** تعديل مسودة قائمة (بدونها: إنشاء جديد) */
  settlement?: {
    id: number;
    settlementNumber: string;
    employeeName: string;
    form: EosFormInput;
  } | null;
  /** اختيار موظف مسبقاً عند الإنشاء */
  initialEmployeeId?: number | null;
  onCreated?: (id: number) => void;
  onSaved?: () => void;
}

export default function EndOfServiceForm({
  open,
  onOpenChange,
  settlement,
  initialEmployeeId,
  onCreated,
  onSaved,
}: EndOfServiceFormProps) {
  const isEdit = !!settlement;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [employeeId, setEmployeeId] = useState<number | null>(
    settlement?.form.employeeId ?? initialEmployeeId ?? null
  );
  const [form, setForm] = useState<FormState>(() =>
    settlement ? stateFromForm(settlement.form) : emptyState()
  );
  // آخر يوم عمل يتبع تاريخ انتهاء العقد حتى يعدّله المستخدم
  const [lastDayFollowsContract, setLastDayFollowsContract] = useState(
    () =>
      !settlement ||
      settlement.form.lastWorkingDay === settlement.form.contractEndDate
  );
  const [prefilledFor, setPrefilledFor] = useState<number | null>(
    settlement ? settlement.form.employeeId : null
  );
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // بيانات الموظف الافتراضية (في التعديل: للاطلاع على تفصيل الأجر فقط)
  const defaultsQuery = trpc.endOfService.defaults.useQuery(
    { employeeId: employeeId ?? 0 },
    {
      enabled: open && !!employeeId,
      retry: retryUnlessFinal,
      refetchOnWindowFocus: false,
    }
  );
  const defaults: EosDefaults | undefined =
    defaultsQuery.data && defaultsQuery.data.employee.id === employeeId
      ? defaultsQuery.data
      : undefined;

  useEffect(() => {
    if (isEdit || !defaults || prefilledFor === defaults.employee.id) return;
    setForm(stateFromDefaults(defaults));
    setLastDayFollowsContract(true);
    setShowErrors(false);
    setPrefilledFor(defaults.employee.id);
  }, [isEdit, defaults, prefilledFor]);

  const blockedReason: ReactNode = (() => {
    if (isEdit || !defaults) return null;
    if (defaults.existing) {
      return (
        <>
          توجد مخالصة إنهاء خدمة قائمة لهذا الموظف برقم{" "}
          <span className="font-mono font-semibold">
            {defaults.existing.settlementNumber}
          </span>{" "}
          ({getEndOfServiceStatusLabel(defaults.existing.status).ar}). لا يمكن
          إنشاء مخالصة أخرى حتى تُلغى القائمة.
        </>
      );
    }
    if (!defaults.employee.isActive)
      return <>الموظف غير نشط، لا يمكن إنشاء إنهاء خدمة له.</>;
    return null;
  })();

  const waitingForDefaults =
    !isEdit && !!employeeId && prefilledFor !== employeeId;

  const { previewInput, errors } = useMemo(
    () => buildInput(employeeId, form),
    [employeeId, form]
  );
  // الملاحظات لا تدخل في الحساب: تُستبعد من المعاينة حتى لا يطول رابط الطلب ولا يُعاد الحساب مع كل حرف
  const previewKey =
    previewInput && !waitingForDefaults && !blockedReason
      ? JSON.stringify({
          ...previewInput,
          salaryNote: null,
          otherAdditionsNote: null,
          otherDeductionsNote: null,
          notes: null,
        })
      : "";
  const debouncedKey = useDebouncedValue(previewKey, 400);
  const debouncedInput = useMemo(
    () => (debouncedKey ? (JSON.parse(debouncedKey) as EosFormInput) : null),
    [debouncedKey]
  );

  const previewQuery = trpc.endOfService.preview.useQuery(
    debouncedInput as EosFormInput,
    {
      enabled: open && !!debouncedInput,
      retry: false,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    }
  );
  const previewData: EosPreview | undefined = previewQuery.data;

  const createMutation = trpc.endOfService.create.useMutation();
  const updateMutation = trpc.endOfService.update.useMutation();
  const saving = createMutation.isPending || updateMutation.isPending;

  const fieldError = (key: FieldKey) => (showErrors ? errors[key] : undefined);

  const handleContractEndChange = (value: string) =>
    setForm(prev => ({
      ...prev,
      contractEndDate: value,
      lastWorkingDay: lastDayFollowsContract ? value : prev.lastWorkingDay,
    }));

  const handleLastDayChange = (value: string) => {
    setLastDayFollowsContract(value === form.contractEndDate);
    set("lastWorkingDay", value);
  };

  const toggleSalaryManual = (checked: boolean) =>
    setForm(prev => ({
      ...prev,
      salaryManual: checked,
      salaryDays:
        checked && !prev.salaryDays && previewData
          ? formatDays(previewData.calculation.computedSalaryDays)
          : prev.salaryDays,
    }));

  const changeEmployee = () => {
    setEmployeeId(null);
    setPrefilledFor(null);
    setForm(emptyState());
    setShowErrors(false);
  };

  const handleSave = async () => {
    const firstError = Object.values(errors)[0];
    if (firstError || !previewInput) {
      setShowErrors(true);
      toast.error(firstError || "أكمل البيانات المطلوبة");
      return;
    }
    if (blockedReason) {
      toast.error("لا يمكن إنشاء إنهاء خدمة لهذا الموظف");
      return;
    }
    try {
      if (settlement) {
        const result: { success: boolean; message: string } =
          await updateMutation.mutateAsync({
            id: settlement.id,
            ...previewInput,
          });
        toast.success(result.message || "تم حفظ التعديلات");
        await Promise.all([
          utils.endOfService.getById.invalidate({ id: settlement.id }),
          utils.endOfService.list.invalidate(),
        ]);
        onSaved?.();
        onOpenChange(false);
      } else {
        const result: {
          id: number;
          requestId: number;
          settlementNumber: string;
          message: string;
        } = await createMutation.mutateAsync(previewInput);
        toast.success(
          result.message || `تم إنشاء المخالصة ${result.settlementNumber}`
        );
        void utils.endOfService.list.invalidate();
        void utils.employeeRequests.list.invalidate();
        onOpenChange(false);
        onCreated?.(result.id);
      }
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isEdit ? "فشل حفظ تعديلات المخالصة" : "فشل إنشاء إنهاء الخدمة"
        )
      );
    }
  };

  const employeeHeader = defaults
    ? {
        name: defaults.employee.name,
        code: defaults.employee.code,
        branchName: defaults.employee.branchName,
      }
    : settlement
      ? {
          name: settlement.employeeName,
          code: "",
          branchName: null as string | null,
        }
      : null;

  const monthlyWage = (() => {
    const base = Number(form.baseSalary) || 0;
    const allowances = Number(form.fixedAllowances) || 0;
    return roundMoney(Math.max(0, base) + Math.max(0, allowances));
  })();

  return (
    <Dialog open={open} onOpenChange={value => !saving && onOpenChange(value)}>
      <DialogContent
        className="sm:max-w-6xl max-h-[94vh] overflow-y-auto p-4 sm:p-6"
        dir="rtl"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-600" />
            {isEdit
              ? `تعديل مخالصة ${settlement!.settlementNumber}`
              : "إنهاء خدمة جديد"}
            <span className="text-sm text-muted-foreground font-normal hidden sm:inline">
              - انتهاء العقد وعدم التجديد
            </span>
          </DialogTitle>
          <DialogDescription>
            يُصدر خطاب إشعار انتهاء عقد العمل وعدم التجديد ومخالصة نهائية وإبراء
            ذمة. تظهر التوقيعات والختم بعد اعتماد الإدارة فقط.
          </DialogDescription>
        </DialogHeader>

        {!employeeId ? (
          <EmployeePicker
            onSelect={id => {
              setEmployeeId(id);
              setPrefilledFor(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* الموظف المختار */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <UserCircle className="w-9 h-9 text-muted-foreground shrink-0" />
                {employeeHeader ? (
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {employeeHeader.name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                      {employeeHeader.code && (
                        <span className="font-mono">{employeeHeader.code}</span>
                      )}
                      {employeeHeader.branchName && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {employeeHeader.branchName}
                        </span>
                      )}
                    </p>
                  </div>
                ) : defaultsQuery.error ? (
                  <p className="text-sm text-red-600">
                    تعذر تحميل بيانات الموظف
                  </p>
                ) : (
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                )}
              </div>
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={changeEmployee}
                  disabled={saving}
                >
                  تغيير الموظف
                </Button>
              )}
            </div>

            {!isEdit && defaultsQuery.error && !defaults && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>تعذر تحميل بيانات الموظف</AlertTitle>
                <AlertDescription>
                  <p>{defaultsQuery.error.message}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => defaultsQuery.refetch()}
                  >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    إعادة المحاولة
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {blockedReason && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>لا يمكن إنشاء إنهاء خدمة</AlertTitle>
                <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
                  <p>{blockedReason}</p>
                  {defaults?.existing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/end-of-service/${defaults.existing!.id}`);
                      }}
                    >
                      <ExternalLink className="w-4 h-4 ml-2" />
                      فتح المخالصة القائمة
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {waitingForDefaults && !defaultsQuery.error ? (
              <div className="grid lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
                <Skeleton className="lg:col-span-2 h-80 w-full" />
              </div>
            ) : !waitingForDefaults && !blockedReason ? (
              <div className="grid lg:grid-cols-5 gap-5 items-start">
                {/* البيانات */}
                <div className="lg:col-span-3 space-y-5">
                  <section>
                    <SectionTitle>التواريخ</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="تاريخ مباشرة العمل"
                        required
                        error={fieldError("hireDate")}
                        hint={
                          defaults && !defaults.employee.hireDate
                            ? "غير مسجل في ملف الموظف - أدخله يدوياً"
                            : undefined
                        }
                      >
                        <Input
                          type="date"
                          value={form.hireDate}
                          onChange={e => set("hireDate", e.target.value)}
                        />
                      </Field>
                      <Field
                        label="تاريخ انتهاء العقد"
                        required
                        error={fieldError("contractEndDate")}
                        hint={
                          defaults && !defaults.employee.contractEndDate
                            ? "غير مسجل في ملف الموظف - أدخله يدوياً"
                            : undefined
                        }
                      >
                        <Input
                          type="date"
                          value={form.contractEndDate}
                          onChange={e =>
                            handleContractEndChange(e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="آخر يوم عمل"
                        required
                        error={fieldError("lastWorkingDay")}
                        hint={
                          lastDayFollowsContract
                            ? "افتراضياً تاريخ انتهاء العقد"
                            : undefined
                        }
                      >
                        <Input
                          type="date"
                          value={form.lastWorkingDay}
                          onChange={e => handleLastDayChange(e.target.value)}
                        />
                      </Field>
                      <Field
                        label="تاريخ الخطاب"
                        required
                        error={fieldError("letterDate")}
                      >
                        <Input
                          type="date"
                          value={form.letterDate}
                          onChange={e => set("letterDate", e.target.value)}
                        />
                      </Field>
                    </div>
                  </section>

                  <section>
                    <SectionTitle>بيانات الموظف في الخطاب</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="الجنسية">
                        <Input
                          value={form.nationality}
                          onChange={e => set("nationality", e.target.value)}
                          maxLength={100}
                          placeholder="مثال: مصري"
                        />
                      </Field>
                      <Field label="رقم الهوية / الإقامة">
                        <Input
                          value={form.idNumber}
                          onChange={e => set("idNumber", e.target.value)}
                          maxLength={50}
                          dir="ltr"
                          className="text-right"
                        />
                      </Field>
                      <Field label="المسمى الوظيفي">
                        {/* ثابت من علامة المشرف في ملف الموظف: حلاق أو مشرف */}
                        <Input
                          value={defaults?.employee.position ?? ""}
                          readOnly
                          disabled
                          title="يتحدد تلقائياً: مشرف لحساب المشرف، وحلاق لغيره"
                        />
                      </Field>
                    </div>
                  </section>

                  <section>
                    <SectionTitle>الأجر المعتمد للحساب</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="الراتب الأساسي الشهري"
                        required
                        error={fieldError("baseSalary")}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={form.baseSalary}
                          onChange={e => set("baseSalary", e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field
                        label="البدلات الثابتة الشهرية"
                        error={fieldError("fixedAllowances")}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={form.fixedAllowances}
                          onChange={e => set("fixedAllowances", e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                    </div>
                    {defaults && defaults.wage.breakdown.length > 0 && (
                      <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                        <p className="font-medium text-muted-foreground">
                          تفصيل الأجر حسب إعدادات راتب الموظف
                          {isEdit ? " الحالية" : ""}:
                        </p>
                        {defaults.wage.breakdown.map(line => (
                          <div
                            key={line.label}
                            className="flex justify-between gap-2"
                          >
                            <span>{line.label}</span>
                            <span className="tabular-nums" dir="ltr">
                              {formatSar(line.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      الأجر الشهري المعتمد = الأساسي + البدلات الثابتة ={" "}
                      <span className="font-semibold tabular-nums">
                        {formatSar(monthlyWage)}
                      </span>
                    </p>
                  </section>

                  <section className="space-y-3">
                    <SectionTitle>تعديلات يدوية (اختيارية)</SectionTitle>

                    <div className="rounded-lg border p-3 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={form.salaryManual}
                          onCheckedChange={value =>
                            toggleSalaryManual(value === true)
                          }
                        />
                        <span className="text-sm font-medium">
                          تعديل أيام الأجر المستحق يدوياً
                        </span>
                        {previewData && !form.salaryManual && (
                          <span className="text-xs text-muted-foreground">
                            (المحسوب{" "}
                            {formatDays(
                              previewData.calculation.computedSalaryDays
                            )}{" "}
                            يوم)
                          </span>
                        )}
                      </label>
                      {form.salaryManual && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Field
                            label="أيام الأجر المستحق"
                            required
                            error={fieldError("salaryDays")}
                          >
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.5"
                              value={form.salaryDays}
                              onChange={e => set("salaryDays", e.target.value)}
                            />
                          </Field>
                          <Field
                            label="سبب التعديل"
                            required
                            error={fieldError("salaryNote")}
                            className="sm:col-span-2"
                          >
                            <Input
                              value={form.salaryNote}
                              onChange={e => set("salaryNote", e.target.value)}
                              maxLength={2000}
                              placeholder="مثال: صُرف له نصف الشهر في المسيرة"
                            />
                          </Field>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field
                        label="إضافات أخرى"
                        error={fieldError("otherAdditions")}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={form.otherAdditions}
                          onChange={e => set("otherAdditions", e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field
                        label="بيان الإضافات"
                        required={Number(form.otherAdditions) > 0}
                        error={fieldError("otherAdditionsNote")}
                        className="sm:col-span-2"
                      >
                        <Input
                          value={form.otherAdditionsNote}
                          onChange={e =>
                            set("otherAdditionsNote", e.target.value)
                          }
                          maxLength={2000}
                          placeholder="مثال: بدل تذكرة سفر"
                        />
                      </Field>
                      <Field
                        label="خصومات أخرى"
                        error={fieldError("otherDeductions")}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={form.otherDeductions}
                          onChange={e => set("otherDeductions", e.target.value)}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field
                        label="بيان الخصومات"
                        required={Number(form.otherDeductions) > 0}
                        error={fieldError("otherDeductionsNote")}
                        className="sm:col-span-2"
                      >
                        <Input
                          value={form.otherDeductionsNote}
                          onChange={e =>
                            set("otherDeductionsNote", e.target.value)
                          }
                          maxLength={2000}
                          placeholder="مثال: عهدة غير مُسلّمة"
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      السلف غير المسددة والمخالفات غير المخصومة تُخصم تلقائياً
                      وتظهر في الحساب.
                    </p>
                  </section>

                  <section>
                    <Field label="ملاحظات">
                      <Textarea
                        value={form.notes}
                        onChange={e => set("notes", e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="ملاحظات اختيارية تظهر في المخالصة"
                      />
                    </Field>
                  </section>
                </div>

                {/* الحساب */}
                <div className="lg:col-span-2 lg:sticky lg:top-0">
                  <PreviewPanel
                    ready={!!previewKey}
                    debouncing={previewKey !== debouncedKey}
                    query={{
                      data: previewData,
                      error: previewQuery.error
                        ? {
                            message: errorMessage(
                              previewQuery.error,
                              "تعذر حساب المخالصة"
                            ),
                          }
                        : null,
                      isFetching: previewQuery.isFetching,
                      isLoading: previewQuery.isLoading,
                    }}
                    notes={{
                      salaryNote: form.salaryNote,
                      otherAdditionsNote: form.otherAdditionsNote,
                      otherDeductionsNote: form.otherDeductionsNote,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            إلغاء
          </Button>
          {employeeId && (
            <Button
              onClick={handleSave}
              disabled={saving || waitingForDefaults || !!blockedReason}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              {saving
                ? "جاري الحفظ..."
                : isEdit
                  ? "حفظ التعديلات"
                  : "حفظ كمسودة"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
