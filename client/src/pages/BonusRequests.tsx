import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileDown,
  Gift,
  History,
  Loader2,
  Send,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { BONUS_PAYMENT_METHOD_LABELS } from "@shared/bonusHelpers";
import { generateBonusPDF, PrintWindowBlockedError } from "@/lib/bonusPdfGenerator";
import { formatSar } from "@/lib/bonusUi";
import { BonusStatusBadge, BonusTierBadge } from "@/components/bonus/BonusBadges";

type BonusRow = inferRouterOutputs<AppRouter>["bonuses"]["all"][number];
type PaymentMethod = "cash" | "bank_transfer" | "check";

// المبلغ النهائي حسب الحالة (المصروف ← المعتمد ← المحتسب)
function getDisplayAmount(row: BonusRow): string {
  if (row.status === "paid") return row.paidAmount ?? row.approvedAmount ?? row.totalAmount;
  if (row.status === "approved") return row.approvedAmount ?? row.totalAmount;
  return row.totalAmount;
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  return format(new Date(value), "d/M/yyyy HH:mm", { locale: ar });
}

const BORDER_BY_STATUS: Record<string, string> = {
  requested: "border-l-blue-500",
  approved: "border-l-green-500",
  rejected: "border-l-red-500",
  paid: "border-l-purple-500",
};

export default function BonusRequests() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const isManager = user?.role === "admin" || user?.role === "manager";

  const [activeTab, setActiveTab] = useState("pending");
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [approveTarget, setApproveTarget] = useState<BonusRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BonusRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [payTarget, setPayTarget] = useState<BonusRow | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [exportingPDF, setExportingPDF] = useState<number | null>(null);

  // الطلبات بانتظار الموافقة
  const { data: pendingRequests, isLoading: pendingLoading } = trpc.bonuses.pending.useQuery(undefined, { enabled: isManager });
  // الموافق عليها بانتظار الصرف
  const { data: approvedRequests, isLoading: approvedLoading } = trpc.bonuses.approvedForPayment.useQuery(undefined, { enabled: isManager });
  // المصروفة
  const { data: paidRequests, isLoading: paidLoading } = trpc.bonuses.paidHistory.useQuery({ limit: 50 }, { enabled: isManager });
  // السجل الكامل
  const { data: allRequests, isLoading: allLoading } = trpc.bonuses.all.useQuery({ limit: 100 }, { enabled: isManager });
  // الإحصائيات
  const { data: bonusStats, isLoading: statsLoading } = trpc.bonuses.stats.useQuery(undefined, { enabled: isManager });
  // المستويات الحالية (ألوان الشارات ودليل التقرير)
  const { data: tiersData } = trpc.bonuses.getTiers.useQuery(undefined, { enabled: isManager });
  const tiers = tiersData?.tiers ?? null;

  // تحديث القوائم والإحصائيات بعد كل إجراء
  const refreshBonusData = async () => {
    await Promise.all([
      utils.bonuses.pending.invalidate(),
      utils.bonuses.approvedForPayment.invalidate(),
      utils.bonuses.paidHistory.invalidate(),
      utils.bonuses.all.invalidate(),
      utils.bonuses.stats.invalidate(),
      utils.bonuses.getWeek.invalidate(),
      utils.bonuses.current.invalidate(),
      utils.bonuses.history.invalidate(),
      utils.bonuses.auditLogs.invalidate(),
    ]);
  };

  // الموافقة
  const approveMutation = trpc.bonuses.approve.useMutation({
    onSuccess: async (result) => {
      toast.success(result.message);
      setApproveTarget(null);
      await refreshBonusData();
    },
    onError: (error) => {
      toast.error(error.message || "فشلت الموافقة");
    },
  });

  // الرفض (السبب مطلوب)
  const rejectMutation = trpc.bonuses.reject.useMutation({
    onSuccess: async (result) => {
      toast.success(result.message);
      setRejectTarget(null);
      setRejectionReason("");
      await refreshBonusData();
    },
    onError: (error) => {
      toast.error(error.message || "فشل الرفض");
    },
  });

  // تأكيد الصرف
  const markPaidMutation = trpc.bonuses.markAsPaid.useMutation({
    onSuccess: async (result) => {
      toast.success(result.message);
      setPayTarget(null);
      await refreshBonusData();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تسجيل الصرف");
    },
  });

  // طلب الصرف (للفترات المنتهية غير المطلوبة أو المرفوضة)
  const requestMutation = trpc.bonuses.request.useMutation({
    onSuccess: async (result) => {
      toast.success(result.message);
      await refreshBonusData();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال طلب الصرف");
    },
  });

  // تصدير PDF (من جهة الواجهة)
  const handleExportPDF = async (request: BonusRow) => {
    setExportingPDF(request.id);
    try {
      await generateBonusPDF(request, { tiers });
      toast.success("تم فتح التقرير للطباعة أو الحفظ كـ PDF");
    } catch (error) {
      if (error instanceof PrintWindowBlockedError) {
        toast.error(error.message);
      } else {
        toast.error("فشل تصدير التقرير");
        console.error("PDF export error:", error);
      }
    } finally {
      setExportingPDF(null);
    }
  };

  const openPayDialog = (request: BonusRow) => {
    setPayTarget(request);
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentNotes("");
  };

  const referenceRequired = paymentMethod !== "cash";
  const canConfirmPayment = !referenceRequired || paymentReference.trim().length > 0;

  const handleMarkPaid = () => {
    if (!payTarget || !canConfirmPayment) return;
    markPaidMutation.mutate({
      weeklyBonusId: payTarget.id,
      paymentMethod,
      paymentReference: paymentReference.trim() || undefined,
      paymentNotes: paymentNotes.trim() || undefined,
    });
  };

  const handleReject = () => {
    if (!rejectTarget || !rejectionReason.trim()) return;
    rejectMutation.mutate({ weeklyBonusId: rejectTarget.id, reason: rejectionReason.trim() });
  };

  const toggleExpanded = (id: number) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // التحقق من الصلاحية (المسؤول والمدير)
  if (authLoading || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!isManager) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-medium mb-2">غير مصرح</h3>
          <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤول والمدير فقط</p>
        </CardContent>
      </Card>
    );
  }

  const renderBonusCard = (request: BonusRow) => {
    const expanded = expandedRequests.has(request.id);
    return (
      <Card key={request.id} className={`border-l-4 ${BORDER_BY_STATUS[request.status] ?? "border-l-gray-500"}`}>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  {request.branchName}
                </CardTitle>
                <BonusStatusBadge status={request.status} />
              </div>
              <CardDescription className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {request.periodLabel}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {request.eligibleCount}/{request.totalEmployees} مؤهل
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  إيراد الفترة {formatSar(request.totalRevenue)}
                </span>
              </CardDescription>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-primary">{formatSar(getDisplayAmount(request))}</div>
              {request.status === "paid" && <div className="text-xs text-muted-foreground">المبلغ المصروف</div>}
              {request.status === "approved" && <div className="text-xs text-muted-foreground">المبلغ المعتمد</div>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* مراحل الطلب */}
          <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {request.requestedAt && (
              <div className="flex items-center gap-1">
                <Send className="h-3.5 w-3.5" />
                طلب الصرف: {request.requestedByName || "-"} - {formatDateTime(request.requestedAt)}
              </div>
            )}
            {request.approvedAt && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                الموافقة: {request.approvedByName || "-"} - {formatDateTime(request.approvedAt)}
              </div>
            )}
            {request.status === "paid" && (
              <div className="flex items-center gap-1 sm:col-span-2">
                <Banknote className="h-3.5 w-3.5" />
                الصرف: {request.paidByName || "-"} - {formatDateTime(request.paidAt)} -{" "}
                {request.paymentMethod ? BONUS_PAYMENT_METHOD_LABELS[request.paymentMethod] ?? request.paymentMethod : "-"}
                {request.paymentReference ? ` - المرجع: ${request.paymentReference}` : ""}
              </div>
            )}
            {request.status === "paid" && request.paymentNotes && (
              <div className="sm:col-span-2">ملاحظات الصرف: {request.paymentNotes}</div>
            )}
          </div>

          {/* سبب الرفض */}
          {request.status === "rejected" && request.rejectionReason && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-600">
                <strong>سبب الرفض:</strong> {request.rejectionReason}
                {request.rejectedByName ? ` (${request.rejectedByName} - ${formatDateTime(request.rejectedAt)})` : ""}
              </p>
            </div>
          )}

          {/* تفاصيل الموظفين */}
          <Button variant="ghost" className="w-full flex items-center justify-center gap-2" onClick={() => toggleExpanded(request.id)}>
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                إخفاء التفاصيل
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                عرض تفاصيل الموظفين ({request.details.length} موظف)
              </>
            )}
          </Button>

          {expanded && (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">الإيراد في الفترة</TableHead>
                    <TableHead className="text-right">المستوى</TableHead>
                    <TableHead className="text-right">البونص</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.details.map(detail => (
                    <TableRow key={detail.id}>
                      <TableCell className="font-medium">{detail.employeeName || "-"}</TableCell>
                      <TableCell>{detail.employeeCode || "-"}</TableCell>
                      <TableCell>{formatSar(detail.weeklyRevenue)}</TableCell>
                      <TableCell>
                        <BonusTierBadge tierKey={detail.bonusTier} label={detail.tierLabel} tiers={tiers} />
                      </TableCell>
                      <TableCell className="font-bold text-green-600">{formatSar(detail.bonusAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* الإجراءات */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-1">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => handleExportPDF(request)}
              disabled={exportingPDF === request.id}
            >
              {exportingPDF === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              تصدير PDF
            </Button>

            <div className="flex flex-wrap gap-2">
              {request.status === "requested" && (
                <>
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setRejectTarget(request);
                      setRejectionReason("");
                    }}
                  >
                    <XCircle className="h-4 w-4 ml-2" />
                    رفض
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => setApproveTarget(request)}>
                    <CheckCircle className="h-4 w-4 ml-2" />
                    موافقة
                  </Button>
                </>
              )}
              {request.status === "approved" && (
                <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => openPayDialog(request)}>
                  <Banknote className="h-4 w-4 ml-2" />
                  تأكيد الصرف
                </Button>
              )}
              {request.canRequest && (request.status === "pending" || request.status === "rejected") && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => requestMutation.mutate({ weeklyBonusId: request.id })}
                  disabled={requestMutation.isPending}
                >
                  {requestMutation.isPending && requestMutation.variables?.weeklyBonusId === request.id ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 ml-2" />
                  )}
                  {request.status === "rejected" ? "إعادة طلب الصرف" : "طلب صرف البونص"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderList = (
    rows: BonusRow[] | undefined,
    loading: boolean,
    empty: { icon: typeof Gift; title: string; description: string }
  ) => {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      );
    }
    if (!rows || rows.length === 0) {
      const Icon = empty.icon;
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <Icon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">{empty.title}</h3>
            <p className="text-muted-foreground">{empty.description}</p>
          </CardContent>
        </Card>
      );
    }
    return <div className="space-y-4">{rows.map(renderBonusCard)}</div>;
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Send className="h-6 w-6 text-primary" />
          طلبات صرف البونص
        </h1>
        <p className="text-muted-foreground">مراجعة طلبات صرف البونص والموافقة عليها وتسجيل صرفها</p>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-600">
              <CalendarDays className="h-4 w-4" />
              المصروف هذا الشهر
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">{formatSar(bonusStats?.totalPaidThisMonth)}</div>
                <p className="text-xs text-muted-foreground mt-1">{bonusStats?.totalBeneficiariesThisMonth || 0} موظف مستفيد</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-blue-600">
              <TrendingUp className="h-4 w-4" />
              المصروف هذه السنة
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-600">{formatSar(bonusStats?.totalPaidThisYear)}</div>
                <p className="text-xs text-muted-foreground mt-1">{bonusStats?.totalBeneficiariesThisYear || 0} موظف مستفيد</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-orange-600">
              <Clock className="h-4 w-4" />
              بانتظار الموافقة
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-600">{bonusStats?.pendingRequestsCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">بقيمة {formatSar(bonusStats?.pendingRequestsAmount)}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-purple-600">
              <CheckCircle className="h-4 w-4" />
              موافق عليها - بانتظار الصرف
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-purple-600">{bonusStats?.approvedNotPaidCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">بقيمة {formatSar(bonusStats?.approvedNotPaidAmount)}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full flex-wrap h-auto gap-1 sm:grid sm:grid-cols-4 sm:max-w-3xl">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            بانتظار الموافقة
            {pendingRequests && pendingRequests.length > 0 && (
              <Badge variant="destructive" className="mr-1">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            بانتظار الصرف
            {approvedRequests && approvedRequests.length > 0 && (
              <Badge className="mr-1 bg-purple-600 text-white">{approvedRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            المصروفة
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            السجل الكامل
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {renderList(pendingRequests, pendingLoading, {
            icon: Gift,
            title: "لا توجد طلبات بانتظار الموافقة",
            description: "جميع طلبات صرف البونص تمت معالجتها",
          })}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          {renderList(approvedRequests, approvedLoading, {
            icon: Banknote,
            title: "لا يوجد بونص بانتظار الصرف",
            description: "سيظهر هنا البونص بعد الموافقة عليه لتأكيد صرفه",
          })}
        </TabsContent>

        <TabsContent value="paid" className="mt-4">
          {renderList(paidRequests, paidLoading, {
            icon: Gift,
            title: "لا يوجد بونص مصروف",
            description: "لم يتم تسجيل صرف أي بونص بعد",
          })}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {renderList(allRequests, allLoading, {
            icon: History,
            title: "لا يوجد سجل",
            description: "لم يتم احتساب أي بونص بعد",
          })}
        </TabsContent>
      </Tabs>

      {/* نافذة تأكيد الموافقة */}
      <Dialog open={approveTarget !== null} onOpenChange={open => !open && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              تأكيد الموافقة
            </DialogTitle>
            <DialogDescription>
              {approveTarget &&
                `الموافقة على بونص ${approveTarget.branchName} لفترة ${approveTarget.periodLabel} بمبلغ ${formatSar(approveTarget.totalAmount)} (${approveTarget.eligibleCount} موظف مؤهل)`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              إلغاء
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => approveTarget && approveMutation.mutate({ weeklyBonusId: approveTarget.id })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "جاري الموافقة..." : "تأكيد الموافقة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة الرفض (السبب مطلوب) */}
      <Dialog open={rejectTarget !== null} onOpenChange={open => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              رفض طلب البونص
            </DialogTitle>
            <DialogDescription>
              {rejectTarget && `${rejectTarget.branchName} - ${rejectTarget.periodLabel}. `}
              سيظهر سبب الرفض لمقدم الطلب ويمكنه إعادة الطلب بعد التصحيح.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">
              سبب الرفض <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="اكتب سبب الرفض..."
              rows={3}
              maxLength={1000}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending || !rejectionReason.trim()}>
              {rejectMutation.isPending ? "جاري الرفض..." : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تأكيد الصرف */}
      <Dialog open={payTarget !== null} onOpenChange={open => !open && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-purple-600" />
              تأكيد صرف البونص
            </DialogTitle>
            <DialogDescription>
              {payTarget && `${payTarget.branchName} - ${payTarget.periodLabel}: ${formatSar(getDisplayAmount(payTarget))}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={value => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BONUS_PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(method => (
                    <SelectItem key={method} value={method}>
                      {BONUS_PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-reference">
                مرجع الدفع {referenceRequired ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(اختياري)</span>}
              </Label>
              <Input
                id="payment-reference"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                placeholder={paymentMethod === "check" ? "رقم الشيك" : paymentMethod === "bank_transfer" ? "رقم الحوالة" : "رقم السند"}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">ملاحظات (اختياري)</Label>
              <Textarea id="payment-notes" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2} maxLength={2000} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              إلغاء
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleMarkPaid}
              disabled={markPaidMutation.isPending || !canConfirmPayment}
            >
              {markPaidMutation.isPending ? "جاري التسجيل..." : "تأكيد الصرف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
