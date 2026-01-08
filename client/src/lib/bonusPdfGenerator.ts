// تعريف الأنواع
interface BonusEmployee {
  employeeName: string;
  employeeCode: string;
  weeklyRevenue: string | number;
  bonusTier: string;
  bonusAmount: string | number;
  isEligible: boolean;
}

interface BonusRequest {
  id: number;
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  status: string;
  totalAmount: string | number;
  eligibleCount: number;
  totalEmployees: number;
  requestedAt?: string | Date | null;
  details: BonusEmployee[];
}

// خريطة أسماء المستويات بالعربية
const getTierLabel = (tier: string): string => {
  const labels: Record<string, string> = {
    tier_7: 'المستوى 7',
    tier_6: 'المستوى 6',
    tier_5: 'المستوى 5',
    tier_4: 'المستوى 4',
    tier_3: 'المستوى 3',
    tier_2: 'المستوى 2',
    tier_1: 'المستوى 1',
    none: 'غير مؤهل',
  };
  return labels[tier] || tier;
};

// خريطة حالات البونص بالعربية
const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'مسودة',
    requested: 'قيد المراجعة',
    approved: 'موافق عليه',
    rejected: 'مرفوض',
    paid: 'تم الصرف',
  };
  return labels[status] || status;
};

// أسماء الأشهر بالعربية
const getMonthName = (month: number): string => {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[month - 1] || '';
};

// تنسيق العملة
const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${num.toFixed(2)} ر.س`;
};

/**
 * توليد PDF لتقرير البونص الأسبوعي باستخدام HTML للطباعة
 */
export async function generateBonusPDF(request: BonusRequest): Promise<void> {
  // حساب الإجمالي
  const totalRevenue = request.details.reduce((sum, emp) => sum + (parseFloat(String(emp.weeklyRevenue)) || 0), 0);
  
  // إنشاء صفوف الجدول
  const tableRows = request.details.map((emp, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="name-cell">${emp.employeeName || 'غير معروف'}</td>
      <td>${emp.employeeCode || '-'}</td>
      <td>${formatCurrency(emp.weeklyRevenue)}</td>
      <td><span class="tier-badge tier-${emp.bonusTier}">${getTierLabel(emp.bonusTier)}</span></td>
      <td class="bonus-cell">${emp.isEligible ? formatCurrency(emp.bonusAmount) : '-'}</td>
    </tr>
  `).join('');

  // إنشاء HTML للتقرير
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير البونص - ${request.branchName}</title>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
          size: A4;
          margin: 10mm;
        }
        
        body {
          font-family: 'IBM Plex Sans Arabic', 'Tajawal', Arial, sans-serif;
          background: #fff;
          color: #1e293b;
          font-size: 12px;
          line-height: 1.6;
          direction: rtl;
        }
        
        .container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 0;
        }
        
        /* رأس التقرير */
        .header {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          padding: 20px 25px;
          border-radius: 8px 8px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .header-info h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .header-info .subtitle {
          color: #d4af37;
          font-size: 11px;
        }
        
        .header-info .report-title {
          font-size: 14px;
          margin-top: 8px;
          opacity: 0.9;
        }
        
        .logo {
          width: 60px;
          height: 60px;
          object-fit: contain;
        }
        
        .gold-line {
          height: 3px;
          background: linear-gradient(90deg, #d4af37, #f4d03f, #d4af37);
        }
        
        /* بطاقة المعلومات */
        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0 0 8px 8px;
          padding: 15px 20px;
          margin-bottom: 15px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 12px;
        }
        
        .info-item label {
          display: block;
          font-size: 10px;
          color: #64748b;
          margin-bottom: 3px;
        }
        
        .info-item .value {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }
        
        .info-item .value.status {
          color: #22c55e;
        }
        
        .info-item .value.amount {
          color: #d4af37;
        }
        
        .info-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 12px 0;
        }
        
        .eligible-info {
          font-size: 11px;
          color: #64748b;
        }
        
        .eligible-info strong {
          color: #0f172a;
        }
        
        /* عنوان الجدول */
        .table-header {
          background: #334155;
          color: white;
          padding: 8px 15px;
          border-radius: 6px 6px 0 0;
          font-size: 12px;
          font-weight: 600;
        }
        
        /* الجدول */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        
        th {
          background: #475569;
          color: white;
          padding: 10px 8px;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
        }
        
        td {
          padding: 10px 8px;
          text-align: center;
          border-bottom: 1px solid #e2e8f0;
          font-size: 11px;
        }
        
        tr:nth-child(even) {
          background: #f8fafc;
        }
        
        .name-cell {
          text-align: right;
          font-weight: 500;
        }
        
        .bonus-cell {
          font-weight: 600;
          color: #22c55e;
        }
        
        .tier-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
        }
        
        .tier-tier_7 { background: linear-gradient(135deg, #9333ea, #ec4899); color: white; }
        .tier-tier_6 { background: #a855f7; color: white; }
        .tier-tier_5 { background: #2563eb; color: white; }
        .tier-tier_4 { background: #3b82f6; color: white; }
        .tier-tier_3 { background: #22c55e; color: white; }
        .tier-tier_2 { background: #eab308; color: black; }
        .tier-tier_1 { background: #f97316; color: white; }
        .tier-none { background: #94a3b8; color: white; }
        
        .total-row {
          background: #e2e8f0 !important;
          font-weight: 700;
        }
        
        .total-row .bonus-cell {
          color: #22c55e;
          font-size: 13px;
        }
        
        /* قسم التوقيعات */
        .signatures-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-top: 20px;
          overflow: hidden;
        }
        
        .signatures-header {
          background: #334155;
          color: white;
          padding: 8px 15px;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
        }
        
        .signatures-content {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 15px;
          gap: 10px;
        }
        
        .signature-box {
          text-align: center;
        }
        
        .signature-box .title {
          font-size: 10px;
          color: #64748b;
          margin-bottom: 8px;
        }
        
        .signature-box img {
          max-width: 100px;
          max-height: 50px;
          object-fit: contain;
        }
        
        .signature-box .stamp {
          max-width: 80px;
          max-height: 80px;
        }
        
        .signature-line {
          width: 100px;
          height: 1px;
          background: #64748b;
          margin: 8px auto;
        }
        
        .signature-box .name {
          font-size: 11px;
          font-weight: 600;
          color: #0f172a;
        }
        
        .signature-box .role {
          font-size: 9px;
          color: #64748b;
        }
        
        /* ذيل التقرير */
        .footer {
          background: #0f172a;
          color: #d4af37;
          padding: 10px;
          text-align: center;
          font-size: 9px;
          margin-top: 20px;
          border-radius: 6px;
        }
        
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .container { max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- رأس التقرير -->
        <div class="header">
          <div class="header-info">
            <h1>Symbol AI</h1>
            <div class="subtitle">نظام إدارة الصالونات</div>
            <div class="report-title">تقرير البونص الأسبوعي</div>
          </div>
          <img src="/symbol-ai-logo.png" alt="Logo" class="logo">
        </div>
        
        <div class="gold-line"></div>
        
        <!-- بطاقة المعلومات -->
        <div class="info-card">
          <div class="info-grid">
            <div class="info-item">
              <label>الفرع</label>
              <div class="value">${request.branchName}</div>
            </div>
            <div class="info-item">
              <label>الفترة</label>
              <div class="value">الأسبوع ${request.weekNumber} - ${getMonthName(request.month)} ${request.year}</div>
            </div>
            <div class="info-item">
              <label>الحالة</label>
              <div class="value status">${getStatusLabel(request.status)}</div>
            </div>
            <div class="info-item">
              <label>إجمالي البونص</label>
              <div class="value amount">${formatCurrency(request.totalAmount)}</div>
            </div>
          </div>
          <div class="info-divider"></div>
          <div class="eligible-info">
            الموظفين المؤهلين: <strong>${request.eligibleCount} من ${request.totalEmployees}</strong>
          </div>
        </div>
        
        <!-- جدول الموظفين -->
        <div class="table-header">تفاصيل بونص الموظفين</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px">#</th>
              <th style="width: 150px">اسم الموظف</th>
              <th style="width: 80px">الكود</th>
              <th style="width: 100px">الإيراد الأسبوعي</th>
              <th style="width: 90px">المستوى</th>
              <th style="width: 90px">البونص</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td></td>
              <td class="name-cell">الإجمالي</td>
              <td></td>
              <td>${formatCurrency(totalRevenue)}</td>
              <td>${request.eligibleCount} مؤهل</td>
              <td class="bonus-cell">${formatCurrency(request.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
        
        <!-- قسم التوقيعات -->
        <div class="signatures-section">
          <div class="signatures-header">الموافقات والتوقيعات</div>
          <div class="signatures-content">
            <div class="signature-box">
              <div class="title">المشرف العام</div>
              <img src="/assets/signature-salem.png" alt="توقيع سالم">
              <div class="signature-line"></div>
              <div class="name">سالم الوادي</div>
              <div class="role">المشرف العام</div>
            </div>
            <div class="signature-box">
              <img src="/assets/stamp.png" alt="الختم" class="stamp">
              <div class="role">الختم الرسمي</div>
            </div>
            <div class="signature-box">
              <div class="title">المدير العام</div>
              <img src="/assets/signature-omar.png" alt="توقيع عمر">
              <div class="signature-line"></div>
              <div class="name">عمر المطيري</div>
              <div class="role">المدير العام</div>
            </div>
          </div>
        </div>
        
        <!-- ذيل التقرير -->
        <div class="footer">
          Symbol AI ERP System | تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-SA')} الساعة ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} | رقم التقرير: BR-${request.id}
        </div>
      </div>
    </body>
    </html>
  `;

  // فتح نافذة جديدة للطباعة
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // انتظار تحميل الصور ثم الطباعة
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
}
