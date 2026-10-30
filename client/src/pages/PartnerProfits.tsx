/**
 * أرباح الشركاء (للمسؤول فقط): الأرباح = الإيرادات - المصاريف لكل فرع وتوزيعها على الشركاء
 * - فرع لبن: عمر 50%، سالم 30%، عبدالله 20% | فرع طويق: سعود 40%، عمر 40%، كلثوم الكلثم 20%
 * - الأرقام والتوزيع من الخادم (partnerProfits.summary) وبيان PDF رسمي لكل فرع
 */

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  FileDown,
  Handshake,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/_core/hooks/useAuth";
import { downloadBase64Pdf } from "@/lib/downloadPdf";
import { trpc } from "@/lib/trpc";
import { ARABIC_MONTHS } from "@shared/bonus";
import {
  PARTNER_PROFITS_PAGE_TITLE,
  type PartnerProfitStatement,
} from "@shared/partnerProfits";
import { formatVoucherAmount } from "@shared/vouchers";

/** المبلغ بأرقام لاتينية: 12,345.67 ر.س */
function sar(value: number): string {
  return `${formatVoucherAmount(value)} ر.س`;
}

function AmountLine({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div>
        <div className="text-muted-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground/80">{hint}</div>}
      </div>
      <span className="font-semibold tabular-nums whitespace-nowrap" dir="ltr">
        {formatVoucherAmount(value)}
      </span>
    </div>
  );
}

function BranchStatementCard({
  statement: s,
  downloading,
  onDownload,
}: {
  statement: PartnerProfitStatement;
  downloading: boolean;
  onDownload: () => void;
}) {
  const loss = s.isLoss;
  const resultLabel = loss ? "الخسارة" : "الأرباح";
  const payroll = s.expenses.payroll;
  const salariesHint =
    payroll.count > 0
      ? `صافي المسير ${formatVoucherAmount(payroll.netSalary)}${payroll.recoveredAdvances > 0 ? ` + السلف المستردة ${formatVoucherAmount(payroll.recoveredAdvances)}` : ""}`
      : "لا يوجد مسير معتمد لهذا الشهر";

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-xl flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary shrink-0" />
            {s.branchName}
          </CardTitle>
          <CardDescription>{s.establishmentName}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              loss
                ? "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                : "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
            }
          >
            {loss ? "خسارة" : "ربح"}
          </Badge>
          <Button onClick={onDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 ml-2" />
            )}
            تحميل PDF
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* الحساب: الإيرادات - المصاريف = الأرباح */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">الإيرادات</span>
              <span className="text-lg font-bold tabular-nums" dir="ltr">
                {sar(s.revenue.total)}
              </span>
            </div>
            <div className="space-y-1.5 border-t pt-2">
              <AmountLine label="نقدي" value={s.revenue.cash} />
              <AmountLine label="شبكة" value={s.revenue.network} />
              <div className="text-[11px] text-muted-foreground">
                أيام الإيراد المسجلة: {s.revenue.days}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">المصاريف</span>
              <span className="text-lg font-bold tabular-nums" dir="ltr">
                {sar(s.expenses.total)}
              </span>
            </div>
            <div className="space-y-1.5 border-t pt-2">
              <AmountLine label="مصاريف ثابتة" value={s.expenses.fixed} />
              <AmountLine label="رواتب" value={s.expenses.salaries} hint={salariesHint} />
              <AmountLine label="مصاريف أخرى" value={s.expenses.other} />
            </div>
          </div>

          <div
            className={`rounded-lg border-2 p-4 flex flex-col justify-between gap-3 ${
              loss
                ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {loss ? (
                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
              {resultLabel}
            </div>
            <div
              className={`text-3xl font-bold tabular-nums ${
                loss ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
              }`}
              dir="ltr"
            >
              {sar(s.profit)}
            </div>
            <div className="text-xs text-muted-foreground">
              الإيرادات <span dir="ltr">{formatVoucherAmount(s.revenue.total)}</span> − المصاريف{" "}
              <span dir="ltr">{formatVoucherAmount(s.expenses.total)}</span>
            </div>
          </div>
        </div>

        {/* تفصيل المصاريف الثابتة والأخرى حسب التصنيف */}
        {s.expenses.byCategory.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              تفصيل المصاريف الثابتة والأخرى حسب التصنيف
            </div>
            <div className="flex flex-wrap gap-2">
              {s.expenses.byCategory.map(c => (
                <span
                  key={c.category}
                  className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 text-xs"
                >
                  {c.label}
                  <b className="tabular-nums" dir="ltr">
                    {formatVoucherAmount(c.amount)}
                  </b>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* توزيع الربح على الشركاء */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right">الشريك</TableHead>
                <TableHead className="text-center">النسبة</TableHead>
                <TableHead className="text-left">{loss ? "حصة الخسارة" : "حصة الربح"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.partners.map(p => (
                <TableRow key={p.name}>
                  <TableCell className="font-semibold text-base">{p.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="tabular-nums" dir="ltr">
                      {p.percent}%
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-left font-bold text-base tabular-nums ${
                      loss ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                    }`}
                    dir="ltr"
                  >
                    {sar(p.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">الإجمالي</TableCell>
                <TableCell className="text-center font-bold tabular-nums" dir="ltr">
                  {s.partners.reduce((sum, p) => sum + p.percent, 0)}%
                </TableCell>
                <TableCell className="text-left font-bold tabular-nums" dir="ltr">
                  {sar(s.profit)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerProfits() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const yearOptions = Array.from({ length: 5 }, (_, i) => current.year - i);

  const summaryQuery = trpc.partnerProfits.summary.useQuery(
    { year, month },
    { enabled: isAdmin }
  );
  const summary = summaryQuery.data;

  // تحميل بيان الفرع PDF (مولّد في الخادم)
  const pdfMutation = trpc.partnerProfits.pdf.useMutation();
  const pdfPendingFor = pdfMutation.isPending ? pdfMutation.variables?.branchId ?? null : null;
  const handleDownloadPdf = async (s: PartnerProfitStatement) => {
    const toastId = `partner-profits-pdf-${s.branchId}`;
    try {
      toast.loading("جاري توليد ملف PDF...", { id: toastId });
      const result = await pdfMutation.mutateAsync({ year, month, branchId: s.branchId });
      downloadBase64Pdf(result.pdf, result.filename);
      toast.success(`تم تحميل بيان أرباح الشركاء - ${s.branchName}`, { id: toastId });
    } catch (error: any) {
      toast.error(error?.message || "فشل توليد ملف PDF", { id: toastId });
    }
  };

  const selectYear = (value: string) => {
    const y = Number(value);
    setYear(y);
    // لا شهر مستقبلي في السنة الحالية
    if (y === current.year && month > current.month) setMonth(current.month);
  };

  if (authLoading) {
    return (
      <div className="space-y-4" dir="rtl">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card dir="rtl">
        <CardContent className="py-12 text-center space-y-2">
          <ShieldAlert className="w-12 h-12 mx-auto text-red-500" />
          <h2 className="text-lg font-semibold">غير مصرح</h2>
          <p className="text-muted-foreground">صفحة أرباح الشركاء متاحة للمسؤول فقط</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* الرأس */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Handshake className="w-7 h-7 text-primary shrink-0" />
            {PARTNER_PROFITS_PAGE_TITLE}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            الأرباح = الإيرادات (نقدي + شبكة) − المصاريف (ثابتة + رواتب + أخرى)، وتوزَّع على الشركاء حسب نسبهم في كل فرع
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month.toString()} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36" aria-label="الشهر">
              <Calendar className="w-4 h-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARABIC_MONTHS.map((name, index) => (
                <SelectItem
                  key={name}
                  value={(index + 1).toString()}
                  disabled={year === current.year && index + 1 > current.month}
                >
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={selectYear}>
            <SelectTrigger className="w-28" aria-label="السنة">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => summaryQuery.refetch()}
            disabled={summaryQuery.isFetching}
            aria-label="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : summaryQuery.error ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <p className="font-medium">{summaryQuery.error.message || "تعذر تحميل أرباح الشركاء"}</p>
            <Button variant="outline" onClick={() => summaryQuery.refetch()}>
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {summary && summary.branches.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                لا توجد فروع نشطة لها نسب شركاء (فرع لبن أو فرع طويق)
              </CardContent>
            </Card>
          )}

          {summary?.branches.map(s => (
            <BranchStatementCard
              key={s.branchId}
              statement={s}
              downloading={pdfPendingFor === s.branchId}
              onDownload={() => handleDownloadPdf(s)}
            />
          ))}

          {summary && summary.unassigned.length > 0 && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">فروع بدون نسب شركاء</CardTitle>
                <CardDescription>
                  لا تُحسب لها أرباح شركاء؛ النسب محددة لفرع لبن وفرع طويق فقط (حسب اسم الفرع)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {summary.unassigned.map(b => (
                  <Badge key={b.id} variant="outline">
                    {b.name}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
