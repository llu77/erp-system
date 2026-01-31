/**
 * رسائل خطأ OCR المفصلة
 * Detailed OCR Error Messages
 * 
 * يوفر رسائل خطأ واضحة ومفصلة للمستخدم عند فشل قراءة صورة الموازنة
 */

// ==================== أنواع الأخطاء ====================

export type OCRErrorCode = 
  // أخطاء الصورة
  | 'IMAGE_UPSIDE_DOWN'
  | 'IMAGE_ROTATED'
  | 'IMAGE_BLURRY'
  | 'IMAGE_TOO_DARK'
  | 'IMAGE_TOO_BRIGHT'
  | 'IMAGE_CROPPED'
  | 'IMAGE_LOW_RESOLUTION'
  | 'IMAGE_GLARE'
  | 'IMAGE_SHADOW'
  // أخطاء المحتوى
  | 'NOT_POS_RECEIPT'
  | 'WRONG_RECEIPT_TYPE'
  | 'MISSING_SECTIONS'
  | 'PARTIAL_RECEIPT'
  | 'MULTIPLE_RECEIPTS'
  | 'HANDWRITTEN_CONTENT'
  // أخطاء البيانات
  | 'NO_DATE_FOUND'
  | 'INVALID_DATE_FORMAT'
  | 'DATE_MISMATCH'
  | 'NO_AMOUNT_FOUND'
  | 'AMOUNT_MISMATCH'
  | 'AMOUNT_FORMAT_ERROR'
  // أخطاء عامة
  | 'EXTRACTION_FAILED'
  | 'LOW_CONFIDENCE'
  | 'UNKNOWN_ERROR';

export interface DetailedOCRError {
  code: OCRErrorCode;
  title: string;
  description: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  icon: string; // emoji للعرض
}

// ==================== قاموس الأخطاء ====================

export const OCR_ERROR_MESSAGES: Record<OCRErrorCode, DetailedOCRError> = {
  // أخطاء الصورة
  IMAGE_UPSIDE_DOWN: {
    code: 'IMAGE_UPSIDE_DOWN',
    title: 'الصورة مقلوبة',
    description: 'يبدو أن الصورة مقلوبة رأساً على عقب. لم نتمكن من قراءة النص بشكل صحيح.',
    suggestion: 'يرجى تدوير الصورة 180 درجة أو التقاط صورة جديدة مع التأكد من أن الإيصال في الاتجاه الصحيح.',
    severity: 'error',
    icon: '🔄'
  },
  IMAGE_ROTATED: {
    code: 'IMAGE_ROTATED',
    title: 'الصورة مائلة',
    description: 'الصورة مائلة بزاوية كبيرة مما يصعب قراءة النص.',
    suggestion: 'يرجى التقاط صورة جديدة مع التأكد من أن الإيصال مستقيم ومتوازي مع حواف الصورة.',
    severity: 'error',
    icon: '↩️'
  },
  IMAGE_BLURRY: {
    code: 'IMAGE_BLURRY',
    title: 'الصورة غير واضحة',
    description: 'الصورة ضبابية أو غير واضحة. قد يكون السبب اهتزاز الكاميرا أو عدم التركيز.',
    suggestion: 'يرجى التقاط صورة جديدة مع تثبيت الجوال جيداً والتأكد من التركيز على الإيصال.',
    severity: 'error',
    icon: '🔍'
  },
  IMAGE_TOO_DARK: {
    code: 'IMAGE_TOO_DARK',
    title: 'الصورة داكنة جداً',
    description: 'الصورة داكنة جداً ولا يمكن قراءة النص بوضوح.',
    suggestion: 'يرجى التقاط صورة جديدة في مكان مضاء جيداً أو تشغيل فلاش الكاميرا.',
    severity: 'error',
    icon: '🌑'
  },
  IMAGE_TOO_BRIGHT: {
    code: 'IMAGE_TOO_BRIGHT',
    title: 'الصورة ساطعة جداً',
    description: 'الصورة ساطعة جداً مما يجعل النص غير مقروء.',
    suggestion: 'يرجى التقاط صورة جديدة بعيداً عن الضوء المباشر أو إيقاف الفلاش.',
    severity: 'error',
    icon: '☀️'
  },
  IMAGE_CROPPED: {
    code: 'IMAGE_CROPPED',
    title: 'الصورة مقطوعة',
    description: 'جزء من الإيصال مقطوع أو غير ظاهر في الصورة.',
    suggestion: 'يرجى التقاط صورة جديدة تظهر الإيصال كاملاً من أعلى إلى أسفل.',
    severity: 'error',
    icon: '✂️'
  },
  IMAGE_LOW_RESOLUTION: {
    code: 'IMAGE_LOW_RESOLUTION',
    title: 'دقة الصورة منخفضة',
    description: 'دقة الصورة منخفضة جداً ولا يمكن قراءة التفاصيل الصغيرة.',
    suggestion: 'يرجى التقاط صورة بدقة أعلى أو الاقتراب أكثر من الإيصال.',
    severity: 'error',
    icon: '📷'
  },
  IMAGE_GLARE: {
    code: 'IMAGE_GLARE',
    title: 'انعكاس ضوئي على الصورة',
    description: 'يوجد انعكاس ضوئي (لمعان) على الإيصال يحجب جزءاً من النص.',
    suggestion: 'يرجى تغيير زاوية التصوير لتجنب الانعكاس أو التصوير في مكان بإضاءة غير مباشرة.',
    severity: 'error',
    icon: '✨'
  },
  IMAGE_SHADOW: {
    code: 'IMAGE_SHADOW',
    title: 'ظل على الصورة',
    description: 'يوجد ظل على الإيصال يحجب جزءاً من النص.',
    suggestion: 'يرجى التصوير في مكان مضاء بشكل متساوٍ أو تغيير موضع مصدر الضوء.',
    severity: 'warning',
    icon: '🌤️'
  },

  // أخطاء المحتوى
  NOT_POS_RECEIPT: {
    code: 'NOT_POS_RECEIPT',
    title: 'ليست صورة إيصال نقاط البيع',
    description: 'الصورة المرفوعة لا تبدو إيصال موازنة من جهاز نقاط البيع (POS).',
    suggestion: 'يرجى رفع صورة إيصال الموازنة اليومية من جهاز نقاط البيع الذي يحتوي على أقسام الدفع (mada, VISA, MasterCard, إلخ).',
    severity: 'error',
    icon: '🧾'
  },
  WRONG_RECEIPT_TYPE: {
    code: 'WRONG_RECEIPT_TYPE',
    title: 'نوع الإيصال غير صحيح',
    description: 'هذا إيصال عادي وليس إيصال موازنة يومية. إيصال الموازنة يحتوي على مجاميع جميع المعاملات.',
    suggestion: 'يرجى رفع إيصال "الموازنة اليومية" أو "Settlement Report" من جهاز نقاط البيع.',
    severity: 'error',
    icon: '📋'
  },
  MISSING_SECTIONS: {
    code: 'MISSING_SECTIONS',
    title: 'أقسام الدفع غير موجودة',
    description: 'لم نتمكن من العثور على أقسام الدفع المتوقعة (mada, VISA, MasterCard, إلخ) في الإيصال.',
    suggestion: 'تأكد من أن الإيصال يحتوي على جميع أقسام الدفع وأنها ظاهرة بوضوح في الصورة.',
    severity: 'error',
    icon: '📊'
  },
  PARTIAL_RECEIPT: {
    code: 'PARTIAL_RECEIPT',
    title: 'إيصال جزئي',
    description: 'يبدو أن جزءاً من الإيصال مفقود. قد تكون بعض الأقسام غير ظاهرة.',
    suggestion: 'يرجى التأكد من تصوير الإيصال كاملاً من البداية إلى النهاية.',
    severity: 'warning',
    icon: '📄'
  },
  MULTIPLE_RECEIPTS: {
    code: 'MULTIPLE_RECEIPTS',
    title: 'عدة إيصالات في صورة واحدة',
    description: 'يبدو أن الصورة تحتوي على أكثر من إيصال واحد.',
    suggestion: 'يرجى رفع صورة لإيصال واحد فقط لكل عملية.',
    severity: 'warning',
    icon: '📑'
  },
  HANDWRITTEN_CONTENT: {
    code: 'HANDWRITTEN_CONTENT',
    title: 'محتوى مكتوب بخط اليد',
    description: 'يحتوي الإيصال على كتابة يدوية قد تؤثر على دقة القراءة.',
    suggestion: 'يرجى رفع إيصال مطبوع من الجهاز بدون إضافات يدوية.',
    severity: 'warning',
    icon: '✍️'
  },

  // أخطاء البيانات
  NO_DATE_FOUND: {
    code: 'NO_DATE_FOUND',
    title: 'لم يتم العثور على التاريخ',
    description: 'لم نتمكن من قراءة التاريخ من الإيصال.',
    suggestion: 'تأكد من أن التاريخ ظاهر بوضوح في أعلى الإيصال وغير مقطوع.',
    severity: 'warning',
    icon: '📅'
  },
  INVALID_DATE_FORMAT: {
    code: 'INVALID_DATE_FORMAT',
    title: 'تنسيق التاريخ غير صحيح',
    description: 'تم قراءة التاريخ لكن بتنسيق غير معروف.',
    suggestion: 'تأكد من وضوح التاريخ في الإيصال.',
    severity: 'warning',
    icon: '🗓️'
  },
  DATE_MISMATCH: {
    code: 'DATE_MISMATCH',
    title: 'التاريخ غير مطابق',
    description: 'تاريخ الإيصال لا يتطابق مع التاريخ المحدد للإيراد.',
    suggestion: 'تأكد من رفع إيصال اليوم الصحيح أو تعديل تاريخ الإيراد.',
    severity: 'error',
    icon: '❌'
  },
  NO_AMOUNT_FOUND: {
    code: 'NO_AMOUNT_FOUND',
    title: 'لم يتم العثور على المبلغ',
    description: 'لم نتمكن من قراءة المبالغ من الإيصال.',
    suggestion: 'تأكد من وضوح أرقام المبالغ في الإيصال، خاصة قسم TOTALS.',
    severity: 'error',
    icon: '💰'
  },
  AMOUNT_MISMATCH: {
    code: 'AMOUNT_MISMATCH',
    title: 'المبلغ غير مطابق',
    description: 'المبلغ المستخرج من الإيصال لا يتطابق مع المبلغ المدخل.',
    suggestion: 'تأكد من إدخال مبلغ الشبكة الصحيح أو راجع الإيصال.',
    severity: 'error',
    icon: '⚠️'
  },
  AMOUNT_FORMAT_ERROR: {
    code: 'AMOUNT_FORMAT_ERROR',
    title: 'خطأ في تنسيق المبلغ',
    description: 'تم قراءة المبلغ لكن بتنسيق غير صحيح.',
    suggestion: 'تأكد من وضوح الأرقام في الإيصال.',
    severity: 'warning',
    icon: '🔢'
  },

  // أخطاء عامة
  EXTRACTION_FAILED: {
    code: 'EXTRACTION_FAILED',
    title: 'فشل استخراج البيانات',
    description: 'لم نتمكن من استخراج البيانات من الصورة.',
    suggestion: 'يرجى التأكد من جودة الصورة ووضوحها ثم المحاولة مرة أخرى.',
    severity: 'error',
    icon: '❗'
  },
  LOW_CONFIDENCE: {
    code: 'LOW_CONFIDENCE',
    title: 'دقة القراءة منخفضة',
    description: 'تم استخراج البيانات لكن بدقة منخفضة. النتائج قد لا تكون دقيقة.',
    suggestion: 'يرجى رفع صورة أوضح للحصول على نتائج أدق.',
    severity: 'warning',
    icon: '⚡'
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    title: 'خطأ غير متوقع',
    description: 'حدث خطأ غير متوقع أثناء معالجة الصورة.',
    suggestion: 'يرجى المحاولة مرة أخرى. إذا استمرت المشكلة، تواصل مع الدعم الفني.',
    severity: 'error',
    icon: '🔧'
  }
};

// ==================== دوال مساعدة ====================

/**
 * الحصول على رسالة خطأ مفصلة
 */
export function getDetailedError(code: OCRErrorCode): DetailedOCRError {
  return OCR_ERROR_MESSAGES[code] || OCR_ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * تحليل نتيجة OCR وتحديد الأخطاء المحتملة
 */
export function analyzeOCRResult(result: {
  success: boolean;
  confidence?: string;
  extractedAmount?: number | null;
  extractedDate?: string | null;
  expectedAmount?: number;
  expectedDate?: string;
  sections?: any[];
  rawText?: string | null;
  error?: string;
}): DetailedOCRError[] {
  const errors: DetailedOCRError[] = [];

  // فشل عام
  if (!result.success) {
    // محاولة تحديد السبب من رسالة الخطأ
    const errorMsg = result.error?.toLowerCase() || '';
    
    if (errorMsg.includes('blur') || errorMsg.includes('ضباب') || errorMsg.includes('واضح')) {
      errors.push(getDetailedError('IMAGE_BLURRY'));
    } else if (errorMsg.includes('dark') || errorMsg.includes('داكن')) {
      errors.push(getDetailedError('IMAGE_TOO_DARK'));
    } else if (errorMsg.includes('bright') || errorMsg.includes('ساطع')) {
      errors.push(getDetailedError('IMAGE_TOO_BRIGHT'));
    } else {
      errors.push(getDetailedError('EXTRACTION_FAILED'));
    }
  }

  // ثقة منخفضة
  if (result.confidence === 'low' || result.confidence === 'none') {
    errors.push(getDetailedError('LOW_CONFIDENCE'));
  }

  // لا يوجد تاريخ
  if (!result.extractedDate && result.expectedDate) {
    errors.push(getDetailedError('NO_DATE_FOUND'));
  }

  // تاريخ غير مطابق
  if (result.extractedDate && result.expectedDate && result.extractedDate !== result.expectedDate) {
    const extracted = new Date(result.extractedDate);
    const expected = new Date(result.expectedDate);
    const diffDays = Math.abs((extracted.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      errors.push(getDetailedError('DATE_MISMATCH'));
    }
  }

  // لا يوجد مبلغ
  if (result.extractedAmount === null || result.extractedAmount === undefined) {
    if (result.expectedAmount && result.expectedAmount > 0) {
      errors.push(getDetailedError('NO_AMOUNT_FOUND'));
    }
  }

  // مبلغ غير مطابق
  if (result.extractedAmount !== null && result.extractedAmount !== undefined && result.expectedAmount !== undefined) {
    const diff = Math.abs(result.extractedAmount - result.expectedAmount);
    const tolerance = result.expectedAmount * 0.02; // 2%
    
    if (diff > tolerance) {
      errors.push(getDetailedError('AMOUNT_MISMATCH'));
    }
  }

  // لا توجد أقسام
  if (!result.sections || result.sections.length === 0) {
    errors.push(getDetailedError('MISSING_SECTIONS'));
  }

  // تحليل النص الخام للكشف عن مشاكل إضافية
  if (result.rawText) {
    const text = result.rawText.toLowerCase();
    
    // التحقق من أنه إيصال POS
    const posKeywords = ['mada', 'visa', 'mastercard', 'total', 'host', 'terminal'];
    const hasPOSKeywords = posKeywords.some(kw => text.includes(kw));
    
    if (!hasPOSKeywords && errors.length === 0) {
      errors.push(getDetailedError('NOT_POS_RECEIPT'));
    }
  }

  return errors;
}

/**
 * تنسيق رسالة الخطأ للعرض
 */
export function formatErrorMessage(error: DetailedOCRError): string {
  return `${error.icon} ${error.title}\n${error.description}\n\n💡 ${error.suggestion}`;
}

/**
 * تنسيق قائمة الأخطاء للعرض
 */
export function formatErrorList(errors: DetailedOCRError[]): string {
  if (errors.length === 0) return '';
  
  if (errors.length === 1) {
    return formatErrorMessage(errors[0]);
  }
  
  const errorMessages = errors.map((err, index) => 
    `${index + 1}. ${err.icon} ${err.title}: ${err.description}`
  ).join('\n\n');
  
  const suggestions = errors
    .map(err => `💡 ${err.suggestion}`)
    .filter((v, i, a) => a.indexOf(v) === i) // إزالة التكرار
    .join('\n');
  
  return `❌ تم اكتشاف ${errors.length} مشاكل:\n\n${errorMessages}\n\n📝 الاقتراحات:\n${suggestions}`;
}

/**
 * الحصول على أعلى خطأ من حيث الأهمية
 */
export function getPrimaryError(errors: DetailedOCRError[]): DetailedOCRError | null {
  if (errors.length === 0) return null;
  
  // ترتيب حسب الأهمية
  const severityOrder = { error: 0, warning: 1, info: 2 };
  
  return errors.sort((a, b) => 
    severityOrder[a.severity] - severityOrder[b.severity]
  )[0];
}
