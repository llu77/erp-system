/**
 * حالات التحميل والخطأ الموحدة في بوابة الموظفين (لا تُعرض قائمة فارغة عند فشل الجلب)
 */

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/portal/portalUi";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

export function PortalLoading({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-10 text-slate-400",
        className
      )}
    >
      <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

interface PortalQueryErrorProps {
  error: unknown;
  onRetry: () => void;
  title?: string;
  isRetrying?: boolean;
  className?: string;
}

export function PortalQueryError({
  error,
  onRetry,
  title = "تعذر تحميل البيانات",
  isRetrying = false,
  className,
}: PortalQueryErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-8 text-center",
        className
      )}
    >
      <AlertTriangle className="h-8 w-8 text-red-400" />
      <div>
        <p className="font-medium text-red-300">{title}</p>
        <p className="mt-1 text-sm text-slate-400">
          {errorMessage(error, "حدث خطأ في الاتصال بالخادم")}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        disabled={isRetrying}
        className="border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
      >
        {isRetrying ? (
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="ml-2 h-4 w-4" />
        )}
        إعادة المحاولة
      </Button>
    </div>
  );
}
