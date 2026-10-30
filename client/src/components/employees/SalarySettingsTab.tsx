/**
 * تبويب الراتب في ملف الموظف: الراتب الأساسي، بدل الساعات الإضافية، مشرف الفرع،
 * الخصم الثابت، والبيانات البنكية. يُحفظ عبر salarySettings.save ويُطبق على المسيرات المفتوحة.
 */

import { useMemo } from "react";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2, Save, Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SALARY_AMOUNT_MAX,
  isValidIban,
  normalizeIban,
} from "@shared/employeeFile";
import { formatVoucherAmount } from "@shared/vouchers";
import type { EmployeeFileData } from "./types";
import { useInvalidateEmployeeFile } from "./EmployeeFileParts";
import { useSyncedForm } from "./useSyncedForm";
import { errorMessage } from "./utils";

interface SalaryForm {
  baseSalary: string;
  overtimeEnabled: boolean;
  overtimeRate: string;
  isSupervisor: boolean;
  supervisorIncentive: string;
  fixedDeduction: string;
  fixedDeductionReason: string;
  bankName: string;
  bankAccount: string;
  iban: string;
}

type SalaryChanges = Omit<
  inferRouterInputs<AppRouter>["salarySettings"]["save"],
  "employeeId"
>;

const AMOUNT_FIELDS = [
  "baseSalary",
  "overtimeRate",
  "supervisorIncentive",
  "fixedDeduction",
] as const;
const TEXT_FIELDS = [
  "fixedDeductionReason",
  "bankName",
  "bankAccount",
] as const;

function toForm(salary: EmployeeFileData["salary"]): SalaryForm {
  return {
    baseSalary: String(salary.baseSalary),
    overtimeEnabled: salary.overtimeEnabled,
    overtimeRate: String(salary.overtimeRate),
    isSupervisor: salary.isSupervisor,
    supervisorIncentive: String(salary.supervisorIncentive),
    fixedDeduction: String(salary.fixedDeduction),
    fixedDeductionReason: salary.fixedDeductionReason ?? "",
    bankName: salary.bankName ?? "",
    bankAccount: salary.bankAccount ?? "",
    iban: salary.iban ?? "",
  };
}

function parseAmount(value: string): number | null {
  const n = Number(String(value).replace(/,/g, "").trim());
  return value.trim() !== "" &&
    Number.isFinite(n) &&
    n >= 0 &&
    n <= SALARY_AMOUNT_MAX
    ? n
    : null;
}

const sar = (value: number) => `${formatVoucherAmount(value)} ر.س`;

export function SalarySettingsTab({
  file,
  canEdit,
}: {
  file: EmployeeFileData;
  canEdit: boolean;
}) {
  const employeeId = file.employee.id;
  const source = useMemo(() => toForm(file.salary), [file.salary]);
  const { form, update, reset, acceptNext, dirty } = useSyncedForm(source);
  const invalidate = useInvalidateEmployeeFile();
  const utils = trpc.useUtils();

  const save = trpc.salarySettings.save.useMutation({
    onSuccess: async result => {
      acceptNext();
      const synced =
        result.openPayrollsUpdated > 0
          ? ` وتحديث ${result.openPayrollsUpdated} مسير مفتوح`
          : "";
      toast.success(`تم حفظ إعدادات الراتب${synced}`);
      if (result.openPayrollsFailed > 0) {
        toast.warning(
          "تعذر تحديث بعض المسيرات المفتوحة، أعد حسابها من صفحة مسيرات الرواتب"
        );
      }
      await Promise.all([invalidate(employeeId), utils.payrolls.invalidate()]);
    },
    onError: error =>
      toast.error(errorMessage(error, "تعذر حفظ إعدادات الراتب")),
  });

  if (!form) return null;

  const amounts = Object.fromEntries(
    AMOUNT_FIELDS.map(f => [f, parseAmount(form[f])])
  ) as Record<(typeof AMOUNT_FIELDS)[number], number | null>;
  const ibanInvalid = !!normalizeIban(form.iban) && !isValidIban(form.iban);
  const amountErrors = AMOUNT_FIELDS.filter(f => amounts[f] === null);

  const gross =
    (amounts.baseSalary ?? 0) +
    (form.overtimeEnabled ? (amounts.overtimeRate ?? 0) : 0) +
    (form.isSupervisor ? (amounts.supervisorIncentive ?? 0) : 0);
  const net = gross - (amounts.fixedDeduction ?? 0);

  const handleSave = () => {
    if (amountErrors.length > 0) {
      toast.error("أدخل مبالغ صحيحة (صفر أو أكثر)");
      return;
    }
    if (ibanInvalid) {
      toast.error("رقم الآيبان غير صحيح");
      return;
    }
    // الحقول المتغيرة فقط (الحفظ جزئي في الخادم)
    const changes: SalaryChanges = {};
    for (const f of AMOUNT_FIELDS)
      if (form[f] !== source[f]) changes[f] = amounts[f] ?? undefined;
    for (const f of TEXT_FIELDS)
      if (form[f] !== source[f]) changes[f] = form[f].trim() || null;
    if (form.iban !== source.iban)
      changes.iban = normalizeIban(form.iban) || null;
    if (form.overtimeEnabled !== source.overtimeEnabled)
      changes.overtimeEnabled = form.overtimeEnabled;
    if (
      form.isSupervisor !== source.isSupervisor ||
      file.salary.supervisorFlagMismatch
    ) {
      changes.isSupervisor = form.isSupervisor;
    }
    // أول حفظ: تُثبَّت القيم المعروضة (حتى الافتراضية) في إعدادات الموظف
    if (file.salary.isDefault) {
      for (const f of AMOUNT_FIELDS) changes[f] = amounts[f] ?? undefined;
      changes.overtimeEnabled = form.overtimeEnabled;
      changes.isSupervisor = form.isSupervisor;
    }
    if (Object.keys(changes).length === 0) {
      toast.info("لا توجد تغييرات للحفظ");
      return;
    }
    save.mutate({ employeeId, ...changes });
  };

  const disabled = !canEdit || save.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {file.salary.isDefault && (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          >
            لم تُحفظ إعدادات بعد: تُطبق القيم الافتراضية
          </Badge>
        )}
        {!canEdit && <Badge variant="secondary">عرض فقط</Badge>}
      </div>

      {file.salary.supervisorFlagMismatch && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            صلاحية المشرف في بوابة الموظفين لا تطابق حافز المشرف في الراتب. عند
            الحفظ يُوحَّدان حسب خيار "مشرف فرع".
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="baseSalary">الراتب الأساسي (ر.س) *</Label>
          <Input
            id="baseSalary"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.baseSalary}
            onChange={e => update("baseSalary", e.target.value)}
            disabled={disabled}
            aria-invalid={amounts.baseSalary === null}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="overtimeEnabled"
            checked={form.overtimeEnabled}
            onCheckedChange={checked =>
              update("overtimeEnabled", checked === true)
            }
            disabled={disabled}
          />
          <Label
            htmlFor="overtimeEnabled"
            className="cursor-pointer font-semibold"
          >
            بدل ساعات إضافية
          </Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="overtimeRate">قيمة البدل الشهري (ر.س)</Label>
            <Input
              id="overtimeRate"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.overtimeRate}
              onChange={e => update("overtimeRate", e.target.value)}
              disabled={disabled || !form.overtimeEnabled}
              aria-invalid={amounts.overtimeRate === null}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="isSupervisor"
            checked={form.isSupervisor}
            onCheckedChange={checked =>
              update("isSupervisor", checked === true)
            }
            disabled={disabled}
          />
          <Label
            htmlFor="isSupervisor"
            className="cursor-pointer font-semibold"
          >
            مشرف فرع
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          يستحق حافز المشرف في المسير، ويمنحه صلاحية مراجعة طلبات موظفي فرعه في
          بوابة الموظفين
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="supervisorIncentive">حافز المشرف (ر.س)</Label>
            <Input
              id="supervisorIncentive"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.supervisorIncentive}
              onChange={e => update("supervisorIncentive", e.target.value)}
              disabled={disabled || !form.isSupervisor}
              aria-invalid={amounts.supervisorIncentive === null}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fixedDeduction">خصم ثابت شهري (ر.س)</Label>
          <Input
            id="fixedDeduction"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.fixedDeduction}
            onChange={e => update("fixedDeduction", e.target.value)}
            disabled={disabled}
            aria-invalid={amounts.fixedDeduction === null}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fixedDeductionReason">سبب الخصم</Label>
          <Textarea
            id="fixedDeductionReason"
            rows={1}
            maxLength={500}
            value={form.fixedDeductionReason}
            onChange={e => update("fixedDeductionReason", e.target.value)}
            disabled={disabled}
            placeholder="مثال: سكن"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="bankName">اسم البنك</Label>
          <Input
            id="bankName"
            maxLength={100}
            value={form.bankName}
            onChange={e => update("bankName", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankAccount">رقم الحساب</Label>
          <Input
            id="bankAccount"
            dir="ltr"
            maxLength={50}
            value={form.bankAccount}
            onChange={e => update("bankAccount", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="iban">الآيبان (IBAN)</Label>
          <Input
            id="iban"
            dir="ltr"
            maxLength={50}
            placeholder="SA00 0000 0000 0000 0000 0000"
            value={form.iban}
            onChange={e => update("iban", e.target.value)}
            disabled={disabled}
            aria-invalid={ibanInvalid}
          />
          {ibanInvalid && (
            <p className="text-xs text-red-600">رقم الآيبان غير صحيح</p>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            الإجمالي الشهري المتوقع: <strong>{sar(gross)}</strong>
          </span>
          <span>
            بعد الخصم الثابت: <strong>{sar(net)}</strong>
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          قبل الغياب والسلف والمخالفات (تُحسب في المسير)
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          يُطبق على المسيرات المفتوحة (مسودة أو بانتظار الاعتماد) فور الحفظ، ولا
          تتغير المسيرات المعتمدة أو المدفوعة.
        </AlertDescription>
      </Alert>

      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={reset}
            disabled={!dirty || save.isPending}
          >
            <Undo2 className="ml-2 h-4 w-4" />
            تراجع
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              save.isPending ||
              (!dirty &&
                !file.salary.isDefault &&
                !file.salary.supervisorFlagMismatch)
            }
          >
            {save.isPending ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            {save.isPending ? "جاري الحفظ..." : "حفظ إعدادات الراتب"}
          </Button>
        </div>
      )}
    </div>
  );
}
