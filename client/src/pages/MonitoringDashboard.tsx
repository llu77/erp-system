import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, RefreshCw, AlertCircle, Bell, Send, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/_core/hooks/useAuth';

interface MonitoringStats {
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  anomaliesDetected: number;
  matchingSuccess: number;
  systemHealth: number;
  lastUpdate: Date;
}

interface SystemAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface ReconciliationStatus {
  totalRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  discrepancies: number;
  lastRun: Date;
}

interface AnomalyData {
  id: string;
  type: 'revenue_deviation' | 'expense_anomaly' | 'pattern_anomaly';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  branchName: string;
  date: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  notificationSent?: boolean;
}

// مكون تبويب الشذوذ
function AnomaliesTab({ 
  stats, 
  branchId 
}: { 
  stats: MonitoringStats;
  branchId?: number;
}) {
  const [sendingNotification, setSendingNotification] = useState(false);
  const [sentNotifications, setSentNotifications] = useState<Set<string>>(new Set());
  
  // حساب الفترة الزمنية (آخر 30 يوم)
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, []);

  // جلب بيانات الشذوذ الحقيقية من API
  const { data: anomaliesData, isLoading, refetch } = trpc.bi.detectAnomalies.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    branchId: branchId,
    sendNotifications: false, // لا نرسل إشعارات تلقائياً عند الجلب
  }, {
    refetchInterval: 5 * 60 * 1000, // تحديث كل 5 دقائق
  });

  // تحويل بيانات API إلى تنسيق العرض
  const anomalies: AnomalyData[] = useMemo(() => {
    if (!anomaliesData || anomaliesData.length === 0) return [];
    
    return anomaliesData.map((anomaly, index) => {
      const deviationPercent = ((anomaly.value - anomaly.expectedValue) / anomaly.expectedValue) * 100;
      const isHigh = anomaly.value > anomaly.expectedValue;
      
      // تحديد نوع الشذوذ
      let type: 'revenue_deviation' | 'expense_anomaly' | 'pattern_anomaly' = 'revenue_deviation';
      if (anomaly.type === 'expense') {
        type = 'expense_anomaly';
      }
      
      // تحديد مستوى الخطورة
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (anomaly.severity === 'high') {
        severity = 'critical';
      } else if (anomaly.severity === 'medium') {
        severity = 'warning';
      }
      
      // تنسيق التاريخ
      const dateStr = anomaly.date instanceof Date 
        ? anomaly.date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date(anomaly.date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
      
      return {
        id: `anomaly-${index}-${anomaly.relatedEntity?.id || 'unknown'}`,
        type,
        severity,
        title: isHigh 
          ? (type === 'expense_anomaly' ? 'ارتفاع غير طبيعي في المصاريف' : 'ارتفاع غير طبيعي في الإيرادات')
          : (type === 'expense_anomaly' ? 'انخفاض غير طبيعي في المصاريف' : 'انخفاض غير طبيعي في الإيرادات'),
        description: anomaly.description,
        branchName: anomaly.relatedEntity?.name || 'غير محدد',
        date: dateStr,
        currentValue: Math.round(anomaly.value),
        expectedValue: Math.round(anomaly.expectedValue),
        deviationPercent: Math.round(deviationPercent * 10) / 10,
        notificationSent: sentNotifications.has(`anomaly-${index}-${anomaly.relatedEntity?.id || 'unknown'}`),
      };
    });
  }, [anomaliesData, sentNotifications]);

  const sendNotificationMutation = trpc.system.notifyOwner.useMutation();

  const handleSendNotification = async (anomalyId: string) => {
    const anomaly = anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return;

    setSendingNotification(true);
    try {
      const severityLabels = {
        info: 'معلومة',
        warning: 'تحذير',
        critical: 'حرج',
      };

      const content = `
🚨 **تنبيه شذوذ من لوحة المراقبة**

**النوع:** ${anomaly.title}
**الخطورة:** ${severityLabels[anomaly.severity]}
**الفرع:** ${anomaly.branchName}
**التاريخ:** ${anomaly.date}

**التفاصيل:**
${anomaly.description}

**القيمة الحالية:** ${anomaly.currentValue.toLocaleString('ar-SA')} ر.س
**القيمة المتوقعة:** ${anomaly.expectedValue.toLocaleString('ar-SA')} ر.س
**نسبة الانحراف:** ${anomaly.deviationPercent > 0 ? '+' : ''}${anomaly.deviationPercent}%
      `.trim();

      await sendNotificationMutation.mutateAsync({
        title: `🚨 ${severityLabels[anomaly.severity]} - ${anomaly.title} | ${anomaly.branchName}`,
        content,
      });

      // تحديث حالة الإشعار
      setSentNotifications(prev => new Set(prev).add(anomalyId));

      toast.success('تم إرسال الإشعار بنجاح', {
        description: `تم إرسال تنبيه بخصوص: ${anomaly.title}`,
      });
    } catch (error) {
      console.error('خطأ في إرسال الإشعار:', error);
      toast.error('فشل إرسال الإشعار', {
        description: 'حدث خطأ أثناء إرسال الإشعار. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setSendingNotification(false);
    }
  };

  const handleSendAllNotifications = async () => {
    const unsentAnomalies = anomalies.filter(a => !a.notificationSent && (a.severity === 'critical' || a.severity === 'warning'));
    
    if (unsentAnomalies.length === 0) {
      toast.info('لا توجد تنبيهات جديدة لإرسالها');
      return;
    }

    setSendingNotification(true);
    let sentCount = 0;

    for (const anomaly of unsentAnomalies) {
      try {
        await handleSendNotification(anomaly.id);
        sentCount++;
      } catch (error) {
        console.error(`خطأ في إرسال إشعار ${anomaly.id}:`, error);
      }
    }

    setSendingNotification(false);
    toast.success(`تم إرسال ${sentCount} إشعار`);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">حرج</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">تحذير</Badge>;
      default:
        return <Badge variant="outline">معلومة</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>الشذوذ المكتشف</CardTitle>
          <CardDescription>تحليل الشذوذ الإحصائي والآلي</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mr-2">جاري تحليل البيانات...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>الشذوذ المكتشف</CardTitle>
            <CardDescription>تحليل الشذوذ الإحصائي والآلي - آخر 30 يوم</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button 
              onClick={handleSendAllNotifications}
              disabled={sendingNotification || anomalies.every(a => a.notificationSent || a.severity === 'info')}
              size="sm"
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              إرسال جميع التنبيهات
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {anomalies.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              لم يتم اكتشاف أي شذوذ في البيانات خلال آخر 30 يوم. النظام يعمل بشكل طبيعي.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                تم اكتشاف {anomalies.length} شذوذ في البيانات خلال آخر 30 يوم
                {anomalies.filter(a => a.severity === 'critical').length > 0 && (
                  <span className="text-red-600 font-semibold mr-2">
                    ({anomalies.filter(a => a.severity === 'critical').length} حرج)
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {anomalies.map((anomaly) => (
                <div key={anomaly.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="font-semibold">{anomaly.title}</h4>
                        {getSeverityBadge(anomaly.severity)}
                        {anomaly.notificationSent && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            تم الإرسال
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{anomaly.description}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>🏢 {anomaly.branchName}</span>
                        <span>📅 {anomaly.date}</span>
                        <span>📊 القيمة: {anomaly.currentValue.toLocaleString('ar-SA')} ر.س</span>
                        <span>📈 المتوقع: {anomaly.expectedValue.toLocaleString('ar-SA')} ر.س</span>
                        <span className={anomaly.deviationPercent > 0 ? 'text-red-600' : 'text-green-600'}>
                          📉 الانحراف: {anomaly.deviationPercent > 0 ? '+' : ''}{anomaly.deviationPercent}%
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendNotification(anomaly.id)}
                      disabled={sendingNotification || anomaly.notificationSent}
                      className="shrink-0"
                    >
                      {anomaly.notificationSent ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                          تم الإرسال
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1" />
                          إرسال إشعار
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function MonitoringDashboard() {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(
    user?.branchId || undefined
  );
  
  const [stats, setStats] = useState<MonitoringStats>({
    totalAlerts: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    infoAlerts: 0,
    anomaliesDetected: 0,
    matchingSuccess: 0,
    systemHealth: 100,
    lastUpdate: new Date(),
  });

  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationStatus>({
    totalRecords: 0,
    matchedRecords: 0,
    unmatchedRecords: 0,
    discrepancies: 0,
    lastRun: new Date(),
  });

  const [loading, setLoading] = useState(true);

  // جلب قائمة الفروع
  const { data: branchesData } = trpc.branches.list.useQuery();

  // حساب الفترة الزمنية
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, []);

  // جلب بيانات الشذوذ لتحديث الإحصائيات
  const { data: anomaliesData } = trpc.bi.detectAnomalies.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    branchId: selectedBranchId,
    sendNotifications: false,
  });

  // تحديث الإحصائيات بناءً على بيانات الشذوذ
  useEffect(() => {
    if (anomaliesData) {
      const criticalCount = anomaliesData.filter(a => a.severity === 'high').length;
      const warningCount = anomaliesData.filter(a => a.severity === 'medium').length;
      const infoCount = anomaliesData.filter(a => a.severity === 'low').length;
      
      setStats(prev => ({
        ...prev,
        totalAlerts: anomaliesData.length,
        criticalAlerts: criticalCount,
        warningAlerts: warningCount,
        infoAlerts: infoCount,
        anomaliesDetected: anomaliesData.length,
        lastUpdate: new Date(),
      }));
    }
    setLoading(false);
  }, [anomaliesData]);

  // محاكاة بيانات المطابقة (يمكن ربطها بـ API لاحقاً)
  useEffect(() => {
    setReconciliation({
      totalRecords: 150,
      matchedRecords: 145,
      unmatchedRecords: 5,
      discrepancies: 3,
      lastRun: new Date(),
    });
  }, []);

  // محاكاة التنبيهات (يمكن ربطها بـ API لاحقاً)
  useEffect(() => {
    setAlerts([
      {
        id: '1',
        type: 'low_stock',
        severity: 'warning',
        title: 'مخزون منخفض',
        message: 'بعض المنتجات لديها مخزون منخفض',
        timestamp: new Date(),
        resolved: false,
      },
    ]);
  }, []);

  // حساب حالة صحة النظام
  const healthStatus = stats.systemHealth >= 90
    ? { label: 'ممتاز', color: 'text-green-600' }
    : stats.systemHealth >= 70
    ? { label: 'جيد', color: 'text-yellow-600' }
    : { label: 'يحتاج انتباه', color: 'text-red-600' };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">لوحة المراقبة</h1>
            <p className="text-gray-600">مراقبة النظام والتنبيهات والشذوذ</p>
          </div>
          
          {/* فلتر الفرع */}
          {user?.role === 'admin' && branchesData && branchesData.length > 0 && (
            <Select
              value={selectedBranchId?.toString() || 'all'}
              onValueChange={(value) => setSelectedBranchId(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branchesData.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.nameAr || branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">إجمالي التنبيهات</p>
                  <p className="text-2xl font-bold">{stats.totalAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">تنبيهات حرجة</p>
                  <p className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">تحذيرات</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.warningAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">صحة النظام</p>
                  <p className={`text-2xl font-bold ${healthStatus.color}`}>
                    {stats.systemHealth}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* التبويبات */}
        <Tabs defaultValue="anomalies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="anomalies">الشذوذ</TabsTrigger>
            <TabsTrigger value="alerts">التنبيهات</TabsTrigger>
            <TabsTrigger value="reconciliation">المطابقة</TabsTrigger>
          </TabsList>

          {/* تبويب الشذوذ */}
          <TabsContent value="anomalies" className="space-y-4">
            <AnomaliesTab stats={stats} branchId={selectedBranchId} />
          </TabsContent>

          {/* تبويب التنبيهات */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>التنبيهات الأخيرة</CardTitle>
                <CardDescription>آخر التنبيهات والإشعارات</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription>لا توجد تنبيهات نشطة</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border ${
                          alert.severity === 'critical'
                            ? 'bg-red-50 border-red-200'
                            : alert.severity === 'warning'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{alert.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {alert.timestamp.toLocaleString('ar-SA')}
                            </p>
                          </div>
                          {alert.resolved ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              تم الحل
                            </Badge>
                          ) : (
                            <Badge
                              variant={
                                alert.severity === 'critical'
                                  ? 'destructive'
                                  : alert.severity === 'warning'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {alert.severity === 'critical'
                                ? 'حرج'
                                : alert.severity === 'warning'
                                ? 'تحذير'
                                : 'معلومة'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* تبويب المطابقة */}
          <TabsContent value="reconciliation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>حالة المطابقة</CardTitle>
                <CardDescription>آخر نتائج مطابقة البيانات</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">إجمالي السجلات</p>
                    <p className="text-2xl font-bold mt-1">{reconciliation.totalRecords}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">السجلات المتطابقة</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {reconciliation.matchedRecords}
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">السجلات غير المتطابقة</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">
                      {reconciliation.unmatchedRecords}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">الانحرافات</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      {reconciliation.discrepancies.toLocaleString('ar-SA')}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">نسبة النجاح</p>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${reconciliation.totalRecords > 0 ? (reconciliation.matchedRecords / reconciliation.totalRecords) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm mt-2 font-semibold">
                    {reconciliation.totalRecords > 0 
                      ? ((reconciliation.matchedRecords / reconciliation.totalRecords) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  آخر تحديث: {reconciliation.lastRun.toLocaleString('ar-SA')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* معلومات النظام */}
        <Card>
          <CardHeader>
            <CardTitle>معلومات النظام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">آخر تحديث</p>
                <p className="font-semibold mt-1">
                  {stats.lastUpdate.toLocaleTimeString('ar-SA')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">نسبة المطابقة</p>
                <p className="font-semibold mt-1">{stats.matchingSuccess.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">التنبيهات المعالجة</p>
                <p className="font-semibold mt-1">
                  {alerts.filter(a => a.resolved).length} / {alerts.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">حالة النظام</p>
                <p className={`font-semibold mt-1 ${healthStatus.color}`}>
                  {healthStatus.label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
