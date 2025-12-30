/**
 * قوالب PDF الرسمية الموحدة مع شعار Symbol AI
 * تصميم احترافي يليق بالشركات مع ختم وتوقيعات رسمية
 */

// ألوان البرنامج الرئيسية - نمط رسمي موحد
export const PDF_COLORS = {
  primary: '#1e3a5f', // أزرق داكن رسمي
  primaryLight: '#2c5282', // أزرق متوسط
  secondary: '#1a365d', // أزرق داكن جداً
  accent: '#3182ce', // أزرق فاتح للتأكيد
  success: '#276749', // أخضر داكن
  danger: '#c53030', // أحمر داكن
  warning: '#c05621', // برتقالي داكن
  dark: '#1a202c', // رمادي داكن جداً
  light: '#f7fafc', // رمادي فاتح جداً
  border: '#cbd5e0', // رمادي للحدود
  text: '#2d3748', // لون النص الأساسي
  textLight: '#718096', // لون النص الثانوي
  gold: '#d69e2e', // ذهبي للختم
};

// معلومات التوقيعات
export const SIGNATURES = {
  supervisor: {
    name: 'سالم الوادعي',
    title: 'المشرف العام',
    image: '/signatures/supervisor_signature.png'
  },
  manager: {
    name: 'عمر المطيري',
    title: 'المدير',
    image: '/signatures/manager_signature.png'
  },
  stamp: '/signatures/company_stamp.png'
};

// الأنماط الأساسية للـ PDF - تصميم رسمي
export const PDF_BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
  
  * { 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box; 
  }
  
  body { 
    font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
    font-size: 13px;
    line-height: 1.7;
    color: ${PDF_COLORS.text};
    background: #fff;
    padding: 25px 35px;
    direction: rtl;
  }
  
  /* الهيدر الرسمي */
  .pdf-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    margin-bottom: 25px;
    border-bottom: 3px solid ${PDF_COLORS.primary};
    position: relative;
  }
  
  .pdf-header::after {
    content: '';
    position: absolute;
    bottom: -6px;
    right: 0;
    width: 100%;
    height: 1px;
    background: ${PDF_COLORS.border};
  }
  
  .pdf-logo-section {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .pdf-logo {
    height: 65px;
    width: auto;
    object-fit: contain;
  }
  
  .pdf-company-info {
    border-right: 2px solid ${PDF_COLORS.primary};
    padding-right: 15px;
  }
  
  .pdf-company-name {
    font-size: 26px;
    font-weight: 800;
    color: ${PDF_COLORS.primary};
    letter-spacing: 0.5px;
  }
  
  .pdf-company-subtitle {
    font-size: 11px;
    color: ${PDF_COLORS.textLight};
    margin-top: 3px;
    font-weight: 500;
  }
  
  .pdf-report-info {
    text-align: left;
    background: ${PDF_COLORS.light};
    padding: 12px 18px;
    border-radius: 8px;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-report-title {
    font-size: 18px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    margin-bottom: 8px;
  }
  
  .pdf-report-meta {
    font-size: 11px;
    color: ${PDF_COLORS.textLight};
    margin-top: 3px;
  }
  
  .pdf-report-number {
    font-size: 12px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    background: white;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid ${PDF_COLORS.primary};
    display: inline-block;
    margin-bottom: 5px;
  }
  
  /* شارة الحالة */
  .pdf-status-badge {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 25px;
    border-radius: 0 0 12px 12px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .pdf-status-approved {
    background: linear-gradient(135deg, ${PDF_COLORS.success} 0%, #2f855a 100%);
    color: white;
  }
  
  .pdf-status-pending {
    background: linear-gradient(135deg, ${PDF_COLORS.warning} 0%, #dd6b20 100%);
    color: white;
  }
  
  .pdf-status-draft {
    background: ${PDF_COLORS.border};
    color: ${PDF_COLORS.text};
  }
  
  /* قسم المعلومات */
  .pdf-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    background: ${PDF_COLORS.light};
    padding: 18px;
    border-radius: 10px;
    margin-bottom: 25px;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-info-item {
    text-align: center;
    padding: 10px;
    background: white;
    border-radius: 8px;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-info-label {
    display: block;
    font-size: 10px;
    color: ${PDF_COLORS.textLight};
    margin-bottom: 5px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .pdf-info-value {
    font-size: 15px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
  }
  
  /* الجداول */
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 25px;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-table th {
    background: ${PDF_COLORS.primary};
    color: white;
    padding: 14px 12px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    border-bottom: 2px solid ${PDF_COLORS.secondary};
  }
  
  .pdf-table td {
    padding: 12px 10px;
    border-bottom: 1px solid ${PDF_COLORS.border};
    text-align: center;
    font-size: 12px;
    background: white;
  }
  
  .pdf-table tr:nth-child(even) td {
    background: ${PDF_COLORS.light};
  }
  
  .pdf-table tr:last-child td {
    border-bottom: none;
  }
  
  .pdf-table .text-right { text-align: right; }
  .pdf-table .text-left { text-align: left; }
  .pdf-table .font-bold { font-weight: 700; }
  .pdf-table .text-success { color: ${PDF_COLORS.success}; }
  .pdf-table .text-danger { color: ${PDF_COLORS.danger}; }
  .pdf-table .text-primary { color: ${PDF_COLORS.primary}; }
  
  .pdf-table-total {
    background: ${PDF_COLORS.primary} !important;
    color: white !important;
    font-weight: 700;
  }
  
  .pdf-table-total td {
    background: ${PDF_COLORS.primary} !important;
    color: white !important;
    border: none !important;
    font-size: 13px;
  }
  
  /* قسم الملخص */
  .pdf-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
    background: ${PDF_COLORS.primary};
    padding: 20px;
    border-radius: 10px;
    color: white;
    margin-bottom: 25px;
  }
  
  .pdf-summary-item {
    text-align: center;
    padding: 10px;
    background: rgba(255,255,255,0.1);
    border-radius: 8px;
  }
  
  .pdf-summary-label {
    display: block;
    font-size: 10px;
    opacity: 0.9;
    margin-bottom: 6px;
    font-weight: 500;
  }
  
  .pdf-summary-value {
    font-size: 18px;
    font-weight: 800;
  }
  
  /* قسم التوقيعات والختم */
  .pdf-approval-section {
    margin-top: 40px;
    padding-top: 25px;
    border-top: 2px solid ${PDF_COLORS.border};
  }
  
  .pdf-approval-title {
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    margin-bottom: 25px;
    padding-bottom: 10px;
    border-bottom: 1px dashed ${PDF_COLORS.border};
  }
  
  .pdf-signatures-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }
  
  .pdf-signature-box {
    flex: 1;
    text-align: center;
    padding: 15px;
    background: ${PDF_COLORS.light};
    border-radius: 10px;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-signature-title {
    font-size: 11px;
    color: ${PDF_COLORS.textLight};
    margin-bottom: 10px;
    font-weight: 500;
  }
  
  .pdf-signature-image {
    height: 50px;
    width: auto;
    max-width: 120px;
    object-fit: contain;
    margin: 10px auto;
    display: block;
  }
  
  .pdf-signature-name {
    font-size: 13px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-signature-role {
    font-size: 10px;
    color: ${PDF_COLORS.textLight};
    margin-top: 3px;
  }
  
  .pdf-stamp-box {
    flex: 0 0 150px;
    text-align: center;
    position: relative;
  }
  
  .pdf-stamp-image {
    width: 130px;
    height: 130px;
    object-fit: contain;
    opacity: 0.9;
  }
  
  .pdf-stamp-label {
    font-size: 10px;
    color: ${PDF_COLORS.textLight};
    margin-top: 5px;
  }
  
  /* شارة معتمد */
  .pdf-approved-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 80px;
    font-weight: 800;
    color: rgba(39, 103, 73, 0.08);
    pointer-events: none;
    z-index: 0;
    white-space: nowrap;
  }
  
  /* التذييل */
  .pdf-footer {
    margin-top: 30px;
    padding-top: 15px;
    border-top: 1px solid ${PDF_COLORS.border};
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .pdf-footer-text {
    font-size: 10px;
    color: ${PDF_COLORS.textLight};
  }
  
  .pdf-footer-logo {
    height: 25px;
    opacity: 0.5;
  }
  
  /* الشارات */
  .pdf-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
  }
  
  .pdf-badge-success {
    background: #c6f6d5;
    color: ${PDF_COLORS.success};
  }
  
  .pdf-badge-warning {
    background: #feebc8;
    color: ${PDF_COLORS.warning};
  }
  
  .pdf-badge-danger {
    background: #fed7d7;
    color: ${PDF_COLORS.danger};
  }
  
  .pdf-badge-info {
    background: #bee3f8;
    color: ${PDF_COLORS.accent};
  }
  
  .pdf-badge-default {
    background: ${PDF_COLORS.light};
    color: ${PDF_COLORS.text};
  }
  
  /* قسم العنوان */
  .pdf-section-title {
    font-size: 14px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    margin: 20px 0 15px;
    padding-bottom: 8px;
    border-bottom: 2px solid ${PDF_COLORS.primary};
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .pdf-section-icon {
    width: 20px;
    height: 20px;
    background: ${PDF_COLORS.primary};
    color: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }
  
  /* بطاقات المعلومات */
  .pdf-card {
    background: white;
    border: 1px solid ${PDF_COLORS.border};
    border-radius: 10px;
    padding: 18px;
    margin-bottom: 20px;
  }
  
  .pdf-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 12px;
    border-bottom: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-card-title {
    font-size: 14px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
  }
  
  .pdf-card-content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .pdf-card-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px dashed ${PDF_COLORS.border};
  }
  
  .pdf-card-item:last-child {
    border-bottom: none;
  }
  
  .pdf-card-label {
    font-size: 11px;
    color: ${PDF_COLORS.textLight};
  }
  
  .pdf-card-value {
    font-size: 12px;
    font-weight: 700;
    color: ${PDF_COLORS.text};
  }
  
  /* صندوق الإجمالي */
  .pdf-total-box {
    background: linear-gradient(135deg, ${PDF_COLORS.primary} 0%, ${PDF_COLORS.secondary} 100%);
    color: white;
    padding: 20px 25px;
    border-radius: 10px;
    text-align: center;
    margin: 20px 0;
  }
  
  .pdf-total-label {
    font-size: 12px;
    opacity: 0.9;
    margin-bottom: 8px;
  }
  
  .pdf-total-value {
    font-size: 28px;
    font-weight: 800;
  }
  
  @media print {
    body { 
      padding: 15px 25px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none; }
    .pdf-approved-watermark { position: absolute; }
  }
`;

// رأس التقرير مع الشعار
export function getPDFHeader(
  reportTitle: string, 
  options?: {
    reportNumber?: string;
    reportDate?: string;
    status?: 'approved' | 'pending' | 'draft';
  }
): string {
  const dateStr = options?.reportDate || new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const statusBadge = options?.status ? `
    <div class="pdf-status-badge pdf-status-${options.status}">
      ${options.status === 'approved' ? '✓ معتمد' : options.status === 'pending' ? '⏳ قيد المراجعة' : 'مسودة'}
    </div>
  ` : '';
  
  return `
    ${statusBadge}
    <div class="pdf-header">
      <div class="pdf-logo-section">
        <img src="/symbol-ai-logo.png" alt="Symbol AI" class="pdf-logo" onerror="this.style.display='none'" />
        <div class="pdf-company-info">
          <div class="pdf-company-name">Symbol AI</div>
          <div class="pdf-company-subtitle">نظام إدارة الأعمال المتكامل</div>
        </div>
      </div>
      <div class="pdf-report-info">
        ${options?.reportNumber ? `<div class="pdf-report-number">${options.reportNumber}</div>` : ''}
        <div class="pdf-report-title">${reportTitle}</div>
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
        تم إنشاء هذا المستند بواسطة Symbol AI - ${dateStr}
      </div>
      ${pageInfo ? `<div class="pdf-footer-text">${pageInfo}</div>` : ''}
      <div class="pdf-footer-text">
        جميع الحقوق محفوظة © ${now.getFullYear()}
      </div>
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
          <tr class="pdf-table-total">
            ${options.totalRow.map(cell => `<td>${cell}</td>`).join('')}
          </tr>
        ` : ''}
      </tbody>
    </table>
  `;
}

// قسم التوقيعات والختم - للمستندات المعتمدة
export function getPDFApprovalSection(options?: {
  showStamp?: boolean;
  showSupervisorSignature?: boolean;
  showManagerSignature?: boolean;
  isApproved?: boolean;
  approvalDate?: string;
}): string {
  const showStamp = options?.showStamp !== false;
  const showSupervisor = options?.showSupervisorSignature !== false;
  const showManager = options?.showManagerSignature !== false;
  const isApproved = options?.isApproved;
  
  if (!isApproved) {
    return `
      <div class="pdf-approval-section">
        <div class="pdf-approval-title">⏳ هذا المستند قيد المراجعة</div>
        <div style="text-align: center; color: ${PDF_COLORS.textLight}; font-size: 12px;">
          سيتم إضافة التوقيعات والختم بعد الاعتماد
        </div>
      </div>
    `;
  }
  
  return `
    <div class="pdf-approval-section">
      <div class="pdf-approval-title">✓ تم الاعتماد ${options?.approvalDate ? `- ${options.approvalDate}` : ''}</div>
      <div class="pdf-signatures-container">
        ${showSupervisor ? `
          <div class="pdf-signature-box">
            <div class="pdf-signature-title">توقيع المشرف العام</div>
            <img src="${SIGNATURES.supervisor.image}" alt="توقيع المشرف" class="pdf-signature-image" onerror="this.style.display='none'" />
            <div class="pdf-signature-name">${SIGNATURES.supervisor.name}</div>
            <div class="pdf-signature-role">${SIGNATURES.supervisor.title}</div>
          </div>
        ` : ''}
        
        ${showStamp ? `
          <div class="pdf-stamp-box">
            <img src="${SIGNATURES.stamp}" alt="ختم الشركة" class="pdf-stamp-image" onerror="this.style.display='none'" />
            <div class="pdf-stamp-label">ختم الإدارة</div>
          </div>
        ` : ''}
        
        ${showManager ? `
          <div class="pdf-signature-box">
            <div class="pdf-signature-title">توقيع المدير</div>
            <img src="${SIGNATURES.manager.image}" alt="توقيع المدير" class="pdf-signature-image" onerror="this.style.display='none'" />
            <div class="pdf-signature-name">${SIGNATURES.manager.name}</div>
            <div class="pdf-signature-role">${SIGNATURES.manager.title}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// قسم التوقيعات البسيط (بدون صور)
export function getPDFSignatures(signatures: { label: string; name?: string }[]): string {
  return `
    <div class="pdf-approval-section">
      <div class="pdf-signatures-container" style="justify-content: space-around;">
        ${signatures.map(sig => `
          <div class="pdf-signature-box">
            <div class="pdf-signature-title">${sig.label}</div>
            <div style="height: 50px; border-bottom: 1px solid ${PDF_COLORS.border}; margin: 15px 0;"></div>
            <div class="pdf-signature-name">${sig.name || '________________'}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// عنوان قسم
export function getPDFSectionTitle(title: string, icon?: string): string {
  return `
    <div class="pdf-section-title">
      ${icon ? `<span class="pdf-section-icon">${icon}</span>` : ''}
      ${title}
    </div>
  `;
}

// بطاقة معلومات
export function getPDFCard(
  title: string,
  items: { label: string; value: string | number }[],
  badge?: { text: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' }
): string {
  return `
    <div class="pdf-card">
      <div class="pdf-card-header">
        <div class="pdf-card-title">${title}</div>
        ${badge ? `<span class="pdf-badge pdf-badge-${badge.type}">${badge.text}</span>` : ''}
      </div>
      <div class="pdf-card-content">
        ${items.map(item => `
          <div class="pdf-card-item">
            <span class="pdf-card-label">${item.label}</span>
            <span class="pdf-card-value">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// صندوق الإجمالي
export function getPDFTotalBox(label: string, value: string | number): string {
  return `
    <div class="pdf-total-box">
      <div class="pdf-total-label">${label}</div>
      <div class="pdf-total-value">${value}</div>
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
    status?: 'approved' | 'pending' | 'draft';
    showFooter?: boolean;
    showApproval?: boolean;
    approvalOptions?: {
      showStamp?: boolean;
      showSupervisorSignature?: boolean;
      showManagerSignature?: boolean;
      approvalDate?: string;
    };
  }
): string {
  const isApproved = options?.status === 'approved';
  
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>${PDF_BASE_STYLES}</style>
    </head>
    <body>
      ${isApproved ? '<div class="pdf-approved-watermark">معتمد</div>' : ''}
      ${getPDFHeader(title, {
        reportNumber: options?.reportNumber,
        reportDate: options?.reportDate,
        status: options?.status
      })}
      ${content}
      ${options?.showApproval !== false ? getPDFApprovalSection({
        ...options?.approvalOptions,
        isApproved
      }) : ''}
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

// تنسيق التاريخ الهجري
export function formatHijriDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA-u-ca-islamic', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
