/**
 * هوية التقارير والمستندات المطبوعة (خادم وواجهة)
 * - الجهة المُصدرة = مؤسسة الفرع (لبن -> قصه وتخفيف، طويق -> تدرج وتخفيف)، أو الهوية العامة
 *   للتقارير المجمّعة لعدة فروع أو بدون فرع ("جميع الفروع" لا تطابق أي مؤسسة)
 * - اسم النظام (SYSTEM_BRAND) لا يظهر على المستندات المطبوعة
 * - الموقّعون من SIGNATURES (لا أسماء أو مسميات ثابتة في القوالب)
 */

import {
  SIGNATURES,
  SYSTEM_BRAND,
  getEstablishmentForBranch,
  getEstablishmentForBranches,
  isPlaceholderValue,
  type BranchLike,
  type Establishment,
} from "./branding";
import { escapeHtml, formatVoucherDate, formatVoucherDateTime } from "./vouchers";

/**
 * مؤسسة التقرير:
 * - فرع واحد (اسم أو كائن فرع) -> مؤسسته
 * - قائمة فروع -> مؤسستها إن كانت كلها لنفس المؤسسة، وإلا الهوية العامة
 * - بدون فرع / "جميع الفروع" -> الهوية العامة
 */
export function getReportEstablishment(
  branches?: BranchLike | BranchLike[] | null
): Establishment {
  if (Array.isArray(branches)) return getEstablishmentForBranches(branches);
  return getEstablishmentForBranch(branches ?? null);
}

/** سطر بيانات المؤسسة (الوصف، السجل التجاري، الرقم الضريبي) بدون القيم المؤقتة مثل XXXX - نص عادي غير مُهرّب */
export function establishmentDetailsLine(
  est: Pick<Establishment, "subtitle" | "cr" | "vat">,
  separator = " | "
): string {
  return [est.subtitle, est.cr, est.vat]
    .map(v => (v ?? "").trim())
    .filter(v => v && !isPlaceholderValue(v))
    .join(separator);
}

/** موقّعو التقارير: المشرف العام (إعداد/مراجعة) والمدير العام (اعتماد) */
export const REPORT_SIGNATORIES = {
  supervisor: { name: SIGNATURES.supervisor.name, title: SIGNATURES.supervisor.title },
  manager: { name: SIGNATURES.manager.name, title: SIGNATURES.manager.title },
} as const;

/** تاريخ ووقت الطباعة بتوقيت الرياض (ميلادي): "التاريخ: 30/10/2026 | الوقت: 09:15" */
export function reportPrintedAtText(now: Date = new Date()): string {
  const dateTime = formatVoucherDateTime(now);
  const time = dateTime.split(" ")[1] ?? "";
  return `التاريخ: ${formatVoucherDate(now)}${time ? ` | الوقت: ${time}` : ""}`;
}

/** ذيل التقارير (نص عادي): اسم المؤسسة + وقت الطباعة */
export function reportFooterText(est: Pick<Establishment, "nameAr">, now: Date = new Date()): string {
  return `${est.nameAr} | ${reportPrintedAtText(now)}`;
}

/** هل الاسم هو اسم النظام (القيمة الافتراضية القديمة لاسم المتجر في إعدادات الطباعة)؟ */
export function isSystemBrandName(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === SYSTEM_BRAND.name.toLowerCase() || v === SYSTEM_BRAND.nameAr;
}

/**
 * اسم المتجر على إيصال نقطة البيع وتقريرها اليومي:
 * اسم المتجر المحفوظ في إعدادات طباعة الفرع إن وُجد (وليس اسم النظام الافتراضي القديم)،
 * وإلا اسم مؤسسة الفرع
 */
export function resolveStoreName(storeName: string | null | undefined, branch: BranchLike): string {
  const saved = (storeName ?? "").trim();
  if (saved && !isSystemBrandName(saved)) return saved;
  return getEstablishmentForBranch(branch).nameAr;
}

/** ذيل التقارير جاهزاً لإدراجه في HTML (مُهرّب) */
export function reportFooterHtml(est: Pick<Establishment, "nameAr">, now: Date = new Date()): string {
  return escapeHtml(reportFooterText(est, now));
}
