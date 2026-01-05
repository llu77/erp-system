import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { Plus, Printer, Save, Eye, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';

// المستقبلون الثابتون
const RECIPIENTS = [
  { id: 'omar', label: 'عمر المطيري' },
  { id: 'salem', label: 'سالم الوادعي' },
  { id: 'store', label: 'اغراض محل' },
];

export default function ReceiptVoucher() {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  // بيانات النموذج المبسطة
  const [formData, setFormData] = useState({
    voucherDate: new Date().toISOString().split('T')[0],
    dueDateFrom: '',
    dueDateTo: '',
    payeeName: user?.name || user?.username || '',
    payeePhone: user?.phone || '',
    payeeEmail: user?.email || '',
    amount: 0,
    expensesAmount: 0,
    recipient: '',
    notes: '',
    branchName: user?.name || user?.username || '',
  });

  // APIs
  const createVoucherMutation = trpc.receiptVoucher.create.useMutation();
  const sendEmailMutation = trpc.receiptVoucher.sendEmail.useMutation();
  const getVouchersQuery = trpc.receiptVoucher.getAll.useQuery({ limit: 50, offset: 0 });
  const getVoucherQuery = trpc.receiptVoucher.get.useQuery(
    { voucherId: selectedVoucher?.voucherId || '' },
    { enabled: !!selectedVoucher?.voucherId }
  );

  // حساب الكاش المسلم تلقائياً
  const cashDelivered = Math.max(0, formData.amount - formData.expensesAmount);

  // إنشاء السند
  const handleCreateVoucher = async () => {
    if (!formData.recipient.trim()) {
      toast.error('يرجى اختيار المستقبل');
      return;
    }

    if (formData.amount <= 0) {
      toast.error('يرجى إدخال المبلغ');
      return;
    }

    try {
      const recipientLabel = RECIPIENTS.find(r => r.id === formData.recipient)?.label || formData.recipient;

      const result = await createVoucherMutation.mutateAsync({
        voucherDate: new Date(formData.voucherDate),
        dueDate: formData.dueDateFrom ? new Date(formData.dueDateFrom) : undefined,
        payeeName: recipientLabel,
        payeeAddress: formData.notes,
        payeePhone: formData.payeePhone,
        payeeEmail: formData.payeeEmail,
        branchId: undefined,
        branchName: formData.branchName,
        description: 'تسليم مبالغ كاش',
        notes: formData.notes,
        items: [
          {
            description: 'تسليم مبالغ كاش',
            amount: cashDelivered,
            notes: `المبلغ الكلي: ${formData.amount} ر.س | المصروف: ${formData.expensesAmount} ر.س`,
          },
        ],
      });

      if (result.success) {
        toast.success(`تم إنشاء السند ${result.voucherId} بنجاح`);
        setShowCreateDialog(false);
        getVouchersQuery.refetch();
        // إعادة تعيين النموذج
        setFormData({
          voucherDate: new Date().toISOString().split('T')[0],
          dueDateFrom: '',
          dueDateTo: '',
          payeeName: user?.name || user?.username || '',
          payeePhone: user?.phone || '',
          payeeEmail: user?.email || '',
          amount: 0,
          expensesAmount: 0,
          recipient: '',
          notes: '',
          branchName: user?.name || user?.username || '',
        });
      } else {
        toast.error(result.error || 'فشل في إنشاء السند');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء إنشاء السند');
    }
  };

  // طباعة السند
  const handlePrint = () => {
    window.print();
  };

  // معاينة السند
  const handlePreview = (voucher: any) => {
    setSelectedVoucher(voucher);
    setShowPreviewDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">سندات القبض</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة سندات تسليم المبالغ النقدية</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            سند قبض جديد
          </Button>
        </div>

        {/* جدول السندات */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة سندات القبض</CardTitle>
            <CardDescription>
              {getVouchersQuery.data?.length || 0} سند
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getVouchersQuery.isLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : getVouchersQuery.data?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">لا توجد سندات قبض</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-3 px-4">رقم السند</th>
                      <th className="text-right py-3 px-4">التاريخ</th>
                      <th className="text-right py-3 px-4">المستقبل</th>
                      <th className="text-right py-3 px-4">المبلغ المسلم</th>
                      <th className="text-right py-3 px-4">الحالة</th>
                      <th className="text-right py-3 px-4">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVouchersQuery.data?.map((voucher: any) => (
                      <tr key={voucher.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4 font-medium">{voucher.voucherId}</td>
                        <td className="py-3 px-4">{new Date(voucher.voucherDate).toLocaleDateString('ar-SA')}</td>
                        <td className="py-3 px-4">{voucher.payeeName}</td>
                        <td className="py-3 px-4 font-semibold">
                          {parseFloat(voucher.totalAmount).toLocaleString('ar-SA')} ر.س
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              voucher.status === 'paid' ? 'default' :
                              voucher.status === 'approved' ? 'secondary' :
                              voucher.status === 'cancelled' ? 'destructive' :
                              'outline'
                            }
                          >
                            {voucher.status === 'draft' && 'مسودة'}
                            {voucher.status === 'approved' && 'موافق عليه'}
                            {voucher.status === 'paid' && 'مدفوع'}
                            {voucher.status === 'cancelled' && 'ملغى'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(voucher)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* نموذج إنشاء سند جديد */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>سند قبض جديد</DialogTitle>
            <DialogDescription>
              إنشاء سند قبض لتسليم المبالغ النقدية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* التواريخ */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>تاريخ السند *</Label>
                <Input
                  type="date"
                  value={formData.voucherDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, voucherDate: e.target.value }))}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">تلقائي</p>
              </div>
              <div>
                <Label>تاريخ الاستحقاق (من) *</Label>
                <Input
                  type="date"
                  value={formData.dueDateFrom}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDateFrom: e.target.value }))}
                />
              </div>
            </div>

            {/* البيانات الأساسية */}
            <div className="space-y-4">
              <div>
                <Label>المستقبل *</Label>
                <Select value={formData.recipient} onValueChange={(value) => setFormData(prev => ({ ...prev, recipient: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المستقبل" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECIPIENTS.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>مشرف الفرع</Label>
                <Input
                  value={formData.branchName}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">تلقائي</p>
              </div>
            </div>

            {/* المبالغ */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">المبالغ المالية</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>المبلغ الكلي *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label>المبلغ المصروف</Label>
                  <Input
                    type="number"
                    value={formData.expensesAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, expensesAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              {/* الكاش المسلم */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">الكاش المسلم:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {cashDelivered.toLocaleString('ar-SA')} ر.س
                  </span>
                </div>
              </div>
            </div>

            {/* الملاحظات */}
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="ملاحظات اختيارية"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleCreateVoucher}
              disabled={createVoucherMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {createVoucherMutation.isPending ? 'جاري الحفظ...' : 'حفظ السند'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* معاينة السند - تصميم محسّن */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>معاينة السند</DialogTitle>
          </DialogHeader>

          {getVoucherQuery.data && (
            <div className="space-y-0 print:space-y-0 bg-white p-8 print:p-0">
              {/* رأس السند */}
              <div className="border-b-4 border-gray-800 pb-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-center flex-1">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">سند قبض</h1>
                    <p className="text-gray-600 text-sm">Symbol AI</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">رقم السند</p>
                    <p className="text-lg font-bold text-gray-900">{getVoucherQuery.data.voucherId}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                  <div>
                    <p className="text-gray-600 text-xs mb-1">التاريخ</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(getVoucherQuery.data.voucherDate).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600 text-xs mb-1">تاريخ الاستحقاق</p>
                    <p className="font-semibold text-gray-900">
                      {getVoucherQuery.data.dueDate ? new Date(getVoucherQuery.data.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-gray-600 text-xs mb-1">الحالة</p>
                    <p className="font-semibold text-gray-900">مسودة</p>
                  </div>
                </div>
              </div>

              {/* بيانات المستقبل */}
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">المستقبل</p>
                    <p className="text-lg font-bold text-gray-900">{getVoucherQuery.data.payeeName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">رقم الجوال</p>
                    <p className="text-lg font-bold text-gray-900">{getVoucherQuery.data.payeePhone || 'غير محدد'}</p>
                  </div>
                </div>
              </div>

              {/* جدول البيانات */}
              <div className="mb-8 border border-gray-300">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="p-4 text-right text-sm font-semibold text-gray-900">الوصف</th>
                      <th className="p-4 text-left text-sm font-semibold text-gray-900">المبلغ (ر.س)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVoucherQuery.data.items?.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-gray-300">
                        <td className="p-4 text-right text-gray-900">{item.description}</td>
                        <td className="p-4 text-left text-gray-900 font-semibold">
                          {parseFloat(item.amount).toLocaleString('ar-SA')}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="p-4 text-right text-gray-900">المجموع</td>
                      <td className="p-4 text-left text-gray-900 text-lg">
                        {parseFloat(getVoucherQuery.data.totalAmount).toLocaleString('ar-SA')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* التوقيعات والختم */}
              <div className="border-t-4 border-gray-800 pt-8">
                <div className="grid grid-cols-3 gap-6 text-center">
                  {/* التوقيع الأول */}
                  <div>
                    <div className="h-24 border-b-2 border-gray-400 mb-2 flex items-end justify-center">
                      <span className="text-xs text-gray-500">توقيع</span>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">سالم الوادعي</p>
                    <p className="text-xs text-gray-600">مدير المالية</p>
                  </div>

                  {/* الختم */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-full border-4 border-blue-600 flex items-center justify-center mb-2">
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-bold">ختم</p>
                        <p className="text-xs text-blue-600 font-bold">البرنامج</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">Symbol AI</p>
                  </div>

                  {/* التوقيع الثاني */}
                  <div>
                    <div className="h-24 border-b-2 border-gray-400 mb-2 flex items-end justify-center">
                      <span className="text-xs text-gray-500">توقيع</span>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">عمر المطيري</p>
                    <p className="text-xs text-gray-600">المراجع المالي</p>
                  </div>
                </div>
              </div>

              {/* معلومات الإنشاء */}
              <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
                <p>تم الإنشاء بواسطة: <span className="font-semibold text-gray-700">{getVoucherQuery.data.createdByName}</span></p>
                <p>التاريخ والوقت: <span className="font-semibold text-gray-700">{new Date(getVoucherQuery.data.createdAt).toLocaleString('ar-SA')}</span></p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              إغلاق
            </Button>
            <Button
              onClick={async () => {
                try {
                  await sendEmailMutation.mutateAsync({
                    voucherId: getVoucherQuery.data?.voucherId || '',
                  });
                  toast.success('تم إرسال السند عبر البريد الإلكتروني بنجاح');
                } catch (error) {
                  toast.error('فشل في إرسال البريد الإلكتروني');
                }
              }}
              disabled={sendEmailMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sendEmailMutation.isPending ? 'جاري الإرسال...' : 'إرسال عبر البريد'}
            </Button>
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
