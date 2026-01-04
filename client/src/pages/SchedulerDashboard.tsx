import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Calendar,
  Activity,
  Trash2,
  RotateCcw,
  Bell,
  Mail,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SchedulerDashboard() {
  const [activeTab, setActiveTab] = useState("jobs");
  
  // جلب البيانات
  const { data: schedulerStatus, refetch: refetchStatus } = trpc.system.getSchedulerStatus.useQuery();
  const { data: jobs, refetch: refetchJobs } = trpc.system.getScheduledJobs.useQuery();
  const { data: executions, refetch: refetchExecutions } = trpc.system.getJobExecutions.useQuery({ limit: 20 });
  const { data: schedulerDeadLetter, refetch: refetchSchedulerDead } = trpc.system.getSchedulerDeadLetter.useQuery();
  const { data: queueStats, refetch: refetchQueueStats } = trpc.system.getNotificationQueueStats.useQuery();
  const { data: notificationDeadLetter, refetch: refetchNotificationDead } = trpc.system.getDeadLetterNotifications.useQuery();
  
  // Mutations
  const startScheduler = trpc.system.startScheduler.useMutation({
    onSuccess: () => {
      toast.success("تم تشغيل نظام الجدولة");
      refetchStatus();
    },
  });
  
  const stopScheduler = trpc.system.stopScheduler.useMutation({
    onSuccess: () => {
      toast.success("تم إيقاف نظام الجدولة");
      refetchStatus();
    },
  });
  
  const toggleJob = trpc.system.toggleScheduledJob.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchJobs();
    },
  });
  
  const runJob = trpc.system.runScheduledJobManually.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("تم تشغيل المهمة بنجاح");
      } else {
        toast.error(data.error || "فشل تشغيل المهمة");
      }
      refetchJobs();
      refetchExecutions();
    },
  });
  
  const retrySchedulerDead = trpc.system.retrySchedulerDeadLetter.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchSchedulerDead();
      refetchJobs();
    },
  });
  
  const clearSchedulerDead = trpc.system.clearSchedulerDeadLetter.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchSchedulerDead();
    },
  });
  
  const startQueue = trpc.system.startNotificationQueue.useMutation({
    onSuccess: () => {
      toast.success("تم تشغيل Queue الإشعارات");
      refetchQueueStats();
    },
  });
  
  const stopQueue = trpc.system.stopNotificationQueue.useMutation({
    onSuccess: () => {
      toast.success("تم إيقاف Queue الإشعارات");
      refetchQueueStats();
    },
  });
  
  const retryNotification = trpc.system.retryFailedNotification.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchNotificationDead();
      refetchQueueStats();
    },
  });
  
  const retryAllNotifications = trpc.system.retryAllFailedNotifications.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchNotificationDead();
      refetchQueueStats();
    },
  });
  
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  
  const formatDuration = (start: Date | string, end?: Date | string) => {
    if (!end) return "جاري...";
    const duration = new Date(end).getTime() - new Date(start).getTime();
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };
  
  const refetchAll = () => {
    refetchStatus();
    refetchJobs();
    refetchExecutions();
    refetchSchedulerDead();
    refetchQueueStats();
    refetchNotificationDead();
    toast.success("تم تحديث البيانات");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">لوحة تحكم الجدولة والإشعارات</h1>
            <p className="text-muted-foreground">إدارة المهام المجدولة وQueue الإشعارات</p>
          </div>
          <Button variant="outline" onClick={refetchAll}>
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
        </div>
        
        {/* بطاقات الحالة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* حالة الجدولة */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                نظام الجدولة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant={schedulerStatus?.running ? "default" : "secondary"}>
                  {schedulerStatus?.running ? "يعمل" : "متوقف"}
                </Badge>
                <Button
                  size="sm"
                  variant={schedulerStatus?.running ? "destructive" : "default"}
                  onClick={() => schedulerStatus?.running ? stopScheduler.mutate() : startScheduler.mutate()}
                >
                  {schedulerStatus?.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {jobs?.filter(j => j.isActive).length || 0} مهمة نشطة
              </p>
            </CardContent>
          </Card>
          
          {/* Queue الإشعارات */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Queue الإشعارات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant={queueStats?.isRunning ? "default" : "secondary"}>
                  {queueStats?.isRunning ? "يعمل" : "متوقف"}
                </Badge>
                <Button
                  size="sm"
                  variant={queueStats?.isRunning ? "destructive" : "default"}
                  onClick={() => queueStats?.isRunning ? stopQueue.mutate() : startQueue.mutate()}
                >
                  {queueStats?.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {queueStats?.pending || 0} في الانتظار | {queueStats?.sent || 0} مُرسل
              </p>
            </CardContent>
          </Card>
          
          {/* المهام الفاشلة */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                المهام الفاشلة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(schedulerDeadLetter?.length || 0) + (notificationDeadLetter?.length || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {schedulerDeadLetter?.length || 0} جدولة | {notificationDeadLetter?.length || 0} إشعارات
              </p>
            </CardContent>
          </Card>
          
          {/* التنفيذات الأخيرة */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                التنفيذات الأخيرة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{executions?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                {executions?.filter(e => e.status === 'success').length || 0} ناجح | {executions?.filter(e => e.status === 'failed').length || 0} فاشل
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* التبويبات */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="jobs">المهام المجدولة</TabsTrigger>
            <TabsTrigger value="executions">سجل التنفيذات</TabsTrigger>
            <TabsTrigger value="notifications">Queue الإشعارات</TabsTrigger>
            <TabsTrigger value="deadletter">المهام الفاشلة</TabsTrigger>
          </TabsList>
          
          {/* المهام المجدولة */}
          <TabsContent value="jobs" className="space-y-4">
            {jobs?.map((job) => (
              <Card key={job.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{job.nameAr}</CardTitle>
                      <Badge variant={job.isActive ? "default" : "secondary"}>
                        {job.isActive ? "مفعّل" : "معطّل"}
                      </Badge>
                      {job.lastStatus && (
                        <Badge variant={job.lastStatus === 'success' ? "outline" : "destructive"}>
                          {job.lastStatus === 'success' ? (
                            <><CheckCircle2 className="h-3 w-3 ml-1" /> نجح</>
                          ) : (
                            <><XCircle className="h-3 w-3 ml-1" /> فشل</>
                          )}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={job.isActive}
                        onCheckedChange={(checked) => toggleJob.mutate({ jobId: job.id, isActive: checked })}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runJob.mutate({ jobId: job.id })}
                        disabled={runJob.isPending}
                      >
                        <Play className="h-4 w-4 ml-1" />
                        تشغيل يدوي
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{job.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Cron:</span>
                      <code className="mr-2 bg-muted px-2 py-1 rounded">{job.cronExpression}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">آخر تشغيل:</span>
                      <span className="mr-2">{formatDate(job.lastRun)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">التشغيل القادم:</span>
                      <span className="mr-2">{formatDate(job.nextRun)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الإحصائيات:</span>
                      <span className="mr-2">{job.runCount} تشغيل | {job.failCount} فشل</span>
                    </div>
                  </div>
                  {job.lastError && (
                    <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-sm">
                      <strong>آخر خطأ:</strong> {job.lastError}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          
          {/* سجل التنفيذات */}
          <TabsContent value="executions">
            <Card>
              <CardHeader>
                <CardTitle>سجل التنفيذات</CardTitle>
                <CardDescription>آخر 20 تنفيذ للمهام المجدولة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {executions?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">لا توجد تنفيذات بعد</p>
                  ) : (
                    executions?.map((exec) => (
                      <div
                        key={exec.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {exec.status === 'success' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : exec.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                          )}
                          <div>
                            <p className="font-medium">{exec.jobName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(exec.startTime)}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <Badge variant={
                            exec.status === 'success' ? 'outline' : 
                            exec.status === 'failed' ? 'destructive' : 'default'
                          }>
                            {exec.status === 'success' ? 'نجح' : exec.status === 'failed' ? 'فشل' : 'جاري'}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDuration(exec.startTime, exec.endTime)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Queue الإشعارات */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  إحصائيات Queue الإشعارات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-500">{queueStats?.pending || 0}</p>
                    <p className="text-sm text-muted-foreground">في الانتظار</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-500">{queueStats?.processing || 0}</p>
                    <p className="text-sm text-muted-foreground">قيد المعالجة</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-500">{queueStats?.sent || 0}</p>
                    <p className="text-sm text-muted-foreground">مُرسل</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-500">{queueStats?.failed || 0}</p>
                    <p className="text-sm text-muted-foreground">فاشل (إعادة)</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-red-500">{queueStats?.dead || 0}</p>
                    <p className="text-sm text-muted-foreground">Dead Letter</p>
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => retryAllNotifications.mutate()}
                    disabled={retryAllNotifications.isPending || (queueStats?.dead || 0) === 0}
                  >
                    <RotateCcw className="h-4 w-4 ml-2" />
                    إعادة محاولة الكل
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* المهام الفاشلة */}
          <TabsContent value="deadletter" className="space-y-4">
            {/* Dead Letter الجدولة */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>المهام المجدولة الفاشلة</CardTitle>
                    <CardDescription>المهام التي فشلت بعد عدة محاولات</CardDescription>
                  </div>
                  {(schedulerDeadLetter?.length || 0) > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => clearSchedulerDead.mutate()}
                    >
                      <Trash2 className="h-4 w-4 ml-2" />
                      مسح الكل
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {schedulerDeadLetter?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد مهام فاشلة</p>
                ) : (
                  <div className="space-y-2">
                    {schedulerDeadLetter?.map((dead) => (
                      <div
                        key={dead.id}
                        className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{dead.jobName}</p>
                          <p className="text-xs text-muted-foreground">
                            فشل في: {formatDate(dead.failedAt)} | المحاولات: {dead.retryCount}/{dead.maxRetries}
                          </p>
                          <p className="text-xs text-destructive mt-1">{dead.error}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retrySchedulerDead.mutate({ jobId: dead.jobId })}
                          disabled={dead.retryCount >= dead.maxRetries}
                        >
                          <RotateCcw className="h-4 w-4 ml-1" />
                          إعادة
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Dead Letter الإشعارات */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>الإشعارات الفاشلة</CardTitle>
                    <CardDescription>الإشعارات التي فشل إرسالها</CardDescription>
                  </div>
                  {(notificationDeadLetter?.length || 0) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryAllNotifications.mutate()}
                    >
                      <RotateCcw className="h-4 w-4 ml-2" />
                      إعادة محاولة الكل
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {notificationDeadLetter?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد إشعارات فاشلة</p>
                ) : (
                  <div className="space-y-2">
                    {notificationDeadLetter?.map((dead: any) => (
                      <div
                        key={dead.id}
                        className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{dead.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            إلى: {dead.recipient?.email} | المحاولات: {dead.attempts}/{dead.maxAttempts}
                          </p>
                          <p className="text-xs text-destructive mt-1">{dead.lastError}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryNotification.mutate({ id: dead.id })}
                        >
                          <RotateCcw className="h-4 w-4 ml-1" />
                          إعادة
                        </Button>
                      </div>
                    ))}
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
