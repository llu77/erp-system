import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  Play, 
  Pause, 
  RefreshCw, 
  Settings, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Mail,
  Zap,
  History
} from "lucide-react";

export default function AIMonitorSettings() {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  // Queries
  const { data: config, refetch: refetchConfig } = trpc.aiMonitor.getConfig.useQuery();
  const { data: stats, refetch: refetchStats } = trpc.aiMonitor.getStats.useQuery();
  const { data: isActive, refetch: refetchActive } = trpc.aiMonitor.isActive.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.aiMonitor.getHistory.useQuery({ limit: 10 });

  // Mutations
  const startMutation = trpc.aiMonitor.start.useMutation({
    onSuccess: () => {
      toast({ title: "تم بدء المراقبة", description: "تم تفعيل المراقبة التلقائية بنجاح" });
      refetchActive();
      refetchStats();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const stopMutation = trpc.aiMonitor.stop.useMutation({
    onSuccess: () => {
      toast({ title: "تم إيقاف المراقبة", description: "تم إيقاف المراقبة التلقائية" });
      refetchActive();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const runCycleMutation = trpc.aiMonitor.runCycle.useMutation({
    onSuccess: (result) => {
      toast({ 
        title: "تم تشغيل دورة المراقبة", 
        description: `تم فحص ${result.recommendationsChecked} توصية وإرسال ${result.alertsSent} تنبيه` 
      });
      refetchStats();
      refetchHistory();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateConfigMutation = trpc.aiMonitor.updateConfig.useMutation({
    onSuccess: () => {
      toast({ title: "تم التحديث", description: "تم تحديث إعدادات المراقبة بنجاح" });
      refetchConfig();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const sendDailySummaryMutation = trpc.aiNotifications.sendDailySummary.useMutation({
    onSuccess: (result) => {
      toast({ 
        title: "تم الإرسال", 
        description: `تم إرسال الملخص اليومي إلى ${result.recipientCount} مستلم` 
      });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleConfigUpdate = async (updates: Record<string, any>) => {
    setIsUpdating(true);
    try {
      await updateConfigMutation.mutateAsync(updates);
    } finally {
      setIsUpdating(false);
    }
  };

  const priorityLabels = {
    low: "منخفض",
    medium: "متوسط",
    high: "مرتفع",
    critical: "حرج",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              إعدادات المراقبة الذكية
            </h1>
            <p className="text-muted-foreground mt-1">
              إدارة نظام المراقبة التلقائية والتنبيهات الذكية
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isActive?.active ? "default" : "secondary"} className="px-3 py-1">
              {isActive?.active ? (
                <>
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                  نشط
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  متوقف
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الدورات</p>
                  <p className="text-2xl font-bold">{stats?.totalCycles || 0}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">التنبيهات المرسلة</p>
                  <p className="text-2xl font-bold">{stats?.totalAlerts || 0}</p>
                </div>
                <Bell className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">متوسط المدة</p>
                  <p className="text-2xl font-bold">{Math.round(stats?.averageDuration || 0)}ms</p>
                </div>
                <Clock className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">نسبة الأخطاء</p>
                  <p className="text-2xl font-bold">{(stats?.errorRate || 0).toFixed(1)}%</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="control" className="space-y-4">
          <TabsList>
            <TabsTrigger value="control">التحكم</TabsTrigger>
            <TabsTrigger value="settings">الإعدادات</TabsTrigger>
            <TabsTrigger value="history">السجل</TabsTrigger>
          </TabsList>

          {/* Control Tab */}
          <TabsContent value="control" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monitor Control */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    التحكم بالمراقبة
                  </CardTitle>
                  <CardDescription>
                    بدء أو إيقاف المراقبة التلقائية للتوصيات
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {isActive?.active ? (
                      <Button 
                        variant="destructive" 
                        onClick={() => stopMutation.mutate()}
                        disabled={stopMutation.isPending}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        إيقاف المراقبة
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => startMutation.mutate({})}
                        disabled={startMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        بدء المراقبة
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline"
                      onClick={() => runCycleMutation.mutate()}
                      disabled={runCycleMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${runCycleMutation.isPending ? 'animate-spin' : ''}`} />
                      تشغيل دورة يدوية
                    </Button>
                  </div>
                  
                  {stats?.lastCycleAt && (
                    <p className="text-sm text-muted-foreground">
                      آخر دورة: {new Date(stats.lastCycleAt).toLocaleString('ar-SA')}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Daily Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    الملخص اليومي
                  </CardTitle>
                  <CardDescription>
                    إرسال ملخص التوصيات للمدراء
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={() => sendDailySummaryMutation.mutate()}
                    disabled={sendDailySummaryMutation.isPending}
                    className="w-full"
                  >
                    <Mail className={`h-4 w-4 mr-2 ${sendDailySummaryMutation.isPending ? 'animate-pulse' : ''}`} />
                    إرسال الملخص اليومي الآن
                  </Button>
                  
                  <p className="text-sm text-muted-foreground">
                    سيتم إرسال ملخص شامل بجميع التوصيات الذكية إلى المدراء عبر البريد الإلكتروني
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  إعدادات المراقبة
                </CardTitle>
                <CardDescription>
                  تخصيص سلوك نظام المراقبة والتنبيهات
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>تفعيل المراقبة التلقائية</Label>
                    <p className="text-sm text-muted-foreground">
                      تشغيل المراقبة الدورية تلقائياً
                    </p>
                  </div>
                  <Switch
                    checked={config?.enabled}
                    onCheckedChange={(checked) => handleConfigUpdate({ enabled: checked })}
                    disabled={isUpdating}
                  />
                </div>

                {/* Interval */}
                <div className="space-y-2">
                  <Label>فترة المراقبة (بالدقائق)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={1440}
                      value={config?.intervalMinutes || 30}
                      onChange={(e) => handleConfigUpdate({ intervalMinutes: parseInt(e.target.value) })}
                      className="w-32"
                      disabled={isUpdating}
                    />
                    <span className="text-sm text-muted-foreground">دقيقة</span>
                  </div>
                </div>

                {/* Priority Threshold */}
                <div className="space-y-2">
                  <Label>عتبة الأولوية للتنبيهات</Label>
                  <Select
                    value={config?.priorityThreshold}
                    onValueChange={(value) => handleConfigUpdate({ priorityThreshold: value })}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفض (جميع التوصيات)</SelectItem>
                      <SelectItem value="medium">متوسط</SelectItem>
                      <SelectItem value="high">مرتفع</SelectItem>
                      <SelectItem value="critical">حرج فقط</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    سيتم إرسال تنبيهات فقط للتوصيات بهذه الأولوية أو أعلى
                  </p>
                </div>

                {/* Max Alerts */}
                <div className="space-y-2">
                  <Label>الحد الأقصى للتنبيهات في كل دورة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={config?.maxAlertsPerCycle || 5}
                    onChange={(e) => handleConfigUpdate({ maxAlertsPerCycle: parseInt(e.target.value) })}
                    className="w-32"
                    disabled={isUpdating}
                  />
                </div>

                {/* Quiet Hours */}
                <div className="space-y-2">
                  <Label>ساعات الهدوء</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">من</span>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={config?.quietHoursStart ?? 22}
                        onChange={(e) => handleConfigUpdate({ quietHoursStart: parseInt(e.target.value) })}
                        className="w-20"
                        disabled={isUpdating}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">إلى</span>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={config?.quietHoursEnd ?? 7}
                        onChange={(e) => handleConfigUpdate({ quietHoursEnd: parseInt(e.target.value) })}
                        className="w-20"
                        disabled={isUpdating}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    لن يتم إرسال تنبيهات خلال هذه الفترة
                  </p>
                </div>

                {/* Daily Summary Hour */}
                <div className="space-y-2">
                  <Label>ساعة إرسال الملخص اليومي</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={config?.dailySummaryHour || 8}
                    onChange={(e) => handleConfigUpdate({ dailySummaryHour: parseInt(e.target.value) })}
                    className="w-20"
                    disabled={isUpdating}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  سجل دورات المراقبة
                </CardTitle>
                <CardDescription>
                  آخر 10 دورات مراقبة تم تنفيذها
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history && history.length > 0 ? (
                  <div className="space-y-3">
                    {history.map((cycle: any, index: number) => (
                      <div 
                        key={cycle.cycleId || index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          {cycle.errors && cycle.errors.length > 0 ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          <div>
                            <p className="font-medium">
                              {new Date(cycle.timestamp).toLocaleString('ar-SA')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              فحص {cycle.recommendationsChecked} توصية
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">
                            <Bell className="h-3 w-3 mr-1" />
                            {cycle.alertsSent} تنبيه
                          </Badge>
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            {cycle.duration}ms
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد دورات مراقبة مسجلة بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
