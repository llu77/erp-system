/**
 * أدوات مساعد AI للموظفين - النسخة المحسنة
 * 
 * مبادئ التصميم:
 * 1. الصدق المطلق - لا نختلق بيانات أبداً
 * 2. التحقق الصارم - نتحقق من وجود البيانات قبل عرضها
 * 3. الشفافية - نوضح مصدر البيانات والفترة الزمنية
 */

import { getDb } from "../db";
import { 
  employees, 
  branches, 
  employeeRequests, 
  dailyRevenues,
  employeeRevenues,
  weeklyBonuses,
  bonusDetails,
  loyaltySettings,
  products
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { 
  createConfirmationRequest, 
  handleConfirmationResponse,
  type ConfirmationRequest 
} from "./confirmationSystem";
import { cancelPendingRequest, getPendingRequests } from "./conversationMemory";

// ========== أنواع محسنة ==========
export interface ToolResult {
  success: boolean;
  hasData: boolean;        // هل توجد بيانات فعلية؟
  dataCount: number;       // عدد السجلات
  data?: any;
  error?: string;
  message: string;         // رسالة واضحة للمستخدم
  source?: string;         // مصدر البيانات
  period?: {               // الفترة الزمنية
    start: string;
    end: string;
  };
}

// دالة مساعدة لإنشاء نتيجة فارغة
function noDataResult(message: string, period?: { start: string; end: string }): ToolResult {
  return {
    success: true,
    hasData: false,
    dataCount: 0,
    message,
    period
  };
}

// دالة مساعدة لإنشاء نتيجة خطأ
function errorResult(error: string): ToolResult {
  return {
    success: false,
    hasData: false,
    dataCount: 0,
    error,
    message: error
  };
}

// ========== أداة التعرف على الموظف ==========
export async function identifyEmployee(name: string): Promise<ToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
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
        hasData: false,
        dataCount: 0,
        message: `لم أجد موظف باسم "${name}" في قاعدة البيانات. تأكد من كتابة الاسم بشكل صحيح.`,
        source: 'جدول الموظفين'
      };
    }

    if (matchedEmployees.length === 1) {
      const emp = matchedEmployees[0];
      return {
        success: true,
        hasData: true,
        dataCount: 1,
        data: emp,
        message: `تم التعرف عليك: ${emp.name}، تعمل في فرع ${emp.branchName || 'غير محدد'} كـ ${emp.position || 'موظف'}.`,
        source: 'جدول الموظفين'
      };
    }

    // أكثر من موظف بنفس الاسم
    return {
      success: true,
      hasData: true,
      dataCount: matchedEmployees.length,
      data: matchedEmployees,
      message: `وجدت ${matchedEmployees.length} موظفين بهذا الاسم:\n${matchedEmployees.map((e: any) => `- ${e.name} (${e.branchName})`).join('\n')}\n\nأي فرع تعمل فيه؟`,
      source: 'جدول الموظفين'
    };
  } catch (error) {
    return errorResult(`حدث خطأ أثناء البحث: ${error}`);
  }
}

// ========== أداة رفع طلب موظف ==========
export type RequestType = 'advance' | 'vacation' | 'arrears' | 'permission' | 'objection' | 'resignation';

export interface EmployeeRequestInput {
  employeeId: number;
  type: RequestType;
  description: string;
  amount?: number;
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
      return errorResult('قاعدة البيانات غير متاحة');
    }

    // التحقق من وجود الموظف
    const employee = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
    if (employee.length === 0) {
      return {
        success: false,
        hasData: false,
        dataCount: 0,
        message: `الموظف رقم ${input.employeeId} غير موجود في قاعدة البيانات.`,
        source: 'جدول الموظفين'
      };
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

    // إنشاء الطلب
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
      hasData: true,
      dataCount: 1,
      data: { requestId: result[0]?.insertId, requestNumber },
      message: `✅ تم رفع طلب ${typeNames[input.type]} بنجاح!\n\n📋 رقم الطلب: ${requestNumber}\n👤 الموظف: ${emp.name}\n🏢 الفرع: ${branchName}\n📝 الحالة: قيد المراجعة\n\nسيتم مراجعته من قبل المشرف وإبلاغك بالنتيجة.`,
      source: 'جدول طلبات الموظفين'
    };
  } catch (error) {
    return errorResult(`حدث خطأ أثناء رفع الطلب: ${error}`);
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
      return errorResult('قاعدة البيانات غير متاحة');
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
      return {
        success: false,
        hasData: false,
        dataCount: 0,
        message: `الموظف رقم ${input.employeeId} غير موجود في قاعدة البيانات.`,
        source: 'جدول الموظفين'
      };
    }

    const emp = employee[0];
    const now = new Date();
    
    // حساب بداية ونهاية الفترة
    let startDate: Date;
    let endDate: Date = now;
    let periodName: string;
    
    switch (input.period || 'week') {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodName = 'اليوم';
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        periodName = 'هذا الأسبوع';
        break;
      case 'last_week':
        const lastWeekDayOfWeek = now.getDay();
        const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - lastWeekDayOfWeek - 1);
        const lastWeekStart = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate() - 6);
        startDate = lastWeekStart;
        endDate = lastWeekEnd;
        periodName = 'الأسبوع الماضي';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodName = 'هذا الشهر';
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        periodName = 'الشهر الماضي';
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodName = 'آخر 7 أيام';
    }

    const periodInfo = {
      start: startDate.toLocaleDateString('ar-SA'),
      end: endDate.toLocaleDateString('ar-SA')
    };

    // ========== تقرير الإيرادات ==========
    if (input.reportType === 'revenue') {
      if (!emp.branchId) {
        return noDataResult(
          `الموظف ${emp.name} غير مرتبط بفرع محدد، لذلك لا يمكن عرض تقرير الإيرادات.`,
          periodInfo
        );
      }

      const revenues = await db.select()
        .from(dailyRevenues)
        .where(and(
          eq(dailyRevenues.branchId, emp.branchId),
          gte(dailyRevenues.date, startDate),
          lte(dailyRevenues.date, endDate)
        ));

      if (revenues.length === 0) {
        return {
          success: true,
          hasData: false,
          dataCount: 0,
          message: `📊 تقرير إيرادات فرع ${emp.branchName} (${periodName}):\n\n⚠️ لا توجد بيانات إيرادات مسجلة للفترة من ${periodInfo.start} إلى ${periodInfo.end}.\n\nقد يكون السبب:\n- لم يتم إدخال الإيرادات لهذه الفترة بعد\n- الفرع جديد ولم تبدأ عملياته`,
          source: 'جدول الإيرادات اليومية',
          period: periodInfo
        };
      }

      const totalCash = revenues.reduce((sum: number, r: any) => sum + Number(r.cash || 0), 0);
      const totalNetwork = revenues.reduce((sum: number, r: any) => sum + Number(r.network || 0), 0);
      const totalBalance = revenues.reduce((sum: number, r: any) => sum + Number(r.balance || 0), 0);
      const total = totalCash + totalNetwork + totalBalance;

      return {
        success: true,
        hasData: true,
        dataCount: revenues.length,
        data: {
          totalCash,
          totalNetwork,
          totalBalance,
          total,
          count: revenues.length
        },
        message: `📊 تقرير إيرادات فرع ${emp.branchName} (${periodName}):\n📅 من ${periodInfo.start} إلى ${periodInfo.end}\n\n💵 نقدي: ${totalCash.toLocaleString()} ر.س\n💳 شبكة: ${totalNetwork.toLocaleString()} ر.س\n🏧 رصيد: ${totalBalance.toLocaleString()} ر.س\n━━━━━━━━━━━━\n💰 الإجمالي: ${total.toLocaleString()} ر.س\n📝 عدد الأيام المسجلة: ${revenues.length}`,
        source: 'جدول الإيرادات اليومية',
        period: periodInfo
      };
    }

    // ========== تقرير البونص ==========
    if (input.reportType === 'bonus') {
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
        // البحث عن آخر بونص مسجل
        const lastBonus = await db.select({
          revenue: bonusDetails.weeklyRevenue,
          bonusAmount: bonusDetails.bonusAmount,
          tier: bonusDetails.bonusTier,
          weekStart: weeklyBonuses.weekStart,
        })
        .from(bonusDetails)
        .innerJoin(weeklyBonuses, eq(bonusDetails.weeklyBonusId, weeklyBonuses.id))
        .where(eq(bonusDetails.employeeId, input.employeeId))
        .orderBy(desc(weeklyBonuses.weekStart))
        .limit(1);

        if (lastBonus.length === 0) {
          return {
            success: true,
            hasData: false,
            dataCount: 0,
            message: `📊 تقرير البونص للموظف ${emp.name}:\n\n⚠️ لا يوجد أي بونص مسجل لك في قاعدة البيانات.\n\nقد يكون السبب:\n- لم يتم حساب البونص بعد\n- لم تصل الإيرادات للحد الأدنى المطلوب`,
            source: 'جدول تفاصيل البونص'
          };
        }

        const bonus = lastBonus[0];
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
          hasData: true,
          dataCount: 1,
          data: bonus,
          message: `📊 تقرير البونص للموظف ${emp.name}:\n\n⚠️ لا يوجد بونص مسجل لهذا الأسبوع بعد.\n\n📌 آخر بونص مسجل (${new Date(bonus.weekStart).toLocaleDateString('ar-SA')}):\n💰 الإيرادات: ${Number(bonus.revenue).toLocaleString()} ر.س\n🏆 المستوى: ${tierNames[bonus.tier || 'none']}\n💵 البونص: ${Number(bonus.bonusAmount).toLocaleString()} ر.س`,
          source: 'جدول تفاصيل البونص'
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
        hasData: true,
        dataCount: 1,
        data: bonus,
        message: `📊 تقرير البونص الأسبوعي للموظف ${emp.name}:\n\n💰 إيراداتك هذا الأسبوع: ${Number(bonus.revenue).toLocaleString()} ر.س\n🏆 المستوى: ${tierNames[bonus.tier || 'none']}\n💵 البونص المستحق: ${Number(bonus.bonusAmount).toLocaleString()} ر.س`,
        source: 'جدول تفاصيل البونص'
      };
    }

    // ========== تقرير الطلبات ==========
    if (input.reportType === 'requests') {
      const requests = await db.select()
        .from(employeeRequests)
        .where(eq(employeeRequests.employeeId, input.employeeId))
        .orderBy(desc(employeeRequests.createdAt))
        .limit(10);

      if (requests.length === 0) {
        return {
          success: true,
          hasData: false,
          dataCount: 0,
          message: `📋 سجل طلبات الموظف ${emp.name}:\n\n⚠️ لا توجد أي طلبات مسجلة لك في النظام.\n\nيمكنك تقديم طلب جديد (إجازة، سلفة، استئذان، إلخ).`,
          source: 'جدول طلبات الموظفين'
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

      const requestsList = requests.map((r: any, index: number) => {
        const typeName = typeNames[r.requestType as keyof typeof typeNames] || r.requestType;
        const statusName = statusNames[r.status as keyof typeof statusNames] || r.status;
        const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-SA') : 'غير محدد';
        return `${index + 1}. ${typeName} - ${statusName} (${date})`;
      }).join('\n');

      // حساب الإحصائيات
      const pending = requests.filter((r: any) => r.status === 'pending').length;
      const approved = requests.filter((r: any) => r.status === 'approved').length;
      const rejected = requests.filter((r: any) => r.status === 'rejected').length;

      return {
        success: true,
        hasData: true,
        dataCount: requests.length,
        data: requests,
        message: `📋 سجل طلبات الموظف ${emp.name}:\n\n📊 الإحصائيات:\n- إجمالي الطلبات: ${requests.length}\n- قيد المراجعة: ${pending}\n- موافق عليها: ${approved}\n- مرفوضة: ${rejected}\n\n📝 آخر الطلبات:\n${requestsList}`,
        source: 'جدول طلبات الموظفين'
      };
    }

    // ========== ملخص شامل ==========
    return {
      success: true,
      hasData: true,
      dataCount: 1,
      data: emp,
      message: `👋 معلومات الموظف ${emp.name}:\n\n🏢 الفرع: ${emp.branchName}\n\nيمكنني مساعدتك في:\n• 📊 تقرير الإيرادات\n• 🎯 تقرير البونص\n• 📋 سجل الطلبات\n• 💰 حساب الأسعار والخصومات\n• 📝 رفع طلب جديد`,
      source: 'جدول الموظفين'
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}

// ========== أداة حساب الأسعار والخصومات ==========
export interface PriceCalculationInput {
  services: string[];
  discountPercent?: number;
  isLoyaltyDiscount?: boolean;
}

export async function calculatePrice(input: PriceCalculationInput): Promise<ToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
    }

    // جلب قائمة المنتجات/الخدمات
    const allProducts = await db.select().from(products);
    
    if (allProducts.length === 0) {
      return {
        success: true,
        hasData: false,
        dataCount: 0,
        message: `⚠️ لا توجد منتجات أو خدمات مسجلة في قاعدة البيانات.\n\nيجب إضافة المنتجات أولاً من لوحة التحكم.`,
        source: 'جدول المنتجات'
      };
    }

    let totalOriginal = 0;
    const foundServices: { name: string; price: number }[] = [];
    const notFoundServices: string[] = [];

    for (const serviceName of input.services) {
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

    if (foundServices.length === 0) {
      return {
        success: true,
        hasData: false,
        dataCount: 0,
        message: `⚠️ لم أجد أي من الخدمات المطلوبة في قاعدة البيانات:\n${input.services.map(s => `- ${s}`).join('\n')}\n\nتأكد من كتابة أسماء الخدمات بشكل صحيح.`,
        source: 'جدول المنتجات'
      };
    }

    // حساب الخصم
    let discountPercent = input.discountPercent || 0;
    
    if (input.isLoyaltyDiscount) {
      const settings = await db.select().from(loyaltySettings).limit(1);
      if (settings.length > 0) {
        discountPercent = settings[0].discountPercentage;
      } else {
        discountPercent = 60;
      }
    }

    const discountAmount = totalOriginal * (discountPercent / 100);
    const finalTotal = totalOriginal - discountAmount;

    let message = `💰 حساب الأسعار:\n\n📋 الخدمات الموجودة:\n`;
    foundServices.forEach(s => {
      message += `• ${s.name}: ${s.price.toLocaleString()} ر.س\n`;
    });

    if (notFoundServices.length > 0) {
      message += `\n⚠️ خدمات غير موجودة في النظام:\n${notFoundServices.map(s => `• ${s}`).join('\n')}\n`;
    }

    message += `\n━━━━━━━━━━━━\n💵 المجموع الأصلي: ${totalOriginal.toLocaleString()} ر.س\n`;
    
    if (discountPercent > 0) {
      message += `🏷️ الخصم (${discountPercent}%): ${discountAmount.toLocaleString()} ر.س\n`;
      message += `✅ المبلغ المطلوب: ${finalTotal.toLocaleString()} ر.س`;
    }

    return {
      success: true,
      hasData: true,
      dataCount: foundServices.length,
      data: {
        services: foundServices,
        notFound: notFoundServices,
        originalTotal: totalOriginal,
        discountPercent,
        discountAmount,
        finalTotal
      },
      message,
      source: 'جدول المنتجات'
    };
  } catch (error) {
    return errorResult(`حدث خطأ: ${error}`);
  }
}

// ========== دالة مساعدة لحساب بداية الأسبوع ==========
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ========== دوال مساعدة للتصدير (للاختبارات) ==========
export function generateUsername(name: string): string {
  const normalized = name.toLowerCase().replace(/\s+/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 4);
  return `${normalized}${randomSuffix}`;
}

export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ========== تعريف الأدوات للـ LLM ==========
export const assistantTools = [
  {
    type: "function" as const,
    function: {
      name: "identify_employee",
      description: "التعرف على الموظف من خلال اسمه. يجب استخدام هذه الأداة أولاً قبل أي عملية أخرى.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "اسم الموظف للبحث عنه في قاعدة البيانات"
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
      description: "رفع طلب موظف (سلفة، إجازة، استئذان، متأخرات، اعتراض، استقالة). يجب التعرف على الموظف أولاً.",
      parameters: {
        type: "object",
        properties: {
          employeeId: {
            type: "number",
            description: "رقم الموظف (يتم الحصول عليه من identify_employee)"
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
            description: "المبلغ (للسلفة والمتأخرات فقط)"
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
      description: "الحصول على تقرير من قاعدة البيانات. الأداة تعيد البيانات الفعلية الموجودة فقط، وإذا لم توجد بيانات ستوضح ذلك.",
      parameters: {
        type: "object",
        properties: {
          employeeId: {
            type: "number",
            description: "رقم الموظف (يتم الحصول عليه من identify_employee)"
          },
          reportType: {
            type: "string",
            enum: ["revenue", "bonus", "requests", "summary"],
            description: "نوع التقرير: revenue (إيرادات الفرع)، bonus (بونص الموظف)، requests (طلبات الموظف)، summary (ملخص)"
          },
          period: {
            type: "string",
            enum: ["today", "week", "last_week", "month", "last_month"],
            description: "الفترة الزمنية"
          }
        },
        required: ["employeeId", "reportType"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_request",
      description: "إنشاء طلب معلق للتأكيد قبل الرفع. يجب استخدام هذه الأداة بدلاً من submit_request لإعطاء الموظف فرصة للتأكيد.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "معرف الجلسة"
          },
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
            description: "وصف الطلب"
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
        required: ["sessionId", "employeeId", "type", "description"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "confirm_request",
      description: "تأكيد وتنفيذ الطلب المعلق. يُستخدم عندما يقول الموظف 'نعم' أو 'أكد' أو 'موافق'.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "معرف الجلسة"
          },
          employeeId: {
            type: "number",
            description: "رقم الموظف"
          }
        },
        required: ["sessionId", "employeeId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "cancel_request",
      description: "إلغاء الطلب المعلق. يُستخدم عندما يقول الموظف 'لا' أو 'إلغاء' أو 'تراجع'.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "معرف الجلسة"
          }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "calculate_price",
      description: "حساب أسعار الخدمات من قاعدة البيانات مع الخصومات. يعرض فقط الخدمات الموجودة فعلياً.",
      parameters: {
        type: "object",
        properties: {
          services: {
            type: "array",
            items: { type: "string" },
            description: "قائمة أسماء الخدمات للبحث عنها"
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
  },
  {
    type: "function" as const,
    function: {
      name: "get_employee_revenue",
      description: "الحصول على تقرير إيرادات الموظف الشخصية (ليس إيرادات الفرع). يعرض إيرادات الموظف اليومية والأسبوعية والشهرية.",
      parameters: {
        type: "object",
        properties: {
          employeeId: {
            type: "number",
            description: "رقم الموظف"
          },
          period: {
            type: "string",
            enum: ["today", "week", "last_week", "month", "last_month"],
            description: "الفترة الزمنية: today (اليوم)، week (هذا الأسبوع)، last_week (الأسبوع الماضي)، month (هذا الشهر)، last_month (الشهر الماضي)"
          }
        },
        required: ["employeeId"]
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
    
    case 'prepare_request':
      return prepareRequest(args);
    
    case 'confirm_request':
      return confirmRequest(args.sessionId, args.employeeId);
    
    case 'cancel_request':
      return cancelRequest(args.sessionId);
    
    case 'get_employee_revenue':
      return getEmployeeRevenue({
        employeeId: args.employeeId,
        period: args.period,
      });
    
    default:
      return errorResult(`أداة غير معروفة: ${toolName}`);
  }
}


// ========== دوال نظام التأكيد ==========

/**
 * إنشاء طلب معلق للتأكيد
 */
async function prepareRequest(args: {
  sessionId: string;
  employeeId: number;
  type: 'advance' | 'vacation' | 'arrears' | 'permission' | 'objection' | 'resignation';
  description: string;
  amount?: number;
  vacationStartDate?: string;
  vacationEndDate?: string;
  vacationDays?: number;
  vacationType?: string;
  permissionDate?: string;
  permissionStartTime?: string;
  permissionEndTime?: string;
}): Promise<ToolResult> {
  try {
    const confirmationRequest: ConfirmationRequest = {
      sessionId: args.sessionId,
      employeeId: args.employeeId,
      requestType: args.type,
      requestData: {
        description: args.description,
        amount: args.amount,
        vacationStartDate: args.vacationStartDate,
        vacationEndDate: args.vacationEndDate,
        vacationDays: args.vacationDays,
        vacationType: args.vacationType,
        permissionDate: args.permissionDate,
        permissionStartTime: args.permissionStartTime,
        permissionEndTime: args.permissionEndTime,
      },
    };

    const result = await createConfirmationRequest(confirmationRequest);

    if (result.success) {
      return {
        success: true,
        hasData: true,
        dataCount: 1,
        data: {
          pendingRequestId: result.pendingRequestId,
          expiresAt: result.expiresAt,
        },
        message: result.message,
        source: 'نظام التأكيد',
      };
    } else {
      return errorResult(result.message);
    }
  } catch (error) {
    return errorResult(`حدث خطأ أثناء إنشاء طلب التأكيد: ${error}`);
  }
}

/**
 * تأكيد وتنفيذ الطلب المعلق
 */
async function confirmRequest(sessionId: string, employeeId: number): Promise<ToolResult> {
  try {
    const result = await handleConfirmationResponse(sessionId, employeeId, 'نعم');

    if (result.action === 'confirmed' && result.result) {
      return result.result;
    } else if (result.action === 'no_pending') {
      return {
        success: true,
        hasData: false,
        dataCount: 0,
        message: 'لا توجد طلبات معلقة للتأكيد. إذا كنت تريد رفع طلب جديد، أخبرني بالتفاصيل.',
        source: 'نظام التأكيد',
      };
    } else {
      return {
        success: false,
        hasData: false,
        dataCount: 0,
        message: result.message,
        source: 'نظام التأكيد',
      };
    }
  } catch (error) {
    return errorResult(`حدث خطأ أثناء تأكيد الطلب: ${error}`);
  }
}

/**
 * إلغاء الطلب المعلق
 */
async function cancelRequest(sessionId: string): Promise<ToolResult> {
  try {
    const pendingRequests = await getPendingRequests(sessionId);

    if (pendingRequests.length === 0) {
      return {
        success: true,
        hasData: false,
        dataCount: 0,
        message: 'لا توجد طلبات معلقة للإلغاء.',
        source: 'نظام التأكيد',
      };
    }

    // إلغاء آخر طلب معلق
    const latestRequest = pendingRequests[0];
    await cancelPendingRequest(latestRequest.id);

    const typeNames: Record<string, string> = {
      advance: 'سلفة',
      vacation: 'إجازة',
      arrears: 'صرف متأخرات',
      permission: 'استئذان',
      objection: 'اعتراض',
      resignation: 'استقالة',
    };

    const typeName = typeNames[latestRequest.requestType] || latestRequest.requestType;

    return {
      success: true,
      hasData: true,
      dataCount: 1,
      message: `❌ تم إلغاء طلب ${typeName}.\n\nإذا كنت تريد رفع طلب جديد، أخبرني بالتفاصيل.`,
      source: 'نظام التأكيد',
    };
  } catch (error) {
    return errorResult(`حدث خطأ أثناء إلغاء الطلب: ${error}`);
  }
}


// ========== أداة تقرير إيرادات الموظف الشخصية ==========
export interface EmployeeRevenueInput {
  employeeId: number;
  period?: 'today' | 'week' | 'last_week' | 'month' | 'last_month';
}

export async function getEmployeeRevenue(input: EmployeeRevenueInput): Promise<ToolResult> {
  try {
    const db = await getDb();
    if (!db) {
      return errorResult('قاعدة البيانات غير متاحة');
    }

    // جلب بيانات الموظف
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
      return {
        success: false,
        hasData: false,
        dataCount: 0,
        message: `الموظف رقم ${input.employeeId} غير موجود في قاعدة البيانات.`,
        source: 'جدول الموظفين'
      };
    }

    const emp = employee[0];
    const now = new Date();
    
    // حساب بداية ونهاية الفترة
    let startDate: Date;
    let endDate: Date = now;
    let periodName: string;
    
    switch (input.period || 'week') {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodName = 'اليوم';
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        periodName = 'هذا الأسبوع';
        break;
      case 'last_week':
        const lastWeekDayOfWeek = now.getDay();
        const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - lastWeekDayOfWeek - 1);
        const lastWeekStart = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate() - 6);
        startDate = lastWeekStart;
        endDate = lastWeekEnd;
        periodName = 'الأسبوع الماضي';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodName = 'هذا الشهر';
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        periodName = 'الشهر الماضي';
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodName = 'آخر 7 أيام';
    }

    const periodInfo = {
      start: startDate.toLocaleDateString('ar-SA'),
      end: endDate.toLocaleDateString('ar-SA')
    };

    // جلب إيرادات الموظف الشخصية من جدول employeeRevenues
    const revenues = await db.select({
      id: employeeRevenues.id,
      cash: employeeRevenues.cash,
      network: employeeRevenues.network,
      total: employeeRevenues.total,
      date: dailyRevenues.date,
    })
    .from(employeeRevenues)
    .innerJoin(dailyRevenues, eq(employeeRevenues.dailyRevenueId, dailyRevenues.id))
    .where(and(
      eq(employeeRevenues.employeeId, input.employeeId),
      gte(dailyRevenues.date, startDate),
      lte(dailyRevenues.date, endDate)
    ))
    .orderBy(desc(dailyRevenues.date));

    if (revenues.length === 0) {
      return {
        success: true,
        hasData: false,
        dataCount: 0,
        message: `📊 تقرير إيرادات الموظف ${emp.name} (${periodName}):\n\n⚠️ لا توجد إيرادات مسجلة لك في الفترة من ${periodInfo.start} إلى ${periodInfo.end}.\n\nقد يكون السبب:\n- لم يتم إدخال الإيرادات لهذه الفترة بعد\n- لم تعمل في هذه الفترة`,
        source: 'جدول إيرادات الموظفين',
        period: periodInfo
      };
    }

    // حساب الإجماليات
    const totalCash = revenues.reduce((sum: number, r: any) => sum + Number(r.cash || 0), 0);
    const totalNetwork = revenues.reduce((sum: number, r: any) => sum + Number(r.network || 0), 0);
    const totalRevenue = revenues.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
    const daysCount = revenues.length;
    const avgDaily = daysCount > 0 ? totalRevenue / daysCount : 0;

    // تفاصيل الأيام (آخر 5 أيام فقط)
    const recentDays = revenues.slice(0, 5).map((r: any) => {
      const date = new Date(r.date).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' });
      return `  • ${date}: ${Number(r.total).toLocaleString()} ر.س`;
    }).join('\n');

    return {
      success: true,
      hasData: true,
      dataCount: revenues.length,
      data: {
        totalCash,
        totalNetwork,
        totalRevenue,
        daysCount,
        avgDaily,
        revenues: revenues.slice(0, 10) // آخر 10 أيام
      },
      message: `📊 تقرير إيراداتك الشخصية (${periodName}):\n📅 من ${periodInfo.start} إلى ${periodInfo.end}\n\n💵 نقدي: ${totalCash.toLocaleString()} ر.س\n💳 شبكة: ${totalNetwork.toLocaleString()} ر.س\n━━━━━━━━━━━━\n💰 الإجمالي: ${totalRevenue.toLocaleString()} ر.س\n📝 عدد الأيام: ${daysCount}\n📈 المتوسط اليومي: ${avgDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س\n\n📋 آخر الأيام:\n${recentDays}`,
      source: 'جدول إيرادات الموظفين',
      period: periodInfo
    };
  } catch (error) {
    return errorResult(`حدث خطأ أثناء جلب تقرير الإيرادات: ${error}`);
  }
}
