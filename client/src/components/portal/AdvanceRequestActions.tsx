/**
 * مستند طلب السلفة الرسمي: تحميل PDF وطباعته (employeePortal.advanceRequestPdf)
 * الختم والتوقيع يظهران على المستند بعد الموافقة فقط (يحددها الخادم)
 */

import { toast } from "sonner";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  downloadBase64Pdf,
  openPendingWindow,
  showPdfInWindow,
} from "@/lib/portal/documents";
import { errorMessage } from "@/lib/portal/portalUi";

interface AdvanceRequestActionsProps {
  requestId: number;
}

export function AdvanceRequestActions({
  requestId,
}: AdvanceRequestActionsProps) {
  const pdfMutation = trpc.employeePortal.advanceRequestPdf.useMutation();

  const handleDownload = async () => {
    const toastId = `advance-pdf-${requestId}`;
    toast.loading("جاري تجهيز طلب السلفة...", { id: toastId });
    try {
      const result: { pdf: string; filename: string } =
        await pdfMutation.mutateAsync({ requestId });
      downloadBase64Pdf(result.pdf, result.filename);
      toast.success("تم تحميل طلب السلفة", { id: toastId });
    } catch (error) {
      toast.error(errorMessage(error, "فشل توليد ملف PDF"), { id: toastId });
    }
  };

  // تُفتح النافذة عند النقر مباشرة (قبل الانتظار) ثم يُعرض فيها ملف PDF للطباعة
  const handlePrint = async () => {
    const win = openPendingWindow("جاري تجهيز طلب السلفة للطباعة...");
    if (!win) {
      toast.error("يرجى السماح بالنوافذ المنبثقة في المتصفح للطباعة");
      return;
    }
    try {
      const result: { pdf: string; filename: string } =
        await pdfMutation.mutateAsync({ requestId });
      showPdfInWindow(win, result.pdf);
    } catch (error) {
      win.close();
      toast.error(errorMessage(error, "تعذر تجهيز طلب السلفة للطباعة"));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleDownload}
        disabled={pdfMutation.isPending}
        className="border-amber-500/50 bg-transparent text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
      >
        {pdfMutation.isPending ? (
          <Loader2 className="ml-1 h-4 w-4 animate-spin" />
        ) : (
          <Download className="ml-1 h-4 w-4" />
        )}
        طلب السلفة PDF
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handlePrint}
        disabled={pdfMutation.isPending}
        className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700"
      >
        <Printer className="ml-1 h-4 w-4" />
        طباعة
      </Button>
    </div>
  );
}
