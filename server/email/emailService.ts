import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: `نظام ERP <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Error sending email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// قالب البريد الإلكتروني الأساسي
export function getEmailTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
      direction: rtl;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
      color: white;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 20px;
    }
    .section {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 6px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #1e3a5f;
      margin-bottom: 10px;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 10px;
      text-align: right;
      border-bottom: 1px solid #dee2e6;
    }
    th {
      background-color: #e9ecef;
      font-weight: bold;
    }
    .stat-card {
      display: inline-block;
      width: 45%;
      margin: 5px;
      padding: 15px;
      background-color: #e3f2fd;
      border-radius: 6px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #1e3a5f;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
    }
    .positive {
      color: #28a745;
    }
    .negative {
      color: #dc3545;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 15px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .alert {
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .alert-warning {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      color: #856404;
    }
    .alert-danger {
      background-color: #f8d7da;
      border: 1px solid #f5c6cb;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>نظام ERP</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">${title}</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>هذا التقرير تم إنشاؤه تلقائياً من نظام ERP</p>
      <p>© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

// تنسيق الأرقام بالعربية
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ar-SA').format(value);
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}
