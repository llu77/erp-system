import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Clock, 
  Mail, 
  Play, 
  Pause, 
  Settings, 
  History, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Send,
  Bell,
  Shield,
  Package,
  DollarSign,
  FileText
} from 'lucide-react';

const TASK_TYPES = [
  { value: 'weekly_report', label: 'التقرير الأسبوعي', icon: FileText, description: 'تقرير شامل بالمبيعات والأداء' },
  { value: 'daily_stock_alert', label: 'تنبيه المخزون اليومي', icon: Package, description: 'تنبيه بالمنتجات منخفضة المخزون' },
  { value: 'monthly_profit_report', label: 'تقرير الأرباح الشهري', icon: DollarSign, description: 'تقرير الأرباح والخسائر الشهري' },
  { value: 'expiry_alert', label: 'تنبيه انتهاء الصلاحية', icon: AlertTriangle, description: 'تنبيه بالمنتجات قريبة الانتهاء' },
  { value: 'large_transaction_alert', label: 'تنبيه العمليات الكبيرة', icon: Shield, description: 'تنبيه بالعمليات المالية الكبيرة' },
];

const FREQUENCIES = [
  { value: 'hourly', label: 'كل ساعة' },
  { value: 'daily', label: 'يومياً' },
  { value: 'weekly', label: 'أسبوعياً' },
  { value: 'monthly', label: 'شهرياً' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

export default function SchedulerSettings() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    taskType: 'weekly_report',
    frequency: 'weekly',
    dayOfWeek: 0,
    dayOfMonth: 1,
    hour: 9,
    minute: 0,
    recipientEmails: 'info@symbolai.net',
    thresholdValue: '10000',
    isEnabled: true,
  });
  
  // Queries
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = trpc.scheduler.list.useQuery();
  const { data: executionLogs, isLoading: logsLoading, refetch: refetchLogs } = trpc.scheduler.getLogs.useQuery({ limit: 50 });
  const { data: alertStats } = trpc.scheduler.getAlertStats.useQuery();
  
  // Mutations
  const createTask = trpc.scheduler.create.useMutation({
    onSuccess: () => {
      toast({ title: 'تم إنشاء المهمة بنجاح' });
      setIsCreateDialogOpen(false);
      refetchTasks();
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });
  
  const updateTask = trpc.scheduler.update.useMutation({
    onSuccess: () => {
      toast({ title: 'تم تحديث المهمة بنجاح' });
      refetchTasks();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });
  
  const deleteTask = trpc.scheduler.delete.useMutation({
    onSuccess: () => {
      toast({ title: 'تم حذف المهمة بنجاح' });
      refetchTasks();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });
  
  const executeTask = trpc.scheduler.execute.useMutation({
    onSuccess: (result) => {
      toast({ 
        title: result.success ? 'تم التنفيذ بنجاح' : 'فشل التنفيذ',
        description: result.message,
        variant: result.success ? 'default' : 'destructive'
      });
      refetchTasks();
      refetchLogs();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });
  
  const runMonitor = trpc.scheduler.runMonitor.useMutation({
    onSuccess: (result) => {
      toast({ 
        title: 'تم تشغيل المراقبة',
        description: `تم العثور على ${result.totalAlerts} تنبيه`
      });
      refetchLogs();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });
  
  const resetForm = () => {
    setFormData({
      name: '',
      taskType: 'weekly_report',
      frequency: 'weekly',
      dayOfWeek: 0,
      dayOfMonth: 1,
      hour: 9,
      minute: 0,
      recipientEmails: 'info@symbolai.net',
      thresholdValue: '10000',
      isEnabled: true,
    });
    setSelectedTask(null);
  };
  
  const handleCreateTask = () => {
    if (!formData.name) {
      toast({ title: 'خطأ', description: 'يرجى إدخال اسم المهمة', variant: 'destructive' });
      return;
    }
    createTask.mutate(formData);
  };
  
  const handleToggleTask = (task: any) => {
    updateTask.mutate({ id: task.id, isEnabled: !task.isEnabled });
  };
  
  const handleExecuteTask = (taskId: number) => {
    executeTask.mutate({ taskId });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 ml-1" />نجاح</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 ml-1" />فشل</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/20 text-blue-400"><RefreshCw className="w-3 h-3 ml-1 animate-spin" />قيد التنفيذ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getTaskTypeInfo = (type: string) => {
    return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[0];
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مراقب النظام والجدولة</h1>
          <p className="text-muted-foreground">إدارة المهام المجدولة وتنبيهات النظام</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runMonitor.mutate()} disabled={runMonitor.isPending}>
            <Shield className="w-4 h-4 ml-2" />
            {runMonitor.isPending ? 'جاري الفحص...' : 'فحص النظام'}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة مهمة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>إنشاء مهمة مجدولة جديدة</DialogTitle>
                <DialogDescription>قم بتحديد نوع المهمة وإعدادات الجدولة</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم المهمة</Label>
                    <Input 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: التقرير الأسبوعي"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نوع المهمة</Label>
                    <Select value={formData.taskType} onValueChange={(v) => setFormData({ ...formData, taskType: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="w-4 h-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>التكرار</Label>
                    <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map(freq => (
                          <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label>يوم الأسبوع</Label>
                      <Select value={formData.dayOfWeek.toString()} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: parseInt(v) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(day => (
                            <SelectItem key={day.value} value={day.value.toString()}>{day.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {formData.frequency === 'monthly' && (
                    <div className="space-y-2">
                      <Label>يوم الشهر</Label>
                      <Input 
                        type="number"
                        min={1}
                        max={31}
                        value={formData.dayOfMonth}
                        onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>الوقت</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number"
                        min={0}
                        max={23}
                        value={formData.hour}
                        onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) })}
                        className="w-20"
                        placeholder="ساعة"
                      />
                      <span className="flex items-center">:</span>
                      <Input 
                        type="number"
                        min={0}
                        max={59}
                        value={formData.minute}
                        onChange={(e) => setFormData({ ...formData, minute: parseInt(e.target.value) })}
                        className="w-20"
                        placeholder="دقيقة"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>البريد الإلكتروني للمستلمين</Label>
                  <Input 
                    value={formData.recipientEmails}
                    onChange={(e) => setFormData({ ...formData, recipientEmails: e.target.value })}
                    placeholder="email1@example.com, email2@example.com"
                  />
                  <p className="text-xs text-muted-foreground">افصل بين عناوين البريد بفاصلة</p>
                </div>
                
                {(formData.taskType === 'large_transaction_alert') && (
                  <div className="space-y-2">
                    <Label>الحد الأدنى للتنبيه (ر.س)</Label>
                    <Input 
                      type="number"
                      value={formData.thresholdValue}
                      onChange={(e) => setFormData({ ...formData, thresholdValue: e.target.value })}
                      placeholder="10000"
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={formData.isEnabled}
                    onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
                  />
                  <Label>تفعيل المهمة</Label>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>إلغاء</Button>
                <Button onClick={handleCreateTask} disabled={createTask.isPending}>
                  {createTask.isPending ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">المهام النشطة</p>
                <p className="text-2xl font-bold">{tasks?.filter((t: any) => t.isEnabled).length || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تنبيهات غير مقروءة</p>
                <p className="text-2xl font-bold">{alertStats?.unread || 0}</p>
              </div>
              <Bell className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تنبيهات حرجة</p>
                <p className="text-2xl font-bold">{alertStats?.critical || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي التنفيذات</p>
                <p className="text-2xl font-bold">{executionLogs?.length || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">
            <Calendar className="w-4 h-4 ml-2" />
            المهام المجدولة
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="w-4 h-4 ml-2" />
            سجل التنفيذ
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 ml-2" />
            الإعدادات
          </TabsTrigger>
        </TabsList>
        
        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          {tasksLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : tasks?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد مهام مجدولة</p>
                <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء مهمة جديدة
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tasks?.map((task: any) => {
                const typeInfo = getTaskTypeInfo(task.taskType);
                return (
                  <Card key={task.id} className={!task.isEnabled ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${task.isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                            <typeInfo.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{task.name}</h3>
                            <p className="text-sm text-muted-foreground">{typeInfo.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {FREQUENCIES.find(f => f.value === task.frequency)?.label} - {task.hour}:{task.minute.toString().padStart(2, '0')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {task.recipientEmails?.split(',').length || 0} مستلم
                              </span>
                              {task.lastRunAt && (
                                <span className="flex items-center gap-1">
                                  آخر تشغيل: {new Date(task.lastRunAt).toLocaleDateString('ar-SA')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {task.lastRunStatus && getStatusBadge(task.lastRunStatus)}
                          <Switch 
                            checked={task.isEnabled}
                            onCheckedChange={() => handleToggleTask(task)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleExecuteTask(task.id)}
                            disabled={executeTask.isPending}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => deleteTask.mutate({ id: task.id })}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>سجل التنفيذ</CardTitle>
              <CardDescription>آخر 50 عملية تنفيذ</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8">جاري التحميل...</div>
              ) : executionLogs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد سجلات تنفيذ
                </div>
              ) : (
                <div className="space-y-2">
                  {executionLogs?.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        {getStatusBadge(log.status)}
                        <div>
                          <p className="font-medium">{log.taskName}</p>
                          <p className="text-sm text-muted-foreground">{log.message}</p>
                        </div>
                      </div>
                      <div className="text-left text-sm text-muted-foreground">
                        <p>{new Date(log.startedAt).toLocaleDateString('ar-SA')}</p>
                        <p>{new Date(log.startedAt).toLocaleTimeString('ar-SA')}</p>
                        {log.duration && <p>{log.duration} ثانية</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات المراقبة</CardTitle>
              <CardDescription>تخصيص حدود التنبيهات والإشعارات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    إعدادات المخزون
                  </h4>
                  <div className="space-y-2">
                    <Label>الحد الأدنى للتنبيه</Label>
                    <Input type="number" defaultValue={10} />
                    <p className="text-xs text-muted-foreground">تنبيه عندما تقل الكمية عن هذا الرقم</p>
                  </div>
                  <div className="space-y-2">
                    <Label>أيام التحذير قبل انتهاء الصلاحية</Label>
                    <Input type="number" defaultValue={30} />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    إعدادات العمليات المالية
                  </h4>
                  <div className="space-y-2">
                    <Label>حد العمليات الكبيرة (ر.س)</Label>
                    <Input type="number" defaultValue={10000} />
                    <p className="text-xs text-muted-foreground">تنبيه للعمليات التي تتجاوز هذا المبلغ</p>
                  </div>
                  <div className="space-y-2">
                    <Label>نسبة تغيير السعر للتنبيه (%)</Label>
                    <Input type="number" defaultValue={20} />
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-semibold flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4" />
                  إعدادات البريد الإلكتروني
                </h4>
                <div className="space-y-2">
                  <Label>البريد الافتراضي للإشعارات</Label>
                  <Input defaultValue="info@symbolai.net" />
                </div>
              </div>
              
              <Button className="w-full">
                <Settings className="w-4 h-4 ml-2" />
                حفظ الإعدادات
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
