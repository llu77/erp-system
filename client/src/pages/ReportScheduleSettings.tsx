/**
 * صفحة إعدادات جدولة التقارير الأسبوعية
 * تتيح للأدمن تفعيل/تعطيل التقارير التلقائية وتحديد يوم الإرسال
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Calendar, 
  Clock, 
  Mail, 
  Bell, 
  Settings, 
  CheckCircle2, 
  XCircle,
  Send,
  History,
  Brain,
  FileText,
  AlertTriangle
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: '0', label: 'الأحد' },
  { value: '1', label: 'الاثنين' },
  { value: '2', label: 'الثلاثاء' },
  { value: '3', label: 'الأربعاء' },
  { value: '4', label: 'الخميس' },
  { value: '5', label: 'الجمعة' },
  { value: '6', label: 'السبت' },
];

export default function ReportScheduleSettings() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [selectedDay, setSelectedDay] = useState('0'); // الأحد افتراضياً
  const [selectedHour, setSelectedHour] = useState('9'); // 9 صباحاً افتراضياً

  // جلب حالة الجدولة
  const { data: scheduleStatus, isLoading: statusLoading, refetch: refetchStatus } = 
    trpc.weeklyReports.getScheduleStatus.useQuery();

  // جلب سجل التقارير
  const { data: reportHistory, isLoading: historyLoading } = 
    trpc.weeklyReports.getReportLogs.useQuery({ limit: 10 });

  // تحديث إعدادات الجدولة
  const updateScheduleMutation = trpc.weeklyReports.toggleSchedule.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث إعدادات الجدولة بنجاح');
      refetchStatus();
    },
    onError: (error: any) => {
      toast.error(`فشل تحديث الإعدادات: ${error.message}`);
    },
  });

  // إرسال تقرير يدوي
  const sendManualReportMutation = trpc.weeklyReports.sendNow.useMutation({
    onSuccess: (result) => {
      if (result) {
        toast.success('تم إرسال التقرير بنجاح');
        refetchStatus();
      } else {
        toast.error('فشل إرسال التقرير');
      }
    },
    onError: (error: any) => {
      toast.error(`فشل إرسال التقرير: ${error.message}`);
    },
  });

  const handleSaveSettings = () => {
    updateScheduleMutation.mutate({
      enabled: isEnabled,
    });
  };

  const handleSendManualReport = () => {
    sendManualReportMutation.mutate();
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'غير متوفر';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container py-6 space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            إعدادات التقارير الأسبوعية
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة جدولة تقارير الذكاء الاصطناعي الأسبوعية
          </p>
        </div>
        <Button 
          onClick={handleSendManualReport}
          disabled={sendManualReportMutation.isPending}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {sendManualReportMutation.isPending ? 'جاري الإرسال...' : 'إرسال تقرير الآن'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* إعدادات الجدولة */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              إعدادات الجدولة
            </CardTitle>
            <CardDescription>
              حدد متى يتم إرسال تقرير الذكاء الاصطناعي الأسبوعي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* تفعيل/تعطيل */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">تفعيل التقارير التلقائية</p>
                  <p className="text-sm text-muted-foreground">
                    إرسال تقرير AI أسبوعي للمدير تلقائياً
                  </p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            <Separator />

            {/* اختيار اليوم */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  يوم الإرسال
                </label>
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر اليوم" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  وقت الإرسال
                </label>
                <Select value={selectedHour} onValueChange={setSelectedHour}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الوقت" />
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
            </div>

            {/* محتوى التقرير */}
            <div className="space-y-3">
              <p className="text-sm font-medium">محتوى التقرير الأسبوعي:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg">
                  <Brain className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">توصيات الذكاء الاصطناعي</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span className="text-sm">مؤشرات الأداء KPIs</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">تنبيهات المخاطر</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg">
                  <History className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">ملخص التدقيق</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveSettings}
              disabled={updateScheduleMutation.isPending}
              className="w-full"
            >
              {updateScheduleMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          </CardContent>
        </Card>

        {/* حالة الجدولة */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-500" />
              حالة الجدولة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusLoading ? (
              <div className="text-center py-4 text-muted-foreground">جاري التحميل...</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">الحالة</span>
                  <Badge variant={scheduleStatus?.isEnabled ? 'default' : 'secondary'}>
                    {scheduleStatus?.isEnabled ? (
                      <><CheckCircle2 className="h-3 w-3 ml-1" /> مفعّل</>
                    ) : (
                      <><XCircle className="h-3 w-3 ml-1" /> معطّل</>
                    )}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">آخر إرسال</span>
                    <span>{formatDate(scheduleStatus?.lastSentAt || null)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الإرسال القادم</span>
                    <span>{formatDate(scheduleStatus?.nextScheduledAt || null)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">إجمالي التقارير</span>
                    <span>{0}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* سجل التقارير */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-500" />
            سجل التقارير المرسلة
          </CardTitle>
          <CardDescription>
            آخر 10 تقارير تم إرسالها
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : reportHistory && reportHistory.length > 0 ? (
            <div className="space-y-3">
              {reportHistory.map((report: any, index: number) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      report.status === 'sent' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {report.status === 'sent' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        تقرير الأسبوع {report.weekNumber || index + 1}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(report.sentAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={report.status === 'sent' ? 'default' : 'destructive'}>
                    {report.status === 'sent' ? 'تم الإرسال' : 'فشل'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد تقارير مرسلة بعد</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
