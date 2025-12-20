/**
 * خدمة التصدير إلى Zapier
 * تدعم التصدير التلقائي إلى Google Sheets وإرسال التقارير عبر Gmail
 */

import { getDb } from "../db";
import { dailyRevenues, expenses, branches } from "../../drizzle/schema";
import { eq, gte, lte, and, desc } from "drizzle-orm";

// واجهة بيانات التصدير
export interface ExportData {
  type: "revenues" | "expenses" | "daily_report";
  date: string;
  data: any[];
  summary?: {
    total: number;
    count: number;
    byBranch: Record<string, number>;
  };
}

// واجهة إعدادات Zapier
export interface ZapierConfig {
  webhookUrl?: string;
  spreadsheetId?: string;
  gmailRecipients?: string[];
}

/**
 * تجهيز بيانات الإيرادات للتصدير
 */
export async function prepareRevenuesForExport(
  startDate: string,
  endDate: string
): Promise<ExportData> {
  const db = await getDb();
  
  const revenues = await db!
    .select()
    .from(dailyRevenues)
    .where(
      and(
        gte(dailyRevenues.date, new Date(startDate)),
        lte(dailyRevenues.date, new Date(endDate))
      )
    )
    .orderBy(desc(dailyRevenues.date));
  
  // جلب أسماء الفروع
  const allBranches = await db!.select().from(branches);
  const branchMap = new Map(allBranches.map(b => [b.id, b.nameAr]));
  
  // تحويل البيانات
  const exportData = revenues.map(rev => ({
    التاريخ: new Date(rev.date).toLocaleDateString('ar-SA'),
    الفرع: branchMap.get(rev.branchId) || "غير معروف",
    "إيراد نقدي": Number(rev.cash),
    "إيراد شبكة": Number(rev.network),
    "إيراد مدى": Number(rev.balance),
    المجموع: Number(rev.total),
    مطابق: rev.isMatched ? "نعم" : "لا",
    "سبب عدم المطابقة": rev.unmatchReason || "-",
  }));
  
  // حساب الملخص
  const summary = {
    total: revenues.reduce((sum, r) => sum + Number(r.total), 0),
    count: revenues.length,
    byBranch: {} as Record<string, number>,
  };
  
  for (const rev of revenues) {
    const branchName = branchMap.get(rev.branchId) || "غير معروف";
    summary.byBranch[branchName] = (summary.byBranch[branchName] || 0) + Number(rev.total);
  }
  
  return {
    type: "revenues",
    date: new Date().toISOString(),
    data: exportData,
    summary,
  };
}

/**
 * تجهيز بيانات المصاريف للتصدير
 */
export async function prepareExpensesForExport(
  startDate: string,
  endDate: string,
  approvedOnly: boolean = true
): Promise<ExportData> {
  const db = await getDb();
  
  let query = db!
    .select()
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, new Date(startDate)),
        lte(expenses.expenseDate, new Date(endDate))
      )
    )
    .orderBy(desc(expenses.expenseDate));
  
  const allExpenses = await query;
  
  // تصفية المعتمدة فقط إذا طُلب
  const filteredExpenses = approvedOnly 
    ? allExpenses.filter(e => e.status === 'approved' || e.status === 'paid')
    : allExpenses;
  
  // جلب أسماء الفروع
  const allBranches = await db!.select().from(branches);
  const branchMap = new Map(allBranches.map(b => [b.id, b.nameAr]));
  
  // ترجمة التصنيفات
  const categoryNames: Record<string, string> = {
    shop_supplies: "مستلزمات المحل",
    printing: "طباعة",
    carpet_cleaning: "تنظيف سجاد",
    small_needs: "احتياجات صغيرة",
    residency: "إقامة",
    medical_exam: "فحص طبي",
    transportation: "مواصلات",
    electricity: "كهرباء",
    internet: "إنترنت",
    license_renewal: "تجديد رخصة",
    visa: "تأشيرة",
    maintenance: "صيانة",
    shop_rent: "إيجار محل",
    housing_rent: "إيجار سكن",
    improvements: "تحسينات",
    bonus: "مكافأة",
    other: "أخرى",
  };
  
  // تحويل البيانات
  const exportData = filteredExpenses.map(exp => ({
    التاريخ: new Date(exp.expenseDate).toLocaleDateString('ar-SA'),
    الفرع: exp.branchId ? branchMap.get(exp.branchId) || "غير معروف" : "عام",
    التصنيف: categoryNames[exp.category] || exp.category,
    العنوان: exp.title,
    المبلغ: Number(exp.amount),
    الحالة: exp.status === 'approved' ? 'معتمد' : exp.status === 'paid' ? 'مدفوع' : exp.status,
    "رقم المصروف": exp.expenseNumber,
  }));
  
  // حساب الملخص
  const summary = {
    total: filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    count: filteredExpenses.length,
    byBranch: {} as Record<string, number>,
  };
  
  for (const exp of filteredExpenses) {
    const branchName = exp.branchId ? branchMap.get(exp.branchId) || "غير معروف" : "عام";
    summary.byBranch[branchName] = (summary.byBranch[branchName] || 0) + Number(exp.amount);
  }
  
  return {
    type: "expenses",
    date: new Date().toISOString(),
    data: exportData,
    summary,
  };
}

/**
 * تجهيز التقرير اليومي للتصدير
 */
export async function prepareDailyReportForExport(date?: Date): Promise<ExportData> {
  const reportDate = date || new Date();
  const dateStr = reportDate.toISOString().split('T')[0];
  
  const db = await getDb();
  
  // جلب إيرادات اليوم
  const todayRevenues = await db!
    .select()
    .from(dailyRevenues)
    .where(eq(dailyRevenues.date, reportDate));
  
  // جلب مصاريف اليوم
  const todayExpenses = await db!
    .select()
    .from(expenses)
    .where(gte(expenses.createdAt, new Date(dateStr)));
  
  // جلب أسماء الفروع
  const allBranches = await db!.select().from(branches);
  const branchMap = new Map(allBranches.map(b => [b.id, b.nameAr]));
  
  // تجميع البيانات حسب الفرع
  const reportData: any[] = [];
  
  for (const branch of allBranches) {
    const branchRevenues = todayRevenues.filter(r => r.branchId === branch.id);
    const branchExpenses = todayExpenses.filter(e => e.branchId === branch.id);
    
    const totalRevenue = branchRevenues.reduce((sum, r) => sum + Number(r.total), 0);
    const totalExpenses = branchExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    reportData.push({
      الفرع: branch.nameAr,
      "إجمالي الإيرادات": totalRevenue,
      "إجمالي المصاريف": totalExpenses,
      "صافي الربح": totalRevenue - totalExpenses,
      "عدد الإيرادات": branchRevenues.length,
      "عدد المصاريف": branchExpenses.length,
      "إيرادات غير مطابقة": branchRevenues.filter(r => !r.isMatched).length,
    });
  }
  
  // إضافة صف الإجمالي
  const totalRevenue = todayRevenues.reduce((sum, r) => sum + Number(r.total), 0);
  const totalExpenses = todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  reportData.push({
    الفرع: "الإجمالي",
    "إجمالي الإيرادات": totalRevenue,
    "إجمالي المصاريف": totalExpenses,
    "صافي الربح": totalRevenue - totalExpenses,
    "عدد الإيرادات": todayRevenues.length,
    "عدد المصاريف": todayExpenses.length,
    "إيرادات غير مطابقة": todayRevenues.filter(r => !r.isMatched).length,
  });
  
  return {
    type: "daily_report",
    date: dateStr,
    data: reportData,
    summary: {
      total: totalRevenue - totalExpenses,
      count: todayRevenues.length + todayExpenses.length,
      byBranch: Object.fromEntries(
        allBranches.map(b => [
          b.nameAr,
          todayRevenues.filter(r => r.branchId === b.id).reduce((sum, r) => sum + Number(r.total), 0)
        ])
      ),
    },
  };
}

/**
 * تنسيق البيانات لـ Google Sheets
 */
export function formatForGoogleSheets(exportData: ExportData): {
  headers: string[];
  rows: any[][];
} {
  if (exportData.data.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = Object.keys(exportData.data[0]);
  const rows = exportData.data.map(row => headers.map(h => row[h]));
  
  return { headers, rows };
}

/**
 * تنسيق التقرير للبريد الإلكتروني
 */
export function formatForEmail(exportData: ExportData): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const date = new Date(exportData.date).toLocaleDateString('ar-SA');
  
  let subject = "";
  let bodyHtml = "";
  let bodyText = "";
  
  switch (exportData.type) {
    case "revenues":
      subject = `تقرير الإيرادات - ${date}`;
      bodyHtml = generateRevenuesEmailHtml(exportData);
      bodyText = generateRevenuesEmailText(exportData);
      break;
    case "expenses":
      subject = `تقرير المصاريف المعتمدة - ${date}`;
      bodyHtml = generateExpensesEmailHtml(exportData);
      bodyText = generateExpensesEmailText(exportData);
      break;
    case "daily_report":
      subject = `التقرير اليومي - ${date}`;
      bodyHtml = generateDailyReportEmailHtml(exportData);
      bodyText = generateDailyReportEmailText(exportData);
      break;
  }
  
  return { subject, bodyHtml, bodyText };
}

// دوال مساعدة لتوليد محتوى البريد
function generateRevenuesEmailHtml(data: ExportData): string {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>📊 تقرير الإيرادات</h2>
      <p><strong>التاريخ:</strong> ${new Date(data.date).toLocaleDateString('ar-SA')}</p>
      <p><strong>إجمالي الإيرادات:</strong> ${data.summary?.total.toLocaleString()} ر.س.</p>
      <p><strong>عدد السجلات:</strong> ${data.summary?.count}</p>
      
      <h3>حسب الفرع:</h3>
      <ul>
        ${Object.entries(data.summary?.byBranch || {}).map(([branch, amount]) => 
          `<li>${branch}: ${(amount as number).toLocaleString()} ر.س.</li>`
        ).join('')}
      </ul>
    </div>
  `;
}

function generateRevenuesEmailText(data: ExportData): string {
  return `
تقرير الإيرادات
التاريخ: ${new Date(data.date).toLocaleDateString('ar-SA')}
إجمالي الإيرادات: ${data.summary?.total.toLocaleString()} ر.س.
عدد السجلات: ${data.summary?.count}

حسب الفرع:
${Object.entries(data.summary?.byBranch || {}).map(([branch, amount]) => 
  `- ${branch}: ${(amount as number).toLocaleString()} ر.س.`
).join('\n')}
  `;
}

function generateExpensesEmailHtml(data: ExportData): string {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>💰 تقرير المصاريف المعتمدة</h2>
      <p><strong>التاريخ:</strong> ${new Date(data.date).toLocaleDateString('ar-SA')}</p>
      <p><strong>إجمالي المصاريف:</strong> ${data.summary?.total.toLocaleString()} ر.س.</p>
      <p><strong>عدد السجلات:</strong> ${data.summary?.count}</p>
      
      <h3>حسب الفرع:</h3>
      <ul>
        ${Object.entries(data.summary?.byBranch || {}).map(([branch, amount]) => 
          `<li>${branch}: ${(amount as number).toLocaleString()} ر.س.</li>`
        ).join('')}
      </ul>
    </div>
  `;
}

function generateExpensesEmailText(data: ExportData): string {
  return `
تقرير المصاريف المعتمدة
التاريخ: ${new Date(data.date).toLocaleDateString('ar-SA')}
إجمالي المصاريف: ${data.summary?.total.toLocaleString()} ر.س.
عدد السجلات: ${data.summary?.count}

حسب الفرع:
${Object.entries(data.summary?.byBranch || {}).map(([branch, amount]) => 
  `- ${branch}: ${(amount as number).toLocaleString()} ر.س.`
).join('\n')}
  `;
}

function generateDailyReportEmailHtml(data: ExportData): string {
  const totalRow = data.data.find(d => d.الفرع === "الإجمالي");
  
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>📈 التقرير اليومي - ${data.date}</h2>
      
      <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
        <thead style="background-color: #f0f0f0;">
          <tr>
            <th>الفرع</th>
            <th>الإيرادات</th>
            <th>المصاريف</th>
            <th>الصافي</th>
          </tr>
        </thead>
        <tbody>
          ${data.data.filter(d => d.الفرع !== "الإجمالي").map(row => `
            <tr>
              <td>${row.الفرع}</td>
              <td>${row["إجمالي الإيرادات"].toLocaleString()} ر.س.</td>
              <td>${row["إجمالي المصاريف"].toLocaleString()} ر.س.</td>
              <td style="color: ${row["صافي الربح"] >= 0 ? 'green' : 'red'};">
                ${row["صافي الربح"].toLocaleString()} ر.س.
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot style="background-color: #e0e0e0; font-weight: bold;">
          <tr>
            <td>الإجمالي</td>
            <td>${totalRow?.["إجمالي الإيرادات"]?.toLocaleString() || 0} ر.س.</td>
            <td>${totalRow?.["إجمالي المصاريف"]?.toLocaleString() || 0} ر.س.</td>
            <td style="color: ${(totalRow?.["صافي الربح"] || 0) >= 0 ? 'green' : 'red'};">
              ${totalRow?.["صافي الربح"]?.toLocaleString() || 0} ر.س.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function generateDailyReportEmailText(data: ExportData): string {
  const totalRow = data.data.find(d => d.الفرع === "الإجمالي");
  
  return `
التقرير اليومي - ${data.date}

${data.data.filter(d => d.الفرع !== "الإجمالي").map(row => 
  `${row.الفرع}: إيرادات ${row["إجمالي الإيرادات"].toLocaleString()} | مصاريف ${row["إجمالي المصاريف"].toLocaleString()} | صافي ${row["صافي الربح"].toLocaleString()}`
).join('\n')}

الإجمالي:
- إيرادات: ${totalRow?.["إجمالي الإيرادات"]?.toLocaleString() || 0} ر.س.
- مصاريف: ${totalRow?.["إجمالي المصاريف"]?.toLocaleString() || 0} ر.س.
- صافي: ${totalRow?.["صافي الربح"]?.toLocaleString() || 0} ر.س.
  `;
}
