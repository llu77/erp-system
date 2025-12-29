import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Search, 
  FileText, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Building2,
  User,
  Calendar,
  Target,
  FileUp,
  Loader2
} from 'lucide-react';

export default function TaskLookup() {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [searchedRef, setSearchedRef] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // البحث عن المهمة
  const { data: task, isLoading, error, refetch } = trpc.tasks.getByReference.useQuery(
    { referenceNumber: searchedRef },
    { enabled: searchedRef.length === 6 }
  );

  // الاستجابة للمهمة
  const respondMutation = trpc.tasks.respond.useMutation({
    onSuccess: () => {
      toast.success('تم إرسال الاستجابة بنجاح');
      refetch();
      setUploadedFiles([]);
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء إرسال الاستجابة');
    },
  });

  const handleSearch = () => {
    if (referenceNumber.length !== 6) {
      toast.error('الرقم المرجعي يجب أن يكون 6 أرقام');
      return;
    }
    setSearchedRef(referenceNumber);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newFiles: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        // رفع الملف إلى S3
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          newFiles.push(data.url);
        } else {
          toast.error(`فشل رفع الملف: ${file.name}`);
        }
      }

      setUploadedFiles([...uploadedFiles, ...newFiles]);
      toast.success(`تم رفع ${newFiles.length} ملف بنجاح`);
    } catch (error) {
      toast.error('حدث خطأ أثناء رفع الملفات');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmitResponse = (confirmation?: boolean) => {
    if (!task) return;

    if (task.responseType === 'file_upload' || task.responseType === 'multiple_files') {
      if (uploadedFiles.length === 0) {
        toast.error('يرجى رفع الملف المطلوب');
        return;
      }
      respondMutation.mutate({
        referenceNumber: searchedRef,
        responseType: task.responseType,
        responseFiles: uploadedFiles,
      });
    } else if (task.responseType === 'confirmation') {
      respondMutation.mutate({
        referenceNumber: searchedRef,
        responseType: 'confirmation',
        responseConfirmation: confirmation,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 ml-1" /> في انتظار الرد</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Loader2 className="w-3 h-3 ml-1 animate-spin" /> تحت المعالجة</Badge>;
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
        return <Badge className="bg-orange-500"><AlertTriangle className="w-3 h-3 ml-1" /> مرتفع</Badge>;
      case 'medium':
        return <Badge className="bg-blue-500">متوسط</Badge>;
      case 'low':
        return <Badge variant="secondary">منخفض</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/symbol-ai-logo.png" alt="Symbol AI" className="h-12 w-12" />
            <h1 className="text-3xl font-bold text-white">نظام المهام</h1>
          </div>
          <p className="text-slate-400">أدخل الرقم المرجعي للبحث عن المهمة المطلوبة</p>
        </div>

        {/* Search Card */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="w-5 h-5" />
              البحث عن مهمة
            </CardTitle>
            <CardDescription>أدخل الرقم المرجعي المكون من 6 أرقام</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="مثال: 123456"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono bg-slate-900/50 border-slate-600"
                maxLength={6}
                dir="ltr"
              />
              <Button 
                onClick={handleSearch} 
                disabled={referenceNumber.length !== 6 || isLoading}
                className="px-8"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="mr-2">بحث</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="bg-red-900/20 border-red-800 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-400">
                <XCircle className="w-6 h-6" />
                <p>لم يتم العثور على مهمة بهذا الرقم المرجعي</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task Details */}
        {task && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  تفاصيل المهمة
                </CardTitle>
                <div className="flex gap-2">
                  {getStatusBadge(task.status)}
                  {getPriorityBadge(task.priority)}
                </div>
              </div>
              <CardDescription>الرقم المرجعي: {task.referenceNumber}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                {task.branchName && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-500">الفرع:</span>
                    <span>{task.branchName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-500">الموظف:</span>
                  <span>{task.assignedToName}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-500">التاريخ:</span>
                  <span>{new Date(task.createdAt).toLocaleDateString('ar-SA')}</span>
                </div>
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Target className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-500">تاريخ الاستحقاق:</span>
                    <span>{new Date(task.dueDate).toLocaleDateString('ar-SA')}</span>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <Label className="text-slate-400 text-sm">موضوع المهمة</Label>
                <p className="text-white text-lg mt-1">{task.subject}</p>
              </div>

              {/* Details */}
              {task.details && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <Label className="text-slate-400 text-sm">التفاصيل</Label>
                  <p className="text-slate-300 mt-1 whitespace-pre-wrap">{task.details}</p>
                </div>
              )}

              {/* Requirement */}
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                <Label className="text-blue-400 text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  المطلوب
                </Label>
                <p className="text-white mt-2 whitespace-pre-wrap">{task.requirement}</p>
              </div>

              {/* عرض المرفقات عند إنشاء المهمة */}
              {task.attachments && (() => {
                try {
                  const attachments = typeof task.attachments === 'string' 
                    ? JSON.parse(task.attachments) 
                    : task.attachments;
                  if (attachments && attachments.length > 0) {
                    return (
                      <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
                        <Label className="text-amber-400 text-sm flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4" />
                          مرفقات المهمة (للاطلاع)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {attachments.map((url: string, index: number) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded-lg px-4 py-2 text-sm transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              تحميل الملف {index + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  }
                } catch {
                  return null;
                }
                return null;
              })()}

              {/* Response Section */}
              {(task.status === 'pending' || task.status === 'in_progress') && (
                <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-white font-semibold mb-4">الاستجابة للمهمة</h3>

                  {/* File Upload Response */}
                  {(task.responseType === 'file_upload' || task.responseType === 'multiple_files') && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          multiple={task.responseType === 'multiple_files'}
                          className="hidden"
                          id="file-upload"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <FileUp className="w-12 h-12 mx-auto text-slate-500 mb-3" />
                          <p className="text-slate-400">
                            {isUploading ? 'جاري الرفع...' : 'اضغط هنا لرفع الملف'}
                          </p>
                          <p className="text-slate-500 text-sm mt-1">
                            {task.responseType === 'multiple_files' ? 'يمكنك رفع عدة ملفات' : 'ملف واحد فقط'}
                          </p>
                        </label>
                      </div>

                      {uploadedFiles.length > 0 && (
                        <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4">
                          <p className="text-green-400 text-sm mb-2">الملفات المرفوعة:</p>
                          <ul className="space-y-1">
                            {uploadedFiles.map((file, index) => (
                              <li key={index} className="text-slate-300 text-sm flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                ملف {index + 1}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button 
                        onClick={() => handleSubmitResponse()} 
                        disabled={uploadedFiles.length === 0 || respondMutation.isPending}
                        className="w-full"
                      >
                        {respondMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        ) : (
                          <Upload className="w-4 h-4 ml-2" />
                        )}
                        إرسال الملفات
                      </Button>
                    </div>
                  )}

                  {/* Confirmation Response */}
                  {task.responseType === 'confirmation' && (
                    <div className="flex gap-4">
                      <Button 
                        onClick={() => handleSubmitResponse(true)}
                        disabled={respondMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 ml-2" />
                        {task.confirmationYesText || 'نعم، قمت بذلك'}
                      </Button>
                      <Button 
                        onClick={() => handleSubmitResponse(false)}
                        disabled={respondMutation.isPending}
                        variant="outline"
                        className="flex-1 border-red-600 text-red-400 hover:bg-red-600/10"
                      >
                        <XCircle className="w-4 h-4 ml-2" />
                        {task.confirmationNoText || 'لا، لم أقم بذلك حتى الآن'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Already Responded */}
              {task.status === 'in_progress' && task.respondedAt && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>تم إرسال الاستجابة بتاريخ {new Date(task.respondedAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                  {task.responseConfirmation !== null && (
                    <p className="text-slate-300 mt-2">
                      الإجابة: {task.responseConfirmation ? 'نعم' : 'لا'}
                    </p>
                  )}
                </div>
              )}

              {/* Completed */}
              {task.status === 'completed' && (
                <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>تم إكمال هذه المهمة</span>
                  </div>
                </div>
              )}

              {/* Cancelled */}
              {task.status === 'cancelled' && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="w-5 h-5" />
                    <span>تم إلغاء هذه المهمة</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          <p>Symbol AI - نظام إدارة المهام</p>
        </div>
      </div>
    </div>
  );
}
