/**
 * أداة قاعدة البيانات - Database Tool
 * ===================================
 * 
 * أداة للاستعلام عن قاعدة البيانات وتحليل البيانات
 */

import { BaseTool } from "./baseTool";
import { getDb } from "../../../db";
import { 
  dailyRevenues, 
  expenses, 
  branches, 
  employees,
  products,
  customers,
  suppliers,
  invoices,
  purchaseOrders
} from "../../../../drizzle/schema";
import { eq, and, gte, lte, desc, asc, sql, count, sum, avg } from "drizzle-orm";

export class DatabaseQueryTool extends BaseTool {
  constructor() {
    super(
      "database_query",
      `استعلام عن قاعدة البيانات للحصول على معلومات.
      يمكنك الاستعلام عن: الإيرادات، المصاريف، الفروع، الموظفين، المنتجات، العملاء، الموردين.
      استخدم هذه الأداة للحصول على بيانات محددة أو إحصائيات.`,
      {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "الجدول المراد الاستعلام عنه",
            enum: ["revenues", "expenses", "branches", "employees", "products", "customers", "suppliers", "invoices", "purchase_orders"],
          },
          operation: {
            type: "string",
            description: "نوع العملية",
            enum: ["list", "count", "sum", "average", "latest", "search"],
          },
          filters: {
            type: "object",
            description: "فلاتر البحث (اختياري)",
            properties: {
              branchId: { type: "number", description: "معرف الفرع" },
              startDate: { type: "string", description: "تاريخ البداية (YYYY-MM-DD)" },
              endDate: { type: "string", description: "تاريخ النهاية (YYYY-MM-DD)" },
              status: { type: "string", description: "الحالة" },
              category: { type: "string", description: "الفئة" },
            },
          },
          limit: {
            type: "number",
            description: "عدد النتائج (افتراضي 10)",
          },
          field: {
            type: "string",
            description: "الحقل للعمليات الحسابية (sum, average)",
          },
        },
        required: ["table", "operation"],
      }
    );
  }

  async execute(input: {
    table: string;
    operation: string;
    filters?: Record<string, any>;
    limit?: number;
    field?: string;
  }): Promise<string> {
    const { table, operation, filters = {}, limit = 10, field } = input;
    const db = await getDb();
    if (!db) {
      return "خطأ: لم يتم الاتصال بقاعدة البيانات";
    }

    try {
      let result: any;

      switch (table) {
        case "revenues":
          result = await this.queryRevenues(db, operation, filters, limit, field);
          break;
        case "expenses":
          result = await this.queryExpenses(db, operation, filters, limit, field);
          break;
        case "branches":
          result = await this.queryBranches(db, operation, limit);
          break;
        case "employees":
          result = await this.queryEmployees(db, operation, filters, limit);
          break;
        case "products":
          result = await this.queryProducts(db, operation, filters, limit);
          break;
        case "customers":
          result = await this.queryCustomers(db, operation, limit);
          break;
        case "suppliers":
          result = await this.querySuppliers(db, operation, limit);
          break;
        case "invoices":
          result = await this.queryInvoices(db, operation, filters, limit, field);
          break;
        case "purchase_orders":
          result = await this.queryPurchaseOrders(db, operation, filters, limit, field);
          break;
        default:
          return `جدول غير معروف: ${table}`;
      }

      return JSON.stringify(result, null, 2);
    } catch (error: any) {
      return `خطأ في الاستعلام: ${error.message}`;
    }
  }

  private async queryRevenues(db: any, operation: string, filters: any, limit: number, field?: string) {
    const conditions: any[] = [];
    
    if (filters.branchId) {
      conditions.push(eq(dailyRevenues.branchId, filters.branchId));
    }
    if (filters.startDate) {
      conditions.push(gte(dailyRevenues.date, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(dailyRevenues.date, new Date(filters.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    switch (operation) {
      case "list":
        return db.select().from(dailyRevenues).where(whereClause).orderBy(desc(dailyRevenues.date)).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(dailyRevenues).where(whereClause);
        return { count: countResult[0]?.count || 0 };
      case "sum":
        const sumResult = await db.select({ total: sum(dailyRevenues.total) }).from(dailyRevenues).where(whereClause);
        return { total: sumResult[0]?.total || 0 };
      case "average":
        const avgResult = await db.select({ average: avg(dailyRevenues.total) }).from(dailyRevenues).where(whereClause);
        return { average: avgResult[0]?.average || 0 };
      case "latest":
        return db.select().from(dailyRevenues).where(whereClause).orderBy(desc(dailyRevenues.date)).limit(1);
      default:
        return [];
    }
  }

  private async queryExpenses(db: any, operation: string, filters: any, limit: number, field?: string) {
    const conditions: any[] = [];
    
    if (filters.branchId) {
      conditions.push(eq(expenses.branchId, filters.branchId));
    }
    if (filters.startDate) {
      conditions.push(gte(expenses.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(expenses.createdAt, new Date(filters.endDate)));
    }
    if (filters.category) {
      conditions.push(eq(expenses.category, filters.category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    switch (operation) {
      case "list":
        return db.select().from(expenses).where(whereClause).orderBy(desc(expenses.createdAt)).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(expenses).where(whereClause);
        return { count: countResult[0]?.count || 0 };
      case "sum":
        const sumResult = await db.select({ total: sum(expenses.amount) }).from(expenses).where(whereClause);
        return { total: sumResult[0]?.total || 0 };
      case "average":
        const avgResult = await db.select({ average: avg(expenses.amount) }).from(expenses).where(whereClause);
        return { average: avgResult[0]?.average || 0 };
      default:
        return [];
    }
  }

  private async queryBranches(db: any, operation: string, limit: number) {
    switch (operation) {
      case "list":
        return db.select().from(branches).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(branches);
        return { count: countResult[0]?.count || 0 };
      default:
        return [];
    }
  }

  private async queryEmployees(db: any, operation: string, filters: any, limit: number) {
    const conditions: any[] = [];
    
    if (filters.branchId) {
      conditions.push(eq(employees.branchId, filters.branchId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    switch (operation) {
      case "list":
        return db.select().from(employees).where(whereClause).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(employees).where(whereClause);
        return { count: countResult[0]?.count || 0 };
      default:
        return [];
    }
  }

  private async queryProducts(db: any, operation: string, filters: any, limit: number) {
    switch (operation) {
      case "list":
        return db.select().from(products).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(products);
        return { count: countResult[0]?.count || 0 };
      case "search":
        if (filters.category) {
          return db.select().from(products).where(eq(products.categoryId, filters.category)).limit(limit);
        }
        return [];
      default:
        return [];
    }
  }

  private async queryCustomers(db: any, operation: string, limit: number) {
    switch (operation) {
      case "list":
        return db.select().from(customers).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(customers);
        return { count: countResult[0]?.count || 0 };
      default:
        return [];
    }
  }

  private async querySuppliers(db: any, operation: string, limit: number) {
    switch (operation) {
      case "list":
        return db.select().from(suppliers).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(suppliers);
        return { count: countResult[0]?.count || 0 };
      default:
        return [];
    }
  }

  private async queryInvoices(db: any, operation: string, filters: any, limit: number, field?: string) {
    const conditions: any[] = [];
    
    if (filters.startDate) {
      conditions.push(gte(invoices.invoiceDate, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(invoices.invoiceDate, new Date(filters.endDate)));
    }
    if (filters.status) {
      conditions.push(eq(invoices.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    switch (operation) {
      case "list":
        return db.select().from(invoices).where(whereClause).orderBy(desc(invoices.invoiceDate)).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(invoices).where(whereClause);
        return { count: countResult[0]?.count || 0 };
      case "sum":
        const sumResult = await db.select({ total: sum(invoices.total) }).from(invoices).where(whereClause);
        return { total: sumResult[0]?.total || 0 };
      default:
        return [];
    }
  }

  private async queryPurchaseOrders(db: any, operation: string, filters: any, limit: number, field?: string) {
    const conditions: any[] = [];
    
    if (filters.status) {
      conditions.push(eq(purchaseOrders.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    switch (operation) {
      case "list":
        return db.select().from(purchaseOrders).where(whereClause).orderBy(desc(purchaseOrders.createdAt)).limit(limit);
      case "count":
        const countResult = await db.select({ count: count() }).from(purchaseOrders).where(whereClause);
        return { count: countResult[0]?.count || 0 };
      case "sum":
        const sumResult = await db.select({ total: sum(purchaseOrders.total) }).from(purchaseOrders).where(whereClause);
        return { total: sumResult[0]?.total || 0 };
      default:
        return [];
    }
  }
}

export const databaseQueryTool = new DatabaseQueryTool();
