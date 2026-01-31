import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { format, parseISO, isWithinInterval, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Download, FileText, Loader2, CalendarDays, TrendingUp, Receipt, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/DateRangePicker';

// دالة مساعدة لتحويل التاريخ بشكل آمن
function safeParseDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  
  try {
    if (dateValue instanceof Date) {
      return isValid(dateValue) ? dateValue : null;
    }
    
    const dateStr = dateValue.toString();
    
    if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parsed = parseISO(dateStr);
      return isValid(parsed) ? parsed : null;
    }
    
    const parsed = new Date(dateStr);
    return isValid(parsed) ? parsed : null;
  } catch (e) {
    console.warn('خطأ في تحليل التاريخ:', dateValue);
    return null;
  }
}

// دالة مساعدة لتنسيق التاريخ بشكل آمن
function safeFormatDate(dateValue: any, formatStr: string = 'yyyy-MM-dd'): string {
  const date = safeParseDate(dateValue);
  if (!date) return 'غير محدد';
  
  try {
    return format(date, formatStr, { locale: ar });
  } catch (e) {
    return 'غير محدد';
  }
}

export default function ReceiptVoucherReports() {
  // استخدام DateRangePicker بدلاً من نوع الفترة والتاريخ المنفصلين
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { data: receipts = [], isLoading } = trpc.receiptVoucher.getAll.useQuery({ limit: 1000, offset: 0 });
  const { data: branches = [] } = trpc.branches.list.useQuery();
  const generatePDFMutation = trpc.receiptVoucher.generateReportPDF.useMutation();

  // تصفية السندات حسب الفترة والبحث والفرع
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      const receiptDate = safeParseDate(receipt.voucherDate);
      
      // إذا كان التاريخ غير صالح، نعرض السند (لا نستبعده)
      if (!receiptDate) {
        console.warn('تاريخ غير صالح للسند:', receipt.voucherId, receipt.voucherDate);
        const matchesSearch = searchTerm === '' || 
          receipt.voucherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          receipt.payeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          receipt.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = selectedBranch === 'all' || 
          receipt.branchName === selectedBranch ||
          (receipt.branchId && receipt.branchId.toString() === selectedBranch);
        return matchesSearch && matchesBranch;
      }
      
      // التحقق من النطاق الزمني
      let inRange = true;
      if (dateRange.from && dateRange.to) {
        inRange = isWithinInterval(receiptDate, { start: dateRange.from, end: dateRange.to });
      } else if (dateRange.from) {
        inRange = receiptDate >= dateRange.from;
      } else if (dateRange.to) {
        inRange = receiptDate <= dateRange.to;
      }
      
      const matchesSearch = searchTerm === '' || 
        receipt.voucherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.payeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBranch = selectedBranch === 'all' || 
        receipt.branchName === selectedBranch ||
        (receipt.branchId && receipt.branchId.toString() === selectedBranch);
      return inRange && matchesSearch && matchesBranch;
    });
  }, [receipts, dateRange, searchTerm, selectedBranch]);

  // حساب الإحصائيات
  const statistics = useMemo(() => {
    const totalAmount = filteredReceipts.reduce((sum, r) => sum + (parseFloat(r.totalAmount as any) || 0), 0);
    const count = filteredReceipts.length;

    // حساب عدد الأيام في الفترة
    let daysInPeriod = 1;
    if (dateRange.from && dateRange.to) {
      daysInPeriod = Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    return {
      count,
      totalAmount,
      averageAmount: count > 0 ? totalAmount / count : 0,
      dailyAverage: totalAmount / daysInPeriod,
      daysInPeriod
    };
  }, [filteredReceipts, dateRange]);

  // تصدير إلى Excel
  const exportToExcel = () => {
    const headers = ['رقم السند', 'التاريخ', 'المدفوع له', 'المبلغ الكلي', 'الحالة', 'المشرف', 'الملاحظات'];
    const data = filteredReceipts.map(receipt => [
      receipt.voucherId,
      safeFormatDate(receipt.voucherDate),
      receipt.payeeName || '',
      parseFloat(receipt.totalAmount as any)?.toFixed(2) || '0',
      receipt.status || '',
      receipt.createdByName || '',
      receipt.notes || '',
    ]);

    let csv = '\uFEFF'; // BOM للعربية
    csv += headers.join(',') + '\n';
    data.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_السندات_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('تم تصدير التقرير بنجاح');
  };

  // تصدير إلى PDF احترافي
  const exportToPDF = async () => {
    if (!dateRange.from || !dateRange.to) {
      toast.error('يرجى تحديد الفترة الزمنية');
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      const startDateStr = format(dateRange.from, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.to, 'yyyy-MM-dd');
      
      const result = await generatePDFMutation.mutateAsync({
        title: 'تقرير سندات القبض',
        periodType: 'مخصص',
        startDate: startDateStr,
        endDate: endDateStr,
        branchName: selectedBranch === 'all' ? 'جميع الفروع' : selectedBranch,
        statistics: {
          count: statistics.count,
          totalAmount: statistics.totalAmount,
          averageAmount: statistics.averageAmount,
        },
        receipts: filteredReceipts.map(receipt => ({
          voucherId: receipt.voucherId,
          voucherDate: safeFormatDate(receipt.voucherDate),
          payeeName: receipt.payeeName || '',
          totalAmount: (parseFloat(receipt.totalAmount as any) || 0).toFixed(2),
          status: receipt.status || 'draft',
          createdByName: receipt.createdByName || '',
          notes: receipt.notes || '',
          branchName: receipt.branchName || '',
        })),
      });

      // تحويل Base64 إلى Blob وتحميله
      const byteCharacters = atob(result.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // إنشاء رابط التحميل
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `تقرير_سندات_القبض_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('تم تحميل التقرير بنجاح');
    } catch (error: any) {
      console.error('خطأ في إنشاء PDF:', error);
      toast.error(error?.message || 'فشل في إنشاء التقرير');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // تنسيق عرض الفترة
  const periodDisplay = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return 'جميع الفترات';
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd/MM/yyyy', { locale: ar })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ar })}`;
    }
    if (dateRange.from) return `من ${format(dateRange.from, 'dd/MM/yyyy', { locale: ar })}`;
    if (dateRange.to) return `حتى ${format(dateRange.to, 'dd/MM/yyyy', { locale: ar })}`;
    return '';
  }, [dateRange]);

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div>
        <h1 className="text-3xl font-bold">تقارير سندات القبض</h1>
        <p className="text-gray-500 mt-2">عرض وتحليل جميع سندات القبض المسجلة</p>
      </div>

      {/* الفلاتر */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            الفلاتر والبحث
          </CardTitle>
          <CardDescription>
            حدد الفترة الزمنية والفرع للبحث في السندات
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* اختيار الفترة */}
            <div className="md:col-span-1">
              <label className="text-sm font-medium mb-2 block">الفترة الزمنية</label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="اختر الفترة"
                presets={true}
              />
            </div>

            {/* الفرع */}
            <div>
              <label className="text-sm font-medium mb-2 block">الفرع</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* البحث */}
            <div>
              <label className="text-sm font-medium mb-2 block">البحث</label>
              <Input
                placeholder="ابحث عن رقم السند أو المدفوع له..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              عدد السندات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{statistics.count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              سند في الفترة المحددة ({statistics.daysInPeriod} يوم)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              إجمالي المبالغ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{statistics.totalAmount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">ريال سعودي</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              متوسط السند
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{statistics.averageAmount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">ريال سعودي</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              المتوسط اليومي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{statistics.dailyAverage.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">ريال سعودي / يوم</p>
          </CardContent>
        </Card>
      </div>

      {/* أزرار التصدير */}
      <div className="flex gap-2">
        <Button onClick={exportToExcel} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          تصدير Excel
        </Button>
        <Button 
          onClick={exportToPDF} 
          variant="default" 
          className="gap-2 bg-red-600 hover:bg-red-700"
          disabled={isGeneratingPDF || !dateRange.from || !dateRange.to}
        >
          {isGeneratingPDF ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {isGeneratingPDF ? 'جاري إنشاء PDF...' : 'تحميل PDF'}
        </Button>
      </div>

      {/* جدول السندات */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة السندات</CardTitle>
          <CardDescription>
            {filteredReceipts.length} سند في الفترة المحددة
            {dateRange.from && dateRange.to && (
              <span className="mr-2 text-primary">
                ({periodDisplay})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="mt-2 text-muted-foreground">جاري التحميل...</p>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد سندات في الفترة المحددة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">رقم السند</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المدفوع له</TableHead>
                    <TableHead className="text-right">المبلغ الكلي</TableHead>
                    <TableHead className="text-right">المشرف</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt, index) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium font-mono">{receipt.voucherId}</TableCell>
                      <TableCell>
                        {safeFormatDate(receipt.voucherDate)}
                      </TableCell>
                      <TableCell>{receipt.payeeName}</TableCell>
                      <TableCell className="font-semibold">
                        {parseFloat(receipt.totalAmount as any)?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                      </TableCell>
                      <TableCell>{receipt.createdByName}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            receipt.status === 'approved' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                            receipt.status === 'paid' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                            receipt.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                            'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                          }
                        >
                          {receipt.status === 'draft' ? 'مسودة' : 
                           receipt.status === 'approved' ? 'معتمد' : 
                           receipt.status === 'paid' ? 'مدفوع' : 'ملغي'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
