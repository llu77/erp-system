import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Trophy,
  Medal,
  Award,
  DollarSign,
  BarChart3,
  User,
  Briefcase,
} from "lucide-react";

const MONTHS = [
  { value: "01", label: "يناير" },
  { value: "02", label: "فبراير" },
  { value: "03", label: "مارس" },
  { value: "04", label: "أبريل" },
  { value: "05", label: "مايو" },
  { value: "06", label: "يونيو" },
  { value: "07", label: "يوليو" },
  { value: "08", label: "أغسطس" },
  { value: "09", label: "سبتمبر" },
  { value: "10", label: "أكتوبر" },
  { value: "11", label: "نوفمبر" },
  { value: "12", label: "ديسمبر" },
];

const YEARS = Array.from({ length: 5 }, (_, i) => {
  const year = new Date().getFullYear() - i;
  return { value: year.toString(), label: year.toString() };
});

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("ar-SA")} ر.س`;
}

function formatNumber(num: number): string {
  return num.toLocaleString("ar-SA");
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-muted-foreground font-medium">{rank}</span>;
}

function getRankBadgeColor(rank: number): string {
  if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
  if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
  if (rank === 3) return "bg-gradient-to-r from-amber-500 to-amber-700 text-white";
  return "bg-muted text-muted-foreground";
}

export default function EmployeePerformanceReport() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    String(currentDate.getMonth() + 1).padStart(2, "0")
  );
  const [selectedYear, setSelectedYear] = useState(
    currentDate.getFullYear().toString()
  );
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // حساب تواريخ الفترة
  const { startDate, endDate } = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [selectedMonth, selectedYear]);

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // جلب بيانات التقرير
  const branchId = selectedBranch !== "all" ? parseInt(selectedBranch) : undefined;

  const { data: topEmployees, isLoading: isLoadingEmployees } =
    trpc.pos.employeePerformance.topEmployees.useQuery({
      startDate,
      endDate,
      branchId,
      limit: 20,
    });

  const { data: summary, isLoading: isLoadingSummary } =
    trpc.pos.employeePerformance.summary.useQuery({
      startDate,
      endDate,
      branchId,
    });

  const { data: dailyData, isLoading: isLoadingDaily } =
    trpc.pos.employeePerformance.daily.useQuery({
      startDate,
      endDate,
      branchId,
    });

  // جلب تفاصيل خدمات الموظف المحدد
  const { data: employeeServices, isLoading: isLoadingServices } =
    trpc.pos.employeePerformance.employeeServices.useQuery(
      {
        employeeId: selectedEmployee!,
        startDate,
        endDate,
        branchId,
      },
      { enabled: !!selectedEmployee }
    );

  const selectedMonthName = MONTHS.find((m) => m.value === selectedMonth)?.label || "";
  const selectedBranchName =
    selectedBranch === "all"
      ? "جميع الفروع"
      : branches?.find((b: { id: number; nameAr: string }) => b.id === parseInt(selectedBranch))?.nameAr || "";

  // تصدير PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        month: selectedMonthName,
        year: selectedYear,
        branchName: selectedBranchName,
      });
      if (branchId) {
        params.append("branchId", branchId.toString());
      }

      const response = await fetch(`/api/reports/employee-performance?${params}`);
      if (!response.ok) throw new Error("فشل تصدير التقرير");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير-أداء-الموظفين-${selectedMonthName}-${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = isLoadingEmployees || isLoadingSummary || isLoadingDaily;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">تقرير أداء الموظفين</h1>
            <p className="text-muted-foreground">
              تحليل إنتاجية الموظفين والخدمات المقدمة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* فلتر الفرع */}
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="الفرع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches?.map((branch: { id: number; nameAr: string }) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* فلتر الشهر */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="الشهر" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* فلتر السنة */}
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="السنة" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* زر التصدير */}
            <Button
              onClick={handleExportPDF}
              disabled={isExporting || isLoading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "جاري التصدير..." : "تصدير PDF"}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.totalRevenue || 0)}
                  </div>
                  {summary?.revenueChange !== 0 && (
                    <div
                      className={`flex items-center gap-1 text-xs ${
                        (summary?.revenueChange || 0) > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {(summary?.revenueChange || 0) > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(summary?.revenueChange || 0)}% عن الفترة السابقة
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">عدد الفواتير</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatNumber(summary?.totalInvoices || 0)}
                  </div>
                  {summary?.invoicesChange !== 0 && (
                    <div
                      className={`flex items-center gap-1 text-xs ${
                        (summary?.invoicesChange || 0) > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {(summary?.invoicesChange || 0) > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(summary?.invoicesChange || 0)}%
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">عدد الموظفين</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatNumber(summary?.uniqueEmployees || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">موظف نشط</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">متوسط لكل موظف</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.averageRevenuePerEmployee || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">إيراد/موظف</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              ترتيب الموظفين حسب الإيرادات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingEmployees ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : topEmployees && topEmployees.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">الترتيب</TableHead>
                    <TableHead>الموظف</TableHead>
                    <TableHead className="text-center">الفواتير</TableHead>
                    <TableHead className="text-center">الخدمات</TableHead>
                    <TableHead className="text-center">متوسط الفاتورة</TableHead>
                    <TableHead className="text-left">الإيرادات</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEmployees.map((employee) => (
                    <TableRow
                      key={employee.employeeId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedEmployee(employee.employeeId)}
                    >
                      <TableCell>
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${getRankBadgeColor(
                            employee.rank
                          )}`}
                        >
                          {getRankIcon(employee.rank)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={employee.employeePhoto || undefined} />
                            <AvatarFallback>
                              <User className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{employee.employeeName}</div>
                            <div className="text-xs text-muted-foreground">
                              {employee.employeePosition}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {formatNumber(employee.invoiceCount)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {formatNumber(employee.serviceCount)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {formatCurrency(employee.averageInvoiceValue)}
                      </TableCell>
                      <TableCell className="text-left font-bold text-primary">
                        {formatCurrency(employee.totalRevenue)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(employee.employeeId);
                          }}
                        >
                          <Briefcase className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">لا توجد بيانات</h3>
                <p className="text-sm text-muted-foreground">
                  لا توجد فواتير في الفترة المحددة
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              الأداء اليومي
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDaily ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : dailyData && dailyData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead className="text-center">الإيرادات</TableHead>
                    <TableHead className="text-center">الفواتير</TableHead>
                    <TableHead className="text-center">الموظفين النشطين</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyData.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell>
                        {new Date(day.date).toLocaleDateString("ar-SA", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {formatCurrency(day.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatNumber(day.invoiceCount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatNumber(day.uniqueEmployees)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>الإجمالي</TableCell>
                    <TableCell className="text-center">
                      {formatCurrency(
                        dailyData.reduce((sum, d) => sum + d.totalRevenue, 0)
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatNumber(
                        dailyData.reduce((sum, d) => sum + d.invoiceCount, 0)
                      )}
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  لا توجد بيانات يومية
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Services Dialog */}
        <Dialog
          open={!!selectedEmployee}
          onOpenChange={() => setSelectedEmployee(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                تفاصيل خدمات الموظف
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {isLoadingServices ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : employeeServices && employeeServices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الخدمة</TableHead>
                      <TableHead className="text-center">العدد</TableHead>
                      <TableHead className="text-left">الإيرادات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeServices.map((service, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{service.serviceNameAr}</div>
                            <div className="text-xs text-muted-foreground">
                              {service.serviceName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {formatNumber(service.totalQuantity)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left font-medium">
                          {formatCurrency(service.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>الإجمالي</TableCell>
                      <TableCell className="text-center">
                        {formatNumber(
                          employeeServices.reduce(
                            (sum, s) => sum + s.totalQuantity,
                            0
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        {formatCurrency(
                          employeeServices.reduce(
                            (sum, s) => sum + s.totalRevenue,
                            0
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    لا توجد خدمات مسجلة لهذا الموظف
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
