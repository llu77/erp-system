/**
 * أداة الإشعارات - Notification Tool
 * ==================================
 * 
 * أداة لإرسال الإشعارات والتنبيهات
 */

import { BaseTool } from "./baseTool";
import { queueEmailNotification } from "../../../notifications/notificationQueue";
import { notifyOwner } from "../../../_core/notification";

export class NotificationTool extends BaseTool {
  constructor() {
    super(
      "send_notification",
      `إرسال إشعار أو تنبيه. يمكنك إرسال:
      - إشعار للمالك (owner)
      - بريد إلكتروني لمستلم محدد
      استخدم هذه الأداة عندما تحتاج لإبلاغ شخص بمعلومة مهمة.`,
      {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "نوع الإشعار",
            enum: ["owner", "email"],
          },
          title: {
            type: "string",
            description: "عنوان الإشعار",
          },
          content: {
            type: "string",
            description: "محتوى الإشعار",
          },
          recipientEmail: {
            type: "string",
            description: "البريد الإلكتروني للمستلم (مطلوب لنوع email)",
          },
          recipientName: {
            type: "string",
            description: "اسم المستلم (اختياري)",
          },
          priority: {
            type: "string",
            description: "أولوية الإشعار",
            enum: ["high", "normal", "low"],
          },
        },
        required: ["type", "title", "content"],
      }
    );
  }

  async execute(input: {
    type: "owner" | "email";
    title: string;
    content: string;
    recipientEmail?: string;
    recipientName?: string;
    priority?: "high" | "normal" | "low";
  }): Promise<string> {
    const { type, title, content, recipientEmail, recipientName, priority = "normal" } = input;

    try {
      if (type === "owner") {
        // إرسال إشعار للمالك
        const success = await notifyOwner({ title, content });
        if (success) {
          return `✅ تم إرسال الإشعار للمالك بنجاح\nالعنوان: ${title}`;
        } else {
          return `❌ فشل إرسال الإشعار للمالك`;
        }
      } else if (type === "email") {
        // إرسال بريد إلكتروني
        if (!recipientEmail) {
          return "❌ البريد الإلكتروني مطلوب لإرسال بريد";
        }

        const notificationId = await queueEmailNotification({
          type: "general",
          recipient: {
            email: recipientEmail,
            name: recipientName || "مستلم",
          },
          subject: title,
          bodyHtml: `
            <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
              <h2 style="color: #333;">${title}</h2>
              <div style="margin-top: 15px; line-height: 1.8;">
                ${content.replace(/\n/g, "<br>")}
              </div>
              <hr style="margin-top: 20px; border: none; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 12px;">
                تم إرسال هذا الإشعار بواسطة نظام Symbol AI ERP
              </p>
            </div>
          `,
          bodyText: content,
          priority,
        });

        return `✅ تم إضافة الإشعار للقائمة\nمعرف الإشعار: ${notificationId}\nالمستلم: ${recipientEmail}`;
      }

      return "❌ نوع إشعار غير معروف";
    } catch (error: any) {
      return `❌ خطأ في إرسال الإشعار: ${error.message}`;
    }
  }
}

export const notificationTool = new NotificationTool();
