import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';

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

export default function MonitoringDashboard() {
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

  // محاكاة جلب البيانات
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // محاكاة البيانات
        setStats({
          totalAlerts: 12,
          criticalAlerts: 2,
          warningAlerts: 5,
          infoAlerts: 5,
          anomaliesDetected: 3,
          matchingSuccess: 98.5,
          systemHealth: 95,
          lastUpdate: new Date(),
        });

        setAlerts([
          {
            id: '1',
            type: 'low_stock',
            severity: 'warning',
            title: 'مخزون منخفض',
            message: 'المنتج X لديه مخزون منخفض (5 وحدات)',
            timestamp: new Date(Date.now() - 2 * 60000),
            resolved: false,
          },
          {
            id: '2',
            type: 'large_transaction',
            severity: 'critical',
            title: 'عملية مالية كبيرة',
            message: 'فاتورة برقم 12345 بقيمة 50,000 ريال',
            timestamp: new Date(Date.now() - 5 * 60000),
            resolved: false,
          },
          {
            id: '3',
            type: 'expiring_product',
            severity: 'warning',
            title: 'منتج قريب الانتهاء',
            message: 'المنتج Y ينتهي في 7 أيام',
            timestamp: new Date(Date.now() - 15 * 60000),
            resolved: true,
          },
        ]);

        setReconciliation({
          totalRecords: 250,
          matchedRecords: 245,
          unmatchedRecords: 5,
          discrepancies: 1200,
          lastRun: new Date(Date.now() - 60 * 60000),
        });
      } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getHealthStatus = (health: number) => {
    if (health >= 90) return { label: 'ممتاز', color: 'text-green-600' };
    if (health >= 70) return { label: 'جيد', color: 'text-yellow-600' };
    return { label: 'متدهور', color: 'text-red-600' };
  };

  const healthStatus = getHealthStatus(stats.systemHealth);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* رأس الصفحة */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">لوحة مراقبة النظام</h1>
            <p className="text-gray-600 mt-1">مراقبة شاملة للتنبيهات والشذوذ والمطابقة</p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            تحديث
          </Button>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* إجمالي التنبيهات */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">إجمالي التنبيهات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAlerts}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.criticalAlerts} حرج، {stats.warningAlerts} تحذير
              </p>
            </CardContent>
          </Card>

          {/* التنبيهات الحرجة */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">التنبيهات الحرجة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</div>
              <p className="text-xs text-gray-500 mt-1">تحتاج إلى تدخل فوري</p>
            </CardContent>
          </Card>

          {/* الشذوذ المكتشف */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600">الشذوذ المكتشف</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.anomaliesDetected}</div>
              <p className="text-xs text-gray-500 mt-1">في آخر 24 ساعة</p>
            </CardContent>
          </Card>

          {/* صحة النظام */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">صحة النظام</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${healthStatus.color}`}>
                {stats.systemHealth}%
              </div>
              <p className="text-xs text-gray-500 mt-1">{healthStatus.label}</p>
            </CardContent>
          </Card>
        </div>

        {/* التبويبات */}
        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="alerts">التنبيهات ({alerts.length})</TabsTrigger>
            <TabsTrigger value="reconciliation">المطابقة</TabsTrigger>
            <TabsTrigger value="anomalies">الشذوذ</TabsTrigger>
          </TabsList>

          {/* تبويب التنبيهات */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>التنبيهات النشطة</CardTitle>
                <CardDescription>قائمة بجميع التنبيهات المرسلة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
                    <p>لا توجد تنبيهات نشطة</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(alert.severity)}
                          <div>
                            <h4 className="font-semibold">{alert.title}</h4>
                            <p className="text-sm mt-1">{alert.message}</p>
                            <p className="text-xs mt-2 opacity-75">
                              {alert.timestamp.toLocaleString('ar-SA')}
                            </p>
                          </div>
                        </div>
                        {alert.resolved && (
                          <Badge variant="outline" className="ml-2">
                            تم حله
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
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
                        width: `${(reconciliation.matchedRecords / reconciliation.totalRecords) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm mt-2 font-semibold">
                    {((reconciliation.matchedRecords / reconciliation.totalRecords) * 100).toFixed(1)}%
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  آخر تحديث: {reconciliation.lastRun.toLocaleString('ar-SA')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* تبويب الشذوذ */}
          <TabsContent value="anomalies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>الشذوذ المكتشف</CardTitle>
                <CardDescription>تحليل الشذوذ الإحصائي والآلي</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    تم اكتشاف {stats.anomaliesDetected} شذوذ في البيانات خلال آخر 24 ساعة
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">انحراف في الإيرادات</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          الإيرادات أقل من المتوسط بنسبة 35%
                        </p>
                      </div>
                      <Badge variant="destructive">حرج</Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">قيمة شاذة في المصاريف</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          مصروف بقيمة 15,000 ريال (أعلى من المتوسط بـ 250%)
                        </p>
                      </div>
                      <Badge variant="secondary">تحذير</Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">نمط غير عادي في الطلبات</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          عدد الطلبات أعلى من المتوسط بنسبة 45%
                        </p>
                      </div>
                      <Badge variant="secondary">معلومة</Badge>
                    </div>
                  </div>
                </div>
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
