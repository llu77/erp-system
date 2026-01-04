import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, Edit2, Save, X, Percent, Users, History, Clock, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function LoyaltySettings() {
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editingServiceName, setEditingServiceName] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<{ id: number; name: string } | null>(null);

  // جلب الإعدادات
  const { data: settings, refetch: refetchSettings } = trpc.loyalty.getSettings.useQuery();
  const { data: serviceTypes, refetch: refetchServices } = trpc.loyalty.getServiceTypes.useQuery();

  // mutations
  const updateSettingsMutation = trpc.loyalty.updateSettings.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات بنجاح');
      refetchSettings();
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    },
  });

  const addServiceMutation = trpc.loyalty.addServiceType.useMutation({
    onSuccess: () => {
      toast.success('تم إضافة الخدمة بنجاح');
      setNewServiceName('');
      setShowAddDialog(false);
      refetchServices();
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء إضافة الخدمة');
    },
  });

  const updateServiceMutation = trpc.loyalty.updateServiceType.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث الخدمة بنجاح');
      setEditingServiceId(null);
      refetchServices();
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء تحديث الخدمة');
    },
  });

  const deleteServiceMutation = trpc.loyalty.deleteServiceType.useMutation({
    onSuccess: () => {
      toast.success('تم حذف الخدمة بنجاح');
      setShowDeleteDialog(false);
      setServiceToDelete(null);
      refetchServices();
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء حذف الخدمة');
    },
  });

  const [requiredVisits, setRequiredVisits] = useState<number>(4);
  const [discountPercent, setDiscountPercent] = useState<number>(50);

  // تحديث القيم عند تحميل الإعدادات
  useEffect(() => {
    if (settings) {
      setRequiredVisits(settings.requiredVisitsForDiscount);
      setDiscountPercent(settings.discountPercentage);
    }
  }, [settings]);

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      requiredVisitsForDiscount: requiredVisits,
      discountPercentage: discountPercent,
    });
  };

  const handleAddService = () => {
    if (!newServiceName.trim()) {
      toast.error('يرجى إدخال اسم الخدمة');
      return;
    }
    addServiceMutation.mutate({ name: newServiceName.trim() });
  };

  const handleUpdateService = (id: number) => {
    if (!editingServiceName.trim()) {
      toast.error('يرجى إدخال اسم الخدمة');
      return;
    }
    updateServiceMutation.mutate({ id, name: editingServiceName.trim() });
  };

  const handleDeleteService = () => {
    if (serviceToDelete) {
      deleteServiceMutation.mutate({ id: serviceToDelete.id });
    }
  };

  const startEditing = (id: number, name: string) => {
    setEditingServiceId(id);
    setEditingServiceName(name);
  };

  const cancelEditing = () => {
    setEditingServiceId(null);
    setEditingServiceName('');
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* العنوان */}
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">إعدادات نظام الولاء</h1>
            <p className="text-muted-foreground">إدارة إعدادات برنامج ولاء العملاء</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* إعدادات الخصم */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                إعدادات الخصم
              </CardTitle>
              <CardDescription>
                تحديد عدد الزيارات المطلوبة ونسبة الخصم
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="requiredVisits">عدد الزيارات المطلوبة للخصم</Label>
                <Input
                  id="requiredVisits"
                  type="number"
                  min={1}
                  max={20}
                  value={requiredVisits}
                  onChange={(e) => setRequiredVisits(Number(e.target.value))}
                  className="text-center text-lg font-bold"
                />
                <p className="text-sm text-muted-foreground">
                  العميل يحصل على خصم بعد {requiredVisits} زيارات في الشهر
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountPercent">نسبة الخصم (%)</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min={1}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="text-center text-lg font-bold"
                />
                <p className="text-sm text-muted-foreground">
                  نسبة الخصم: {discountPercent}%
                </p>
              </div>

              <Button 
                onClick={handleSaveSettings} 
                className="w-full"
                disabled={updateSettingsMutation.isPending}
              >
                <Save className="h-4 w-4 ml-2" />
                {updateSettingsMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </Button>
            </CardContent>
          </Card>

          {/* ملخص النظام */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ملخص النظام
              </CardTitle>
              <CardDescription>
                معلومات عن نظام الولاء الحالي
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <h3 className="font-semibold mb-2">آلية عمل النظام:</h3>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• العميل يسجل عبر رمز QR</li>
                    <li>• كل زيارة تُسجل في النظام</li>
                    <li>• بعد {requiredVisits} زيارات في الشهر، يحصل على خصم {discountPercent}%</li>
                    <li>• يتم إرسال إشعار للمشرفين عند استحقاق الخصم</li>
                  </ul>
                </div>

                <div className="p-4 bg-green-500/10 rounded-lg">
                  <h3 className="font-semibold mb-2 text-green-600">مثال:</h3>
                  <p className="text-sm text-muted-foreground">
                    إذا زار العميل {requiredVisits - 1} مرات، في الزيارة رقم {requiredVisits} يحصل على خصم {discountPercent}% على الخدمة.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* أنواع الخدمات */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>أنواع الخدمات</CardTitle>
              <CardDescription>
                إدارة قائمة الخدمات المتاحة في نظام الولاء
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة خدمة
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">اسم الخدمة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceTypes?.map((service, index) => (
                  <TableRow key={service.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {editingServiceId === service.id ? (
                        <Input
                          value={editingServiceName}
                          onChange={(e) => setEditingServiceName(e.target.value)}
                          className="max-w-[200px]"
                        />
                      ) : (
                        service.name
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        service.isActive 
                          ? 'bg-green-500/20 text-green-600' 
                          : 'bg-red-500/20 text-red-600'
                      }`}>
                        {service.isActive ? 'نشط' : 'غير نشط'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {editingServiceId === service.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateService(service.id)}
                              disabled={updateServiceMutation.isPending}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(service.id, service.name)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => {
                                setServiceToDelete({ id: service.id, name: service.name });
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* حوار إضافة خدمة */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة خدمة جديدة</DialogTitle>
              <DialogDescription>
                أدخل اسم الخدمة الجديدة
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="newServiceName">اسم الخدمة</Label>
              <Input
                id="newServiceName"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="مثال: حلاقة شعر"
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleAddService}
                disabled={addServiceMutation.isPending}
              >
                {addServiceMutation.isPending ? 'جاري الإضافة...' : 'إضافة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* حوار تأكيد الحذف */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تأكيد الحذف</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من حذف الخدمة "{serviceToDelete?.name}"؟
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                إلغاء
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteService}
                disabled={deleteServiceMutation.isPending}
              >
                {deleteServiceMutation.isPending ? 'جاري الحذف...' : 'حذف'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* سجل التغييرات */}
        <AuditLogSection />
      </div>
    </DashboardLayout>
  );
}

// مكون سجل التغييرات
function AuditLogSection() {
  const { data: auditLog, isLoading } = trpc.loyalty.getAuditLog.useQuery({ limit: 20 });

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'settings': return 'تعديل الإعدادات';
      case 'service_add': return 'إضافة خدمة';
      case 'service_update': return 'تعديل خدمة';
      case 'service_delete': return 'حذف خدمة';
      default: return type;
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'settings': return 'bg-blue-500/20 text-blue-600';
      case 'service_add': return 'bg-green-500/20 text-green-600';
      case 'service_update': return 'bg-yellow-500/20 text-yellow-600';
      case 'service_delete': return 'bg-red-500/20 text-red-600';
      default: return 'bg-gray-500/20 text-gray-600';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          سجل التغييرات
        </CardTitle>
        <CardDescription>
          تتبع جميع التغييرات التي تمت على إعدادات الولاء
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            جاري التحميل...
          </div>
        ) : !auditLog || auditLog.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد تغييرات مسجلة بعد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {auditLog.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${getChangeTypeColor(log.changeType)}`}>
                      {getChangeTypeLabel(log.changeType)}
                    </span>
                    {log.serviceName && (
                      <span className="text-sm font-medium">{log.serviceName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {log.userName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </div>
                {log.description && (
                  <p className="text-sm text-muted-foreground">{log.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
