import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Gift, 
  CheckCircle, 
  XCircle,
  Send,
  Users,
  Building2,
  Calendar,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  DollarSign,
  BarChart3,
  CalendarDays,
  FileDown,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function BonusRequests() {
  const { user } = useAuth();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedBonusId, setSelectedBonusId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState("pending");

  // جلب طلبات البونص المعلقة
  const { data: pendingRequests, isLoading: pendingLoading, refetch: refetchPending } = trpc.bonuses.pending.useQuery();

  // جلب جميع طلبات البونص (السجل الكامل)
  const { data: allRequests, isLoading: allLoading, refetch: refetchAll } = trpc.bonuses.all.useQuery({ limit: 50 });

  // جلب إحصائيات البونص
  const { data: bonusStats, isLoading: statsLoading } = trpc.bonuses.stats.useQuery();

  // الموافقة على البونص
  const approveMutation = trpc.bonuses.approve.useMutation({
    onSuccess: () => {
      toast.success("تمت الموافقة على البونص بنجاح");
      setShowApproveDialog(false);
      refetchPending();
      refetchAll();
    },
    onError: (error) => {
      toast.error(error.message || "فشلت الموافقة");
    },
  });

  // رفض البونص
  const rejectMutation = trpc.bonuses.reject.useMutation({
    onSuccess: () => {
      toast.success("تم رفض البونص");
      setShowRejectDialog(false);
      setRejectionReason("");
      refetchPending();
      refetchAll();
    },
    onError: (error) => {
      toast.error(error.message || "فشل الرفض");
    },
  });

  // طلب صرف البونص (من المسودة)
  const requestPaymentMutation = trpc.bonuses.request.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال طلب الصرف بنجاح - تم إشعار المشرفين");
      refetchPending();
      refetchAll();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال طلب الصرف");
    },
  });

  // تصدير PDF للبونص
  const exportPDFMutation = trpc.bonuses.exportPDF.useMutation({
    onSuccess: (data) => {
      // تحويل base64 إلى blob وتنزيل الملف
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // إنشاء رابط التنزيل
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("تم تصدير التقرير بنجاح");
    },
    onError: (error) => {
      toast.error(error.message || "فشل تصدير التقرير");
    },
  });

  const handleApprove = () => {
    if (selectedBonusId) {
      approveMutation.mutate({ weeklyBonusId: selectedBonusId });
    }
  };

  const handleReject = () => {
    if (selectedBonusId && rejectionReason.trim()) {
      rejectMutation.mutate({ weeklyBonusId: selectedBonusId, reason: rejectionReason });
    }
  };

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRequests(newExpanded);
  };

  const getTierBadge = (tier: string) => {
    const tierColors: Record<string, string> = {
      tier_7: "bg-gradient-to-r from-purple-600 to-pink-500 text-white",
      tier_6: "bg-purple-500 text-white",
      tier_5: "bg-blue-600 text-white",
      tier_4: "bg-blue-500 text-white",
      tier_3: "bg-green-500 text-white",
      tier_2: "bg-yellow-500 text-black",
      tier_1: "bg-orange-500 text-white",
      none: "bg-gray-400 text-white",
    };
    const tierNames: Record<string, string> = {
      tier_7: "المستوى 7",
      tier_6: "المستوى 6",
      tier_5: "المستوى 5",
      tier_4: "المستوى 4",
      tier_3: "المستوى 3",
      tier_2: "المستوى 2",
      tier_1: "المستوى 1",
      none: "غير مؤهل",
    };
    return (
      <Badge className={tierColors[tier] || "bg-gray-400"}>
        {tierNames[tier] || tier}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      pending: { color: "bg-gray-500", label: "مسودة", icon: <Clock className="h-3 w-3" /> },
      requested: { color: "bg-blue-500", label: "قيد المراجعة", icon: <Send className="h-3 w-3" /> },
      approved: { color: "bg-green-500", label: "موافق عليه", icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { color: "bg-red-500", label: "مرفوض", icon: <XCircle className="h-3 w-3" /> },
      paid: { color: "bg-purple-500", label: "مصروف", icon: <Gift className="h-3 w-3" /> },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // التحقق من صلاحية المسؤول
  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-12 text-center">
            <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-medium mb-2">غير مصرح</h3>
            <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤول فقط</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const renderBonusCard = (request: any, showActions: boolean = false) => (
    <Card key={request.id} className={`border-l-4 ${
      request.status === 'requested' ? 'border-l-blue-500' :
      request.status === 'approved' ? 'border-l-green-500' :
      request.status === 'rejected' ? 'border-l-red-500' :
      request.status === 'paid' ? 'border-l-purple-500' : 'border-l-gray-500'
    }`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                {request.branchName}
              </CardTitle>
              {getStatusBadge(request.status)}
            </div>
            <CardDescription className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                الأسبوع {request.weekNumber} - {request.month}/{request.year}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {request.eligibleCount}/{request.totalEmployees} مؤهل
              </span>
            </CardDescription>
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold text-primary">
              {Number(request.totalAmount).toFixed(2)} ر.س
            </div>
            <div className="text-sm text-muted-foreground">
              {request.requestedAt && format(new Date(request.requestedAt), "d/M/yyyy HH:mm", { locale: ar })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* زر توسيع/طي التفاصيل */}
        <Button
          variant="ghost"
          className="w-full mb-2 flex items-center justify-center gap-2"
          onClick={() => toggleExpanded(request.id)}
        >
          {expandedRequests.has(request.id) ? (
            <>
              <ChevronUp className="h-4 w-4" />
              إخفاء التفاصيل
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              عرض التفاصيل ({request.details.length} موظف)
            </>
          )}
        </Button>

        {/* جدول تفاصيل الموظفين */}
        {expandedRequests.has(request.id) && (
          <div className="border rounded-lg overflow-hidden mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">الإيراد الأسبوعي</TableHead>
                  <TableHead className="text-right">المستوى</TableHead>
                  <TableHead className="text-right">البونص</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.details.map((detail: any) => (
                  <TableRow key={detail.id}>
                    <TableCell className="font-medium">{detail.employeeName}</TableCell>
                    <TableCell>{detail.employeeCode}</TableCell>
                    <TableCell>{Number(detail.weeklyRevenue).toFixed(2)} ر.س</TableCell>
                    <TableCell>{getTierBadge(detail.bonusTier)}</TableCell>
                    <TableCell className="font-bold text-green-600">
                      {Number(detail.bonusAmount).toFixed(2)} ر.س
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* زر تصدير PDF */}
        <div className="flex justify-between items-center mt-4">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => exportPDFMutation.mutate({ weeklyBonusId: request.id })}
            disabled={exportPDFMutation.isPending}
          >
            {exportPDFMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التصدير...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                تصدير PDF
              </>
            )}
          </Button>

          {/* أزرار الإجراءات */}
          {showActions && request.status === 'requested' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => {
                  setSelectedBonusId(request.id);
                  setShowRejectDialog(true);
                }}
              >
                <XCircle className="h-4 w-4 ml-2" />
                رفض
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setSelectedBonusId(request.id);
                  setShowApproveDialog(true);
                }}
              >
                <CheckCircle className="h-4 w-4 ml-2" />
                موافقة
              </Button>
            </div>
          )}
        </div>

        {/* زر طلب الصرف للمسودات */}
        {request.status === 'pending' && Number(request.totalAmount) > 0 && (
          <div className="flex justify-end mt-4">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => requestPaymentMutation.mutate({ weeklyBonusId: request.id })}
              disabled={requestPaymentMutation.isPending}
            >
              {requestPaymentMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 ml-2 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 ml-2" />
                  طلب صرف البونص
                </>
              )}
            </Button>
          </div>
        )}

        {/* عرض سبب الرفض إذا كان مرفوضاً */}
        {request.status === 'rejected' && request.rejectionReason && (
          <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">
              <strong>سبب الرفض:</strong> {request.rejectionReason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" />
            طلبات صرف البونص
          </h1>
          <p className="text-muted-foreground">مراجعة والموافقة على طلبات صرف البونص الأسبوعي</p>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* إجمالي الشهر الحالي */}
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-green-400">
                <CalendarDays className="h-4 w-4" />
                الشهر الحالي
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-400">
                    {(bonusStats?.totalPaidThisMonth || 0).toFixed(2)} ر.س
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bonusStats?.totalBeneficiariesThisMonth || 0} مستفيد
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* إجمالي السنة */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-blue-400">
                <TrendingUp className="h-4 w-4" />
                السنة الحالية
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-blue-400">
                    {(bonusStats?.totalPaidThisYear || 0).toFixed(2)} ر.س
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bonusStats?.totalBeneficiariesThisYear || 0} مستفيد
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* طلبات معلقة */}
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-orange-400">
                <Clock className="h-4 w-4" />
                طلبات معلقة
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-orange-400">
                    {bonusStats?.pendingRequestsCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    بانتظار المراجعة
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* موافق عليها (لم تصرف بعد) */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-purple-400">
                <CheckCircle className="h-4 w-4" />
                موافق عليها
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-purple-400">
                    {bonusStats?.approvedNotPaidCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    بانتظار الصرف
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* التبويبات */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              الطلبات المعلقة
              {pendingRequests && pendingRequests.length > 0 && (
                <Badge variant="destructive" className="mr-1">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              السجل الكامل
            </TabsTrigger>
          </TabsList>

          {/* الطلبات المعلقة */}
          <TabsContent value="pending" className="mt-4">
            {pendingLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : pendingRequests && pendingRequests.length > 0 ? (
              <div className="space-y-4">
                {pendingRequests.map((request) => renderBonusCard(request, true))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">لا توجد طلبات معلقة</h3>
                  <p className="text-muted-foreground">
                    جميع طلبات البونص تمت معالجتها
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* السجل الكامل */}
          <TabsContent value="history" className="mt-4">
            {allLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : allRequests && allRequests.length > 0 ? (
              <div className="space-y-4">
                {allRequests.map((request) => renderBonusCard(request, request.status === 'requested'))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">لا يوجد سجل</h3>
                  <p className="text-muted-foreground">
                    لم يتم طلب أي بونص بعد
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* نافذة تأكيد الموافقة */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                تأكيد الموافقة
              </DialogTitle>
              <DialogDescription>
                هل أنت متأكد من الموافقة على صرف هذا البونص؟
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                إلغاء
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove} 
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? "جاري الموافقة..." : "تأكيد الموافقة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نافذة الرفض */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                رفض طلب البونص
              </DialogTitle>
              <DialogDescription>
                يرجى تحديد سبب الرفض
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">سبب الرفض</Label>
                <Textarea
                  id="reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="اكتب سبب الرفض..."
                  className="mt-2"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                إلغاء
              </Button>
              <Button 
                variant="destructive"
                onClick={handleReject} 
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
              >
                {rejectMutation.isPending ? "جاري الرفض..." : "تأكيد الرفض"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
