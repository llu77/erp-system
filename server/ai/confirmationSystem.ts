/**
 * نظام التأكيد قبل تنفيذ الطلبات للمساعد الذكي Symbol AI
 * 
 * المسؤوليات:
 * 1. إنشاء طلب معلق للتأكيد قبل التنفيذ
 * 2. عرض ملخص الطلب للموظف
 * 3. تنفيذ الطلب بعد التأكيد
 * 4. إلغاء الطلب إذا رفض الموظف
 */

import { 
  createPendingRequest, 
  confirmPendingRequest, 
  cancelPendingRequest,
  getPendingRequests,
  type PendingRequestInfo 
} from "./conversationMemory";
import { submitEmployeeRequest, type ToolResult } from "./assistantTools";

// ==================== أنواع البيانات ====================

export interface ConfirmationRequest {
  sessionId: string;
  employeeId: number;
  requestType: 'advance' | 'vacation' | 'arrears' | 'permission' | 'objection' | 'resignation';
  requestData: {
    description: string;
    amount?: number;
    vacationStartDate?: string;
    vacationEndDate?: string;
    vacationDays?: number;
    vacationType?: string;
    permissionDate?: string;
    permissionStartTime?: string;
    permissionEndTime?: string;
  };
}

export interface ConfirmationResponse {
  success: boolean;
  pendingRequestId?: number;
  message: string;
  summary: string;
  expiresAt?: Date;
}

// ==================== أسماء أنواع الطلبات ====================

const REQUEST_TYPE_NAMES: Record<string, string> = {
  advance: 'سلفة',
  vacation: 'إجازة',
  arrears: 'صرف متأخرات',
  permission: 'استئذان',
  objection: 'اعتراض',
  resignation: 'استقالة',
  end_of_service: 'إنهاء خدمة',
};

// ==================== تحليل رد التأكيد ====================

// كل ما ليس حرفاً أو رقماً أو مسافة (علامات الترقيم العربية والإنجليزية والرموز)
const NON_WORD_CHARS = new RegExp("[^\\p{L}\\p{N}\\s]+", "gu");

/** توحيد النص العربي للمطابقة: حذف التشكيل والتطويل، توحيد الألف والياء، وفصل علامات الترقيم */
export function normalizeReplyText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(NON_WORD_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// كلمات وعبارات تُطابق ككلمات كاملة (لا كجزء من كلمة: "صح" لا تطابق "صحيح")
const CONFIRM_PHRASES = ["نعم", "اكد", "اكده", "اكدها", "موافق", "موافقه", "تمام", "اوكي", "ok", "okay", "yes", "صح", "ايوه", "ايوا", "ماشي", "اكيد"];
// كلمات قصيرة ملتبسة ("أي" قد تعني "أيّ") تُقبل فقط إذا كانت الرد كاملاً
const CONFIRM_WHOLE_MESSAGE = ["اي", "ايه", "اي نعم"];
const CANCEL_PHRASES = ["لا", "لاء", "الغاء", "الغي", "الغيه", "تراجع", "no", "cancel", "مش عايز", "لا اريد", "ما ابغى", "ما ابي", "ما اريد"];
// النفي قبل كلمة تأكيد يجعلها رفضاً ("غير موافق" / "مو صح")
const NEGATIONS = ["غير", "مو", "مش", "ما", "ليس", "لست", "مب", "not"];

function containsPhrase(tokens: string[], phrase: string): number[] {
  const words = normalizeReplyText(phrase).split(" ");
  const positions: number[] = [];
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (words.every((word, k) => tokens[i + k] === word)) positions.push(i);
  }
  return positions;
}

/**
 * تصنيف رد الموظف على طلب التأكيد بمطابقة كلمات كاملة:
 * confirm فقط عند وجود كلمة تأكيد غير منفية وعدم وجود كلمة إلغاء، وإلا cancel أو unclear
 */
export function classifyConfirmationReply(text: string): "confirm" | "cancel" | "unclear" {
  const normalized = normalizeReplyText(text);
  if (!normalized) return "unclear";
  const tokens = normalized.split(" ");

  let hasConfirm = CONFIRM_WHOLE_MESSAGE.some(phrase => normalizeReplyText(phrase) === normalized);
  let hasCancel = false;

  for (const phrase of CONFIRM_PHRASES) {
    for (const position of containsPhrase(tokens, phrase)) {
      if (position > 0 && NEGATIONS.includes(tokens[position - 1])) {
        hasCancel = true;
      } else {
        hasConfirm = true;
      }
    }
  }
  for (const phrase of CANCEL_PHRASES) {
    if (containsPhrase(tokens, phrase).length > 0) hasCancel = true;
  }

  if (hasConfirm && !hasCancel) return "confirm";
  if (hasCancel && !hasConfirm) return "cancel";
  return "unclear";
}

// ==================== دوال إنشاء الملخص ====================

/**
 * إنشاء ملخص للطلب بناءً على نوعه
 */
function generateRequestSummary(request: ConfirmationRequest): string {
  const typeName = REQUEST_TYPE_NAMES[request.requestType] || request.requestType;
  const lines: string[] = [];
  
  lines.push(`📋 **نوع الطلب:** ${typeName}`);
  
  switch (request.requestType) {
    case 'advance':
      if (request.requestData.amount) {
        lines.push(`💰 **المبلغ:** ${request.requestData.amount.toLocaleString('ar-SA')} ر.س`);
      }
      if (request.requestData.description) {
        lines.push(`📝 **السبب:** ${request.requestData.description}`);
      }
      break;
      
    case 'vacation':
      if (request.requestData.vacationType) {
        const vacationTypes: Record<string, string> = {
          annual: 'سنوية',
          sick: 'مرضية',
          emergency: 'طارئة',
          unpaid: 'بدون راتب',
        };
        lines.push(`🏖️ **نوع الإجازة:** ${vacationTypes[request.requestData.vacationType] || request.requestData.vacationType}`);
      }
      if (request.requestData.vacationStartDate) {
        lines.push(`📅 **من:** ${request.requestData.vacationStartDate}`);
      }
      if (request.requestData.vacationEndDate) {
        lines.push(`📅 **إلى:** ${request.requestData.vacationEndDate}`);
      }
      if (request.requestData.vacationDays) {
        lines.push(`⏱️ **عدد الأيام:** ${request.requestData.vacationDays} يوم`);
      }
      break;
      
    case 'arrears':
      if (request.requestData.amount) {
        lines.push(`💰 **المبلغ:** ${request.requestData.amount.toLocaleString('ar-SA')} ر.س`);
      }
      if (request.requestData.description) {
        lines.push(`📝 **التفاصيل:** ${request.requestData.description}`);
      }
      break;
      
    case 'permission':
      if (request.requestData.permissionDate) {
        lines.push(`📅 **التاريخ:** ${request.requestData.permissionDate}`);
      }
      if (request.requestData.permissionStartTime) {
        lines.push(`🕐 **من الساعة:** ${request.requestData.permissionStartTime}`);
      }
      if (request.requestData.permissionEndTime) {
        lines.push(`🕐 **إلى الساعة:** ${request.requestData.permissionEndTime}`);
      }
      break;
      
    case 'objection':
    case 'resignation':
      if (request.requestData.description) {
        lines.push(`📝 **التفاصيل:** ${request.requestData.description}`);
      }
      break;
  }
  
  return lines.join('\n');
}

// ==================== الدوال الرئيسية ====================

/**
 * إنشاء طلب معلق للتأكيد
 * يُستخدم عندما يريد الموظف رفع طلب جديد
 */
export async function createConfirmationRequest(
  request: ConfirmationRequest
): Promise<ConfirmationResponse> {
  try {
    const summary = generateRequestSummary(request);
    const typeName = REQUEST_TYPE_NAMES[request.requestType] || request.requestType;
    
    const pendingRequestId = await createPendingRequest(
      request.sessionId,
      request.employeeId,
      request.requestType,
      request.requestData,
      summary,
      5 // ينتهي بعد 5 دقائق
    );
    
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    return {
      success: true,
      pendingRequestId,
      message: `⏳ **تأكيد طلب ${typeName}**\n\nقبل رفع الطلب، يرجى مراجعة البيانات التالية:\n\n${summary}\n\n---\n\n✅ للتأكيد، قل: **"نعم"** أو **"أكد"** أو **"موافق"**\n❌ للإلغاء، قل: **"لا"** أو **"إلغاء"** أو **"تراجع"**\n\n⏰ *سينتهي هذا الطلب خلال 5 دقائق*`,
      summary,
      expiresAt,
    };
  } catch (error) {
    return {
      success: false,
      message: `حدث خطأ أثناء إنشاء طلب التأكيد: ${error}`,
      summary: '',
    };
  }
}

/**
 * معالجة رد الموظف على طلب التأكيد
 */
export async function handleConfirmationResponse(
  sessionId: string,
  employeeId: number,
  userResponse: string
): Promise<{ action: 'confirmed' | 'cancelled' | 'no_pending' | 'unclear'; result?: ToolResult; message: string }> {
  // الحصول على الطلبات المعلقة
  const pendingRequests = await getPendingRequests(sessionId);
  
  if (pendingRequests.length === 0) {
    return {
      action: 'no_pending',
      message: 'لا توجد طلبات معلقة للتأكيد.',
    };
  }
  
  // أخذ آخر طلب معلق
  const latestRequest = pendingRequests[0];
  
  // تحليل رد المستخدم الفعلي (مطابقة كلمات كاملة: "صحيح" أو "لا، المبلغ غير صحيح" ليست تأكيداً)
  const reply = classifyConfirmationReply(userResponse);
  const isConfirm = reply === "confirm";
  const isCancel = reply === "cancel";
  
  if (isConfirm && !isCancel) {
    // تأكيد الطلب
    const confirmed = await confirmPendingRequest(latestRequest.id);
    
    if (!confirmed) {
      return {
        action: 'no_pending',
        message: 'انتهت صلاحية الطلب أو تم معالجته مسبقاً.',
      };
    }
    
    // تنفيذ الطلب الفعلي
    const requestData = confirmed.requestData as ConfirmationRequest['requestData'];
    const result = await submitEmployeeRequest({
      employeeId,
      type: confirmed.requestType as ConfirmationRequest['requestType'],
      description: requestData.description || '',
      amount: requestData.amount,
      vacationStartDate: requestData.vacationStartDate ? new Date(requestData.vacationStartDate) : undefined,
      vacationEndDate: requestData.vacationEndDate ? new Date(requestData.vacationEndDate) : undefined,
      vacationDays: requestData.vacationDays,
      vacationType: requestData.vacationType,
      permissionDate: requestData.permissionDate ? new Date(requestData.permissionDate) : undefined,
      permissionStartTime: requestData.permissionStartTime,
      permissionEndTime: requestData.permissionEndTime,
    });
    
    return {
      action: 'confirmed',
      result,
      message: result.message,
    };
  }
  
  if (isCancel && !isConfirm) {
    // إلغاء الطلب
    await cancelPendingRequest(latestRequest.id);
    
    const typeName = REQUEST_TYPE_NAMES[latestRequest.requestType] || latestRequest.requestType;
    
    return {
      action: 'cancelled',
      message: `❌ تم إلغاء طلب ${typeName}.\n\nإذا كنت تريد رفع طلب جديد، أخبرني بالتفاصيل.`,
    };
  }
  
  // رد غير واضح
  return {
    action: 'unclear',
    message: `لم أفهم ردك. هل تريد:\n\n✅ **تأكيد** الطلب؟ (قل: نعم، أكد، موافق)\n❌ **إلغاء** الطلب؟ (قل: لا، إلغاء، تراجع)`,
  };
}

/**
 * التحقق من وجود طلبات معلقة للجلسة
 */
export async function hasPendingRequests(sessionId: string): Promise<boolean> {
  const requests = await getPendingRequests(sessionId);
  return requests.length > 0;
}

/**
 * الحصول على ملخص الطلبات المعلقة
 */
export async function getPendingRequestsSummary(sessionId: string): Promise<string> {
  const requests = await getPendingRequests(sessionId);
  
  if (requests.length === 0) {
    return '';
  }
  
  const summaries = requests.map((r, i) => {
    const typeName = REQUEST_TYPE_NAMES[r.requestType] || r.requestType;
    const expiresIn = Math.max(0, Math.floor((r.expiresAt.getTime() - Date.now()) / 60000));
    return `${i + 1}. طلب ${typeName} (ينتهي خلال ${expiresIn} دقيقة)`;
  });
  
  return `📋 **الطلبات المعلقة:**\n${summaries.join('\n')}`;
}
