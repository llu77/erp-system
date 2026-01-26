/**
 * Twilio SMS/WhatsApp Service
 * خدمة إرسال رسائل SMS و WhatsApp عبر Twilio
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

interface SendSMSParams {
  to: string;
  body: string;
}

interface SendWhatsAppParams {
  to: string;
  body: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}

interface TwilioResponse {
  success: boolean;
  sid?: string;
  status?: string;
  error?: string;
}

/**
 * تنسيق رقم الهاتف للتأكد من صحته
 */
function formatPhoneNumber(phone: string): string {
  // إزالة المسافات والشرطات
  let formatted = phone.replace(/[\s\-\(\)]/g, '');
  
  // إذا بدأ بـ 05 (رقم سعودي)، تحويله إلى +966
  if (formatted.startsWith('05')) {
    formatted = '+966' + formatted.substring(1);
  }
  
  // إذا بدأ بـ 5 فقط، إضافة +966
  if (formatted.startsWith('5') && formatted.length === 9) {
    formatted = '+966' + formatted;
  }
  
  // إذا لم يبدأ بـ +، إضافتها
  if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  
  return formatted;
}

/**
 * إرسال رسالة SMS
 */
export async function sendSMS(params: SendSMSParams): Promise<TwilioResponse> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[Twilio] Missing credentials');
    return { success: false, error: 'Missing Twilio credentials' };
  }

  const formattedPhone = formatPhoneNumber(params.to);
  
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    formData.append('Body', params.body);
    
    // استخدام Messaging Service SID إذا كان متاحاً
    if (TWILIO_MESSAGING_SERVICE_SID) {
      formData.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
    } else if (TWILIO_PHONE_NUMBER) {
      formData.append('From', TWILIO_PHONE_NUMBER);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[Twilio] SMS sent successfully to ${formattedPhone}, SID: ${data.sid}`);
      return {
        success: true,
        sid: data.sid,
        status: data.status,
      };
    } else {
      console.error(`[Twilio] SMS failed:`, data);
      return {
        success: false,
        error: data.message || 'Failed to send SMS',
      };
    }
  } catch (error) {
    console.error('[Twilio] SMS error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * إرسال رسالة WhatsApp
 */
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<TwilioResponse> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[Twilio] Missing credentials');
    return { success: false, error: 'Missing Twilio credentials' };
  }

  const formattedPhone = formatPhoneNumber(params.to);
  
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${formattedPhone}`);
    formData.append('From', 'whatsapp:+14155238886'); // Twilio Sandbox number
    
    // إذا كان هناك Content Template
    if (params.contentSid) {
      formData.append('ContentSid', params.contentSid);
      if (params.contentVariables) {
        formData.append('ContentVariables', JSON.stringify(params.contentVariables));
      }
    } else {
      formData.append('Body', params.body);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[Twilio] WhatsApp sent successfully to ${formattedPhone}, SID: ${data.sid}`);
      return {
        success: true,
        sid: data.sid,
        status: data.status,
      };
    } else {
      console.error(`[Twilio] WhatsApp failed:`, data);
      return {
        success: false,
        error: data.message || 'Failed to send WhatsApp',
      };
    }
  } catch (error) {
    console.error('[Twilio] WhatsApp error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// قوالب الرسائل المحددة مسبقاً
// ============================================

/**
 * إرسال إشعار تقديم طلب جديد للموظف
 */
export async function sendRequestSubmittedNotification(
  phone: string,
  employeeName: string,
  requestType: string,
  requestId: string
): Promise<TwilioResponse> {
  const body = `مرحباً ${employeeName}،

تم تقديم طلبك بنجاح ✅

📋 نوع الطلب: ${requestType}
🔢 رقم الطلب: ${requestId}
📊 الحالة: تحت الإجراء

سيتم إشعارك عند تحديث حالة الطلب.

مع تحيات فريق Symbol AI`;

  return sendSMS({ to: phone, body });
}

/**
 * إرسال إشعار الموافقة على الطلب للموظف
 */
export async function sendRequestApprovedNotification(
  phone: string,
  employeeName: string,
  requestType: string,
  requestId: string,
  notes?: string
): Promise<TwilioResponse> {
  let body = `مرحباً ${employeeName}،

تمت الموافقة على طلبك ✅

📋 نوع الطلب: ${requestType}
🔢 رقم الطلب: ${requestId}
📊 الحالة: تمت الموافقة`;

  if (notes) {
    body += `\n📝 ملاحظات: ${notes}`;
  }

  body += `\n\nمع تحيات فريق Symbol AI`;

  return sendSMS({ to: phone, body });
}

/**
 * إرسال إشعار رفض الطلب للموظف
 */
export async function sendRequestRejectedNotification(
  phone: string,
  employeeName: string,
  requestType: string,
  requestId: string,
  reason?: string
): Promise<TwilioResponse> {
  let body = `مرحباً ${employeeName}،

نأسف لإبلاغك بأن طلبك قد تم رفضه ❌

📋 نوع الطلب: ${requestType}
🔢 رقم الطلب: ${requestId}
📊 الحالة: مرفوض`;

  if (reason) {
    body += `\n📝 سبب الرفض: ${reason}`;
  }

  body += `\n\nيمكنك التواصل مع الإدارة لمزيد من التفاصيل.

مع تحيات فريق Symbol AI`;

  return sendSMS({ to: phone, body });
}

/**
 * إرسال تذكير للموظف برفع الوثائق
 */
export async function sendDocumentReminderSMS(
  phone: string,
  employeeName: string,
  missingDocuments: string[]
): Promise<TwilioResponse> {
  const docsList = missingDocuments.join('، ');
  
  const body = `مرحباً ${employeeName}،

نذكرك بضرورة رفع الوثائق التالية في بوابة الموظفين:

📄 ${docsList}

يرجى رفع الوثائق في أقرب وقت ممكن.

مع تحيات فريق Symbol AI`;

  return sendSMS({ to: phone, body });
}

/**
 * إرسال تنبيه انتهاء صلاحية الوثيقة
 */
export async function sendDocumentExpiryAlertSMS(
  phone: string,
  employeeName: string,
  documentType: string,
  expiryDate: string,
  daysRemaining: number
): Promise<TwilioResponse> {
  let statusEmoji = '⚠️';
  let statusText = `ستنتهي خلال ${daysRemaining} يوم`;
  
  if (daysRemaining <= 0) {
    statusEmoji = '🚨';
    statusText = 'منتهية الصلاحية';
  } else if (daysRemaining <= 7) {
    statusEmoji = '🔴';
  }

  const body = `${statusEmoji} تنبيه - ${employeeName}

${documentType} ${statusText}

📅 تاريخ الانتهاء: ${expiryDate}

يرجى تجديد الوثيقة في أقرب وقت.

مع تحيات فريق Symbol AI`;

  return sendSMS({ to: phone, body });
}

/**
 * إرسال إشعار للأدمن عن طلب جديد
 */
export async function sendNewRequestAlertToAdmin(
  phone: string,
  employeeName: string,
  branchName: string,
  requestType: string,
  requestId: string
): Promise<TwilioResponse> {
  const body = `📬 طلب جديد

👤 الموظف: ${employeeName}
🏢 الفرع: ${branchName}
📋 نوع الطلب: ${requestType}
🔢 رقم الطلب: ${requestId}

يرجى مراجعة الطلب في لوحة التحكم.`;

  return sendSMS({ to: phone, body });
}
