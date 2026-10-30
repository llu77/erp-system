/**
 * تفاصيل إنهاء الخدمة: خطاب انتهاء العقد وعدم التجديد + المخالصة النهائية
 * المعاينة والطباعة من القالب المشترك، وPDF من الخادم. التوقيعات والختم بعد الاعتماد فقط.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle,
  ChevronDown,
  Download,
  FileSignature,
  FileText,
  Info,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  ShieldAlert,
  UserX,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  END_OF_SERVICE_DOCUMENT_TITLES,
  END_OF_SERVICE_PAYMENT_METHODS,
  canTransitionEndOfService,
  isEndOfServiceSigned,
  type EndOfServiceDocumentKind,
} from "@shared/endOfService";
import { renderEndOfServiceDocumentHtml } from "@shared/endOfServiceTemplate";
import { formatVoucherDate, formatVoucherDateTime } from "@shared/vouchers";
import EndOfServiceForm from "@/components/endOfService/EndOfServiceForm";
import { EndOfServiceStatusBadge } from "@/components/endOfService/EndOfServiceStatusBadge";
import {
  CalculationBreakdown,
  CalculationWarnings,
  NetAmountBox,
} from "@/components/endOfService/CalculationBreakdown";
import type {
  EosDetail,
  EosPaymentMethod,
} from "@/components/endOfService/types";
import {
  canManageEndOfService,
  canViewEndOfService,
  downloadBase64Pdf,
  errorMessage,
  formatSar,
  retryUnlessFinal,
  trpcErrorCode,
} from "@/components/endOfService/utils";

const DOCUMENT_KINDS: EndOfServiceDocumentKind[] = ["letter", "settlement"];
const DOCUMENT_TAB_LABELS: Record<EndOfServiceDocumentKind, string> = {
  letter: "خطاب إنهاء الخدمة",
  settlement: "المخالصة النهائية",
};
const PAYMENT_METHODS = Object.keys(
  END_OF_SERVICE_PAYMENT_METHODS
) as EosPaymentMethod[];

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-left font-medium min-w-0 break-words">
        {children}
      </span>
    </div>
  );
}

function StateCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-3">
        <div className="flex justify-center text-muted-foreground">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

export default function EndOfServiceDetail() {
  const [, params] = useRoute("/end-of-service/:id");
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const id = Number(params?.id);
  const validId = Number.isInteger(id) && id > 0;
  const canView = canViewEndOfService(user?.role);
  const isManager = canManageEndOfService(user?.role);

  const detailQuery = trpc.endOfService.getById.useQuery(
    { id: validId ? id : 0 },
    { enabled: validId && canView, retry: retryUnlessFinal }
  );
  const data: EosDetail | undefined = detailQuery.data;

  const [activeDoc, setActiveDoc] =
    useState<EndOfServiceDocumentKind>("letter");
  const [showEdit, setShowEdit] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState<EosPaymentMethod>("bank_transfer");
  const [payReference, setPayReference] = useState("");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const approveMutation = trpc.endOfService.approve.useMutation();
  const markPaidMutation = trpc.endOfService.markPaid.useMutation();
  const cancelMutation = trpc.endOfService.cancel.useMutation();
  const pdfMutation = trpc.endOfService.pdf.useMutation();
  const pdfPendingKind: string | null = pdfMutation.isPending
    ? ((pdfMutation.variables as { document?: string } | undefined)?.document ??
      null)
    : null;

  // معاينة المستند النشط (القالب قد لا يكون جاهزاً بعد: يظهر بديل ودّي)
  const preview = useMemo((): { html: string; failed: boolean } => {
    if (!data) return { html: "", failed: false };
    try {
      return {
        html: renderEndOfServiceDocumentHtml(activeDoc, data.document, {
          assetBaseUrl: window.location.origin,
        }),
        failed: false,
      };
    } catch (error) {
      console.error("[EndOfService] template render failed", error);
      return { html: "", failed: true };
    }
  }, [data, activeDoc]);

  const refreshAfterChange = async () => {
    await Promise.all([
      utils.endOfService.getById.invalidate({ id }),
      utils.endOfService.list.invalidate(),
      utils.employeeRequests.list.invalidate(),
      utils.employees.list.invalidate(),
    ]);
  };

  // ==================== الإجراءات ====================

  const handleApprove = async () => {
    try {
      const result: { success: boolean; message: string } =
        await approveMutation.mutateAsync({ id });
      toast.success(result.message || "تم اعتماد المخالصة");
      setConflictMessage(null);
      setShowApprove(false);
      await refreshAfterChange();
    } catch (error) {
      const message = errorMessage(error, "فشل اعتماد المخالصة");
      setShowApprove(false);
      if (trpcErrorCode(error) === "CONFLICT") {
        // الخادم حفظ الأرقام الجديدة: نعرضها للمراجعة قبل إعادة الاعتماد
        setConflictMessage(message);
        toast.warning(message);
        await refreshAfterChange();
      } else {
        toast.error(message);
      }
    }
  };

  const handleCancel = async () => {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("يرجى كتابة سبب الإلغاء (3 أحرف على الأقل)");
      return;
    }
    try {
      const result: { success: boolean; message: string } =
        await cancelMutation.mutateAsync({ id, reason });
      toast.success(result.message || "تم إلغاء المخالصة");
      setShowCancel(false);
      setCancelReason("");
      setConflictMessage(null);
      await refreshAfterChange();
    } catch (error) {
      toast.error(errorMessage(error, "فشل إلغاء المخالصة"));
    }
  };

  const handleMarkPaid = async () => {
    const reference = payReference.trim();
    if (payMethod === "check" && !reference) {
      toast.error("يرجى إدخال رقم الشيك");
      return;
    }
    try {
      const result: { success: boolean; message: string } =
        await markPaidMutation.mutateAsync({
          id,
          paymentMethod: payMethod,
          paymentReference: reference || undefined,
        });
      toast.success(result.message || "تم تسجيل الصرف");
      setShowPay(false);
      setPayReference("");
      await refreshAfterChange();
    } catch (error) {
      toast.error(errorMessage(error, "فشل تسجيل الصرف"));
    }
  };

  const handleDownloadPdf = async (kind: EndOfServiceDocumentKind) => {
    const toastId = `eos-pdf-${id}-${kind}`;
    try {
      toast.loading("جاري توليد ملف PDF...", { id: toastId });
      const result: { pdf: string; filename: string } =
        await pdfMutation.mutateAsync({ id, document: kind });
      downloadBase64Pdf(result.pdf, result.filename);
      toast.success("تم تحميل الملف", { id: toastId });
    } catch (error) {
      toast.error(errorMessage(error, "فشل توليد ملف PDF"), { id: toastId });
    }
  };

  // الطباعة: القالب يُبنى قبل فتح النافذة (متزامن) حتى لا يحظرها المتصفح
  const handlePrint = (kind: EndOfServiceDocumentKind) => {
    if (!data) return;
    let html: string;
    try {
      html = renderEndOfServiceDocumentHtml(kind, data.document, {
        assetBaseUrl: window.location.origin,
        autoPrint: true,
      });
    } catch (error) {
      console.error("[EndOfService] print render failed", error);
      toast.error("قالب الطباعة غير متاح حالياً، استخدم تحميل PDF");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // ==================== الحالات العامة ====================

  const backButton = (
    <Button variant="outline" onClick={() => navigate("/end-of-service")}>
      <ArrowRight className="w-4 h-4 ml-2" />
      العودة إلى القائمة
    </Button>
  );

  if (authLoading) {
    return (
      <div className="space-y-4" dir="rtl">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div dir="rtl">
        <StateCard
          icon={<ShieldAlert className="w-12 h-12 text-red-500" />}
          title="غير مصرح"
        >
          <p className="text-muted-foreground">
            صفحة إنهاء الخدمة متاحة للإدارة والمشرفين فقط
          </p>
        </StateCard>
      </div>
    );
  }

  const errorCode = trpcErrorCode(detailQuery.error);
  if (!validId || errorCode === "NOT_FOUND") {
    return (
      <div dir="rtl">
        <StateCard
          icon={<FileText className="w-12 h-12" />}
          title="المخالصة غير موجودة"
        >
          <p className="text-muted-foreground">
            ربما حُذفت أو أن الرابط غير صحيح
          </p>
          {backButton}
        </StateCard>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-[70vh] w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (detailQuery.error || !data) {
    return (
      <div dir="rtl">
        <StateCard
          icon={<AlertTriangle className="w-12 h-12 text-red-500" />}
          title={
            errorCode === "FORBIDDEN"
              ? "غير مصرح بعرض هذه المخالصة"
              : "تعذر تحميل المخالصة"
          }
        >
          <p className="text-muted-foreground">
            {errorMessage(detailQuery.error, "حدث خطأ غير متوقع")}
          </p>
          <div className="flex justify-center gap-2">
            {errorCode !== "FORBIDDEN" && (
              <Button variant="outline" onClick={() => detailQuery.refetch()}>
                <RefreshCw className="w-4 h-4 ml-2" />
                إعادة المحاولة
              </Button>
            )}
            {backButton}
          </div>
        </StateCard>
      </div>
    );
  }

  // ==================== العرض ====================

  const doc = data.document;
  const calc = doc.calculation;
  const status = data.status;
  const signed = isEndOfServiceSigned(status);
  const canManage = isManager && data.canManage;
  const canEdit = canManage && status === "draft";
  const canApprove = canManage && canTransitionEndOfService(status, "approved");
  const canPay = canManage && canTransitionEndOfService(status, "paid");
  const canCancel = canManage && canTransitionEndOfService(status, "cancelled");
  const busy =
    approveMutation.isPending ||
    markPaidMutation.isPending ||
    cancelMutation.isPending;
  const owedByEmployee = calc.netAmount < 0;

  return (
    <div className="space-y-5" dir="rtl">
      {/* الرأس */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/end-of-service")}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowRight className="w-4 h-4" />
            إنهاء الخدمة والمخالصات النهائية
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 flex-wrap">
            <UserX className="w-7 h-7 text-red-600 shrink-0" />
            <span className="min-w-0 break-words">{doc.employeeName}</span>
            <EndOfServiceStatusBadge status={status} className="text-sm" />
          </h1>
          <p className="text-muted-foreground mt-1 text-sm flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-mono font-semibold text-foreground">
              {data.settlementNumber}
            </span>
            <span>
              كود الموظف: <span className="font-mono">{doc.employeeCode}</span>
            </span>
            {doc.branchName && <span>الفرع: {doc.branchName}</span>}
            <span>آخر يوم عمل: {formatVoucherDate(doc.lastWorkingDay)}</span>
          </p>
        </div>

        {canManage && (canEdit || canApprove || canPay || canCancel) && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => setShowEdit(true)}
                disabled={busy}
              >
                <Pencil className="w-4 h-4 ml-2" />
                تعديل
              </Button>
            )}
            {canApprove && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShowApprove(true)}
                disabled={busy}
              >
                <CheckCircle className="w-4 h-4 ml-2" />
                اعتماد
              </Button>
            )}
            {canPay && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setPayReference("");
                  setShowPay(true);
                }}
                disabled={busy}
              >
                <Banknote className="w-4 h-4 ml-2" />
                تسجيل الصرف
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => {
                  setCancelReason("");
                  setShowCancel(true);
                }}
                disabled={busy}
              >
                <XCircle className="w-4 h-4 ml-2" />
                إلغاء
              </Button>
            )}
          </div>
        )}
      </div>

      {conflictMessage && status === "draft" && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>لم يتم الاعتماد</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
            <p>{conflictMessage}</p>
            <p>
              الأرقام المعروضة الآن محدّثة، راجع المخالصة ثم اعتمد مرة أخرى.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {status === "cancelled" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>المخالصة ملغاة</AlertTitle>
          <AlertDescription>
            <p>
              {doc.cancellationReason
                ? `السبب: ${doc.cancellationReason}`
                : "تم إلغاء إنهاء الخدمة"}
              {doc.cancelledByName ? ` - بواسطة ${doc.cancelledByName}` : ""}
              {doc.cancelledAt
                ? ` - ${formatVoucherDateTime(doc.cancelledAt)}`
                : ""}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {status !== "cancelled" && !signed && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>مسودة بانتظار الاعتماد</AlertTitle>
          <AlertDescription>
            التوقيعات والختم تظهر على الخطاب والمخالصة بعد اعتماد الإدارة فقط.
            يمكن تعديل البيانات حتى الاعتماد.
          </AlertDescription>
        </Alert>
      )}

      {status !== "cancelled" && data.warnings.length > 0 && (
        <CalculationWarnings
          warnings={data.warnings}
          title={status === "draft" ? undefined : "تنبيهات الحساب"}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* المستندات */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 space-y-3">
            <Tabs
              value={activeDoc}
              onValueChange={value =>
                setActiveDoc(value as EndOfServiceDocumentKind)
              }
            >
              <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
                {DOCUMENT_KINDS.map(kind => (
                  <TabsTrigger key={kind} value={kind} className="gap-1.5">
                    {kind === "letter" ? (
                      <FileSignature className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    {DOCUMENT_TAB_LABELS[kind]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {END_OF_SERVICE_DOCUMENT_TITLES[activeDoc].ar}
                </CardTitle>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {END_OF_SERVICE_DOCUMENT_TITLES[activeDoc].en}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint(activeDoc)}
                >
                  <Printer className="w-4 h-4 ml-1.5" />
                  طباعة
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownloadPdf(activeDoc)}
                  disabled={pdfPendingKind === activeDoc}
                >
                  {pdfPendingKind === activeDoc ? (
                    <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ml-1.5" />
                  )}
                  {pdfPendingKind === activeDoc
                    ? "جاري التوليد..."
                    : "تحميل PDF"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
            {preview.failed ? (
              <div className="rounded-lg border border-dashed py-16 px-4 text-center space-y-2 bg-muted/20">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="font-medium">معاينة المستند غير متاحة حالياً</p>
                <p className="text-sm text-muted-foreground">
                  يمكنك تحميل نسخة PDF من الزر أعلاه.
                </p>
              </div>
            ) : (
              <iframe
                key={activeDoc}
                title={DOCUMENT_TAB_LABELS[activeDoc]}
                srcDoc={preview.html}
                sandbox="allow-same-origin"
                className="w-full h-[75vh] min-h-[480px] border rounded bg-white"
              />
            )}
          </CardContent>
        </Card>

        {/* الملخص */}
        <div className="space-y-4 order-first lg:order-none">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ملخص المخالصة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="divide-y">
                <InfoRow label="سبب إنهاء الخدمة">
                  انتهاء مدة العقد وعدم التجديد
                </InfoRow>
                {doc.position && (
                  <InfoRow label="المسمى الوظيفي">{doc.position}</InfoRow>
                )}
                <InfoRow label="تاريخ المباشرة">
                  {formatVoucherDate(doc.hireDate)}
                </InfoRow>
                <InfoRow label="انتهاء العقد">
                  {formatVoucherDate(doc.contractEndDate)}
                </InfoRow>
                <InfoRow label="مدة الخدمة">{calc.serviceText}</InfoRow>
                <InfoRow label="الأجر الشهري المعتمد">
                  {formatSar(calc.monthlyWage)}
                </InfoRow>
                <InfoRow label="إجمالي المستحقات">
                  {formatSar(calc.totalEntitlements)}
                </InfoRow>
                <InfoRow label="إجمالي الخصومات">
                  <span
                    className={
                      calc.totalDeductions > 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                    }
                  >
                    {formatSar(calc.totalDeductions)}
                  </span>
                </InfoRow>
              </div>
              <NetAmountBox calculation={calc} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">سجل المخالصة</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="تاريخ الخطاب">
                {formatVoucherDate(doc.letterDate)}
              </InfoRow>
              <InfoRow label="أُنشئت">
                {doc.createdByName || "-"}
                {doc.createdAt ? (
                  <span className="block text-xs text-muted-foreground">
                    {formatVoucherDateTime(doc.createdAt)}
                  </span>
                ) : null}
              </InfoRow>
              {doc.approvedAt && (
                <InfoRow label="اعتُمدت">
                  {doc.approvedByName || "-"}
                  <span className="block text-xs text-muted-foreground">
                    {formatVoucherDateTime(doc.approvedAt)}
                  </span>
                </InfoRow>
              )}
              {doc.paidAt && (
                <InfoRow label={owedByEmployee ? "سُويت" : "صُرفت"}>
                  {doc.paidByName || "-"}
                  <span className="block text-xs text-muted-foreground">
                    {formatVoucherDateTime(doc.paidAt)}
                  </span>
                </InfoRow>
              )}
              {doc.paymentMethod && (
                <InfoRow label="طريقة الصرف">
                  {END_OF_SERVICE_PAYMENT_METHODS[doc.paymentMethod]?.ar ??
                    doc.paymentMethod}
                  {doc.paymentReference ? (
                    <span className="block text-xs text-muted-foreground font-mono">
                      {doc.paymentReference}
                    </span>
                  ) : null}
                </InfoRow>
              )}
              {doc.notes && <InfoRow label="ملاحظات">{doc.notes}</InfoRow>}
            </CardContent>
          </Card>

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-6 py-4 text-right"
                >
                  <span className="font-semibold">تفاصيل الحساب</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <CalculationBreakdown
                    calculation={calc}
                    advances={doc.advances}
                    violations={doc.violations}
                    notes={{
                      leaveNote: doc.leaveNote,
                      salaryNote: doc.salaryNote,
                      otherAdditionsNote: doc.otherAdditionsNote,
                      otherDeductionsNote: doc.otherDeductionsNote,
                    }}
                    showWarnings={false}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>

      {/* تعديل المسودة */}
      {showEdit && (
        <EndOfServiceForm
          open={showEdit}
          onOpenChange={setShowEdit}
          settlement={{
            id: data.id,
            settlementNumber: data.settlementNumber,
            employeeName: doc.employeeName,
            form: data.form,
          }}
          onSaved={() => setConflictMessage(null)}
        />
      )}

      {/* تأكيد الاعتماد */}
      <AlertDialog
        open={showApprove}
        onOpenChange={open =>
          !approveMutation.isPending && setShowApprove(open)
        }
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              اعتماد إنهاء الخدمة {data.settlementNumber}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>عند الاعتماد:</p>
                <ul className="list-disc pr-5 space-y-1">
                  <li>
                    تُضاف توقيعات الإدارة وختم الشركة على الخطاب والمخالصة.
                  </li>
                  <li>
                    تُربط السلف والمخالفات المخصومة بهذه المخالصة فلا تُخصم مرة
                    أخرى في المسيرات.
                  </li>
                  <li>يُعطَّل الموظف {doc.employeeName} في النظام.</li>
                  <li>
                    يُعاد الحساب قبل الاعتماد؛ إن تغيرت الأرقام يتوقف الاعتماد
                    لتراجعها.
                  </li>
                </ul>
                <p className="font-medium text-foreground">
                  {owedByEmployee
                    ? "الصافي المستحق على الموظف"
                    : "صافي المستحق للموظف"}
                  : {formatSar(Math.abs(calc.netAmount))}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={approveMutation.isPending}>
              تراجع
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={approveMutation.isPending}
              onClick={event => {
                event.preventDefault();
                void handleApprove();
              }}
            >
              {approveMutation.isPending && (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              )}
              {approveMutation.isPending ? "جاري الاعتماد..." : "اعتماد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* تسجيل الصرف */}
      <Dialog
        open={showPay}
        onOpenChange={open => !markPaidMutation.isPending && setShowPay(open)}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>
              تسجيل صرف المخالصة {data.settlementNumber}
            </DialogTitle>
            <DialogDescription>
              {owedByEmployee
                ? `الصافي مستحق على الموظف (${formatSar(Math.abs(calc.netAmount))}): سجّل طريقة استلام المبلغ منه.`
                : `سيُسجل صرف صافي المستحق ${formatSar(calc.netAmount)} للموظف. هذه حالة نهائية.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">طريقة الصرف *</Label>
              <Select
                value={payMethod}
                onValueChange={value => setPayMethod(value as EosPaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(method => (
                    <SelectItem key={method} value={method}>
                      {END_OF_SERVICE_PAYMENT_METHODS[method].ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {payMethod !== "cash" && (
              <div>
                <Label className="mb-1.5 block">
                  {payMethod === "check"
                    ? "رقم الشيك *"
                    : "رقم المرجع / الحوالة"}
                </Label>
                <Input
                  value={payReference}
                  onChange={e => setPayReference(e.target.value)}
                  maxLength={100}
                  dir="ltr"
                  className="text-right"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPay(false)}
              disabled={markPaidMutation.isPending}
            >
              تراجع
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleMarkPaid}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Banknote className="w-4 h-4 ml-2" />
              )}
              {markPaidMutation.isPending ? "جاري التسجيل..." : "تسجيل الصرف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* الإلغاء */}
      <Dialog
        open={showCancel}
        onOpenChange={open => !cancelMutation.isPending && setShowCancel(open)}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>
              إلغاء إنهاء الخدمة {data.settlementNumber}
            </DialogTitle>
            <DialogDescription>
              {status === "approved"
                ? "المخالصة معتمدة: الإلغاء يعيد تفعيل الموظف ويحرر السلف والمخالفات المربوطة بها لتعود قابلة للخصم في المسيرات."
                : "تُلغى المسودة والطلب المرتبط بها، وتبقى في السجل للمراجعة."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>سبب الإلغاء *</Label>
            <Textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="مثال: تم تجديد العقد"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancel(false)}
              disabled={cancelMutation.isPending}
            >
              تراجع
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={
                cancelMutation.isPending || cancelReason.trim().length < 3
              }
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 ml-2" />
              )}
              {cancelMutation.isPending ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
