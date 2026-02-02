import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { FileText, Download, Filter, Calendar, Building2, Receipt, TrendingUp, Clock, CheckCircle, XCircle, FileCheck, Eye, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function VouchersReport() {
  // الحصول على أول وآخر يوم في الشهر الحالي
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // جلب بيانات المستخدم الحالي
  const { data: user } = trpc.auth.me.useQuery();

  // mutation لتحديث حالة السند
  const updateStatusMutation = trpc.receiptVoucher.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('تم اعتماد السند بنجاح');
      refetch();
    },
    onError: (error) => {
      toast.error(`فشل في اعتماد السند: ${error.message}`);
    },
  });

  // mutation لتوليد PDF للسند الفردي
  const generateSinglePDFMutation = trpc.receiptVoucher.generatePDF.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('تم تحميل السند بنجاح');
    },
    onError: (error) => {
      toast.error(`فشل في تحميل السند: ${error.message}`);
    },
  });

  const [filters, setFilters] = useState({
    startDate: firstDayOfMonth.toISOString().split('T')[0],
    endDate: lastDayOfMonth.toISOString().split('T')[0],
    status: 'all' as 'draft' | 'approved' | 'paid' | 'cancelled' | 'all',
    branchId: '',
  });

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // جلب بيانات التقرير
  const { data: reportData, isLoading, refetch } = trpc.receiptVoucher.getMonthlyReport.useQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    status: filters.status,
    branchId: filters.branchId || undefined,
  }, {
    enabled: !!filters.startDate && !!filters.endDate,
  });

  // توليد PDF
  const generatePDFMutation = trpc.receiptVoucher.generateMonthlyReportPDF.useMutation({
    onSuccess: (data) => {
      // تحويل Base64 إلى Blob وتنزيله
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('تم تنزيل التقرير بنجاح');
    },
    onError: (error) => {
      toast.error(`فشل في توليد التقرير: ${error.message}`);
    },
  });

  const handleGeneratePDF = () => {
    generatePDFMutation.mutate({
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: filters.status,
      branchId: filters.branchId || undefined,
    });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-gray-500/20 text-gray-400"><Clock className="w-3 h-3 ml-1" />مسودة</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 ml-1" />معتمد</Badge>;
      case 'paid':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400"><FileCheck className="w-3 h-3 ml-1" />مدفوع</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 ml-1" />ملغي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statistics = useMemo(() => {
    if (!reportData?.statistics) return null;
    return reportData.statistics;
  }, [reportData]);

  return (
    <div className="p-6 space-y-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">تقرير السندات الشهري</h1>
            <p className="text-sm text-gray-400">عرض وتصدير تقارير السندات حسب الفترة والفلاتر</p>
          </div>
        </div>
        <Button
          onClick={handleGeneratePDF}
          disabled={generatePDFMutation.isPending || !reportData?.vouchers?.length}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
        >
          {generatePDFMutation.isPending ? (
            <>جاري التوليد...</>
          ) : (
            <>
              <Download className="w-4 h-4 ml-2" />
              تصدير PDF
            </>
          )}
        </Button>
      </div>

      {/* فلاتر التقرير */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Filter className="w-5 h-5 text-orange-400" />
            فلاتر التقرير
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">من تاريخ</Label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="pr-10 bg-gray-700/50 border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">إلى تاريخ</Label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="pr-10 bg-gray-700/50 border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">الحالة</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value as typeof filters.status })}
              >
                <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="approved">معتمد</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">الفرع</Label>
              <Select
                value={filters.branchId}
                onValueChange={(value) => setFilters({ ...filters, branchId: value === 'all' ? '' : value })}
              >
                <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches?.map((branch: { id: number; name: string }) => (
                    <SelectItem key={branch.id} value={String(branch.id)}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* بطاقات الإحصائيات */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-gray-700/50" />
          ))}
        </div>
      ) : statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">إجمالي السندات</p>
                  <p className="text-3xl font-bold text-white">{statistics.totalCount}</p>
                  <p className="text-sm text-orange-400 mt-1">{formatCurrency(statistics.totalAmount)}</p>
                </div>
                <div className="p-3 bg-orange-500/20 rounded-xl">
                  <Receipt className="w-8 h-8 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-500/20 to-gray-600/10 border-gray-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">المسودات</p>
                  <p className="text-3xl font-bold text-white">{statistics.draftCount}</p>
                  <p className="text-sm text-gray-400 mt-1">{formatCurrency(statistics.draftAmount)}</p>
                </div>
                <div className="p-3 bg-gray-500/20 rounded-xl">
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">المعتمدة</p>
                  <p className="text-3xl font-bold text-white">{statistics.approvedCount}</p>
                  <p className="text-sm text-green-400 mt-1">{formatCurrency(statistics.approvedAmount)}</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">المدفوعة</p>
                  <p className="text-3xl font-bold text-white">{statistics.paidCount}</p>
                  <p className="text-sm text-blue-400 mt-1">{formatCurrency(statistics.paidAmount)}</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* جدول السندات */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-orange-400" />
            قائمة السندات ({reportData?.vouchers?.length || 0} سند)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 bg-gray-700/50" />
              ))}
            </div>
          ) : reportData?.vouchers?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-gray-700/30">
                    <TableHead className="text-gray-300 text-center">#</TableHead>
                    <TableHead className="text-gray-300 text-center">رقم السند</TableHead>
                    <TableHead className="text-gray-300 text-center">التاريخ</TableHead>
                    <TableHead className="text-gray-300">المستقبل</TableHead>
                    <TableHead className="text-gray-300 text-center">الفرع</TableHead>
                    <TableHead className="text-gray-300 text-center">المبلغ</TableHead>
                    <TableHead className="text-gray-300 text-center">الحالة</TableHead>
                    <TableHead className="text-gray-300 text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.vouchers.map((voucher, index) => (
                    <TableRow key={voucher.id} className="border-gray-700 hover:bg-gray-700/30">
                      <TableCell className="text-center text-gray-400">{index + 1}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-orange-400">{voucher.voucherId}</TableCell>
                      <TableCell className="text-center text-gray-300">{formatDate(voucher.voucherDate)}</TableCell>
                      <TableCell className="text-white">{voucher.payeeName}</TableCell>
                      <TableCell className="text-center text-gray-400">{voucher.branchName || 'غير محدد'}</TableCell>
                      <TableCell className="text-center font-bold text-white">{formatCurrency(voucher.totalAmount)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(voucher.status)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                            onClick={() => {
                              setSelectedVoucher(voucher);
                              setShowPreviewDialog(true);
                            }}
                            title="معاينة"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {user?.role === 'admin' && voucher.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                              disabled={updateStatusMutation.isPending}
                              onClick={() => {
                                updateStatusMutation.mutate({ voucherId: voucher.voucherId, status: 'approved' });
                              }}
                              title="اعتماد"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-orange-400 hover:text-orange-300 hover:bg-orange-500/20"
                            disabled={generateSinglePDFMutation.isPending}
                            onClick={() => {
                              generateSinglePDFMutation.mutate({ voucherId: voucher.voucherId });
                            }}
                            title="تحميل PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">لا توجد سندات في الفترة المحددة</p>
              <p className="text-gray-500 text-sm mt-2">جرب تغيير الفلاتر أو توسيع نطاق التاريخ</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog معاينة السند */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-orange-400" />
              معاينة السند - {selectedVoucher?.voucherId}
            </DialogTitle>
          </DialogHeader>
          {selectedVoucher && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">رقم السند</p>
                  <p className="text-white font-bold text-lg">{selectedVoucher.voucherId}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">التاريخ</p>
                  <p className="text-white font-bold text-lg">{formatDate(selectedVoucher.voucherDate)}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">المستقبل</p>
                  <p className="text-white font-bold text-lg">{selectedVoucher.payeeName}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">المبلغ</p>
                  <p className="text-orange-400 font-bold text-lg">{formatCurrency(selectedVoucher.totalAmount)}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">الفرع</p>
                  <p className="text-white font-bold text-lg">{selectedVoucher.branchName || 'غير محدد'}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">الحالة</p>
                  <div className="mt-1">{getStatusBadge(selectedVoucher.status)}</div>
                </div>
              </div>
              {selectedVoucher.notes && (
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">ملاحظات</p>
                  <p className="text-white mt-1">{selectedVoucher.notes}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-700">
                {user?.role === 'admin' && selectedVoucher.status === 'draft' && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => {
                      updateStatusMutation.mutate(
                        { voucherId: selectedVoucher.voucherId, status: 'approved' },
                        { onSuccess: () => setShowPreviewDialog(false) }
                      );
                    }}
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    اعتماد السند
                  </Button>
                )}
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={generateSinglePDFMutation.isPending}
                  onClick={() => {
                    generateSinglePDFMutation.mutate({ voucherId: selectedVoucher.voucherId });
                  }}
                >
                  <Printer className="w-4 h-4 ml-2" />
                  تحميل PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
