/**
 * قوالب PDF الموحدة مع شعار Symbol AI
 * يستخدم لجميع التقارير في النظام
 */

// ألوان البرنامج الرئيسية
export const PDF_COLORS = {
  primary: '#6366f1', // Indigo - اللون الرئيسي
  secondary: '#8b5cf6', // Purple
  success: '#22c55e', // Green
  danger: '#ef4444', // Red
  warning: '#f59e0b', // Amber
  info: '#0ea5e9', // Sky
  dark: '#1e293b', // Slate 800
  light: '#f8fafc', // Slate 50
  border: '#e2e8f0', // Slate 200
};

// الأنماط الأساسية للـ PDF
export const PDF_BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');
  
  * { 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box; 
  }
  
  body { 
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #1e293b;
    background: #fff;
    padding: 30px;
    direction: rtl;
  }
  
  .pdf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20px;
    margin-bottom: 25px;
    border-bottom: 3px solid ${PDF_COLORS.primary};
  }
  
  .pdf-logo-section {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .pdf-logo {
    height: 60px;
    width: auto;
    object-fit: contain;
  }
  
  .pdf-company-name {
    font-size: 28px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    letter-spacing: -0.5px;
  }
  
  .pdf-company-subtitle {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
  }
  
  .pdf-report-info {
    text-align: left;
  }
  
  .pdf-report-title {
    font-size: 20px;
    font-weight: 700;
    color: ${PDF_COLORS.dark};
    margin-bottom: 5px;
  }
  
  .pdf-report-meta {
    font-size: 11px;
    color: #64748b;
  }
  
  .pdf-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    background: linear-gradient(135deg, ${PDF_COLORS.light} 0%, #f1f5f9 100%);
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 25px;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-info-item {
    text-align: center;
  }
  
  .pdf-info-label {
    display: block;
    font-size: 10px;
    color: #64748b;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .pdf-info-value {
    font-size: 16px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
  }
  
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 25px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .pdf-table th {
    background: linear-gradient(135deg, ${PDF_COLORS.primary} 0%, ${PDF_COLORS.secondary} 100%);
    color: white;
    padding: 12px 10px;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
  }
  
  .pdf-table td {
    padding: 10px;
    border-bottom: 1px solid ${PDF_COLORS.border};
    text-align: center;
    font-size: 11px;
  }
  
  .pdf-table tr:nth-child(even) {
    background: ${PDF_COLORS.light};
  }
  
  .pdf-table tr:hover {
    background: #f1f5f9;
  }
  
  .pdf-table .text-right {
    text-align: right;
  }
  
  .pdf-table .text-left {
    text-align: left;
  }
  
  .pdf-table .font-bold {
    font-weight: 700;
  }
  
  .pdf-table .text-success {
    color: ${PDF_COLORS.success};
  }
  
  .pdf-table .text-danger {
    color: ${PDF_COLORS.danger};
  }
  
  .pdf-table .text-primary {
    color: ${PDF_COLORS.primary};
  }
  
  .pdf-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 15px;
    background: linear-gradient(135deg, ${PDF_COLORS.primary} 0%, ${PDF_COLORS.secondary} 100%);
    padding: 25px;
    border-radius: 12px;
    color: white;
    margin-bottom: 25px;
  }
  
  .pdf-summary-item {
    text-align: center;
  }
  
  .pdf-summary-label {
    display: block;
    font-size: 10px;
    opacity: 0.9;
    margin-bottom: 5px;
  }
  
  .pdf-summary-value {
    font-size: 18px;
    font-weight: 700;
  }
  
  .pdf-footer {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid ${PDF_COLORS.border};
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .pdf-footer-text {
    font-size: 10px;
    color: #94a3b8;
  }
  
  .pdf-signatures {
    display: flex;
    justify-content: space-around;
    margin-top: 40px;
    padding-top: 20px;
  }
  
  .pdf-signature-box {
    text-align: center;
    width: 180px;
  }
  
  .pdf-signature-label {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 40px;
  }
  
  .pdf-signature-line {
    border-top: 1px solid #333;
    padding-top: 5px;
    font-size: 11px;
  }
  
  .pdf-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
  }
  
  .pdf-badge-success {
    background: #dcfce7;
    color: #166534;
  }
  
  .pdf-badge-warning {
    background: #fef3c7;
    color: #92400e;
  }
  
  .pdf-badge-danger {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .pdf-badge-info {
    background: #dbeafe;
    color: #1e40af;
  }
  
  .pdf-badge-default {
    background: #f1f5f9;
    color: #475569;
  }
  
  @media print {
    body { 
      padding: 15px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none; }
  }
`;

// رأس التقرير مع الشعار
export function getPDFHeader(reportTitle: string, reportNumber?: string, reportDate?: string): string {
  const dateStr = reportDate || new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return `
    <div class="pdf-header">
      <div class="pdf-logo-section">
        <img src="/symbol-ai-logo.png" alt="Symbol AI" class="pdf-logo" />
        <div>
          <div class="pdf-company-name">Symbol AI</div>
          <div class="pdf-company-subtitle">نظام إدارة الأعمال المتكامل</div>
        </div>
      </div>
      <div class="pdf-report-info">
        <div class="pdf-report-title">${reportTitle}</div>
        ${reportNumber ? `<div class="pdf-report-meta">رقم التقرير: ${reportNumber}</div>` : ''}
        <div class="pdf-report-meta">تاريخ الإصدار: ${dateStr}</div>
      </div>
    </div>
  `;
}

// تذييل التقرير
export function getPDFFooter(pageInfo?: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `
    <div class="pdf-footer">
      <div class="pdf-footer-text">
        تم إنشاء هذا التقرير بواسطة Symbol AI - ${dateStr}
      </div>
      ${pageInfo ? `<div class="pdf-footer-text">${pageInfo}</div>` : ''}
    </div>
  `;
}

// قسم المعلومات
export function getPDFInfoSection(items: { label: string; value: string | number }[]): string {
  return `
    <div class="pdf-info-grid">
      ${items.map(item => `
        <div class="pdf-info-item">
          <span class="pdf-info-label">${item.label}</span>
          <span class="pdf-info-value">${item.value}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// قسم الملخص
export function getPDFSummarySection(items: { label: string; value: string | number }[]): string {
  return `
    <div class="pdf-summary-grid">
      ${items.map(item => `
        <div class="pdf-summary-item">
          <span class="pdf-summary-label">${item.label}</span>
          <span class="pdf-summary-value">${item.value}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// جدول البيانات
export function getPDFTable(
  headers: string[],
  rows: (string | number)[][],
  options?: {
    columnStyles?: Record<number, string>;
    totalRow?: (string | number)[];
  }
): string {
  return `
    <table class="pdf-table">
      <thead>
        <tr>
          ${headers.map(h => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map((cell, i) => {
              const style = options?.columnStyles?.[i] || '';
              return `<td class="${style}">${cell}</td>`;
            }).join('')}
          </tr>
        `).join('')}
        ${options?.totalRow ? `
          <tr style="background: linear-gradient(135deg, ${PDF_COLORS.primary} 0%, ${PDF_COLORS.secondary} 100%); color: white; font-weight: 700;">
            ${options.totalRow.map(cell => `<td style="border: none;">${cell}</td>`).join('')}
          </tr>
        ` : ''}
      </tbody>
    </table>
  `;
}

// قسم التوقيعات
export function getPDFSignatures(signatures: { label: string; name?: string }[]): string {
  return `
    <div class="pdf-signatures">
      ${signatures.map(sig => `
        <div class="pdf-signature-box">
          <div class="pdf-signature-label">${sig.label}</div>
          <div class="pdf-signature-line">${sig.name || ''}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// إنشاء مستند PDF كامل
export function createPDFDocument(
  title: string,
  content: string,
  options?: {
    reportNumber?: string;
    reportDate?: string;
    showFooter?: boolean;
  }
): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>${PDF_BASE_STYLES}</style>
    </head>
    <body>
      ${getPDFHeader(title, options?.reportNumber, options?.reportDate)}
      ${content}
      ${options?.showFooter !== false ? getPDFFooter() : ''}
    </body>
    </html>
  `;
}

// فتح نافذة الطباعة
export function openPrintWindow(htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

// تنسيق المبلغ
export function formatCurrency(amount: number | string, currency = 'ر.س'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${num.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// تنسيق التاريخ
export function formatDateAr(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// الحصول على اسم الشهر بالعربية
export function getArabicMonthName(month: number): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[month - 1] || '';
}
