/**
 * توليد PDF لخطاب إنهاء الخدمة والمخالصة النهائية (واجهة مؤقتة - يُستكمل التنفيذ)
 */

import type { EndOfServiceDocumentData, EndOfServiceDocumentKind } from '../shared/endOfService';

/** PDF للمستند بصور وخط مضمّنة */
export async function generateEndOfServicePDF(_data: EndOfServiceDocumentData, _kind: EndOfServiceDocumentKind): Promise<Buffer> {
  throw new Error('generateEndOfServicePDF: not implemented yet');
}

/** اسم ملف المستند: end-of-service-letter-EOS-2026-0001.pdf */
export function endOfServiceFileName(data: Pick<EndOfServiceDocumentData, 'settlementNumber'>, kind: EndOfServiceDocumentKind): string {
  const safe = String(data.settlementNumber).replace(/[^A-Za-z0-9_-]/g, '_');
  return `${kind === 'letter' ? 'end-of-service-letter' : 'final-settlement'}-${safe}.pdf`;
}
