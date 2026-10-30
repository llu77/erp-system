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
