import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Paperclip, Upload, Trash2, FileText, Image, File, Download, X } from "lucide-react";

interface RequestAttachmentsProps {
  requestId: number;
  employeeId: number;
  canEdit?: boolean; // هل يمكن إضافة/حذف مرفقات
}

const fileTypeIcons: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "image/jpeg": Image,
  "image/png": Image,
  "image/gif": Image,
  "image/webp": Image,
};

const getFileIcon = (fileType?: string) => {
  if (!fileType) return File;
  return fileTypeIcons[fileType] || File;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function RequestAttachments({ requestId, employeeId, canEdit = false }: RequestAttachmentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const utils = trpc.useUtils();
  
  const { data: attachments, isLoading } = trpc.employeePortal.getAttachments.useQuery(
    { requestId },
    { enabled: isOpen }
  );

  const uploadMutation = trpc.employeePortal.uploadAttachment.useMutation({
    onSuccess: () => {
      toast.success("تم رفع الملف بنجاح");
      utils.employeePortal.getAttachments.invalidate({ requestId });
    },
    onError: (error) => {
      toast.error(error.message || "فشل رفع الملف");
    },
  });

  const deleteMutation = trpc.employeePortal.deleteAttachment.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المرفق");
      utils.employeePortal.getAttachments.invalidate({ requestId });
    },
    onError: (error) => {
      toast.error(error.message || "فشل حذف المرفق");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من حجم الملف (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الملف يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    // التحقق من نوع الملف
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("نوع الملف غير مدعوم. يرجى رفع صورة أو ملف PDF");
      return;
    }

    setIsUploading(true);
    try {
      // تحويل الملف إلى base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        await uploadMutation.mutateAsync({
          requestId,
          employeeId,
          fileName: file.name,
          base64Data,
          contentType: file.type,
        });
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("فشل قراءة الملف");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
    }

    // إعادة تعيين input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (attachmentId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المرفق؟")) return;
    await deleteMutation.mutateAsync({ attachmentId, employeeId });
  };

  const attachmentCount = attachments?.length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Paperclip className="h-4 w-4" />
          المرفقات
          {attachmentCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
              {attachmentCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            مرفقات الطلب
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* زر رفع ملف */}
          {canEdit && (
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                    جاري الرفع...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    رفع ملف
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                صور أو PDF - الحد الأقصى 5 ميجابايت
              </p>
            </div>
          )}

          {/* قائمة المرفقات */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : attachments && attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment: any) => {
                const Icon = getFileIcon(attachment.fileType);
                const isImage = attachment.fileType?.startsWith("image/");
                
                return (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    {/* أيقونة أو معاينة */}
                    {isImage ? (
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* معلومات الملف */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.fileSize)}
                      </p>
                    </div>
                    
                    {/* أزرار الإجراءات */}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(attachment.fileUrl, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(attachment.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Paperclip className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد مرفقات</p>
              {canEdit && (
                <p className="text-sm mt-1">يمكنك رفع ملفات لدعم طلبك</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RequestAttachments;
