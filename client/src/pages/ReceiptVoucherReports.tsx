import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getVoucherStatusLabel, toVoucherDateString } from '@shared/vouchers';

type PeriodType = 'day' | 'week' | 'month';
type VoucherTypeFilter = 'all' | 'receipt' | 'payment';

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  receipt: 'سند قبض',
  payment: 'سند صرف',
};

// دالة مساعدة لتحويل التاريخ بشكل آمن
function safeParseDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  
  try {
    // إذا كان التاريخ كائن Date
    if (dateValue instanceof Date) {
      return isValid(dateValue) ? dateValue : null;
    }
    
    const dateStr = dateValue.toString();
    
    // محاولة تحليل التاريخ بعدة طرق
    if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parsed = parseISO(dateStr);
      return isValid(parsed) ? parsed : null;
    }
    
    // محاولة تحليل التاريخ كـ Date عادي
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

/** منع تنفيذ الصيغ عند فتح الملف في Excel: الخلايا التي تبدأ بـ = + - @ أو Tab تُسبق بفاصلة عليا */
export function neutralizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export default function ReceiptVoucherReports() {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  // التاريخ الافتراضي من أجزاء التاريخ المحلية (toISOString يُزيح اليوم في توقيت +3)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [voucherType, setVoucherType] = useState<VoucherTypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // حساب نطاق التاريخ بناءً على نوع الفترة
  const dateRange = useMemo(() => {
    const parsed = parseISO(selectedDate);
    const date = isValid(parsed) ? parsed : new Date();
    switch (periodType) {
      case 'day':
        return { start: date, end: date };
      case 'week':
        return { start: startOfWeek(date, { locale: ar }), end: endOfWeek(date, { locale: ar }) };
      case 'month':
        return { start: startOfMonth(date), end: endOfMonth(date) };
    }
  }, [selectedDate, periodType]);

  // الفترة والنوع يُطبقان على الخادم
  const { data: receipts = [], isLoading, error: receiptsError, refetch: refetchReceipts } = trpc.receiptVoucher.getAll.useQuery({
    limit: 500,
    offset: 0,
    voucherType,
    startDate: format(dateRange.start, 'yyyy-MM-dd'),
    endDate: format(dateRange.end, 'yyyy-MM-dd'),
  });
  const { data: branches = [] } = trpc.branches.list.useQuery();
  const generatePDFMutation = trpc.receiptVoucher.generateReportPDF.useMutation();

  // تصفية السندات حسب الفترة والبحث والفرع
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      // معالجة تنسيقات التاريخ المختلفة
      const receiptDate = safeParseDate(receipt.voucherDate);
      
      // إذا كان التاريخ غير صالح، نعرض السند (لا نستبعده)
      if (!receiptDate) {
        console.warn('تاريخ غير صالح للسند:', receipt.voucherId, receipt.voucherDate);
        // نعرض السند إذا كان التاريخ غير صالح لكي لا نخفي بيانات مهمة
        const matchesSearch = searchTerm === '' || 
          receipt.voucherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          receipt.payeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          receipt.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          receipt.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = selectedBranch === 'all' ||  
          receipt.branchName === selectedBranch ||
          (receipt.branchId && receipt.branchId.toString() === selectedBranch);
        return matchesSearch && matchesBranch;
      }
      
      // مقارنة بمفتاح اليوم (YYYY-MM-DD): تاريخ السند يصل منتصف الليل UTC فيقع خارج نطاق اليوم المحلي في توقيت +3
      const dayKey = toVoucherDateString(receipt.voucherDate) ?? '';
      const inRange = dayKey >= format(dateRange.start, 'yyyy-MM-dd') && dayKey <= format(dateRange.end, 'yyyy-MM-dd');
      const matchesSearch = searchTerm === '' || 
        receipt.voucherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.payeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBranch = selectedBranch === 'all' ||  
        receipt.branchName === selectedBranch ||
        (receipt.branchId && receipt.branchId.toString() === selectedBranch);
      return inRange && matchesSearch && matchesBranch;
    });
  }, [receipts, dateRange, searchTerm, selectedBranch]);

  // حساب الإحصائيات (السندات الملغاة لا تدخل في الإجماليات)
  const statistics = useMemo(() => {
    const active = filteredReceipts.filter(r => r.status !== 'cancelled');
    const sumOf = (list: typeof active) => list.reduce((sum, r) => sum + (parseFloat(r.totalAmount as any) || 0), 0);
    const totalAmount = sumOf(active);
    const count = active.length;

    return {
      count,
      totalAmount,
      averageAmount: count > 0 ? totalAmount / count : 0,
      receiptAmount: sumOf(active.filter(r => r.voucherType !== 'payment')),
      paymentAmount: sumOf(active.filter(r => r.voucherType === 'payment')),
      cancelledCount: filteredReceipts.length - count,
    };
  }, [filteredReceipts]);

  const statusLabel = (status: string, type: string) =>
    getVoucherStatusLabel(status, type === 'payment' ? 'payment' : 'receipt').ar;

  // تصدير إلى Excel
  const exportToExcel = () => {
    const headers = ['رقم السند', 'النوع', 'التاريخ', 'الطرف', 'المستلم', 'المبلغ الكلي', 'الحالة', 'المشرف', 'الملاحظات'];
    const data = filteredReceipts.map(receipt => [
      receipt.voucherId,
      VOUCHER_TYPE_LABELS[receipt.voucherType] || '',
      safeFormatDate(receipt.voucherDate),
      receipt.partyName || receipt.payeeName || '',
      receipt.payeeName || '',
      parseFloat(receipt.totalAmount as any)?.toFixed(2) || '0',
      statusLabel(receipt.status, receipt.voucherType),
      receipt.createdByName || '',
      receipt.notes || '',
    ]);

    let csv = '\uFEFF'; // BOM للعربية
    csv += headers.join(',') + '\n';
    data.forEach(row => {
      csv += row.map(cell => `"${neutralizeCsvCell(String(cell)).replace(/"/g, '""')}"`).join(',') + '\n';
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
    setIsGeneratingPDF(true);
    
    try {
      const periodLabel = periodType === 'day' ? 'يومي' : periodType === 'week' ? 'أسبوعي' : 'شهري';
      const startDateStr = format(dateRange.start, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.end, 'yyyy-MM-dd');
      
      const result = await generatePDFMutation.mutateAsync({
        title: voucherType === 'payment' ? 'تقرير سندات الصرف' : voucherType === 'receipt' ? 'تقرير سندات القبض' : 'تقرير السندات (قبض وصرف)',
        periodType: periodLabel,
        startDate: startDateStr,
        endDate: endDateStr,
        branchName: selectedBranch === 'all' ? 'جميع الفروع' : selectedBranch,
        statistics: {
          count: statistics.count,
          totalAmount: statistics.totalAmount,
          averageAmount: statistics.averageAmount,
        },
        receipts: filteredReceipts.map(receipt => ({
          voucherId: `${receipt.voucherId} (${VOUCHER_TYPE_LABELS[receipt.voucherType] || ''})`,
          voucherDate: safeFormatDate(receipt.voucherDate),
          payeeName: receipt.partyName || receipt.payeeName || '',
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

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div>
        <h1 className="text-3xl font-bold">تقارير السندات</h1>
        <p className="text-gray-500 mt-2">عرض وتحليل سندات القبض والصرف المسجلة (الملغي لا يدخل في الإجماليات)</p>
      </div>

      {/* الفلاتر */}
      <Card>
        <CardHeader>
          <CardTitle>الفلاتر والبحث</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* نوع السند */}
            <div>
              <label className="text-sm font-medium">نوع السند</label>
              <Select value={voucherType} onValueChange={(v) => setVoucherType(v as VoucherTypeFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع السندات</SelectItem>
                  <SelectItem value="receipt">سندات القبض</SelectItem>
                  <SelectItem value="payment">سندات الصرف</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* نوع الفترة */}
            <div>
              <label className="text-sm font-medium">نوع الفترة</label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">يومي</SelectItem>
                  <SelectItem value="week">أسبوعي</SelectItem>
                  <SelectItem value="month">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* التاريخ */}
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {/* الفرع */}
            <div>
              <label className="text-sm font-medium">الفرع</label>
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
            <div className="md:col-span-2">
              <label className="text-sm font-medium">البحث</label>
              <Input
                placeholder="ابحث عن رقم السند أو الطرف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الإحصائيات (لا تُعرض أصفاراً عند فشل التحميل؛ الخطأ يظهر في الجدول) */}
      {!receiptsError && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">عدد السندات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.count}</div>
            <p className="text-xs text-gray-500 mt-1">
              سند في الفترة المحددة{statistics.cancelledCount > 0 ? ` (+${statistics.cancelledCount} ملغي غير محتسب)` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">إجمالي المبالغ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalAmount.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
            {voucherType === 'all' && (
              <p className="text-xs text-gray-500 mt-1">
                قبض: {statistics.receiptAmount.toFixed(2)} | صرف: {statistics.paymentAmount.toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">المتوسط</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.averageAmount.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* أزرار التصدير */}
      <div className="flex gap-2">
        <Button onClick={exportToExcel} variant="outline" className="gap-2" disabled={!!receiptsError || isLoading}>
          <Download className="w-4 h-4" />
          تصدير Excel
        </Button>
        <Button 
          onClick={exportToPDF} 
          variant="default" 
          className="gap-2 bg-red-600 hover:bg-red-700"
          disabled={isGeneratingPDF || !!receiptsError || isLoading}
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
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : receiptsError ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-red-600">تعذر تحميل السندات: {receiptsError.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetchReceipts()}>إعادة المحاولة</Button>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">لا توجد سندات في الفترة المحددة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم السند</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الطرف</TableHead>
                    <TableHead>المبلغ الكلي</TableHead>
                    <TableHead>المشرف</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow key={receipt.id} className={receipt.status === 'cancelled' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{receipt.voucherId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={receipt.voucherType === 'payment' ? 'border-red-300 text-red-700' : 'border-blue-300 text-blue-700'}>
                          {VOUCHER_TYPE_LABELS[receipt.voucherType] || 'سند قبض'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {safeFormatDate(receipt.voucherDate)}
                      </TableCell>
                      <TableCell>
                        {receipt.partyName || receipt.payeeName}
                        {receipt.voucherType !== 'payment' && receipt.partyName && receipt.payeeName !== receipt.partyName && (
                          <div className="text-xs text-gray-500">المستلم: {receipt.payeeName}</div>
                        )}
                      </TableCell>
                      <TableCell className={receipt.status === 'cancelled' ? 'line-through' : ''}>{parseFloat(receipt.totalAmount as any)?.toFixed(2)} ر.س</TableCell>
                      <TableCell>{receipt.createdByName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {statusLabel(receipt.status, receipt.voucherType)}
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
