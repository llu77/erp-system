import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  PieChart,
  Receipt,
  Filter,
} from "lucide-react";

export default function PaidInvoicesReport() {
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("current");

  // حساب نطاق التاريخ
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "current":
        return {
          startDate: format(startOfMonth(now), "yyyy-MM-dd"),
          endDate: format(endOfMonth(now), "yyyy-MM-dd"),
        };
      case "last":
        const lastMonth = subMonths(now, 1);
        return {
          startDate: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
          endDate: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
        };
      case "last3":
        return {
          startDate: format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"),
          endDate: format(endOfMonth(now), "yyyy-MM-dd"),
        };
      case "last6":
        return {
          startDate: format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"),
          endDate: format(endOfMonth(now), "yyyy-MM-dd"),
        };
      default:
        return {
          startDate: format(startOfMonth(now), "yyyy-MM-dd"),
          endDate: format(endOfMonth(now), "yyyy-MM-dd"),
        };
    }
  }, [dateRange]);

  // جلب الفروع
  const { data: branches = [] } = trpc.branches.list.useQuery();

  // جلب تقرير فواتير المدفوع
  const { data: report, isLoading } = trpc.revenues.getPaidInvoicesReport.useQuery({
    branchId: selectedBranch !== "all" ? parseInt(selectedBranch) : undefined,
    startDate,
    endDate,
  });

  // تصدير PDF
  const handleExportPDF = async () => {
    // TODO: تنفيذ تصدير PDF
    alert("سيتم تنفيذ تصدير PDF قريباً");
  };

  // تحديد الفروع المتاحة للمستخدم
  const availableBranches = useMemo(() => {
    if (user?.role === "supervisor" && user?.branchId) {
      return branches.filter((b) => b.id === user.branchId);
    }
    return branches;
  }, [branches, user]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* العنوان والفلاتر */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Receipt className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">تقرير فواتير المدفوع</h1>
            <p className="text-sm text-muted-foreground">
              عرض وتحليل جميع فواتير المدفوع مع تصنيفها حسب الأسباب
            </p>
          </div>
        </div>

        <Button onClick={handleExportPDF} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          تصدير PDF
        </Button>
      </div>

      {/* الفلاتر */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">الفلاتر:</span>
            </div>

            <div className="flex flex-1 flex-wrap gap-3">
              {/* فلتر الفرع */}
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {user?.role !== "supervisor" && (
                      <SelectItem value="all">جميع الفروع</SelectItem>
                    )}
                    {availableBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.nameAr || branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* فلتر الفترة */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="اختر الفترة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">الشهر الحالي</SelectItem>
                    <SelectItem value="last">الشهر الماضي</SelectItem>
                    <SelectItem value="last3">آخر 3 أشهر</SelectItem>
                    <SelectItem value="last6">آخر 6 أشهر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الإحصائيات */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* إجمالي فواتير المدفوع */}
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المبلغ</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {(report?.summary.totalAmount || 0).toLocaleString()} ر.س
                  </p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-full">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* عدد الفواتير */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">عدد الفواتير</p>
                  <p className="text-2xl font-bold">
                    {report?.summary.totalCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <FileText className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* عدد الأسباب */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">عدد الأسباب</p>
                  <p className="text-2xl font-bold">
                    {report?.summary.byReason?.length || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <PieChart className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* عدد الفروع */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">عدد الفروع</p>
                  <p className="text-2xl font-bold">
                    {report?.summary.byBranch?.length || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-full">
                  <Building2 className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* التصنيف حسب الأسباب */}
      {report?.summary.byReason && report.summary.byReason.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-500" />
              تصنيف حسب الأسباب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {report.summary.byReason.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.reason}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.count} فاتورة
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-orange-600 bg-orange-500/10">
                    {item.total.toLocaleString()} ر.س
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* التصنيف حسب الفروع */}
      {report?.summary.byBranch && report.summary.byBranch.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-500" />
              تصنيف حسب الفروع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {report.summary.byBranch.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div>
                    <p className="font-medium">{item.branch}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.count} فاتورة
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-green-600 bg-green-500/10">
                    {item.total.toLocaleString()} ر.س
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* جدول التفاصيل */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            تفاصيل فواتير المدفوع
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : report?.items && report.items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">اليوم</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right">إجمالي اليوم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {format(new Date(item.date), "d/M/yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(item.date), "EEEE", { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.branchName}</Badge>
                      </TableCell>
                      <TableCell className="text-orange-500 font-bold">
                        {parseFloat(item.paidInvoices).toLocaleString()} ر.س
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {item.paidInvoicesNote || (
                            <span className="text-muted-foreground">بدون سبب</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {parseFloat(item.total).toLocaleString()} ر.س
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                لا توجد فواتير مدفوع في الفترة المحددة
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
