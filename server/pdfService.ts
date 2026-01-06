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
  dueDate?: Date | string | null;
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
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'غير محدد';
    const d = new Date(date);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
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

  // قراءة صورة التوقيعات والختم من ملف خارجي
  const fs = await import('fs');
  const path = await import('path');
  const signaturesImagePath = path.join(process.cwd(), 'client/public/signatures-stamp.png');
  let signaturesBase64 = '';
  try {
    if (fs.existsSync(signaturesImagePath)) {
      signaturesBase64 = fs.readFileSync(signaturesImagePath).toString('base64');
    }
  } catch (e) {
    console.error('Error reading signatures image:', e);
  }


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
    
    /* التوقيعات والختم */
    .signatures-section {
      padding: 30px;
      text-align: center;
      background: #fff;
    }
    
    .signatures-image {
      max-width: 100%;
      height: auto;
      max-height: 200px;
      object-fit: contain;
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
        <div class="info-label">تاريخ الاستحقاق</div>
        <div class="info-value">${formatDate(voucher.dueDate)}</div>
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
    
    <!-- التوقيعات والختم -->
    <div class="signatures-section">
      <img src="data:image/png;base64,${signaturesBase64}" class="signatures-image" alt="التوقيعات والختم" />
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
