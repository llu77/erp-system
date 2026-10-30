/**
 * فتح/تحميل مستندات البوابة (قسيمة الراتب وطلب السلفة) في المتصفح
 */

import { downloadBase64Pdf } from "@/components/endOfService/utils";
import { escapeHtml } from "@shared/vouchers";

export { downloadBase64Pdf };

/**
 * يفتح نافذة فارغة فوراً (داخل حدث النقر حتى لا يحظرها المتصفح) مع رسالة انتظار.
 * يُرجع null إذا حُظرت النوافذ المنبثقة
 */
export function openPendingWindow(message: string): Window | null {
  const win = window.open("", "_blank");
  if (!win) return null;
  const text = escapeHtml(message);
  try {
    win.document.write(
      `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${text}</title></head>` +
        `<body style="font-family: Tahoma, sans-serif; padding: 24px; color: #334155;">${text}</body></html>`
    );
    win.document.close();
  } catch {
    // النافذة قد لا تسمح بالكتابة؛ يكفي فتحها
  }
  return win;
}

/** عرض ملف PDF (base64) في نافذة مفتوحة مسبقاً للطباعة من عارض المتصفح */
export function showPdfInWindow(win: Window, base64: string): void {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  win.location.href = url;
  // الرابط مطلوب طوال عرض الملف؛ يُحرر بعد مدة كافية
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}

/** كتابة مستند HTML كامل في نافذة جديدة (القالب يطبع نفسه تلقائياً) */
export function openHtmlDocument(html: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
