/**
 * قوالب PDF الرسمية الموحدة - Symbol AI
 * تصميم احترافي موحد يليق بالشركات
 * مع ختم وتوقيعات رسمية
 */

// =====================================================
// الألوان الرسمية الموحدة
// =====================================================
export const PDF_COLORS = {
  // الألوان الأساسية - أزرق داكن رسمي
  primary: '#0f2744',      // أزرق داكن جداً - اللون الرئيسي
  primaryDark: '#0a1929',  // أزرق أغمق للتدرجات
  primaryLight: '#1a3a5c', // أزرق متوسط
  
  // ألوان الحالات
  success: '#1b5e20',      // أخضر داكن للموافقة
  successLight: '#e8f5e9', // أخضر فاتح للخلفيات
  warning: '#e65100',      // برتقالي للانتظار
  warningLight: '#fff3e0', // برتقالي فاتح
  danger: '#b71c1c',       // أحمر للرفض
  dangerLight: '#ffebee',  // أحمر فاتح
  
  // ألوان محايدة
  dark: '#1a1a2e',         // أسود مزرق
  text: '#2c3e50',         // لون النص الرئيسي
  textLight: '#607d8b',    // لون النص الثانوي
  border: '#e0e0e0',       // لون الحدود
  light: '#f8f9fa',        // خلفية فاتحة
  white: '#ffffff',        // أبيض
  
  // ألوان خاصة
  gold: '#c9a227',         // ذهبي للختم
  goldDark: '#8b6914',     // ذهبي داكن
};

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

// =====================================================
// الأنماط الأساسية للـ PDF
// =====================================================
export const PDF_BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
  
  * { 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box; 
  }
  
  body { 
    font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: ${PDF_COLORS.text};
    background: ${PDF_COLORS.white};
    padding: 20px 30px;
    direction: rtl;
    min-height: 100vh;
  }
  
  /* ===== الهيدر الرسمي ===== */
  .pdf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    margin-bottom: 20px;
    background: linear-gradient(135deg, ${PDF_COLORS.primary} 0%, ${PDF_COLORS.primaryDark} 100%);
    border-radius: 8px;
    color: ${PDF_COLORS.white};
    position: relative;
  }
  
  .pdf-header-right {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .pdf-logo {
    width: 60px;
    height: 60px;
    object-fit: contain;
    background: ${PDF_COLORS.white};
    border-radius: 8px;
    padding: 5px;
  }
  
  .pdf-company-info {
    text-align: right;
  }
  
  .pdf-company-name {
    font-size: 22px;
    font-weight: 800;
    color: ${PDF_COLORS.white};
    letter-spacing: 1px;
  }
  
  .pdf-company-subtitle {
    font-size: 11px;
    color: rgba(255,255,255,0.8);
    margin-top: 2px;
  }
  
  .pdf-header-left {
    text-align: left;
    background: rgba(255,255,255,0.1);
    padding: 10px 15px;
    border-radius: 6px;
  }
  
  .pdf-report-title {
    font-size: 16px;
    font-weight: 700;
    color: ${PDF_COLORS.white};
    margin-bottom: 5px;
  }
  
  .pdf-report-number {
    font-size: 11px;
    color: rgba(255,255,255,0.9);
    font-family: 'Courier New', monospace;
    background: rgba(0,0,0,0.2);
    padding: 2px 8px;
    border-radius: 4px;
    display: inline-block;
    margin-bottom: 3px;
  }
  
  .pdf-report-date {
    font-size: 10px;
    color: rgba(255,255,255,0.7);
  }
  
  /* ===== شارة الحالة ===== */
  .pdf-status-badge {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 20px;
    border-radius: 0 0 8px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  
  .pdf-status-approved {
    background: linear-gradient(135deg, ${PDF_COLORS.success} 0%, #2e7d32 100%);
    color: ${PDF_COLORS.white};
  }
  
  .pdf-status-pending {
    background: linear-gradient(135deg, ${PDF_COLORS.warning} 0%, #f57c00 100%);
    color: ${PDF_COLORS.white};
  }
  
  .pdf-status-draft {
    background: ${PDF_COLORS.border};
    color: ${PDF_COLORS.text};
  }
  
  /* ===== قسم المعلومات ===== */
  .pdf-info-section {
    background: ${PDF_COLORS.light};
    border: 1px solid ${PDF_COLORS.border};
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
  }
  
  .pdf-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }
  
  .pdf-info-item {
    text-align: center;
    padding: 10px;
    background: ${PDF_COLORS.white};
    border-radius: 6px;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-info-label {
    display: block;
    font-size: 9px;
    color: ${PDF_COLORS.textLight};
    margin-bottom: 4px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .pdf-info-value {
    font-size: 14px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
  }
  
  /* ===== الجداول ===== */
  .pdf-table-container {
    margin-bottom: 20px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .pdf-table th {
    background: ${PDF_COLORS.primary};
    color: ${PDF_COLORS.white};
    padding: 12px 10px;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    border-bottom: 2px solid ${PDF_COLORS.primaryDark};
  }
  
  .pdf-table td {
    padding: 10px 8px;
    border-bottom: 1px solid ${PDF_COLORS.border};
    text-align: center;
    font-size: 11px;
    background: ${PDF_COLORS.white};
  }
  
  .pdf-table tr:nth-child(even) td {
    background: ${PDF_COLORS.light};
  }
  
  .pdf-table tr:last-child td {
    border-bottom: none;
  }
  
  .pdf-table .text-right { text-align: right; padding-right: 15px; }
  .pdf-table .text-left { text-align: left; padding-left: 15px; }
  .pdf-table .font-bold { font-weight: 700; }
  .pdf-table .text-success { color: ${PDF_COLORS.success}; }
  .pdf-table .text-danger { color: ${PDF_COLORS.danger}; }
  .pdf-table .text-primary { color: ${PDF_COLORS.primary}; }
  .pdf-table .text-warning { color: ${PDF_COLORS.warning}; }
  
  .pdf-table-total {
    background: ${PDF_COLORS.primary} !important;
  }
  
  .pdf-table-total td {
    background: ${PDF_COLORS.primary} !important;
    color: ${PDF_COLORS.white} !important;
    font-weight: 700 !important;
    font-size: 12px !important;
    border: none !important;
  }
  
  /* ===== صندوق الإجمالي ===== */
  .pdf-total-box {
    background: linear-gradient(135deg, ${PDF_COLORS.primary} 0%, ${PDF_COLORS.primaryDark} 100%);
    color: ${PDF_COLORS.white};
    padding: 20px;
    border-radius: 8px;
    text-align: center;
    margin: 20px 0;
  }
  
  .pdf-total-label {
    font-size: 12px;
    opacity: 0.9;
    margin-bottom: 5px;
  }
  
  .pdf-total-value {
    font-size: 28px;
    font-weight: 800;
  }
  
  /* ===== قسم الملخص ===== */
  .pdf-summary-section {
    background: ${PDF_COLORS.primary};
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
  }
  
  .pdf-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 10px;
  }
  
  .pdf-summary-item {
    text-align: center;
    padding: 12px 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 6px;
  }
  
  .pdf-summary-label {
    display: block;
    font-size: 9px;
    color: rgba(255,255,255,0.8);
    margin-bottom: 5px;
    font-weight: 500;
  }
  
  .pdf-summary-value {
    font-size: 16px;
    font-weight: 800;
    color: ${PDF_COLORS.white};
  }
  
  /* ===== قسم التوقيعات والختم ===== */
  .pdf-approval-section {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 2px dashed ${PDF_COLORS.border};
  }
  
  .pdf-approval-header {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .pdf-approval-title {
    font-size: 14px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    background: ${PDF_COLORS.light};
    border-radius: 20px;
    border: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-approval-title.approved {
    background: ${PDF_COLORS.successLight};
    border-color: ${PDF_COLORS.success};
    color: ${PDF_COLORS.success};
  }
  
  .pdf-approval-title.pending {
    background: ${PDF_COLORS.warningLight};
    border-color: ${PDF_COLORS.warning};
    color: ${PDF_COLORS.warning};
  }
  
  .pdf-signatures-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 15px;
    margin-top: 15px;
  }
  
  .pdf-signature-box {
    flex: 1;
    text-align: center;
    padding: 20px;
    background: ${PDF_COLORS.white};
    border: 2px solid ${PDF_COLORS.border};
    border-radius: 10px;
    min-height: 180px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  
  .pdf-signature-box.has-signature {
    border-color: ${PDF_COLORS.success};
    background: ${PDF_COLORS.successLight};
  }
  
  .pdf-signature-title {
    font-size: 10px;
    color: ${PDF_COLORS.textLight};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }
  
  .pdf-signature-image-container {
    height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 10px 0;
  }
  
  .pdf-signature-image {
    max-height: 90px;
    max-width: 160px;
    object-fit: contain;
  }
  
  .pdf-signature-line {
    width: 80%;
    height: 1px;
    background: ${PDF_COLORS.border};
    margin: 10px auto;
  }
  
  .pdf-signature-name {
    font-size: 12px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    margin-top: 5px;
  }
  
  .pdf-signature-role {
    font-size: 9px;
    color: ${PDF_COLORS.textLight};
    margin-top: 2px;
  }
  
  .pdf-stamp-box {
    flex: 0 0 160px;
    text-align: center;
    padding: 15px;
  }
  
  .pdf-stamp-image {
    width: 140px;
    height: 140px;
    object-fit: contain;
  }
  
  .pdf-stamp-label {
    font-size: 9px;
    color: ${PDF_COLORS.textLight};
    margin-top: 5px;
  }
  
  /* ===== علامة مائية معتمد ===== */
  .pdf-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 100px;
    font-weight: 900;
    color: rgba(27, 94, 32, 0.06);
    pointer-events: none;
    z-index: 0;
    white-space: nowrap;
    letter-spacing: 10px;
  }
  
  /* ===== التذييل ===== */
  .pdf-footer {
    margin-top: 25px;
    padding-top: 15px;
    border-top: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    color: ${PDF_COLORS.textLight};
  }
  
  .pdf-footer-company {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .pdf-footer-logo {
    height: 20px;
    opacity: 0.6;
  }
  
  .pdf-footer-info {
    text-align: center;
  }
  
  .pdf-footer-date {
    text-align: left;
  }
  
  /* ===== عنوان القسم ===== */
  .pdf-section-title {
    font-size: 13px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
    margin: 20px 0 12px;
    padding: 8px 12px;
    background: ${PDF_COLORS.light};
    border-right: 4px solid ${PDF_COLORS.primary};
    border-radius: 0 6px 6px 0;
  }
  
  /* ===== البطاقات ===== */
  .pdf-card {
    background: ${PDF_COLORS.white};
    border: 1px solid ${PDF_COLORS.border};
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 15px;
  }
  
  .pdf-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid ${PDF_COLORS.border};
  }
  
  .pdf-card-title {
    font-size: 13px;
    font-weight: 700;
    color: ${PDF_COLORS.primary};
  }
  
  .pdf-card-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .pdf-card-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px dashed ${PDF_COLORS.border};
  }
  
  .pdf-card-item:last-child {
    border-bottom: none;
  }
  
  .pdf-card-label {
    font-size: 10px;
    color: ${PDF_COLORS.textLight};
  }
  
  .pdf-card-value {
    font-size: 11px;
    font-weight: 700;
    color: ${PDF_COLORS.text};
  }
  
  /* ===== الشارات ===== */
  .pdf-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 9px;
    font-weight: 700;
  }
  
  .pdf-badge-success {
    background: ${PDF_COLORS.successLight};
    color: ${PDF_COLORS.success};
  }
  
  .pdf-badge-warning {
    background: ${PDF_COLORS.warningLight};
    color: ${PDF_COLORS.warning};
  }
  
  .pdf-badge-danger {
    background: ${PDF_COLORS.dangerLight};
    color: ${PDF_COLORS.danger};
  }
  
  .pdf-badge-info {
    background: #e3f2fd;
    color: #1565c0;
  }
  
  .pdf-badge-default {
    background: ${PDF_COLORS.light};
    color: ${PDF_COLORS.text};
  }
  
  /* ===== ملاحظات ===== */
  .pdf-notes {
    background: #fffde7;
    border: 1px solid #fff59d;
    border-radius: 6px;
    padding: 12px;
    margin: 15px 0;
    font-size: 11px;
    color: #f57f17;
  }
  
  .pdf-notes-title {
    font-weight: 700;
    margin-bottom: 5px;
  }
  
  /* ===== طباعة ===== */
  @media print {
    body { 
      padding: 10px 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
    .pdf-watermark { position: absolute; }
    .pdf-header { break-inside: avoid; }
    .pdf-table { break-inside: auto; }
    .pdf-table tr { break-inside: avoid; }
    .pdf-approval-section { break-inside: avoid; }
  }
`;

// =====================================================
// دوال إنشاء أجزاء PDF
// =====================================================

/**
 * إنشاء هيدر التقرير
 */
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
  
  const hijriDate = new Date().toLocaleDateString('ar-SA-u-ca-islamic', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const statusBadge = options?.status ? `
    <div class="pdf-status-badge pdf-status-${options.status}">
      ${options.status === 'approved' ? '✓ معتمد' : options.status === 'pending' ? '⏳ قيد المراجعة' : '📝 مسودة'}
    </div>
  ` : '';
  
  return `
    <div class="pdf-header">
      ${statusBadge}
      <div class="pdf-header-right">
        <img src="${COMPANY_INFO.logo}" alt="${COMPANY_INFO.name}" class="pdf-logo" onerror="this.style.display='none'" />
        <div class="pdf-company-info">
          <div class="pdf-company-name">${COMPANY_INFO.name}</div>
          <div class="pdf-company-subtitle">${COMPANY_INFO.subtitle}</div>
        </div>
      </div>
      <div class="pdf-header-left">
        ${options?.reportNumber ? `<div class="pdf-report-number">${options.reportNumber}</div>` : ''}
        <div class="pdf-report-title">${reportTitle}</div>
        <div class="pdf-report-date">${hijriDate}</div>
        <div class="pdf-report-date">${dateStr}</div>
      </div>
    </div>
  `;
}

/**
 * إنشاء تذييل التقرير
 */
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
      <div class="pdf-footer-content">
        <div class="pdf-footer-company">
          <img src="${COMPANY_INFO.logo}" alt="${COMPANY_INFO.name}" class="pdf-footer-logo" onerror="this.style.display='none'" />
          <span>${COMPANY_INFO.name} - ${COMPANY_INFO.subtitle}</span>
        </div>
        <div class="pdf-footer-info">
          ${pageInfo || ''}
          <div>جميع الحقوق محفوظة © ${now.getFullYear()}</div>
        </div>
        <div class="pdf-footer-date">
          تم الطباعة: ${dateStr}
        </div>
      </div>
    </div>
  `;
}

/**
 * إنشاء قسم المعلومات
 */
export function getPDFInfoSection(items: { label: string; value: string | number }[]): string {
  return `
    <div class="pdf-info-section">
      <div class="pdf-info-grid">
        ${items.map(item => `
          <div class="pdf-info-item">
            <span class="pdf-info-label">${item.label}</span>
            <span class="pdf-info-value">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * إنشاء قسم الملخص
 */
export function getPDFSummarySection(items: { label: string; value: string | number }[]): string {
  return `
    <div class="pdf-summary-section">
      <div class="pdf-summary-grid">
        ${items.map(item => `
          <div class="pdf-summary-item">
            <span class="pdf-summary-label">${item.label}</span>
            <span class="pdf-summary-value">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * إنشاء جدول بيانات
 */
export function getPDFTable(
  headers: string[],
  rows: (string | number)[][],
  options?: {
    columnStyles?: Record<number, string>;
    totalRow?: (string | number)[];
  }
): string {
  return `
    <div class="pdf-table-container">
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
    </div>
  `;
}

/**
 * إنشاء صندوق الإجمالي
 */
export function getPDFTotalBox(label: string, value: string | number): string {
  return `
    <div class="pdf-total-box">
      <div class="pdf-total-label">${label}</div>
      <div class="pdf-total-value">${value}</div>
    </div>
  `;
}

/**
 * إنشاء قسم التوقيعات والختم - الإصدار الاحترافي
 */
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
  
  // إذا لم يكن معتمداً
  if (!isApproved) {
    return `
      <div class="pdf-approval-section">
        <div class="pdf-approval-header">
          <div class="pdf-approval-title pending">
            <span>⏳</span>
            <span>قيد المراجعة والاعتماد</span>
          </div>
        </div>
        <div class="pdf-signatures-row">
          <div class="pdf-signature-box">
            <div class="pdf-signature-title">توقيع المشرف العام</div>
            <div class="pdf-signature-image-container">
              <div style="color: ${PDF_COLORS.textLight}; font-size: 10px;">في انتظار التوقيع</div>
            </div>
            <div class="pdf-signature-line"></div>
            <div class="pdf-signature-name">${SIGNATURES.supervisor.name}</div>
            <div class="pdf-signature-role">${SIGNATURES.supervisor.title}</div>
          </div>
          
          <div class="pdf-stamp-box">
            <div style="width: 110px; height: 110px; border: 2px dashed ${PDF_COLORS.border}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
              <span style="color: ${PDF_COLORS.textLight}; font-size: 10px;">الختم</span>
            </div>
            <div class="pdf-stamp-label">ختم الإدارة</div>
          </div>
          
          <div class="pdf-signature-box">
            <div class="pdf-signature-title">توقيع المدير العام</div>
            <div class="pdf-signature-image-container">
              <div style="color: ${PDF_COLORS.textLight}; font-size: 10px;">في انتظار التوقيع</div>
            </div>
            <div class="pdf-signature-line"></div>
            <div class="pdf-signature-name">${SIGNATURES.manager.name}</div>
            <div class="pdf-signature-role">${SIGNATURES.manager.title}</div>
          </div>
        </div>
      </div>
    `;
  }
  
  // إذا كان معتمداً
  return `
    <div class="pdf-approval-section">
      <div class="pdf-approval-header">
        <div class="pdf-approval-title approved">
          <span>✓</span>
          <span>تم الاعتماد${options?.approvalDate ? ` - ${options.approvalDate}` : ''}</span>
        </div>
      </div>
      <div class="pdf-signatures-row">
        ${showSupervisor ? `
          <div class="pdf-signature-box has-signature">
            <div class="pdf-signature-title">توقيع المشرف العام</div>
            <div class="pdf-signature-image-container">
              <img src="${SIGNATURES.supervisor.image}" alt="توقيع المشرف" class="pdf-signature-image" onerror="this.parentElement.innerHTML='<span style=\\'color:${PDF_COLORS.success}\\'>✓ موقّع</span>'" />
            </div>
            <div class="pdf-signature-line"></div>
            <div class="pdf-signature-name">${SIGNATURES.supervisor.name}</div>
            <div class="pdf-signature-role">${SIGNATURES.supervisor.title}</div>
          </div>
        ` : ''}
        
        ${showStamp ? `
          <div class="pdf-stamp-box">
            <img src="${SIGNATURES.stamp.image}" alt="ختم الشركة" class="pdf-stamp-image" onerror="this.style.display='none'" />
            <div class="pdf-stamp-label">${SIGNATURES.stamp.label}</div>
          </div>
        ` : ''}
        
        ${showManager ? `
          <div class="pdf-signature-box has-signature">
            <div class="pdf-signature-title">توقيع المدير العام</div>
            <div class="pdf-signature-image-container">
              <img src="${SIGNATURES.manager.image}" alt="توقيع المدير" class="pdf-signature-image" onerror="this.parentElement.innerHTML='<span style=\\'color:${PDF_COLORS.success}\\'>✓ موقّع</span>'" />
            </div>
            <div class="pdf-signature-line"></div>
            <div class="pdf-signature-name">${SIGNATURES.manager.name}</div>
            <div class="pdf-signature-role">${SIGNATURES.manager.title}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * إنشاء قسم توقيعات بسيط (بدون صور)
 */
export function getPDFSignatures(signatures: { label: string; name?: string }[]): string {
  return `
    <div class="pdf-approval-section">
      <div class="pdf-signatures-row" style="justify-content: space-around;">
        ${signatures.map(sig => `
          <div class="pdf-signature-box">
            <div class="pdf-signature-title">${sig.label}</div>
            <div class="pdf-signature-image-container"></div>
            <div class="pdf-signature-line"></div>
            <div class="pdf-signature-name">${sig.name || '________________'}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * إنشاء عنوان قسم
 */
export function getPDFSectionTitle(title: string, icon?: string): string {
  return `
    <div class="pdf-section-title">
      ${icon ? `<span>${icon}</span>` : ''}
      ${title}
    </div>
  `;
}

/**
 * إنشاء بطاقة معلومات
 */
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
      <div class="pdf-card-grid">
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

/**
 * إنشاء صندوق ملاحظات
 */
export function getPDFNotes(title: string, content: string): string {
  return `
    <div class="pdf-notes">
      <div class="pdf-notes-title">📝 ${title}</div>
      <div>${content}</div>
    </div>
  `;
}

// =====================================================
// إنشاء مستند PDF كامل
// =====================================================

/**
 * إنشاء مستند PDF كامل
 */
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - ${COMPANY_INFO.name}</title>
      <style>${PDF_BASE_STYLES}</style>
    </head>
    <body>
      ${isApproved ? '<div class="pdf-watermark">معتمد</div>' : ''}
      
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

// =====================================================
// دوال مساعدة
// =====================================================

/**
 * فتح نافذة الطباعة
 */
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

/**
 * تنسيق المبلغ بالعملة
 */
export function formatCurrency(amount: number | string, currency = 'ر.س'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0.00 ${currency}`;
  return `${num.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * تنسيق التاريخ بالعربية
 */
export function formatDateAr(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * تنسيق التاريخ الهجري
 */
export function formatHijriDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA-u-ca-islamic', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * الحصول على اسم الشهر بالعربية
 */
export function getArabicMonthName(month: number): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[month - 1] || '';
}

/**
 * تنسيق الرقم بالعربية
 */
export function formatNumberAr(num: number): string {
  return num.toLocaleString('ar-SA');
}
