import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  Bell, 
  BellOff, 
  Calendar, 
  Building2, 
  DollarSign, 
  CheckCircle, 
  XCircle,
  Mail,
  RefreshCw,
  Filter,
  Search,
  Settings,
  TrendingDown,
  Eye,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function DiscrepancyAlerts() {
  const { toast } = useToast();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("week");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Queries
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: sentLogs, refetch, isLoading } = trpc.emailRecipients.getSentLogs.useQuery({ 
    limit: 100 
  });
  
  // تصفية الإشعارات للفروقات فقط
  const discrepancyAlerts = sentLogs?.filter(
    (log: any) => log.notificationType === 'revenue_mismatch'
  ) || [];
  
  // تصفية حسب الفرع
  const filteredAlerts = discrepancyAlerts.filter((alert: any) => {
    if (selectedBranch !== "all") {
      try {
        const metadata = JSON.parse(alert.bodyArabic || "{}");
        if (metadata.branchId && metadata.branchId.toString() !== selectedBranch) {
          return false;
        }
      } catch {
        return true;
      }
    }
    return true;
  });
  
  // إحصائيات
  const stats = {
    total: filteredAlerts.length,
    sent: filteredAlerts.filter((a: any) => a.status === 'sent').length,
    failed: filteredAlerts.filter((a: any) => a.status === 'failed').length,
    today: filteredAlerts.filter((a: any) => {
      const alertDate = new Date(a.createdAt);
      const today = new Date();
      return alertDate.toDateString() === today.toDateString();
    }).length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">تم الإرسال</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">فشل</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">قيد الانتظار</Badge>;
    }
  };

  const parseAlertDetails = (bodyArabic: string) => {
    try {
      return JSON.parse(bodyArabic);
    } catch {
      return null;
    }
  };

  return (
    <div className="container py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">تنبيهات الفروقات</h1>
            <p className="text-muted-foreground">مراقبة الفروقات بين المبالغ المدخلة والمستخرجة من صور الموازنة</p>
          </div>
        </div>
        <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي التنبيهات</p>
                <p className="text-3xl font-bold text-blue-400">{stats.total}</p>
              </div>
              <Bell className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تم الإرسال</p>
                <p className="text-3xl font-bold text-green-400">{stats.sent}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">فشل الإرسال</p>
                <p className="text-3xl font-bold text-red-400">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تنبيهات اليوم</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.today}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            تصفية التنبيهات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches?.map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الفترة الزمنية</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">آخر أسبوع</SelectItem>
                  <SelectItem value="month">آخر شهر</SelectItem>
                  <SelectItem value="all">الكل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="sent">تم الإرسال</SelectItem>
                  <SelectItem value="failed">فشل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            سجل التنبيهات المرسلة
          </CardTitle>
          <CardDescription>
            جميع تنبيهات الفروقات التي تم إرسالها للمسؤولين
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد تنبيهات فروقات حتى الآن</p>
              <p className="text-sm text-muted-foreground mt-2">
                سيتم إرسال تنبيهات تلقائية عند اكتشاف أي فرق في الموازنة
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ والوقت</TableHead>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-right">المبلغ المدخل</TableHead>
                  <TableHead className="text-right">المبلغ المستخرج</TableHead>
                  <TableHead className="text-right">الفرق</TableHead>
                  <TableHead className="text-right">المستلمين</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert: any) => {
                  const details = parseAlertDetails(alert.bodyArabic);
                  return (
                    <TableRow key={alert.id}>
                      <TableCell className="text-right">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(alert.createdAt), 'dd/MM/yyyy', { locale: ar })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(alert.createdAt), 'HH:mm', { locale: ar })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {details?.branchName || 'غير محدد'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {details?.enteredAmount?.toFixed(2) || '-'} ر.س
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {details?.extractedAmount?.toFixed(2) || '-'} ر.س
                      </TableCell>
                      <TableCell className="text-right">
                        {details?.difference ? (
                          <Badge className={`${details.difference > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            <TrendingDown className="h-3 w-3 ml-1" />
                            {details.difference.toFixed(2)} ر.س
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm text-muted-foreground">
                          {alert.recipientEmail?.split(',').length || 1} مستلم
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {getStatusBadge(alert.status)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settings Link */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">إعدادات التنبيهات</p>
                <p className="text-sm text-muted-foreground">
                  إدارة المستلمين وتخصيص حدود التنبيهات
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <a href="/admin/notification-recipients">
                إدارة المستلمين
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
