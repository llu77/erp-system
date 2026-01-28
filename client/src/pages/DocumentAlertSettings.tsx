import { useState, useEffect } from 'react';
// DashboardLayout is already wrapped in App.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Bell, 
  Settings, 
  Mail, 
  MessageSquare, 
  Clock, 
  Calendar,
  Users,
  FileText,
  CreditCard,
  Heart,
  RefreshCw,
  Save,
  Play,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';

// أنواع الوثائق
const documentTypes = [
  { value: 'iqama', label: 'الإقامة', icon: CreditCard, color: 'bg-blue-500' },
  { value: 'health_cert', label: 'الشهادة الصحية', icon: Heart, color: 'bg-green-500' },
  { value: 'contract', label: 'عقد العمل', icon: FileText, color: 'bg-purple-500' },
] as const;

// الفترات الافتراضية
const defaultAlertDays = {
  iqama: [30, 15, 7],
  health_cert: [15, 7, 3],
  contract: [60, 30, 15],
};

export default function DocumentAlertSettings() {
  const [activeTab, setActiveTab] = useState('settings');
  const [selectedDocType, setSelectedDocType] = useState<'iqama' | 'health_cert' | 'contract'>('iqama');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<{
    isEnabled: boolean;
    alertDays: number[];
    sendEmail: boolean;
    sendSms: boolean;
    sendInApp: boolean;
    sendHour: number;
    notifyAdmin: boolean;
    notifyGeneralSupervisor: boolean;
    notifyBranchSupervisor: boolean;
    notifyEmployee: boolean;
    customMessage: string;
  }>({
    isEnabled: true,
    alertDays: [30, 15, 7],
    sendEmail: true,
    sendSms: false,
    sendInApp: true,
    sendHour: 8,
    notifyAdmin: true,
    notifyGeneralSupervisor: true,
    notifyBranchSupervisor: true,
    notifyEmployee: false,
    customMessage: '',
  });
  const [newAlertDay, setNewAlertDay] = useState('');

  // جلب الإعدادات
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = trpc.documentAlerts.getSettings.useQuery();
  
  // جلب السجلات
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = trpc.documentAlerts.getLogs.useQuery({
    page: 1,
    limit: 50,
  });

  // تحديث الإعدادات
  const updateSettingMutation = trpc.documentAlerts.updateSetting.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات بنجاح');
      refetchSettings();
      setEditMode(false);
    },
    onError: (error) => {
      toast.error(`فشل في حفظ الإعدادات: ${error.message}`);
    },
  });

  // تشغيل الفحص يدوياً
  const runManualCheckMutation = trpc.documentAlerts.runManualCheck.useMutation({
    onSuccess: (result) => {
      toast.success(`تم فحص الوثائق: ${result.iqamaReminders + result.healthCertReminders + result.contractReminders} تنبيه`);
      refetchLogs();
    },
    onError: (error) => {
      toast.error(`فشل في تشغيل الفحص: ${error.message}`);
    },
  });

  // إنشاء الإعدادات الافتراضية
  const initializeSettingsMutation = trpc.documentAlerts.initializeSettings.useMutation({
    onSuccess: () => {
      toast.success('تم إنشاء الإعدادات الافتراضية');
      refetchSettings();
    },
  });

  // تحديث النموذج عند تغيير نوع الوثيقة
  useEffect(() => {
    if (settings) {
      const setting = settings.find(s => s.documentType === selectedDocType);
      if (setting) {
        setFormData({
          isEnabled: setting.isEnabled,
          alertDays: Array.isArray(setting.alertDays) ? setting.alertDays : (typeof setting.alertDays === 'string' ? JSON.parse(setting.alertDays) : defaultAlertDays[selectedDocType]),
          sendEmail: setting.sendEmail,
          sendSms: setting.sendSms,
          sendInApp: setting.sendInApp,
          sendHour: setting.sendHour,
          notifyAdmin: setting.notifyAdmin,
          notifyGeneralSupervisor: setting.notifyGeneralSupervisor,
          notifyBranchSupervisor: setting.notifyBranchSupervisor,
          notifyEmployee: setting.notifyEmployee,
          customMessage: setting.customMessage || '',
        });
      } else {
        // إعدادات افتراضية
        setFormData({
          isEnabled: true,
          alertDays: defaultAlertDays[selectedDocType],
          sendEmail: true,
          sendSms: false,
          sendInApp: true,
          sendHour: 8,
          notifyAdmin: true,
          notifyGeneralSupervisor: true,
          notifyBranchSupervisor: true,
          notifyEmployee: false,
          customMessage: '',
        });
      }
    }
  }, [settings, selectedDocType]);

  // حفظ الإعدادات
  const handleSave = () => {
    updateSettingMutation.mutate({
      documentType: selectedDocType,
      ...formData,
      customMessage: formData.customMessage || null,
    });
  };

  // إضافة فترة تنبيه جديدة
  const addAlertDay = () => {
    const day = parseInt(newAlertDay);
    if (day > 0 && !formData.alertDays.includes(day)) {
      setFormData({
        ...formData,
        alertDays: [...formData.alertDays, day].sort((a, b) => b - a),
      });
      setNewAlertDay('');
    }
  };

  // حذف فترة تنبيه
  const removeAlertDay = (day: number) => {
    setFormData({
      ...formData,
      alertDays: formData.alertDays.filter(d => d !== day),
    });
  };

  // الحصول على معلومات نوع الوثيقة
  const getDocTypeInfo = (type: string) => {
    return documentTypes.find(d => d.value === type) || documentTypes[0];
  };

  return (
    <>
      <div className="p-6 space-y-6" dir="rtl">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-orange-500" />
              إعدادات التنبيهات التلقائية
            </h1>
            <p className="text-muted-foreground mt-1">
              إدارة تنبيهات انتهاء الوثائق والإشعارات الدورية
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => runManualCheckMutation.mutate()}
              disabled={runManualCheckMutation.isPending}
            >
              {runManualCheckMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Play className="h-4 w-4 ml-2" />
              )}
              تشغيل الفحص الآن
            </Button>
            {(!settings || settings.length === 0) && (
              <Button
                onClick={() => initializeSettingsMutation.mutate()}
                disabled={initializeSettingsMutation.isPending}
              >
                إنشاء الإعدادات الافتراضية
              </Button>
            )}
          </div>
        </div>

        {/* التبويبات */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              الإعدادات
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              سجل التنبيهات
            </TabsTrigger>
          </TabsList>

          {/* تبويب الإعدادات */}
          <TabsContent value="settings" className="space-y-6">
            {/* اختيار نوع الوثيقة */}
            <div className="grid grid-cols-3 gap-4">
              {documentTypes.map((docType) => {
                const Icon = docType.icon;
                const setting = settings?.find(s => s.documentType === docType.value);
                return (
                  <Card
                    key={docType.value}
                    className={`cursor-pointer transition-all ${
                      selectedDocType === docType.value
                        ? 'ring-2 ring-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedDocType(docType.value);
                      setEditMode(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${docType.color}`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{docType.label}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {setting?.isEnabled ? (
                              <Badge variant="default" className="bg-green-500">مفعل</Badge>
                            ) : (
                              <Badge variant="secondary">معطل</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {setting?.alertDays?.length || 0} فترات
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* إعدادات النوع المحدد */}
            {settingsLoading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">جاري تحميل الإعدادات...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {/* الإعدادات الأساسية */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      الإعدادات الأساسية
                    </CardTitle>
                    <CardDescription>
                      تفعيل التنبيهات وتحديد فترات الإرسال
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* تفعيل التنبيهات */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>تفعيل التنبيهات</Label>
                        <p className="text-sm text-muted-foreground">
                          إرسال تنبيهات تلقائية عند اقتراب انتهاء الوثيقة
                        </p>
                      </div>
                      <Switch
                        checked={formData.isEnabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                      />
                    </div>

                    {/* فترات التنبيه */}
                    <div className="space-y-3">
                      <Label>فترات التنبيه (بالأيام)</Label>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(formData.alertDays) ? formData.alertDays : []).map((day) => (
                          <Badge
                            key={day}
                            variant="secondary"
                            className="px-3 py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => removeAlertDay(day)}
                          >
                            {day} يوم
                            <XCircle className="h-3 w-3 mr-1" />
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="عدد الأيام"
                          value={newAlertDay}
                          onChange={(e) => setNewAlertDay(e.target.value)}
                          className="w-32"
                        />
                        <Button variant="outline" size="sm" onClick={addAlertDay}>
                          إضافة
                        </Button>
                      </div>
                    </div>

                    {/* وقت الإرسال */}
                    <div className="space-y-2">
                      <Label>وقت الإرسال اليومي</Label>
                      <Select
                        value={formData.sendHour.toString()}
                        onValueChange={(value) => setFormData({ ...formData, sendHour: parseInt(value) })}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* قنوات الإرسال والمستلمون */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      قنوات الإرسال والمستلمون
                    </CardTitle>
                    <CardDescription>
                      تحديد طريقة الإرسال والأشخاص المستلمين
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* قنوات الإرسال */}
                    <div className="space-y-3">
                      <Label>قنوات الإرسال</Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <span>البريد الإلكتروني</span>
                          </div>
                          <Switch
                            checked={formData.sendEmail}
                            onCheckedChange={(checked) => setFormData({ ...formData, sendEmail: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            <span>رسائل SMS</span>
                          </div>
                          <Switch
                            checked={formData.sendSms}
                            onCheckedChange={(checked) => setFormData({ ...formData, sendSms: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-orange-500" />
                            <span>إشعارات داخلية</span>
                          </div>
                          <Switch
                            checked={formData.sendInApp}
                            onCheckedChange={(checked) => setFormData({ ...formData, sendInApp: checked })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* المستلمون */}
                    <div className="space-y-3">
                      <Label>المستلمون</Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span>المدير العام</span>
                          <Switch
                            checked={formData.notifyAdmin}
                            onCheckedChange={(checked) => setFormData({ ...formData, notifyAdmin: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>المشرف العام</span>
                          <Switch
                            checked={formData.notifyGeneralSupervisor}
                            onCheckedChange={(checked) => setFormData({ ...formData, notifyGeneralSupervisor: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>مشرف الفرع</span>
                          <Switch
                            checked={formData.notifyBranchSupervisor}
                            onCheckedChange={(checked) => setFormData({ ...formData, notifyBranchSupervisor: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>الموظف نفسه</span>
                          <Switch
                            checked={formData.notifyEmployee}
                            onCheckedChange={(checked) => setFormData({ ...formData, notifyEmployee: checked })}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* رسالة مخصصة */}
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      رسالة مخصصة (اختياري)
                    </CardTitle>
                    <CardDescription>
                      إضافة رسالة مخصصة تظهر في التنبيهات
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="أدخل رسالة مخصصة تظهر في التنبيهات..."
                      value={formData.customMessage}
                      onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* زر الحفظ */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateSettingMutation.isPending}
                className="min-w-32"
              >
                {updateSettingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
                )}
                حفظ الإعدادات
              </Button>
            </div>
          </TabsContent>

          {/* تبويب السجلات */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      سجل التنبيهات المرسلة
                    </CardTitle>
                    <CardDescription>
                      عرض جميع التنبيهات التي تم إرسالها
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                    <RefreshCw className="h-4 w-4 ml-2" />
                    تحديث
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">جاري تحميل السجلات...</p>
                  </div>
                ) : logsData?.logs && logsData.logs.length > 0 ? (
                  <div className="space-y-3">
                    {logsData.logs.map((log) => {
                      const docTypeInfo = getDocTypeInfo(log.documentType);
                      const Icon = docTypeInfo.icon;
                      return (
                        <div
                          key={log.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                        >
                          <div className={`p-2 rounded-lg ${docTypeInfo.color}`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.employeeName}</span>
                              <Badge variant="outline">{log.employeeCode}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {docTypeInfo.label} - {log.daysRemaining} يوم متبقي
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              {log.status === 'sent' ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : log.status === 'failed' ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              )}
                              <Badge
                                variant={
                                  log.status === 'sent'
                                    ? 'default'
                                    : log.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {log.status === 'sent' ? 'مرسل' : log.status === 'failed' ? 'فشل' : 'معلق'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(log.createdAt).toLocaleDateString('ar-SA', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد تنبيهات مرسلة حتى الآن</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
