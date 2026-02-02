import puppeteer from 'puppeteer';

interface ReceiptVoucherData {
  voucherId: string;
  voucherDate: string;
  payeeName: string;
  totalAmount: string;
  status: string;
  createdByName: string;
  notes?: string;
  branchName?: string;
}

interface ReportData {
  title: string;
  periodType: string;
  startDate: string;
  endDate: string;
  branchName: string;
  statistics: {
    count: number;
    totalAmount: number;
    averageAmount: number;
  };
  receipts: ReceiptVoucherData[];
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'draft': return 'مسودة';
    case 'approved': return 'معتمد';
    case 'paid': return 'مدفوع';
    case 'cancelled': return 'ملغي';
    default: return status || '-';
  }
};

const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
};

/**
 * توليد PDF لسند قبض فردي
 */
export async function generateSingleReceiptVoucherPDF(voucher: {
  voucherId: string;
  voucherDate: Date | string;
  dueDateFrom?: Date | string | null;
  dueDateTo?: Date | string | null;
  payeeName: string;
  payeePhone?: string | null;
  payeeEmail?: string | null;
  branchName?: string | null;
  totalAmount: string | number;
  status: string;
  createdByName: string;
  createdAt: Date | string;
  notes?: string | null;
  items: Array<{
    description: string;
    amount: string | number;
    notes?: string | null;
  }>;
}): Promise<Buffer> {
  // تنسيق التاريخ بالميلادي (DD/MM/YYYY)
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'غير محدد';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrencyLocal = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
  };

  const getStatusLabelLocal = (status: string): string => {
    switch (status) {
      case 'draft': return 'مسودة';
      case 'approved': return 'معتمد';
      case 'paid': return 'مدفوع';
      case 'cancelled': return 'ملغي';
      default: return status || '-';
    }
  };

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>سند قبض - ${voucher.voucherId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', 'Arial', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 40px;
      direction: rtl;
    }
    
    .voucher-container {
      max-width: 800px;
      margin: 0 auto;
      border: 3px solid #1a1a1a;
      padding: 0;
    }
    
    /* رأس السند */
    .header {
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
      padding: 25px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logo-section {
      text-align: right;
    }
    
    .logo {
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 5px;
    }
    
    .company-name {
      font-size: 12px;
      opacity: 0.9;
    }
    
    .voucher-title-section {
      text-align: center;
    }
    
    .voucher-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .voucher-subtitle {
      font-size: 12px;
      opacity: 0.8;
    }
    
    .voucher-number-section {
      text-align: left;
      background: rgba(255,255,255,0.1);
      padding: 15px 20px;
      border-radius: 8px;
    }
    
    .voucher-number-label {
      font-size: 11px;
      opacity: 0.8;
      margin-bottom: 3px;
    }
    
    .voucher-number {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    
    /* معلومات السند */
    .info-bar {
      display: flex;
      justify-content: space-between;
      background: #f5f5f5;
      padding: 15px 30px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .info-item {
      text-align: center;
    }
    
    .info-label {
      font-size: 11px;
      color: #666;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    /* بيانات المستلم */
    .recipient-section {
      padding: 25px 30px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #1a1a1a;
      display: inline-block;
    }
    
    .recipient-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    
    .recipient-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .recipient-label {
      font-size: 12px;
      color: #666;
      min-width: 80px;
    }
    
    .recipient-value {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    /* جدول البنود */
    .items-section {
      padding: 25px 30px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    th {
      background: #1a1a1a;
      color: #fff;
      padding: 12px 15px;
      text-align: right;
      font-weight: 600;
      font-size: 13px;
    }
    
    th:last-child {
      text-align: left;
    }
    
    td {
      padding: 15px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 14px;
    }
    
    td:last-child {
      text-align: left;
      font-weight: 600;
    }
    
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    
    .total-row {
      background: #f0f0f0 !important;
    }
    
    .total-row td {
      font-weight: 700;
      font-size: 16px;
      padding: 18px 15px;
      border-top: 3px solid #1a1a1a;
    }
    
    .total-amount {
      font-size: 20px;
      color: #006600;
    }
    
    /* الملاحظات */
    .notes-section {
      padding: 20px 30px;
      background: #fffef0;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .notes-content {
      font-size: 13px;
      color: #666;
      line-height: 1.8;
    }
    
    /* التوقيعات */
    .signatures-section {
      padding: 40px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fafafa;
      border-top: 1px solid #e0e0e0;
    }
    
    .signature-box {
      text-align: center;
      width: 220px;
      padding: 20px;
    }
    
    .signature-image-container {
      height: 80px;
      margin-bottom: 15px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    
    .signature-image {
      max-height: 70px;
      max-width: 150px;
      object-fit: contain;
    }
    
    .signature-handwriting {
      font-family: 'Brush Script MT', 'Segoe Script', cursive;
      font-size: 28px;
      color: #1a4a7a;
      font-style: italic;
      margin-bottom: 5px;
    }
    
    .signature-line {
      border-top: 2px solid #333;
      padding-top: 15px;
      margin-top: 10px;
    }
    
    .signature-name {
      font-weight: 700;
      font-size: 18px;
      color: #1a4a7a;
      margin-bottom: 5px;
    }
    
    .signature-title {
      font-size: 14px;
      color: #666;
    }
    
    .stamp-box {
      text-align: center;
      padding: 10px;
    }
    
    .stamp {
      width: 140px;
      height: 140px;
      border: 4px solid #1a4a7a;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #1a4a7a;
      background: rgba(26, 74, 122, 0.03);
      position: relative;
    }
    
    .stamp::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border: 2px solid #1a4a7a;
      border-radius: 50%;
    }
    
    .stamp-inner {
      text-align: center;
      z-index: 1;
    }
    
    .stamp-logo {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 5px;
      letter-spacing: 1px;
    }
    
    .stamp-arabic {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    
    .stamp-text {
      font-size: 11px;
      opacity: 0.8;
    }
    
    /* ختم الاعتماد */
    .approval-stamp {
      position: absolute;
      top: -15px;
      right: -15px;
      width: 80px;
      height: 80px;
      border: 4px solid #16a34a;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(22, 163, 74, 0.1);
      transform: rotate(-15deg);
      box-shadow: 0 2px 8px rgba(22, 163, 74, 0.3);
    }
    
    .approval-stamp-inner {
      text-align: center;
    }
    
    .approval-text {
      font-size: 18px;
      font-weight: 800;
      color: #16a34a;
      letter-spacing: 2px;
    }
    
    .approval-date {
      font-size: 9px;
      color: #16a34a;
      margin-top: 2px;
    }
    
    .stamp-box {
      position: relative;
    }
    
    /* ذيل السند */
    .footer {
      background: #f5f5f5;
      padding: 15px 30px;
      text-align: center;
      font-size: 11px;
      color: #666;
      border-top: 2px solid #e0e0e0;
    }
    
    .footer-info {
      margin-bottom: 5px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .status-draft { background: #e0e0e0; color: #666; }
    .status-approved { background: #e3f2fd; color: #1565c0; }
    .status-paid { background: #e8f5e9; color: #2e7d32; }
    .status-cancelled { background: #ffebee; color: #c62828; }
    
    @media print {
      body { padding: 0; }
      .voucher-container { border: 2px solid #1a1a1a; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="voucher-container">
    <!-- رأس السند -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">Symbol AI</div>
        <div class="company-name">سيمبول للذكاء الاصطناعي</div>
      </div>
      <div class="voucher-title-section">
        <div class="voucher-title">سند قبض</div>
        <div class="voucher-subtitle">Receipt Voucher</div>
      </div>
      <div class="voucher-number-section">
        <div class="voucher-number-label">رقم السند</div>
        <div class="voucher-number">${voucher.voucherId}</div>
      </div>
    </div>
    
    <!-- معلومات السند -->
    <div class="info-bar">
      <div class="info-item">
        <div class="info-label">تاريخ السند</div>
        <div class="info-value">${formatDate(voucher.voucherDate)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">من تاريخ</div>
        <div class="info-value">${formatDate(voucher.dueDateFrom)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">إلى تاريخ</div>
        <div class="info-value">${formatDate(voucher.dueDateTo)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">الفرع</div>
        <div class="info-value">${voucher.branchName || 'غير محدد'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">الحالة</div>
        <div class="info-value">
          <span class="status-badge status-${voucher.status}">${getStatusLabelLocal(voucher.status)}</span>
        </div>
      </div>
    </div>
    
    <!-- بيانات المستلم -->
    <div class="recipient-section">
      <div class="section-title">بيانات المستلم</div>
      <div class="recipient-grid">
        <div class="recipient-item">
          <span class="recipient-label">الاسم:</span>
          <span class="recipient-value">${voucher.payeeName}</span>
        </div>
        <div class="recipient-item">
          <span class="recipient-label">رقم الجوال:</span>
          <span class="recipient-value">${voucher.payeePhone || 'غير محدد'}</span>
        </div>
        <div class="recipient-item">
          <span class="recipient-label">البريد:</span>
          <span class="recipient-value">${voucher.payeeEmail || 'غير محدد'}</span>
        </div>
      </div>
    </div>
    
    <!-- جدول البنود -->
    <div class="items-section">
      <div class="section-title">تفاصيل السند</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>الوصف</th>
            <th>الملاحظات</th>
            <th style="width: 150px;">المبلغ (ر.س)</th>
          </tr>
        </thead>
        <tbody>
          ${voucher.items.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.description}</td>
              <td>${item.notes || '-'}</td>
              <td>${formatCurrencyLocal(item.amount)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-align: left; font-size: 16px;">الإجمالي</td>
            <td class="total-amount">${formatCurrencyLocal(voucher.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    ${voucher.notes ? `
    <!-- الملاحظات -->
    <div class="notes-section">
      <div class="section-title">ملاحظات</div>
      <div class="notes-content">${voucher.notes}</div>
    </div>
    ` : ''}
    
    <!-- التوقيعات -->
    <div class="signatures-section">
      <div class="signature-box">
        <div class="signature-image-container">
          <svg width="120" height="50" viewBox="0 0 120 50" style="opacity: 0.85;">
            <path d="M10,35 Q20,10 40,30 T70,25 Q90,20 110,30" stroke="#1a4a7a" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M15,40 Q30,35 50,38" stroke="#1a4a7a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="signature-line">
          <div class="signature-name">سالم الوادعي</div>
          <div class="signature-title">مدير المالية</div>
        </div>
      </div>
      
      <div class="stamp-box">
        <div class="stamp">
          <div class="stamp-inner">
            <div class="stamp-arabic">الإدارة</div>
            <div class="stamp-logo">Symbol AI</div>
            <div class="stamp-text">الإدارة المالية</div>
          </div>
        </div>
        ${voucher.status === 'approved' ? `
        <div class="approval-stamp">
          <div class="approval-stamp-inner">
            <div class="approval-text">معتمد</div>
            <div class="approval-date">${formatDate(new Date())}</div>
          </div>
        </div>
        ` : ''}
      </div>
      
      <div class="signature-box">
        <div class="signature-image-container">
          <svg width="120" height="50" viewBox="0 0 120 50" style="opacity: 0.85;">
            <path d="M15,30 Q35,5 55,25 T85,20 Q100,18 110,25" stroke="#1a4a7a" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M20,38 Q40,42 60,36 T90,40" stroke="#1a4a7a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="signature-line">
          <div class="signature-name">عمر المطيري</div>
          <div class="signature-title">المراجع المالي</div>
        </div>
      </div>
    </div>
    
    <!-- ذيل السند -->
    <div class="footer">
      <div class="footer-info">تم الإنشاء بواسطة: ${voucher.createdByName} | التاريخ: ${formatDate(voucher.createdAt)}</div>
      <div>نظام Symbol AI لإدارة الموارد | جميع الحقوق محفوظة</div>
    </div>
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '10mm',
        bottom: '15mm',
        left: '10mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * توليد PDF لتقرير سندات القبض
 */
export async function generateReceiptVoucherReportPDF(data: ReportData): Promise<Buffer> {
  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير سندات القبض</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 30px;
      direction: rtl;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #1a1a1a;
    }
    
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    
    .company-name {
      font-size: 14px;
      color: #666;
      margin-bottom: 15px;
    }
    
    .report-title {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
      margin-top: 15px;
    }
    
    .report-number {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
      padding: 15px;
      background: #f8f8f8;
      border-radius: 8px;
    }
    
    .info-item {
      text-align: center;
    }
    
    .info-label {
      font-size: 11px;
      color: #666;
      margin-bottom: 5px;
    }
    
    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .summary-section {
      display: flex;
      justify-content: space-around;
      margin-bottom: 30px;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      border-radius: 10px;
      color: #fff;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-label {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 8px;
    }
    
    .summary-value {
      font-size: 24px;
      font-weight: 700;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    th {
      background: #1a1a1a;
      color: #fff;
      padding: 12px 10px;
      text-align: right;
      font-weight: 600;
      font-size: 12px;
    }
    
    td {
      padding: 10px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 11px;
    }
    
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    
    tr:hover {
      background: #f0f0f0;
    }
    
    .status-draft { color: #666; }
    .status-approved { color: #0066cc; }
    .status-paid { color: #006600; font-weight: 600; }
    .status-cancelled { color: #cc0000; text-decoration: line-through; }
    
    .total-row {
      background: #f5f5f5 !important;
      font-weight: 700;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
    }
    
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
    }
    
    .signature-box {
      text-align: center;
      width: 200px;
    }
    
    .signature-line {
      border-top: 1px solid #1a1a1a;
      margin-top: 50px;
      padding-top: 10px;
    }
    
    .signature-name {
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .signature-title {
      font-size: 11px;
      color: #666;
    }
    
    .stamp-area {
      text-align: center;
      margin-top: 20px;
    }
    
    .stamp {
      width: 100px;
      height: 100px;
      border: 3px solid #1a1a1a;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: #1a1a1a;
    }
    
    .print-info {
      text-align: center;
      margin-top: 30px;
      font-size: 10px;
      color: #999;
    }
    
    @media print {
      body { padding: 20px; }
      .summary-section { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Symbol AI</div>
    <div class="company-name">سيمبول للذكاء الاصطناعي - صالونات قصه وتخفيف وفروعها</div>
    <div class="report-title">${data.title}</div>
    <div class="report-number">رقم التقرير: RVR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}</div>
  </div>
  
  <div class="info-section">
    <div class="info-item">
      <div class="info-label">نوع الفترة</div>
      <div class="info-value">${data.periodType}</div>
    </div>
    <div class="info-item">
      <div class="info-label">من تاريخ</div>
      <div class="info-value">${data.startDate}</div>
    </div>
    <div class="info-item">
      <div class="info-label">إلى تاريخ</div>
      <div class="info-value">${data.endDate}</div>
    </div>
    <div class="info-item">
      <div class="info-label">الفرع</div>
      <div class="info-value">${data.branchName}</div>
    </div>
  </div>
  
  <div class="summary-section">
    <div class="summary-item">
      <div class="summary-label">عدد السندات</div>
      <div class="summary-value">${data.statistics.count}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">إجمالي المبالغ</div>
      <div class="summary-value">${formatCurrency(data.statistics.totalAmount)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">المتوسط</div>
      <div class="summary-value">${formatCurrency(data.statistics.averageAmount)}</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>رقم السند</th>
        <th>التاريخ</th>
        <th>المدفوع له</th>
        <th>المبلغ الكلي</th>
        <th>المشرف</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${data.receipts.length === 0 ? `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px;">لا توجد سندات في الفترة المحددة</td>
        </tr>
      ` : data.receipts.map((receipt, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${receipt.voucherId}</td>
          <td>${receipt.voucherDate}</td>
          <td>${receipt.payeeName || '-'}</td>
          <td>${formatCurrency(parseFloat(receipt.totalAmount) || 0)}</td>
          <td>${receipt.createdByName || '-'}</td>
          <td class="status-${receipt.status || 'draft'}">${getStatusLabel(receipt.status)}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="4" style="text-align: left;">الإجمالي</td>
        <td>${formatCurrency(data.statistics.totalAmount)}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>
  
  <div class="footer">
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-line">
          <div class="signature-name">سالم الوادعي</div>
          <div class="signature-title">مدير المالية</div>
        </div>
      </div>
      <div class="signature-box">
        <div class="stamp">
          <div>Symbol AI<br/>الإدارة</div>
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          <div class="signature-name">عمر المطيري</div>
          <div class="signature-title">المراجع المالي</div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="print-info">
    تم إنشاء هذا التقرير بواسطة نظام Symbol AI | التاريخ: ${new Date().toLocaleDateString('ar-SA')} | الوقت: ${new Date().toLocaleTimeString('ar-SA')}
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}


/**
 * بيانات تقرير البونص الأسبوعي
 */
interface WeeklyBonusReportData {
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  status: string;
  totalAmount: number;
  eligibleCount: number;
  totalEmployees: number;
  requestedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  paidAt?: Date | string | null;
  requestedByName?: string;
  approvedByName?: string;
  paidByName?: string;
  paymentMethod?: string;
  paymentReference?: string;
  employees: Array<{
    name: string;
    code: string;
    weeklyRevenue: number;
    tier: string;
    bonusAmount: number;
    isEligible: boolean;
  }>;
}

const getBonusStatusLabel = (status: string): string => {
  switch (status) {
    case 'pending': return 'مسودة';
    case 'requested': return 'قيد المراجعة';
    case 'approved': return 'موافق عليه';
    case 'rejected': return 'مرفوض';
    case 'paid': return 'مصروف';
    default: return status || '-';
  }
};

const getTierLabel = (tier: string): string => {
  switch (tier) {
    case 'tier_7': return 'المستوى 7';
    case 'tier_6': return 'المستوى 6';
    case 'tier_5': return 'المستوى 5';
    case 'tier_4': return 'المستوى 4';
    case 'tier_3': return 'المستوى 3';
    case 'tier_2': return 'المستوى 2';
    case 'tier_1': return 'المستوى 1';
    case 'none': return 'غير مؤهل';
    default: return tier || '-';
  }
};

const getTierColor = (tier: string): string => {
  switch (tier) {
    case 'tier_7': return '#9333ea'; // purple
    case 'tier_6': return '#a855f7';
    case 'tier_5': return '#2563eb'; // blue
    case 'tier_4': return '#3b82f6';
    case 'tier_3': return '#22c55e'; // green
    case 'tier_2': return '#eab308'; // yellow
    case 'tier_1': return '#f97316'; // orange
    case 'none': return '#9ca3af'; // gray
    default: return '#6b7280';
  }
};

const getPaymentMethodLabel = (method: string | undefined): string => {
  switch (method) {
    case 'cash': return 'نقداً';
    case 'bank_transfer': return 'تحويل بنكي';
    case 'check': return 'شيك';
    default: return method || '-';
  }
};

const getMonthName = (month: number): string => {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[month - 1] || '';
};

/**
 * توليد PDF لتقرير البونص الأسبوعي
 */
export async function generateWeeklyBonusReportPDF(data: WeeklyBonusReportData): Promise<Buffer> {
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'غير محدد';
    const d = new Date(date);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrencyLocal = (amount: number): string => {
    return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
  };

  // حساب إحصائيات إضافية
  const eligibleEmployees = data.employees.filter(e => e.isEligible);
  const totalRevenue = eligibleEmployees.reduce((sum, e) => sum + e.weeklyRevenue, 0);
  const avgBonus = eligibleEmployees.length > 0 ? data.totalAmount / eligibleEmployees.length : 0;
  const avgRevenue = eligibleEmployees.length > 0 ? totalRevenue / eligibleEmployees.length : 0;

  // تجميع حسب المستوى
  const tierStats = eligibleEmployees.reduce((acc, emp) => {
    if (!acc[emp.tier]) {
      acc[emp.tier] = { count: 0, total: 0 };
    }
    acc[emp.tier].count++;
    acc[emp.tier].total += emp.bonusAmount;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير البونص الأسبوعي - ${data.branchName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 30px;
      direction: rtl;
    }
    
    .report-container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    /* رأس التقرير */
    .header {
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
      padding: 25px 30px;
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logo-section {
      text-align: right;
    }
    
    .logo {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 5px;
    }
    
    .company-name {
      font-size: 11px;
      opacity: 0.9;
    }
    
    .report-title-section {
      text-align: center;
      flex: 1;
    }
    
    .report-title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .report-subtitle {
      font-size: 11px;
      opacity: 0.8;
    }
    
    .status-section {
      text-align: left;
      background: rgba(255,255,255,0.1);
      padding: 12px 18px;
      border-radius: 8px;
    }
    
    .status-label {
      font-size: 10px;
      opacity: 0.8;
      margin-bottom: 3px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .status-pending { background: #6b7280; color: #fff; }
    .status-requested { background: #3b82f6; color: #fff; }
    .status-approved { background: #22c55e; color: #fff; }
    .status-rejected { background: #ef4444; color: #fff; }
    .status-paid { background: #9333ea; color: #fff; }
    
    /* معلومات التقرير */
    .info-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      background: #f5f5f5;
      padding: 20px 25px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .info-item {
      text-align: center;
      padding: 10px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .info-label {
      font-size: 10px;
      color: #666;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a1a;
    }
    
    .info-value.highlight {
      color: #22c55e;
      font-size: 16px;
    }
    
    /* بطاقات الإحصائيات */
    .stats-section {
      padding: 20px 25px;
      background: #fff;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #1a1a1a;
      display: inline-block;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      padding: 15px;
      border-radius: 10px;
      text-align: center;
      border: 1px solid #dee2e6;
    }
    
    .stat-card.primary {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: #fff;
      border: none;
    }
    
    .stat-value {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 5px;
    }
    
    .stat-label {
      font-size: 10px;
      opacity: 0.8;
    }
    
    /* توزيع المستويات */
    .tier-section {
      padding: 20px 25px;
      background: #fafafa;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .tier-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    
    .tier-card {
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      color: #fff;
    }
    
    .tier-count {
      font-size: 18px;
      font-weight: 800;
    }
    
    .tier-name {
      font-size: 10px;
      margin-top: 3px;
    }
    
    .tier-amount {
      font-size: 11px;
      margin-top: 5px;
      opacity: 0.9;
    }
    
    /* جدول الموظفين */
    .employees-section {
      padding: 20px 25px;
      background: #fff;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    th {
      background: #1a1a1a;
      color: #fff;
      padding: 12px 10px;
      text-align: right;
      font-weight: 600;
      font-size: 11px;
    }
    
    th:first-child {
      border-radius: 0 8px 0 0;
    }
    
    th:last-child {
      border-radius: 8px 0 0 0;
      text-align: left;
    }
    
    td {
      padding: 12px 10px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 11px;
    }
    
    td:last-child {
      text-align: left;
      font-weight: 700;
    }
    
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    
    tr:hover {
      background: #f0f0f0;
    }
    
    .employee-name {
      font-weight: 600;
    }
    
    .employee-code {
      color: #666;
      font-size: 10px;
    }
    
    .tier-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 15px;
      font-size: 10px;
      font-weight: 600;
      color: #fff;
    }
    
    .bonus-amount {
      color: #22c55e;
      font-weight: 700;
    }
    
    .not-eligible {
      color: #9ca3af;
      font-style: italic;
    }
    
    .total-row {
      background: #f0f0f0 !important;
    }
    
    .total-row td {
      font-weight: 700;
      font-size: 13px;
      padding: 15px 10px;
      border-top: 3px solid #1a1a1a;
    }
    
    .total-amount {
      font-size: 16px;
      color: #22c55e;
    }
    
    /* معلومات الصرف */
    .payment-section {
      padding: 20px 25px;
      background: #f0fdf4;
      border-bottom: 2px solid #bbf7d0;
    }
    
    .payment-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    
    .payment-item {
      text-align: center;
    }
    
    .payment-label {
      font-size: 10px;
      color: #166534;
      margin-bottom: 4px;
    }
    
    .payment-value {
      font-size: 13px;
      font-weight: 600;
      color: #15803d;
    }
    
    /* التوقيعات */
    .signatures-section {
      padding: 30px 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      background: #fafafa;
      border-top: 1px solid #e0e0e0;
    }
    
    .signature-box {
      text-align: center;
      width: 180px;
    }
    
    .signature-line {
      border-top: 2px solid #333;
      padding-top: 10px;
      margin-top: 50px;
    }
    
    .signature-name {
      font-weight: 700;
      font-size: 13px;
      color: #1a4a7a;
      margin-bottom: 3px;
    }
    
    .signature-title {
      font-size: 11px;
      color: #666;
    }
    
    .stamp {
      width: 100px;
      height: 100px;
      border: 3px solid #1a4a7a;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #1a4a7a;
      font-size: 11px;
      margin: 0 auto;
    }
    
    /* ذيل التقرير */
    .footer {
      background: #f5f5f5;
      padding: 15px 25px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-radius: 0 0 12px 12px;
      border-top: 2px solid #e0e0e0;
    }
    
    @media print {
      body { padding: 0; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .stat-card.primary { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .tier-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- رأس التقرير -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">Symbol AI</div>
        <div class="company-name">سيمبول للذكاء الاصطناعي</div>
      </div>
      <div class="report-title-section">
        <div class="report-title">تقرير البونص الأسبوعي</div>
        <div class="report-subtitle">Weekly Bonus Report</div>
      </div>
      <div class="status-section">
        <div class="status-label">الحالة</div>
        <span class="status-badge status-${data.status}">${getBonusStatusLabel(data.status)}</span>
      </div>
    </div>
    
    <!-- معلومات التقرير -->
    <div class="info-bar">
      <div class="info-item">
        <div class="info-label">الفرع</div>
        <div class="info-value">${data.branchName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">الأسبوع</div>
        <div class="info-value">الأسبوع ${data.weekNumber}</div>
      </div>
      <div class="info-item">
        <div class="info-label">الشهر</div>
        <div class="info-value">${getMonthName(data.month)} ${data.year}</div>
      </div>
      <div class="info-item">
        <div class="info-label">إجمالي البونص</div>
        <div class="info-value highlight">${formatCurrencyLocal(data.totalAmount)}</div>
      </div>
    </div>
    
    <!-- الإحصائيات -->
    <div class="stats-section">
      <div class="section-title">ملخص الإحصائيات</div>
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-value">${formatCurrencyLocal(data.totalAmount)}</div>
          <div class="stat-label">إجمالي البونص</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.eligibleCount}/${data.totalEmployees}</div>
          <div class="stat-label">الموظفين المؤهلين</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrencyLocal(avgBonus)}</div>
          <div class="stat-label">متوسط البونص</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrencyLocal(totalRevenue)}</div>
          <div class="stat-label">إجمالي الإيرادات</div>
        </div>
      </div>
    </div>
    
    <!-- توزيع المستويات -->
    ${Object.keys(tierStats).length > 0 ? `
    <div class="tier-section">
      <div class="section-title">توزيع المستويات</div>
      <div class="tier-grid">
        ${Object.entries(tierStats)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([tier, stats]) => `
            <div class="tier-card" style="background: ${getTierColor(tier)}">
              <div class="tier-count">${stats.count}</div>
              <div class="tier-name">${getTierLabel(tier)}</div>
              <div class="tier-amount">${formatCurrencyLocal(stats.total)}</div>
            </div>
          `).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- جدول الموظفين -->
    <div class="employees-section">
      <div class="section-title">تفاصيل الموظفين</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الموظف</th>
            <th>الكود</th>
            <th>الإيراد الأسبوعي</th>
            <th>المستوى</th>
            <th>البونص</th>
          </tr>
        </thead>
        <tbody>
          ${data.employees.map((emp, index) => `
            <tr class="${!emp.isEligible ? 'not-eligible' : ''}">
              <td>${index + 1}</td>
              <td class="employee-name">${emp.name}</td>
              <td class="employee-code">${emp.code || '-'}</td>
              <td>${formatCurrencyLocal(emp.weeklyRevenue)}</td>
              <td>
                <span class="tier-badge" style="background: ${getTierColor(emp.tier)}">${getTierLabel(emp.tier)}</span>
              </td>
              <td class="bonus-amount">${emp.isEligible ? formatCurrencyLocal(emp.bonusAmount) : '-'}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3">الإجمالي</td>
            <td>${formatCurrencyLocal(totalRevenue)}</td>
            <td>${data.eligibleCount} مؤهل</td>
            <td class="total-amount">${formatCurrencyLocal(data.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- معلومات الصرف (إذا كان مصروف) -->
    ${data.status === 'paid' ? `
    <div class="payment-section">
      <div class="section-title" style="color: #166534; border-color: #22c55e;">معلومات الصرف</div>
      <div class="payment-grid">
        <div class="payment-item">
          <div class="payment-label">تاريخ الصرف</div>
          <div class="payment-value">${formatDate(data.paidAt)}</div>
        </div>
        <div class="payment-item">
          <div class="payment-label">طريقة الدفع</div>
          <div class="payment-value">${getPaymentMethodLabel(data.paymentMethod)}</div>
        </div>
        <div class="payment-item">
          <div class="payment-label">مرجع الدفع</div>
          <div class="payment-value">${data.paymentReference || '-'}</div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- التوقيعات -->
    <div class="signatures-section">
      <div class="signature-box">
        <div class="signature-line">
          <div class="signature-name">سالم الوادعي</div>
          <div class="signature-title">مدير المالية</div>
        </div>
      </div>
      <div class="signature-box">
        <div class="stamp">
          <div>Symbol AI</div>
          <div>الإدارة</div>
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          <div class="signature-name">عمر المطيري</div>
          <div class="signature-title">المراجع المالي</div>
        </div>
      </div>
    </div>
    
    <!-- ذيل التقرير -->
    <div class="footer">
      تم إنشاء هذا التقرير بواسطة نظام Symbol AI | التاريخ: ${new Date().toLocaleDateString('ar-SA')} | الوقت: ${new Date().toLocaleTimeString('ar-SA')}
    </div>
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '10mm',
        bottom: '15mm',
        left: '10mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}


// ==================== تقرير السندات الشهري ====================

interface VoucherReportPDFData {
  vouchers: Array<{
    voucherId: string;
    voucherDate: Date;
    payeeName: string;
    totalAmount: string;
    status: string;
    branchName: string | null;
  }>;
  statistics: {
    totalCount: number;
    draftCount: number;
    approvedCount: number;
    paidCount: number;
    cancelledCount: number;
    totalAmount: number;
    draftAmount: number;
    approvedAmount: number;
    paidAmount: number;
  };
  filters: {
    startDate: string;
    endDate: string;
    status: string;
    branchName: string;
  };
}

export async function generateVouchersReportPDF(data: VoucherReportPDFData): Promise<Buffer> {
  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatCurrencyLocal = (amount: number): string => {
    return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
  };

  const getStatusLabelLocal = (status: string): string => {
    switch (status) {
      case 'draft': return 'مسودة';
      case 'approved': return 'معتمد';
      case 'paid': return 'مدفوع';
      case 'cancelled': return 'ملغي';
      case 'all': return 'جميع الحالات';
      default: return status || '-';
    }
  };

  const getStatusColorLocal = (status: string): string => {
    switch (status) {
      case 'draft': return '#6b7280';
      case 'approved': return '#059669';
      case 'paid': return '#2563eb';
      case 'cancelled': return '#dc2626';
      default: return '#374151';
    }
  };

  // إنشاء صفوف الجدول
  const tableRows = data.vouchers.map((v, index) => `
    <tr class="${index % 2 === 0 ? 'even-row' : 'odd-row'}">
      <td class="text-center">${index + 1}</td>
      <td class="text-center font-bold">${v.voucherId}</td>
      <td class="text-center">${formatDate(v.voucherDate)}</td>
      <td>${v.payeeName}</td>
      <td class="text-center">${v.branchName || 'غير محدد'}</td>
      <td class="text-center amount">${formatCurrencyLocal(parseFloat(v.totalAmount || '0'))}</td>
      <td class="text-center">
        <span class="status-badge" style="background-color: ${getStatusColorLocal(v.status)}20; color: ${getStatusColorLocal(v.status)}; border: 1px solid ${getStatusColorLocal(v.status)}40;">
          ${getStatusLabelLocal(v.status)}
        </span>
      </td>
    </tr>
  `).join('');

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير السندات الشهري</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', sans-serif;
      background: #fff;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.5;
    }
    
    .report-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
    }
    
    /* رأس التقرير */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 15px;
      border-bottom: 3px solid #1e3a5f;
      margin-bottom: 20px;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: 800;
    }
    
    .company-info h1 {
      font-size: 22px;
      font-weight: 800;
      color: #1e3a5f;
      margin-bottom: 2px;
    }
    
    .company-info p {
      font-size: 11px;
      color: #6b7280;
    }
    
    .report-title-section {
      text-align: left;
    }
    
    .report-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 5px;
    }
    
    .report-date {
      font-size: 10px;
      color: #6b7280;
    }
    
    /* معلومات الفلاتر */
    .filters-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .filter-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .filter-label {
      font-size: 10px;
      color: #6b7280;
      font-weight: 500;
    }
    
    .filter-value {
      font-size: 11px;
      color: #1f2937;
      font-weight: 600;
    }
    
    /* بطاقات الإحصائيات */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .stat-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    
    .stat-card.primary {
      background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
      color: white;
      border: none;
    }
    
    .stat-card.primary .stat-label,
    .stat-card.primary .stat-value {
      color: white;
    }
    
    .stat-label {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    
    .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
    }
    
    .stat-amount {
      font-size: 11px;
      color: #059669;
      margin-top: 2px;
    }
    
    .stat-card.primary .stat-amount {
      color: #a7f3d0;
    }
    
    /* جدول السندات */
    .table-section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    
    thead {
      background: #1e3a5f;
      color: white;
    }
    
    th {
      padding: 10px 8px;
      text-align: center;
      font-weight: 600;
      font-size: 10px;
    }
    
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #1f2937;
    }
    
    .even-row {
      background: #f8fafc;
    }
    
    .odd-row {
      background: #fff;
    }
    
    .text-center {
      text-align: center;
    }
    
    .font-bold {
      font-weight: 600;
    }
    
    .amount {
      font-weight: 700;
      color: #1f2937;
      font-size: 11px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 9px;
      font-weight: 600;
    }
    
    /* ملخص الإجماليات */
    .summary-section {
      background: #f8fafc;
      border: 2px solid #1e3a5f;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 25px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-label {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 3px;
    }
    
    .summary-value {
      font-size: 18px;
      font-weight: 800;
      color: #1e3a5f;
    }
    
    .summary-value.total {
      color: #059669;
    }
    
    /* قسم التوقيعات */
    .signatures-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
    }
    
    .signature-box {
      text-align: center;
      width: 150px;
    }
    
    .signature-image {
      height: 50px;
      margin-bottom: 5px;
    }
    
    .signature-line {
      border-top: 1px solid #1f2937;
      padding-top: 5px;
    }
    
    .signature-name {
      font-size: 11px;
      font-weight: 700;
      color: #1f2937;
    }
    
    .signature-title {
      font-size: 9px;
      color: #6b7280;
    }
    
    .stamp-section {
      text-align: center;
    }
    
    .stamp {
      width: 80px;
      height: 80px;
      border: 3px solid #1e3a5f;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 5px;
    }
    
    .stamp-text {
      font-size: 10px;
      font-weight: 700;
      color: #1e3a5f;
    }
    
    .stamp-company {
      font-size: 8px;
      color: #6b7280;
    }
    
    /* ذيل التقرير */
    .report-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9px;
      color: #9ca3af;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .report-container {
        padding: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- رأس التقرير -->
    <div class="report-header">
      <div class="logo-section">
        <div class="logo">S</div>
        <div class="company-info">
          <h1>Symbol AI</h1>
          <p>نظام إدارة الموارد المتكامل</p>
        </div>
      </div>
      <div class="report-title-section">
        <div class="report-title">تقرير السندات الشهري</div>
        <div class="report-date">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</div>
      </div>
    </div>
    
    <!-- معلومات الفلاتر -->
    <div class="filters-section">
      <div class="filter-item">
        <span class="filter-label">الفترة من:</span>
        <span class="filter-value">${formatDate(data.filters.startDate)}</span>
      </div>
      <div class="filter-item">
        <span class="filter-label">إلى:</span>
        <span class="filter-value">${formatDate(data.filters.endDate)}</span>
      </div>
      <div class="filter-item">
        <span class="filter-label">الحالة:</span>
        <span class="filter-value">${getStatusLabelLocal(data.filters.status)}</span>
      </div>
      <div class="filter-item">
        <span class="filter-label">الفرع:</span>
        <span class="filter-value">${data.filters.branchName}</span>
      </div>
    </div>
    
    <!-- بطاقات الإحصائيات -->
    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-label">إجمالي السندات</div>
        <div class="stat-value">${data.statistics.totalCount}</div>
        <div class="stat-amount">${formatCurrencyLocal(data.statistics.totalAmount)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">المسودات</div>
        <div class="stat-value">${data.statistics.draftCount}</div>
        <div class="stat-amount">${formatCurrencyLocal(data.statistics.draftAmount)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">المعتمدة</div>
        <div class="stat-value">${data.statistics.approvedCount}</div>
        <div class="stat-amount">${formatCurrencyLocal(data.statistics.approvedAmount)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">المدفوعة</div>
        <div class="stat-value">${data.statistics.paidCount}</div>
        <div class="stat-amount">${formatCurrencyLocal(data.statistics.paidAmount)}</div>
      </div>
    </div>
    
    <!-- جدول السندات -->
    <div class="table-section">
      <div class="section-title">قائمة السندات (${data.vouchers.length} سند)</div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 12%;">رقم السند</th>
            <th style="width: 15%;">التاريخ</th>
            <th style="width: 20%;">المستقبل</th>
            <th style="width: 15%;">الفرع</th>
            <th style="width: 18%;">المبلغ</th>
            <th style="width: 15%;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    
    <!-- ملخص الإجماليات -->
    <div class="summary-section">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">إجمالي عدد السندات</div>
          <div class="summary-value">${data.statistics.totalCount} سند</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">إجمالي المبالغ المعتمدة</div>
          <div class="summary-value">${formatCurrencyLocal(data.statistics.approvedAmount + data.statistics.paidAmount)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">الإجمالي الكلي</div>
          <div class="summary-value total">${formatCurrencyLocal(data.statistics.totalAmount)}</div>
        </div>
      </div>
    </div>
    
    <!-- قسم التوقيعات -->
    <div class="signatures-section">
      <div class="signature-box">
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiPjxwYXRoIGQ9Ik0xMCA0MGMxNS0yMCAzMC0xMCA0NS0yNSIgc3Ryb2tlPSIjMWUzYTVmIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNNTUgMTVjMTAgMTUgMjAgMjAgMzUgMjUiIHN0cm9rZT0iIzFlM2E1ZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+" class="signature-image" alt="توقيع">
        <div class="signature-line">
          <div class="signature-name">سالم الوادعي</div>
          <div class="signature-title">مدير المالية</div>
        </div>
      </div>
      
      <div class="stamp-section">
        <div class="stamp">
          <div class="stamp-text">الإدارة</div>
          <div class="stamp-company">Symbol AI</div>
        </div>
      </div>
      
      <div class="signature-box">
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiPjxwYXRoIGQ9Ik0xMCAzNWMyMC0xMCA0MC01IDYwLTIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik03MCAxNWM1IDEwIDEwIDE1IDIwIDIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==" class="signature-image" alt="توقيع">
        <div class="signature-line">
          <div class="signature-name">عمر المطيري</div>
          <div class="signature-title">المراجع المالي</div>
        </div>
      </div>
    </div>
    
    <!-- ذيل التقرير -->
    <div class="report-footer">
      تم إنشاء هذا التقرير بواسطة نظام Symbol AI | التاريخ: ${new Date().toLocaleDateString('ar-SA')} | الوقت: ${new Date().toLocaleTimeString('ar-SA')}
    </div>
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}


/**
 * تقرير أداء الخدمات الشهري
 */
interface ServicePerformanceData {
  month: string;
  year: number;
  branchName: string;
  summary: {
    totalRevenue: number;
    totalServices: number;
    totalInvoices: number;
    uniqueServices: number;
    averageInvoiceValue: number;
    revenueChange: number;
    servicesChange: number;
  };
  topServices: Array<{
    rank: number;
    serviceName: string;
    serviceNameAr: string;
    totalQuantity: number;
    totalRevenue: number;
    averagePrice: number;
    invoiceCount: number;
  }>;
  categoryPerformance: Array<{
    categoryName: string;
    categoryNameAr: string;
    categoryColor: string | null;
    totalQuantity: number;
    totalRevenue: number;
    serviceCount: number;
  }>;
  dailyData: Array<{
    date: string;
    totalRevenue: number;
    totalServices: number;
    invoiceCount: number;
  }>;
}

export async function generateServicePerformancePDF(data: ServicePerformanceData): Promise<Buffer> {
  const formatCurrencyLocal = (amount: number): string => {
    return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ر.س`;
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('ar-SA');
  };

  const totalCategoryRevenue = data.categoryPerformance.reduce((sum, cat) => sum + cat.totalRevenue, 0);

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير أداء الخدمات - ${data.month} ${data.year}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', sans-serif;
      background: #fff;
      color: #1a1a1a;
      font-size: 11pt;
      line-height: 1.6;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #1e3a5f;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .logo {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #1e3a5f, #2c5282);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 18pt;
    }
    
    .company-info h1 {
      font-size: 16pt;
      color: #1e3a5f;
      font-weight: 700;
    }
    
    .company-info p {
      font-size: 9pt;
      color: #666;
    }
    
    .report-info {
      text-align: left;
    }
    
    .report-info h2 {
      font-size: 14pt;
      color: #1e3a5f;
      font-weight: 600;
    }
    
    .report-info p {
      font-size: 9pt;
      color: #666;
    }
    
    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    
    .summary-card {
      background: linear-gradient(135deg, #f8fafc, #f1f5f9);
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 15px;
      text-align: center;
    }
    
    .summary-card.primary {
      background: linear-gradient(135deg, #1e3a5f, #2c5282);
      color: white;
      border: none;
    }
    
    .summary-card .label {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 5px;
    }
    
    .summary-card.primary .label {
      color: rgba(255,255,255,0.8);
    }
    
    .summary-card .value {
      font-size: 16pt;
      font-weight: 700;
      color: #1a1a1a;
    }
    
    .summary-card.primary .value {
      color: white;
    }
    
    .summary-card .change {
      font-size: 8pt;
      margin-top: 5px;
    }
    
    .change.positive {
      color: #22c55e;
    }
    
    .change.negative {
      color: #ef4444;
    }
    
    .summary-card.primary .change.positive {
      color: #86efac;
    }
    
    .summary-card.primary .change.negative {
      color: #fca5a5;
    }
    
    /* Section Title */
    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .section-title::before {
      content: '';
      width: 4px;
      height: 20px;
      background: #1e3a5f;
      border-radius: 2px;
    }
    
    /* Two Column Layout */
    .two-columns {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }
    
    /* Top Services Table */
    .services-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    
    .services-table th {
      background: #1e3a5f;
      color: white;
      padding: 10px 8px;
      text-align: right;
      font-weight: 600;
    }
    
    .services-table td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #1a1a1a;
    }
    
    .services-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .services-table tr:hover {
      background: #f1f5f9;
    }
    
    .rank-badge {
      display: inline-block;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #1a1a1a;
      text-align: center;
      line-height: 24px;
      font-weight: 700;
      font-size: 10pt;
    }
    
    .rank-badge.gold {
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: white;
    }
    
    .rank-badge.silver {
      background: linear-gradient(135deg, #9ca3af, #6b7280);
      color: white;
    }
    
    .rank-badge.bronze {
      background: linear-gradient(135deg, #d97706, #b45309);
      color: white;
    }
    
    /* Category Performance */
    .category-list {
      background: #f8fafc;
      border-radius: 10px;
      padding: 15px;
    }
    
    .category-item {
      margin-bottom: 12px;
    }
    
    .category-item:last-child {
      margin-bottom: 0;
    }
    
    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    
    .category-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .category-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .category-percentage {
      font-weight: 700;
      color: #1e3a5f;
    }
    
    .category-bar {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .category-bar-fill {
      height: 100%;
      border-radius: 4px;
    }
    
    .category-stats {
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748b;
      margin-top: 3px;
    }
    
    /* Daily Data Table */
    .daily-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-top: 15px;
    }
    
    .daily-table th {
      background: #f1f5f9;
      color: #1e3a5f;
      padding: 8px 6px;
      text-align: right;
      font-weight: 600;
      border-bottom: 2px solid #1e3a5f;
    }
    
    .daily-table td {
      padding: 6px;
      border-bottom: 1px solid #e2e8f0;
      color: #1a1a1a;
    }
    
    .daily-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .daily-table .total-row {
      background: #1e3a5f;
      color: white;
      font-weight: 700;
    }
    
    .daily-table .total-row td {
      border-bottom: none;
    }
    
    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
    }
    
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .signature-box {
      text-align: center;
      width: 30%;
    }
    
    .signature-image {
      width: 100px;
      height: 50px;
      margin-bottom: 5px;
    }
    
    .signature-line {
      border-top: 1px solid #1a1a1a;
      padding-top: 8px;
    }
    
    .signature-name {
      font-weight: 700;
      color: #1a1a1a;
      font-size: 10pt;
    }
    
    .signature-title {
      font-size: 8pt;
      color: #64748b;
    }
    
    .stamp {
      width: 80px;
      height: 80px;
      border: 3px solid #1e3a5f;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      font-size: 8pt;
      color: #1e3a5f;
      font-weight: 700;
      text-align: center;
      line-height: 1.3;
    }
    
    .report-footer {
      text-align: center;
      font-size: 8pt;
      color: #64748b;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
    }
    
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">S</div>
        <div class="company-info">
          <h1>Symbol AI</h1>
          <p>سيمبول للذكاء الاصطناعي - صالونات قصه وتخفيف</p>
        </div>
      </div>
      <div class="report-info">
        <h2>تقرير أداء الخدمات</h2>
        <p>${data.month} ${data.year}</p>
        <p>الفرع: ${data.branchName}</p>
      </div>
    </div>
    
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card primary">
        <div class="label">إجمالي الإيرادات</div>
        <div class="value">${formatCurrencyLocal(data.summary.totalRevenue)}</div>
        ${data.summary.revenueChange !== 0 ? `
          <div class="change ${data.summary.revenueChange > 0 ? 'positive' : 'negative'}">
            ${data.summary.revenueChange > 0 ? '↑' : '↓'} ${Math.abs(data.summary.revenueChange)}% عن الفترة السابقة
          </div>
        ` : ''}
      </div>
      <div class="summary-card">
        <div class="label">الخدمات المقدمة</div>
        <div class="value">${formatNumber(data.summary.totalServices)}</div>
        ${data.summary.servicesChange !== 0 ? `
          <div class="change ${data.summary.servicesChange > 0 ? 'positive' : 'negative'}">
            ${data.summary.servicesChange > 0 ? '↑' : '↓'} ${Math.abs(data.summary.servicesChange)}%
          </div>
        ` : ''}
      </div>
      <div class="summary-card">
        <div class="label">عدد الفواتير</div>
        <div class="value">${formatNumber(data.summary.totalInvoices)}</div>
        <div class="change" style="color: #64748b;">متوسط ${formatCurrencyLocal(data.summary.averageInvoiceValue)}</div>
      </div>
      <div class="summary-card">
        <div class="label">الخدمات الفريدة</div>
        <div class="value">${formatNumber(data.summary.uniqueServices)}</div>
        <div class="change" style="color: #64748b;">خدمة مختلفة</div>
      </div>
    </div>
    
    <!-- Two Column Layout -->
    <div class="two-columns">
      <!-- Top Services -->
      <div>
        <div class="section-title">الخدمات الأكثر طلباً</div>
        <table class="services-table">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>الخدمة</th>
              <th style="width: 80px;">الطلبات</th>
              <th style="width: 100px;">الإيرادات</th>
            </tr>
          </thead>
          <tbody>
            ${data.topServices.slice(0, 10).map((service, index) => `
              <tr>
                <td>
                  <span class="rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${service.rank}</span>
                </td>
                <td>
                  <div style="font-weight: 600;">${service.serviceNameAr}</div>
                  <div style="font-size: 8pt; color: #64748b;">${service.serviceName}</div>
                </td>
                <td style="font-weight: 700;">${formatNumber(service.totalQuantity)}</td>
                <td style="font-weight: 700;">${formatCurrencyLocal(service.totalRevenue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Category Performance -->
      <div>
        <div class="section-title">أداء الأقسام</div>
        <div class="category-list">
          ${data.categoryPerformance.map(category => {
            const percentage = totalCategoryRevenue > 0 ? (category.totalRevenue / totalCategoryRevenue) * 100 : 0;
            return `
              <div class="category-item">
                <div class="category-header">
                  <div class="category-name">
                    <span class="category-dot" style="background: ${category.categoryColor || '#6366f1'};"></span>
                    ${category.categoryNameAr}
                  </div>
                  <span class="category-percentage">${percentage.toFixed(1)}%</span>
                </div>
                <div class="category-bar">
                  <div class="category-bar-fill" style="width: ${percentage}%; background: ${category.categoryColor || '#6366f1'};"></div>
                </div>
                <div class="category-stats">
                  <span>${formatNumber(category.totalQuantity)} خدمة</span>
                  <span>${formatCurrencyLocal(category.totalRevenue)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
    
    <!-- Daily Performance -->
    <div class="section-title">الأداء اليومي</div>
    <table class="daily-table">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الإيرادات</th>
          <th>الخدمات</th>
          <th>الفواتير</th>
        </tr>
      </thead>
      <tbody>
        ${data.dailyData.map(day => `
          <tr>
            <td>${new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
            <td style="font-weight: 600;">${formatCurrencyLocal(day.totalRevenue)}</td>
            <td>${formatNumber(day.totalServices)}</td>
            <td>${formatNumber(day.invoiceCount)}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td>الإجمالي</td>
          <td>${formatCurrencyLocal(data.dailyData.reduce((sum, d) => sum + d.totalRevenue, 0))}</td>
          <td>${formatNumber(data.dailyData.reduce((sum, d) => sum + d.totalServices, 0))}</td>
          <td>${formatNumber(data.dailyData.reduce((sum, d) => sum + d.invoiceCount, 0))}</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Footer -->
    <div class="footer">
      <div class="signatures">
        <div class="signature-box">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiPjxwYXRoIGQ9Ik0xMCAzNWMyMC0xMCA0MC01IDYwLTIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik03MCAxNWM1IDEwIDEwIDE1IDIwIDIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==" class="signature-image" alt="توقيع">
          <div class="signature-line">
            <div class="signature-name">سالم الوادعي</div>
            <div class="signature-title">المشرف العام</div>
          </div>
        </div>
        
        <div class="signature-box">
          <div class="stamp">
            <div>Symbol AI<br/>الإدارة</div>
          </div>
        </div>
        
        <div class="signature-box">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiPjxwYXRoIGQ9Ik0xMCAzNWMyMC0xMCA0MC01IDYwLTIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik03MCAxNWM1IDEwIDEwIDE1IDIwIDIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==" class="signature-image" alt="توقيع">
          <div class="signature-line">
            <div class="signature-name">عمر المطيري</div>
            <div class="signature-title">المدير</div>
          </div>
        </div>
      </div>
      
      <div class="report-footer">
        تم إنشاء هذا التقرير بواسطة نظام Symbol AI | التاريخ: ${new Date().toLocaleDateString('ar-SA')} | الوقت: ${new Date().toLocaleTimeString('ar-SA')}
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}


/**
 * تصدير تقرير أداء الموظفين إلى PDF
 */
export async function generateEmployeePerformancePDF(data: {
  employees: Array<{
    rank: number;
    employeeId: number;
    employeeName: string;
    employeePhoto: string | null;
    employeePosition: string;
    totalRevenue: number;
    invoiceCount: number;
    serviceCount: number;
    averageInvoiceValue: number;
    cashAmount: number;
    cardAmount: number;
  }>;
  summary: {
    totalRevenue: number;
    totalInvoices: number;
    uniqueEmployees: number;
    averageInvoiceValue: number;
    averageRevenuePerEmployee: number;
    revenueChange: number;
    invoicesChange: number;
  } | null;
  dailyData: Array<{
    date: string;
    totalRevenue: number;
    invoiceCount: number;
    uniqueEmployees: number;
  }>;
  month: string;
  year: string;
  branchName: string;
}): Promise<Buffer> {
  const { employees, summary, dailyData, month, year, branchName } = data;

  const formatCurrency = (amount: number) => `${amount.toLocaleString('ar-SA')} ر.س`;
  const formatNumber = (num: number) => num.toLocaleString('ar-SA');

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '<span style="color: #f59e0b; font-size: 20px;">🏆</span>';
    if (rank === 2) return '<span style="color: #9ca3af; font-size: 18px;">🥈</span>';
    if (rank === 3) return '<span style="color: #d97706; font-size: 18px;">🥉</span>';
    return `<span style="color: #6b7280; font-weight: bold;">${rank}</span>`;
  };

  // إنشاء صفوف جدول الموظفين
  const employeeRows = employees.map(emp => `
    <tr>
      <td style="text-align: center; padding: 12px 8px;">${getRankBadge(emp.rank)}</td>
      <td style="padding: 12px 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${emp.employeePhoto 
            ? `<img src="${emp.employeePhoto}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />`
            : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; color: #6b7280;">👤</div>`
          }
          <div>
            <div style="font-weight: 600; color: #1f2937;">${emp.employeeName}</div>
            <div style="font-size: 11px; color: #6b7280;">${emp.employeePosition}</div>
          </div>
        </div>
      </td>
      <td style="text-align: center; padding: 12px 8px; color: #1f2937;">${formatNumber(emp.invoiceCount)}</td>
      <td style="text-align: center; padding: 12px 8px; color: #1f2937;">${formatNumber(emp.serviceCount)}</td>
      <td style="text-align: center; padding: 12px 8px; color: #1f2937;">${formatCurrency(emp.averageInvoiceValue)}</td>
      <td style="text-align: left; padding: 12px 8px; font-weight: bold; color: #059669;">${formatCurrency(emp.totalRevenue)}</td>
    </tr>
  `).join('');

  // إنشاء صفوف جدول الأداء اليومي
  const dailyRows = dailyData.map(day => `
    <tr>
      <td style="padding: 10px 8px; color: #1f2937;">${new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
      <td style="text-align: center; padding: 10px 8px; font-weight: 600; color: #1f2937;">${formatCurrency(day.totalRevenue)}</td>
      <td style="text-align: center; padding: 10px 8px; color: #1f2937;">${formatNumber(day.invoiceCount)}</td>
      <td style="text-align: center; padding: 10px 8px; color: #1f2937;">${formatNumber(day.uniqueEmployees)}</td>
    </tr>
  `).join('');

  const totalDailyRevenue = dailyData.reduce((sum, d) => sum + d.totalRevenue, 0);
  const totalDailyInvoices = dailyData.reduce((sum, d) => sum + d.invoiceCount, 0);

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      background: #f8fafc;
      color: #1f2937;
      font-size: 13px;
      line-height: 1.6;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      padding: 20px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #059669;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #059669, #10b981);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 18px;
    }
    
    .company-info h1 {
      font-size: 22px;
      color: #059669;
      font-weight: 700;
    }
    
    .company-info p {
      font-size: 11px;
      color: #6b7280;
    }
    
    .report-info {
      text-align: left;
      background: #f0fdf4;
      padding: 12px 18px;
      border-radius: 8px;
    }
    
    .report-info h2 {
      font-size: 16px;
      color: #059669;
      margin-bottom: 4px;
    }
    
    .report-info p {
      font-size: 12px;
      color: #374151;
    }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .summary-card {
      background: linear-gradient(135deg, #f0fdf4, #dcfce7);
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 14px;
      text-align: center;
    }
    
    .summary-card.primary {
      background: linear-gradient(135deg, #059669, #10b981);
      border: none;
      color: white;
    }
    
    .summary-card .label {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    
    .summary-card.primary .label {
      color: rgba(255,255,255,0.9);
    }
    
    .summary-card .value {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
    }
    
    .summary-card.primary .value {
      color: white;
    }
    
    .summary-card .change {
      font-size: 10px;
      margin-top: 4px;
    }
    
    .change.positive { color: #059669; }
    .change.negative { color: #dc2626; }
    .summary-card.primary .change { color: rgba(255,255,255,0.9); }
    
    .section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #059669;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #d1fae5;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    thead {
      background: linear-gradient(135deg, #059669, #10b981);
      color: white;
    }
    
    th {
      padding: 12px 8px;
      font-weight: 600;
      font-size: 12px;
      text-align: center;
    }
    
    th:first-child { text-align: center; }
    th:nth-child(2) { text-align: right; }
    th:last-child { text-align: left; }
    
    tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }
    
    tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    
    tbody tr:hover {
      background: #f0fdf4;
    }
    
    .total-row {
      background: #f0fdf4 !important;
      font-weight: 700;
    }
    
    .signatures {
      display: flex;
      justify-content: space-around;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    }
    
    .signature-box {
      text-align: center;
      min-width: 150px;
    }
    
    .signature-image {
      width: 100px;
      height: 50px;
      margin-bottom: 8px;
    }
    
    .signature-line {
      border-top: 2px solid #374151;
      padding-top: 8px;
    }
    
    .signature-name {
      font-weight: 700;
      color: #1f2937;
      font-size: 13px;
    }
    
    .signature-title {
      font-size: 11px;
      color: #6b7280;
    }
    
    .stamp {
      width: 80px;
      height: 80px;
      border: 3px solid #059669;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px;
      font-size: 10px;
      color: #059669;
      font-weight: 600;
      text-align: center;
    }
    
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-section">
        <div class="logo">S</div>
        <div class="company-info">
          <h1>Symbol AI</h1>
          <p>نظام إدارة الموارد المتكامل</p>
        </div>
      </div>
      <div class="report-info">
        <h2>تقرير أداء الموظفين</h2>
        <p>${month} ${year} | ${branchName}</p>
      </div>
    </div>
    
    <div class="summary-cards">
      <div class="summary-card primary">
        <div class="label">إجمالي الإيرادات</div>
        <div class="value">${formatCurrency(summary?.totalRevenue || 0)}</div>
        ${summary?.revenueChange ? `<div class="change ${summary.revenueChange > 0 ? 'positive' : 'negative'}">${summary.revenueChange > 0 ? '↑' : '↓'} ${Math.abs(summary.revenueChange)}%</div>` : ''}
      </div>
      <div class="summary-card">
        <div class="label">عدد الفواتير</div>
        <div class="value">${formatNumber(summary?.totalInvoices || 0)}</div>
        ${summary?.invoicesChange ? `<div class="change ${summary.invoicesChange > 0 ? 'positive' : 'negative'}">${summary.invoicesChange > 0 ? '↑' : '↓'} ${Math.abs(summary.invoicesChange)}%</div>` : ''}
      </div>
      <div class="summary-card">
        <div class="label">عدد الموظفين</div>
        <div class="value">${formatNumber(summary?.uniqueEmployees || 0)}</div>
        <div class="change">موظف نشط</div>
      </div>
      <div class="summary-card">
        <div class="label">متوسط لكل موظف</div>
        <div class="value">${formatCurrency(summary?.averageRevenuePerEmployee || 0)}</div>
        <div class="change">إيراد/موظف</div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">🏆 ترتيب الموظفين حسب الإيرادات</div>
      <table>
        <thead>
          <tr>
            <th style="width: 60px;">الترتيب</th>
            <th style="text-align: right;">الموظف</th>
            <th>الفواتير</th>
            <th>الخدمات</th>
            <th>متوسط الفاتورة</th>
            <th style="text-align: left;">الإيرادات</th>
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
        </tbody>
      </table>
    </div>
    
    ${dailyData.length > 0 ? `
    <div class="section">
      <div class="section-title">📊 الأداء اليومي</div>
      <table>
        <thead>
          <tr>
            <th style="text-align: right;">التاريخ</th>
            <th>الإيرادات</th>
            <th>الفواتير</th>
            <th>الموظفين النشطين</th>
          </tr>
        </thead>
        <tbody>
          ${dailyRows}
          <tr class="total-row">
            <td style="padding: 10px 8px; font-weight: 700;">الإجمالي</td>
            <td style="text-align: center; padding: 10px 8px; font-weight: 700; color: #059669;">${formatCurrency(totalDailyRevenue)}</td>
            <td style="text-align: center; padding: 10px 8px; font-weight: 700;">${formatNumber(totalDailyInvoices)}</td>
            <td style="text-align: center; padding: 10px 8px;">-</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <div class="signatures">
      <div class="signature-box">
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiPjxwYXRoIGQ9Ik01IDQwYzE1LTIwIDMwLTMwIDQ1LTI1czI1IDEwIDQwIDUiIHN0cm9rZT0iIzFlM2E1ZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTkwIDE1YzAgMTAtNSAxNS0xMCAxNSIgc3Ryb2tlPSIjMWUzYTVmIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=" class="signature-image" alt="توقيع">
        <div class="signature-line">
          <div class="signature-name">سالم الوادعي</div>
          <div class="signature-title">المشرف العام</div>
        </div>
      </div>
      
      <div class="signature-box">
        <div class="stamp">
          <div>Symbol AI<br/>الإدارة</div>
        </div>
      </div>
      
      <div class="signature-box">
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiPjxwYXRoIGQ9Ik0xMCAzNWMyMC0xMCA0MC01IDYwLTIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik03MCAxNWM1IDEwIDEwIDE1IDIwIDIwIiBzdHJva2U9IiMxZTNhNWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==" class="signature-image" alt="توقيع">
        <div class="signature-line">
          <div class="signature-name">عمر المطيري</div>
          <div class="signature-title">المدير</div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      تم إنشاء هذا التقرير بواسطة نظام Symbol AI | التاريخ: ${new Date().toLocaleDateString('ar-SA')} | الوقت: ${new Date().toLocaleTimeString('ar-SA')}
    </div>
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
