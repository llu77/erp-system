import puppeteer from 'puppeteer';
import { getDb } from '../db';
import { dailyRevenues, employeeRevenues, expenses, weeklyBonuses, bonusDetails, employees, branches } from '../../drizzle/schema';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';

// ==================== دوال المساعدة ====================

const getMonthName = (month: number): string => {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[month - 1] || '';
};

const getDayName = (date: Date): string => {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[date.getDay()];
};

const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
};

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    'salaries': 'الرواتب', 'rent': 'الإيجار', 'utilities': 'المرافق',
    'supplies': 'المستلزمات', 'maintenance': 'الصيانة', 'marketing': 'التسويق',
    'transportation': 'النقل', 'communication': 'الاتصالات', 'insurance': 'التأمين',
    'taxes': 'الضرائب', 'licenses': 'التراخيص', 'equipment': 'المعدات',
    'cleaning': 'النظافة', 'security': 'الأمن', 'training': 'التدريب',
    'hospitality': 'الضيافة', 'miscellaneous': 'متنوعة', 'other': 'أخرى'
  };
  return labels[category] || category;
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'pending': 'قيد المراجعة', 'approved': 'معتمد', 'rejected': 'مرفوض', 'paid': 'مدفوع'
  };
  return labels[status] || status;
};

const getTierLabel = (tier: string): string => {
  const labels: Record<string, string> = {
    'tier_7': 'المستوى 7 (ممتاز)', 'tier_6': 'المستوى 6', 'tier_5': 'المستوى 5',
    'tier_4': 'المستوى 4', 'tier_3': 'المستوى 3', 'tier_2': 'المستوى 2',
    'tier_1': 'المستوى 1', 'none': 'غير مؤهل'
  };
  return labels[tier] || tier;
};

const getTierColor = (tier: string): string => {
  const colors: Record<string, string> = {
    'tier_7': '#9333ea', 'tier_6': '#a855f7', 'tier_5': '#2563eb',
    'tier_4': '#3b82f6', 'tier_3': '#22c55e', 'tier_2': '#eab308',
    'tier_1': '#f97316', 'none': '#9ca3af'
  };
  return colors[tier] || '#6b7280';
};

// ==================== تقرير الإيرادات الشهري ====================

export async function generateMonthlyRevenueReport(month: number, year: number, branchId?: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // جلب الإيرادات اليومية للفروع
  const dailyRevenuesQuery = db.select({
    id: dailyRevenues.id,
    date: dailyRevenues.date,
    cash: dailyRevenues.cash,
    network: dailyRevenues.network,
    total: dailyRevenues.total,
    branchId: dailyRevenues.branchId,
    branchName: branches.name
  })
  .from(dailyRevenues)
  .leftJoin(branches, eq(dailyRevenues.branchId, branches.id))
  .where(
    and(
      gte(dailyRevenues.date, startDate),
      lte(dailyRevenues.date, endDate),
      branchId ? eq(dailyRevenues.branchId, branchId) : sql`1=1`
    )
  )
  .orderBy(asc(dailyRevenues.date));
  
  const dailyRevenuesList = await dailyRevenuesQuery;
  const dailyRevenueIds = dailyRevenuesList.map((d: { id: number }) => d.id);
  
  // جلب إيرادات الموظفين
  let employeeRevenuesList: Array<{ employeeId: number; employeeName: string | null; employeeCode: string | null; branchName: string | null; total: string }> = [];
  if (dailyRevenueIds.length > 0) {
    const empRevenuesQuery = db.select({
      employeeId: employeeRevenues.employeeId,
      employeeName: employees.name,
      employeeCode: employees.code,
      branchName: branches.name,
      total: employeeRevenues.total
    })
    .from(employeeRevenues)
    .leftJoin(employees, eq(employeeRevenues.employeeId, employees.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(sql`${employeeRevenues.dailyRevenueId} IN (${sql.join(dailyRevenueIds, sql`, `)})`);
    
    employeeRevenuesList = await empRevenuesQuery;
  }
  
  const revenues = dailyRevenuesList;
  
  // حساب الإجماليات
  let totalCash = 0, totalNetwork = 0, grandTotal = 0;
  const workingDaysSet = new Set<string>();
  
  for (const r of revenues) {
    totalCash += Number(r.cash || 0);
    totalNetwork += Number(r.network || 0);
    // mada غير موجود في الجدول
    grandTotal += Number(r.total || 0);
    if (r.date) workingDaysSet.add(r.date.toISOString().split('T')[0]);
  }
  
  const workingDays = workingDaysSet.size;
  const averageDaily = workingDays > 0 ? grandTotal / workingDays : 0;
  
  // تجميع حسب الفرع
  const branchMap = new Map<number, { branchName: string; cash: number; network: number; total: number }>();
  for (const r of revenues) {
    if (!r.branchId) continue;
    const existing = branchMap.get(r.branchId) || { branchName: r.branchName || '', cash: 0, network: 0, total: 0 };
    existing.cash += Number(r.cash || 0);
    existing.network += Number(r.network || 0);
    // mada غير موجود
    existing.total += Number(r.total || 0);
    branchMap.set(r.branchId, existing);
  }
  
  const byBranch = Array.from(branchMap.entries())
    .map(([id, data]) => ({
      branchId: id,
      branchName: data.branchName,
      totalCash: data.cash,
      totalNetwork: data.network,
      totalMada: 0,
      total: data.total,
      percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total);
  
  // تجميع حسب الموظف
  const employeeMap = new Map<number, { name: string; code: string; branchName: string; total: number }>();
  for (const r of employeeRevenuesList) {
    if (!r.employeeId) continue;
    const existing = employeeMap.get(r.employeeId) || { name: r.employeeName || '', code: r.employeeCode || '', branchName: r.branchName || '', total: 0 };
    existing.total += Number(r.total || 0);
    employeeMap.set(r.employeeId, existing);
  }
  
  const byEmployee = Array.from(employeeMap.entries())
    .map(([id, data]) => ({
      employeeId: id,
      employeeName: data.name,
      employeeCode: data.code,
      branchName: data.branchName,
      totalRevenue: data.total,
      percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
  
  // التفصيل اليومي
  const dailyMap = new Map<string, { cash: number; network: number; total: number }>();
  for (const r of revenues) {
    const dateStr = r.date?.toISOString().split('T')[0] || '';
    const existing = dailyMap.get(dateStr) || { cash: 0, network: 0, total: 0 };
    existing.cash += Number(r.cash || 0);
    existing.network += Number(r.network || 0);
    // mada غير موجود
    existing.total += Number(r.total || 0);
    dailyMap.set(dateStr, existing);
  }
  
  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([dateStr, data]) => ({
      date: dateStr,
      dayName: getDayName(new Date(dateStr)),
      cash: data.cash,
      network: data.network,
      mada: 0,
      total: data.total
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const branchName = branchId ? (byBranch.find(b => b.branchId === branchId)?.branchName || 'جميع الفروع') : 'جميع الفروع';
  
  // توليد HTML
  const htmlContent = generateRevenueHTML({
    month, year, branchName,
    totalCash, totalNetwork, totalMada: 0, grandTotal,
    workingDays, averageDaily,
    byBranch, byEmployee, dailyBreakdown
  });
  
  return await generatePDF(htmlContent);
}

// ==================== تقرير المصاريف الشهري ====================

export async function generateMonthlyExpenseReport(month: number, year: number, branchId?: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // جلب المصاريف
  const expensesQuery = db.select({
    id: expenses.id,
    date: expenses.expenseDate,
    category: expenses.category,
    description: expenses.description,
    amount: expenses.amount,
    status: expenses.status,
    branchId: expenses.branchId,
    branchName: branches.name,
    createdBy: expenses.createdBy
  })
  .from(expenses)
  .leftJoin(branches, eq(expenses.branchId, branches.id))
  .where(
    and(
      gte(expenses.expenseDate, startDate),
      lte(expenses.expenseDate, endDate),
      branchId ? eq(expenses.branchId, branchId) : sql`1=1`
    )
  )
  .orderBy(desc(expenses.expenseDate));
  
  const expensesList = await expensesQuery;
  
  // حساب الإجماليات
  let totalExpenses = 0, approvedExpenses = 0, pendingExpenses = 0, paidExpenses = 0;
  
  for (const e of expensesList) {
    const amount = Number(e.amount || 0);
    totalExpenses += amount;
    if (e.status === 'approved' || e.status === 'paid') approvedExpenses += amount;
    if (e.status === 'pending') pendingExpenses += amount;
    if (e.status === 'paid') paidExpenses += amount;
  }
  
  // تجميع حسب الفئة
  const categoryMap = new Map<string, { count: number; total: number }>();
  for (const e of expensesList) {
    const cat = e.category || 'other';
    const existing = categoryMap.get(cat) || { count: 0, total: 0 };
    existing.count++;
    existing.total += Number(e.amount || 0);
    categoryMap.set(cat, existing);
  }
  
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      categoryLabel: getCategoryLabel(category),
      count: data.count,
      total: data.total,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total);
  
  // تجميع حسب الحالة
  const statusMap = new Map<string, { count: number; total: number }>();
  for (const e of expensesList) {
    const status = e.status || 'pending';
    const existing = statusMap.get(status) || { count: 0, total: 0 };
    existing.count++;
    existing.total += Number(e.amount || 0);
    statusMap.set(status, existing);
  }
  
  const byStatus = Array.from(statusMap.entries())
    .map(([status, data]) => ({
      status,
      statusLabel: getStatusLabel(status),
      count: data.count,
      total: data.total
    }));
  
  const branchName = branchId ? 'فرع محدد' : 'جميع الفروع';
  
  // توليد HTML
  const htmlContent = generateExpenseHTML({
    month, year, branchName,
    totalExpenses, approvedExpenses, pendingExpenses, paidExpenses,
    byCategory, byStatus,
    expenses: expensesList.slice(0, 30).map(e => ({
      id: e.id,
      date: formatDate(e.date || new Date()),
      category: getCategoryLabel(e.category || 'other'),
      description: e.description || '',
      amount: Number(e.amount || 0),
      status: getStatusLabel(e.status || 'pending'),
      branchName: e.branchName || ''
    }))
  });
  
  return await generatePDF(htmlContent);
}

// ==================== تقرير البونص الشهري ====================

export async function generateMonthlyBonusReport(month: number, year: number, branchId?: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  // جلب البونص الأسبوعي للشهر
  const bonusesQuery = db.select({
    id: weeklyBonuses.id,
    weekNumber: weeklyBonuses.weekNumber,
    weekStart: weeklyBonuses.weekStart,
    weekEnd: weeklyBonuses.weekEnd,
    totalAmount: weeklyBonuses.totalAmount,
    status: weeklyBonuses.status,
    branchId: weeklyBonuses.branchId,
    branchName: branches.name
  })
  .from(weeklyBonuses)
  .leftJoin(branches, eq(weeklyBonuses.branchId, branches.id))
  .where(
    and(
      eq(weeklyBonuses.year, year),
      sql`MONTH(${weeklyBonuses.weekStart}) = ${month} OR MONTH(${weeklyBonuses.weekEnd}) = ${month}`,
      branchId ? eq(weeklyBonuses.branchId, branchId) : sql`1=1`
    )
  );
  
  const bonusesList = await bonusesQuery || [];
  
  // حساب الإجماليات
  let totalBonusAmount = 0;
  for (const b of bonusesList) {
    totalBonusAmount += Number(b.totalAmount || 0);
  }
  
  // جلب تفاصيل البونص
  const bonusIds = bonusesList.map((b: { id: number }) => b.id);
  let detailsList: Array<{
    id: number;
    weeklyBonusId: number;
    employeeId: number;
    employeeName: string | null;
    employeeCode: string | null;
    branchName: string | null;
    weeklyRevenue: string;
    tier: string;
    bonusAmount: string;
    isEligible: boolean;
  }> = [];
  
  if (bonusIds.length > 0) {
    const detailsQuery = db.select({
      id: bonusDetails.id,
      weeklyBonusId: bonusDetails.weeklyBonusId,
      employeeId: bonusDetails.employeeId,
      employeeName: employees.name,
      employeeCode: employees.code,
      branchName: branches.name,
      weeklyRevenue: bonusDetails.weeklyRevenue,
      tier: bonusDetails.bonusTier,
      bonusAmount: bonusDetails.bonusAmount,
      isEligible: bonusDetails.isEligible
    })
    .from(bonusDetails)
    .leftJoin(employees, eq(bonusDetails.employeeId, employees.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(sql`${bonusDetails.weeklyBonusId} IN (${sql.join(bonusIds, sql`, `)})`);
    
    detailsList = await detailsQuery;
  }
  
  // تجميع حسب المستوى
  const tierMap = new Map<string, { count: number; total: number }>();
  for (const d of detailsList) {
    if (!d.isEligible) continue;
    const tier = d.tier || 'none';
    const existing = tierMap.get(tier) || { count: 0, total: 0 };
    existing.count++;
    existing.total += Number(d.bonusAmount || 0);
    tierMap.set(tier, existing);
  }
  
  const byTier = Array.from(tierMap.entries())
    .map(([tier, data]) => ({
      tier,
      tierLabel: getTierLabel(tier),
      count: data.count,
      totalAmount: data.total,
      percentage: totalBonusAmount > 0 ? (data.total / totalBonusAmount) * 100 : 0
    }))
    .sort((a: { totalAmount: number }, b: { totalAmount: number }) => b.totalAmount - a.totalAmount);
  
  // التفصيل الأسبوعي
  const weeklyBreakdown = bonusesList.map(b => ({
    weekNumber: b.weekNumber || 0,
    weekStart: formatDate(b.weekStart || new Date()),
    weekEnd: formatDate(b.weekEnd || new Date()),
    totalAmount: Number(b.totalAmount || 0),
    employeeCount: detailsList.filter(d => d.weeklyBonusId === b.id).length
  })).sort((a: { weekNumber: number }, b: { weekNumber: number }) => a.weekNumber - b.weekNumber);
  
  // تجميع الموظفين
  const employeeBonusMap = new Map<number, { name: string; code: string; branchName: string; revenue: number; bonus: number; tiers: string[] }>();
  for (const d of detailsList) {
    if (!d.employeeId) continue;
    const existing = employeeBonusMap.get(d.employeeId) || { name: d.employeeName || '', code: d.employeeCode || '', branchName: d.branchName || '', revenue: 0, bonus: 0, tiers: [] };
    existing.revenue += Number(d.weeklyRevenue || 0);
    existing.bonus += Number(d.bonusAmount || 0);
    if (d.tier) existing.tiers.push(d.tier);
    employeeBonusMap.set(d.employeeId, existing);
  }
  
  const employeesList = Array.from(employeeBonusMap.entries())
    .map(([employeeId, data]) => {
      const tierCounts: Record<string, number> = {};
      for (const t of data.tiers) {
        tierCounts[t] = (tierCounts[t] || 0) + 1;
      }
      const sortedTiers = Object.entries(tierCounts).sort((a, b) => b[1] - a[1]);
      const averageTier = sortedTiers[0]?.[0] || 'none';
      
      return {
        employeeId,
        employeeName: data.name,
        employeeCode: data.code,
        branchName: data.branchName,
        totalRevenue: data.revenue,
        totalBonus: data.bonus,
        averageTier
      };
    })
    .sort((a, b) => b.totalBonus - a.totalBonus);
  
  const uniqueEmployees = new Set(detailsList.map(d => d.employeeId));
  const eligibleEmployees = new Set(detailsList.filter(d => d.isEligible).map(d => d.employeeId));
  const averageBonus = eligibleEmployees.size > 0 ? totalBonusAmount / eligibleEmployees.size : 0;
  
  const branchName = branchId ? 'فرع محدد' : 'جميع الفروع';
  
  // توليد HTML
  const htmlContent = generateBonusHTML({
    month, year, branchName,
    totalBonusAmount,
    weeksCount: bonusesList.length,
    totalEmployees: uniqueEmployees.size,
    eligibleEmployees: eligibleEmployees.size,
    averageBonus,
    byTier, weeklyBreakdown, employees: employeesList
  });
  
  return await generatePDF(htmlContent);
}

// ==================== توليد PDF ====================

async function generatePDF(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
  });
  
  await browser.close();
  
  return Buffer.from(pdfBuffer);
}

// ==================== قوالب HTML ====================

interface RevenueHTMLData {
  month: number;
  year: number;
  branchName: string;
  totalCash: number;
  totalNetwork: number;
  totalMada: number;
  grandTotal: number;
  workingDays: number;
  averageDaily: number;
  byBranch: Array<{ branchId: number; branchName: string; totalCash: number; totalNetwork: number; totalMada: number; total: number; percentage: number }>;
  byEmployee: Array<{ employeeId: number; employeeName: string; employeeCode: string; branchName: string; totalRevenue: number; percentage: number }>;
  dailyBreakdown: Array<{ date: string; dayName: string; cash: number; network: number; mada: number; total: number }>;
}

function generateRevenueHTML(data: RevenueHTMLData): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير الإيرادات الشهري - ${getMonthName(data.month)} ${data.year}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Tajawal', sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; background: #fff; padding: 25px; direction: rtl; }
    .report-container { max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: #fff; padding: 20px 25px; border-radius: 10px 10px 0 0; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 24px; font-weight: 800; }
    .company-name { font-size: 10px; opacity: 0.9; }
    .report-title { font-size: 20px; font-weight: 700; text-align: center; }
    .report-subtitle { font-size: 10px; opacity: 0.8; text-align: center; }
    .report-period { font-size: 14px; font-weight: 600; }
    .summary-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; padding: 20px; background: #f8f9fa; border-bottom: 2px solid #e0e0e0; }
    .summary-card { background: #fff; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .summary-label { font-size: 10px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: 18px; font-weight: 700; color: #1a1a1a; }
    .summary-value.highlight { color: #22c55e; }
    .section { padding: 20px; border-bottom: 1px solid #e0e0e0; }
    .section-title { font-size: 14px; font-weight: 700; margin-bottom: 15px; color: #1a1a1a; border-bottom: 2px solid #1a1a1a; display: inline-block; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1a1a1a; color: #fff; padding: 10px 12px; text-align: right; font-weight: 600; font-size: 10px; }
    th:last-child { text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 10px; }
    td:last-child { text-align: left; font-weight: 600; }
    tr:nth-child(even) { background: #f9f9f9; }
    .total-row { background: #f0f0f0 !important; }
    .total-row td { font-weight: 700; border-top: 2px solid #1a1a1a; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); border-radius: 4px; }
    .footer { padding: 20px; background: #f5f5f5; border-radius: 0 0 10px 10px; display: flex; justify-content: space-between; align-items: center; }
    .signature-box { text-align: center; width: 180px; }
    .signature-line { border-top: 2px solid #333; padding-top: 10px; margin-top: 40px; }
    .signature-name { font-weight: 700; font-size: 12px; }
    .signature-title { font-size: 10px; color: #666; }
    .stamp { width: 100px; height: 100px; border: 3px solid #1a4a7a; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; color: #1a4a7a; }
    .stamp-logo { font-size: 14px; font-weight: 800; }
    .stamp-text { font-size: 8px; }
    @media print { body { padding: 0; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div><div class="logo">Symbol AI</div><div class="company-name">سيمبول للذكاء الاصطناعي</div></div>
      <div><div class="report-title">تقرير الإيرادات الشهري</div><div class="report-subtitle">Monthly Revenue Report</div></div>
      <div style="text-align: left;"><div class="report-period">${getMonthName(data.month)} ${data.year}</div><div style="font-size: 10px; opacity: 0.8;">${data.branchName}</div></div>
    </div>
    
    <div class="summary-section">
      <div class="summary-card"><div class="summary-label">إجمالي الإيرادات</div><div class="summary-value highlight">${formatCurrency(data.grandTotal)}</div></div>
      <div class="summary-card"><div class="summary-label">أيام العمل</div><div class="summary-value">${data.workingDays} يوم</div></div>
      <div class="summary-card"><div class="summary-label">المتوسط اليومي</div><div class="summary-value">${formatCurrency(data.averageDaily)}</div></div>
      <div class="summary-card"><div class="summary-label">النقدي</div><div class="summary-value">${formatCurrency(data.totalCash)}</div></div>
      <div class="summary-card"><div class="summary-label">الشبكة</div><div class="summary-value">${formatCurrency(data.totalNetwork)}</div></div>
      <div class="summary-card"><div class="summary-label">مدى</div><div class="summary-value">${formatCurrency(data.totalMada)}</div></div>
    </div>
    
    ${data.byBranch.length > 1 ? `
    <div class="section">
      <div class="section-title">الإيرادات حسب الفرع</div>
      <table>
        <thead><tr><th>الفرع</th><th>نقدي</th><th>شبكة</th><th>مدى</th><th>النسبة</th><th>الإجمالي</th></tr></thead>
        <tbody>
          ${data.byBranch.map(b => `<tr><td>${b.branchName}</td><td>${formatCurrency(b.totalCash)}</td><td>${formatCurrency(b.totalNetwork)}</td><td>${formatCurrency(b.totalMada)}</td><td><div class="progress-bar"><div class="progress-fill" style="width: ${b.percentage}%"></div></div><span style="font-size: 9px;">${b.percentage.toFixed(1)}%</span></td><td>${formatCurrency(b.total)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <div class="section">
      <div class="section-title">الإيرادات حسب الموظف</div>
      <table>
        <thead><tr><th>#</th><th>الموظف</th><th>الكود</th><th>الفرع</th><th>النسبة</th><th>الإيرادات</th></tr></thead>
        <tbody>
          ${data.byEmployee.slice(0, 15).map((e, i) => `<tr><td>${i + 1}</td><td>${e.employeeName}</td><td>${e.employeeCode}</td><td>${e.branchName}</td><td><div class="progress-bar"><div class="progress-fill" style="width: ${e.percentage}%"></div></div><span style="font-size: 9px;">${e.percentage.toFixed(1)}%</span></td><td>${formatCurrency(e.totalRevenue)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="5">الإجمالي</td><td>${formatCurrency(data.grandTotal)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <div class="section-title">التفصيل اليومي</div>
      <table>
        <thead><tr><th>التاريخ</th><th>اليوم</th><th>نقدي</th><th>شبكة</th><th>مدى</th><th>الإجمالي</th></tr></thead>
        <tbody>
          ${data.dailyBreakdown.map(d => `<tr><td>${d.date}</td><td>${d.dayName}</td><td>${formatCurrency(d.cash)}</td><td>${formatCurrency(d.network)}</td><td>${formatCurrency(d.mada)}</td><td>${formatCurrency(d.total)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="5">الإجمالي</td><td>${formatCurrency(data.grandTotal)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <div class="signature-box"><div class="signature-line"><div class="signature-name">سالم الوادعي</div><div class="signature-title">المشرف العام</div></div></div>
      <div><div class="stamp"><div class="stamp-logo">Symbol</div><div class="stamp-text">معتمد</div></div></div>
      <div class="signature-box"><div class="signature-line"><div class="signature-name">عمر المطيري</div><div class="signature-title">المدير العام</div></div></div>
    </div>
    
    <div style="text-align: center; padding: 10px; font-size: 9px; color: #666;">تم إنشاء هذا التقرير بتاريخ ${formatDate(new Date())} | Symbol AI ERP System</div>
  </div>
</body>
</html>
`;
}

interface ExpenseHTMLData {
  month: number;
  year: number;
  branchName: string;
  totalExpenses: number;
  approvedExpenses: number;
  pendingExpenses: number;
  paidExpenses: number;
  byCategory: Array<{ category: string; categoryLabel: string; count: number; total: number; percentage: number }>;
  byStatus: Array<{ status: string; statusLabel: string; count: number; total: number }>;
  expenses: Array<{ id: number; date: string; category: string; description: string; amount: number; status: string; branchName: string }>;
}

function generateExpenseHTML(data: ExpenseHTMLData): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير المصاريف الشهري - ${getMonthName(data.month)} ${data.year}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Tajawal', sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; background: #fff; padding: 25px; direction: rtl; }
    .report-container { max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #fff; padding: 20px 25px; border-radius: 10px 10px 0 0; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 24px; font-weight: 800; }
    .company-name { font-size: 10px; opacity: 0.9; }
    .report-title { font-size: 20px; font-weight: 700; text-align: center; }
    .report-subtitle { font-size: 10px; opacity: 0.8; text-align: center; }
    .report-period { font-size: 14px; font-weight: 600; }
    .summary-section { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; padding: 20px; background: #fef2f2; border-bottom: 2px solid #fecaca; }
    .summary-card { background: #fff; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .summary-label { font-size: 10px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: 16px; font-weight: 700; color: #1a1a1a; }
    .summary-value.expense { color: #dc2626; }
    .summary-value.approved { color: #22c55e; }
    .summary-value.pending { color: #f59e0b; }
    .section { padding: 20px; border-bottom: 1px solid #e0e0e0; }
    .section-title { font-size: 14px; font-weight: 700; margin-bottom: 15px; color: #1a1a1a; border-bottom: 2px solid #dc2626; display: inline-block; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #dc2626; color: #fff; padding: 10px 12px; text-align: right; font-weight: 600; font-size: 10px; }
    th:last-child { text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 10px; }
    td:last-child { text-align: left; font-weight: 600; }
    tr:nth-child(even) { background: #fef2f2; }
    .total-row { background: #fee2e2 !important; }
    .total-row td { font-weight: 700; border-top: 2px solid #dc2626; }
    .category-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; background: #f3f4f6; color: #374151; }
    .status-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-approved, .status-معتمد { background: #d1fae5; color: #065f46; }
    .status-paid, .status-مدفوع { background: #dbeafe; color: #1e40af; }
    .status-rejected, .status-مرفوض { background: #fee2e2; color: #991b1b; }
    .progress-bar { height: 8px; background: #fecaca; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #dc2626, #b91c1c); border-radius: 4px; }
    .footer { padding: 20px; background: #f5f5f5; border-radius: 0 0 10px 10px; display: flex; justify-content: space-between; align-items: center; }
    .signature-box { text-align: center; width: 180px; }
    .signature-line { border-top: 2px solid #333; padding-top: 10px; margin-top: 40px; }
    .signature-name { font-weight: 700; font-size: 12px; }
    .signature-title { font-size: 10px; color: #666; }
    .stamp { width: 100px; height: 100px; border: 3px solid #1a4a7a; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; color: #1a4a7a; }
    .stamp-logo { font-size: 14px; font-weight: 800; }
    .stamp-text { font-size: 8px; }
    @media print { body { padding: 0; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div><div class="logo">Symbol AI</div><div class="company-name">سيمبول للذكاء الاصطناعي</div></div>
      <div><div class="report-title">تقرير المصاريف الشهري</div><div class="report-subtitle">Monthly Expense Report</div></div>
      <div style="text-align: left;"><div class="report-period">${getMonthName(data.month)} ${data.year}</div><div style="font-size: 10px; opacity: 0.8;">${data.branchName}</div></div>
    </div>
    
    <div class="summary-section">
      <div class="summary-card"><div class="summary-label">إجمالي المصاريف</div><div class="summary-value expense">${formatCurrency(data.totalExpenses)}</div></div>
      <div class="summary-card"><div class="summary-label">المعتمدة</div><div class="summary-value approved">${formatCurrency(data.approvedExpenses)}</div></div>
      <div class="summary-card"><div class="summary-label">قيد المراجعة</div><div class="summary-value pending">${formatCurrency(data.pendingExpenses)}</div></div>
      <div class="summary-card"><div class="summary-label">المدفوعة</div><div class="summary-value">${formatCurrency(data.paidExpenses)}</div></div>
    </div>
    
    <div class="section">
      <div class="section-title">المصاريف حسب الفئة</div>
      <table>
        <thead><tr><th>الفئة</th><th>العدد</th><th>النسبة</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${data.byCategory.map(c => `<tr><td><span class="category-badge">${c.categoryLabel}</span></td><td>${c.count}</td><td><div class="progress-bar"><div class="progress-fill" style="width: ${c.percentage}%"></div></div><span style="font-size: 9px;">${c.percentage.toFixed(1)}%</span></td><td>${formatCurrency(c.total)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="3">الإجمالي</td><td>${formatCurrency(data.totalExpenses)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <div class="section-title">المصاريف حسب الحالة</div>
      <table>
        <thead><tr><th>الحالة</th><th>العدد</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${data.byStatus.map(s => `<tr><td><span class="status-badge status-${s.status}">${s.statusLabel}</span></td><td>${s.count}</td><td>${formatCurrency(s.total)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <div class="section-title">تفاصيل المصاريف</div>
      <table>
        <thead><tr><th>التاريخ</th><th>الفئة</th><th>الوصف</th><th>الفرع</th><th>الحالة</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${data.expenses.map(e => `<tr><td>${e.date}</td><td><span class="category-badge">${e.category}</span></td><td>${e.description.substring(0, 30)}${e.description.length > 30 ? '...' : ''}</td><td>${e.branchName}</td><td><span class="status-badge status-${e.status.toLowerCase().replace(' ', '-')}">${e.status}</span></td><td>${formatCurrency(e.amount)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="5">الإجمالي</td><td>${formatCurrency(data.totalExpenses)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <div class="signature-box"><div class="signature-line"><div class="signature-name">سالم الوادعي</div><div class="signature-title">المشرف العام</div></div></div>
      <div><div class="stamp"><div class="stamp-logo">Symbol</div><div class="stamp-text">معتمد</div></div></div>
      <div class="signature-box"><div class="signature-line"><div class="signature-name">عمر المطيري</div><div class="signature-title">المدير العام</div></div></div>
    </div>
    
    <div style="text-align: center; padding: 10px; font-size: 9px; color: #666;">تم إنشاء هذا التقرير بتاريخ ${formatDate(new Date())} | Symbol AI ERP System</div>
  </div>
</body>
</html>
`;
}

interface BonusHTMLData {
  month: number;
  year: number;
  branchName: string;
  totalBonusAmount: number;
  weeksCount: number;
  totalEmployees: number;
  eligibleEmployees: number;
  averageBonus: number;
  byTier: Array<{ tier: string; tierLabel: string; count: number; totalAmount: number; percentage: number }>;
  weeklyBreakdown: Array<{ weekNumber: number; weekStart: string; weekEnd: string; totalAmount: number; employeeCount: number }>;
  employees: Array<{ employeeId: number; employeeName: string; employeeCode: string; branchName: string; totalRevenue: number; totalBonus: number; averageTier: string }>;
}

function generateBonusHTML(data: BonusHTMLData): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير البونص الشهري - ${getMonthName(data.month)} ${data.year}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Tajawal', sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; background: #fff; padding: 25px; direction: rtl; }
    .report-container { max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: #fff; padding: 20px 25px; border-radius: 10px 10px 0 0; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 24px; font-weight: 800; }
    .company-name { font-size: 10px; opacity: 0.9; }
    .report-title { font-size: 20px; font-weight: 700; text-align: center; }
    .report-subtitle { font-size: 10px; opacity: 0.8; text-align: center; }
    .report-period { font-size: 14px; font-weight: 600; }
    .summary-section { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; padding: 20px; background: #f5f3ff; border-bottom: 2px solid #ddd6fe; }
    .summary-card { background: #fff; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .summary-label { font-size: 10px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: 16px; font-weight: 700; color: #1a1a1a; }
    .summary-value.bonus { color: #7c3aed; }
    .section { padding: 20px; border-bottom: 1px solid #e0e0e0; }
    .section-title { font-size: 14px; font-weight: 700; margin-bottom: 15px; color: #1a1a1a; border-bottom: 2px solid #7c3aed; display: inline-block; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #7c3aed; color: #fff; padding: 10px 12px; text-align: right; font-weight: 600; font-size: 10px; }
    th:last-child { text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 10px; }
    td:last-child { text-align: left; font-weight: 600; }
    tr:nth-child(even) { background: #f5f3ff; }
    .total-row { background: #ede9fe !important; }
    .total-row td { font-weight: 700; border-top: 2px solid #7c3aed; }
    .tier-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; color: #fff; }
    .progress-bar { height: 8px; background: #ddd6fe; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #5b21b6); border-radius: 4px; }
    .footer { padding: 20px; background: #f5f5f5; border-radius: 0 0 10px 10px; display: flex; justify-content: space-between; align-items: center; }
    .signature-box { text-align: center; width: 180px; }
    .signature-line { border-top: 2px solid #333; padding-top: 10px; margin-top: 40px; }
    .signature-name { font-weight: 700; font-size: 12px; }
    .signature-title { font-size: 10px; color: #666; }
    .stamp { width: 100px; height: 100px; border: 3px solid #1a4a7a; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; color: #1a4a7a; }
    .stamp-logo { font-size: 14px; font-weight: 800; }
    .stamp-text { font-size: 8px; }
    @media print { body { padding: 0; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div><div class="logo">Symbol AI</div><div class="company-name">سيمبول للذكاء الاصطناعي</div></div>
      <div><div class="report-title">تقرير البونص الشهري</div><div class="report-subtitle">Monthly Bonus Report</div></div>
      <div style="text-align: left;"><div class="report-period">${getMonthName(data.month)} ${data.year}</div><div style="font-size: 10px; opacity: 0.8;">${data.branchName}</div></div>
    </div>
    
    <div class="summary-section">
      <div class="summary-card"><div class="summary-label">إجمالي البونص</div><div class="summary-value bonus">${formatCurrency(data.totalBonusAmount)}</div></div>
      <div class="summary-card"><div class="summary-label">عدد الأسابيع</div><div class="summary-value">${data.weeksCount}</div></div>
      <div class="summary-card"><div class="summary-label">الموظفون المؤهلون</div><div class="summary-value">${data.eligibleEmployees} / ${data.totalEmployees}</div></div>
      <div class="summary-card"><div class="summary-label">متوسط البونص</div><div class="summary-value">${formatCurrency(data.averageBonus)}</div></div>
    </div>
    
    <div class="section">
      <div class="section-title">البونص حسب المستوى</div>
      <table>
        <thead><tr><th>المستوى</th><th>العدد</th><th>النسبة</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${data.byTier.map(t => `<tr><td><span class="tier-badge" style="background: ${getTierColor(t.tier)}">${t.tierLabel}</span></td><td>${t.count}</td><td><div class="progress-bar"><div class="progress-fill" style="width: ${t.percentage}%"></div></div><span style="font-size: 9px;">${t.percentage.toFixed(1)}%</span></td><td>${formatCurrency(t.totalAmount)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="3">الإجمالي</td><td>${formatCurrency(data.totalBonusAmount)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <div class="section-title">التفصيل الأسبوعي</div>
      <table>
        <thead><tr><th>الأسبوع</th><th>من</th><th>إلى</th><th>الموظفون</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${data.weeklyBreakdown.map(w => `<tr><td>الأسبوع ${w.weekNumber}</td><td>${w.weekStart}</td><td>${w.weekEnd}</td><td>${w.employeeCount}</td><td>${formatCurrency(w.totalAmount)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="4">الإجمالي</td><td>${formatCurrency(data.totalBonusAmount)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <div class="section-title">تفاصيل الموظفين</div>
      <table>
        <thead><tr><th>#</th><th>الموظف</th><th>الكود</th><th>الفرع</th><th>الإيرادات</th><th>المستوى</th><th>البونص</th></tr></thead>
        <tbody>
          ${data.employees.slice(0, 15).map((e, i) => `<tr><td>${i + 1}</td><td>${e.employeeName}</td><td>${e.employeeCode}</td><td>${e.branchName}</td><td>${formatCurrency(e.totalRevenue)}</td><td><span class="tier-badge" style="background: ${getTierColor(e.averageTier)}">${getTierLabel(e.averageTier)}</span></td><td>${formatCurrency(e.totalBonus)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="6">الإجمالي</td><td>${formatCurrency(data.totalBonusAmount)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <div class="signature-box"><div class="signature-line"><div class="signature-name">سالم الوادعي</div><div class="signature-title">المشرف العام</div></div></div>
      <div><div class="stamp"><div class="stamp-logo">Symbol</div><div class="stamp-text">معتمد</div></div></div>
      <div class="signature-box"><div class="signature-line"><div class="signature-name">عمر المطيري</div><div class="signature-title">المدير العام</div></div></div>
    </div>
    
    <div style="text-align: center; padding: 10px; font-size: 9px; color: #666;">تم إنشاء هذا التقرير بتاريخ ${formatDate(new Date())} | Symbol AI ERP System</div>
  </div>
</body>
</html>
`;
}
