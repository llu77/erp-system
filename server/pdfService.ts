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
