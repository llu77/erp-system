import puppeteer from 'puppeteer';
import { getDb } from '../db';
import { dailyRevenues, employeeRevenues, expenses, weeklyBonuses, bonusDetails, employees, branches } from '../../drizzle/schema';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { getTierDisplayName, getTierColorHex } from '../../shared/bonusHelpers';
import type { Establishment } from '../../shared/branding';
import { escapeHtml } from '../../shared/vouchers';
import { REPORT_SIGNATORIES, establishmentDetailsLine, getReportEstablishment, reportFooterHtml } from '../../shared/reportBranding';
import { monthDateRange } from '../../shared/financialReportBase';
import { generateExpenseReportPDF, generateRevenueReportPDF, getExpenseReportData, getRevenueReportData } from './financeReportsPdf';
import { expenseCategoryLabel } from '../../shared/expenses';
import { getBranchMonthlyFinancials } from '../finance/branchFinancials';
import { ensureFixedExpensesForViewedMonth } from '../expenses/autoExpenses';

// ==================== دوال المساعدة ====================

const getMonthName = (month: number): string => {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[month - 1] || '';
};

const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
};

/**
 * فرع التقرير ومؤسسته: اسم الفرع (العربي أولاً) ومؤسسته، أو "جميع الفروع" والهوية العامة
 */
async function resolveReportBranch(branchId?: number): Promise<{ label: string; establishment: Establishment }> {
  if (!branchId) return { label: 'جميع الفروع', establishment: getReportEstablishment(null) };
  const db = await getDb();
  const rows = db
    ? await db.select({ name: branches.name, nameAr: branches.nameAr }).from(branches).where(eq(branches.id, branchId)).limit(1)
    : [];
  const row = rows[0];
  return { label: row?.nameAr || row?.name || `فرع رقم ${branchId}`, establishment: getReportEstablishment(row ?? null) };
}

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
};

// أسماء التصنيفات من المصدر المشترك (نفس أسماء صفحة المصاريف)
const getCategoryLabel = (category: string): string => expenseCategoryLabel(category);

// أسماء المستويات من الاسم المحفوظ وقت الاحتساب (bonusDetails.tierName) وليس خريطة ثابتة
const getTierLabel = (tier: string, tierName?: string | null): string => getTierDisplayName(tier, tierName);

const getTierColor = (tier: string): string => getTierColorHex(tier);

// ==================== تقرير الإيرادات والمصاريف الشهري ====================
// نفس القالبين الرسميين لصفحتي الإيرادات والمصاريف (ترويسة المؤسسة، خط مضمّن، renderHtmlToPdf)

export async function generateMonthlyRevenueReport(month: number, year: number, branchId?: number): Promise<Buffer> {
  const data = await getRevenueReportData({
    branchId: branchId ?? null,
    ...monthDateRange(year, month),
    year,
    month,
    includeEmployees: true,
  });
  if (!data) throw new Error('الفرع غير موجود');
  return generateRevenueReportPDF(data);
}

export async function generateMonthlyExpenseReport(month: number, year: number, branchId?: number): Promise<Buffer> {
  const data = await getExpenseReportData({ year, month, branchId: branchId ?? null });
  if (!data) throw new Error('الفرع غير موجود');
  return generateExpenseReportPDF(data);
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
    tierName: string | null;
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
      tierName: bonusDetails.tierName,
      bonusAmount: bonusDetails.bonusAmount,
      isEligible: bonusDetails.isEligible
    })
    .from(bonusDetails)
    .leftJoin(employees, eq(bonusDetails.employeeId, employees.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(sql`${bonusDetails.weeklyBonusId} IN (${sql.join(bonusIds, sql`, `)})`);
    
    detailsList = await detailsQuery;
  }
  
  // اسم كل مستوى كما حُفظ وقت الاحتساب
  const tierNameByKey = new Map<string, string>();
  for (const d of detailsList) {
    if (d.tier && d.tierName) tierNameByKey.set(d.tier, d.tierName);
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
      tierLabel: getTierLabel(tier, tierNameByKey.get(tier)),
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
        averageTier,
        averageTierLabel: getTierLabel(averageTier, tierNameByKey.get(averageTier))
      };
    })
    .sort((a, b) => b.totalBonus - a.totalBonus);
  
  const uniqueEmployees = new Set(detailsList.map(d => d.employeeId));
  const eligibleEmployees = new Set(detailsList.filter(d => d.isEligible).map(d => d.employeeId));
  const averageBonus = eligibleEmployees.size > 0 ? totalBonusAmount / eligibleEmployees.size : 0;
  
  const reportBranch = await resolveReportBranch(branchId);
  const branchName = reportBranch.label;
  
  // توليد HTML
  const htmlContent = generateBonusHTML({
    month, year, branchName, establishment: reportBranch.establishment,
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

interface BonusHTMLData {
  month: number;
  year: number;
  branchName: string;
  /** الجهة المُصدرة (الافتراضي: مؤسسة اسم الفرع) */
  establishment?: Establishment;
  totalBonusAmount: number;
  weeksCount: number;
  totalEmployees: number;
  eligibleEmployees: number;
  averageBonus: number;
  byTier: Array<{ tier: string; tierLabel: string; count: number; totalAmount: number; percentage: number }>;
  weeklyBreakdown: Array<{ weekNumber: number; weekStart: string; weekEnd: string; totalAmount: number; employeeCount: number }>;
  employees: Array<{ employeeId: number; employeeName: string; employeeCode: string; branchName: string; totalRevenue: number; totalBonus: number; averageTier: string; averageTierLabel: string }>;
}

function generateBonusHTML(data: BonusHTMLData): string {
  const est = data.establishment ?? getReportEstablishment(data.branchName);
  const estDetails = establishmentDetailsLine(est);
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
    .logo { font-size: 20px; font-weight: 800; }
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
    .stamp { width: 130px; height: 130px; border: 3px solid #1a4a7a; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; color: #1a4a7a; text-align: center; padding: 8px; line-height: 1.3; }
    .stamp-logo { font-size: 18px; font-weight: 800; }
    .stamp-text { font-size: 10px; }
    @media print { body { padding: 0; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div><div class="logo">${escapeHtml(est.nameAr)}</div>${estDetails ? `<div class="company-name">${escapeHtml(estDetails)}</div>` : ''}</div>
      <div><div class="report-title">تقرير البونص الشهري</div><div class="report-subtitle">Monthly Bonus Report</div></div>
      <div style="text-align: left;"><div class="report-period">${getMonthName(data.month)} ${data.year}</div><div style="font-size: 10px; opacity: 0.8;">${escapeHtml(data.branchName)}</div></div>
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
          ${data.employees.slice(0, 15).map((e, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(e.employeeName)}</td><td>${escapeHtml(e.employeeCode)}</td><td>${escapeHtml(e.branchName)}</td><td>${formatCurrency(e.totalRevenue)}</td><td><span class="tier-badge" style="background: ${getTierColor(e.averageTier)}">${e.averageTierLabel}</span></td><td>${formatCurrency(e.totalBonus)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="6">الإجمالي</td><td>${formatCurrency(data.totalBonusAmount)}</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <div class="signature-box"><div class="signature-line"><div class="signature-name">${escapeHtml(REPORT_SIGNATORIES.supervisor.name)}</div><div class="signature-title">${escapeHtml(REPORT_SIGNATORIES.supervisor.title)}</div></div></div>
      <div><div class="stamp"><div class="stamp-logo">معتمد</div><div class="stamp-text">${escapeHtml(est.nameAr)}</div></div></div>
      <div class="signature-box"><div class="signature-line"><div class="signature-name">${escapeHtml(REPORT_SIGNATORIES.manager.name)}</div><div class="signature-title">${escapeHtml(REPORT_SIGNATORIES.manager.title)}</div></div></div>
    </div>
    
    <div style="text-align: center; padding: 10px; font-size: 9px; color: #666;">${reportFooterHtml(est)}</div>
  </div>
</body>
</html>
`;
}


// ==================== تقرير الربح والخسارة (P&L) ====================

export async function generateProfitLossReport(month: number, year: number, branchId?: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const reportEst = (await resolveReportBranch(branchId)).establishment;

  // المصاريف الثابتة لشهر التقرير تُضاف قبل الحساب (إن لم تُضف بعد) كما في أرباح الشركاء
  await ensureFixedExpensesForViewedMonth(year, month);

  // الأرقام من نفس مصدر أرباح الشركاء (getBranchMonthlyFinancials) حتى يتطابق التقريران:
  // الإيرادات نقدي + شبكة، المصاريف المعتمدة والمدفوعة بدون صفوف المسير، والرواتب = صافي المسيرات + السلف المستردة
  const financials = await getBranchMonthlyFinancials(year, month, branchId ?? null);
  const revenueData = [{ totalCash: financials.revenue.cash, totalNetwork: financials.revenue.network }];
  const totalRevenue = financials.revenue.total;
  const totalExpenses = financials.expenses.total;
  const expenseCategories: Array<{category: string, label: string, amount: number}> = financials.expenses.byCategory.map(c => ({
    category: c.category,
    label: getCategoryLabel(c.category),
    amount: c.amount,
  }));

  // 3. تفصيل الرواتب للعرض (المعتمدة والمدفوعة)
  const { payrolls } = await import('../../drizzle/schema');
  const payrollsQuery = db.select({
    totalNet: sql<number>`COALESCE(SUM(${payrolls.totalNetSalary}), 0)`,
    totalBase: sql<number>`COALESCE(SUM(${payrolls.totalBaseSalary}), 0)`,
    totalOvertime: sql<number>`COALESCE(SUM(${payrolls.totalOvertime}), 0)`,
    totalIncentives: sql<number>`COALESCE(SUM(${payrolls.totalIncentives}), 0)`,
    totalDeductions: sql<number>`COALESCE(SUM(${payrolls.totalDeductions}), 0)`,
  }).from(payrolls).where(
    and(
      eq(payrolls.year, year),
      eq(payrolls.month, month),
      sql`${payrolls.status} IN ('approved', 'paid')`,
      branchId ? eq(payrolls.branchId, branchId) : sql`1=1`
    )
  );
  const payrollData = await payrollsQuery || [{ totalNet: 0, totalBase: 0, totalOvertime: 0, totalIncentives: 0, totalDeductions: 0 }];
  // تكلفة الرواتب = صافي المسيرات + السلف المستردة فيها (صُرفت نقداً قبل المسير)
  const totalSalaries = financials.payroll.cost;

  // 4. حساب الربح الصافي
  const grossProfit = totalRevenue - totalExpenses;
  const netProfit = financials.profit;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
  
  // إنشاء HTML
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; background: #fff; color: #000; padding: 20px; font-size: 12px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1e3a5f; padding-bottom: 15px; }
    .header h1 { color: #1e3a5f; font-size: 22px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
    .summary-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; text-align: center; }
    .summary-card.revenue { border-top: 4px solid #22c55e; }
    .summary-card.expense { border-top: 4px solid #ef4444; }
    .summary-card.salary { border-top: 4px solid #f59e0b; }
    .summary-card.profit { border-top: 4px solid #3b82f6; }
    .summary-card h3 { font-size: 11px; color: #666; margin-bottom: 8px; }
    .summary-card .amount { font-size: 18px; font-weight: bold; color: #000; }
    .summary-card.profit .amount { color: ${netProfit >= 0 ? '#22c55e' : '#ef4444'}; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #dee2e6; padding: 10px; text-align: right; }
    th { background: #1e3a5f; color: #fff; font-size: 11px; }
    td { font-size: 11px; color: #000; }
    .section-title { background: #f1f5f9; padding: 10px; font-weight: bold; margin: 20px 0 10px; border-right: 4px solid #1e3a5f; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; }
    .signature { text-align: center; width: 200px; }
    .signature-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; }
    .profit-row { background: #f0fdf4; font-weight: bold; }
    .loss-row { background: #fef2f2; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 15px; font-weight: bold; margin-bottom: 4px;">${escapeHtml(reportEst.nameAr)}</div>
    <h1>تقرير الربح والخسارة</h1>
    <p>شهر ${getMonthName(month)} ${year}</p>
  </div>
  
  <div class="summary-grid">
    <div class="summary-card revenue">
      <h3>إجمالي الإيرادات</h3>
      <div class="amount">${formatCurrency(totalRevenue)}</div>
    </div>
    <div class="summary-card expense">
      <h3>إجمالي المصاريف</h3>
      <div class="amount">${formatCurrency(totalExpenses)}</div>
    </div>
    <div class="summary-card salary">
      <h3>إجمالي الرواتب</h3>
      <div class="amount">${formatCurrency(totalSalaries)}</div>
    </div>
    <div class="summary-card profit">
      <h3>صافي الربح</h3>
      <div class="amount">${formatCurrency(netProfit)}</div>
    </div>
  </div>
  
  <div class="section-title">قائمة الدخل التفصيلية</div>
  <table>
    <tr><th colspan="2">الإيرادات</th></tr>
    <tr><td>إيرادات نقدية (كاش)</td><td>${formatCurrency(Number(revenueData[0]?.totalCash || 0))}</td></tr>
    <tr><td>إيرادات شبكة</td><td>${formatCurrency(Number(revenueData[0]?.totalNetwork || 0))}</td></tr>
    <tr style="background:#e8f5e9;font-weight:bold;"><td>إجمالي الإيرادات</td><td>${formatCurrency(totalRevenue)}</td></tr>
    
    <tr><th colspan="2">المصاريف التشغيلية</th></tr>
    ${expenseCategories.map(e => `<tr><td>${e.label}</td><td>${formatCurrency(e.amount)}</td></tr>`).join('')}
    <tr style="background:#ffebee;font-weight:bold;"><td>إجمالي المصاريف</td><td>${formatCurrency(totalExpenses)}</td></tr>
    
    <tr class="${grossProfit >= 0 ? 'profit-row' : 'loss-row'}"><td><strong>الربح الإجمالي (قبل الرواتب)</strong></td><td><strong>${formatCurrency(grossProfit)}</strong></td></tr>
    
    <tr><th colspan="2">الرواتب والأجور</th></tr>
    <tr><td>رواتب أساسية</td><td>${formatCurrency(Number(payrollData[0]?.totalBase || 0))}</td></tr>
    <tr><td>ساعات إضافية</td><td>${formatCurrency(Number(payrollData[0]?.totalOvertime || 0))}</td></tr>
    <tr><td>حوافز</td><td>${formatCurrency(Number(payrollData[0]?.totalIncentives || 0))}</td></tr>
    <tr><td>خصومات (-)</td><td>${formatCurrency(Number(payrollData[0]?.totalDeductions || 0))}</td></tr>
    <tr><td>صافي الرواتب</td><td>${formatCurrency(financials.payroll.netSalary)}</td></tr>
    <tr><td>السلف المستردة في المسيرات (صُرفت سابقاً)</td><td>${formatCurrency(financials.payroll.recoveredAdvances)}</td></tr>
    <tr style="background:#fff3e0;font-weight:bold;"><td>تكلفة الرواتب</td><td>${formatCurrency(totalSalaries)}</td></tr>
    
    <tr class="${netProfit >= 0 ? 'profit-row' : 'loss-row'}"><td><strong>صافي الربح النهائي</strong></td><td><strong>${formatCurrency(netProfit)}</strong></td></tr>
    <tr><td>هامش الربح</td><td>${profitMargin.toFixed(1)}%</td></tr>
  </table>
  
  <div class="footer">
    <div class="signature"><div class="signature-line">${escapeHtml(REPORT_SIGNATORIES.supervisor.title)}: ${escapeHtml(REPORT_SIGNATORIES.supervisor.name)}</div></div>
    <div class="signature"><div class="signature-line">${escapeHtml(REPORT_SIGNATORIES.manager.title)}: ${escapeHtml(REPORT_SIGNATORIES.manager.name)}</div></div>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  await browser.close();
  return Buffer.from(pdf);
}

// ==================== تقرير مسير الرواتب الشهري ====================

export async function generatePayrollReport(month: number, year: number, branchId?: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  const { payrolls, payrollDetails } = await import('../../drizzle/schema');
  
  // جلب مسير الرواتب
  const payrollQuery = db.select().from(payrolls).where(
    and(
      eq(payrolls.year, year),
      eq(payrolls.month, month),
      branchId ? eq(payrolls.branchId, branchId) : sql`1=1`
    )
  ).orderBy(desc(payrolls.createdAt));
  const payrollsList = await payrollQuery || [];
  // مؤسسة المسيرات (فرع واحد -> مؤسسته، وإلا الهوية العامة)
  const reportEst = getReportEstablishment(payrollsList.map(p => p.branchName));
  
  if (payrollsList.length === 0) {
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:Arial;padding:40px;text-align:center;}</style></head><body><h1>لا يوجد مسير رواتب</h1><p>لم يتم العثور على مسير رواتب لشهر ${getMonthName(month)} ${year}</p></body></html>`;
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();
    return Buffer.from(pdf);
  }
  
  // جلب تفاصيل الرواتب
  const allDetails: Array<{
    payrollNumber: string;
    branchName: string;
    employeeName: string;
    employeeCode: string;
    position: string | null;
    baseSalary: number;
    overtimeAmount: number;
    incentiveAmount: number;
    totalDeductions: number;
    netSalary: number;
    status: string;
  }> = [];
  
  for (const p of payrollsList) {
    const detailsQuery = db.select().from(payrollDetails).where(eq(payrollDetails.payrollId, p.id));
    const details = await detailsQuery || [];
    for (const d of details) {
      allDetails.push({
        payrollNumber: p.payrollNumber,
        branchName: p.branchName,
        employeeName: d.employeeName,
        employeeCode: d.employeeCode,
        position: d.position,
        baseSalary: Number(d.baseSalary || 0),
        overtimeAmount: Number(d.overtimeAmount || 0),
        incentiveAmount: Number(d.incentiveAmount || 0),
        totalDeductions: Number(d.totalDeductions || 0),
        netSalary: Number(d.netSalary || 0),
        status: p.status,
      });
    }
  }
  
  // حساب الإجماليات
  let totalBase = 0, totalOvertime = 0, totalIncentives = 0, totalDeductions = 0, totalNet = 0;
  for (const d of allDetails) {
    totalBase += d.baseSalary;
    totalOvertime += d.overtimeAmount;
    totalIncentives += d.incentiveAmount;
    totalDeductions += d.totalDeductions;
    totalNet += d.netSalary;
  }
  
  const getPayrollStatusLabel = (s: string) => {
    const labels: Record<string, string> = { draft: 'مسودة', pending: 'قيد المراجعة', approved: 'معتمد', paid: 'مدفوع', cancelled: 'ملغى' };
    return labels[s] || s;
  };
  
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; background: #fff; color: #000; padding: 15px; font-size: 10px; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 3px solid #1e3a5f; padding-bottom: 10px; }
    .header h1 { color: #1e3a5f; font-size: 20px; margin-bottom: 5px; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 15px; }
    .summary-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; text-align: center; }
    .summary-card h3 { font-size: 9px; color: #666; margin-bottom: 5px; }
    .summary-card .amount { font-size: 14px; font-weight: bold; color: #000; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #dee2e6; padding: 6px; text-align: right; font-size: 9px; }
    th { background: #1e3a5f; color: #fff; }
    .total-row { background: #e3f2fd; font-weight: bold; }
    .footer { margin-top: 20px; display: flex; justify-content: space-between; }
    .signature { text-align: center; width: 180px; }
    .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; font-size: 10px; }
    .approved { color: #22c55e; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 15px; font-weight: bold; margin-bottom: 4px;">${escapeHtml(reportEst.nameAr)}</div>
    <h1>مسير الرواتب الشهري</h1>
    <p>شهر ${getMonthName(month)} ${year} | عدد الموظفين: ${allDetails.length}</p>
  </div>
  
  <div class="summary-grid">
    <div class="summary-card"><h3>الرواتب الأساسية</h3><div class="amount">${formatCurrency(totalBase)}</div></div>
    <div class="summary-card"><h3>الساعات الإضافية</h3><div class="amount">${formatCurrency(totalOvertime)}</div></div>
    <div class="summary-card"><h3>الحوافز</h3><div class="amount">${formatCurrency(totalIncentives)}</div></div>
    <div class="summary-card"><h3>الخصومات</h3><div class="amount">${formatCurrency(totalDeductions)}</div></div>
    <div class="summary-card"><h3>صافي الرواتب</h3><div class="amount">${formatCurrency(totalNet)}</div></div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>الفرع</th>
        <th>الموظف</th>
        <th>الكود</th>
        <th>المنصب</th>
        <th>الأساسي</th>
        <th>الإضافي</th>
        <th>الحوافز</th>
        <th>الخصومات</th>
        <th>الصافي</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${allDetails.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(d.branchName)}</td>
          <td>${d.employeeName}</td>
          <td>${d.employeeCode}</td>
          <td>${d.position || '-'}</td>
          <td>${formatCurrency(d.baseSalary)}</td>
          <td>${formatCurrency(d.overtimeAmount)}</td>
          <td>${formatCurrency(d.incentiveAmount)}</td>
          <td>${formatCurrency(d.totalDeductions)}</td>
          <td>${formatCurrency(d.netSalary)}</td>
          <td class="${d.status === 'approved' || d.status === 'paid' ? 'approved' : ''}">${getPayrollStatusLabel(d.status)}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="5">الإجمالي</td>
        <td>${formatCurrency(totalBase)}</td>
        <td>${formatCurrency(totalOvertime)}</td>
        <td>${formatCurrency(totalIncentives)}</td>
        <td>${formatCurrency(totalDeductions)}</td>
        <td>${formatCurrency(totalNet)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  
  <div class="footer">
    <div class="signature"><div class="signature-line">${escapeHtml(REPORT_SIGNATORIES.supervisor.title)}: ${escapeHtml(REPORT_SIGNATORIES.supervisor.name)}</div></div>
    <div class="signature"><div class="signature-line">${escapeHtml(REPORT_SIGNATORIES.manager.title)}: ${escapeHtml(REPORT_SIGNATORIES.manager.name)}</div></div>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '5mm', right: '5mm' } });
  await browser.close();
  return Buffer.from(pdf);
}
