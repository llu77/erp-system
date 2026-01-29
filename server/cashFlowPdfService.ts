/**
 * خدمة توليد تقرير التدفق النقدي PDF
 * Symbol AI - نظام إدارة الأعمال
 * قالب احترافي للشركات مع شعار وختم وتوقيعات
 */

import puppeteer from 'puppeteer';

interface CashFlowPDFData {
  reportTitle: string;
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  year: number;
  month?: number;
  quarter?: number;
  startDate?: string;
  endDate?: string;
  branchName: string | null;
  generatedAt: Date;
  generatedBy: string;
  
  // الملخص الرئيسي
  summary: {
    totalCashRevenue: number;
    totalCashExpenses: number;
    totalCashVouchers: number;
    totalCashAdvances: number;
    remainingCash: number;
    cashRetentionRate: string;
  };
  
  // مؤشرات الأداء
  kpis: {
    dailyAverage: number;
    growthRate: number;
    previousPeriodCash: number;
    highestDay: { date: string; amount: number };
    lowestDay: { date: string; amount: number };
    daysWithPositiveCash: number;
    totalDays: number;
  };
  
  // تفاصيل المصاريف حسب طريقة الدفع
  expensesByMethod: Record<string, { count: number; total: number }>;
  
  // تفاصيل السندات حسب طريقة الدفع
  vouchersByMethod: Record<string, { count: number; total: number }>;
  
  // تفاصيل الفروع (إذا كان التقرير لجميع الفروع)
  branches?: Array<{
    branchId: number;
    branchName: string;
    cashRevenue: number;
    cashExpenses: number;
    cashVouchers: number;
    remainingCash: number;
    retentionRate: string;
  }>;
}

const monthNames = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const paymentMethodNames: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
  credit_card: "بطاقة ائتمان",
  other: "أخرى",
};

const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
};

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

export async function generateCashFlowReportPDF(data: CashFlowPDFData): Promise<Buffer> {
  const periodLabel = data.periodType === 'monthly' && data.month
    ? `${monthNames[data.month - 1]} ${data.year}`
    : data.periodType === 'quarterly' && data.quarter
    ? `الربع ${data.quarter} - ${data.year}`
    : data.periodType === 'yearly'
    ? `${data.year}`
    : `${data.startDate} - ${data.endDate}`;

  const branchLabel = data.branchName || 'جميع الفروع';
  const isPositive = data.summary.remainingCash >= 0;
  const growthColor = data.kpis.growthRate >= 0 ? '#22c55e' : '#ef4444';
  const growthIcon = data.kpis.growthRate >= 0 ? '↑' : '↓';

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير التدفق النقدي - ${periodLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', 'Segoe UI', sans-serif;
      direction: rtl;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    
    /* الهيدر الرسمي */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 3px solid #1a1a2e;
      margin-bottom: 25px;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .logo {
      width: 70px;
      height: 70px;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 28px;
      font-weight: 800;
    }
    
    .company-info h1 {
      font-size: 24px;
      font-weight: 800;
      color: #1a1a2e;
      margin-bottom: 5px;
    }
    
    .company-info p {
      font-size: 12px;
      color: #64748b;
    }
    
    .report-meta {
      text-align: left;
      font-size: 11px;
      color: #64748b;
    }
    
    .report-meta .date {
      font-weight: 600;
      color: #1a1a2e;
    }
    
    /* عنوان التقرير */
    .report-title {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .report-title h2 {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    
    .report-title .period {
      display: inline-block;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      color: white;
      padding: 8px 25px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
    }
    
    .report-title .branch {
      display: block;
      margin-top: 10px;
      font-size: 14px;
      color: #64748b;
    }
    
    /* بطاقات الملخص */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    
    .summary-card {
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    
    .summary-card.revenue {
      border-color: #22c55e;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    }
    
    .summary-card.expenses {
      border-color: #ef4444;
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    }
    
    .summary-card.vouchers {
      border-color: #f97316;
      background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
    }
    
    .summary-card.advances {
      border-color: #a855f7;
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
    }
    
    .summary-card.remaining {
      border-color: ${isPositive ? '#3b82f6' : '#ef4444'};
      background: ${isPositive ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'};
    }
    
    .summary-card .label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    
    .summary-card .value {
      font-size: 20px;
      font-weight: 700;
    }
    
    .summary-card.revenue .value { color: #22c55e; }
    .summary-card.expenses .value { color: #ef4444; }
    .summary-card.vouchers .value { color: #f97316; }
    .summary-card.advances .value { color: #a855f7; }
    .summary-card.remaining .value { color: ${isPositive ? '#3b82f6' : '#ef4444'}; }
    
    .summary-card .sub {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 5px;
    }
    
    /* مؤشرات الأداء */
    .kpi-section {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      padding: 25px;
      margin-bottom: 30px;
      color: white;
    }
    
    .kpi-section h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .kpi-section h3::before {
      content: '📊';
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    
    .kpi-item {
      text-align: center;
      padding: 15px;
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
    }
    
    .kpi-item .label {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      margin-bottom: 8px;
    }
    
    .kpi-item .value {
      font-size: 18px;
      font-weight: 700;
    }
    
    .kpi-item.growth .value {
      color: ${growthColor};
    }
    
    /* جدول طرق الدفع */
    .payment-section {
      margin-bottom: 30px;
    }
    
    .payment-section h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .payment-tables {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    
    .payment-table {
      background: #f8fafc;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    
    .payment-table h4 {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 12px 15px;
      font-size: 14px;
      font-weight: 600;
    }
    
    .payment-table table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .payment-table th,
    .payment-table td {
      padding: 10px 15px;
      text-align: right;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .payment-table th {
      background: #f1f5f9;
      font-weight: 600;
      color: #475569;
    }
    
    .payment-table tr:last-child td {
      border-bottom: none;
    }
    
    .payment-table .total-row {
      background: #f1f5f9;
      font-weight: 600;
    }
    
    /* جدول الفروع */
    .branches-section {
      margin-bottom: 30px;
    }
    
    .branches-section h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .branches-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    
    .branches-table th {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 12px 15px;
      text-align: right;
      font-size: 12px;
      font-weight: 600;
    }
    
    .branches-table td {
      padding: 12px 15px;
      text-align: right;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .branches-table tr:last-child td {
      border-bottom: none;
    }
    
    .branches-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .positive { color: #22c55e; }
    .negative { color: #ef4444; }
    
    /* التوقيعات والختم */
    .signatures-section {
      margin-top: 40px;
      padding-top: 30px;
      border-top: 2px solid #e2e8f0;
    }
    
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      text-align: center;
    }
    
    .signature-box {
      padding: 20px;
    }
    
    .signature-box .title {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 40px;
    }
    
    .signature-box .line {
      border-top: 1px solid #1a1a2e;
      padding-top: 10px;
    }
    
    .signature-box .name {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }
    
    .signature-box .role {
      font-size: 11px;
      color: #64748b;
    }
    
    .stamp-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .stamp {
      width: 100px;
      height: 100px;
      border: 3px solid #a855f7;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #a855f7;
      font-weight: 700;
      margin-bottom: 10px;
    }
    
    .stamp .company {
      font-size: 10px;
    }
    
    .stamp .symbol {
      font-size: 18px;
    }
    
    /* الفوتر */
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
    
    .footer .copyright {
      margin-top: 5px;
    }
    
    @media print {
      body { background: white; }
      .page { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- الهيدر -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">S</div>
        <div class="company-info">
          <h1>Symbol AI</h1>
          <p>نظام إدارة الأعمال المتكامل</p>
        </div>
      </div>
      <div class="report-meta">
        <p>تاريخ الإصدار: <span class="date">${formatDate(data.generatedAt)}</span></p>
        <p>أعده: ${data.generatedBy}</p>
        <p>رقم التقرير: CF-${data.year}${data.month ? String(data.month).padStart(2, '0') : '00'}-${Date.now().toString().slice(-4)}</p>
      </div>
    </div>
    
    <!-- عنوان التقرير -->
    <div class="report-title">
      <h2>تقرير التدفق النقدي</h2>
      <span class="period">${periodLabel}</span>
      <span class="branch">${branchLabel}</span>
    </div>
    
    <!-- بطاقات الملخص -->
    <div class="summary-cards">
      <div class="summary-card revenue">
        <div class="label">إيرادات الكاش</div>
        <div class="value">${formatCurrency(data.summary.totalCashRevenue)}</div>
        <div class="sub">إجمالي الإيرادات النقدية</div>
      </div>
      <div class="summary-card expenses">
        <div class="label">المصاريف النقدية</div>
        <div class="value">${formatCurrency(data.summary.totalCashExpenses)}</div>
        <div class="sub">إجمالي المصاريف المدفوعة نقداً</div>
      </div>
      <div class="summary-card vouchers">
        <div class="label">سندات القبض</div>
        <div class="value">${formatCurrency(data.summary.totalCashVouchers)}</div>
        <div class="sub">إجمالي السندات النقدية</div>
      </div>
      <div class="summary-card advances">
        <div class="label">السلف النقدية</div>
        <div class="value">${formatCurrency(data.summary.totalCashAdvances)}</div>
        <div class="sub">إجمالي السلف المعتمدة</div>
      </div>
      <div class="summary-card remaining">
        <div class="label">الكاش المتبقي</div>
        <div class="value">${formatCurrency(data.summary.remainingCash)}</div>
        <div class="sub">نسبة الاحتفاظ: ${data.summary.cashRetentionRate}%</div>
      </div>
    </div>
    
    <!-- مؤشرات الأداء -->
    <div class="kpi-section">
      <h3>مؤشرات الأداء الرئيسية (KPIs)</h3>
      <div class="kpi-grid">
        <div class="kpi-item growth">
          <div class="label">نسبة النمو عن الفترة السابقة</div>
          <div class="value">${growthIcon} ${formatPercentage(data.kpis.growthRate)}</div>
        </div>
        <div class="kpi-item">
          <div class="label">المتوسط اليومي للكاش</div>
          <div class="value">${formatCurrency(data.kpis.dailyAverage)}</div>
        </div>
        <div class="kpi-item">
          <div class="label">الكاش في الفترة السابقة</div>
          <div class="value">${formatCurrency(data.kpis.previousPeriodCash)}</div>
        </div>
        <div class="kpi-item">
          <div class="label">أعلى يوم</div>
          <div class="value">${formatCurrency(data.kpis.highestDay.amount)}</div>
        </div>
        <div class="kpi-item">
          <div class="label">أدنى يوم</div>
          <div class="value">${formatCurrency(data.kpis.lowestDay.amount)}</div>
        </div>
        <div class="kpi-item">
          <div class="label">أيام الكاش الإيجابي</div>
          <div class="value">${data.kpis.daysWithPositiveCash} / ${data.kpis.totalDays}</div>
        </div>
      </div>
    </div>
    
    <!-- تفاصيل طرق الدفع -->
    <div class="payment-section">
      <h3>تفاصيل حسب طريقة الدفع</h3>
      <div class="payment-tables">
        <div class="payment-table">
          <h4>المصاريف حسب طريقة الدفع</h4>
          <table>
            <thead>
              <tr>
                <th>طريقة الدفع</th>
                <th>العدد</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(data.expensesByMethod)
                .filter(([_, d]) => d.total > 0)
                .map(([method, d]) => `
                  <tr>
                    <td>${paymentMethodNames[method] || method}</td>
                    <td>${d.count}</td>
                    <td class="negative">${formatCurrency(d.total)}</td>
                  </tr>
                `).join('')}
              <tr class="total-row">
                <td>الإجمالي</td>
                <td>${Object.values(data.expensesByMethod).reduce((sum, d) => sum + d.count, 0)}</td>
                <td class="negative">${formatCurrency(data.summary.totalCashExpenses)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="payment-table">
          <h4>السندات حسب طريقة الدفع</h4>
          <table>
            <thead>
              <tr>
                <th>طريقة الدفع</th>
                <th>العدد</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(data.vouchersByMethod)
                .filter(([_, d]) => d.total > 0)
                .map(([method, d]) => `
                  <tr>
                    <td>${paymentMethodNames[method] || method}</td>
                    <td>${d.count}</td>
                    <td style="color: #f97316;">${formatCurrency(d.total)}</td>
                  </tr>
                `).join('')}
              <tr class="total-row">
                <td>الإجمالي</td>
                <td>${Object.values(data.vouchersByMethod).reduce((sum, d) => sum + d.count, 0)}</td>
                <td style="color: #f97316;">${formatCurrency(data.summary.totalCashVouchers)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    ${data.branches && data.branches.length > 0 ? `
    <!-- تفاصيل الفروع -->
    <div class="branches-section">
      <h3>التدفق النقدي حسب الفرع</h3>
      <table class="branches-table">
        <thead>
          <tr>
            <th>الفرع</th>
            <th>إيرادات الكاش</th>
            <th>المصاريف النقدية</th>
            <th>سندات القبض</th>
            <th>الكاش المتبقي</th>
            <th>نسبة الاحتفاظ</th>
          </tr>
        </thead>
        <tbody>
          ${data.branches.map(branch => `
            <tr>
              <td><strong>${branch.branchName}</strong></td>
              <td class="positive">${formatCurrency(branch.cashRevenue)}</td>
              <td class="negative">${formatCurrency(branch.cashExpenses)}</td>
              <td style="color: #f97316;">${formatCurrency(branch.cashVouchers)}</td>
              <td class="${branch.remainingCash >= 0 ? 'positive' : 'negative'}"><strong>${formatCurrency(branch.remainingCash)}</strong></td>
              <td>${branch.retentionRate}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <!-- التوقيعات والختم -->
    <div class="signatures-section">
      <div class="signatures-grid">
        <div class="signature-box">
          <div class="title">المشرف العام</div>
          <div class="line">
            <div class="name">سالم الوادعي</div>
            <div class="role">General Supervisor</div>
          </div>
        </div>
        
        <div class="signature-box stamp-box">
          <div class="stamp">
            <span class="company">Symbol AI</span>
            <span class="symbol">✓</span>
            <span class="company">معتمد</span>
          </div>
          <div class="role">ختم الشركة</div>
        </div>
        
        <div class="signature-box">
          <div class="title">المدير</div>
          <div class="line">
            <div class="name">عمر المطيري</div>
            <div class="role">Manager</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- الفوتر -->
    <div class="footer">
      <p>هذا التقرير تم إنشاؤه آلياً بواسطة نظام Symbol AI لإدارة الأعمال</p>
      <p class="copyright">All rights reserved to Symbol AI © ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
`;

  // توليد PDF باستخدام Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export default { generateCashFlowReportPDF };
