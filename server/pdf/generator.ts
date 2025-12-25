/**
 * مولد تقارير PDF الاحترافي
 * يدعم: مسيرات الرواتب، الإيرادات، طلبات الموظفين، المصاريف
 */

// أنواع التقارير المدعومة
export type ReportType = 'payroll' | 'revenues' | 'requests' | 'expenses';

// واجهة بيانات مسيرة الرواتب
export interface PayrollReportData {
  payroll: {
    payrollNumber: string;
    branchName: string;
    year: number;
    month: number;
    periodStart: Date;
    periodEnd: Date;
    totalBaseSalary: string;
    totalOvertime: string;
    totalIncentives: string;
    totalDeductions: string;
    totalNetSalary: string;
    employeeCount: number;
    status: string;
    createdByName: string;
    createdAt: Date;
    approvedByName?: string;
    approvedAt?: Date;
  };
  details: {
    employeeName: string;
    employeeCode: string;
    position: string;
    baseSalary: string;
    overtimeEnabled?: boolean;
    overtimeAmount: string;
    workDays?: number;
    absentDays?: number;
    absentDeduction?: string;
    incentiveAmount: string;
    deductionAmount: string;
    advanceDeduction: string;
    grossSalary: string;
    totalDeductions: string;
    netSalary: string;
  }[];
  companyInfo: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
  };
}

// واجهة بيانات تقرير الإيرادات
export interface RevenuesReportData {
  branchName: string;
  period: {
    startDate: string;
    endDate: string;
  };
  revenues: {
    date: Date;
    totalRevenue: string;
    cashRevenue: string;
    cardRevenue: string;
    onlineRevenue: string;
    expenses: string;
    netRevenue: string;
    notes?: string;
  }[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    averageDaily: number;
    daysCount: number;
  };
  companyInfo: {
    name: string;
    address?: string;
    phone?: string;
  };
}

// واجهة بيانات تقرير طلبات الموظفين
export interface RequestsReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  requests: {
    requestNumber: string;
    employeeName: string;
    branchName: string;
    requestType: string;
    title: string;
    amount?: string;
    status: string;
    createdAt: Date;
    reviewedAt?: Date;
    reviewedByName?: string;
  }[];
  summary: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    totalAmount: number;
  };
  companyInfo: {
    name: string;
  };
}

// واجهة بيانات تقرير المصاريف
export interface ExpensesReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  expenses: {
    expenseNumber: string;
    title: string;
    category: string;
    amount: string;
    branchName?: string;
    expenseDate: Date;
    status: string;
    paymentMethod: string;
    createdByName: string;
  }[];
  summary: {
    total: number;
    totalAmount: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
  companyInfo: {
    name: string;
  };
}

// أسماء الأشهر بالعربية
const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// أسماء تصنيفات المصاريف بالعربية
const expenseCategoryNames: Record<string, string> = {
  operational: 'تشغيلية',
  administrative: 'إدارية',
  marketing: 'تسويق',
  maintenance: 'صيانة',
  utilities: 'مرافق',
  rent: 'إيجار',
  salaries: 'رواتب',
  supplies: 'مستلزمات',
  transportation: 'نقل',
  other: 'أخرى',
};

// أسماء طرق الدفع بالعربية
const paymentMethodNames: Record<string, string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
  credit_card: 'بطاقة ائتمان',
  other: 'أخرى',
};

// أسماء أنواع الطلبات بالعربية
const requestTypeNames: Record<string, string> = {
  advance: 'سلفة',
  vacation: 'إجازة',
  arrears: 'صرف متأخرات',
  permission: 'استئذان',
  objection: 'اعتراض',
  resignation: 'استقالة',
};

// أسماء حالات الطلبات بالعربية
const statusNames: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
  draft: 'مسودة',
  paid: 'مدفوع',
};

// تنسيق التاريخ
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// تنسيق المبلغ
function formatAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * توليد HTML لتقرير مسيرة الرواتب
 */
export function generatePayrollHTML(data: PayrollReportData): string {
  const { payroll, details, companyInfo } = data;
  const monthName = arabicMonths[payroll.month - 1];
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>مسيرة رواتب - ${payroll.branchName} - ${monthName} ${payroll.year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .company-info h1 {
      font-size: 24px;
      color: #1e40af;
      margin-bottom: 5px;
    }
    .company-info p {
      color: #666;
      font-size: 11px;
    }
    .report-title {
      text-align: left;
    }
    .report-title h2 {
      font-size: 18px;
      color: #1e40af;
    }
    .report-title p {
      color: #666;
      font-size: 11px;
    }
    .info-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .info-item {
      text-align: center;
    }
    .info-item label {
      display: block;
      font-size: 10px;
      color: #666;
      margin-bottom: 3px;
    }
    .info-item span {
      font-size: 14px;
      font-weight: bold;
      color: #1e40af;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #1e40af;
      color: white;
      padding: 10px 8px;
      font-size: 11px;
      text-align: center;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    tr:hover {
      background: #e2e8f0;
    }
    .summary-section {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      padding: 20px;
      border-radius: 8px;
      color: white;
      margin-bottom: 20px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item label {
      display: block;
      font-size: 10px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .summary-item span {
      font-size: 16px;
      font-weight: bold;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .signature-box {
      text-align: center;
      width: 200px;
    }
    .signature-box .line {
      border-top: 1px solid #333;
      margin-top: 40px;
      padding-top: 5px;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: bold;
    }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-draft { background: #e2e8f0; color: #475569; }
    .status-paid { background: #dbeafe; color: #1e40af; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info" style="display: flex; align-items: center; gap: 15px;">
      <img src="/symbol-ai-logo.png" alt="Symbol AI" style="height: 50px; width: auto; object-fit: contain;" />
      <div>
        <h1>${companyInfo.name}</h1>
        ${companyInfo.address ? `<p>${companyInfo.address}</p>` : ''}
        ${companyInfo.phone ? `<p>هاتف: ${companyInfo.phone}</p>` : ''}
      </div>
    </div>
    <div class="report-title">
      <h2>مسيرة رواتب</h2>
      <p>رقم المسيرة: ${payroll.payrollNumber}</p>
      <p>تاريخ الإنشاء: ${formatDate(payroll.createdAt)}</p>
    </div>
  </div>

  <div class="info-section">
    <div class="info-item">
      <label>الفرع</label>
      <span>${payroll.branchName}</span>
    </div>
    <div class="info-item">
      <label>الشهر</label>
      <span>${monthName} ${payroll.year}</span>
    </div>
    <div class="info-item">
      <label>عدد الموظفين</label>
      <span>${payroll.employeeCount}</span>
    </div>
    <div class="info-item">
      <label>الحالة</label>
      <span class="status-badge status-${payroll.status}">${statusNames[payroll.status] || payroll.status}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>اسم الموظف</th>
        <th>الرمز</th>
        <th>الأساسي</th>
        <th>إضافي</th>
        <th>أيام العمل</th>
        <th>خصم غياب</th>
        <th>حوافز</th>
        <th>خصومات</th>
        <th>سلف</th>
        <th>الصافي</th>
      </tr>
    </thead>
    <tbody>
      ${details.map((emp, index) => `
        <tr>
          <td>${index + 1}</td>
          <td style="text-align: right;">${emp.employeeName}</td>
          <td>${emp.employeeCode}</td>
          <td>${formatAmount(emp.baseSalary)}</td>
          <td style="color: ${parseFloat(emp.overtimeAmount) > 0 ? '#2563eb' : '#666'};">${parseFloat(emp.overtimeAmount) > 0 ? formatAmount(emp.overtimeAmount) : '-'}</td>
          <td>${(emp as any).workDays || 30}</td>
          <td style="color: ${parseFloat((emp as any).absentDeduction || '0') > 0 ? '#dc2626' : '#666'};">${parseFloat((emp as any).absentDeduction || '0') > 0 ? '-' + formatAmount((emp as any).absentDeduction) : '-'}</td>
          <td style="color: ${parseFloat(emp.incentiveAmount) > 0 ? '#16a34a' : '#666'};">${parseFloat(emp.incentiveAmount) > 0 ? formatAmount(emp.incentiveAmount) : '-'}</td>
          <td style="color: ${parseFloat(emp.deductionAmount) > 0 ? '#dc2626' : '#666'};">${parseFloat(emp.deductionAmount) > 0 ? '-' + formatAmount(emp.deductionAmount) : '-'}</td>
          <td style="color: ${parseFloat(emp.advanceDeduction) > 0 ? '#dc2626' : '#666'};">${parseFloat(emp.advanceDeduction) > 0 ? '-' + formatAmount(emp.advanceDeduction) : '-'}</td>
          <td style="font-weight: bold; color: #166534;">${formatAmount(emp.netSalary)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-section">
    <div class="summary-item">
      <label>إجمالي الرواتب الأساسية</label>
      <span>${formatAmount(payroll.totalBaseSalary)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>إجمالي الساعات الإضافية</label>
      <span>${formatAmount(payroll.totalOvertime)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>إجمالي الحوافز</label>
      <span>${formatAmount(payroll.totalIncentives)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>إجمالي الخصومات</label>
      <span>${formatAmount(payroll.totalDeductions)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>صافي المسيرة</label>
      <span>${formatAmount(payroll.totalNetSalary)} ر.س</span>
    </div>
  </div>

  <div class="footer">
    <div class="signature-box">
      <p>إعداد</p>
      <div class="line">${payroll.createdByName}</div>
    </div>
    <div class="signature-box">
      <p>مراجعة</p>
      <div class="line"></div>
    </div>
    <div class="signature-box">
      <p>اعتماد</p>
      <div class="line">${payroll.approvedByName || ''}</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * توليد HTML لتقرير الإيرادات
 */
export function generateRevenuesHTML(data: RevenuesReportData): string {
  const { branchName, period, revenues, summary, companyInfo } = data;
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير الإيرادات - ${branchName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #059669;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .company-info h1 {
      font-size: 24px;
      color: #059669;
      margin-bottom: 5px;
    }
    .report-title h2 {
      font-size: 18px;
      color: #059669;
    }
    .info-section {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      background: #f0fdf4;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .info-item {
      text-align: center;
    }
    .info-item label {
      display: block;
      font-size: 10px;
      color: #666;
      margin-bottom: 3px;
    }
    .info-item span {
      font-size: 14px;
      font-weight: bold;
      color: #059669;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #059669;
      color: white;
      padding: 10px 8px;
      font-size: 11px;
      text-align: center;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
    }
    tr:nth-child(even) { background: #f0fdf4; }
    tr:hover { background: #dcfce7; }
    .summary-section {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      padding: 20px;
      border-radius: 8px;
      color: white;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item label {
      display: block;
      font-size: 10px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .summary-item span {
      font-size: 16px;
      font-weight: bold;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${companyInfo.name}</h1>
    </div>
    <div class="report-title">
      <h2>تقرير الإيرادات</h2>
      <p>الفرع: ${branchName}</p>
    </div>
  </div>

  <div class="info-section">
    <div class="info-item">
      <label>من تاريخ</label>
      <span>${period.startDate}</span>
    </div>
    <div class="info-item">
      <label>إلى تاريخ</label>
      <span>${period.endDate}</span>
    </div>
    <div class="info-item">
      <label>عدد الأيام</label>
      <span>${summary.daysCount}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        <th>إيراد نقدي</th>
        <th>إيراد بطاقات</th>
        <th>إيراد إلكتروني</th>
        <th>إجمالي الإيراد</th>
        <th>المصاريف</th>
        <th>صافي الإيراد</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${revenues.map(rev => `
        <tr>
          <td>${formatDate(rev.date)}</td>
          <td>${formatAmount(rev.cashRevenue)}</td>
          <td>${formatAmount(rev.cardRevenue)}</td>
          <td>${formatAmount(rev.onlineRevenue)}</td>
          <td style="font-weight: bold;">${formatAmount(rev.totalRevenue)}</td>
          <td style="color: #dc2626;">${formatAmount(rev.expenses)}</td>
          <td style="font-weight: bold; color: #059669;">${formatAmount(rev.netRevenue)}</td>
          <td>${rev.notes || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-section">
    <div class="summary-item">
      <label>إجمالي الإيرادات</label>
      <span>${formatAmount(summary.totalRevenue)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>إجمالي المصاريف</label>
      <span>${formatAmount(summary.totalExpenses)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>صافي الإيرادات</label>
      <span>${formatAmount(summary.netRevenue)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>متوسط الإيراد اليومي</label>
      <span>${formatAmount(summary.averageDaily)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>عدد الأيام</label>
      <span>${summary.daysCount}</span>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * توليد HTML لتقرير طلبات الموظفين
 */
export function generateRequestsHTML(data: RequestsReportData): string {
  const { period, requests, summary, companyInfo } = data;
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير طلبات الموظفين</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #7c3aed;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .company-info h1 {
      font-size: 24px;
      color: #7c3aed;
      margin-bottom: 5px;
    }
    .report-title h2 {
      font-size: 18px;
      color: #7c3aed;
    }
    .info-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      background: #f5f3ff;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .info-item {
      text-align: center;
    }
    .info-item label {
      display: block;
      font-size: 10px;
      color: #666;
      margin-bottom: 3px;
    }
    .info-item span {
      font-size: 14px;
      font-weight: bold;
      color: #7c3aed;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #7c3aed;
      color: white;
      padding: 10px 8px;
      font-size: 11px;
      text-align: center;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
    }
    tr:nth-child(even) { background: #f5f3ff; }
    tr:hover { background: #ede9fe; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
    }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-rejected { background: #fee2e2; color: #dc2626; }
    .summary-section {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
      padding: 20px;
      border-radius: 8px;
      color: white;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item label {
      display: block;
      font-size: 10px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .summary-item span {
      font-size: 16px;
      font-weight: bold;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${companyInfo.name}</h1>
    </div>
    <div class="report-title">
      <h2>تقرير طلبات الموظفين الموافق عليها</h2>
      <p>الفترة: ${period.startDate} - ${period.endDate}</p>
    </div>
  </div>

  <div class="info-section">
    <div class="info-item">
      <label>إجمالي الطلبات</label>
      <span>${summary.total}</span>
    </div>
    <div class="info-item">
      <label>موافق عليها</label>
      <span style="color: #166534;">${summary.approved}</span>
    </div>
    <div class="info-item">
      <label>مرفوضة</label>
      <span style="color: #dc2626;">${summary.rejected}</span>
    </div>
    <div class="info-item">
      <label>إجمالي المبالغ</label>
      <span>${formatAmount(summary.totalAmount)} ر.س</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>رقم الطلب</th>
        <th>الموظف</th>
        <th>الفرع</th>
        <th>نوع الطلب</th>
        <th>العنوان</th>
        <th>المبلغ</th>
        <th>الحالة</th>
        <th>تاريخ الطلب</th>
        <th>تاريخ المراجعة</th>
        <th>المراجع</th>
      </tr>
    </thead>
    <tbody>
      ${requests.map((req, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${req.requestNumber}</td>
          <td style="text-align: right;">${req.employeeName}</td>
          <td>${req.branchName}</td>
          <td>${requestTypeNames[req.requestType] || req.requestType}</td>
          <td style="text-align: right;">${req.title}</td>
          <td>${req.amount ? formatAmount(req.amount) : '-'}</td>
          <td><span class="status-badge status-${req.status}">${statusNames[req.status] || req.status}</span></td>
          <td>${formatDate(req.createdAt)}</td>
          <td>${req.reviewedAt ? formatDate(req.reviewedAt) : '-'}</td>
          <td>${req.reviewedByName || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-section">
    <div class="summary-item">
      <label>إجمالي الطلبات</label>
      <span>${summary.total}</span>
    </div>
    <div class="summary-item">
      <label>موافق عليها</label>
      <span>${summary.approved}</span>
    </div>
    <div class="summary-item">
      <label>مرفوضة</label>
      <span>${summary.rejected}</span>
    </div>
    <div class="summary-item">
      <label>قيد المراجعة</label>
      <span>${summary.pending}</span>
    </div>
    <div class="summary-item">
      <label>إجمالي المبالغ</label>
      <span>${formatAmount(summary.totalAmount)} ر.س</span>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * توليد HTML لتقرير المصاريف
 */
export function generateExpensesHTML(data: ExpensesReportData): string {
  const { period, expenses, summary, companyInfo } = data;
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير المصاريف</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #dc2626;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .company-info h1 {
      font-size: 24px;
      color: #dc2626;
      margin-bottom: 5px;
    }
    .report-title h2 {
      font-size: 18px;
      color: #dc2626;
    }
    .info-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      background: #fef2f2;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .info-item {
      text-align: center;
    }
    .info-item label {
      display: block;
      font-size: 10px;
      color: #666;
      margin-bottom: 3px;
    }
    .info-item span {
      font-size: 14px;
      font-weight: bold;
      color: #dc2626;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #dc2626;
      color: white;
      padding: 10px 8px;
      font-size: 11px;
      text-align: center;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
    }
    tr:nth-child(even) { background: #fef2f2; }
    tr:hover { background: #fee2e2; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
    }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-rejected { background: #fee2e2; color: #dc2626; }
    .status-paid { background: #dbeafe; color: #1e40af; }
    .summary-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      background: linear-gradient(135deg, #dc2626 0%, #f87171 100%);
      padding: 20px;
      border-radius: 8px;
      color: white;
      margin-bottom: 20px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item label {
      display: block;
      font-size: 10px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .summary-item span {
      font-size: 16px;
      font-weight: bold;
    }
    .category-breakdown {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
    }
    .category-breakdown h3 {
      margin-bottom: 10px;
      color: #dc2626;
    }
    .category-item {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${companyInfo.name}</h1>
    </div>
    <div class="report-title">
      <h2>تقرير المصاريف</h2>
      <p>الفترة: ${period.startDate} - ${period.endDate}</p>
    </div>
  </div>

  <div class="info-section">
    <div class="info-item">
      <label>إجمالي المصاريف</label>
      <span>${summary.total}</span>
    </div>
    <div class="info-item">
      <label>إجمالي المبالغ</label>
      <span>${formatAmount(summary.totalAmount)} ر.س</span>
    </div>
    <div class="info-item">
      <label>معتمدة</label>
      <span>${summary.byStatus['approved'] || 0}</span>
    </div>
    <div class="info-item">
      <label>مدفوعة</label>
      <span>${summary.byStatus['paid'] || 0}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>رقم المصروف</th>
        <th>العنوان</th>
        <th>التصنيف</th>
        <th>المبلغ</th>
        <th>الفرع</th>
        <th>التاريخ</th>
        <th>طريقة الدفع</th>
        <th>الحالة</th>
        <th>بواسطة</th>
      </tr>
    </thead>
    <tbody>
      ${expenses.map((exp, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${exp.expenseNumber}</td>
          <td style="text-align: right;">${exp.title}</td>
          <td>${expenseCategoryNames[exp.category] || exp.category}</td>
          <td style="font-weight: bold;">${formatAmount(exp.amount)} ر.س</td>
          <td>${exp.branchName || '-'}</td>
          <td>${formatDate(exp.expenseDate)}</td>
          <td>${paymentMethodNames[exp.paymentMethod] || exp.paymentMethod}</td>
          <td><span class="status-badge status-${exp.status}">${statusNames[exp.status] || exp.status}</span></td>
          <td>${exp.createdByName}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-section">
    <div class="summary-item">
      <label>إجمالي المصاريف</label>
      <span>${summary.total}</span>
    </div>
    <div class="summary-item">
      <label>إجمالي المبالغ</label>
      <span>${formatAmount(summary.totalAmount)} ر.س</span>
    </div>
    <div class="summary-item">
      <label>معتمدة</label>
      <span>${summary.byStatus['approved'] || 0}</span>
    </div>
    <div class="summary-item">
      <label>مدفوعة</label>
      <span>${summary.byStatus['paid'] || 0}</span>
    </div>
  </div>

  <div class="category-breakdown">
    <h3>توزيع المصاريف حسب التصنيف</h3>
    ${Object.entries(summary.byCategory).map(([cat, amount]) => `
      <div class="category-item">
        <span>${expenseCategoryNames[cat] || cat}</span>
        <span>${formatAmount(amount)} ر.س</span>
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;
}
