/**
 * وحدة تحليل التواريخ النسبية للمساعد الذكي Symbol AI
 * 
 * تحويل التعبيرات الزمنية العربية إلى تواريخ محددة
 * مثال: "أمس" → تاريخ الأمس
 *       "الأسبوع الماضي" → نطاق الأسبوع الماضي
 */

// ==================== أنواع البيانات ====================

export interface DateRange {
  start: Date;
  end: Date;
  periodName: string;
  periodNameAr: string;
}

export interface ParseResult {
  success: boolean;
  dateRange?: DateRange;
  originalText: string;
  normalizedPeriod?: string;
  error?: string;
}

// ==================== القواميس ====================

// تعبيرات اليوم
const TODAY_PATTERNS = [
  'اليوم',
  'هذا اليوم',
  'يوم الحالي',
  'اليوم الحالي',
];

// تعبيرات الأمس
const YESTERDAY_PATTERNS = [
  'أمس',
  'امس',
  'البارحة',
  'الأمس',
  'يوم أمس',
  'يوم امس',
];

// تعبيرات قبل يومين
const TWO_DAYS_AGO_PATTERNS = [
  'قبل يومين',
  'قبل يومان',
  'أول أمس',
  'اول امس',
  'أول البارحة',
];

// تعبيرات الأسبوع الحالي
const THIS_WEEK_PATTERNS = [
  'هذا الأسبوع',
  'هذا الاسبوع',
  'الأسبوع الحالي',
  'الاسبوع الحالي',
  'الأسبوع ده',
  'الاسبوع ده',
];

// تعبيرات الأسبوع الماضي
const LAST_WEEK_PATTERNS = [
  'الأسبوع الماضي',
  'الاسبوع الماضي',
  'الأسبوع السابق',
  'الاسبوع السابق',
  'الأسبوع اللي فات',
  'الاسبوع اللي فات',
  'أسبوع ماضي',
  'اسبوع ماضي',
];

// تعبيرات الشهر الحالي
const THIS_MONTH_PATTERNS = [
  'هذا الشهر',
  'الشهر الحالي',
  'الشهر ده',
  'شهر الحالي',
];

// تعبيرات الشهر الماضي
const LAST_MONTH_PATTERNS = [
  'الشهر الماضي',
  'الشهر السابق',
  'الشهر اللي فات',
  'شهر ماضي',
];

// أسماء الأشهر العربية
const ARABIC_MONTHS: Record<string, number> = {
  'يناير': 0, 'كانون الثاني': 0,
  'فبراير': 1, 'شباط': 1,
  'مارس': 2, 'آذار': 2,
  'أبريل': 3, 'نيسان': 3,
  'مايو': 4, 'أيار': 4,
  'يونيو': 5, 'حزيران': 5,
  'يوليو': 6, 'تموز': 6,
  'أغسطس': 7, 'آب': 7,
  'سبتمبر': 8, 'أيلول': 8,
  'أكتوبر': 9, 'تشرين الأول': 9,
  'نوفمبر': 10, 'تشرين الثاني': 10,
  'ديسمبر': 11, 'كانون الأول': 11,
};

// ==================== دوال مساعدة ====================

/**
 * الحصول على بداية اليوم
 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * الحصول على نهاية اليوم
 */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * الحصول على بداية الأسبوع (الأحد)
 */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return startOfDay(d);
}

/**
 * الحصول على نهاية الأسبوع (السبت)
 */
function endOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  return endOfDay(d);
}

/**
 * الحصول على بداية الشهر
 */
function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  return startOfDay(d);
}

/**
 * الحصول على نهاية الشهر
 */
function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return endOfDay(d);
}

/**
 * تنظيف النص العربي
 */
function normalizeArabicText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ًٌٍَُِّْ]/g, '') // إزالة التشكيل
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * التحقق من تطابق النص مع أي من الأنماط
 */
function matchesAnyPattern(text: string, patterns: string[]): boolean {
  const normalized = normalizeArabicText(text);
  return patterns.some(pattern => {
    const normalizedPattern = normalizeArabicText(pattern);
    return normalized.includes(normalizedPattern) || normalizedPattern.includes(normalized);
  });
}

// ==================== الدوال الرئيسية ====================

/**
 * تحليل تعبير زمني عربي وتحويله إلى نطاق تاريخ
 */
export function parseRelativeDate(text: string, referenceDate?: Date): ParseResult {
  const now = referenceDate || new Date();
  const normalizedText = normalizeArabicText(text);
  
  // اليوم
  if (matchesAnyPattern(text, TODAY_PATTERNS)) {
    return {
      success: true,
      dateRange: {
        start: startOfDay(now),
        end: endOfDay(now),
        periodName: 'today',
        periodNameAr: 'اليوم',
      },
      originalText: text,
      normalizedPeriod: 'today',
    };
  }
  
  // أمس
  if (matchesAnyPattern(text, YESTERDAY_PATTERNS)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      success: true,
      dateRange: {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
        periodName: 'yesterday',
        periodNameAr: 'أمس',
      },
      originalText: text,
      normalizedPeriod: 'yesterday',
    };
  }
  
  // قبل يومين
  if (matchesAnyPattern(text, TWO_DAYS_AGO_PATTERNS)) {
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return {
      success: true,
      dateRange: {
        start: startOfDay(twoDaysAgo),
        end: endOfDay(twoDaysAgo),
        periodName: 'two_days_ago',
        periodNameAr: 'قبل يومين',
      },
      originalText: text,
      normalizedPeriod: 'two_days_ago',
    };
  }
  
  // الأسبوع الحالي
  if (matchesAnyPattern(text, THIS_WEEK_PATTERNS)) {
    return {
      success: true,
      dateRange: {
        start: startOfWeek(now),
        end: endOfWeek(now),
        periodName: 'week',
        periodNameAr: 'الأسبوع الحالي',
      },
      originalText: text,
      normalizedPeriod: 'week',
    };
  }
  
  // الأسبوع الماضي
  if (matchesAnyPattern(text, LAST_WEEK_PATTERNS)) {
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return {
      success: true,
      dateRange: {
        start: startOfWeek(lastWeek),
        end: endOfWeek(lastWeek),
        periodName: 'last_week',
        periodNameAr: 'الأسبوع الماضي',
      },
      originalText: text,
      normalizedPeriod: 'last_week',
    };
  }
  
  // الشهر الحالي
  if (matchesAnyPattern(text, THIS_MONTH_PATTERNS)) {
    return {
      success: true,
      dateRange: {
        start: startOfMonth(now),
        end: endOfMonth(now),
        periodName: 'month',
        periodNameAr: 'الشهر الحالي',
      },
      originalText: text,
      normalizedPeriod: 'month',
    };
  }
  
  // الشهر الماضي
  if (matchesAnyPattern(text, LAST_MONTH_PATTERNS)) {
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return {
      success: true,
      dateRange: {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
        periodName: 'last_month',
        periodNameAr: 'الشهر الماضي',
      },
      originalText: text,
      normalizedPeriod: 'last_month',
    };
  }
  
  // محاولة تحليل اسم شهر محدد (مثل "يناير" أو "شهر يناير")
  for (const [monthName, monthIndex] of Object.entries(ARABIC_MONTHS)) {
    if (normalizedText.includes(normalizeArabicText(monthName))) {
      const year = now.getFullYear();
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0);
      
      return {
        success: true,
        dateRange: {
          start: startOfDay(monthStart),
          end: endOfDay(monthEnd),
          periodName: `month_${monthIndex + 1}`,
          periodNameAr: monthName,
        },
        originalText: text,
        normalizedPeriod: `month_${monthIndex + 1}`,
      };
    }
  }
  
  // محاولة تحليل "قبل X أيام"
  const daysAgoMatch = normalizedText.match(/قبل\s*(\d+)\s*(يوم|ايام|أيام)/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - daysAgo);
    
    return {
      success: true,
      dateRange: {
        start: startOfDay(targetDate),
        end: endOfDay(targetDate),
        periodName: `${daysAgo}_days_ago`,
        periodNameAr: `قبل ${daysAgo} أيام`,
      },
      originalText: text,
      normalizedPeriod: `${daysAgo}_days_ago`,
    };
  }
  
  // لم يتم التعرف على الفترة
  return {
    success: false,
    originalText: text,
    error: 'لم أتمكن من فهم الفترة الزمنية المحددة',
  };
}

/**
 * تحويل فترة من API إلى نطاق تاريخ
 */
export function periodToDateRange(
  period: 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month',
  referenceDate?: Date
): DateRange {
  const now = referenceDate || new Date();
  
  switch (period) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
        periodName: 'today',
        periodNameAr: 'اليوم',
      };
      
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
        periodName: 'yesterday',
        periodNameAr: 'أمس',
      };
      
    case 'week':
      return {
        start: startOfWeek(now),
        end: endOfWeek(now),
        periodName: 'week',
        periodNameAr: 'الأسبوع الحالي',
      };
      
    case 'last_week':
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return {
        start: startOfWeek(lastWeek),
        end: endOfWeek(lastWeek),
        periodName: 'last_week',
        periodNameAr: 'الأسبوع الماضي',
      };
      
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        periodName: 'month',
        periodNameAr: 'الشهر الحالي',
      };
      
    case 'last_month':
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
        periodName: 'last_month',
        periodNameAr: 'الشهر الماضي',
      };
  }
}

/**
 * تنسيق نطاق التاريخ للعرض
 */
export function formatDateRange(range: DateRange): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  const startStr = range.start.toLocaleDateString('ar-SA', options);
  const endStr = range.end.toLocaleDateString('ar-SA', options);
  
  if (startStr === endStr) {
    return startStr;
  }
  
  return `من ${startStr} إلى ${endStr}`;
}

/**
 * الحصول على اسم الفترة بالعربية
 */
export function getPeriodNameAr(period: string): string {
  const names: Record<string, string> = {
    'today': 'اليوم',
    'yesterday': 'أمس',
    'two_days_ago': 'قبل يومين',
    'week': 'الأسبوع الحالي',
    'last_week': 'الأسبوع الماضي',
    'month': 'الشهر الحالي',
    'last_month': 'الشهر الماضي',
  };
  
  return names[period] || period;
}
