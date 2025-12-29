import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  Trash2,
  Send,
  Loader2,
  ClipboardList,
  Users,
  Building2,
  Calendar,
  Upload,
  X,
  Paperclip,
  AlertCircle,
  Download
} from 'lucide-react';

export default function TaskManagement() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    details: '',
    requirement: '',
    responseType: 'file_upload' as 'file_upload' | 'confirmation' | 'text_response' | 'multiple_files',
    confirmationYesText: '',
    confirmationNoText: '',
    branchId: undefined as number | undefined,
    assignedToId: undefined as number | undefined,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    dueDate: '',
    attachments: [] as string[], // مرفقات عند إنشاء المهمة
  });

  // Queries
  const { data: tasks, isLoading, refetch } = trpc.tasks.getAll.useQuery(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  );
  const { data: stats } = trpc.tasks.getStats.useQuery();
  const { data: overdueTasks, isLoading: loadingOverdue } = trpc.tasks.getOverdue.useQuery();
  const { data: employees } = trpc.employees.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();

  // Mutations
  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء المهمة بنجاح - الرقم المرجعي: ${data.referenceNumber}`);
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء إنشاء المهمة');
    },
  });

  const updateStatusMutation = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث حالة المهمة');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء تحديث الحالة');
    },
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success('تم حذف المهمة');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء حذف المهمة');
    },
  });

  const uploadMutation = trpc.tasks.uploadAttachment.useMutation();

  const resetForm = () => {
    setFormData({
      subject: '',
      details: '',
      requirement: '',
      responseType: 'file_upload',
      confirmationYesText: '',
      confirmationNoText: '',
      branchId: undefined,
      assignedToId: undefined,
      priority: 'medium',
      dueDate: '',
      attachments: [],
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    const newAttachments: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // التحقق من حجم الملف (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`الملف ${file.name} كبير جداً (الحد الأقصى 10MB)`);
          continue;
        }

        // تحويل الملف إلى base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // رفع الملف
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          fileType: file.type,
        });

        if (result.url) {
          newAttachments.push(result.url);
        }
      }

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
      }));

      if (newAttachments.length > 0) {
        toast.success(`تم رفع ${newAttachments.length} ملف بنجاح`);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء رفع الملفات');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleCreateTask = () => {
    if (!formData.subject || !formData.requirement || !formData.assignedToId) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const employee = employees?.find((e: any) => e.id === formData.assignedToId);
    const branch = branches?.find((b: any) => b.id === formData.branchId);

    createMutation.mutate({
      subject: formData.subject,
      details: formData.details || undefined,
      requirement: formData.requirement,
      responseType: formData.responseType,
      confirmationYesText: formData.confirmationYesText || undefined,
      confirmationNoText: formData.confirmationNoText || undefined,
      branchId: formData.branchId,
      branchName: branch?.name,
      assignedToId: formData.assignedToId,
      assignedToName: employee?.name || '',
      assignedToEmail: employee?.email || undefined,
      priority: formData.priority,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      attachments: formData.attachments.length > 0 ? formData.attachments : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 ml-1" /> في انتظار الرد</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Loader2 className="w-3 h-3 ml-1" /> تحت المعالجة</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 ml-1" /> مكتملة</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 ml-1" /> ملغاة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 ml-1" /> عاجل</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">مرتفع</Badge>;
      case 'medium':
        return <Badge className="bg-blue-500">متوسط</Badge>;
      case 'low':
        return <Badge variant="secondary">منخفض</Badge>;
      default:
        return null;
    }
  };

  const filteredTasks = tasks?.filter(task => 
    task.subject.includes(searchTerm) || 
    task.referenceNumber.includes(searchTerm) ||
    task.assignedToName.includes(searchTerm)
  );

  const getFileExtension = (url: string) => {
    const parts = url.split('.');
    return parts[parts.length - 1].toLowerCase();
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header - محسن للموبايل */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" />
            إدارة المهام
          </h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">إنشاء وإدارة المهام المرسلة للموظفين</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 ml-2" />
              مهمة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إنشاء مهمة جديدة</DialogTitle>
              <DialogDescription>أدخل تفاصيل المهمة المطلوب إرسالها للموظف</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select
                    value={formData.branchId?.toString() || ''}
                    onValueChange={(value) => setFormData({ ...formData, branchId: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map((branch: any) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الموظف *</Label>
                  <Select
                    value={formData.assignedToId?.toString() || ''}
                    onValueChange={(value) => setFormData({ ...formData, assignedToId: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الموظف" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.filter((e: any) => !formData.branchId || e.branchId === formData.branchId).map((employee: any) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>موضوع المهمة *</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="مثال: رفع صورة الموازنة"
                />
              </div>

              <div className="space-y-2">
                <Label>التفاصيل</Label>
                <Textarea
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="تفاصيل إضافية عن المهمة..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>المطلوب من الموظف *</Label>
                <Textarea
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  placeholder="مثال: برجاء رفع صورة من الموازنة المرفوعة مسبقاً بتاريخ 2025/12/10"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نوع الاستجابة *</Label>
                  <Select
                    value={formData.responseType}
                    onValueChange={(value: any) => setFormData({ ...formData, responseType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="file_upload">رفع ملف واحد</SelectItem>
                      <SelectItem value="multiple_files">رفع عدة ملفات</SelectItem>
                      <SelectItem value="confirmation">تأكيد (نعم/لا)</SelectItem>
                      <SelectItem value="text_response">رد نصي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الأولوية</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">مرتفعة</SelectItem>
                      <SelectItem value="urgent">عاجلة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.responseType === 'confirmation' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نص زر "نعم"</Label>
                    <Input
                      value={formData.confirmationYesText}
                      onChange={(e) => setFormData({ ...formData, confirmationYesText: e.target.value })}
                      placeholder="نعم، قمت بذلك"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نص زر "لا"</Label>
                    <Input
                      value={formData.confirmationNoText}
                      onChange={(e) => setFormData({ ...formData, confirmationNoText: e.target.value })}
                      placeholder="لا، لم أقم بذلك حتى الآن"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              {/* قسم إرفاق الملفات */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  إرفاق ملفات (اختياري)
                </Label>
                <p className="text-xs text-slate-400">يمكنك إرفاق نماذج أو مستندات مع المهمة</p>
                
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-slate-500 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles}
                  >
                    {uploadingFiles ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري الرفع...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 ml-2" />
                        اختر ملفات
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">
                    PDF, Word, Excel, صور (الحد الأقصى 10MB لكل ملف)
                  </p>
                </div>

                {/* عرض الملفات المرفقة */}
                {formData.attachments.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-sm text-slate-400">الملفات المرفقة ({formData.attachments.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.attachments.map((url, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 text-sm"
                        >
                          <Paperclip className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300 max-w-[150px] truncate">
                            {getFileName(url)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-500/20"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleCreateTask} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  ) : (
                    <Send className="w-4 h-4 ml-2" />
                  )}
                  إرسال المهمة
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards - محسن للموبايل */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm">إجمالي المهام</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{stats?.total || 0}</p>
              </div>
              <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500 hidden sm:block" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm">في انتظار الرد</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-500">{stats?.pending || 0}</p>
              </div>
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500/50 hidden sm:block" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm">تحت المعالجة</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-500">{stats?.inProgress || 0}</p>
              </div>
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500/50 hidden sm:block" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm">مكتملة</p>
                <p className="text-xl sm:text-2xl font-bold text-green-500">{stats?.completed || 0}</p>
              </div>
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500/50 hidden sm:block" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700 border-red-500/30 col-span-2 sm:col-span-1">
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm">متأخرة</p>
                <p className="text-xl sm:text-2xl font-bold text-red-500">{overdueTasks?.length || 0}</p>
              </div>
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs - محسن للموبايل */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50 border border-slate-700 w-full sm:w-auto">
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-700 flex-1 sm:flex-none text-sm">
            جميع المهام
          </TabsTrigger>
          <TabsTrigger value="overdue" className="data-[state=active]:bg-red-600/20 data-[state=active]:text-red-400 flex-1 sm:flex-none text-sm">
            <AlertCircle className="w-4 h-4 ml-1" />
            المتأخرة ({overdueTasks?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          {/* Filters - محسن للموبايل */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      placeholder="بحث..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10 text-sm"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="pending">في انتظار الرد</SelectItem>
                    <SelectItem value="in_progress">تحت المعالجة</SelectItem>
                    <SelectItem value="completed">مكتملة</SelectItem>
                    <SelectItem value="cancelled">ملغاة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tasks - عرض بطاقات للموبايل وجدول للشاشات الكبيرة */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 sm:pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                </div>
              ) : filteredTasks?.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد مهام</p>
                </div>
              ) : (
                <>
                  {/* عرض بطاقات للموبايل */}
                  <div className="block sm:hidden space-y-3">
                    {filteredTasks?.map((task: any) => (
                      <div key={task.id} className="bg-slate-700/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-mono text-blue-400 text-sm">{task.referenceNumber}</p>
                            <p className="text-white font-medium mt-1 line-clamp-2">{task.subject}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedTask(task);
                                setIsViewDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-400"
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                    deleteMutation.mutate({ taskId: task.id });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {getStatusBadge(task.status)}
                          {getPriorityBadge(task.priority)}
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span>{task.assignedToName}</span>
                          <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* جدول للشاشات الكبيرة */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-400">الرقم المرجعي</TableHead>
                          <TableHead className="text-slate-400">الموضوع</TableHead>
                          <TableHead className="text-slate-400">الموظف</TableHead>
                          <TableHead className="text-slate-400">الفرع</TableHead>
                          <TableHead className="text-slate-400">الحالة</TableHead>
                          <TableHead className="text-slate-400">الأولوية</TableHead>
                          <TableHead className="text-slate-400">تاريخ الاستحقاق</TableHead>
                          <TableHead className="text-slate-400">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTasks?.map((task: any) => (
                          <TableRow key={task.id} className="border-slate-700">
                            <TableCell className="font-mono text-blue-400">{task.referenceNumber}</TableCell>
                            <TableCell className="text-white max-w-[200px] truncate">{task.subject}</TableCell>
                            <TableCell className="text-slate-300">{task.assignedToName}</TableCell>
                            <TableCell className="text-slate-300">{task.branchName || '-'}</TableCell>
                            <TableCell>{getStatusBadge(task.status)}</TableCell>
                            <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                            <TableCell className="text-slate-300">
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setIsViewDialogOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {user?.role === 'admin' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300"
                                    onClick={() => {
                                      if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                        deleteMutation.mutate({ taskId: task.id });
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          {/* Overdue Tasks - محسن للموبايل */}
          <Card className="bg-slate-800/50 border-slate-700 border-red-500/30">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-red-400 flex items-center gap-2 text-lg sm:text-xl">
                <AlertCircle className="w-5 h-5" />
                المهام المتأخرة
              </CardTitle>
              <CardDescription className="text-sm">
                المهام التي تجاوزت تاريخ الاستحقاق ولم تكتمل بعد
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {loadingOverdue ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                </div>
              ) : overdueTasks?.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500/50" />
                  <p className="text-green-400">لا توجد مهام متأخرة</p>
                </div>
              ) : (
                <>
                  {/* عرض بطاقات للموبايل */}
                  <div className="block sm:hidden space-y-3">
                    {overdueTasks?.map((task: any) => (
                      <div key={task.id} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-mono text-red-400 text-sm">{task.referenceNumber}</p>
                            <p className="text-white font-medium mt-1 line-clamp-2">{task.subject}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              const fullTask = tasks?.find((t: any) => t.id === task.id);
                              setSelectedTask(fullTask || task);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="destructive" className="font-bold">
                            متأخر {task.daysOverdue} يوم
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span>{task.assignedToName || task.employeeName}</span>
                          <span className="text-red-400">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* جدول للشاشات الكبيرة */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-400">الرقم المرجعي</TableHead>
                          <TableHead className="text-slate-400">الموضوع</TableHead>
                          <TableHead className="text-slate-400">الموظف</TableHead>
                          <TableHead className="text-slate-400">الفرع</TableHead>
                          <TableHead className="text-slate-400">تاريخ الاستحقاق</TableHead>
                          <TableHead className="text-slate-400">أيام التأخير</TableHead>
                          <TableHead className="text-slate-400">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueTasks?.map((task: any) => (
                          <TableRow key={task.id} className="border-slate-700 bg-red-500/5">
                            <TableCell className="font-mono text-red-400">{task.referenceNumber}</TableCell>
                            <TableCell className="text-white max-w-[200px] truncate">{task.subject}</TableCell>
                            <TableCell className="text-slate-300">{task.assignedToName || task.employeeName}</TableCell>
                            <TableCell className="text-slate-300">{task.branchName || '-'}</TableCell>
                            <TableCell className="text-red-400">
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="font-bold">
                                {task.daysOverdue} يوم
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const fullTask = tasks?.find((t: any) => t.id === task.id);
                                    setSelectedTask(fullTask || task);
                                    setIsViewDialogOpen(true);
                                  }}
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Task Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل المهمة</DialogTitle>
            <DialogDescription>الرقم المرجعي: {selectedTask?.referenceNumber}</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 mt-4">
              <div className="flex gap-2">
                {getStatusBadge(selectedTask.status)}
                {getPriorityBadge(selectedTask.priority)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">الموظف</Label>
                  <p className="text-white">{selectedTask.assignedToName}</p>
                </div>
                <div>
                  <Label className="text-slate-400">الفرع</Label>
                  <p className="text-white">{selectedTask.branchName || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-400">تاريخ الإنشاء</Label>
                  <p className="text-white">{new Date(selectedTask.createdAt).toLocaleDateString('ar-SA')}</p>
                </div>
                <div>
                  <Label className="text-slate-400">تاريخ الاستحقاق</Label>
                  <p className="text-white">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('ar-SA') : '-'}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-slate-400">الموضوع</Label>
                <p className="text-white">{selectedTask.subject}</p>
              </div>

              {selectedTask.details && (
                <div>
                  <Label className="text-slate-400">التفاصيل</Label>
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedTask.details}</p>
                </div>
              )}

              <div>
                <Label className="text-slate-400">المطلوب</Label>
                <p className="text-white whitespace-pre-wrap">{selectedTask.requirement}</p>
              </div>

              {/* عرض المرفقات عند إنشاء المهمة */}
              {selectedTask.attachments && (
                <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                  <Label className="text-amber-400 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    مرفقات المهمة
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(() => {
                      try {
                        const attachments = typeof selectedTask.attachments === 'string' 
                          ? JSON.parse(selectedTask.attachments) 
                          : selectedTask.attachments;
                        return attachments.map((url: string, index: number) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-slate-600/50 hover:bg-slate-600 rounded-lg px-3 py-2 text-sm transition-colors"
                          >
                            <Download className="w-4 h-4 text-blue-400" />
                            <span className="text-blue-400">ملف {index + 1}</span>
                          </a>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </div>
              )}

              {selectedTask.respondedAt && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                  <Label className="text-blue-400">الاستجابة</Label>
                  <p className="text-slate-300 mt-2">
                    تاريخ الاستجابة: {new Date(selectedTask.respondedAt).toLocaleDateString('ar-SA')}
                  </p>
                  {selectedTask.responseConfirmation !== null && (
                    <p className="text-white mt-1">
                      الإجابة: {selectedTask.responseConfirmation ? 'نعم' : 'لا'}
                    </p>
                  )}
                  {selectedTask.responseText && (
                    <p className="text-white mt-1">{selectedTask.responseText}</p>
                  )}
                  {selectedTask.responseFiles && JSON.parse(selectedTask.responseFiles).length > 0 && (
                    <div className="mt-2">
                      <p className="text-slate-400 text-sm">الملفات المرفقة:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {JSON.parse(selectedTask.responseFiles).map((file: string, index: number) => (
                          <a
                            key={index}
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-400 hover:underline text-sm bg-blue-500/10 px-3 py-1 rounded-lg"
                          >
                            <Download className="w-3 h-3" />
                            ملف {index + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                {selectedTask.status === 'pending' && (
                  <Button
                    variant="outline"
                    className="border-red-600 text-red-400"
                    onClick={() => {
                      updateStatusMutation.mutate({ taskId: selectedTask.id, status: 'cancelled' });
                      setIsViewDialogOpen(false);
                    }}
                  >
                    <XCircle className="w-4 h-4 ml-2" />
                    إلغاء المهمة
                  </Button>
                )}
                {selectedTask.status === 'in_progress' && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      updateStatusMutation.mutate({ taskId: selectedTask.id, status: 'completed' });
                      setIsViewDialogOpen(false);
                    }}
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    إكمال المهمة
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
