import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calculator,
  CalendarRange,
  History,
  Info,
  Layers,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { MAX_BONUS_TIERS, resolveBonusTier, revenueToNextTier } from "@shared/bonus";
import { TIER_COLOR_HEX } from "@shared/bonusHelpers";
import {
  TIER_CHANGE_TYPE_LABELS,
  createEmptyTierDraftRow,
  describeDraftRanges,
  draftRowsToRules,
  draftRowsToTierInput,
  formatSar,
  getReadableTextColor,
  isTierDraftDirty,
  parseAmountInput,
  summarizeTierSnapshot,
  tiersToDraftRows,
  validateTierDraft,
  type TierDraftRow,
} from "@/lib/bonusUi";

// أسماء الألوان المتاحة للمستويات
const COLOR_LABELS: Record<string, string> = {
  orange: "برتقالي",
  yellow: "أصفر",
  green: "أخضر",
  cyan: "سماوي",
  blue: "أزرق",
  indigo: "نيلي",
  purple: "بنفسجي",
  pink: "وردي",
  red: "أحمر",
  gray: "رمادي",
};

// فترات البونص الثابتة داخل الشهر
const PERIODS_DESCRIPTION = [
  { weekNumber: 1, label: "1 - 7" },
  { weekNumber: 2, label: "8 - 14" },
  { weekNumber: 3, label: "15 - 21" },
  { weekNumber: 4, label: "22 - 28" },
  { weekNumber: 5, label: "29 - نهاية الشهر" },
];

export default function BonusTierSettings() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  const role = user?.role ?? "";
  const isManager = role === "admin" || role === "manager";
  const canView = isManager || role === "supervisor" || role === "viewer";

  // المستويات المعتمدة حالياً في الاحتساب
  const tiersQuery = trpc.bonuses.getTiers.useQuery(undefined, { enabled: canView });

  // سجل تغييرات المستويات (للمسؤول والمدير)
  const auditQuery = trpc.bonuses.getTierAuditLogs.useQuery({ limit: 30 }, { enabled: isManager });

  // الصفوف قيد التعديل + آخر نسخة محفوظة للمقارنة
  const [rows, setRows] = useState<TierDraftRow[] | null>(null);
  const [baseline, setBaseline] = useState<TierDraftRow[]>([]);
  const [recalculateOpenPeriods, setRecalculateOpenPeriods] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [testRevenue, setTestRevenue] = useState("");

  useEffect(() => {
    if (tiersQuery.data && rows === null) {
      const initial = tiersToDraftRows(tiersQuery.data.tiers);
      setRows(initial);
      setBaseline(initial);
    }
  }, [tiersQuery.data, rows]);

  const draftRows = rows ?? [];
  const errors = useMemo(() => validateTierDraft(draftRows), [draftRows]);
  const ranges = useMemo(() => describeDraftRanges(draftRows), [draftRows]);
  const rules = useMemo(() => draftRowsToRules(draftRows), [draftRows]);
  const isDirty = rows !== null && isTierDraftDirty(draftRows, baseline);
  const isDefault = tiersQuery.data?.isDefault ?? false;

  const saveMutation = trpc.bonuses.saveTiers.useMutation({
    onSuccess: async (result) => {
      // الحفظ نجح لكن إعادة الاحتساب فشلت: تنبيه لا رسالة نجاح
      if (result.recalculationError) toast.warning(result.recalculationError);
      else toast.success(result.message);
      if (result.recalculation && result.recalculation.failed > 0) {
        toast.warning(`تعذرت إعادة احتساب ${result.recalculation.failed} فترة - يمكن إعادة احتسابها من صفحة البونص`);
      }
      const saved = tiersToDraftRows(result.tiers);
      setRows(saved);
      setBaseline(saved);
      // تحديث كل بيانات البونص (المستويات والسجل وصفحة البونص)
      await utils.bonuses.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حفظ المستويات");
      // قد يكون مدير آخر غيّر المستويات: نعرض الحالة الفعلية المحفوظة
      void utils.bonuses.getTiers.invalidate();
      void utils.bonuses.getTierAuditLogs.invalidate();
    },
  });

  const updateRow = (uid: string, patch: Partial<TierDraftRow>) => {
    setRows(prev => (prev ?? []).map(row => (row.uid === uid ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows(prev => {
      const list = prev ?? [];
      if (list.length >= MAX_BONUS_TIERS) return list;
      return [...list, createEmptyTierDraftRow(list.length)];
    });
  };

  const removeRow = (uid: string) => {
    setRows(prev => (prev ?? []).filter(row => row.uid !== uid));
  };

  const resetRows = () => {
    setRows(baseline.map(row => ({ ...row })));
  };

  const handleSave = () => {
    if (errors.length > 0) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    saveMutation.mutate({
      tiers: draftRowsToTierInput(draftRows).map(t => ({
        tierName: t.tierName ?? null,
        minRevenue: t.minRevenue,
        bonusAmount: t.bonusAmount,
        color: t.color ?? null,
      })),
      recalculateOpenPeriods,
    });
  };

  // اختبار مباشر على المستويات غير المحفوظة
  const testValue = parseAmountInput(testRevenue);
  const testResult = useMemo(() => {
    if (!Number.isFinite(testValue) || testValue < 0 || rules.length === 0) return null;
    return {
      match: resolveBonusTier(testValue, rules),
      next: revenueToNextTier(testValue, rules),
    };
  }, [testValue, rules]);

  // ==================== حالات الوصول ====================

  if (authLoading || !user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-medium mb-2">غير مصرح</h3>
          <p className="text-muted-foreground">إعدادات مستويات البونص متاحة للمسؤول والمدير فقط</p>
        </CardContent>
      </Card>
    );
  }

  const readOnly = !isManager;

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold flex items-center gap-2`}>
            <Layers className="h-6 w-6 text-primary" />
            إعدادات مستويات البونص
          </h1>
          <p className="text-muted-foreground text-sm">
            تحديد مبلغ البونص حسب إيراد الموظف في كل فترة من فترات الشهر
          </p>
        </div>
        {readOnly && (
          <Badge variant="outline" className="gap-1">
            <Lock className="h-3 w-3" />
            عرض فقط
          </Badge>
        )}
      </div>

      {readOnly && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>عرض فقط</AlertTitle>
          <AlertDescription>تعديل مستويات البونص متاح للمسؤول والمدير فقط.</AlertDescription>
        </Alert>
      )}

      {/* شرح طريقة الاحتساب والفترات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarRange className="h-5 w-5" />
            كيف يُحتسب البونص؟
          </CardTitle>
          <CardDescription>ينقسم كل شهر إلى فترات ثابتة ويُحتسب بونص كل فترة بشكل مستقل</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PERIODS_DESCRIPTION.map(period => (
              <div key={period.weekNumber} className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">الفترة {period.weekNumber}: </span>
                <span className="font-semibold">{period.label}</span>
              </div>
            ))}
          </div>
          <ul className="list-disc pr-5 space-y-1 text-sm text-muted-foreground">
            <li>إيراد الموظف في الفترة يُجمع تلقائياً من الكاشير (نقاط البيع) وصفحة الإيرادات، ويتحدث البونص عند تأكيد إيراد اليوم.</li>
            <li>يحصل الموظف على مبلغ أعلى مستوى وصل إيراده في الفترة إلى حده الأدنى، وإذا لم يصل لأقل مستوى فلا يستحق بونص.</li>
            <li>الفترة الأخيرة تمتد من يوم 29 حتى نهاية الشهر (فبراير غير الكبيسة 4 فترات فقط).</li>
            <li>البونص المطلوب صرفه أو المعتمد أو المصروف لا تتغير مبالغه عند تعديل المستويات.</li>
          </ul>
        </CardContent>
      </Card>

      {/* جدول المستويات */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5" />
                مستويات البونص
              </CardTitle>
              <CardDescription>
                حتى {MAX_BONUS_TIERS} مستويات - تُرتب تلقائياً تصاعدياً حسب الحد الأدنى عند الحفظ
              </CardDescription>
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={addRow}
                  disabled={draftRows.length >= MAX_BONUS_TIERS || rows === null}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  إضافة مستوى
                </Button>
                <Button variant="ghost" onClick={resetRows} disabled={!isDirty} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  تراجع
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDefault && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>لم يتم حفظ مستويات بعد</AlertTitle>
              <AlertDescription>
                يتم حالياً استخدام المستويات الافتراضية في الاحتساب.
                {!readOnly && " عدّلها حسب الحاجة ثم اضغط حفظ لاعتمادها."}
              </AlertDescription>
            </Alert>
          )}

          {tiersQuery.isLoading || (rows === null && !tiersQuery.error) ? (
            <Skeleton className="h-48 w-full" />
          ) : tiersQuery.error ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>تعذر تحميل المستويات</AlertTitle>
              <AlertDescription>{tiersQuery.error.message}</AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-10">#</TableHead>
                    <TableHead className="text-right min-w-[150px]">اسم المستوى</TableHead>
                    <TableHead className="text-right min-w-[150px]">الحد الأدنى للإيراد في الفترة (ر.س)</TableHead>
                    <TableHead className="text-right min-w-[120px]">مبلغ البونص (ر.س)</TableHead>
                    <TableHead className="text-right min-w-[130px]">نطاق الإيراد</TableHead>
                    <TableHead className="text-right min-w-[120px]">اللون</TableHead>
                    {!readOnly && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={readOnly ? 6 : 7} className="text-center text-muted-foreground py-8">
                        لا توجد مستويات - أضف مستوى واحداً على الأقل
                      </TableCell>
                    </TableRow>
                  ) : (
                    draftRows.map((row, index) => {
                      const hex = TIER_COLOR_HEX[row.color] ?? TIER_COLOR_HEX.gray;
                      return (
                        <TableRow key={row.uid}>
                          <TableCell>
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                              style={{ backgroundColor: hex, color: getReadableTextColor(hex) }}
                            >
                              {index + 1}
                            </span>
                          </TableCell>
                          <TableCell>
                            {readOnly ? (
                              <span className="font-medium">{row.tierName || `المستوى ${index + 1}`}</span>
                            ) : (
                              <Input
                                value={row.tierName}
                                onChange={e => updateRow(row.uid, { tierName: e.target.value })}
                                placeholder={`المستوى ${index + 1}`}
                                maxLength={100}
                                aria-label={`اسم المستوى ${index + 1}`}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {readOnly ? (
                              formatSar(parseAmountInput(row.minRevenue))
                            ) : (
                              <Input
                                value={row.minRevenue}
                                onChange={e => updateRow(row.uid, { minRevenue: e.target.value })}
                                inputMode="decimal"
                                dir="ltr"
                                placeholder="1450"
                                aria-label={`الحد الأدنى للإيراد للمستوى ${index + 1}`}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {readOnly ? (
                              <span className="font-bold text-green-600">{formatSar(parseAmountInput(row.bonusAmount))}</span>
                            ) : (
                              <Input
                                value={row.bonusAmount}
                                onChange={e => updateRow(row.uid, { bonusAmount: e.target.value })}
                                inputMode="decimal"
                                dir="ltr"
                                placeholder="35"
                                aria-label={`مبلغ البونص للمستوى ${index + 1}`}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {ranges[row.uid] ?? "-"}
                          </TableCell>
                          <TableCell>
                            {readOnly ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: hex }} />
                                {COLOR_LABELS[row.color] ?? row.color}
                              </span>
                            ) : (
                              <Select value={row.color} onValueChange={value => updateRow(row.uid, { color: value })}>
                                <SelectTrigger className="w-[120px]" aria-label={`لون المستوى ${index + 1}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(TIER_COLOR_HEX).map(([name, colorHex]) => (
                                    <SelectItem key={name} value={name}>
                                      <span className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorHex }} />
                                        {COLOR_LABELS[name] ?? name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          {!readOnly && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => removeRow(row.uid)}
                                aria-label={`حذف المستوى ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!readOnly && rows !== null && errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>يرجى تصحيح الأخطاء التالية</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pr-5 space-y-1">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {!readOnly && rows !== null && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t pt-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="recalculate-open-periods"
                  checked={recalculateOpenPeriods}
                  onCheckedChange={checked => setRecalculateOpenPeriods(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="recalculate-open-periods" className="cursor-pointer">
                    إعادة احتساب الفترات المفتوحة للشهر الحالي
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    تُطبق المستويات الجديدة على فترات الشهر الحالي التي لم يُطلب صرفها بعد في كل الفروع.
                    الفترات المطلوبة أو المعتمدة أو المصروفة لا تتغير.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={saveMutation.isPending || errors.length > 0 || (!isDirty && !isDefault)}
                className="gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ المستويات
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* الاختبار المباشر */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5" />
            اختبار المستويات
          </CardTitle>
          <CardDescription>
            {readOnly ? "أدخل إيراد موظف في فترة لمعرفة البونص المستحق" : "أدخل إيراد موظف في فترة لمعرفة البونص حسب الجدول أعلاه (قبل الحفظ)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="test-revenue">إيراد الموظف في الفترة (ر.س)</Label>
            <Input
              id="test-revenue"
              value={testRevenue}
              onChange={e => setTestRevenue(e.target.value)}
              inputMode="decimal"
              dir="ltr"
              placeholder="1500"
            />
          </div>
          {rules.length === 0 && draftRows.length > 0 ? (
            <p className="text-sm text-muted-foreground">صحح أخطاء الجدول أولاً لتفعيل الاختبار</p>
          ) : testRevenue.trim() === "" ? null : !testResult ? (
            <p className="text-sm text-destructive">أدخل مبلغاً صحيحاً</p>
          ) : (
            <div className="rounded-lg border p-4 space-y-2">
              {testResult.match.isEligible ? (
                <p className="text-base">
                  إيراد <span className="font-bold">{formatSar(testValue)}</span> ←{" "}
                  <span className="font-semibold">{testResult.match.tierName}</span>: بونص{" "}
                  <span className="font-bold text-green-600">{formatSar(testResult.match.amount)}</span>
                </p>
              ) : (
                <p className="text-base">
                  إيراد <span className="font-bold">{formatSar(testValue)}</span> ← <span className="font-semibold">غير مؤهل</span> (لا يوجد بونص)
                </p>
              )}
              {testResult.next.nextTier ? (
                <p className="text-sm text-muted-foreground">
                  متبقي {formatSar(testResult.next.remaining)} للوصول إلى {testResult.next.nextTier.tierName} (
                  {formatSar(testResult.next.nextTier.bonusAmount)})
                </p>
              ) : (
                testResult.match.isEligible && <p className="text-sm text-muted-foreground">هذا أعلى مستوى</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل التغييرات */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              سجل تغييرات المستويات
            </CardTitle>
            <CardDescription>آخر 30 تعديل على مستويات البونص</CardDescription>
          </CardHeader>
          <CardContent>
            {auditQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : auditQuery.error ? (
              <p className="text-sm text-destructive">{auditQuery.error.message}</p>
            ) : auditQuery.data && auditQuery.data.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right whitespace-nowrap">التاريخ</TableHead>
                      <TableHead className="text-right">بواسطة</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right min-w-[200px]">قبل</TableHead>
                      <TableHead className="text-right min-w-[200px]">بعد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditQuery.data.map(log => {
                      const before = summarizeTierSnapshot(log.oldValues);
                      const after = summarizeTierSnapshot(log.newValues);
                      return (
                        <TableRow key={log.id} className="align-top">
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(log.createdAt), "d/M/yyyy HH:mm", { locale: ar })}
                          </TableCell>
                          <TableCell className="text-sm">{log.userName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{TIER_CHANGE_TYPE_LABELS[log.changeType] ?? log.changeType}</Badge>
                            {log.description && <p className="text-xs text-muted-foreground mt-1">{log.description}</p>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {before.length > 0 ? before.map((line, i) => <div key={i}>{line}</div>) : "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {after.length > 0 ? after.map((line, i) => <div key={i}>{line}</div>) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">لا توجد تغييرات مسجلة</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* تأكيد الحفظ */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حفظ مستويات البونص</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>سيتم استبدال المستويات الحالية بـ {draftRows.length} مستوى:</p>
                <ul className="list-disc pr-5">
                  {rules.map(rule => (
                    <li key={rule.tierKey}>
                      {rule.tierName}: من {formatSar(rule.minRevenue)} ← بونص {formatSar(rule.bonusAmount)}
                    </li>
                  ))}
                </ul>
                <p>
                  {recalculateOpenPeriods
                    ? "سيتم إعادة احتساب الفترات المفتوحة للشهر الحالي في جميع الفروع."
                    : "ستُطبق المستويات على الاحتسابات القادمة فقط."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>تأكيد الحفظ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
