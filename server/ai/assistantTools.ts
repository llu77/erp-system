/**
 * أدوات مساعد AI للموظفين
 * يوفر أدوات للتعرف على الموظف، رفع الطلبات، التقارير، وحساب الأسعار
 */

import { getDb } from "../db";
import { 
  employees, 
  branches, 
  employeeRequests, 
  dailyRevenues,
  weeklyBonuses,
  bonusDetails,
  loyaltySettings,
  products
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// أنواع الأدوات
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// ========== أداة التعرف على الموظف ==========
export async function identifyEmployee(name: string): Promise<ToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: 'قاعدة البيانات غير متاحة' };
    }

    // البحث عن الموظف بالاسم (جزئي)
    const allEmployees = await db.select({
      id: employees.id,
      name: employees.name,
      phone: employees.phone,
      branchId: employees.branchId,
      branchName: branches.name,
      position: employees.position,
      isActive: employees.isActive,
    })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.isActive, true));

    // البحث بالاسم (جزئي)
    const matchedEmployees = allEmployees.filter((emp: any) => 
      emp.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(emp.name.toLowerCase())
    );

    if (matchedEmployees.length === 0) {
      return {
        success: false,
        error: `لم أجد موظف باسم "${name}". هل يمكنك التأكد من الاسم؟`
      };
    }

    if (matchedEmployees.length === 1) {
      const emp = matchedEmployees[0];
      return {
        success: true,
        data: emp,
        message: `مرحباً ${emp.name}! أنت تعمل في فرع ${emp.branchName || 'غير محدد'} كـ ${emp.position || 'موظف'}. كيف يمكنني مساعدتك اليوم؟`
      };
    }

    // أكثر من موظف بنفس الاسم
    return {
      success: true,
      data: matchedEmployees,
      message: `وجدت ${matchedEmployees.length} موظفين بهذا الاسم. أي فرع تعمل فيه؟\n${matchedEmployees.map((e: any) => `- ${e.name} (${e.branchName})`).join('\n')}`
    };
  } catch (error) {
    return {
      success: false,
      error: `حدث خطأ أثناء البحث: ${error}`
    };
  }
}

// ========== أداة رفع طلب موظف ==========
export type RequestType = 'advance' | 'vacation' | 'arrears' | 'permission' | 'objection' | 'resignation';

export interface EmployeeRequestInput {
  employeeId: number;
  type: RequestType;
  description: string;
  amount?: number; // للسلفة والمتأخرات
  vacationStartDate?: Date;
  vacationEndDate?: Date;
  vacationDays?: number;
  vacationType?: string;
  permissionDate?: Date;
  permissionStartTime?: string;
  permissionEndTime?: string;
}

export async function submitEmployeeRequest(input: EmployeeRequestInput): Promise<ToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: 'قاعدة البيانات غير متاحة' };
    }

    // التحقق من وجود الموظف
    const employee = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
    if (employee.length === 0) {
      return { success: false, error: 'الموظف غير موجود' };
    }

    const emp = employee[0];

    // جلب اسم الفرع
    let branchName = 'غير محدد';
    if (emp.branchId) {
      const branch = await db.select().from(branches).where(eq(branches.id, emp.branchId)).limit(1);
      if (branch.length > 0) {
        branchName = branch[0].name;
      }
    }

    // أسماء أنواع الطلبات
    const typeNames: Record<RequestType, string> = {
      advance: 'سلفة',
      vacation: 'إجازة',
      arrears: 'صرف متأخرات',
      permission: 'استئذان',
      objection: 'اعتراض',
      resignation: 'استقالة'
    };

    // إنشاء رقم الطلب
    const now = new Date();
    const requestNumber = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-6)}`;

    // إنشاء الطلب بالهيكل الصحيح
    const requestData: any = {
      requestNumber,
      employeeId: input.employeeId,
      employeeName: emp.name,
      branchId: emp.branchId,
      branchName,
      requestType: input.type,
      title: `طلب ${typeNames[input.type]}`,
      description: input.description,
      status: 'pending',
    };

    // إضافة البيانات حسب نوع الطلب
    if (input.type === 'advance') {
      requestData.advanceAmount = input.amount?.toString() || '0';
      requestData.advanceReason = input.description;
    }

    if (input.type === 'arrears') {
      requestData.arrearsAmount = input.amount?.toString() || '0';
      requestData.arrearsDetails = input.description;
    }

    if (input.type === 'vacation') {
      requestData.vacationStartDate = input.vacationStartDate ? new Date(input.vacationStartDate) : null;
      requestData.vacationEndDate = input.vacationEndDate ? new Date(input.vacationEndDate) : null;
      requestData.vacationDays = input.vacationDays;
      requestData.vacationType = input.vacationType || 'annual';
    }

    if (input.type === 'permission') {
      requestData.permissionDate = input.permissionDate ? new Date(input.permissionDate) : null;
      requestData.permissionStartTime = input.permissionStartTime;
      requestData.permissionEndTime = input.permissionEndTime;
    }

    const result = await db.insert(employeeRequests).values(requestData);

    return {
      success: true,
      data: { requestId: result[0]?.insertId, requestNumber },
      message: `✅ تم رفع طلب ${typeNames[input.type]} بنجاح!\n\nرقم الطلب: ${requestNumber}\nسيتم مراجعته من قبل المشرف وإبلاغك بالنتيجة.`
    };
  } catch (error) {
    return {
      success: false,
      error: `حدث خطأ أثناء رفع الطلب: ${error}`
    };
  }
}

// ========== أداة التقارير السريعة ==========
export interface ReportInput {
  employeeId: number;
  reportType: 'revenue' | 'bonus' | 'requests' | 'summary';
  period?: 'today' | 'week' | 'month' | 'last_week' | 'last_month';
}

export async function getQuickReport(input: ReportInput): Promise<ToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: 'قاعدة البيانات غير متاحة' };
    }

    const employee = await db.select({
      id: employees.id,
      name: employees.name,
      branchId: employees.branchId,
      branchName: branches.name,
    })
    .from(employees)
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, input.employeeId))
    .limit(1);

    if (employee.length === 0) {
      return { success: false, error: 'الموظف غير موجود' };
    }

    const emp = employee[0];
    const now = new Date();
    
    // حساب بداية ونهاية الفترة
    let startDate: Date;
    let endDate: Date = now;
    
    switch (input.period || 'week') {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        // الأسبوع الحالي (من الأحد)
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
      case 'last_week':
        // الأسبوع الماضي
        const lastWeekDayOfWeek = now.getDay();
        const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - lastWeekDayOfWeek - 1);
        const lastWeekStart = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate() - 6);
        startDate = lastWeekStart;
        endDate = lastWeekEnd;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        // الشهر الماضي
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); // آخر يوم في الشهر الماضي
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    if (input.reportType === 'revenue') {
      // تقرير الإيرادات - استخدام branchId بدلاً من employeeId
      const revenues = await db.select()
        .from(dailyRevenues)
        .where(and(
          eq(dailyRevenues.branchId, emp.branchId!),
          gte(dailyRevenues.date, startDate),
          lte(dailyRevenues.date, endDate)
        ));

      const totalCash = revenues.reduce((sum: number, r: any) => sum + Number(r.cash || 0), 0);
      const totalNetwork = revenues.reduce((sum: number, r: any) => sum + Number(r.network || 0), 0);
      const totalBalance = revenues.reduce((sum: number, r: any) => sum + Number(r.balance || 0), 0);
      const total = totalCash + totalNetwork + totalBalance;

      // أسماء الفترات
      const periodNames: Record<string, string> = {
        'today': 'اليوم',
        'week': 'هذا الأسبوع',
        'last_week': 'الأسبوع الماضي',
        'month': 'هذا الشهر',
        'last_month': 'الشهر الماضي'
      };
      const periodName = periodNames[input.period || 'week'] || 'هذا الأسبوع';

      return {
        success: true,
        data: {
          totalCash,
          totalNetwork,
          totalBalance,
          total,
          count: revenues.length,
          period: input.period,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        message: `📊 تقرير إيرادات الفرع (${periodName}):\n📅 من ${startDate.toLocaleDateString('ar-SA')} إلى ${endDate.toLocaleDateString('ar-SA')}\n\n💵 نقدي: ${totalCash.toLocaleString()} ر.س\n💳 شبكة: ${totalNetwork.toLocaleString()} ر.س\n🏧 رصيد: ${totalBalance.toLocaleString()} ر.س\n━━━━━━━━━━━━\n💰 الإجمالي: ${total.toLocaleString()} ر.س\n📝 عدد الأيام: ${revenues.length}`
      };
    }

    if (input.reportType === 'bonus') {
      // تقرير البونص
      const currentWeekStart = getWeekStart(now);
      
      const bonusDetail = await db.select({
        revenue: bonusDetails.weeklyRevenue,
        bonusAmount: bonusDetails.bonusAmount,
        tier: bonusDetails.bonusTier,
      })
      .from(bonusDetails)
      .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
      .where(and(
        eq(bonusDetails.employeeId, input.employeeId),
        eq(weeklyBonuses.weekStart, currentWeekStart)
      ))
      .limit(1);

      if (bonusDetail.length === 0) {
        return {
          success: true,
          message: `📊 لا يوجد بونص مسجل لك هذا الأسبوع بعد.\n\nاستمر في العمل الجاد! 💪`
        };
      }

      const bonus = bonusDetail[0];
      const tierNames: Record<string, string> = {
        'none': 'لم يصل للحد الأدنى',
        'tier_1': 'المستوى الأول',
        'tier_2': 'المستوى الثاني',
        'tier_3': 'المستوى الثالث',
        'tier_4': 'المستوى الرابع',
        'tier_5': 'المستوى الخامس'
      };

      return {
        success: true,
        data: bonus,
        message: `🎯 تقرير البونص الأسبوعي:\n\n💰 إيراداتك: ${Number(bonus.revenue).toLocaleString()} ر.س\n🏆 المستوى: ${tierNames[bonus.tier || 'none']}\n💵 البونص: ${Number(bonus.bonusAmount).toLocaleString()} ر.س`
      };
    }

    if (input.reportType === 'requests') {
      // تقرير الطلبات
      const requests = await db.select()
        .from(employeeRequests)
        .where(eq(employeeRequests.employeeId, input.employeeId))
        .orderBy(desc(employeeRequests.createdAt))
        .limit(5);

      if (requests.length === 0) {
        return {
          success: true,
          message: `📋 لا يوجد لديك طلبات مسجلة.`
        };
      }

      const statusNames: Record<string, string> = {
        'pending': '⏳ قيد المراجعة',
        'approved': '✅ موافق عليه',
        'rejected': '❌ مرفوض'
      };

      const typeNames: Record<string, string> = {
        'advance': 'سلفة',
        'vacation': 'إجازة',
        'arrears': 'متأخرات',
        'permission': 'استئذان',
        'objection': 'اعتراض',
        'resignation': 'استقالة'
      };

      const requestsList = requests.map((r: any) => 
        `• ${typeNames[r.type as keyof typeof typeNames] || r.type} - ${statusNames[r.status as keyof typeof statusNames] || r.status}`
      ).join('\n');

      return {
        success: true,
        data: requests,
        message: `📋 آخر طلباتك:\n\n${requestsList}`
      };
    }

    // ملخص شامل
    return {
      success: true,
      message: `👋 مرحباً ${emp.name}!\n\nأنت تعمل في فرع ${emp.branchName}.\n\nيمكنني مساعدتك في:\n• 📊 تقرير الإيرادات\n• 🎯 تقرير البونص\n• 📋 حالة الطلبات\n• 💰 حساب الأسعار والخصومات\n• 📝 رفع طلب جديد`
    };
  } catch (error) {
    return {
      success: false,
      error: `حدث خطأ: ${error}`
    };
  }
}

// ========== أداة حساب الأسعار والخصومات ==========
export interface PriceCalculationInput {
  services: string[]; // أسماء الخدمات
  discountPercent?: number; // نسبة الخصم
  isLoyaltyDiscount?: boolean; // هل هو خصم ولاء؟
}

export async function calculatePrice(input: PriceCalculationInput): Promise<ToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: 'قاعدة البيانات غير متاحة' };
    }

    // جلب قائمة المنتجات/الخدمات
    const allProducts = await db.select().from(products);
    
    let totalOriginal = 0;
    const foundServices: { name: string; price: number }[] = [];
    const notFoundServices: string[] = [];

    for (const serviceName of input.services) {
      // البحث عن الخدمة (جزئي)
      const product = allProducts.find((p: any) => 
        p.name.toLowerCase().includes(serviceName.toLowerCase()) ||
        serviceName.toLowerCase().includes(p.name.toLowerCase())
      );

      if (product) {
        foundServices.push({ name: product.name, price: Number(product.sellingPrice) });
        totalOriginal += Number(product.sellingPrice);
      } else {
        notFoundServices.push(serviceName);
      }
    }

    // حساب الخصم
    let discountPercent = input.discountPercent || 0;
    
    // إذا كان خصم ولاء، جلب النسبة من الإعدادات
    if (input.isLoyaltyDiscount) {
      const settings = await db.select().from(loyaltySettings).limit(1);
      if (settings.length > 0) {
        discountPercent = settings[0].discountPercentage;
      } else {
        discountPercent = 60; // القيمة الافتراضية
      }
    }

    const discountAmount = totalOriginal * (discountPercent / 100);
    const finalTotal = totalOriginal - discountAmount;

    let message = `💰 حساب الأسعار:\n\n`;
    
    if (foundServices.length > 0) {
      message += `📋 الخدمات:\n`;
      foundServices.forEach(s => {
        message += `• ${s.name}: ${s.price.toLocaleString()} ر.س\n`;
      });
      message += `\n`;
    }

    if (notFoundServices.length > 0) {
      message += `⚠️ خدمات غير موجودة: ${notFoundServices.join(', ')}\n\n`;
    }

    message += `━━━━━━━━━━━━\n`;
    message += `💵 المجموع الأصلي: ${totalOriginal.toLocaleString()} ر.س\n`;
    
    if (discountPercent > 0) {
      message += `🏷️ الخصم (${discountPercent}%): ${discountAmount.toLocaleString()} ر.س\n`;
      message += `✅ المبلغ المطلوب: ${finalTotal.toLocaleString()} ر.س`;
    }

    return {
      success: true,
      data: {
        services: foundServices,
        notFound: notFoundServices,
        originalTotal: totalOriginal,
        discountPercent,
        discountAmount,
        finalTotal
      },
      message
    };
  } catch (error) {
    return {
      success: false,
      error: `حدث خطأ: ${error}`
    };
  }
}

// ========== دالة مساعدة لحساب بداية الأسبوع ==========
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // الاثنين
  return new Date(d.setDate(diff));
}

// ========== تعريف الأدوات للـ LLM ==========
export const assistantTools = [
  {
    type: "function" as const,
    function: {
      name: "identify_employee",
      description: "التعرف على الموظف من خلال اسمه والحصول على معلوماته وفرعه",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "اسم الموظف للبحث عنه"
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "submit_request",
      description: "رفع طلب موظف (سلفة، إجازة، استئذان، متأخرات، اعتراض، استقالة)",
      parameters: {
        type: "object",
        properties: {
          employeeId: {
            type: "number",
            description: "رقم الموظف"
          },
          type: {
            type: "string",
            enum: ["advance", "vacation", "arrears", "permission", "objection", "resignation"],
            description: "نوع الطلب"
          },
          description: {
            type: "string",
            description: "وصف أو سبب الطلب"
          },
          amount: {
            type: "number",
            description: "المبلغ (للسلفة والمتأخرات)"
          },
          vacationStartDate: {
            type: "string",
            description: "تاريخ بداية الإجازة (YYYY-MM-DD)"
          },
          vacationEndDate: {
            type: "string",
            description: "تاريخ نهاية الإجازة (YYYY-MM-DD)"
          },
          vacationDays: {
            type: "number",
            description: "عدد أيام الإجازة"
          },
          vacationType: {
            type: "string",
            enum: ["annual", "sick", "emergency", "unpaid"],
            description: "نوع الإجازة"
          },
          permissionDate: {
            type: "string",
            description: "تاريخ الاستئذان (YYYY-MM-DD)"
          },
          permissionStartTime: {
            type: "string",
            description: "وقت بداية الاستئذان (HH:MM)"
          },
          permissionEndTime: {
            type: "string",
            description: "وقت نهاية الاستئذان (HH:MM)"
          }
        },
        required: ["employeeId", "type", "description"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_report",
      description: "الحصول على تقرير سريع (إيرادات، بونص، طلبات، ملخص)",
      parameters: {
        type: "object",
        properties: {
          employeeId: {
            type: "number",
            description: "رقم الموظف"
          },
          reportType: {
            type: "string",
            enum: ["revenue", "bonus", "requests", "summary"],
            description: "نوع التقرير"
          },
          period: {
            type: "string",
            enum: ["today", "week", "last_week", "month", "last_month"],
            description: "الفترة الزمنية: اليوم (today)، هذا الأسبوع (week)، الأسبوع الماضي (last_week)، هذا الشهر (month)، الشهر الماضي (last_month)"
          }
        },
        required: ["employeeId", "reportType"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "calculate_price",
      description: "حساب أسعار الخدمات مع الخصومات",
      parameters: {
        type: "object",
        properties: {
          services: {
            type: "array",
            items: { type: "string" },
            description: "قائمة أسماء الخدمات"
          },
          discountPercent: {
            type: "number",
            description: "نسبة الخصم (0-100)"
          },
          isLoyaltyDiscount: {
            type: "boolean",
            description: "هل هو خصم برنامج الولاء؟"
          }
        },
        required: ["services"]
      }
    }
  }
];

// ========== تنفيذ الأداة ==========
export async function executeAssistantTool(toolName: string, args: any): Promise<ToolResult> {
  switch (toolName) {
    case 'identify_employee':
      return identifyEmployee(args.name);
    
    case 'submit_request':
      return submitEmployeeRequest({
        employeeId: args.employeeId,
        type: args.type,
        description: args.description,
        amount: args.amount,
        vacationStartDate: args.vacationStartDate ? new Date(args.vacationStartDate) : undefined,
        vacationEndDate: args.vacationEndDate ? new Date(args.vacationEndDate) : undefined,
        vacationDays: args.vacationDays,
        vacationType: args.vacationType,
        permissionDate: args.permissionDate ? new Date(args.permissionDate) : undefined,
        permissionStartTime: args.permissionStartTime,
        permissionEndTime: args.permissionEndTime,
      });
    
    case 'get_report':
      return getQuickReport({
        employeeId: args.employeeId,
        reportType: args.reportType,
        period: args.period,
      });
    
    case 'calculate_price':
      return calculatePrice({
        services: args.services,
        discountPercent: args.discountPercent,
        isLoyaltyDiscount: args.isLoyaltyDiscount,
      });
    
    default:
      return {
        success: false,
        error: `أداة غير معروفة: ${toolName}`
      };
  }
}
