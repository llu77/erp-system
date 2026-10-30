import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  FileText,
  Gift,
  History,
  Info,
  Layers,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Store,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ARABIC_MONTHS, formatBonusPeriodLabel, revenueToNextTier, type BonusTierRule } from "@shared/bonus";
import { BONUS_PAYMENT_METHOD_LABELS, getTierColorHex } from "@shared/bonusHelpers";
import {
  clampBonusPeriod,
  compareBonusPeriods,
  formatSar,
  getBonusAuditActionLabel,
  getBonusPeriodOptions,
  getDefaultBonusPeriod,
  getLocalDayKey,
  shiftBonusPeriod,
  type BonusPeriodRef,
} from "@/lib/bonusUi";
import { generateBonusPDF, PrintWindowBlockedError } from "@/lib/bonusPdfGenerator";
import { BonusStatusBadge, BonusTierBadge } from "@/components/bonus/BonusBadges";

// ملاحظة غير مانعة بعد إعادة الاحتساب (تحذيرات الخادم مثل اختلاف إيراد الفرع عن إيراد الموظفين)
type BonusNotice = {
  title: string;
  tone: "info" | "warning" | "error";
  lines: string[];
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  return format(new Date(value), "d/M/yyyy", { locale: ar });
}

// فشل التحميل يُعرض كخطأ مع إعادة المحاولة، لا كقائمة فارغة
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-8 space-y-3">
      <p className="text-sm text-destructive">تعذر التحميل: {message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        إعادة المحاولة
      </Button>
    </div>
  );
}

export default function Bonuses() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const role = user?.role ?? "";
  const isManager = role === "admin" || role === "manager";
  const isOperator = isManager || role === "supervisor";
  const canViewTiers = isOperator || role === "viewer";
  // اختيار الفرع: المسؤول والمدير، والمشرف العام غير المرتبط بفرع (عرض فقط)
  const canPickBranch = isManager || (role === "viewer" && !user?.branchId);

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [period, setPeriod] = useState<BonusPeriodRef>(() => getDefaultBonusPeriod());
  const [requestTarget, setRequestTarget] = useState<{ id: number; periodLabel: string; totalAmount: string } | null>(null);
  const [notice, setNotice] = useState<BonusNotice | null>(null);
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ==================== الفرع ====================

  // قائمة الفروع لمن يمكنه اختيار الفرع (مشرف الفرع مقيد بفرعه)
  const {
    data: branches,
    isLoading: branchesLoading,
    error: branchesError,
    refetch: refetchBranches,
  } = trpc.branches.list.useQuery(undefined, { enabled: canPickBranch });
  const activeBranches = useMemo(() => (branches ?? []).filter(b => b.isActive !== false), [branches]);
  const effectiveBranchId = canPickBranch ? selectedBranchId ?? activeBranches[0]?.id ?? null : user?.branchId ?? null;
  const selectedBranchName = activeBranches.find(b => b.id === effectiveBranchId)?.nameAr;

  // ==================== الفترة ====================

  const todayKey = getLocalDayKey();
  const currentPeriod = getDefaultBonusPeriod();
  const periodOptions = useMemo(
    () => getBonusPeriodOptions(period.month, period.year, todayKey),
    [period.month, period.year, todayKey]
  );
  const periodLabel = formatBonusPeriodLabel(period.weekNumber, period.month, period.year);
  const yearOptions = [currentPeriod.year - 2, currentPeriod.year - 1, currentPeriod.year];
  const nextPeriod = shiftBonusPeriod(period, 1);
  const canGoNext = compareBonusPeriods(nextPeriod, currentPeriod) <= 0;
  const isOnCurrentPeriod = compareBonusPeriods(period, currentPeriod) === 0;

  // اختيار فترة (بدون فترات مستقبلية)
  const selectPeriod = (next: BonusPeriodRef) => {
    let target = clampBonusPeriod(next);
    if (target.year === currentPeriod.year && target.month > currentPeriod.month) {
      target = clampBonusPeriod({ ...target, month: currentPeriod.month });
    }
    if (compareBonusPeriods(target, currentPeriod) > 0) target = currentPeriod;
    setPeriod(target);
    setNotice(null);
  };

  // ==================== البيانات ====================

  const periodInput = {
    branchId: effectiveBranchId ?? 0,
    year: period.year,
    month: period.month,
    weekNumber: period.weekNumber,
  };

  // بونص الفترة المختارة
  const weekQuery = trpc.bonuses.getWeek.useQuery(periodInput, { enabled: !!effectiveBranchId });
  const view = weekQuery.data;

  // سجل الفترات السابقة للفرع
  const historyQuery = trpc.bonuses.history.useQuery(
    { branchId: effectiveBranchId ?? 0, limit: 10 },
    { enabled: !!effectiveBranchId }
  );

  // المستويات الحالية (دليل المستويات والمتبقي للمستوى التالي)
  const tiersQuery = trpc.bonuses.getTiers.useQuery(undefined, { enabled: canViewTiers });
  const tiers = tiersQuery.data?.tiers ?? null;
  const tierRules: BonusTierRule[] | null = useMemo(
    () =>
      tiers
        ? tiers.map(t => ({ tierKey: t.tierKey, tierName: t.tierName, minRevenue: t.minRevenue, bonusAmount: t.bonusAmount, color: t.color ?? undefined }))
        : null,
    [tiers]
  );

  // سجل التدقيق
  const auditQuery = trpc.bonuses.auditLogs.useQuery(
    { branchId: effectiveBranchId ?? undefined, limit: 30 },
    { enabled: !!effectiveBranchId && showAuditLog }
  );

  // فحص الفروقات للفترة المختارة
  const discrepanciesQuery = trpc.bonuses.detectDiscrepancies.useQuery(periodInput, {
    enabled: !!effectiveBranchId && showDiscrepancies,
  });

  // فروقات الفترة الحالية لكل الفروع (المسؤول والمدير)
  const allDiscrepanciesQuery = trpc.bonuses.getAllDiscrepancies.useQuery(undefined, {
    enabled: isManager && showStatsPanel,
  });

  const refreshBonusData = async () => {
    await Promise.all([
      utils.bonuses.getWeek.invalidate(),
      utils.bonuses.current.invalidate(),
      utils.bonuses.history.invalidate(),
      utils.bonuses.auditLogs.invalidate(),
      utils.bonuses.detectDiscrepancies.invalidate(),
      utils.bonuses.pending.invalidate(),
      utils.bonuses.all.invalidate(),
      utils.bonuses.stats.invalidate(),
    ]);
  };

  // ==================== العمليات ====================

  // إعادة احتساب الفترة المختارة
  const syncMutation = trpc.bonuses.sync.useMutation({
    onSuccess: async (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);

      const lines: string[] = [];
      if (!result.success || result.locked || result.statusReset) lines.push(result.message);
      lines.push(...result.warnings, ...(result.errors ?? []));
      setNotice(
        lines.length > 0
          ? {
              title: result.success ? `ملاحظات إعادة احتساب ${formatBonusPeriodLabel(result.weekNumber, result.month, result.year)}` : "تعذرت إعادة الاحتساب",
              tone: result.success ? (result.warnings.length > 0 ? "warning" : "info") : "error",
              lines,
            }
          : null
      );
      await refreshBonusData();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إعادة الاحتساب");
    },
  });

  // إعادة بناء إيرادات الموظفين من فواتير الكاشير للشهر (المسؤول والمدير)
  const rebuildMutation = trpc.bonuses.rebuildFromPos.useMutation({
    onSuccess: async (result) => {
      toast.success(result.message);
      setNotice({
        title: `نتيجة إعادة الاحتساب من الكاشير - ${ARABIC_MONTHS[period.month - 1]} ${period.year}`,
        tone: result.warnings.length > 0 ? "warning" : "info",
        lines: [
          `تم فحص ${result.scanned} يوم مؤكد من الكاشير: إعادة بناء ${result.rebuilt} يوم وتخطي ${result.skipped} يوم، وإعادة احتساب ${result.periods.length} فترة`,
          ...result.warnings,
        ],
      });
      await refreshBonusData();
    },
    onError: (error) => {
      toast.error(error.message || "فشلت إعادة الاحتساب من الكاشير");
    },
  });

  // طلب صرف البونص
  const requestMutation = trpc.bonuses.request.useMutation({
    onSuccess: async (result) => {
      toast.success(result.message);
      setRequestTarget(null);
      await refreshBonusData();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال الطلب");
    },
  });

  // إرسال تنبيه الفروقات (المسؤول والمدير)
  const sendAlertMutation = trpc.bonuses.sendDiscrepancyAlert.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        utils.bonuses.auditLogs.invalidate();
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال التنبيه");
    },
  });

  // إرسال تقرير البونص (المسؤول والمدير)
  const sendWeeklyReportMutation = trpc.bonuses.sendWeeklyReport.useMutation({
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال التقرير");
    },
  });

  const handleSync = () => {
    if (!effectiveBranchId) return;
    syncMutation.mutate(periodInput);
  };

  const handleRebuild = () => {
    if (!effectiveBranchId) return;
    setShowRebuildConfirm(false);
    rebuildMutation.mutate({ branchId: effectiveBranchId, year: period.year, month: period.month });
  };

  const handleExportPDF = async () => {
    if (!view) return;
    setIsExporting(true);
    try {
      await generateBonusPDF(view, { tiers });
      toast.success("تم فتح تقرير البونص للطباعة أو الحفظ كـ PDF");
    } catch (error) {
      if (error instanceof PrintWindowBlockedError) {
        toast.error(error.message);
      } else {
        console.error("Export error:", error);
        toast.error("فشل تصدير التقرير");
      }
    } finally {
      setIsExporting(false);
    }
  };

  // المتبقي للمستوى التالي (من المستويات الحالية، أو من الخادم إذا لم تتوفر)
  const getNextTierHint = (detail: NonNullable<typeof view>["details"][number]): string | null => {
    const revenue = Number(detail.weeklyRevenue) || 0;
    if (tierRules) {
      const { nextTier, remaining } = revenueToNextTier(revenue, tierRules);
      if (!nextTier) return detail.isEligible ? "أعلى مستوى" : null;
      return `متبقي ${formatSar(remaining)} ← ${nextTier.tierName} (${formatSar(nextTier.bonusAmount)})`;
    }
    if (detail.remainingToNextTier !== null && detail.nextTierName) {
      return `متبقي ${formatSar(detail.remainingToNextTier)} ← ${detail.nextTierName}`;
    }
    return null;
  };

  // ==================== العرض ====================

  if (authLoading || !user || (canPickBranch && branchesLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (canPickBranch && branchesError) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadError message={branchesError.message} onRetry={() => refetchBranches()} />
        </CardContent>
      </Card>
    );
  }

  if (!effectiveBranchId) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">{canPickBranch ? "لا توجد فروع نشطة" : "لم يتم ربط حسابك بفرع"}</h3>
          <p className="text-muted-foreground">
            {canPickBranch ? "أضف فرعاً من صفحة الفروع لعرض البونص" : "تواصل مع المسؤول لربط حسابك بفرع لعرض البونص"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const showNextTier = !!view && !view.periodEnded && !view.locked;
  const finalAmount = view
    ? view.status === "paid"
      ? view.paidAmount ?? view.approvedAmount ?? view.totalAmount
      : view.status === "approved"
        ? view.approvedAmount ?? view.totalAmount
        : view.totalAmount
    : "0";

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold flex items-center gap-2`}>
            <Gift className="h-6 w-6 text-primary" />
            البونص
          </h1>
          <p className="text-muted-foreground text-sm">
            بونص الموظفين لكل فترة من فترات الشهر حسب الإيراد المسجل من الكاشير
          </p>
        </div>
        {!isOperator && (
          <Badge variant="outline" className="gap-1">
            <Eye className="h-3 w-3" />
            عرض فقط
          </Badge>
        )}
      </div>

      {/* الفرع والفترة */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className={`flex ${isMobile ? "flex-col" : "flex-row flex-wrap"} items-stretch gap-2`}>
            {canPickBranch ? (
              <Select value={effectiveBranchId.toString()} onValueChange={v => { setSelectedBranchId(Number(v)); setNotice(null); }}>
                <SelectTrigger className={isMobile ? "w-full" : "w-48"} aria-label="الفرع">
                  <Building2 className="h-4 w-4 ml-1 text-muted-foreground" />
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {activeBranches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {view?.branchName ?? "فرعي"}
              </div>
            )}

            <div className="flex gap-2">
              <Select value={period.year.toString()} onValueChange={v => selectPeriod({ ...period, year: Number(v) })}>
                <SelectTrigger className={isMobile ? "flex-1" : "w-28"} aria-label="السنة">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={period.month.toString()} onValueChange={v => selectPeriod({ ...period, month: Number(v) })}>
                <SelectTrigger className={isMobile ? "flex-1" : "w-32"} aria-label="الشهر">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARABIC_MONTHS.map((name, index) => (
                    <SelectItem
                      key={name}
                      value={(index + 1).toString()}
                      disabled={period.year === currentPeriod.year && index + 1 > currentPeriod.month}
                    >
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => selectPeriod(shiftBonusPeriod(period, -1))} aria-label="الفترة السابقة">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Select value={period.weekNumber.toString()} onValueChange={v => selectPeriod({ ...period, weekNumber: Number(v) })}>
                <SelectTrigger className={isMobile ? "flex-1" : "w-48"} aria-label="الفترة">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(option => (
                    <SelectItem key={option.weekNumber} value={option.weekNumber.toString()} disabled={!option.started}>
                      {option.label}
                      {!option.started ? " (لم تبدأ)" : !option.ended ? " (جارية)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => selectPeriod(nextPeriod)}
                disabled={!canGoNext}
                aria-label="الفترة التالية"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            {!isOnCurrentPeriod && (
              <Button variant="ghost" onClick={() => selectPeriod(currentPeriod)}>
                الفترة الحالية
              </Button>
            )}
          </div>

          {/* الأزرار */}
          <div className={`flex ${isMobile ? "flex-col" : "flex-row flex-wrap"} gap-2`}>
            {isOperator && (
              <Button variant="outline" onClick={handleSync} disabled={syncMutation.isPending} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                إعادة احتساب الفترة
              </Button>
            )}
            {isManager && (
              <Button variant="outline" onClick={() => setShowRebuildConfirm(true)} disabled={rebuildMutation.isPending} className="gap-2">
                {rebuildMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                إعادة احتساب من الكاشير
              </Button>
            )}
            {view?.exists && view.details.length > 0 && (
              <Button variant="outline" onClick={handleExportPDF} disabled={isExporting} className="gap-2">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                تصدير PDF
              </Button>
            )}
            {isManager && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowStatsPanel(!showStatsPanel)}
                  className={`gap-2 ${showStatsPanel ? "bg-primary/10" : ""}`}
                >
                  <BarChart3 className="h-4 w-4" />
                  فروقات كل الفروع
                </Button>
                <Button
                  variant="outline"
                  onClick={() => sendWeeklyReportMutation.mutate()}
                  disabled={sendWeeklyReportMutation.isPending}
                  className="gap-2"
                >
                  {sendWeeklyReportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  إرسال تقرير البونص
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ملاحظات إعادة الاحتساب (غير مانعة) */}
      {notice && (
        <Alert
          variant={notice.tone === "error" ? "destructive" : "default"}
          className={notice.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : ""}
        >
          {notice.tone === "info" ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertTitle className="flex items-center justify-between gap-2">
            {notice.title}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNotice(null)} aria-label="إغلاق">
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pr-5 space-y-1">
              {notice.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* فروقات كل الفروع للفترة الحالية */}
      {showStatsPanel && isManager && (
        <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-800 dark:text-blue-300">فروقات البونص في كل الفروع</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowStatsPanel(false)}>
                إغلاق
              </Button>
            </div>
            {allDiscrepanciesQuery.data && (
              <CardDescription>الفترة الحالية: {allDiscrepanciesQuery.data.periodLabel}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {allDiscrepanciesQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : allDiscrepanciesQuery.error ? (
              <LoadError message={allDiscrepanciesQuery.error.message} onRetry={() => allDiscrepanciesQuery.refetch()} />
            ) : allDiscrepanciesQuery.data &&allDiscrepanciesQuery.data.allBranches.length > 0 ? (
              <div className="space-y-6">
                <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
                  <div className="bg-background rounded-lg p-4 border">
                    <div className="text-3xl font-bold text-blue-600">{allDiscrepanciesQuery.data.totalDiscrepancies}</div>
                    <div className="text-sm text-muted-foreground">إجمالي الفروقات</div>
                  </div>
                  <div className="bg-background rounded-lg p-4 border">
                    <div className="text-3xl font-bold text-orange-600">
                      {allDiscrepanciesQuery.data.allBranches.filter(b => b.discrepancyCount > 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">فروع بها فروقات</div>
                  </div>
                  <div className="bg-background rounded-lg p-4 border">
                    <div className="text-3xl font-bold text-green-600">
                      {allDiscrepanciesQuery.data.allBranches.filter(b => b.discrepancyCount === 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">فروع متطابقة</div>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-4 border">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    الفروقات حسب الفرع
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allDiscrepanciesQuery.data.allBranches} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="branchName" type="category" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number) => [`${value} فرق`, "عدد الفروقات"]}
                          labelFormatter={(label) => `فرع: ${label}`}
                        />
                        <Bar dataKey="discrepancyCount" name="عدد الفروقات">
                          {allDiscrepanciesQuery.data.allBranches.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.discrepancyCount > 0 ? "#ef4444" : "#22c55e"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-background rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-center">عدد الفروقات</TableHead>
                        <TableHead className="text-center">إجمالي فرق البونص</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allDiscrepanciesQuery.data.allBranches.map(branch => (
                        <TableRow key={branch.branchId}>
                          <TableCell className="font-medium">{branch.branchName}</TableCell>
                          <TableCell className="text-center">{branch.discrepancyCount}</TableCell>
                          <TableCell className="text-center">{formatSar(branch.totalDiff)}</TableCell>
                          <TableCell className="text-center">
                            {branch.discrepancyCount > 0 ? (
                              <Badge variant="outline" className="text-red-600 border-red-300">
                                <AlertTriangle className="h-3 w-3 ml-1" />
                                يحتاج مراجعة
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-300">
                                <CheckCircle className="h-3 w-3 ml-1" />
                                متطابق
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">لا توجد فروع نشطة</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* بونص الفترة المختارة */}
      {weekQuery.isLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : weekQuery.error ? (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>تعذر تحميل بونص الفترة</AlertTitle>
          <AlertDescription>{weekQuery.error.message}</AlertDescription>
        </Alert>
      ) : view ? (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {view.periodLabel}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                  <span>{view.branchName || selectedBranchName}</span>
                  {view.isCurrentPeriod && <Badge variant="secondary">الفترة الحالية</Badge>}
                  {!view.periodEnded && !view.isCurrentPeriod && <Badge variant="secondary">جارية</Badge>}
                  {view.periodEnded && <Badge variant="outline">منتهية</Badge>}
                  {view.locked && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="h-3 w-3" />
                      مقفلة
                    </Badge>
                  )}
                </CardDescription>
              </div>
              <BonusStatusBadge status={view.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <DollarSign className="h-7 w-7 mx-auto mb-2 text-primary" />
                <div className="text-xl font-bold text-primary">{formatSar(finalAmount)}</div>
                <div className="text-sm text-muted-foreground">
                  {view.status === "paid" ? "المبلغ المصروف" : view.status === "approved" ? "المبلغ المعتمد" : "إجمالي البونص"}
                </div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-4 text-center">
                <CheckCircle className="h-7 w-7 mx-auto mb-2 text-green-600" />
                <div className="text-xl font-bold text-green-600">{view.eligibleCount}</div>
                <div className="text-sm text-muted-foreground">
                  مؤهلين ({view.totalEmployees > 0 ? Math.round((view.eligibleCount / view.totalEmployees) * 100) : 0}%)
                </div>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-4 text-center">
                <Users className="h-7 w-7 mx-auto mb-2 text-blue-500" />
                <div className="text-xl font-bold text-blue-500">{view.totalEmployees}</div>
                <div className="text-sm text-muted-foreground">إجمالي الموظفين</div>
              </div>
              <div className="bg-purple-500/10 rounded-lg p-4 text-center">
                <TrendingUp className="h-7 w-7 mx-auto mb-2 text-purple-500" />
                <div className="text-xl font-bold text-purple-500">{formatSar(view.totalRevenue)}</div>
                <div className="text-sm text-muted-foreground">إيراد الموظفين في الفترة</div>
              </div>
            </div>

            {!view.exists && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>لم يتم احتساب البونص لهذه الفترة بعد</AlertTitle>
                <AlertDescription>
                  يُحتسب البونص تلقائياً عند تأكيد إيراد اليوم من الكاشير أو إدخاله في صفحة الإيرادات.
                  {isOperator && " يمكنك أيضاً الضغط على \"إعادة احتساب الفترة\"."}
                </AlertDescription>
              </Alert>
            )}

            {view.status === "rejected" && view.rejectionReason && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
                <strong>سبب الرفض:</strong> {view.rejectionReason}
              </div>
            )}

            {view.status === "paid" && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm flex items-center gap-2">
                <Banknote className="h-4 w-4 text-purple-600" />
                تم الصرف بتاريخ {formatDate(view.paidAt)} -{" "}
                {view.paymentMethod ? BONUS_PAYMENT_METHOD_LABELS[view.paymentMethod] ?? view.paymentMethod : "-"}
                {view.paymentReference ? ` - المرجع: ${view.paymentReference}` : ""}
              </div>
            )}

            {/* جدول الموظفين */}
            {view.details.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">الإيراد في الفترة</TableHead>
                      <TableHead className="text-right">المستوى</TableHead>
                      <TableHead className="text-right">البونص</TableHead>
                      {showNextTier && <TableHead className="text-right">للمستوى التالي</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.details.map(detail => (
                      <TableRow key={detail.employeeId}>
                        <TableCell className="font-medium">{detail.employeeName || "-"}</TableCell>
                        <TableCell>{detail.employeeCode || "-"}</TableCell>
                        <TableCell>{formatSar(detail.weeklyRevenue)}</TableCell>
                        <TableCell>
                          <BonusTierBadge tierKey={detail.bonusTier} label={detail.tierLabel} tiers={tiers} />
                        </TableCell>
                        <TableCell className="font-bold text-green-600">{formatSar(detail.bonusAmount)}</TableCell>
                        {showNextTier && (
                          <TableCell className="text-xs text-muted-foreground">{getNextTierHint(detail) ?? "-"}</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6">لا يوجد موظفون نشطون في هذا الفرع</p>
            )}

            {/* طلب الصرف */}
            {isOperator && view.exists && (view.status === "pending" || view.status === "rejected") && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                {!view.canRequest && view.requestBlocker && (
                  <p className="text-sm text-muted-foreground">{view.requestBlocker}</p>
                )}
                {view.canRequest && (
                  <Button
                    onClick={() => setRequestTarget({ id: view.id, periodLabel: view.periodLabel, totalAmount: view.totalAmount })}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {view.status === "rejected" ? "إعادة طلب الصرف" : "طلب صرف"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* دليل المستويات */}
      {tiersQuery.data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-5 w-5" />
                  مستويات البونص
                  {tiersQuery.data.isDefault && <Badge variant="outline">افتراضية</Badge>}
                </CardTitle>
                <CardDescription>حسب إيراد الموظف في الفترة (1-7، 8-14، 15-21، 22-28، 29-نهاية الشهر)</CardDescription>
              </div>
              {isManager && (
                <Button variant="outline" size="sm" onClick={() => setLocation("/bonus-tiers")}>
                  تعديل المستويات
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tiersQuery.data.tiers.map(tier => (
                <div key={tier.tierKey} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getTierColorHex(tier.tierKey, tierRules) }} />
                  <span className="font-medium">{tier.tierName}:</span>
                  <span className="text-muted-foreground">
                    {tier.maxRevenue !== null ? `${tier.minRevenue} - ${tier.maxRevenue}` : `${tier.minRevenue} فأكثر`} ر.س
                  </span>
                  <span className="font-bold text-green-600">← {formatSar(tier.bonusAmount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* فحص الفروقات وسجل التدقيق */}
      {canViewTiers && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showDiscrepancies ? "default" : "outline"}
            onClick={() => setShowDiscrepancies(!showDiscrepancies)}
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            فحص الفروقات
          </Button>
          <Button
            variant={showAuditLog ? "default" : "outline"}
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            سجل التدقيق
          </Button>
        </div>
      )}

      {/* فحص الفروقات للفترة المختارة */}
      {showDiscrepancies && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  فحص الفروقات - {periodLabel}
                </CardTitle>
                <CardDescription>مقارنة الإيرادات المسجلة حالياً مع البونص المحتسب</CardDescription>
              </div>
              {isManager && discrepanciesQuery.data?.hasDiscrepancy && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => sendAlertMutation.mutate(periodInput)}
                  disabled={sendAlertMutation.isPending}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  {sendAlertMutation.isPending ? "جاري الإرسال..." : "إرسال تنبيه"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {discrepanciesQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : discrepanciesQuery.error ? (
              <p className="text-sm text-destructive">{discrepanciesQuery.error.message}</p>
            ) : discrepanciesQuery.data?.hasDiscrepancy ? (
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 dark:text-amber-200 font-medium">
                    تم اكتشاف {discrepanciesQuery.data.discrepancies.length} فروقات - اضغط "إعادة احتساب الفترة" لتحديث البونص
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-right">إيراد مسجل</TableHead>
                        <TableHead className="text-right">إيراد فعلي</TableHead>
                        <TableHead className="text-right">الفرق</TableHead>
                        <TableHead className="text-right">بونص مسجل</TableHead>
                        <TableHead className="text-right">بونص متوقع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discrepanciesQuery.data.discrepancies.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{d.employeeName}</TableCell>
                          <TableCell>{formatSar(d.registeredRevenue)}</TableCell>
                          <TableCell>{formatSar(d.actualRevenue)}</TableCell>
                          <TableCell className={d.revenueDiff > 0 ? "text-green-600" : "text-red-600"}>
                            {d.revenueDiff > 0 ? "+" : ""}
                            {formatSar(d.revenueDiff)}
                          </TableCell>
                          <TableCell>{formatSar(d.registeredBonus)}</TableCell>
                          <TableCell className="font-bold">{formatSar(d.expectedBonus)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-green-600 font-medium">لا توجد فروقات - البيانات متطابقة</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* سجل التدقيق */}
      {showAuditLog && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              سجل تدقيق البونص
            </CardTitle>
            <CardDescription>آخر 30 عملية على بونص الفرع</CardDescription>
          </CardHeader>
          <CardContent>
            {auditQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : auditQuery.error ? (
              <LoadError message={auditQuery.error.message} onRetry={() => auditQuery.refetch()} />
            ) : auditQuery.data &&auditQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right whitespace-nowrap">التاريخ</TableHead>
                      <TableHead className="text-right">الإجراء</TableHead>
                      <TableHead className="text-right">الفترة</TableHead>
                      <TableHead className="text-right">بواسطة</TableHead>
                      <TableHead className="text-right min-w-[240px]">التفاصيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditQuery.data.map(log => (
                      <TableRow key={log.id} className="align-top">
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(log.performedAt), "d/M/yyyy HH:mm", { locale: ar })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.action === "reject" || log.action.includes("alert") || log.action === "revenue_changed_after_lock"
                                ? "destructive"
                                : log.action === "approve" || log.action === "pay"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {getBonusAuditActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {log.weekNumber && log.month && log.year ? formatBonusPeriodLabel(log.weekNumber, log.month, log.year) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{log.userName || "النظام"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.details || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">لا يوجد سجل تدقيق</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* سجل الفترات */}
      <Card>
        <CardHeader>
          <CardTitle>سجل البونص</CardTitle>
          <CardDescription>آخر 10 فترات محتسبة للفرع</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : historyQuery.error ? (
            <LoadError message={historyQuery.error.message} onRetry={() => historyQuery.refetch()} />
          ) : historyQuery.data &&historyQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الفترة</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">آخر إجراء</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.data.map(bonus => {
                    const isSelected =
                      bonus.year === period.year && bonus.month === period.month && bonus.weekNumber === period.weekNumber;
                    const lastAction = bonus.paidAt ?? bonus.approvedAt ?? bonus.rejectedAt ?? bonus.requestedAt;
                    return (
                      <TableRow key={bonus.id} className={isSelected ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium whitespace-nowrap">{bonus.periodLabel}</TableCell>
                        <TableCell className="font-bold">{formatSar(bonus.totalAmount)}</TableCell>
                        <TableCell>
                          <BonusStatusBadge status={bonus.status} />
                        </TableCell>
                        <TableCell className="text-sm">{lastAction ? formatDate(lastAction) : "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-end">
                            {!isSelected && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => selectPeriod({ year: bonus.year, month: bonus.month, weekNumber: bonus.weekNumber })}
                              >
                                عرض
                              </Button>
                            )}
                            {isOperator && bonus.canRequest && (
                              <Button
                                size="sm"
                                className="gap-1"
                                onClick={() =>
                                  setRequestTarget({ id: bonus.id, periodLabel: bonus.periodLabel, totalAmount: bonus.totalAmount })
                                }
                              >
                                <Send className="h-3.5 w-3.5" />
                                طلب صرف
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">لا يوجد سجل بونص سابق</div>
          )}
        </CardContent>
      </Card>

      {/* تأكيد طلب الصرف */}
      <Dialog open={requestTarget !== null} onOpenChange={open => !open && setRequestTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد طلب صرف البونص</DialogTitle>
            <DialogDescription>
              {requestTarget &&
                `إرسال طلب صرف بونص فترة ${requestTarget.periodLabel} (${formatSar(requestTarget.totalAmount)}) للمدير للموافقة. سيتم تحديث المبالغ من الإيرادات الحالية قبل الإرسال.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRequestTarget(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => requestTarget && requestMutation.mutate({ weeklyBonusId: requestTarget.id })}
              disabled={requestMutation.isPending}
            >
              {requestMutation.isPending ? "جاري الإرسال..." : "تأكيد الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد إعادة الاحتساب من الكاشير */}
      <Dialog open={showRebuildConfirm} onOpenChange={setShowRebuildConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              إعادة احتساب من الكاشير
            </DialogTitle>
            <DialogDescription>
              سيتم إعادة بناء إيرادات الموظفين لشهر {ARABIC_MONTHS[period.month - 1]} {period.year} لفرع{" "}
              {view?.branchName || selectedBranchName || ""} من فواتير الكاشير المؤكدة، ثم إعادة احتساب بونص الفترات المفتوحة.
              الفترات المطلوبة أو المعتمدة أو المصروفة لا تتغير مبالغها.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRebuildConfirm(false)}>
              إلغاء
            </Button>
            <Button onClick={handleRebuild} disabled={rebuildMutation.isPending}>
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
