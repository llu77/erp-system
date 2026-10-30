/**
 * قالب طباعة إنهاء الخدمة: خطاب انتهاء العقد وعدم التجديد + المخالصة النهائية
 * (واجهة مؤقتة - يُستكمل التنفيذ)
 */

import type { CompanyInfo } from "./branding";
import type { EndOfServiceDocumentData, EndOfServiceDocumentKind } from "./endOfService";
import type { VoucherTemplateAssets } from "./voucherTemplate";

export type EndOfServiceTemplateAssets = VoucherTemplateAssets;

export interface EndOfServiceTemplateOptions {
  /** أساس روابط الصور (مثال: window.location.origin). يُتجاهل للصور المُمررة صراحةً في assets */
  assetBaseUrl?: string;
  /** صور مُمررة صراحةً (مثل data URIs في الخادم) */
  assets?: EndOfServiceTemplateAssets;
  company?: Partial<CompanyInfo>;
  /** إضافة سكربت طباعة تلقائية بعد تحميل الصفحة */
  autoPrint?: boolean;
  /** وقت الطباعة (للاختبارات) */
  printedAt?: Date;
}

/** خطاب إشعار انتهاء عقد العمل وعدم التجديد (صفحة A4 كاملة RTL) */
export function renderEndOfServiceLetterHtml(_data: EndOfServiceDocumentData, _options: EndOfServiceTemplateOptions = {}): string {
  throw new Error("renderEndOfServiceLetterHtml: not implemented yet");
}

/** المخالصة النهائية وإبراء الذمة (صفحة A4 كاملة RTL) */
export function renderFinalSettlementHtml(_data: EndOfServiceDocumentData, _options: EndOfServiceTemplateOptions = {}): string {
  throw new Error("renderFinalSettlementHtml: not implemented yet");
}

/** اختيار القالب حسب نوع المستند */
export function renderEndOfServiceDocumentHtml(
  kind: EndOfServiceDocumentKind,
  data: EndOfServiceDocumentData,
  options: EndOfServiceTemplateOptions = {}
): string {
  return kind === "letter" ? renderEndOfServiceLetterHtml(data, options) : renderFinalSettlementHtml(data, options);
}
