/**
 * مسيرات الراتب في بوابة الموظفين
 * - القائمة من المسيرات المعتمدة/المصروفة فقط (الأحدث أولاً)
 * - مسيرة الراتب مفصلة من لقطة المسير (البنود وتفاصيلها، الحضور، الإجماليات، الصافي كتابةً، الاعتماد)
 * - تحميل PDF رسمي من الخادم، والطباعة من نفس القالب المشترك
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Printer,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { downloadBase64Pdf, openHtmlDocument } from "@/lib/portal/documents";
import {
  buildPayslipDeductions,
  buildPayslipEarnings,
  errorMessage,
  formatPortalDate,
  formatPortalDateTime,
  formatSar,
  netSalaryInWords,
  payrollPeriodLabel,
  payslipStatusInfo,
  pickPayrollId,
  shouldRetryQuery,
  toAmount,
  type PayslipLine,
} from "@/lib/portal/portalUi";
import { getEstablishmentForBranch } from "@shared/branding";
import {
  renderPayslipHtml,
  type PayslipDocumentData,
} from "@shared/payslipTemplate";
import { PortalLoading, PortalQueryError } from "./PortalQueryState";

/** صف في قائمة مسيرات الراتب (employeePortal.getSalarySlips) */
export interface PortalSalarySlipSummary {
  payrollId: number;
  payrollNumber: string;
  year: number;
  month: number;
  status: "approved" | "paid";
  netSalary: number;
  approvedAt: Date | null;
  paidAt: Date | null;
}

interface SalarySlipProps {
  /** مسيرة راتب محددة من رابط الإشعار (?payrollId=) */
  initialPayrollId?: number | null;
}

export function SalarySlip({ initialPayrollId = null }: SalarySlipProps) {
  const [selectedId, setSelectedId] = useState<number | null>(initialPayrollId);

  useEffect(() => {
    if (initialPayrollId != null) setSelectedId(initialPayrollId);
  }, [initialPayrollId]);

  const slipsQuery = trpc.employeePortal.getSalarySlips.useQuery(undefined, {
    retry: shouldRetryQuery,
  });
  const slips: PortalSalarySlipSummary[] = slipsQuery.data ?? [];
  const payrollId = pickPayrollId(slips, selectedId);

  const slipQuery = trpc.employeePortal.getSalarySlip.useQuery(
    { payrollId: payrollId ?? 0 },
    { enabled: payrollId != null, retry: shouldRetryQuery }
  );
  const slip: PayslipDocumentData | undefined = slipQuery.data;

  const pdfMutation = trpc.employeePortal.payslipPdf.useMutation();

  const handleDownload = async () => {
    if (!slip) return;
    const toastId = `payslip-pdf-${slip.payrollId}`;
    toast.loading("جاري تجهيز ملف PDF...", { id: toastId });
    try {
      const result: { pdf: string; filename: string } =
        await pdfMutation.mutateAsync({ payrollId: slip.payrollId });
      downloadBase64Pdf(result.pdf, result.filename);
      toast.success("تم تحميل مسيرة الراتب", { id: toastId });
    } catch (error) {
      toast.error(errorMessage(error, "فشل توليد ملف PDF"), { id: toastId });
    }
  };

  // القالب يُبنى قبل فتح النافذة (متزامن مع النقر) حتى لا يحظرها المتصفح
  const handlePrint = () => {
    if (!slip) return;
    let html: string;
    try {
      html = renderPayslipHtml(slip, {
        assetBaseUrl: window.location.origin,
        autoPrint: true,
      });
    } catch (error) {
      console.error("[Portal] payslip print render failed", error);
      toast.error("تعذر تجهيز مسيرة الراتب للطباعة، استخدم تحميل PDF");
      return;
    }
    if (!openHtmlDocument(html)) {
      toast.error("يرجى السماح بالنوافذ المنبثقة في المتصفح للطباعة");
    }
  };

  // ==================== القائمة ====================

  if (slipsQuery.isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent>
          <PortalLoading label="جاري تحميل مسيرات الراتب..." />
        </CardContent>
      </Card>
    );
  }

  if (slipsQuery.error) {
    return (
      <PortalQueryError
        error={slipsQuery.error}
        title="تعذر تحميل مسيرات الراتب"
        onRetry={() => slipsQuery.refetch()}
        isRetrying={slipsQuery.isFetching}
      />
    );
  }

  if (slips.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-12 text-center">
          <Receipt className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300">لا توجد مسيرات رواتب معتمدة بعد</p>
          <p className="text-slate-500 text-sm mt-2">
            تظهر مسيرة الراتب هنا بعد اعتماد مسير الرواتب من الإدارة
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      {/* قائمة مسيرات الراتب */}
      <Card className="bg-slate-800/50 border-slate-700 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-500" />
            مسيرات الراتب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {slips.map(s => {
            const status = payslipStatusInfo(s.status);
            const active = s.payrollId === payrollId;
            return (
              <button
                key={s.payrollId}
                type="button"
                onClick={() => setSelectedId(s.payrollId)}
                aria-pressed={active}
                className={cn(
                  "w-full rounded-lg border p-3 text-right transition-colors",
                  active
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-slate-700 bg-slate-700/30 hover:bg-slate-700/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">
                    {payrollPeriodLabel(s.year, s.month)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-[11px]", status.className)}
                  >
                    {status.label}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">{s.payrollNumber}</span>
                  <span className="font-medium text-amber-400">
                    {formatSar(s.netSalary)}
                  </span>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* مسيرة الراتب المفصلة */}
      <div className="min-w-0">
        {slipQuery.isLoading ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent>
              <PortalLoading label="جاري تحميل مسيرة الراتب..." />
            </CardContent>
          </Card>
        ) : slipQuery.error ? (
          <PortalQueryError
            error={slipQuery.error}
            title="تعذر تحميل مسيرة الراتب"
            onRetry={() => slipQuery.refetch()}
            isRetrying={slipQuery.isFetching}
          />
        ) : slip ? (
          <PayslipDetail
            slip={slip}
            onDownload={handleDownload}
            onPrint={handlePrint}
            isDownloading={pdfMutation.isPending}
          />
        ) : null}
      </div>
    </div>
  );
}

// ==================== تفاصيل مسيرة الراتب ====================

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="truncate font-medium text-white">{value || "-"}</p>
    </div>
  );
}

function LineRow({
  line,
  negative,
}: {
  line: PayslipLine;
  negative?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="text-slate-300">{line.label}</span>
        <span
          className={cn(
            "shrink-0 font-medium",
            negative ? "text-red-400" : "text-white"
          )}
        >
          {negative ? "- " : ""}
          {formatSar(line.amount)}
        </span>
      </div>
      {line.note && (
        <p className="text-xs text-slate-500">السبب: {line.note}</p>
      )}
      {line.items && line.items.length > 0 && (
        <ul className="space-y-1 rounded-md border border-slate-700/70 bg-slate-900/40 p-2">
          {line.items.map((item, index) => (
            <li
              key={`${line.key}-${index}`}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                <span className="text-slate-300">{item.label}</span>
                {item.date && (
                  <span className="mr-2 text-slate-500">
                    {formatPortalDate(item.date)}
                  </span>
                )}
                {item.note && <p className="text-slate-500">{item.note}</p>}
              </div>
              <span className="shrink-0 text-slate-300">
                {formatSar(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PayslipDetailProps {
  slip: PayslipDocumentData;
  onDownload: () => void;
  onPrint: () => void;
  isDownloading: boolean;
}

function PayslipDetail({
  slip,
  onDownload,
  onPrint,
  isDownloading,
}: PayslipDetailProps) {
  const status = payslipStatusInfo(slip.status);
  const establishment = getEstablishmentForBranch(slip.branchName);
  const earnings = buildPayslipEarnings(slip);
  const deductions = buildPayslipDeductions(slip);
  const net = toAmount(slip.totals.netSalary);
  const period =
    slip.periodStart && slip.periodEnd
      ? `${formatPortalDate(slip.periodStart)} - ${formatPortalDate(slip.periodEnd)}`
      : null;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              مسيرة راتب {payrollPeriodLabel(slip.year, slip.month)}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              {establishment.nameAr}
              {slip.branchName ? ` - ${slip.branchName}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              رقم المسير: {slip.payrollNumber}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.className}>
              <CheckCircle2 className="ml-1 h-3.5 w-3.5" />
              {status.label}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/60 bg-transparent text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              onClick={onDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="ml-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="ml-1 h-4 w-4" />
              )}
              تحميل PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700"
              onClick={onPrint}
            >
              <Printer className="ml-1 h-4 w-4" />
              طباعة
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* بيانات الموظف */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-700/30 p-4 sm:grid-cols-3">
          <InfoItem label="الاسم" value={slip.employee.name} />
          <InfoItem label="الرقم الوظيفي" value={slip.employee.code} />
          <InfoItem label="المسمى الوظيفي" value={slip.employee.position} />
          {slip.employee.iqamaNumber && (
            <InfoItem label="رقم الإقامة" value={slip.employee.iqamaNumber} />
          )}
          {slip.employee.nationality && (
            <InfoItem label="الجنسية" value={slip.employee.nationality} />
          )}
          {period && <InfoItem label="فترة المسير" value={period} />}
          {slip.employee.bankName && (
            <InfoItem label="البنك" value={slip.employee.bankName} />
          )}
          {slip.employee.iban && (
            <InfoItem
              label="الآيبان"
              value={
                <span dir="ltr" className="font-mono text-xs">
                  {slip.employee.iban}
                </span>
              }
            />
          )}
        </div>

        {/* الحضور */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-slate-700/30 p-3">
            <p className="text-xs text-slate-400">أيام العمل</p>
            <p className="text-lg font-bold text-white">
              {slip.attendance.workDays}
            </p>
          </div>
          <div className="rounded-lg bg-slate-700/30 p-3">
            <p className="text-xs text-slate-400">أيام الغياب</p>
            <p className="text-lg font-bold text-white">
              {slip.attendance.absentDays}
            </p>
          </div>
          <div className="rounded-lg bg-slate-700/30 p-3">
            <p className="text-xs text-slate-400">أيام الإجازة</p>
            <p className="text-lg font-bold text-white">
              {slip.attendance.leaveDays}
            </p>
          </div>
        </div>

        <Separator className="bg-slate-700" />

        {/* الاستحقاقات */}
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            الاستحقاقات
          </h4>
          <div className="space-y-2">
            {earnings.map(line => (
              <LineRow key={line.key} line={line} />
            ))}
            <div className="flex justify-between border-t border-slate-700 pt-2 text-sm font-medium">
              <span className="text-emerald-400">إجمالي الاستحقاقات</span>
              <span className="text-emerald-400">
                {formatSar(slip.totals.grossSalary)}
              </span>
            </div>
          </div>
        </section>

        <Separator className="bg-slate-700" />

        {/* الخصومات */}
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-red-400">
            <TrendingDown className="h-4 w-4" />
            الخصومات
          </h4>
          <div className="space-y-3">
            {deductions.length === 0 ? (
              <p className="text-sm text-slate-500">
                لا توجد خصومات على هذه المسيرة
              </p>
            ) : (
              deductions.map(line => (
                <LineRow key={line.key} line={line} negative />
              ))
            )}
            <div className="flex justify-between border-t border-slate-700 pt-2 text-sm font-medium">
              <span className="text-red-400">إجمالي الخصومات</span>
              <span className="text-red-400">
                {toAmount(slip.totals.totalDeductions) > 0 ? "- " : ""}
                {formatSar(slip.totals.totalDeductions)}
              </span>
            </div>
          </div>
        </section>

        {/* الصافي */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium text-white">
              <Wallet className="h-5 w-5 text-amber-500" />
              صافي الراتب
            </span>
            <span className="text-2xl font-bold text-amber-400">
              {formatSar(net)}
            </span>
          </div>
          <p className="mt-2 text-sm text-amber-200/80">
            {netSalaryInWords(net)}
          </p>
        </div>

        {/* الاعتماد والصرف */}
        <div className="grid gap-3 rounded-lg bg-slate-700/30 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-400">اعتمد المسير</p>
            <p className="text-white">{slip.approvedByName || "الإدارة"}</p>
            <p className="text-xs text-slate-500">
              {formatPortalDateTime(slip.approvedAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">حالة الصرف</p>
            {slip.status === "paid" ? (
              <>
                <p className="text-emerald-400">تم صرف الراتب</p>
                <p className="text-xs text-slate-500">
                  {formatPortalDateTime(slip.paidAt)}
                </p>
              </>
            ) : (
              <p className="text-slate-300">معتمد - بانتظار الصرف</p>
            )}
          </div>
        </div>

        {slip.notes && (
          <p className="rounded-lg bg-slate-700/30 p-3 text-sm text-slate-300">
            <span className="text-slate-400">ملاحظات: </span>
            {slip.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
