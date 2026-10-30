/**
 * تفاصيل حساب المخالصة النهائية (تُستخدم في معاينة النموذج وصفحة التفاصيل)
 */

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatVoucherDate } from "@shared/vouchers";
import type {
  EndOfServiceCalculation,
  EndOfServiceDeductionItem,
} from "@shared/endOfService";
import type { EosLastPayroll } from "./types";
import { formatDays, formatPayrollMonth, formatSar } from "./utils";

export interface CalculationNotes {
  salaryNote?: string | null;
  otherAdditionsNote?: string | null;
  otherDeductionsNote?: string | null;
}

function Row({
  label,
  value,
  hint,
  strong = false,
  negative = false,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 py-1.5 ${strong ? "font-semibold" : ""}`}
    >
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {hint}
          </div>
        )}
      </div>
      <div
        className={`text-sm whitespace-nowrap tabular-nums ${negative ? "text-red-600 dark:text-red-400" : ""}`}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card/50 px-3 py-2">
      <h4 className="text-xs font-semibold text-muted-foreground mb-1">
        {title}
      </h4>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function DeductionList({
  title,
  items,
  total,
}: {
  title: string;
  items: EndOfServiceDeductionItem[];
  total: number;
}) {
  if (items.length === 0) {
    return <Row label={title} value="0.00" hint="لا يوجد" />;
  }
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          {title}{" "}
          <span className="text-xs text-muted-foreground">
            ({items.length})
          </span>
        </span>
        <span
          className="text-sm whitespace-nowrap tabular-nums text-red-600 dark:text-red-400"
          dir="ltr"
        >
          - {formatSar(total)}
        </span>
      </div>
      <ul className="mt-1 space-y-0.5 pr-3 border-r-2 border-border">
        {items.map(item => (
          <li
            key={`${title}-${item.id}`}
            className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
          >
            <span className="min-w-0 truncate" title={item.label}>
              {item.label}
              {item.date ? ` - ${formatVoucherDate(item.date)}` : ""}
            </span>
            <span className="whitespace-nowrap tabular-nums" dir="ltr">
              {formatSar(item.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CalculationWarnings({
  warnings,
  title = "تنبيهات قبل الاعتماد",
}: {
  warnings: string[];
  title?: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
        <ul className="list-disc pr-4 space-y-1">
          {warnings.map(w => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/** صافي المخالصة مع التفقيط (السالب = مستحق على الموظف) */
export function NetAmountBox({
  calculation,
}: {
  calculation: EndOfServiceCalculation;
}) {
  const owedByEmployee = calculation.netAmount < 0;
  return (
    <div
      className={`rounded-lg p-4 border ${
        owedByEmployee
          ? "bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800"
          : "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {owedByEmployee ? "الصافي - مستحق على الموظف" : "صافي المستحق للموظف"}
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${owedByEmployee ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
          dir="ltr"
        >
          {formatSar(Math.abs(calculation.netAmount))}
        </span>
      </div>
      <p className="text-sm mt-2">{calculation.netAmountWords}</p>
      {owedByEmployee && (
        <p className="text-xs mt-1 text-red-700 dark:text-red-300">
          الخصومات أكبر من المستحقات: المبلغ أعلاه مستحق على الموظف للشركة.
        </p>
      )}
    </div>
  );
}

export function CalculationBreakdown({
  calculation: c,
  advances,
  violations,
  lastPayroll,
  notes = {},
  showWarnings = true,
}: {
  calculation: EndOfServiceCalculation;
  advances: EndOfServiceDeductionItem[];
  violations: EndOfServiceDeductionItem[];
  lastPayroll?: EosLastPayroll | null;
  notes?: CalculationNotes;
  showWarnings?: boolean;
}) {
  const salaryHint = (() => {
    if (c.salaryDaysIsManual) {
      return `${formatDays(c.salaryDays)} يوم (يدوي)${notes.salaryNote ? ` - ${notes.salaryNote}` : ""} - المحسوب ${formatDays(c.computedSalaryDays)} يوم`;
    }
    if (c.salaryCoveredByPayroll)
      return "مشمول بمسير رواتب لشهر آخر يوم عمل - لا أجر إضافي";
    if (c.salaryFromDate)
      return `${formatDays(c.salaryDays)} يوم من ${formatVoucherDate(c.salaryFromDate)} (بنظام 30 يوماً للشهر)`;
    return `${formatDays(c.salaryDays)} يوم`;
  })();

  return (
    <div className="space-y-3">
      <Section title="مدة الخدمة والأجر">
        <Row
          label="مدة الخدمة"
          value={<span dir="rtl">{c.serviceText}</span>}
          hint={`${c.service.totalDays.toLocaleString("en-US")} يوماً (${c.service.yearsDecimal.toFixed(2)} سنة)`}
        />
        <Row
          label="الأجر الشهري المعتمد للحساب"
          value={formatSar(c.monthlyWage)}
        />
        <Row label="أجر اليوم (الأجر ÷ 30)" value={formatSar(c.dailyWage)} />
      </Section>

      <Section title="المستحقات">
        <Row
          label="مكافأة نهاية الخدمة"
          value={formatSar(c.eosAward)}
          hint="مبلغ ثابت حسب سياسة المنشأة"
        />
        <Row
          label={
            <span className="inline-flex items-center gap-1.5">
              الأجر المستحق حتى آخر يوم عمل
              {c.salaryDaysIsManual && (
                <Badge variant="outline" className="text-[10px]">
                  يدوي
                </Badge>
              )}
            </span>
          }
          value={formatSar(c.salaryDue)}
          hint={
            <>
              {salaryHint}
              {lastPayroll && (
                <span className="block">
                  آخر مسير شمل الموظف: {formatPayrollMonth(lastPayroll)}
                  {lastPayroll.payrollNumber
                    ? ` (${lastPayroll.payrollNumber})`
                    : ""}
                </span>
              )}
            </>
          }
        />
        {c.otherAdditions > 0 && (
          <Row
            label="إضافات أخرى"
            value={formatSar(c.otherAdditions)}
            hint={notes.otherAdditionsNote || undefined}
          />
        )}
        <Row
          label="إجمالي المستحقات"
          value={formatSar(c.totalEntitlements)}
          strong
        />
      </Section>

      <Section title="الخصومات">
        <DeductionList
          title="السلف غير المسددة"
          items={advances}
          total={c.advancesDeduction}
        />
        <DeductionList
          title="المخالفات غير المخصومة"
          items={violations}
          total={c.violationsDeduction}
        />
        {c.otherDeductions > 0 && (
          <Row
            label="خصومات أخرى"
            value={`- ${formatSar(c.otherDeductions)}`}
            hint={notes.otherDeductionsNote || undefined}
            negative
          />
        )}
        <Row
          label="إجمالي الخصومات"
          value={
            c.totalDeductions > 0
              ? `- ${formatSar(c.totalDeductions)}`
              : formatSar(0)
          }
          strong
          negative={c.totalDeductions > 0}
        />
      </Section>

      <NetAmountBox calculation={c} />

      {showWarnings && <CalculationWarnings warnings={c.warnings} />}
    </div>
  );
}
