import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Download, FileText, BarChart3 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type PeriodType = 'day' | 'week' | 'month';

export default function ReceiptVoucherReports() {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const { data: receipts = [], isLoading } = trpc.receiptVoucher.getAll.useQuery({ limit: 1000, offset: 0 });
  const { data: branches = [] } = trpc.branches.list.useQuery();

  // حساب نطاق التاريخ بناءً على نوع الفترة
  const dateRange = useMemo(() => {
    const date = parseISO(selectedDate);
    switch (periodType) {
      case 'day':
        return { start: date, end: date };
      case 'week':
        return { start: startOfWeek(date, { locale: ar }), end: endOfWeek(date, { locale: ar }) };
      case 'month':
        return { start: startOfMonth(date), end: endOfMonth(date) };
    }
  }, [selectedDate, periodType]);

  // تصفية السندات حسب الفترة والبحث والفرع
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      const receiptDate = parseISO(receipt.voucherDate.toString());
      const inRange = isWithinInterval(receiptDate, dateRange);
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

    return {
      count,
      totalAmount,
      averageAmount: count > 0 ? totalAmount / count : 0,
    };
  }, [filteredReceipts]);

  // تصدير إلى Excel
  const exportToExcel = () => {
    const headers = ['رقم السند', 'التاريخ', 'المدفوع له', 'المبلغ الكلي', 'الحالة', 'المشرف', 'الملاحظات'];
    const data = filteredReceipts.map(receipt => [
      receipt.voucherId,
      format(parseISO(receipt.voucherDate.toString()), 'yyyy-MM-dd', { locale: ar }),
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
  };

  // تصدير إلى PDF
  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // إضافة العنوان
    doc.setFontSize(16);
    doc.text('تقرير سندات القبض', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

    // إضافة الإحصائيات
    doc.setFontSize(10);
    const periodLabel = periodType === 'day' ? 'يومي' : periodType === 'week' ? 'أسبوعي' : 'شهري';
    doc.text(`الفترة: ${periodLabel} - من ${format(dateRange.start, 'yyyy-MM-dd')} إلى ${format(dateRange.end, 'yyyy-MM-dd')}`, 15, 25);

    // إضافة الإحصائيات
    doc.text(`إجمالي السندات: ${statistics.count}`, 15, 32);
    doc.text(`إجمالي المبالغ: ${statistics.totalAmount.toFixed(2)} ريال`, 15, 38);

    // إضافة الجدول
    const tableData = filteredReceipts.map(receipt => [
      receipt.voucherId,
      format(parseISO(receipt.voucherDate.toString()), 'yyyy-MM-dd'),
      receipt.payeeName || '',
      parseFloat(receipt.totalAmount as any)?.toFixed(2) || '0',
      receipt.status || '',
      receipt.createdByName || '',
    ]);

    (doc as any).autoTable({
      head: [['رقم السند', 'التاريخ', 'المدفوع له', 'المبلغ الكلي', 'الحالة', 'المشرف']],
      body: tableData,
      startY: 50,
      styles: { font: 'Arial', fontSize: 9, halign: 'center' },
      headStyles: { fillColor: [15, 39, 68], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 30 },
      },
    });

    doc.save(`تقرير_السندات_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

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
          <CardTitle>الفلاتر والبحث</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">عدد السندات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.count}</div>
            <p className="text-xs text-gray-500 mt-1">سند في الفترة المحددة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">إجمالي المبالغ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalAmount.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">ريال سعودي</p>
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

      {/* أزرار التصدير */}
      <div className="flex gap-2">
        <Button onClick={exportToExcel} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          تصدير Excel
        </Button>
        <Button onClick={exportToPDF} variant="outline" className="gap-2">
          <FileText className="w-4 h-4" />
          تصدير PDF
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
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">لا توجد سندات في الفترة المحددة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم السند</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المدفوع له</TableHead>
                    <TableHead>المبلغ الكلي</TableHead>
                    <TableHead>المشرف</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">{receipt.voucherId}</TableCell>
                      <TableCell>
                        {format(parseISO(receipt.voucherDate.toString()), 'yyyy-MM-dd', { locale: ar })}
                      </TableCell>
                      <TableCell>{receipt.payeeName}</TableCell>
                      <TableCell>{parseFloat(receipt.totalAmount as any)?.toFixed(2)} ر.س</TableCell>
                      <TableCell>{receipt.createdByName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {receipt.status === 'draft' ? 'مسودة' : receipt.status === 'approved' ? 'معتمد' : receipt.status === 'paid' ? 'مدفوع' : 'ملغي'}
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
