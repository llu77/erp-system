import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Gift, 
  Calendar, 
  Users, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  XCircle,
  RefreshCw,
  Send,
  TrendingUp,
  Download,
  Loader2,
  AlertTriangle,
  History,
  Mail,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  PDF_BASE_STYLES, 
  getPDFHeader, 
  getPDFFooter, 
  getPDFInfoSection, 
  getPDFSummarySection, 
  getPDFTable,
  openPrintWindow,
  formatCurrency 
} from "@/utils/pdfTemplates";

export default function Bonuses() {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [selectedBonusId, setSelectedBonusId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);

  // جلب الفروع
  const { data: branches, isLoading: branchesLoading } = trpc.branches.list.useQuery();

  // الفرع الفعال
  const effectiveBranchId = selectedBranchId || (branches && branches.length > 0 ? branches[0].id : null);

  // جلب البونص الحالي
  const { data: currentBonus, isLoading: bonusLoading, refetch: refetchBonus } = trpc.bonuses.current.useQuery(
    { branchId: effectiveBranchId! },
    { enabled: !!effectiveBranchId }
  );

  // جلب سجل البونص
  const { data: bonusHistory, isLoading: historyLoading } = trpc.bonuses.history.useQuery(
    { branchId: effectiveBranchId!, limit: 10 },
    { enabled: !!effectiveBranchId }
  );

  // جلب سجل التدقيق
  const { data: auditLogs, isLoading: auditLoading, refetch: refetchAudit } = trpc.bonuses.auditLogs.useQuery(
    { branchId: effectiveBranchId!, limit: 20 },
    { enabled: !!effectiveBranchId && showAuditLog }
  );

  // جلب الفروقات
  const now = new Date();
  const day = now.getDate();
  let currentWeekNumber: 1 | 2 | 3 | 4 | 5 = 1;
  if (day <= 7) currentWeekNumber = 1;
  else if (day <= 15) currentWeekNumber = 2;
  else if (day <= 22) currentWeekNumber = 3;
  else if (day <= 29) currentWeekNumber = 4;
  else currentWeekNumber = 5;

  const { data: discrepancies, isLoading: discrepanciesLoading, refetch: refetchDiscrepancies } = trpc.bonuses.detectDiscrepancies.useQuery(
    { 
      branchId: effectiveBranchId!, 
      weekNumber: currentWeekNumber,
      month: now.getMonth() + 1,
      year: now.getFullYear()
    },
    { enabled: !!effectiveBranchId && showDiscrepancies }
  );

  // إرسال تنبيه الفروقات
  const sendAlertMutation = trpc.bonuses.sendDiscrepancyAlert.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        refetchAudit();
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال التنبيه");
    },
  });

  // طلب صرف البونص
  const requestMutation = trpc.bonuses.request.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال طلب الصرف بنجاح");
      setShowRequestDialog(false);
      refetchBonus();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال الطلب");
    },
  });

  // تزامن البونص
  const syncMutation = trpc.bonuses.sync.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        refetchBonus();
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || "فشل التزامن");
    },
  });

  const handleRequestBonus = () => {
    if (selectedBonusId) {
      requestMutation.mutate({ weeklyBonusId: selectedBonusId });
    }
  };

  const handleSync = () => {
    if (!effectiveBranchId) return;
    const now = new Date();
    const day = now.getDate();
    let weekNumber: 1 | 2 | 3 | 4 | 5;
    if (day <= 7) weekNumber = 1;
    else if (day <= 15) weekNumber = 2;
    else if (day <= 22) weekNumber = 3;
    else if (day <= 29) weekNumber = 4;
    else weekNumber = 5;

    syncMutation.mutate({
      branchId: effectiveBranchId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      weekNumber,
    });
  };

  // دالة تصدير PDF للبونص
  const handleExportPDF = async () => {
    if (!currentBonus || !currentBonus.details) return;
    
    setIsExporting(true);
    try {
      const tierNames: Record<string, string> = {
        tier_5: "المستوى 5 (180 ر.س)",
        tier_4: "المستوى 4 (135 ر.س)",
        tier_3: "المستوى 3 (95 ر.س)",
        tier_2: "المستوى 2 (60 ر.س)",
        tier_1: "المستوى 1 (35 ر.س)",
        none: "غير مؤهل",
      };
      
      const tierColors: Record<string, string> = {
        tier_5: "#a855f7",
        tier_4: "#3b82f6",
        tier_3: "#22c55e",
        tier_2: "#eab308",
        tier_1: "#f97316",
        none: "#9ca3af",
      };

      const branchName = currentBonus.branchName || "غير محدد";
      const weekStart = new Date(currentBonus.weekStart);
      const weekEnd = new Date(currentBonus.weekEnd);
      
      const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير البونص الأسبوعي - ${branchName}</title>
  <style>
    ${PDF_BASE_STYLES}
    .tier-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: white; }
    .bonus-amount { font-weight: 800; color: #000; font-size: 15px; }
    .levels-info { margin-top: 25px; background: #f5f5f5; border-radius: 12px; padding: 20px; border: 2px solid #000; }
    .levels-info h3 { color: #000; margin-bottom: 15px; font-size: 14px; font-weight: 700; }
    .levels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .level-item { display: flex; align-items: center; gap: 8px; font-size: 11px; }
    .level-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  </style>
</head>
<body>
  ${getPDFHeader('تقرير البونص الأسبوعي', { reportNumber: `الأسبوع ${currentBonus.weekNumber}` })}
  
  ${getPDFInfoSection([
    { label: 'الفرع', value: branchName },
    { label: 'رقم الأسبوع', value: currentBonus.weekNumber },
    { label: 'من تاريخ', value: weekStart.toLocaleDateString('ar-SA') },
    { label: 'إلى تاريخ', value: weekEnd.toLocaleDateString('ar-SA') },
  ])}
  
  ${getPDFSummarySection([
    { label: 'إجمالي البونص', value: formatCurrency(currentBonus.totalAmount) },
    { label: 'موظفين مؤهلين', value: currentBonus.eligibleCount },
    { label: 'إجمالي الموظفين', value: currentBonus.totalEmployees },
    { label: 'نسبة الأهلية', value: `${currentBonus.totalEmployees > 0 ? ((currentBonus.eligibleCount / currentBonus.totalEmployees) * 100).toFixed(0) : 0}%` },
  ])}

  <table class="pdf-table">
    <thead>
      <tr>
        <th>#</th>
        <th>اسم الموظف</th>
        <th>الكود</th>
        <th>الإيراد الأسبوعي</th>
        <th>المستوى</th>
        <th>البونص</th>
      </tr>
    </thead>
    <tbody>
      ${currentBonus.details.map((detail, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="text-right">${detail.employeeName || 'غير محدد'}</td>
          <td>${detail.employeeCode || '-'}</td>
          <td>${formatCurrency(detail.weeklyRevenue)}</td>
          <td><span class="tier-badge" style="background-color: ${detail.bonusTier ? tierColors[detail.bonusTier] || '#9ca3af' : '#9ca3af'}">${detail.bonusTier ? tierNames[detail.bonusTier] || detail.bonusTier : '-'}</span></td>
          <td class="bonus-amount font-bold">${formatCurrency(detail.bonusAmount)}</td>
        </tr>
      `).join('')}
      <tr style="background: #1a1a1a; color: white; font-weight: 800;">
        <td colspan="5" style="border: none; text-align: right;">الإجمالي</td>
        <td style="border: none;">${formatCurrency(currentBonus.totalAmount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="levels-info">
    <h3>📊 مستويات البونص</h3>
    <div class="levels-grid">
      <div class="level-item"><span class="level-dot" style="background: #a855f7"></span> المستوى 5: ≥2400 ر.س → 180 ر.س</div>
      <div class="level-item"><span class="level-dot" style="background: #3b82f6"></span> المستوى 4: 2100-2399 ر.س → 135 ر.س</div>
      <div class="level-item"><span class="level-dot" style="background: #22c55e"></span> المستوى 3: 1800-2099 ر.س → 95 ر.س</div>
      <div class="level-item"><span class="level-dot" style="background: #eab308"></span> المستوى 2: 1500-1799 ر.س → 60 ر.س</div>
      <div class="level-item"><span class="level-dot" style="background: #f97316"></span> المستوى 1: 1200-1499 ر.س → 35 ر.س</div>
      <div class="level-item"><span class="level-dot" style="background: #9ca3af"></span> غير مؤهل: أقل من 1200 ر.س</div>
    </div>
  </div>

  ${getPDFFooter()}
</body>
</html>
      `;

      openPrintWindow(htmlContent);
      toast.success("تم فتح تقرير البونص للطباعة أو الحفظ كـ PDF");
    } catch (error) {
      console.error('Export error:', error);
      toast.error("فشل تصدير التقرير");
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> قيد الانتظار</Badge>;
      case "requested":
        return <Badge variant="default" className="gap-1 bg-blue-500"><Send className="h-3 w-3" /> تم الطلب</Badge>;
      case "approved":
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> موافق عليه</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> مرفوض</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    const tierColors: Record<string, string> = {
      tier_5: "bg-purple-500 text-white",
      tier_4: "bg-blue-500 text-white",
      tier_3: "bg-green-500 text-white",
      tier_2: "bg-yellow-500 text-black",
      tier_1: "bg-orange-500 text-white",
      none: "bg-gray-400 text-white",
    };
    const tierNames: Record<string, string> = {
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

  if (branchesLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان واختيار الفرع */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6 text-primary" />
              البونص الأسبوعي
            </h1>
            <p className="text-muted-foreground">إدارة ومتابعة البونص الأسبوعي للموظفين</p>
          </div>
          
          <div className="flex items-center gap-2">
            {user?.role === "admin" && branches && branches.length > 0 && (
              <Select
                value={effectiveBranchId?.toString() || ""}
                onValueChange={(v) => setSelectedBranchId(Number(v))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Button variant="outline" onClick={handleSync} disabled={syncMutation.isPending}>
              <RefreshCw className={`h-4 w-4 ml-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              تزامن
            </Button>
            
            {currentBonus && currentBonus.details && currentBonus.details.length > 0 && (
              <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 ml-2" />
                )}
                تصدير PDF
              </Button>
            )}
          </div>
        </div>

        {/* بطاقة البونص الحالي */}
        {bonusLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : currentBonus ? (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    الأسبوع {currentBonus.weekNumber} - {currentBonus.month}/{currentBonus.year}
                  </CardTitle>
                  <CardDescription>
                    {format(new Date(currentBonus.weekStart), "d MMMM", { locale: ar })} - {format(new Date(currentBonus.weekEnd), "d MMMM yyyy", { locale: ar })}
                  </CardDescription>
                </div>
                {getStatusBadge(currentBonus.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-primary/10 rounded-lg p-4 text-center">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold text-primary">{Number(currentBonus.totalAmount).toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">إجمالي البونص</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold text-green-500">{currentBonus.eligibleCount}</div>
                  <div className="text-sm text-muted-foreground">مؤهلين</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-4 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold text-blue-500">{currentBonus.totalEmployees}</div>
                  <div className="text-sm text-muted-foreground">إجمالي الموظفين</div>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-4 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold text-purple-500">
                    {currentBonus.totalEmployees > 0 
                      ? ((currentBonus.eligibleCount / currentBonus.totalEmployees) * 100).toFixed(0) 
                      : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">نسبة الأهلية</div>
                </div>
              </div>

              {/* جدول تفاصيل الموظفين */}
              {currentBonus.details && currentBonus.details.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
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
                      {currentBonus.details.map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell className="font-medium">{detail.employeeName}</TableCell>
                          <TableCell>{detail.employeeCode}</TableCell>
                          <TableCell>{Number(detail.weeklyRevenue).toFixed(2)} ر.س</TableCell>
                          <TableCell>{detail.bonusTier ? getTierBadge(detail.bonusTier) : <Badge variant="outline" className="bg-gray-100">-</Badge>}</TableCell>
                          <TableCell className="font-bold text-green-600">
                            {Number(detail.bonusAmount).toFixed(2)} ر.س
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* زر طلب الصرف */}
              {currentBonus.status === "pending" && (
                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={() => {
                      setSelectedBonusId(currentBonus.id);
                      setShowRequestDialog(true);
                    }}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    طلب صرف البونص
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">لا يوجد بونص للأسبوع الحالي</h3>
              <p className="text-muted-foreground mb-4">
                قم بإدخال إيرادات الموظفين لحساب البونص تلقائياً
              </p>
              <Button variant="outline" onClick={handleSync}>
                <RefreshCw className="h-4 w-4 ml-2" />
                تزامن البونص
              </Button>
            </CardContent>
          </Card>
        )}

        {/* أزرار التدقيق والفروقات */}
        {user?.role === 'admin' && (
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={showDiscrepancies ? "default" : "outline"}
              onClick={() => {
                setShowDiscrepancies(!showDiscrepancies);
                if (!showDiscrepancies) refetchDiscrepancies();
              }}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              فحص الفروقات
            </Button>
            <Button 
              variant={showAuditLog ? "default" : "outline"}
              onClick={() => {
                setShowAuditLog(!showAuditLog);
                if (!showAuditLog) refetchAudit();
              }}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              سجل التدقيق
            </Button>
          </div>
        )}

        {/* بطاقة الفروقات */}
        {showDiscrepancies && (
          <Card className="border-amber-500/50">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    فحص الفروقات - الأسبوع {currentWeekNumber}
                  </CardTitle>
                  <CardDescription>
                    مقارنة الإيرادات المسجلة مع البونص المحسوب
                  </CardDescription>
                </div>
                {discrepancies?.hasDiscrepancy && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => sendAlertMutation.mutate({
                      branchId: effectiveBranchId!,
                      weekNumber: currentWeekNumber,
                      month: now.getMonth() + 1,
                      year: now.getFullYear()
                    })}
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
              {discrepanciesLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : discrepancies?.hasDiscrepancy ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 font-medium">
                      ⚠️ تم اكتشاف {discrepancies.discrepancies.length} فروقات في البونص
                    </p>
                  </div>
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
                      {discrepancies.discrepancies.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{d.employeeName}</TableCell>
                          <TableCell>{d.registeredRevenue.toFixed(2)} ر.س</TableCell>
                          <TableCell>{d.actualRevenue.toFixed(2)} ر.س</TableCell>
                          <TableCell className={d.revenueDiff > 0 ? "text-green-600" : "text-red-600"}>
                            {d.revenueDiff > 0 ? "+" : ""}{d.revenueDiff.toFixed(2)} ر.س
                          </TableCell>
                          <TableCell>{d.registeredBonus.toFixed(2)} ر.س</TableCell>
                          <TableCell className="font-bold">{d.expectedBonus.toFixed(2)} ر.س</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="text-green-600 font-medium">✅ لا توجد فروقات - البيانات متطابقة</p>
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
              <CardDescription>تتبع جميع التغييرات على البونص</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : auditLogs && auditLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الإجراء</TableHead>
                      <TableHead className="text-right">الفرع</TableHead>
                      <TableHead className="text-right">الأسبوع</TableHead>
                      <TableHead className="text-right">بواسطة</TableHead>
                      <TableHead className="text-right">التفاصيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.performedAt), "d/M/yyyy HH:mm", { locale: ar })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.action.includes('alert') ? 'destructive' : log.action.includes('approve') ? 'default' : 'secondary'}>
                            {log.action === 'sync' ? 'تزامن' :
                             log.action === 'request' ? 'طلب صرف' :
                             log.action === 'approve' ? 'موافقة' :
                             log.action === 'reject' ? 'رفض' :
                             log.action === 'discrepancy_alert_sent' ? 'تنبيه فروقات' :
                             log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.branchName || '-'}</TableCell>
                        <TableCell>الأسبوع {log.weekNumber} - {log.month}/{log.year}</TableCell>
                        <TableCell>{log.userName || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {log.details || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا يوجد سجل تدقيق
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* سجل البونص */}
        <Card>
          <CardHeader>
            <CardTitle>سجل البونص</CardTitle>
            <CardDescription>آخر 10 أسابيع</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : bonusHistory && bonusHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الفترة</TableHead>
                    <TableHead className="text-right">الأسبوع</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الموافقة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonusHistory.map((bonus) => (
                    <TableRow key={bonus.id}>
                      <TableCell>{bonus.month}/{bonus.year}</TableCell>
                      <TableCell>الأسبوع {bonus.weekNumber}</TableCell>
                      <TableCell className="font-bold">{Number(bonus.totalAmount).toFixed(2)} ر.س</TableCell>
                      <TableCell>{getStatusBadge(bonus.status)}</TableCell>
                      <TableCell>
                        {bonus.approvedAt 
                          ? format(new Date(bonus.approvedAt), "d/M/yyyy", { locale: ar })
                          : "-"
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لا يوجد سجل بونص سابق
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة تأكيد طلب الصرف */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تأكيد طلب صرف البونص</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من إرسال طلب صرف البونص للمسؤول؟
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleRequestBonus} disabled={requestMutation.isPending}>
                {requestMutation.isPending ? "جاري الإرسال..." : "تأكيد الطلب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
