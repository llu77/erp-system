/**
 * الهوية الرسمية الموحدة (بيانات الشركة + التوقيعات والختم)
 * مشتركة بين الواجهة (الطباعة) والخادم (توليد PDF) حتى يظهر نفس المحتوى في كل مكان.
 * مسارات الصور نسبية لمجلد client/public.
 */

// =====================================================
// معلومات التوقيعات والختم
// =====================================================
export const SIGNATURES = {
  supervisor: {
    name: 'سالم الوادعي',
    nameEn: 'Salem Alwadai',
    title: 'المشرف العام',
    titleEn: 'General Supervisor',
    image: '/signatures/supervisor_signature.png'
  },
  manager: {
    name: 'عمر المطيري',
    nameEn: 'Omar Al-Mutairi',
    title: 'المدير العام',
    titleEn: 'General Manager',
    image: '/signatures/manager_signature.png'
  },
  stamp: {
    image: '/signatures/company_stamp.png',
    label: 'ختم الإدارة'
  }
};

// =====================================================
// هوية النظام (الشاشات فقط، لا تظهر على المستندات الرسمية)
// =====================================================
export const SYSTEM_BRAND = {
  name: 'Symbol AI',
  nameAr: 'سيمبول للذكاء الاصطناعي',
  logo: '/symbol-ai-logo.png',
};

// =====================================================
// المؤسسات (الجهة القانونية التي تصدر المستندات حسب الفرع)
// =====================================================
export type EstablishmentKey = 'qessa' | 'tadarruj' | 'group';

export interface Establishment {
  key: EstablishmentKey;
  /** الاسم الإنجليزي (فارغ = لا يُطبع) */
  name: string;
  nameAr: string;
  subtitle: string;
  address: string;
  phone: string;
  email: string;
  /** شعار المؤسسة (فارغ = ترويسة نصية بدون شعار) */
  logo: string;
  /** ختم المؤسسة */
  stamp: string;
  cr: string;
  vat: string;
}

const COMMON_ESTABLISHMENT_FIELDS = {
  name: '',
  subtitle: '',
  address: 'المملكة العربية السعودية - الرياض',
  phone: '+966 XX XXX XXXX',
  email: '',
  logo: '',
  stamp: SIGNATURES.stamp.image,
  cr: 'س.ت: XXXXXXXXXX',
  vat: 'الرقم الضريبي: XXXXXXXXXXXXXXX',
};

export const ESTABLISHMENTS: Record<'qessa' | 'tadarruj', Establishment> = {
  // فرع لبن
  qessa: { key: 'qessa', nameAr: 'مؤسسة قصه وتخفيف', ...COMMON_ESTABLISHMENT_FIELDS },
  // فرع طويق
  tadarruj: { key: 'tadarruj', nameAr: 'مؤسسة تدرج وتخفيف', ...COMMON_ESTABLISHMENT_FIELDS },
};

/** الهوية العامة: للتقارير المجمّعة لعدة فروع أو لفرع غير معروف */
export const GROUP_ESTABLISHMENT: Establishment = {
  key: 'group',
  nameAr: 'صالونات قصه وتخفيف وفروعها',
  ...COMMON_ESTABLISHMENT_FIELDS,
};

/**
 * الكلمات التي تحدد مؤسسة الفرع (بعد التطبيع، ككلمة كاملة)
 * "طريق" إملاء بديل لـ"طويق"
 */
const ESTABLISHMENT_RULES: Array<{ key: 'qessa' | 'tadarruj'; tokens: string[] }> = [
  { key: 'qessa', tokens: ['لبن', 'laban', 'labn', 'labon'] },
  { key: 'tadarruj', tokens: ['طويق', 'طريق', 'tuwaiq', 'tuwaig', 'twaiq', 'tuwayq'] },
];

/** تطبيع النص العربي/الإنجليزي إلى كلمات: بدون تشكيل وتطويل، وتوحيد الألف والياء والتاء المربوطة */
export function normalizeBranchText(value: string | null | undefined): string[] {
  if (!value) return [];
  const normalized = String(value)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
  return normalized.split(/[^a-z0-9\u0621-\u064A\u0660-\u0669]+/).filter(Boolean);
}

/** مفتاح المؤسسة من أسماء الفرع (عربي/إنجليزي)، أو null إذا لم تطابق أو طابقت المؤسستين */
export function matchEstablishmentKey(...names: Array<string | null | undefined>): 'qessa' | 'tadarruj' | null {
  const words = new Set(names.flatMap(n => normalizeBranchText(n)));
  const matched = ESTABLISHMENT_RULES.filter(rule => rule.tokens.some(token => words.has(token))).map(rule => rule.key);
  return matched.length === 1 ? matched[0] : null;
}

export type BranchLike =
  | string
  | null
  | undefined
  | { name?: string | null; nameAr?: string | null; branchName?: string | null };

/**
 * مؤسسة الفرع: فرع لبن -> مؤسسة قصه وتخفيف، فرع طويق -> مؤسسة تدرج وتخفيف،
 * وغير ذلك -> الهوية العامة
 */
export function getEstablishmentForBranch(branch: BranchLike): Establishment {
  const names = typeof branch === 'string' || branch == null ? [branch] : [branch.nameAr, branch.name, branch.branchName];
  const key = matchEstablishmentKey(...names);
  return key ? ESTABLISHMENTS[key] : GROUP_ESTABLISHMENT;
}

/** تقرير لعدة فروع: مؤسستها إن كانت كلها لنفس المؤسسة، وإلا الهوية العامة */
export function getEstablishmentForBranches(branches: BranchLike[]): Establishment {
  if (branches.length === 0) return GROUP_ESTABLISHMENT;
  const resolved = branches.map(getEstablishmentForBranch);
  return resolved.every(e => e.key === resolved[0].key) ? resolved[0] : GROUP_ESTABLISHMENT;
}

/**
 * @deprecated المستندات تستخدم getEstablishmentForBranch حسب الفرع.
 * الهوية العامة (لا تحمل اسم النظام)، للاستخدامات المتبقية فقط
 */
export const COMPANY_INFO = {
  name: GROUP_ESTABLISHMENT.name,
  nameAr: GROUP_ESTABLISHMENT.nameAr,
  subtitle: GROUP_ESTABLISHMENT.subtitle,
  address: GROUP_ESTABLISHMENT.address,
  phone: GROUP_ESTABLISHMENT.phone,
  email: GROUP_ESTABLISHMENT.email,
  logo: GROUP_ESTABLISHMENT.logo,
  cr: GROUP_ESTABLISHMENT.cr,
  vat: GROUP_ESTABLISHMENT.vat,
};

export type CompanyInfo = typeof COMPANY_INFO;
export type SignaturesInfo = typeof SIGNATURES;

/** هل القيمة نص مؤقت (مثل XXXXXXXX) لم يتم تعبئته بعد؟ */
export function isPlaceholderValue(value: string | null | undefined): boolean {
  if (!value) return true;
  return /X{4,}/i.test(value);
}
