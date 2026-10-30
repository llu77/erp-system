/**
 * خدمة توليد تقرير التدفق النقدي PDF
 * قالب احترافي للشركات مع ختم وتوقيعات
 * يستخدم HTML مباشرة للطباعة من المتصفح
 * الجهة المُصدرة: مؤسسة الفرع المحدد، أو الهوية العامة لجميع الفروع (بدون اسم النظام)
 */

import { SIGNATURES } from '../shared/branding';
import { escapeHtml } from '../shared/vouchers';
import { establishmentDetailsLine, getReportEstablishment, reportFooterHtml } from '../shared/reportBranding';

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

/**
 * توليد HTML للتقرير - يمكن طباعته مباشرة من المتصفح
 */
export function generateCashFlowReportHTML(data: CashFlowPDFData): string {
  const periodLabel = data.periodType === 'monthly' && data.month
    ? `${monthNames[data.month - 1]} ${data.year}`
    : data.periodType === 'quarterly' && data.quarter
    ? `الربع ${data.quarter} - ${data.year}`
    : data.periodType === 'yearly'
    ? `${data.year}`
    : `${data.startDate} - ${data.endDate}`;

  const branchLabel = data.branchName || 'جميع الفروع';
  const est = getReportEstablishment(data.branchName);
  const estDetails = establishmentDetailsLine(est);
  const isPositive = data.summary.remainingCash >= 0;
  const growthColor = data.kpis.growthRate >= 0 ? '#22c55e' : '#ef4444';
  const growthIcon = data.kpis.growthRate >= 0 ? '↑' : '↓';

  return `
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
      background: #ffffff;
      color: #000000;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      margin: 0 auto;
      background: white;
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
      color: #000000;
    }
    
    .report-meta .date {
      font-weight: 600;
      color: #000000;
    }
    
    /* عنوان التقرير */
    .report-title {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .report-title h2 {
      font-size: 24px;
      font-weight: 700;
      color: #000000;
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
      color: #000000;
    }
    
    /* بطاقات الملخص */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    
    .summary-card {
      background: #f8fafc;
      border-radius: 10px;
      padding: 15px;
      text-align: center;
      border: 2px solid #e2e8f0;
    }
    
    .summary-card.revenue {
      border-color: #22c55e;
      background: #f0fdf4;
    }
    
    .summary-card.expenses {
      border-color: #ef4444;
      background: #fef2f2;
    }
    
    .summary-card.vouchers {
      border-color: #f97316;
      background: #fff7ed;
    }
    
    .summary-card.advances {
      border-color: #a855f7;
      background: #faf5ff;
    }
    
    .summary-card.remaining {
      border-color: ${isPositive ? '#3b82f6' : '#ef4444'};
      background: ${isPositive ? '#eff6ff' : '#fef2f2'};
    }
    
    .summary-card .label {
      font-size: 11px;
      color: #000000;
      margin-bottom: 6px;
      font-weight: 600;
    }
    
    .summary-card .value {
      font-size: 16px;
      font-weight: 700;
      color: #000000;
    }
    
    .summary-card.revenue .value { color: #16a34a; }
    .summary-card.expenses .value { color: #dc2626; }
    .summary-card.vouchers .value { color: #ea580c; }
    .summary-card.advances .value { color: #9333ea; }
    .summary-card.remaining .value { color: ${isPositive ? '#2563eb' : '#dc2626'}; }
    
    .summary-card .sub {
      font-size: 9px;
      color: #64748b;
      margin-top: 4px;
    }
    
    /* مؤشرات الأداء */
    .kpi-section {
      background: #1a1a2e;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 25px;
      color: white;
    }
    
    .kpi-section h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    
    .kpi-item {
      text-align: center;
      padding: 12px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
    }
    
    .kpi-item .label {
      font-size: 10px;
      color: rgba(255,255,255,0.8);
      margin-bottom: 6px;
    }
    
    .kpi-item .value {
      font-size: 14px;
      font-weight: 700;
      color: white;
    }
    
    .kpi-item.growth .value {
      color: ${growthColor};
    }
    
    /* جدول طرق الدفع */
    .payment-section {
      margin-bottom: 25px;
    }
    
    .payment-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #000000;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .payment-tables {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    
    .payment-table {
      background: #f8fafc;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    
    .payment-table h4 {
      background: #1a1a2e;
      color: white;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .payment-table table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .payment-table th,
    .payment-table td {
      padding: 8px 12px;
      text-align: right;
      font-size: 11px;
      border-bottom: 1px solid #e2e8f0;
      color: #000000;
    }
    
    .payment-table th {
      background: #f1f5f9;
      font-weight: 600;
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
      margin-bottom: 25px;
    }
    
    .branches-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #000000;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .branches-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    
    .branches-table th {
      background: #1a1a2e;
      color: white;
      padding: 10px 12px;
      text-align: right;
      font-size: 11px;
      font-weight: 600;
    }
    
    .branches-table td {
      padding: 10px 12px;
      text-align: right;
      font-size: 11px;
      border-bottom: 1px solid #e2e8f0;
      color: #000000;
    }
    
    .branches-table tr:last-child td {
      border-bottom: none;
    }
    
    .branches-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .positive { color: #16a34a !important; }
    .negative { color: #dc2626 !important; }
    
    /* التوقيعات والختم */
    .signatures-section {
      margin-top: 30px;
      padding-top: 25px;
      border-top: 2px solid #e2e8f0;
    }
    
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 25px;
      text-align: center;
    }
    
    .signature-box {
      padding: 15px;
    }
    
    .signature-box .title {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 35px;
    }
    
    .signature-box .line {
      border-top: 1px solid #000000;
      padding-top: 8px;
    }
    
    .signature-box .name {
      font-size: 13px;
      font-weight: 600;
      color: #000000;
    }
    
    .signature-box .role {
      font-size: 10px;
      color: #64748b;
    }
    
    .stamp-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .stamp {
      width: 117px;
      height: 117px;
      border: 3px solid #a855f7;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #a855f7;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .stamp .company {
      font-size: 10px;
      line-height: 1.2;
      text-align: center;
      padding: 0 4px;
    }
    
    .stamp .symbol {
      font-size: 21px;
    }
    
    /* الفوتر */
    .footer {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9px;
      color: #64748b;
    }
    
    .footer .copyright {
      margin-top: 4px;
    }
    
    @media print {
      body { 
        background: white; 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page { 
        box-shadow: none; 
        padding: 10mm;
      }
      .summary-cards {
        grid-template-columns: repeat(5, 1fr);
      }
      .kpi-section {
        background: #1a1a2e !important;
        -webkit-print-color-adjust: exact !important;
      }
      .payment-table h4,
      .branches-table th {
        background: #1a1a2e !important;
        -webkit-print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- الهيدر -->
    <div class="header">
      <div class="logo-section">
        <div class="company-info">
          <h1>${escapeHtml(est.nameAr)}</h1>
          ${estDetails ? `<p>${escapeHtml(estDetails)}</p>` : ''}
        </div>
      </div>
      <div class="report-meta">
        <p>تاريخ الإصدار: <span class="date">${formatDate(data.generatedAt)}</span></p>
        <p>أعده: ${escapeHtml(data.generatedBy)}</p>
        <p>رقم التقرير: CF-${data.year}${data.month ? String(data.month).padStart(2, '0') : '00'}-${Date.now().toString().slice(-4)}</p>
      </div>
    </div>
    
    <!-- عنوان التقرير -->
    <div class="report-title">
      <h2>تقرير التدفق النقدي</h2>
      <span class="period">${periodLabel}</span>
      <span class="branch">${escapeHtml(branchLabel)}</span>
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
      <h3>📊 مؤشرات الأداء الرئيسية (KPIs)</h3>
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
                    <td style="color: #ea580c;">${formatCurrency(d.total)}</td>
                  </tr>
                `).join('')}
              <tr class="total-row">
                <td>الإجمالي</td>
                <td>${Object.values(data.vouchersByMethod).reduce((sum, d) => sum + d.count, 0)}</td>
                <td style="color: #ea580c;">${formatCurrency(data.summary.totalCashVouchers)}</td>
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
              <td><strong>${escapeHtml(branch.branchName)}</strong></td>
              <td class="positive">${formatCurrency(branch.cashRevenue)}</td>
              <td class="negative">${formatCurrency(branch.cashExpenses)}</td>
              <td style="color: #ea580c;">${formatCurrency(branch.cashVouchers)}</td>
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
          <div class="title">${escapeHtml(SIGNATURES.supervisor.title)}</div>
          <div class="line">
            <div class="name">${escapeHtml(SIGNATURES.supervisor.name)}</div>
            <div class="role">${escapeHtml(SIGNATURES.supervisor.titleEn)}</div>
          </div>
        </div>
        
        <div class="signature-box stamp-box">
          <div class="stamp">
            <span class="company">${escapeHtml(est.nameAr)}</span>
            <span class="symbol">✓</span>
            <span class="company">معتمد</span>
          </div>
          <div class="role">${escapeHtml(SIGNATURES.stamp.label)}</div>
        </div>
        
        <div class="signature-box">
          <div class="title">${escapeHtml(SIGNATURES.manager.title)}</div>
          <div class="line">
            <div class="name">${escapeHtml(SIGNATURES.manager.name)}</div>
            <div class="role">${escapeHtml(SIGNATURES.manager.titleEn)}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- الفوتر -->
    <div class="footer">
      <p>${reportFooterHtml(est)}</p>
    </div>
  </div>
  
  <script>
    // طباعة تلقائية عند فتح الصفحة
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
`;
}

// للتوافق مع الكود القديم - يُرجع HTML بدلاً من Buffer
export async function generateCashFlowReportPDF(data: CashFlowPDFData): Promise<string> {
  return generateCashFlowReportHTML(data);
}

export default { generateCashFlowReportPDF, generateCashFlowReportHTML };
