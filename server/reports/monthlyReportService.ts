// خدمة التقارير الشهرية التلقائية
// Symbol AI - نظام إدارة الأعمال

import { Resend } from "resend";
import * as db from "../db";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@symbolai.net";

// أسماء الأشهر بالعربية
const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// أنواع البيانات للتقرير الشهري
interface MonthlyReportData {
  period: {
    month: number;
    year: number;
    monthName: string;
    startDate: Date;
    endDate: Date;
  };
  revenue: {
    total: number;
    cash: number;
    network: number;
    dailyAverage: number;
    daysWithRevenue: number;
    totalDays: number;
    byBranch: Array<{
      branchId: number;
      branchName: string;
      total: number;
      cash: number;
      network: number;
      percentage: number;
    }>;
  };
  expenses: {
    total: number;
    byCategory: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  purchases: {
    total: number;
    count: number;
  };
  profit: {
    gross: number;
    net: number;
    grossMargin: number;
    netMargin: number;
  };
  employees: {
    total: number;
    active: number;
  };
  bonus: {
    totalPaid: number;
    eligibleEmployees: number;
  };
  comparison: {
    previousMonth: {
      revenue: number;
      expenses: number;
      profit: number;
    };
    revenueChange: number;
    expensesChange: number;
    profitChange: number;
  };
}

/**
 * تنسيق المبلغ بالريال السعودي
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ر.س';
}

/**
 * تنسيق النسبة المئوية
 */
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}

/**
 * جلب بيانات التقرير الشهري بدقة عالية
 */
export async function getMonthlyReportData(month: number, year: number): Promise<MonthlyReportData> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const totalDays = endDate.getDate();
  
  // جلب الفروع
  const branches = await db.getBranches();
  const branchMap = new Map(branches.map((b: any) => [b.id, b.name]));
  
  // جلب الموظفين
  const employees = await db.getAllEmployees();
  
  // ===== الإيرادات =====
  const revenues = await db.getAllDailyRevenuesByDateRange(startDate, endDate);
  
  let totalRevenue = 0;
  let totalCash = 0;
  let totalNetwork = 0;
  const revenueByBranch = new Map<number, { total: number; cash: number; network: number }>();
  const daysWithRevenue = new Set<string>();
  
  for (const rev of revenues) {
    // الحقول هي cash, network, total كـ strings
    const cashVal = parseFloat(String(rev.cash || '0'));
    const networkVal = parseFloat(String(rev.network || '0'));
    const revTotal = cashVal + networkVal;
    
    totalRevenue += revTotal;
    totalCash += cashVal;
    totalNetwork += networkVal;
    
    // تسجيل الأيام التي بها إيرادات
    if (rev.date) {
      daysWithRevenue.add(new Date(rev.date).toDateString());
    }
    
    // تجميع حسب الفرع
    if (rev.branchId) {
      const existing = revenueByBranch.get(rev.branchId) || { total: 0, cash: 0, network: 0 };
      existing.total += revTotal;
      existing.cash += cashVal;
      existing.network += networkVal;
      revenueByBranch.set(rev.branchId, existing);
    }
  }
  
  // ===== المصاريف =====
  const expensesList = await db.getExpensesByDateRange(startDate.toISOString(), endDate.toISOString());
  
  let totalExpenses = 0;
  const expensesByCategory = new Map<string, number>();
  
  for (const exp of expensesList) {
    const amount = parseFloat(String(exp.amount || '0'));
    totalExpenses += amount;
    
    // تجميع حسب الفئة
    const category = exp.category || 'أخرى';
    expensesByCategory.set(category, (expensesByCategory.get(category) || 0) + amount);
  }
  
  // ===== المشتريات =====
  const allPurchaseOrders = await db.getAllPurchaseOrders();
  const purchaseOrders = allPurchaseOrders.filter((po: any) => {
    const poDate = new Date(po.orderDate || po.createdAt);
    return poDate >= startDate && poDate <= endDate;
  });
  
  let totalPurchases = 0;
  for (const po of purchaseOrders) {
    totalPurchases += parseFloat(String(po.subtotal || po.taxAmount || '0'));
  }
  
  // ===== البونص =====
  const allBonusDetails = await db.getAllWeeklyBonusDetails();
  const bonusData = allBonusDetails.filter((b: any) => {
    if (!b.createdAt) return false;
    const bonusDate = new Date(b.createdAt);
    return bonusDate.getMonth() + 1 === month && bonusDate.getFullYear() === year;
  });
  
  let totalBonusPaid = 0;
  let eligibleEmployees = 0;
  
  for (const bonus of bonusData) {
    const bonusAmount = parseFloat(String(bonus.bonusAmount || '0'));
    if (bonusAmount > 0) {
      totalBonusPaid += bonusAmount;
      eligibleEmployees++;
    }
  }
  
  // ===== بيانات الشهر السابق للمقارنة =====
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
  const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59);
  
  const prevRevenues = await db.getAllDailyRevenuesByDateRange(prevStartDate, prevEndDate);
  let prevTotalRevenue = 0;
  for (const rev of prevRevenues) {
    prevTotalRevenue += parseFloat(String(rev.cash || '0')) + parseFloat(String(rev.network || '0'));
  }
  
  const prevExpenses = await db.getExpensesByDateRange(prevStartDate.toISOString(), prevEndDate.toISOString());
  let prevTotalExpenses = 0;
  for (const exp of prevExpenses) {
    prevTotalExpenses += parseFloat(String(exp.amount || '0'));
  }
  
  const prevProfit = prevTotalRevenue - prevTotalExpenses;
  
  // ===== حساب الأرباح =====
  const grossProfit = totalRevenue - totalPurchases;
  const netProfit = totalRevenue - totalExpenses - totalPurchases;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  // ===== حساب التغيرات =====
  const revenueChange = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0;
  const expensesChange = prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 : 0;
  const profitChange = prevProfit !== 0 ? ((netProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;
  
  // ===== تجميع البيانات النهائية =====
  return {
    period: {
      month,
      year,
      monthName: arabicMonths[month - 1],
      startDate,
      endDate,
    },
    revenue: {
      total: totalRevenue,
      cash: totalCash,
      network: totalNetwork,
      dailyAverage: daysWithRevenue.size > 0 ? totalRevenue / daysWithRevenue.size : 0,
      daysWithRevenue: daysWithRevenue.size,
      totalDays,
      byBranch: Array.from(revenueByBranch.entries()).map(([branchId, data]) => ({
        branchId,
        branchName: branchMap.get(branchId) || 'غير محدد',
        total: data.total,
        cash: data.cash,
        network: data.network,
        percentage: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
      })).sort((a, b) => b.total - a.total),
    },
    expenses: {
      total: totalExpenses,
      byCategory: Array.from(expensesByCategory.entries()).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      })).sort((a, b) => b.amount - a.amount),
    },
    purchases: {
      total: totalPurchases,
      count: purchaseOrders.length,
    },
    profit: {
      gross: grossProfit,
      net: netProfit,
      grossMargin,
      netMargin,
    },
    employees: {
      total: employees.length,
      active: employees.filter((e: any) => e.isActive).length,
    },
    bonus: {
      totalPaid: totalBonusPaid,
      eligibleEmployees,
    },
    comparison: {
      previousMonth: {
        revenue: prevTotalRevenue,
        expenses: prevTotalExpenses,
        profit: prevProfit,
      },
      revenueChange,
      expensesChange,
      profitChange,
    },
  };
}

/**
 * إنشاء قالب HTML للتقرير الشهري
 */
export function generateMonthlyReportHTML(data: MonthlyReportData): string {
  const changeColor = (value: number) => value >= 0 ? '#22c55e' : '#ef4444';
  const changeIcon = (value: number) => value >= 0 ? '📈' : '📉';
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 40px; text-align: center; }
    .header .icon { font-size: 48px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header .period { margin: 10px 0 0; font-size: 18px; opacity: 0.9; }
    .content { padding: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 20px; text-align: center; }
    .summary-card.revenue { background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); }
    .summary-card.expenses { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); }
    .summary-card.profit { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); }
    .summary-card .label { font-size: 14px; color: #64748b; margin-bottom: 8px; }
    .summary-card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .summary-card .change { font-size: 12px; margin-top: 5px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: 600; color: #1e3a5f; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; font-size: 13px; }
    td { color: #1e293b; font-size: 14px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .kpi-item { background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; }
    .kpi-item .kpi-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
    .kpi-item .kpi-value { font-size: 20px; font-weight: 700; color: #1e3a5f; }
    .footer { background: #1e3a5f; color: white; padding: 25px; text-align: center; }
    .footer .company { font-size: 16px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">📊</div>
      <h1>التقرير المالي الشهري</h1>
      <div class="period">${data.period.monthName} ${data.period.year}</div>
    </div>
    
    <div class="content">
      <div class="summary-grid">
        <div class="summary-card revenue">
          <div class="label">إجمالي الإيرادات</div>
          <div class="value">${formatCurrency(data.revenue.total)}</div>
          <div class="change" style="color: ${changeColor(data.comparison.revenueChange)}">
            ${changeIcon(data.comparison.revenueChange)} ${formatPercent(data.comparison.revenueChange)} عن الشهر السابق
          </div>
        </div>
        <div class="summary-card expenses">
          <div class="label">إجمالي المصاريف</div>
          <div class="value">${formatCurrency(data.expenses.total)}</div>
          <div class="change" style="color: ${changeColor(-data.comparison.expensesChange)}">
            ${changeIcon(-data.comparison.expensesChange)} ${formatPercent(data.comparison.expensesChange)} عن الشهر السابق
          </div>
        </div>
        <div class="summary-card profit">
          <div class="label">صافي الربح</div>
          <div class="value" style="color: ${data.profit.net >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(data.profit.net)}</div>
          <div class="change" style="color: ${changeColor(data.comparison.profitChange)}">
            ${changeIcon(data.comparison.profitChange)} ${formatPercent(data.comparison.profitChange)} عن الشهر السابق
          </div>
        </div>
        <div class="summary-card">
          <div class="label">إجمالي المشتريات</div>
          <div class="value">${formatCurrency(data.purchases.total)}</div>
          <div class="change">${data.purchases.count} أمر شراء</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">📈 مؤشرات الأداء الرئيسية</div>
        <div class="kpi-grid">
          <div class="kpi-item">
            <div class="kpi-label">هامش الربح الإجمالي</div>
            <div class="kpi-value" style="color: ${data.profit.grossMargin >= 0 ? '#16a34a' : '#dc2626'}">${data.profit.grossMargin.toFixed(1)}%</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">هامش الربح الصافي</div>
            <div class="kpi-value" style="color: ${data.profit.netMargin >= 0 ? '#16a34a' : '#dc2626'}">${data.profit.netMargin.toFixed(1)}%</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">متوسط الإيراد اليومي</div>
            <div class="kpi-value">${formatCurrency(data.revenue.dailyAverage)}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">أيام العمل</div>
            <div class="kpi-value">${data.revenue.daysWithRevenue} / ${data.revenue.totalDays}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">الموظفين النشطين</div>
            <div class="kpi-value">${data.employees.active} / ${data.employees.total}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">البونص المصروف</div>
            <div class="kpi-value">${formatCurrency(data.bonus.totalPaid)}</div>
          </div>
        </div>
      </div>
      
      ${data.revenue.byBranch.length > 0 ? `
      <div class="section">
        <div class="section-title">💰 الإيرادات حسب الفرع</div>
        <table>
          <thead>
            <tr>
              <th>الفرع</th>
              <th>الإجمالي</th>
              <th>النقدي</th>
              <th>الشبكة</th>
              <th>النسبة</th>
            </tr>
          </thead>
          <tbody>
            ${data.revenue.byBranch.map(b => `
            <tr>
              <td>${b.branchName}</td>
              <td>${formatCurrency(b.total)}</td>
              <td>${formatCurrency(b.cash)}</td>
              <td>${formatCurrency(b.network)}</td>
              <td>${b.percentage.toFixed(1)}%</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${data.expenses.byCategory.length > 0 ? `
      <div class="section">
        <div class="section-title">📋 المصاريف حسب الفئة</div>
        <table>
          <thead>
            <tr>
              <th>الفئة</th>
              <th>المبلغ</th>
              <th>النسبة</th>
            </tr>
          </thead>
          <tbody>
            ${data.expenses.byCategory.map(c => `
            <tr>
              <td>${c.category}</td>
              <td>${formatCurrency(c.amount)}</td>
              <td>${c.percentage.toFixed(1)}%</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">📊 المقارنة مع الشهر السابق</div>
        <table>
          <thead>
            <tr>
              <th>البند</th>
              <th>الشهر الحالي</th>
              <th>الشهر السابق</th>
              <th>التغير</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>الإيرادات</td>
              <td>${formatCurrency(data.revenue.total)}</td>
              <td>${formatCurrency(data.comparison.previousMonth.revenue)}</td>
              <td style="color: ${changeColor(data.comparison.revenueChange)}">${formatPercent(data.comparison.revenueChange)}</td>
            </tr>
            <tr>
              <td>المصاريف</td>
              <td>${formatCurrency(data.expenses.total)}</td>
              <td>${formatCurrency(data.comparison.previousMonth.expenses)}</td>
              <td style="color: ${changeColor(-data.comparison.expensesChange)}">${formatPercent(data.comparison.expensesChange)}</td>
            </tr>
            <tr>
              <td>صافي الربح</td>
              <td style="color: ${data.profit.net >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(data.profit.net)}</td>
              <td style="color: ${data.comparison.previousMonth.profit >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(data.comparison.previousMonth.profit)}</td>
              <td style="color: ${changeColor(data.comparison.profitChange)}">${formatPercent(data.comparison.profitChange)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="footer">
      <div class="company">Symbol AI - نظام إدارة الأعمال</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * إرسال التقرير الشهري للمشرف العام
 */
export async function sendMonthlyReportToSupervisor(month: number, year: number): Promise<boolean> {
  try {
    console.log(`📊 جاري إنشاء التقرير الشهري لـ ${arabicMonths[month - 1]} ${year}...`);
    
    // جلب بيانات التقرير
    const reportData = await getMonthlyReportData(month, year);
    
    // إنشاء HTML للتقرير
    const reportHTML = generateMonthlyReportHTML(reportData);
    
    // جلب المشرف العام
    const recipients = await db.getNotificationRecipients();
    const supervisor = recipients.find((r: any) => r.role === 'general_supervisor' && r.isActive);
    
    if (!supervisor) {
      console.log('⚠️ لم يتم العثور على المشرف العام');
      return false;
    }
    
    // إرسال البريد
    const subject = `📊 التقرير المالي الشهري - ${reportData.period.monthName} ${reportData.period.year}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: supervisor.email,
      subject,
      html: reportHTML,
    });
    
    console.log(`✅ تم إرسال التقرير الشهري إلى: ${supervisor.name} (${supervisor.email})`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في إرسال التقرير الشهري:', error);
    return false;
  }
}

/**
 * إرسال تذكير المصاريف لمشرفي الفروع
 */
export async function sendExpenseReminder(month: number, year: number): Promise<boolean> {
  try {
    const monthName = arabicMonths[month - 1];
    console.log(`⏰ جاري إرسال تذكير المصاريف لشهر ${monthName} ${year}...`);
    
    // جلب مشرفي الفروع
    const recipients = await db.getNotificationRecipients();
    const branchSupervisors = recipients.filter((r: any) => r.role === 'branch_supervisor' && r.isActive);
    
    if (branchSupervisors.length === 0) {
      console.log('⚠️ لم يتم العثور على مشرفي فروع');
      return false;
    }
    
    for (const supervisor of branchSupervisors) {
      const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 35px; text-align: center; }
    .header .icon { font-size: 48px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 35px; }
    .greeting { font-size: 16px; color: #374151; margin-bottom: 20px; line-height: 1.8; }
    .highlight-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-right: 4px solid #f59e0b; padding: 20px; border-radius: 10px; margin: 20px 0; }
    .highlight-box h3 { color: #92400e; margin: 0 0 10px 0; }
    .highlight-box p { color: #78350f; margin: 0; line-height: 1.7; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
    .footer { background: #1f2937; color: white; padding: 25px; text-align: center; }
    .footer .company { font-size: 16px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">⏰</div>
      <h1>تذكير بتسجيل المصاريف</h1>
    </div>
    <div class="content">
      <p class="greeting">
        السلام عليكم ورحمة الله وبركاته<br><br>
        الأخ الكريم / <strong>${supervisor.name}</strong><br><br>
        نود تذكيركم بضرورة تسجيل جميع مصاريف الفرع لشهر <strong>${monthName} ${year}</strong> في النظام.
      </p>
      <div class="highlight-box">
        <h3>📋 المطلوب:</h3>
        <p>
          يرجى التأكد من تسجيل جميع المصاريف التالية:<br>
          • مصاريف التشغيل اليومية<br>
          • فواتير الخدمات (كهرباء، ماء، إنترنت)<br>
          • مصاريف الصيانة والإصلاحات<br>
          • أي مصاريف أخرى متعلقة بالفرع
        </p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        الموعد النهائي: نهاية الشهر الحالي
      </p>
      <center>
        <a href="https://sym.manus.space/expenses" class="cta-button">تسجيل المصاريف الآن</a>
      </center>
    </div>
    <div class="footer">
      <div class="company">Symbol AI - نظام إدارة الأعمال</div>
    </div>
  </div>
</body>
</html>
      `;
      
      await resend.emails.send({
        from: FROM_EMAIL,
        to: supervisor.email,
        subject: `⏰ تذكير: تسجيل مصاريف شهر ${monthName} ${year}`,
        html: emailHtml,
      });
      
      console.log(`✅ تم إرسال تذكير المصاريف إلى: ${supervisor.name} (${supervisor.email})`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ خطأ في إرسال تذكير المصاريف:', error);
    return false;
  }
}
