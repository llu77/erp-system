/**
 * عناصر مشتركة لملف الموظف ولوحة الوثائق: حالات التحميل والخطأ، شارة الحالة،
 * الصورة الشخصية، وأزرار عرض/استبدال/إزالة صور الوثائق
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  fileAcceptAttribute,
  formatDaysLeft,
  type DocumentStatus,
  type EmployeeDocumentKind,
} from "@shared/employeeFile";
import {
  DOCUMENT_STATUS_CLASSES,
  errorMessage,
  initials,
  isPdfUrl,
  prepareEmployeeFile,
} from "./utils";

// ==================== حالات التحميل والخطأ ====================

export function LoadingState({
  label = "جاري التحميل...",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function QueryErrorState({
  title,
  error,
  onRetry,
  retrying,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertTriangle className="h-10 w-10 text-red-500" />
      <p className="font-medium text-red-600 dark:text-red-400">{title}</p>
      <p className="text-sm text-muted-foreground">
        {errorMessage(error, "حدث خطأ غير متوقع")}
      </p>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={cn("ml-2 h-4 w-4", retrying && "animate-spin")} />
        إعادة المحاولة
      </Button>
    </div>
  );
}

// ==================== الشارات والصورة ====================

export function DocumentStatusBadge({
  status,
  daysLeft,
  className,
}: {
  status: DocumentStatus;
  daysLeft?: number | null;
  className?: string;
}) {
  const showDays =
    daysLeft !== undefined && daysLeft !== null && status !== "valid";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold",
        DOCUMENT_STATUS_CLASSES[status],
        className
      )}
    >
      {showDays ? formatDaysLeft(daysLeft) : DOCUMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function EmployeeAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-10 w-10 border", className)}>
      {photoUrl ? (
        <AvatarImage src={photoUrl} alt={name} className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-primary font-bold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// ==================== رفع وإزالة الصور ====================

/** إبطال البيانات المتأثرة بتغيير ملف الموظف */
export function useInvalidateEmployeeFile() {
  const utils = trpc.useUtils();
  return async (employeeId: number) => {
    await Promise.all([
      utils.employees.getFile.invalidate({ id: employeeId }),
      utils.employees.list.invalidate(),
      utils.employees.getDocumentsOverview.invalidate(),
    ]);
  };
}

/**
 * أزرار ملف الوثيقة: عرض / رفع أو استبدال / إزالة
 * canEdit = false: عرض فقط
 */
export function DocumentFileActions({
  employeeId,
  kind,
  url,
  canEdit,
  compact = false,
  iconOnly = false,
}: {
  employeeId: number;
  kind: EmployeeDocumentKind;
  url: string | null;
  canEdit: boolean;
  compact?: boolean;
  /** للجداول: أيقونات عرض ورفع فقط (الإزالة من ملف الموظف) */
  iconOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const invalidate = useInvalidateEmployeeFile();
  const label = DOCUMENT_KIND_LABELS[kind];

  const upload = trpc.employees.uploadDocumentImage.useMutation({
    onSuccess: async () => {
      toast.success(`تم رفع ${label}`);
      await invalidate(employeeId);
    },
    onError: error => toast.error(errorMessage(error, `تعذر رفع ${label}`)),
  });

  const remove = trpc.employees.removeDocumentImage.useMutation({
    onSuccess: async () => {
      toast.success(`تمت إزالة ${label}`);
      setConfirmRemove(false);
      await invalidate(employeeId);
    },
    onError: error => toast.error(errorMessage(error, `تعذر إزالة ${label}`)),
  });

  const busy = preparing || upload.isPending;

  const onFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreparing(true);
    try {
      const prepared = await prepareEmployeeFile(file, kind);
      upload.mutate({ employeeId, kind, ...prepared });
    } catch (error) {
      toast.error(errorMessage(error, "تعذر قراءة الملف"));
    } finally {
      setPreparing(false);
    }
  };

  const size = compact ? "sm" : "default";

  if (iconOnly) {
    return (
      <div className="flex items-center gap-1">
        {url && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={`عرض ${label}`}
              aria-label={`عرض ${label}`}
            >
              {isPdfUrl(url) ? (
                <FileText className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </a>
          </Button>
        )}
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={fileAcceptAttribute(kind)}
              className="hidden"
              onChange={onFileChosen}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              title={url ? `استبدال ${label}` : `رفع ${label}`}
              aria-label={url ? `استبدال ${label}` : `رفع ${label}`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
        {!url && !canEdit && (
          <span className="text-xs text-muted-foreground">لا يوجد ملف</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {url ? (
        <Button variant="outline" size={size} asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {isPdfUrl(url) ? (
              <FileText className="ml-1 h-4 w-4" />
            ) : (
              <Eye className="ml-1 h-4 w-4" />
            )}
            عرض
          </a>
        </Button>
      ) : (
        !canEdit && (
          <span className="text-xs text-muted-foreground">لا يوجد ملف</span>
        )
      )}
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={fileAcceptAttribute(kind)}
            className="hidden"
            onChange={onFileChosen}
          />
          <Button
            variant={url ? "outline" : "default"}
            size={size}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="ml-1 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="ml-1 h-4 w-4" />
            )}
            {busy ? "جاري الرفع..." : url ? "استبدال" : "رفع"}
          </Button>
          {url && (
            <Button
              variant="ghost"
              size={size}
              className="text-destructive hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="ml-1 h-4 w-4" />
              إزالة
            </Button>
          )}
          <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>إزالة {label}</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم إزالة الملف من ملف الموظف. يمكنك رفع ملف جديد في أي وقت.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={remove.isPending}>
                  إلغاء
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={remove.isPending}
                  onClick={event => {
                    event.preventDefault();
                    remove.mutate({ employeeId, kind });
                  }}
                >
                  {remove.isPending ? "جاري الإزالة..." : "إزالة"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
