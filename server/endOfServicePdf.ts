/**
 * توليد PDF لخطاب إنهاء الخدمة والمخالصة النهائية من القالب الموحد shared/endOfServiceTemplate.ts
 * - الشعار والتوقيعات والختم والخط تُضمَّن كـ data URI (نفس أصول السندات) حتى يعمل PDF بدون شبكة
 * - التحويل عبر نفس مسار puppeteer المستخدم للسندات (renderHtmlToPdf)
 */

import type {
  EndOfServiceDocumentData,
  EndOfServiceDocumentKind,
} from "../shared/endOfService";
import { renderEndOfServiceDocumentHtml } from "../shared/endOfServiceTemplate";
import { loadVoucherAssets, renderHtmlToPdf } from "./voucherPdf";

/** HTML المستند الكامل بصور وخط مضمّنة (للـ PDF والمرفقات) */
export function renderEndOfServiceHtmlEmbedded(
  data: EndOfServiceDocumentData,
  kind: EndOfServiceDocumentKind,
  options: { includeFont?: boolean; printedAt?: Date } = {}
): string {
  return renderEndOfServiceDocumentHtml(kind, data, {
    assets: loadVoucherAssets({ includeFont: options.includeFont }),
    printedAt: options.printedAt,
  });
}

/** PDF للمستند بصور وخط مضمّنة */
export async function generateEndOfServicePDF(
  data: EndOfServiceDocumentData,
  kind: EndOfServiceDocumentKind
): Promise<Buffer> {
  return renderHtmlToPdf(renderEndOfServiceHtmlEmbedded(data, kind));
}

/** اسم ملف المستند: end-of-service-letter-EOS-2026-0001.pdf */
export function endOfServiceFileName(
  data: Pick<EndOfServiceDocumentData, "settlementNumber">,
  kind: EndOfServiceDocumentKind
): string {
  const safe = String(data.settlementNumber).replace(/[^A-Za-z0-9_-]/g, "_");
  return `${kind === "letter" ? "end-of-service-letter" : "final-settlement"}-${safe}.pdf`;
}
