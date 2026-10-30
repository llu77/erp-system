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
// معلومات الشركة
// =====================================================
export const COMPANY_INFO = {
  name: 'Symbol AI',
  nameAr: 'سيمبول للذكاء الاصطناعي',
  subtitle: 'صالونات قصه وتخفيف وفروعها',
  address: 'المملكة العربية السعودية - الرياض',
  phone: '+966 XX XXX XXXX',
  email: 'info@symbol-ai.com',
  logo: '/symbol-ai-logo.png',
  cr: 'س.ت: XXXXXXXXXX',
  vat: 'الرقم الضريبي: XXXXXXXXXXXXXXX'
};

export type CompanyInfo = typeof COMPANY_INFO;
export type SignaturesInfo = typeof SIGNATURES;

/** هل القيمة نص مؤقت (مثل XXXXXXXX) لم يتم تعبئته بعد؟ */
export function isPlaceholderValue(value: string | null | undefined): boolean {
  if (!value) return true;
  return /X{4,}/i.test(value);
}
