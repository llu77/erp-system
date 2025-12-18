import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  Shield, 
  Eye, 
  Check, 
  Clock,
  User,
  DollarSign,
  Trash2,
  MapPin,
  Lock,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function SecurityAlerts() {
  const utils = trpc.useUtils();

  // جلب التنبيهات غير المقروءة
  const { data: unreadAlerts, isLoading: unreadLoading } = trpc.security.unreadAlerts.useQuery();

  // جلب جميع التنبيهات
  const { data: allAlerts, isLoading: allLoading, refetch } = trpc.security.allAlerts.useQuery({ limit: 100 });

  // جلب محاولات تسجيل الدخول
  const { data: loginAttempts, isLoading: loginLoading } = trpc.security.loginAttempts.useQuery({ limit: 50 });

  // جلب تغييرات الأسعار الكبيرة
  const { data: priceChanges, isLoading: priceLoading } = trpc.security.largePriceChanges.useQuery({ minPercentage: 20 });

  // تحديث حالة التنبيه
  const updateAlert = trpc.security.updateAlert.useMutation({
    onSuccess: () => {
      utils.security.unreadAlerts.invalidate();
      utils.security.allAlerts.invalidate();
    },
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'failed_login_attempts':
        return <Lock className="h-4 w-4" />;
      case 'price_change':
        return <DollarSign className="h-4 w-4" />;
      case 'bulk_delete':
        return <Trash2 className="h-4 w-4" />;
      case 'new_location':
        return <MapPin className="h-4 w-4" />;
      case 'large_transaction':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'حرج';
      case 'high':
        return 'عالي';
      case 'medium':
        return 'متوسط';
      case 'low':
        return 'منخفض';
      default:
        return severity;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'failed_login_attempts':
        return 'محاولات دخول فاشلة';
      case 'price_change':
        return 'تغيير سعر كبير';
      case 'bulk_delete':
        return 'حذف كميات كبيرة';
      case 'new_location':
        return 'موقع جديد';
      case 'large_transaction':
        return 'عملية مالية كبيرة';
      case 'unusual_activity':
        return 'نشاط غير معتاد';
      case 'low_stock':
        return 'مخزون منخفض';
      case 'expiring_products':
        return 'منتجات قريبة الانتهاء';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            تنبيهات الأمان
          </h1>
          <p className="text-muted-foreground">مراقبة الأنشطة المشبوهة والتنبيهات الأمنية</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      {/* ملخص التنبيهات */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تنبيهات غير مقروءة</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadAlerts?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تنبيهات حرجة</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {allAlerts?.filter(a => a.severity === 'critical' && !a.isResolved).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">محاولات دخول فاشلة</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loginAttempts?.filter(a => !a.success).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تغييرات أسعار كبيرة</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{priceChanges?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">التنبيهات</TabsTrigger>
          <TabsTrigger value="login">محاولات الدخول</TabsTrigger>
          <TabsTrigger value="prices">تغييرات الأسعار</TabsTrigger>
        </TabsList>

        {/* التنبيهات */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>جميع التنبيهات</CardTitle>
              <CardDescription>قائمة بجميع التنبيهات الأمنية</CardDescription>
            </CardHeader>
            <CardContent>
              {allLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : allAlerts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد تنبيهات أمنية</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allAlerts?.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${!alert.isRead ? 'bg-muted/50' : ''} ${alert.isResolved ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)} text-white`}>
                            {getAlertIcon(alert.alertType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{alert.title}</h4>
                              <Badge variant="outline" className="text-xs">
                                {getAlertTypeLabel(alert.alertType)}
                              </Badge>
                              <Badge className={getSeverityColor(alert.severity)}>
                                {getSeverityLabel(alert.severity)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {alert.userName && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {alert.userName}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(alert.createdAt), 'dd/MM/yyyy HH:mm', { locale: ar })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!alert.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateAlert.mutate({ id: alert.id, isRead: true })}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {!alert.isResolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateAlert.mutate({ id: alert.id, isResolved: true })}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* محاولات تسجيل الدخول */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>محاولات تسجيل الدخول</CardTitle>
              <CardDescription>سجل محاولات تسجيل الدخول الأخيرة</CardDescription>
            </CardHeader>
            <CardContent>
              {loginLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : loginAttempts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد محاولات دخول مسجلة</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2 px-3">اسم المستخدم</th>
                        <th className="text-right py-2 px-3">الحالة</th>
                        <th className="text-right py-2 px-3">عنوان IP</th>
                        <th className="text-right py-2 px-3">الموقع</th>
                        <th className="text-right py-2 px-3">التاريخ</th>
                        <th className="text-right py-2 px-3">السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginAttempts?.map((attempt) => (
                        <tr key={attempt.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3 font-medium">{attempt.username}</td>
                          <td className="py-2 px-3">
                            <Badge variant={attempt.success ? "default" : "destructive"}>
                              {attempt.success ? 'ناجح' : 'فاشل'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs">{attempt.ipAddress || '-'}</td>
                          <td className="py-2 px-3">{attempt.location || '-'}</td>
                          <td className="py-2 px-3">
                            {format(new Date(attempt.createdAt), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{attempt.failureReason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* تغييرات الأسعار */}
        <TabsContent value="prices">
          <Card>
            <CardHeader>
              <CardTitle>تغييرات الأسعار الكبيرة</CardTitle>
              <CardDescription>تغييرات الأسعار التي تتجاوز 20%</CardDescription>
            </CardHeader>
            <CardContent>
              {priceLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : priceChanges?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد تغييرات أسعار كبيرة</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2 px-3">المنتج</th>
                        <th className="text-right py-2 px-3">نوع السعر</th>
                        <th className="text-right py-2 px-3">السعر القديم</th>
                        <th className="text-right py-2 px-3">السعر الجديد</th>
                        <th className="text-right py-2 px-3">نسبة التغيير</th>
                        <th className="text-right py-2 px-3">بواسطة</th>
                        <th className="text-right py-2 px-3">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceChanges?.map((change) => (
                        <tr key={change.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3">
                            <div>
                              <div className="font-medium">{change.productName}</div>
                              {change.productSku && (
                                <div className="text-xs text-muted-foreground">{change.productSku}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {change.priceType === 'cost' ? 'التكلفة' : 'البيع'}
                          </td>
                          <td className="py-2 px-3">{parseFloat(change.oldPrice).toFixed(2)} ر.س</td>
                          <td className="py-2 px-3">{parseFloat(change.newPrice).toFixed(2)} ر.س</td>
                          <td className="py-2 px-3">
                            <Badge variant={parseFloat(change.changePercentage) > 0 ? "default" : "destructive"}>
                              {parseFloat(change.changePercentage) > 0 ? '+' : ''}{parseFloat(change.changePercentage).toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="py-2 px-3">{change.changedByName || '-'}</td>
                          <td className="py-2 px-3">
                            {format(new Date(change.createdAt), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
