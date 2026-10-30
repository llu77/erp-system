/**
 * أدوات السندات المالية (سند قبض / سند صرف) المشتركة بين الخادم والواجهة
 */

export type VoucherType = "receipt" | "payment";

export const VOUCHER_PREFIX: Record<VoucherType, string> = {
  receipt: "RV",
  payment: "PV",
};

export const VOUCHER_TITLES: Record<VoucherType, { ar: string; en: string; partyAr: string; partyEn: string }> = {
  receipt: { ar: "سند قبض", en: "Receipt Voucher", partyAr: "استلمنا من", partyEn: "Received From" },
  payment: { ar: "سند صرف", en: "Payment Voucher", partyAr: "صرفنا إلى", partyEn: "Paid To" },
};

export const VOUCHER_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة - بانتظار الاعتماد",
  approved: "معتمد",
  paid: "مدفوع",
  cancelled: "ملغي",
};

export const PAYMENT_METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقداً", en: "Cash" },
  bank_transfer: { ar: "حوالة بنكية", en: "Bank Transfer" },
  check: { ar: "شيك", en: "Cheque" },
  credit_card: { ar: "بطاقة / شبكة", en: "Card" },
  mixed: { ar: "مختلط", en: "Mixed" },
  other: { ar: "أخرى", en: "Other" },
};

/** رقم السند التالي: RV-2026-0001 */
export function formatVoucherNumber(type: VoucherType, year: number, sequence: number): string {
  return `${VOUCHER_PREFIX[type]}-${year}-${String(Math.max(1, Math.floor(sequence))).padStart(4, "0")}`;
}

/** استخراج التسلسل من رقم سند (يدعم الصيغ القديمة RV-2026-001) */
export function parseVoucherSequence(voucherNumber: string | null | undefined): number {
  const parts = String(voucherNumber ?? "").split("-");
  const n = parseInt(parts[parts.length - 1] ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * توزيع مبلغ السند على طرق الدفع والتحقق من التطابق
 * (مثال: 500 نقداً + 1500 حوالة = 2000)
 */
export function splitPaymentTotal(split: { cashAmount?: number; bankAmount?: number; checkAmount?: number }): number {
  const values = [split.cashAmount, split.bankAmount, split.checkAmount].map(v =>
    Number.isFinite(v as number) && (v as number) > 0 ? (v as number) : 0
  );
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

/** طريقة الدفع الإجمالية المستنتجة من التوزيع */
export function derivePaymentMethod(split: { cashAmount?: number; bankAmount?: number; checkAmount?: number }):
  | "cash"
  | "bank_transfer"
  | "check"
  | "mixed"
  | null {
  const used = [
    (split.cashAmount ?? 0) > 0 ? "cash" : null,
    (split.bankAmount ?? 0) > 0 ? "bank_transfer" : null,
    (split.checkAmount ?? 0) > 0 ? "check" : null,
  ].filter(Boolean) as Array<"cash" | "bank_transfer" | "check">;
  if (used.length === 0) return null;
  if (used.length > 1) return "mixed";
  return used[0];
}

// ==================== تفقيط المبالغ (عربي) ====================

const AR_ONES = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function arBelow100(n: number): string {
  if (n < 20) return AR_ONES[n];
  const unit = n % 10;
  const ten = Math.floor(n / 10);
  return unit ? `${AR_ONES[unit]} و${AR_TENS[ten]}` : AR_TENS[ten];
}

function arBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(AR_HUNDREDS[h]);
  if (rest) parts.push(arBelow100(rest));
  return parts.join(" و");
}

const AR_SCALES: Array<{ one: string; two: string; plural: string; single: string }> = [
  { one: "", two: "", plural: "", single: "" },
  { one: "ألف", two: "ألفان", plural: "آلاف", single: "ألف" },
  { one: "مليون", two: "مليونان", plural: "ملايين", single: "مليون" },
  { one: "مليار", two: "ملياران", plural: "مليارات", single: "مليار" },
];

function arScaleGroup(n: number, scale: number): string {
  if (scale === 0) return arBelow1000(n);
  const s = AR_SCALES[scale];
  if (n === 1) return s.one;
  if (n === 2) return s.two;
  if (n >= 3 && n <= 10) return `${arBelow1000(n)} ${s.plural}`;
  return `${arBelow1000(n)} ${s.single}`;
}

/** تحويل عدد صحيح إلى كلمات عربية */
export function integerToArabicWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "صفر";
  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < AR_SCALES.length) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(arScaleGroup(chunk, scale));
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(" و");
}

/** تفقيط مبلغ بالريال السعودي: "فقط ألفان ريال سعودي لا غير" */
export function amountToArabicWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const totalHalalas = Math.round(safe * 100);
  const riyals = Math.floor(totalHalalas / 100);
  const halalas = totalHalalas % 100;
  let text = `${integerToArabicWords(riyals)} ريال سعودي`;
  if (halalas > 0) text += ` و${arBelow100(halalas)} هللة`;
  return `فقط ${text} لا غير`;
}

// ==================== تفقيط المبالغ (إنجليزي) ====================

const EN_ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const EN_SCALES = ["", "Thousand", "Million", "Billion"];

function enBelow1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(`${EN_ONES[h]} Hundred`);
  if (rest) {
    if (rest < 20) parts.push(EN_ONES[rest]);
    else parts.push(EN_TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${EN_ONES[rest % 10]}` : ""));
  }
  return parts.join(" ");
}

export function integerToEnglishWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < EN_SCALES.length) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(`${enBelow1000(chunk)}${EN_SCALES[scale] ? " " + EN_SCALES[scale] : ""}`);
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(" ");
}

export function amountToEnglishWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const totalHalalas = Math.round(safe * 100);
  const riyals = Math.floor(totalHalalas / 100);
  const halalas = totalHalalas % 100;
  let text = `${integerToEnglishWords(riyals)} Saudi Riyals`;
  if (halalas > 0) text += ` and ${integerToEnglishWords(halalas)} Halalas`;
  return `${text} Only`;
}

// ==================== أنواع وحالات السندات ====================

export type VoucherStatus = "draft" | "approved" | "paid" | "cancelled";
export type VoucherPaymentMethod = "cash" | "bank_transfer" | "check" | "credit_card" | "mixed" | "other";
export type VoucherPartyType = "branch" | "employee" | "supplier" | "customer" | "owner" | "other";

export const VOUCHER_TYPES: VoucherType[] = ["receipt", "payment"];
export const VOUCHER_STATUSES: VoucherStatus[] = ["draft", "approved", "paid", "cancelled"];
export const VOUCHER_PARTY_TYPES: VoucherPartyType[] = ["branch", "employee", "supplier", "customer", "owner", "other"];

export const VOUCHER_PARTY_TYPE_LABELS: Record<VoucherPartyType, { ar: string; en: string }> = {
  branch: { ar: "فرع", en: "Branch" },
  employee: { ar: "موظف", en: "Employee" },
  supplier: { ar: "مورد", en: "Supplier" },
  customer: { ar: "عميل", en: "Customer" },
  owner: { ar: "الإدارة / المالك", en: "Owner" },
  other: { ar: "أخرى", en: "Other" },
};

/** تسميات الحالة ثنائية اللغة حسب نوع السند */
export function getVoucherStatusLabel(status: string | null | undefined, type: VoucherType = "receipt"): { ar: string; en: string } {
  switch (status) {
    case "draft":
      return { ar: "مسودة - بانتظار الاعتماد", en: "Draft - Pending Approval" };
    case "approved":
      return type === "receipt"
        ? { ar: "معتمد - تم الاستلام", en: "Approved - Received" }
        : { ar: "معتمد - بانتظار الصرف", en: "Approved" };
    case "paid":
      return type === "payment" ? { ar: "تم الصرف", en: "Paid" } : { ar: "مدفوع", en: "Paid" };
    case "cancelled":
      return { ar: "ملغي", en: "Cancelled" };
    default:
      return { ar: String(status ?? "-"), en: String(status ?? "-") };
  }
}

/**
 * آلة حالات السند:
 * - مسودة ← معتمد | ملغي
 * - معتمد ← مدفوع (سند الصرف فقط) | ملغي
 * - مدفوع / ملغي: حالات نهائية
 * سند القبض: "معتمد" يعني تم الاستلام والتأكيد، ولا يوجد له حالة "مدفوع".
 */
const VOUCHER_TRANSITIONS: Record<VoucherType, Record<VoucherStatus, VoucherStatus[]>> = {
  receipt: {
    draft: ["approved", "cancelled"],
    approved: ["cancelled"],
    paid: [],
    cancelled: [],
  },
  payment: {
    draft: ["approved", "cancelled"],
    approved: ["paid", "cancelled"],
    paid: [],
    cancelled: [],
  },
};

export function getAllowedVoucherTransitions(type: VoucherType, from: VoucherStatus): VoucherStatus[] {
  return VOUCHER_TRANSITIONS[type]?.[from] ?? [];
}

export function canTransitionVoucher(type: VoucherType, from: VoucherStatus, to: VoucherStatus): boolean {
  return getAllowedVoucherTransitions(type, from).includes(to);
}

/** هل تظهر التوقيعات والختم؟ (فقط بعد اعتماد المدير) */
export function isVoucherSigned(status: string | null | undefined): boolean {
  return status === "approved" || status === "paid";
}

// ==================== أدوات HTML والأرقام ====================

/** تهريب النص قبل إدراجه في HTML (منع حقن الوسوم والسكربتات) */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** تحويل مبلغ إلى هللات (عدد صحيح) لتجنب أخطاء الفاصلة العائمة */
export function toHalalas(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** تقريب المبلغ إلى خانتين عشريتين */
export function roundMoney(value: unknown): number {
  return toHalalas(value) / 100;
}

/** تنسيق المبلغ بالأرقام اللاتينية: 2,000.00 */
export function formatVoucherAmount(value: unknown): string {
  return roundMoney(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==================== التواريخ (توقيت الرياض) ====================

export const VOUCHER_TIMEZONE = "Asia/Riyadh";

function riyadhParts(d: Date): { year: string; month: string; day: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VOUCHER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/**
 * تحويل قيمة تاريخ إلى نص YYYY-MM-DD حسب توقيت الرياض
 * - النص بصيغة YYYY-MM-DD يُستخدم كما هو
 * - كائن Date يُحوّل إلى يوم الرياض (لا يتأثر بمنطقة الخادم أو المتصفح)
 */
export function toVoucherDateString(value?: Date | string | null): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  const p = riyadhParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** تاريخ اليوم في الرياض بصيغة YYYY-MM-DD */
export function todayVoucherDate(now: Date = new Date()): string {
  return toVoucherDateString(now) as string;
}

/** تنسيق التاريخ: DD/MM/YYYY */
export function formatVoucherDate(value?: Date | string | null): string {
  const ymd = toVoucherDateString(value ?? null);
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** تنسيق التاريخ والوقت: DD/MM/YYYY HH:mm (توقيت الرياض) */
export function formatVoucherDateTime(value?: Date | string | null): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "-";
  const p = riyadhParts(d);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// ==================== الترقيم ====================

/** سنة السند من تاريخه (YYYY-MM-DD) */
export function voucherYear(voucherDate: string): number {
  const y = parseInt(String(voucherDate).slice(0, 4), 10);
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

/** رقم السند التالي بناءً على أعلى تسلسل موجود لنفس النوع والسنة */
export function nextVoucherNumber(type: VoucherType, year: number, currentMaxSequence?: number | string | null): string {
  const current = Math.max(0, Math.floor(Number(currentMaxSequence) || 0));
  return formatVoucherNumber(type, year, current + 1);
}

/** أعلى تسلسل ضمن قائمة أرقام سندات (يدعم الصيغ القديمة ذات 3 خانات) */
export function maxVoucherSequence(voucherNumbers: Array<string | null | undefined>): number {
  return voucherNumbers.reduce<number>((max, n) => Math.max(max, parseVoucherSequence(n)), 0);
}

// ==================== البنود والإجماليات ====================

export interface VoucherItemInput {
  description: string;
  amount?: number | string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  notes?: string | null;
}

export interface NormalizedVoucherItem {
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
  notes: string | null;
}

export type ComputeItemsResult =
  | { ok: true; items: NormalizedVoucherItem[]; total: number }
  | { ok: false; error: string };

function isProvided(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

/**
 * حساب البنود والإجمالي على الخادم (بالهللات)
 * - المبلغ = الكمية × سعر الوحدة عند إدخال سعر الوحدة
 * - وإلا يُستخدم المبلغ المُدخل مباشرة
 */
export function computeVoucherItems(items: VoucherItemInput[] | null | undefined): ComputeItemsResult {
  if (!items || items.length === 0) return { ok: false, error: "يجب إضافة بند واحد على الأقل" };
  const normalized: NormalizedVoucherItem[] = [];
  let totalHalalas = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const description = String(item.description ?? "").trim();
    if (!description) return { ok: false, error: `يرجى إدخال وصف البند رقم ${i + 1}` };
    const quantity = isProvided(item.quantity) ? Number(item.quantity) : 1;
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: `الكمية غير صحيحة في البند رقم ${i + 1}` };
    const qty = Math.round(quantity * 100) / 100;

    let amountHalalas: number;
    let unitPrice: number | null = null;
    if (isProvided(item.unitPrice)) {
      const up = Number(item.unitPrice);
      if (!Number.isFinite(up) || up < 0) return { ok: false, error: `سعر الوحدة غير صحيح في البند رقم ${i + 1}` };
      unitPrice = roundMoney(up);
      amountHalalas = Math.round(qty * toHalalas(up));
    } else {
      const amount = Number(item.amount);
      if (!isProvided(item.amount) || !Number.isFinite(amount)) return { ok: false, error: `يرجى إدخال مبلغ البند رقم ${i + 1}` };
      amountHalalas = toHalalas(amount);
    }
    if (amountHalalas <= 0) return { ok: false, error: `مبلغ البند رقم ${i + 1} يجب أن يكون أكبر من صفر` };

    totalHalalas += amountHalalas;
    const notes = item.notes ? String(item.notes).trim() : "";
    normalized.push({
      itemNumber: i + 1,
      description,
      quantity: qty,
      unitPrice,
      amount: amountHalalas / 100,
      notes: notes || null,
    });
  }
  return { ok: true, items: normalized, total: totalHalalas / 100 };
}

// ==================== توزيع الدفع ====================

export interface VoucherPaymentInput {
  paymentMethod?: VoucherPaymentMethod | null;
  cashAmount?: number | string | null;
  bankAmount?: number | string | null;
  checkAmount?: number | string | null;
}

export interface ResolvedPaymentSplit {
  paymentMethod: VoucherPaymentMethod;
  cashAmount: number;
  bankAmount: number;
  checkAmount: number;
}

export type ResolvePaymentSplitResult = { ok: true; split: ResolvedPaymentSplit } | { ok: false; error: string };

/** هل أُرسل توزيع صريح للمبالغ؟ */
export function hasExplicitSplit(input: VoucherPaymentInput): boolean {
  return [input.cashAmount, input.bankAmount, input.checkAmount].some(v => toHalalas(v) !== 0);
}

/**
 * التحقق من توزيع الدفع وإكماله:
 * - بدون توزيع صريح: يُوضع كامل المبلغ في طريقة الدفع المختارة (الافتراضي نقداً)
 * - مع توزيع صريح: يجب أن يساوي مجموع (نقداً + حوالة + شيك) إجمالي السند تماماً،
 *   وتُستنتج طريقة الدفع (أو "مختلط" عند استخدام أكثر من طريقة)
 * - البطاقة / أخرى: طرق لا تُوزّع، يبقى التوزيع صفراً
 */
export function resolvePaymentSplit(total: number, input: VoucherPaymentInput): ResolvePaymentSplitResult {
  const totalH = toHalalas(total);
  if (totalH <= 0) return { ok: false, error: "إجمالي السند يجب أن يكون أكبر من صفر" };

  const cashH = toHalalas(input.cashAmount);
  const bankH = toHalalas(input.bankAmount);
  const checkH = toHalalas(input.checkAmount);
  if (cashH < 0 || bankH < 0 || checkH < 0) return { ok: false, error: "مبالغ طرق الدفع لا يمكن أن تكون سالبة" };

  if (!hasExplicitSplit(input)) {
    const method = input.paymentMethod ?? "cash";
    const all = totalH / 100;
    switch (method) {
      case "cash":
        return { ok: true, split: { paymentMethod: "cash", cashAmount: all, bankAmount: 0, checkAmount: 0 } };
      case "bank_transfer":
        return { ok: true, split: { paymentMethod: "bank_transfer", cashAmount: 0, bankAmount: all, checkAmount: 0 } };
      case "check":
        return { ok: true, split: { paymentMethod: "check", cashAmount: 0, bankAmount: 0, checkAmount: all } };
      case "credit_card":
      case "other":
        return { ok: true, split: { paymentMethod: method, cashAmount: 0, bankAmount: 0, checkAmount: 0 } };
      case "mixed":
      default:
        return { ok: false, error: "يرجى توزيع المبلغ على طرق الدفع (نقداً / حوالة / شيك)" };
    }
  }

  const sumH = cashH + bankH + checkH;
  if (sumH !== totalH) {
    return {
      ok: false,
      error: `مجموع طرق الدفع (${formatVoucherAmount(sumH / 100)}) لا يساوي إجمالي السند (${formatVoucherAmount(totalH / 100)})`,
    };
  }
  const split = { cashAmount: cashH / 100, bankAmount: bankH / 100, checkAmount: checkH / 100 };
  const method = derivePaymentMethod(split) ?? "cash";
  return { ok: true, split: { paymentMethod: method, ...split } };
}

export interface VoucherPaymentDetails {
  bankName?: string | null;
  bankReference?: string | null;
  checkNumber?: string | null;
  checkDate?: Date | string | null;
  checkBank?: string | null;
}

/** التحقق من تفاصيل الشيك (يُطبّق عند إرسال توزيع صريح) */
export function validatePaymentDetails(split: ResolvedPaymentSplit, details: VoucherPaymentDetails): string | null {
  if (split.checkAmount > 0) {
    if (!String(details.checkNumber ?? "").trim()) return "رقم الشيك مطلوب عند الدفع بشيك";
    if (!details.checkDate) return "تاريخ الشيك مطلوب عند الدفع بشيك";
  }
  return null;
}

export interface PaymentSplitLine {
  method: "cash" | "bank_transfer" | "check" | "credit_card" | "other";
  ar: string;
  en: string;
  amount: number;
}

export interface PaymentSplitSource {
  paymentMethod?: string | null;
  totalAmount?: number | string | null;
  cashAmount?: number | string | null;
  bankAmount?: number | string | null;
  checkAmount?: number | string | null;
}

/** أسطر توزيع الدفع (للعرض والطباعة) */
export function getPaymentSplitLines(v: PaymentSplitSource): PaymentSplitLine[] {
  const lines: PaymentSplitLine[] = [];
  const cash = roundMoney(v.cashAmount);
  const bank = roundMoney(v.bankAmount);
  const check = roundMoney(v.checkAmount);
  if (cash > 0) lines.push({ method: "cash", ...PAYMENT_METHOD_LABELS.cash, amount: cash });
  if (bank > 0) lines.push({ method: "bank_transfer", ...PAYMENT_METHOD_LABELS.bank_transfer, amount: bank });
  if (check > 0) lines.push({ method: "check", ...PAYMENT_METHOD_LABELS.check, amount: check });
  if (lines.length === 0) {
    // سندات قديمة أو طرق غير موزعة: كامل المبلغ بطريقة الدفع المسجلة
    const method = (v.paymentMethod && v.paymentMethod !== "mixed" ? v.paymentMethod : "cash") as PaymentSplitLine["method"];
    const label = PAYMENT_METHOD_LABELS[method] ?? PAYMENT_METHOD_LABELS.other;
    const total = roundMoney(v.totalAmount);
    if (total > 0) lines.push({ method, ar: label.ar, en: label.en, amount: total });
  }
  return lines;
}

/** نص مختصر لتوزيع الدفع: "نقداً 500 ريال، حوالة بنكية 1,500 ريال" */
export function formatPaymentSplitText(v: PaymentSplitSource): string {
  return getPaymentSplitLines(v)
    .map(line => {
      const amount = Number.isInteger(line.amount) ? line.amount.toLocaleString("en-US") : formatVoucherAmount(line.amount);
      return `${line.ar} ${amount} ريال`;
    })
    .join("، ");
}
