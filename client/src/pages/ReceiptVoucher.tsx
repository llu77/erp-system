import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { Plus, Trash2, Printer, Save, Eye, Download, FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';

export default function ReceiptVoucher() {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  // بيانات النموذج
  const [formData, setFormData] = useState({
    voucherDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    payeeName: '',
    payeeAddress: '',
    payeePhone: '',
    payeeEmail: '',
    branchId: undefined as number | undefined,
    branchName: '',
    description: '',
    notes: '',
    items: [{ description: '', amount: 0, notes: '' }],
  });

  // APIs
  const createVoucherMutation = trpc.receiptVoucher.create.useMutation();
  const sendEmailMutation = trpc.receiptVoucher.sendEmail.useMutation();
  const getVouchersQuery = trpc.receiptVoucher.getAll.useQuery({ limit: 50, offset: 0 });
  const getVoucherQuery = trpc.receiptVoucher.get.useQuery(
    { voucherId: selectedVoucher?.voucherId || '' },
    { enabled: !!selectedVoucher?.voucherId }
  );

  // إضافة بند جديد
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', amount: 0, notes: '' }],
    }));
  };

  // حذف بند
  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // تحديث بند
  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  // حساب المجموع
  const totalAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);

  // إنشاء السند
  const handleCreateVoucher = async () => {
    if (!formData.payeeName.trim()) {
      toast.error('يرجى إدخال اسم المدفوع له');
      return;
    }

    if (formData.items.some(item => !item.description.trim() || item.amount <= 0)) {
      toast.error('يرجى ملء جميع بيانات البنود');
      return;
    }

    try {
      const result = await createVoucherMutation.mutateAsync({
        voucherDate: new Date(formData.voucherDate),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        payeeName: formData.payeeName,
        payeeAddress: formData.payeeAddress,
        payeePhone: formData.payeePhone,
        payeeEmail: formData.payeeEmail,
        branchId: formData.branchId,
        branchName: formData.branchName,
        description: formData.description,
        notes: formData.notes,
        items: formData.items.map(item => ({
          description: item.description,
          amount: item.amount,
          notes: item.notes,
        })),
      });

      if (result.success) {
        toast.success(`تم إنشاء السند ${result.voucherId} بنجاح`);
        setShowCreateDialog(false);
        getVouchersQuery.refetch();
        // إعادة تعيين النموذج
        setFormData({
          voucherDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          payeeName: '',
          payeeAddress: '',
          payeePhone: '',
          payeeEmail: '',
          branchId: undefined,
          branchName: '',
          description: '',
          notes: '',
          items: [{ description: '', amount: 0, notes: '' }],
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
            <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة سندات القبض والمعاملات المالية</p>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم السند</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المدفوع له</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVouchersQuery.data?.map((voucher: any) => (
                      <TableRow key={voucher.id}>
                        <TableCell className="font-medium">{voucher.voucherId}</TableCell>
                        <TableCell>{new Date(voucher.voucherDate).toLocaleDateString('ar-SA')}</TableCell>
                        <TableCell>{voucher.payeeName}</TableCell>
                        <TableCell className="font-semibold">
                          {parseFloat(voucher.totalAmount).toLocaleString('ar-SA')} ر.س
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreview(voucher)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
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

      {/* نموذج إنشاء سند جديد */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>سند قبض جديد</DialogTitle>
            <DialogDescription>
              إنشاء سند قبض جديد مع تحديد البنود والمبالغ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* بيانات السند */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>تاريخ السند *</Label>
                <Input
                  type="date"
                  value={formData.voucherDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, voucherDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label>اسم المدفوع له *</Label>
                <Input
                  value={formData.payeeName}
                  onChange={(e) => setFormData(prev => ({ ...prev, payeeName: e.target.value }))}
                  placeholder="أدخل اسم المدفوع له"
                />
              </div>
              <div>
                <Label>رقم الجوال</Label>
                <Input
                  value={formData.payeePhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, payeePhone: e.target.value }))}
                  placeholder="رقم الجوال"
                />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={formData.payeeEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, payeeEmail: e.target.value }))}
                  placeholder="البريد الإلكتروني"
                />
              </div>
              <div className="col-span-2">
                <Label>العنوان</Label>
                <Textarea
                  value={formData.payeeAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, payeeAddress: e.target.value }))}
                  placeholder="عنوان المدفوع له"
                  rows={2}
                />
              </div>
              <div className="col-span-2">
                <Label>الوصف</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف السند"
                  rows={2}
                />
              </div>
            </div>

            {/* البنود */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">البنود</h3>
                <Button size="sm" onClick={addItem} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  إضافة بند
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الوصف</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الملاحظات</TableHead>
                      <TableHead>الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="وصف البند"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.notes}
                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                            placeholder="ملاحظات"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* المجموع */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">المجموع:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {totalAmount.toLocaleString('ar-SA')} ر.س
                  </span>
                </div>
              </div>
            </div>

            {/* الملاحظات */}
            <div>
              <Label>ملاحظات عامة</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="ملاحظات عامة على السند"
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

      {/* معاينة السند */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>معاينة السند</DialogTitle>
          </DialogHeader>

          {getVoucherQuery.data && (
            <div className="space-y-6 print:space-y-4">
              {/* رأس السند */}
              <div className="border-b-2 border-gray-300 pb-4 print:pb-2">
                <div className="text-center mb-4">
                  <h1 className="text-3xl font-bold text-gray-900">Symbol AI</h1>
                  <p className="text-gray-600">نظام إدارة الأعمال الشامل</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-semibold">رقم السند</p>
                    <p className="text-gray-700">{getVoucherQuery.data.voucherId}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">سند قبض</p>
                    <p className="text-gray-700">وثيقة مالية رسمية</p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">التاريخ</p>
                    <p className="text-gray-700">
                      {new Date(getVoucherQuery.data.voucherDate).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>
              </div>

              {/* بيانات المدفوع له */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="font-semibold mb-2">المدفوع له</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-semibold">الاسم:</span> {getVoucherQuery.data.payeeName}</p>
                    {getVoucherQuery.data.payeePhone && (
                      <p><span className="font-semibold">الجوال:</span> {getVoucherQuery.data.payeePhone}</p>
                    )}
                    {getVoucherQuery.data.payeeEmail && (
                      <p><span className="font-semibold">البريد:</span> {getVoucherQuery.data.payeeEmail}</p>
                    )}
                    {getVoucherQuery.data.payeeAddress && (
                      <p><span className="font-semibold">العنوان:</span> {getVoucherQuery.data.payeeAddress}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-semibold mb-2">تفاصيل السند</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-semibold">الحالة:</span> {getVoucherQuery.data.status}</p>
                    {getVoucherQuery.data.branchName && (
                      <p><span className="font-semibold">الفرع:</span> {getVoucherQuery.data.branchName}</p>
                    )}
                    {getVoucherQuery.data.dueDate && (
                      <p><span className="font-semibold">تاريخ الاستحقاق:</span> {new Date(getVoucherQuery.data.dueDate).toLocaleDateString('ar-SA')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* جدول البنود */}
              <div>
                <h3 className="font-semibold mb-3">البنود</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-right">الوصف</th>
                      <th className="border border-gray-300 p-2 text-left">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVoucherQuery.data.items?.map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="border border-gray-300 p-2">{item.description}</td>
                        <td className="border border-gray-300 p-2 text-left">
                          {parseFloat(item.amount).toLocaleString('ar-SA')} ر.س
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td className="border border-gray-300 p-2">المجموع</td>
                      <td className="border border-gray-300 p-2 text-left">
                        {parseFloat(getVoucherQuery.data.totalAmount).toLocaleString('ar-SA')} ر.س
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* التوقيعات والختم */}
              <div className="border-t-2 border-gray-300 pt-8 print:pt-4">
                <div className="grid grid-cols-3 gap-6 text-center text-sm">
                  <div>
                    <div className="border-t-2 border-gray-400 pt-4 h-20 flex items-end justify-center mb-2">
                      <p className="text-gray-500">توقيع</p>
                    </div>
                    <p className="font-semibold">سالم الوادعي</p>
                    <p className="text-gray-600">مدير المالية</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center h-20 mb-2">
                      <div className="text-center">
                        <div className="text-6xl font-bold text-blue-600 opacity-20">✓</div>
                        <p className="text-xs text-gray-500 mt-1">ختم البرنامج</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="border-t-2 border-gray-400 pt-4 h-20 flex items-end justify-center mb-2">
                      <p className="text-gray-500">توقيع</p>
                    </div>
                    <p className="font-semibold">عمر المطيري</p>
                    <p className="text-gray-600">المراجع المالي</p>
                  </div>
                </div>
              </div>

              {/* معلومات الإنشاء */}
              <div className="text-xs text-gray-500 border-t pt-4 print:pt-2">
                <p>تم إنشاء السند بواسطة: {getVoucherQuery.data.createdByName}</p>
                <p>التاريخ: {new Date(getVoucherQuery.data.createdAt).toLocaleString('ar-SA')}</p>
              </div>
            </div>
          )}

          <DialogFooter>
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
