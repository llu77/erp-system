/**
 * أداة التحليل - Analysis Tool
 * ============================
 * 
 * أداة لتحليل البيانات وإنشاء الإحصائيات
 */

import { BaseTool } from "./baseTool";
import { getDb } from "../../../db";
import { 
  dailyRevenues, 
  expenses, 
  branches,
  invoices,
  products
} from "../../../../drizzle/schema";
import { eq, and, gte, lte, desc, sql, count, sum, avg } from "drizzle-orm";

export class AnalysisTool extends BaseTool {
  constructor() {
    super(
      "analyze_data",
      `تحليل البيانات وإنشاء إحصائيات وتقارير.
      يمكنك تحليل: الإيرادات، المصاريف، المبيعات، الأرباح.
      استخدم هذه الأداة للحصول على رؤى وتحليلات عميقة.`,
      {
        type: "object",
        properties: {
          analysisType: {
            type: "string",
            description: "نوع التحليل",
            enum: [
              "revenue_summary",      // ملخص الإيرادات
              "expense_summary",      // ملخص المصاريف
              "profit_analysis",      // تحليل الأرباح
              "branch_comparison",    // مقارنة الفروع
              "trend_analysis",       // تحليل الاتجاهات
              "top_products",         // أفضل المنتجات
              "kpi_dashboard",        // مؤشرات الأداء
            ],
          },
          period: {
            type: "string",
            description: "الفترة الزمنية",
            enum: ["today", "week", "month", "quarter", "year", "custom"],
          },
          startDate: {
            type: "string",
            description: "تاريخ البداية (YYYY-MM-DD) - مطلوب للفترة المخصصة",
          },
          endDate: {
            type: "string",
            description: "تاريخ النهاية (YYYY-MM-DD) - مطلوب للفترة المخصصة",
          },
          branchId: {
            type: "number",
            description: "معرف الفرع (اختياري - للتصفية حسب الفرع)",
          },
        },
        required: ["analysisType", "period"],
      }
    );
  }

  async execute(input: {
    analysisType: string;
    period: string;
    startDate?: string;
    endDate?: string;
    branchId?: number;
  }): Promise<string> {
    const { analysisType, period, startDate, endDate, branchId } = input;
    const db = await getDb();
    if (!db) {
      return "خطأ: لم يتم الاتصال بقاعدة البيانات";
    }

    try {
      const dateRange = this.getDateRange(period, startDate, endDate);
      
      let result: any;
      switch (analysisType) {
        case "revenue_summary":
          result = await this.analyzeRevenues(db, dateRange, branchId);
          break;
        case "expense_summary":
          result = await this.analyzeExpenses(db, dateRange, branchId);
          break;
        case "profit_analysis":
          result = await this.analyzeProfits(db, dateRange, branchId);
          break;
        case "branch_comparison":
          result = await this.compareBranches(db, dateRange);
          break;
        case "trend_analysis":
          result = await this.analyzeTrends(db, dateRange, branchId);
          break;
        case "top_products":
          result = await this.getTopProducts(db, dateRange);
          break;
        case "kpi_dashboard":
          result = await this.getKPIDashboard(db, dateRange, branchId);
          break;
        default:
          return `نوع تحليل غير معروف: ${analysisType}`;
      }

      return this.formatAnalysisResult(analysisType, result, dateRange);
    } catch (error: any) {
      return `خطأ في التحليل: ${error.message}`;
    }
  }

  private getDateRange(period: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end = new Date(now);

    switch (period) {
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case "quarter":
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        break;
      case "year":
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      case "custom":
        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
        } else {
          start = new Date(now);
          start.setMonth(start.getMonth() - 1);
        }
        break;
      default:
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
    }

    return { start, end };
  }

  private async analyzeRevenues(db: any, dateRange: { start: Date; end: Date }, branchId?: number) {
    const conditions: any[] = [
      gte(dailyRevenues.date, dateRange.start),
      lte(dailyRevenues.date, dateRange.end),
    ];
    
    if (branchId) {
      conditions.push(eq(dailyRevenues.branchId, branchId));
    }

    const result = await db
      .select({
        totalRevenue: sum(dailyRevenues.total),
        totalCash: sum(dailyRevenues.cash),
        totalCard: sum(dailyRevenues.network),
        totalBalance: sum(dailyRevenues.balance),
        count: count(),
        avgDaily: avg(dailyRevenues.total),
      })
      .from(dailyRevenues)
      .where(and(...conditions));

    return result[0];
  }

  private async analyzeExpenses(db: any, dateRange: { start: Date; end: Date }, branchId?: number) {
    const conditions: any[] = [
      gte(expenses.createdAt, dateRange.start),
      lte(expenses.createdAt, dateRange.end),
    ];
    
    if (branchId) {
      conditions.push(eq(expenses.branchId, branchId));
    }

    const result = await db
      .select({
        totalExpenses: sum(expenses.amount),
        count: count(),
        avgExpense: avg(expenses.amount),
      })
      .from(expenses)
      .where(and(...conditions));

    // تحليل حسب الفئة
    const byCategory = await db
      .select({
        category: expenses.category,
        total: sum(expenses.amount),
        count: count(),
      })
      .from(expenses)
      .where(and(...conditions))
      .groupBy(expenses.category);

    return {
      summary: result[0],
      byCategory,
    };
  }

  private async analyzeProfits(db: any, dateRange: { start: Date; end: Date }, branchId?: number) {
    const revenues = await this.analyzeRevenues(db, dateRange, branchId);
    const expensesData = await this.analyzeExpenses(db, dateRange, branchId);

    const totalRevenue = Number(revenues?.totalRevenue || 0);
    const totalExpenses = Number(expensesData?.summary?.totalExpenses || 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin: profitMargin.toFixed(2),
      isProfit: netProfit > 0,
    };
  }

  private async compareBranches(db: any, dateRange: { start: Date; end: Date }) {
    const branchList = await db.select().from(branches);
    
    const comparison = await Promise.all(
      branchList.map(async (branch: any) => {
        const revenues = await this.analyzeRevenues(db, dateRange, branch.id);
        const expensesData = await this.analyzeExpenses(db, dateRange, branch.id);
        
        return {
          branchId: branch.id,
          branchName: branch.name,
          totalRevenue: Number(revenues?.totalRevenue || 0),
          totalExpenses: Number(expensesData?.summary?.totalExpenses || 0),
          netProfit: Number(revenues?.totalRevenue || 0) - Number(expensesData?.summary?.totalExpenses || 0),
        };
      })
    );

    return comparison.sort((a, b) => b.netProfit - a.netProfit);
  }

  private async analyzeTrends(db: any, dateRange: { start: Date; end: Date }, branchId?: number) {
    const conditions: any[] = [
      gte(dailyRevenues.date, dateRange.start),
      lte(dailyRevenues.date, dateRange.end),
    ];
    
    if (branchId) {
      conditions.push(eq(dailyRevenues.branchId, branchId));
    }

    const dailyData = await db
      .select({
        date: dailyRevenues.date,
        total: dailyRevenues.total,
      })
      .from(dailyRevenues)
      .where(and(...conditions))
      .orderBy(dailyRevenues.date);

    // حساب الاتجاه
    const totals = dailyData.map((d: any) => Number(d.total));
    const trend = this.calculateTrend(totals);

    return {
      dailyData,
      trend,
      trendDirection: trend > 0 ? "صاعد" : trend < 0 ? "هابط" : "مستقر",
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private async getTopProducts(db: any, dateRange: { start: Date; end: Date }) {
    // هذا يتطلب جدول مبيعات المنتجات - نعيد قائمة المنتجات الأكثر مخزوناً
    const topProducts = await db
      .select()
      .from(products)
      .orderBy(desc(products.quantity))
      .limit(10);

    return topProducts;
  }

  private async getKPIDashboard(db: any, dateRange: { start: Date; end: Date }, branchId?: number) {
    const revenues = await this.analyzeRevenues(db, dateRange, branchId);
    const expensesData = await this.analyzeExpenses(db, dateRange, branchId);
    const profits = await this.analyzeProfits(db, dateRange, branchId);

    return {
      kpis: {
        totalRevenue: Number(revenues?.totalRevenue || 0),
        totalExpenses: Number(expensesData?.summary?.totalExpenses || 0),
        netProfit: profits.netProfit,
        profitMargin: profits.profitMargin,
        avgDailyRevenue: Number(revenues?.avgDaily || 0),
        transactionCount: Number(revenues?.count || 0),
      },
      status: {
        revenueStatus: Number(revenues?.totalRevenue || 0) > 0 ? "جيد" : "يحتاج تحسين",
        profitStatus: profits.isProfit ? "ربح" : "خسارة",
      },
    };
  }

  private formatAnalysisResult(type: string, result: any, dateRange: { start: Date; end: Date }): string {
    const periodStr = `من ${dateRange.start.toLocaleDateString("ar-SA")} إلى ${dateRange.end.toLocaleDateString("ar-SA")}`;
    
    let output = `📊 **تقرير التحليل**\n`;
    output += `📅 الفترة: ${periodStr}\n\n`;

    switch (type) {
      case "revenue_summary":
        output += `💰 **ملخص الإيرادات**\n`;
        output += `- إجمالي الإيرادات: ${Number(result?.totalRevenue || 0).toLocaleString("ar-SA")} ر.س\n`;
        output += `- النقدي: ${Number(result?.totalCash || 0).toLocaleString("ar-SA")} ر.س\n`;
        output += `- الشبكة: ${Number(result?.totalCard || 0).toLocaleString("ar-SA")} ر.س\n`;
        output += `- الرصيد: ${Number(result?.totalBalance || 0).toLocaleString("ar-SA")} ر.س\n`;
        output += `- عدد الأيام: ${result?.count || 0}\n`;
        output += `- المتوسط اليومي: ${Number(result?.avgDaily || 0).toLocaleString("ar-SA")} ر.س\n`;
        break;

      case "expense_summary":
        output += `💸 **ملخص المصاريف**\n`;
        output += `- إجمالي المصاريف: ${Number(result?.summary?.totalExpenses || 0).toLocaleString("ar-SA")} ر.س\n`;
        output += `- عدد المصاريف: ${result?.summary?.count || 0}\n`;
        output += `- متوسط المصروف: ${Number(result?.summary?.avgExpense || 0).toLocaleString("ar-SA")} ر.س\n\n`;
        output += `📂 **حسب الفئة:**\n`;
        (result?.byCategory || []).forEach((cat: any) => {
          output += `- ${cat.category}: ${Number(cat.total || 0).toLocaleString("ar-SA")} ر.س (${cat.count} عملية)\n`;
        });
        break;

      case "profit_analysis":
        output += `📈 **تحليل الأرباح**\n`;
        output += `- إجمالي الإيرادات: ${result.totalRevenue.toLocaleString("ar-SA")} ر.س\n`;
        output += `- إجمالي المصاريف: ${result.totalExpenses.toLocaleString("ar-SA")} ر.س\n`;
        output += `- صافي الربح: ${result.netProfit.toLocaleString("ar-SA")} ر.س\n`;
        output += `- هامش الربح: ${result.profitMargin}%\n`;
        output += `- الحالة: ${result.isProfit ? "✅ ربح" : "❌ خسارة"}\n`;
        break;

      case "branch_comparison":
        output += `🏢 **مقارنة الفروع**\n\n`;
        (result || []).forEach((branch: any, index: number) => {
          output += `${index + 1}. **${branch.branchName}**\n`;
          output += `   - الإيرادات: ${branch.totalRevenue.toLocaleString("ar-SA")} ر.س\n`;
          output += `   - المصاريف: ${branch.totalExpenses.toLocaleString("ar-SA")} ر.س\n`;
          output += `   - صافي الربح: ${branch.netProfit.toLocaleString("ar-SA")} ر.س\n\n`;
        });
        break;

      case "kpi_dashboard":
        output += `📊 **مؤشرات الأداء الرئيسية (KPIs)**\n\n`;
        output += `💰 الإيرادات: ${result.kpis.totalRevenue.toLocaleString("ar-SA")} ر.س\n`;
        output += `💸 المصاريف: ${result.kpis.totalExpenses.toLocaleString("ar-SA")} ر.س\n`;
        output += `📈 صافي الربح: ${result.kpis.netProfit.toLocaleString("ar-SA")} ر.س\n`;
        output += `📊 هامش الربح: ${result.kpis.profitMargin}%\n`;
        output += `📅 المتوسط اليومي: ${result.kpis.avgDailyRevenue.toLocaleString("ar-SA")} ر.س\n`;
        output += `🔢 عدد العمليات: ${result.kpis.transactionCount}\n\n`;
        output += `**الحالة:**\n`;
        output += `- الإيرادات: ${result.status.revenueStatus}\n`;
        output += `- الربحية: ${result.status.profitStatus}\n`;
        break;

      default:
        output += JSON.stringify(result, null, 2);
    }

    return output;
  }
}

export const analysisTool = new AnalysisTool();
