import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { localLogin, createLocalUser, changePassword, resetPassword, ensureAdminExists } from "./auth/localAuth";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { sendWeeklyReport, sendLowStockAlert, sendMonthlyProfitReport } from "./email/scheduledReports";
import * as advancedNotifications from "./notifications/advancedNotificationService";
import * as reminderService from "./notifications/reminderService";
import * as emailNotifications from "./notifications/emailNotificationService";
import * as twilioService from "./notifications/twilioService";
import * as biAnalytics from "./bi/analyticsService";
import * as aiAnalytics from "./bi/aiAnalyticsService";
import * as revenueAnalytics from "./bi/revenueAnalyticsService";
import * as financialForecast from "./bi/financialForecastService";
import { createLogger, symbolAiLogger, requestsLogger, payrollLogger, bonusLogger, notificationLogger } from "./utils/logger";
import { handleDatabaseError, handleNotFoundError, handleBusinessRuleError } from "./middleware/errorMiddleware";
import * as auditService from "./audit/auditService";
import * as executiveDashboard from "./executive/executiveDashboardService";
import * as aiDecisionEngine from "./ai/aiDecisionEngine";
import * as portalNotificationService from "./services/portalNotificationService";
import * as reportAssistant from "./ai/reportAssistantService";
import * as aiToolsHub from "./ai/aiToolsHub";
import * as advancedRecommendations from "./ai/advancedRecommendationEngine";
import * as aiCommandCenter from "./ai/aiCommandCenter";
import * as smartPermissions from "./ai/smartPermissions";
import * as aiRecommendationNotifier from "./ai/aiRecommendationNotifier";
import * as aiRecommendationMonitor from "./scheduler/aiRecommendationMonitor";
import * as financialValidation from "./validation/financialValidation";

// إنشاء loggers للوحدات المختلفة
const logger = createLogger('Routers');

// إجراء للمدير فقط (كامل الصلاحيات)
const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'manager') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بهذا الإجراء' });
  }
  return next({ ctx });
});

// إجراء للمسؤول فقط
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'هذا الإجراء متاح للمسؤول فقط' });
  }
  return next({ ctx });
});

// إجراء للمشرف - إدخال فقط بدون تعديل أو حذف
const supervisorInputProcedure = protectedProcedure.use(({ ctx, next }) => {
  // المشرف والموظف يمكنهم الإدخال فقط
  const allowedRoles = ['admin', 'manager', 'employee', 'supervisor', 'viewer'];
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بهذا الإجراء' });
  }
  return next({ ctx });
});

// إجراء للتعديل والحذف - للأدمن فقط
const adminOnlyEditProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'التعديل والحذف متاح للمسؤول فقط' });
  }
  return next({ ctx });
});

// إجراء للمشرف العام - الوصول للوحات التحكم والتقارير وإدارة الطلبات
const supervisorViewProcedure = protectedProcedure.use(({ ctx, next }) => {
  // المشرف العام (viewer) والمشرف (supervisor) والمدير والمسؤول يمكنهم الوصول
  const allowedRoles = ['admin', 'manager', 'supervisor', 'viewer'];
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'هذا الإجراء متاح للمشرف العام والمدير والمسؤول فقط' });
  }
  return next({ ctx });
});

// إجراء للمشاهدة فقط (كل المستخدمين بما فيهم viewer)
const viewerProcedure = protectedProcedure.use(({ ctx, next }) => {
  // جميع المستخدمين يمكنهم المشاهدة
  return next({ ctx });
});

// إجراء للمشرفين - تعديل الأسماء والأسعار فقط (بدون حذف)
const supervisorEditProcedure = protectedProcedure.use(({ ctx, next }) => {
  // المشرف والأدمن يمكنهم تعديل الأسماء والأسعار
  const allowedRoles = ['admin', 'manager', 'supervisor'];
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'تعديل الأسماء والأسعار متاح للمشرفين والمسؤول فقط' });
  }
  return next({ ctx });
});

// دالة للتحقق من صلاحية الوصول للفرع
function checkBranchAccess(userBranchId: number | null, targetBranchId: number): boolean {
  // إذا كان المستخدم غير مرتبط بفرع محدد (كل الفروع)
  if (userBranchId === null) return true;
  // التحقق من تطابق الفرع
  return userBranchId === targetBranchId;
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    // تسجيل الدخول المحلي
    localLogin: publicProcedure
      .input(z.object({
        username: z.string().min(1, "اسم المستخدم مطلوب"),
        password: z.string().min(1, "كلمة المرور مطلوبة"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await localLogin(input.username, input.password);
        
        if (!result.success) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: result.error });
        }
        
        // إنشاء جلسة للمستخدم
        const { SignJWT } = await import('jose');
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
        
        const token = await new SignJWT({
          userId: result.user!.id,
          username: result.user!.username,
          role: result.user!.role,
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setExpirationTime('7d')
          .sign(secret);
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 أيام
        });
        
        return { success: true, user: result.user };
      }),
    
    // تغيير كلمة المرور
    changePassword: protectedProcedure
      .input(z.object({
        oldPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
        newPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await changePassword(ctx.user.id, input.oldPassword, input.newPassword);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return result;
      }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== إدارة المستخدمين ====================
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    // إنشاء مستخدم محلي جديد
    create: adminProcedure
      .input(z.object({
        username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
        password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
        name: z.string().min(1, "الاسم مطلوب"),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(['admin', 'manager', 'employee']),
        department: z.string().optional(),
        position: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createLocalUser(input);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'user',
          entityId: 0,
          details: `تم إنشاء مستخدم جديد: ${input.username}`,
        });
        return result;
      }),
    
    // إعادة تعيين كلمة المرور (للأدمن فقط)
    resetPassword: adminProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await resetPassword(input.userId, input.newPassword);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'user',
          entityId: input.userId,
          details: `تم إعادة تعيين كلمة المرور`,
        });
        return result;
      }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserById(input.id);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(['admin', 'manager', 'employee']).optional(),
        department: z.string().optional(),
        position: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateUser(id, data);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'user',
          entityId: id,
          details: `تم تحديث بيانات المستخدم`,
        });
        return { success: true, message: 'تم تحديث المستخدم بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكنك حذف حسابك الخاص' });
        }
        await db.deleteUser(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'user',
          entityId: input.id,
          details: `تم حذف المستخدم`,
        });
        return { success: true, message: 'تم حذف المستخدم بنجاح' };
      }),
  }),

  // ==================== إدارة الفئات ====================
  categories: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCategories();
    }),

    create: managerProcedure
      .input(z.object({
        name: z.string().min(1, 'اسم الفئة مطلوب'),
        description: z.string().optional(),
        parentId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createCategory(input);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'category',
          details: `تم إنشاء فئة: ${input.name}`,
        });
        return { success: true, message: 'تم إنشاء الفئة بنجاح' };
      }),

    update: managerProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        parentId: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCategory(id, data);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'category',
          entityId: id,
          details: `تم تحديث الفئة`,
        });
        return { success: true, message: 'تم تحديث الفئة بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCategory(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'category',
          entityId: input.id,
          details: `تم حذف الفئة`,
        });
        return { success: true, message: 'تم حذف الفئة بنجاح' };
      }),
  }),

  // ==================== إدارة المنتجات ====================
  products: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllProducts();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductById(input.id);
      }),

    getLowStock: protectedProcedure.query(async () => {
      return await db.getLowStockProducts();
    }),

    create: supervisorInputProcedure
      .input(z.object({
        name: z.string().min(1, 'اسم المنتج مطلوب'),
        description: z.string().optional(),
        categoryId: z.number().optional(),
        costPrice: z.string(),
        sellingPrice: z.string(),
        quantity: z.number().default(0),
        minQuantity: z.number().default(10),
        unit: z.string().default('قطعة'),
        barcode: z.string().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const sku = await db.generateProductSku();
        await db.createProduct({
          ...input,
          sku,
          createdBy: ctx.user.id,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'product',
          details: `تم إنشاء منتج: ${input.name}`,
        });
        return { success: true, message: 'تم إنشاء المنتج بنجاح', sku };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        categoryId: z.number().optional(),
        costPrice: z.string().optional(),
        sellingPrice: z.string().optional(),
        quantity: z.number().optional(),
        minQuantity: z.number().optional(),
        unit: z.string().optional(),
        barcode: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // التحقق من الصلاحيات: admin/manager أو مستخدم لديه صلاحية تعديل المنتجات
        const allowedRoles = ['admin', 'manager'];
        let hasPermission = allowedRoles.includes(ctx.user.role);
        
        // التحقق من الصلاحيات المخصصة في حقل permissions
        if (!hasPermission && ctx.user.permissions) {
          try {
            const userPermissions = typeof ctx.user.permissions === 'string' 
              ? JSON.parse(ctx.user.permissions) 
              : ctx.user.permissions;
            if (userPermissions?.products?.edit === true) {
              hasPermission = true;
            }
          } catch (e) {
            // تجاهل أخطاء التحليل
          }
        }
        
        if (!hasPermission) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بتعديل المنتجات' });
        }
        
        const { id, ...data } = input;
        const product = await db.getProductById(id);
        
        if (data.quantity !== undefined && product) {
          await db.createInventoryMovement({
            productId: id,
            type: data.quantity > product.quantity ? 'in' : data.quantity < product.quantity ? 'out' : 'adjustment',
            quantity: Math.abs(data.quantity - product.quantity),
            previousQuantity: product.quantity,
            newQuantity: data.quantity,
            notes: 'تعديل يدوي',
            createdBy: ctx.user.id,
          });
        }
        
        // تسجيل تغييرات الأسعار
        if (product) {
          // تسجيل تغيير سعر التكلفة
          if (data.costPrice && data.costPrice !== product.costPrice) {
            const oldPrice = parseFloat(product.costPrice);
            const newPrice = parseFloat(data.costPrice);
            const changePercentage = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
            
            await db.createPriceChangeLog({
              productId: id,
              productName: product.name,
              productSku: product.sku,
              priceType: 'cost',
              oldPrice: product.costPrice,
              newPrice: data.costPrice,
              changePercentage: changePercentage.toFixed(2),
              changedBy: ctx.user.id,
              changedByName: ctx.user.name || 'مستخدم',
            });
            
            // إنشاء تنبيه إذا كان التغيير كبير (أكثر من 20%)
            if (Math.abs(changePercentage) >= 20) {
              await db.createSecurityAlert({
                alertType: 'price_change',
                severity: Math.abs(changePercentage) >= 50 ? 'high' : 'medium',
                title: 'تغيير كبير في سعر التكلفة',
                message: `تم تغيير سعر تكلفة المنتج "${product.name}" بنسبة ${changePercentage.toFixed(1)}%`,
                userId: ctx.user.id,
                userName: ctx.user.name || 'مستخدم',
                entityType: 'product',
                entityId: id,
              });
            }
          }
          
          // تسجيل تغيير سعر البيع
          if (data.sellingPrice && data.sellingPrice !== product.sellingPrice) {
            const oldPrice = parseFloat(product.sellingPrice);
            const newPrice = parseFloat(data.sellingPrice);
            const changePercentage = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
            
            await db.createPriceChangeLog({
              productId: id,
              productName: product.name,
              productSku: product.sku,
              priceType: 'selling',
              oldPrice: product.sellingPrice,
              newPrice: data.sellingPrice,
              changePercentage: changePercentage.toFixed(2),
              changedBy: ctx.user.id,
              changedByName: ctx.user.name || 'مستخدم',
            });
            
            // إنشاء تنبيه إذا كان التغيير كبير (أكثر من 20%)
            if (Math.abs(changePercentage) >= 20) {
              await db.createSecurityAlert({
                alertType: 'price_change',
                severity: Math.abs(changePercentage) >= 50 ? 'high' : 'medium',
                title: 'تغيير كبير في سعر البيع',
                message: `تم تغيير سعر بيع المنتج "${product.name}" بنسبة ${changePercentage.toFixed(1)}%`,
                userId: ctx.user.id,
                userName: ctx.user.name || 'مستخدم',
                entityType: 'product',
                entityId: id,
              });
            }
          }
        }
        
        await db.updateProduct(id, data);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'product',
          entityId: id,
          details: `تم تحديث المنتج`,
        });
        return { success: true, message: 'تم تحديث المنتج بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteProduct(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'product',
          entityId: input.id,
          details: `تم حذف المنتج`,
        });
        return { success: true, message: 'تم حذف المنتج بنجاح' };
      }),

    getInventoryMovements: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductInventoryMovements(input.productId);
      }),
  }),

  // ==================== إدارة العملاء ====================
  customers: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCustomers();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerById(input.id);
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return await db.searchCustomers(input.query);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, 'اسم العميل مطلوب'),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        phone2: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        taxNumber: z.string().optional(),
        creditLimit: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const code = await db.generateCustomerCode();
        await db.createCustomer({
          ...input,
          email: input.email || null,
          code,
          createdBy: ctx.user.id,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'customer',
          details: `تم إنشاء عميل: ${input.name}`,
        });
        return { success: true, message: 'تم إنشاء العميل بنجاح', code };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        phone2: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        taxNumber: z.string().optional(),
        creditLimit: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCustomer(id, { ...data, email: data.email || null });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'customer',
          entityId: id,
          details: `تم تحديث العميل`,
        });
        return { success: true, message: 'تم تحديث العميل بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCustomer(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'customer',
          entityId: input.id,
          details: `تم حذف العميل`,
        });
        return { success: true, message: 'تم حذف العميل بنجاح' };
      }),

    getInvoices: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerInvoices(input.customerId);
      }),
  }),

  // ==================== إدارة الموردين ====================
  suppliers: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllSuppliers();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getSupplierById(input.id);
      }),

    create: managerProcedure
      .input(z.object({
        name: z.string().min(1, 'اسم المورد مطلوب'),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        phone2: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        taxNumber: z.string().optional(),
        contactPerson: z.string().optional(),
        paymentTerms: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const code = await db.generateSupplierCode();
        await db.createSupplier({
          ...input,
          email: input.email || null,
          code,
          createdBy: ctx.user.id,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'supplier',
          details: `تم إنشاء مورد: ${input.name}`,
        });
        return { success: true, message: 'تم إنشاء المورد بنجاح', code };
      }),

    update: managerProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        phone2: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        taxNumber: z.string().optional(),
        contactPerson: z.string().optional(),
        paymentTerms: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateSupplier(id, { ...data, email: data.email || null });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'supplier',
          entityId: id,
          details: `تم تحديث المورد`,
        });
        return { success: true, message: 'تم تحديث المورد بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteSupplier(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'supplier',
          entityId: input.id,
          details: `تم حذف المورد`,
        });
        return { success: true, message: 'تم حذف المورد بنجاح' };
      }),

    getPurchaseOrders: protectedProcedure
      .input(z.object({ supplierId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSupplierPurchaseOrders(input.supplierId);
      }),
  }),

  // ==================== إدارة الفواتير ====================
  invoices: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllInvoices();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const invoice = await db.getInvoiceById(input.id);
        if (!invoice) return null;
        const items = await db.getInvoiceItems(input.id);
        return { ...invoice, items };
      }),

    create: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        customerName: z.string().optional(),
        dueDate: z.date().optional(),
        taxRate: z.string().optional(),
        discountRate: z.string().optional(),
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number().optional(),
          productName: z.string(),
          productSku: z.string().optional(),
          quantity: z.number().min(1),
          unitPrice: z.string(),
          discount: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const invoiceNumber = await db.generateInvoiceNumber();
        
        // حساب المجاميع
        let subtotal = 0;
        const itemsWithTotal = input.items.map(item => {
          const itemTotal = item.quantity * parseFloat(item.unitPrice) - parseFloat(item.discount || '0');
          subtotal += itemTotal;
          return { ...item, total: itemTotal.toFixed(2) };
        });

        const taxAmount = subtotal * (parseFloat(input.taxRate || '0') / 100);
        const discountAmount = subtotal * (parseFloat(input.discountRate || '0') / 100);
        const total = subtotal + taxAmount - discountAmount;

        // إنشاء الفاتورة
        const invoiceId = await db.createInvoice({
          invoiceNumber,
          customerId: input.customerId,
          customerName: input.customerName,
          dueDate: input.dueDate,
          subtotal: subtotal.toFixed(2),
          taxRate: input.taxRate,
          taxAmount: taxAmount.toFixed(2),
          discountRate: input.discountRate,
          discountAmount: discountAmount.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          createdBy: ctx.user.id,
        });

        // إضافة عناصر الفاتورة
        for (const item of itemsWithTotal) {
          await db.createInvoiceItem({
            invoiceId: invoiceId!,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
          });

          // تحديث المخزون
          if (item.productId) {
            const product = await db.getProductById(item.productId);
            if (product) {
              const newQuantity = product.quantity - item.quantity;
              await db.updateProductQuantity(item.productId, newQuantity);
              await db.createInventoryMovement({
                productId: item.productId,
                type: 'out',
                quantity: item.quantity,
                previousQuantity: product.quantity,
                newQuantity,
                referenceType: 'invoice',
                referenceId: invoiceId!,
                createdBy: ctx.user.id,
              });

              // تنبيه نفاد المخزون
              if (newQuantity <= product.minQuantity) {
                await db.createNotification({
                  type: 'low_stock',
                  title: 'تنبيه نفاد المخزون',
                  message: `المنتج "${product.name}" وصل للحد الأدنى من المخزون (${newQuantity} ${product.unit})`,
                  relatedId: item.productId,
                  relatedType: 'product',
                });
                // إشعار المالك
                await notifyOwner({
                  title: 'تنبيه نفاد المخزون',
                  content: `المنتج "${product.name}" وصل للحد الأدنى من المخزون (${newQuantity} ${product.unit})`,
                });
              }
            }
          }
        }

        // تنبيه المبيعات الكبيرة
        if (total >= 10000) {
          await db.createNotification({
            type: 'large_sale',
            title: 'مبيعة كبيرة',
            message: `تم إنشاء فاتورة بقيمة ${total.toFixed(2)} ر.س`,
            relatedId: invoiceId!,
            relatedType: 'invoice',
          });
          await notifyOwner({
            title: 'مبيعة كبيرة',
            content: `تم إنشاء فاتورة رقم ${invoiceNumber} بقيمة ${total.toFixed(2)} ر.س`,
          });
        }

        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'invoice',
          entityId: invoiceId!,
          details: `تم إنشاء فاتورة: ${invoiceNumber}`,
        });

        return { success: true, message: 'تم إنشاء الفاتورة بنجاح', invoiceNumber, invoiceId };
      }),

    // تعديل حالة الفاتورة - للأدمن فقط
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['draft', 'pending', 'paid', 'partial', 'cancelled']),
        paidAmount: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateInvoice(input.id, {
          status: input.status,
          paidAmount: input.paidAmount,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'invoice',
          entityId: input.id,
          details: `تم تحديث حالة الفاتورة إلى: ${input.status}`,
        });
        return { success: true, message: 'تم تحديث حالة الفاتورة بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteInvoice(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'invoice',
          entityId: input.id,
          details: `تم حذف الفاتورة`,
        });
        return { success: true, message: 'تم حذف الفاتورة بنجاح' };
      }),

    getByDateRange: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getInvoicesByDateRange(input.startDate, input.endDate);
      }),
  }),

  // ==================== فواتير الموظفين (سالب ومبيعات) ====================
  employeeInvoices: router({
    // قائمة الفواتير
    list: protectedProcedure
      .input(z.object({
        type: z.enum(['negative', 'sales']).optional(),
        branchId: z.number().optional(),
        employeeId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const filters: any = {};
        if (input?.type) filters.type = input.type;
        if (input?.branchId) filters.branchId = input.branchId;
        if (input?.employeeId) filters.employeeId = input.employeeId;
        if (input?.startDate) filters.startDate = new Date(input.startDate);
        if (input?.endDate) filters.endDate = new Date(input.endDate);
        
        // المشرف يرى فواتير فرعه فقط
        if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
          filters.branchId = ctx.user.branchId;
        }
        
        return await db.getAllEmployeeInvoices(filters);
      }),

    // الحصول على فاتورة بالمعرف
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmployeeInvoiceById(input.id);
      }),

    // إنشاء فاتورة جديدة
    create: supervisorInputProcedure
      .input(z.object({
        type: z.enum(['negative', 'sales']),
        employeeId: z.number(),
        employeeName: z.string(),
        branchId: z.number(),
        branchName: z.string().optional(),
        amount: z.string(),
        customerPhone: z.string().optional(),
        customerName: z.string().optional(),
        notes: z.string().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createEmployeeInvoice({
          ...input,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || 'مستخدم',
        });
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'invoice',
          entityId: result.invoiceId,
          details: `تم إنشاء فاتورة ${input.type === 'negative' ? 'سالب' : 'مبيعات'}: ${result.invoiceNumber} - ${input.employeeName}`,
        });
        
        return result;
      }),

    // حذف فاتورة (للأدمن فقط)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteEmployeeInvoice(input.id, {
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
        });
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'invoice',
          entityId: input.id,
          details: `تم حذف فاتورة موظف`,
        });
        
        return { success: true, message: 'تم حذف الفاتورة بنجاح' };
      }),

    // إحصائيات الفواتير
    stats: supervisorViewProcedure
      .input(z.object({
        branchId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        let branchId = input?.branchId;
        
        // المشرف يرى إحصائيات فرعه فقط
        if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
          branchId = ctx.user.branchId;
        }
        
        return await db.getEmployeeInvoicesStats(
          branchId,
          input?.startDate ? new Date(input.startDate) : undefined,
          input?.endDate ? new Date(input.endDate) : undefined
        );
      }),
  }),

  // ==================== إدارة أوامر الشراء ====================
  purchaseOrders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orders = await db.getAllPurchaseOrders();
      // المشرف يرى طلبات فرعه فقط
      if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
        return orders.filter(order => order.branchId === ctx.user.branchId || order.createdBy === ctx.user.id);
      }
      return orders;
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getPurchaseOrderById(input.id);
        if (!order) return null;
        const items = await db.getPurchaseOrderItems(input.id);
        return { ...order, items };
      }),

    create: supervisorInputProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        supplierName: z.string().optional(),
        expectedDate: z.date().optional(),
        taxRate: z.string().optional(),
        shippingCost: z.string().optional(),
        notes: z.string().optional(),
        branchId: z.number().optional(),
        items: z.array(z.object({
          productId: z.number().optional(),
          productName: z.string(),
          productSku: z.string().optional(),
          quantity: z.number().min(1),
          unitCost: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        // المشرف يمكنه إنشاء طلبات لفرعه فقط
        let branchId = input.branchId;
        if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
          branchId = ctx.user.branchId;
        }
        
        const orderNumber = await db.generatePurchaseOrderNumber();
        
        // حساب المجاميع
        let subtotal = 0;
        const itemsWithTotal = input.items.map(item => {
          const itemTotal = item.quantity * parseFloat(item.unitCost);
          subtotal += itemTotal;
          return { ...item, total: itemTotal.toFixed(2) };
        });

        const taxAmount = subtotal * (parseFloat(input.taxRate || '0') / 100);
        const shippingCost = parseFloat(input.shippingCost || '0');
        const total = subtotal + taxAmount + shippingCost;

        // إنشاء أمر الشراء
        const orderId = await db.createPurchaseOrder({
          orderNumber,
          supplierId: input.supplierId,
          supplierName: input.supplierName,
          branchId: branchId,
          expectedDate: input.expectedDate,
          subtotal: subtotal.toFixed(2),
          taxRate: input.taxRate,
          taxAmount: taxAmount.toFixed(2),
          shippingCost: input.shippingCost,
          total: total.toFixed(2),
          notes: input.notes,
          createdBy: ctx.user.id,
        });

        // إضافة عناصر أمر الشراء
        for (const item of itemsWithTotal) {
          await db.createPurchaseOrderItem({
            purchaseOrderId: orderId!,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.total,
          });
        }

        // إشعار أمر شراء جديد
        await db.createNotification({
          type: 'new_order',
          title: 'أمر شراء جديد',
          message: `تم إنشاء أمر شراء جديد رقم ${orderNumber} بقيمة ${total.toFixed(2)} ر.س`,
          relatedId: orderId!,
          relatedType: 'purchase_order',
        });
        await notifyOwner({
          title: 'أمر شراء جديد',
          content: `تم إنشاء أمر شراء جديد رقم ${orderNumber} بقيمة ${total.toFixed(2)} ر.س`,
        });

        // إرسال إشعار بريد إلكتروني لأمر الشراء
        const branch = branchId ? await db.getBranchById(branchId) : null;
        emailNotifications.notifyNewPurchaseOrder({
          orderNumber,
          supplierName: input.supplierName,
          totalAmount: total,
          itemsCount: input.items.length,
          branchId: branchId,
          branchName: branch?.nameAr,
          createdBy: ctx.user.name || 'مستخدم',
          items: input.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            price: parseFloat(item.unitCost),
          })),
        }).catch(err => notificationLogger.error('خطأ في إرسال إشعار أمر الشراء', err));

        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'purchase_order',
          entityId: orderId!,
          details: `تم إنشاء أمر شراء: ${orderNumber}`,
        });

        return { success: true, message: 'تم إنشاء أمر الشراء بنجاح', orderNumber, orderId };
      }),

    updateStatus: managerProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['draft', 'pending', 'approved', 'received', 'partial', 'cancelled']),
        paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
        paidAmount: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getPurchaseOrderById(input.id);
        
        // إذا تم استلام الطلب، تحديث المخزون
        if (input.status === 'received' && order && order.status !== 'received') {
          const items = await db.getPurchaseOrderItems(input.id);
          for (const item of items) {
            if (item.productId) {
              const product = await db.getProductById(item.productId);
              if (product) {
                const newQuantity = product.quantity + item.quantity;
                await db.updateProductQuantity(item.productId, newQuantity);
                await db.createInventoryMovement({
                  productId: item.productId,
                  type: 'in',
                  quantity: item.quantity,
                  previousQuantity: product.quantity,
                  newQuantity,
                  referenceType: 'purchase_order',
                  referenceId: input.id,
                  createdBy: ctx.user.id,
                });
              }
            }
          }
        }

        await db.updatePurchaseOrder(input.id, {
          status: input.status,
          paymentStatus: input.paymentStatus,
          paidAmount: input.paidAmount,
          receivedDate: input.status === 'received' ? new Date() : undefined,
        });

        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'purchase_order',
          entityId: input.id,
          details: `تم تحديث حالة أمر الشراء إلى: ${input.status}`,
        });

        return { success: true, message: 'تم تحديث حالة أمر الشراء بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        // جلب بيانات أمر الشراء قبل الحذف
        const orderData = await db.getPurchaseOrderById(input.id);
        const orderItems = await db.getPurchaseOrderItems(input.id);
        
        // تسجيل البيانات المحذوفة
        await db.createDeletedRecord({
          deletedByUserId: ctx.user.id,
          deletedByUserName: ctx.user.name || 'مستخدم',
          entityType: 'purchase_order',
          originalId: input.id,
          originalData: JSON.stringify({ order: orderData, items: orderItems }),
          reason: input.reason,
          branchId: orderData?.branchId || null,
        });
        
        await db.deletePurchaseOrder(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'purchase_order',
          entityId: input.id,
          details: `تم حذف أمر الشراء ${orderData?.orderNumber || ''}`,
        });
        return { success: true, message: 'تم حذف أمر الشراء بنجاح' };
      }),
  }),

  // ==================== الإشعارات ====================
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAllNotifications(ctx.user.id);
    }),

    unread: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadNotifications(ctx.user.id);
    }),

    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationAsRead(input.id);
        return { success: true };
      }),

    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsAsRead(ctx.user.id);
      return { success: true };
    }),

    // إرسال إشعار مخصص (للمدير والمسؤول فقط)
    sendCustom: managerProcedure
      .input(z.object({
        title: z.string().min(1, 'عنوان الإشعار مطلوب'),
        message: z.string().min(1, 'نص الإشعار مطلوب'),
        userId: z.number().optional(), // إذا لم يحدد، يرسل للجميع
        type: z.enum(['low_stock', 'new_order', 'large_sale', 'payment_due', 'system']).default('system'),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createNotification({
          userId: input.userId || null,
          type: input.type,
          title: input.title,
          message: input.message,
        });
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'notification',
          details: `تم إرسال إشعار مخصص: ${input.title}`,
        });

        // إرسال إشعار للمالك أيضاً
        await notifyOwner({
          title: input.title,
          content: input.message,
        });

        return { success: true, message: 'تم إرسال الإشعار بنجاح' };
      }),

    // حذف إشعار
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteNotification(input.id);
        return { success: true, message: 'تم حذف الإشعار بنجاح' };
      }),

    // فحص وإرسال تذكيرات الإيرادات غير المسجلة
    checkMissingRevenues: adminProcedure.mutation(async () => {
      const result = await reminderService.checkAndSendMissingRevenueReminders();
      return {
        success: result.errors.length === 0,
        message: `تم فحص ${result.checked} فرع، ${result.missing} فرع لم يسجل إيراد، تم إرسال ${result.sent} تذكير`,
        data: result,
      };
    }),

    // إرسال رسائل ترحيبية لجميع المستلمين
    sendWelcomeMessages: adminProcedure.mutation(async () => {
      const result = await reminderService.sendWelcomeMessagesToAll();
      return {
        success: result.errors.length === 0,
        message: `تم إرسال ${result.sent} رسالة ترحيبية من أصل ${result.total}`,
        data: result,
      };
    }),

    // إرسال رسالة ترحيبية لمستلم محدد
    sendWelcomeToRecipient: adminProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string(),
        role: z.string(),
        branchName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await reminderService.sendWelcomeMessage(input);
        return {
          success: result.success,
          message: result.success ? `تم إرسال رسالة ترحيبية إلى ${input.email}` : `فشل الإرسال: ${result.error}`,
        };
      }),

    // إرسال تذكيرات الوثائق للموظفين
    sendDocumentReminders: adminProcedure.mutation(async () => {
      const { sendDocumentReminders } = await import('./notifications/scheduledNotificationService');
      const result = await sendDocumentReminders();
      return {
        success: result.success,
        message: result.success 
          ? `تم إرسال ${result.sentCount} تذكير` 
          : `فشل: ${result.reason}`,
        data: result,
      };
    }),

    // إرسال تذكير لموظف محدد
    sendDocumentReminderToEmployee: adminProcedure
      .input(z.object({ employeeId: z.number() }))
      .mutation(async ({ input }) => {
        const { sendDocumentReminderToEmployee } = await import('./notifications/scheduledNotificationService');
        const result = await sendDocumentReminderToEmployee(input.employeeId);
        return {
          success: result.success,
          message: result.success ? 'تم إرسال التذكير بنجاح' : `فشل: ${result.error}`,
        };
      }),

    // إرسال رسالة SMS مخصصة
    sendSMS: adminProcedure
      .input(z.object({
        to: z.string().min(9, 'رقم الهاتف مطلوب'),
        body: z.string().min(1, 'نص الرسالة مطلوب'),
      }))
      .mutation(async ({ input }) => {
        const result = await twilioService.sendSMS(input);
        return {
          success: result.success,
          message: result.success ? 'تم إرسال الرسالة بنجاح' : `فشل: ${result.error}`,
          data: result,
        };
      }),

    // إرسال رسالة WhatsApp مخصصة
    sendWhatsApp: adminProcedure
      .input(z.object({
        to: z.string().min(9, 'رقم الهاتف مطلوب'),
        body: z.string().min(1, 'نص الرسالة مطلوب'),
      }))
      .mutation(async ({ input }) => {
        const result = await twilioService.sendWhatsApp(input);
        return {
          success: result.success,
          message: result.success ? 'تم إرسال رسالة WhatsApp بنجاح' : `فشل: ${result.error}`,
          data: result,
        };
      }),

    // إرسال تذكير الوثائق عبر SMS لموظف محدد
    sendDocumentReminderSMS: adminProcedure
      .input(z.object({ employeeId: z.number() }))
      .mutation(async ({ input }) => {
        const employee = await db.getEmployeeById(input.employeeId);
        if (!employee) {
          return { success: false, message: 'الموظف غير موجود' };
        }
        if (!employee.phone) {
          return { success: false, message: 'لا يوجد رقم هاتف للموظف' };
        }
        
        const missingDocs: string[] = [];
        const docInfo = await db.getEmployeeDocumentInfo(input.employeeId);
        if (!docInfo?.iqamaNumber) missingDocs.push('رقم الإقامة');
        if (!docInfo?.iqamaExpiryDate) missingDocs.push('تاريخ انتهاء الإقامة');
        if (!docInfo?.healthCertExpiryDate) missingDocs.push('تاريخ انتهاء الشهادة الصحية');
        if (!docInfo?.contractExpiryDate) missingDocs.push('تاريخ انتهاء عقد العمل');
        
        if (missingDocs.length === 0) {
          return { success: false, message: 'الموظف أكمل جميع وثائقه' };
        }
        
        const result = await twilioService.sendDocumentReminderSMS(
          employee.phone,
          employee.name,
          missingDocs
        );
        
        return {
          success: result.success,
          message: result.success ? 'تم إرسال التذكير عبر SMS بنجاح' : `فشل: ${result.error}`,
        };
      }),
  }),

  // ==================== لوحة التحكم والتقارير ====================
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({ branchId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        // المشرفون يرون بيانات فرعهم فقط
        let branchId = input?.branchId;
        if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
          branchId = ctx.user.branchId;
        }
        return await db.getDashboardStats(branchId);
      }),

    activityLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return await db.getActivityLogs(input?.limit || 50);
      }),
  }),

  reports: router({
    sales: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getSalesReport(input.startDate, input.endDate);
      }),

    purchases: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getPurchasesReport(input.startDate, input.endDate);
      }),

    inventory: protectedProcedure.query(async () => {
      return await db.getInventoryReport();
    }),

    // الطلبات الموافق عليها
    approvedRequests: managerProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getApprovedEmployeeRequests(input?.startDate, input?.endDate);
      }),

    // تقرير أمر شراء PDF
    purchaseOrderPdf: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getPurchaseOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'لم يتم العثور على أمر الشراء' });
        }
        const items = await db.getPurchaseOrderItems(input.orderId);
        return { order, items };
      }),

    // تقرير الجرد PDF
    inventoryCountPdf: protectedProcedure
      .input(z.object({ countId: z.number() }))
      .query(async ({ input }) => {
        const { getInventoryCountById, getInventoryCountItems } = await import('./db');
        const count = await getInventoryCountById(input.countId);
        if (!count) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'لم يتم العثور على عملية الجرد' });
        }
        const items = await getInventoryCountItems(input.countId);
        return { count, items };
      }),

    // قائمة أوامر الشراء للتقارير
    purchaseOrdersList: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        let orders = await db.getAllPurchaseOrders();
        
        // المشرف يرى طلبات فرعه فقط
        if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
          orders = orders.filter(order => order.branchId === ctx.user.branchId || order.createdBy === ctx.user.id);
        }
        
        // تصفية حسب التاريخ
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          orders = orders.filter(order => new Date(order.orderDate) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          orders = orders.filter(order => new Date(order.orderDate) <= endDate);
        }
        
        // تصفية حسب الحالة
        if (input.status) {
          orders = orders.filter(order => order.status === input.status);
        }
        
        return orders;
      }),

    // قائمة عمليات الجرد للتقارير
    inventoryCountsList: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getAllInventoryCounts } = await import('./db');
        let counts = await getAllInventoryCounts();
        
        // تصفية حسب التاريخ
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          counts = counts.filter(count => new Date(count.countDate) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          counts = counts.filter(count => new Date(count.countDate) <= endDate);
        }
        
        // تصفية حسب الحالة
        if (input.status) {
          counts = counts.filter(count => count.status === input.status);
        }
        
        return counts;
      }),
  }),

  // ==================== إدارة الفروع ====================
  branches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const branches = await db.getBranches();
      // المشرف يرى فرعه فقط
      if ((ctx.user.role === 'supervisor' || ctx.user.role === 'viewer') && ctx.user.branchId) {
        return branches.filter(b => b.id === ctx.user.branchId);
      }
      return branches;
    }),

    create: adminProcedure
      .input(z.object({
        code: z.string().min(1),
        nameAr: z.string().min(1),
        nameEn: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createBranch({
          code: input.code,
          name: input.nameEn || input.nameAr,
          nameAr: input.nameAr,
          address: input.address,
          phone: input.phone,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'branch',
          details: `تم إنشاء فرع: ${input.nameAr}`,
        });
        return { success: true, message: 'تم إنشاء الفرع بنجاح' };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().min(1),
        nameAr: z.string().min(1),
        nameEn: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateBranch(input.id, {
          code: input.code,
          name: input.nameEn || input.nameAr,
          nameAr: input.nameAr,
          address: input.address || null,
          phone: input.phone || null,
          isActive: input.isActive ?? true,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'branch',
          details: `تم تحديث فرع: ${input.nameAr}`,
        });
        return { success: true, message: 'تم تحديث الفرع بنجاح' };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteBranch(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'branch',
          details: `تم حذف فرع رقم: ${input.id}`,
        });
        return { success: true, message: 'تم حذف الفرع بنجاح' };
      }),
  }),

  // ==================== إدارة الموظفين (للبونص) ====================
  employees: router({
    list: protectedProcedure
      .input(z.object({ branchId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.branchId) {
          return await db.getEmployeesByBranch(input.branchId);
        }
        return await db.getAllEmployees();
      }),

    listByBranch: protectedProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmployeesByBranch(input.branchId);
      }),

    create: managerProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        branchId: z.number().optional(),
        phone: z.string().optional(),
        position: z.string().optional(),
        isActive: z.boolean().optional(),
        iqamaNumber: z.string().optional(),
        iqamaExpiryDate: z.date().optional(),
        healthCertExpiryDate: z.date().optional(),
        contractExpiryDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createEmployee({
          code: input.code,
          name: input.name,
          branchId: input.branchId || 0,
          phone: input.phone,
          position: input.position,
          iqamaNumber: input.iqamaNumber,
          iqamaExpiryDate: input.iqamaExpiryDate,
          healthCertExpiryDate: input.healthCertExpiryDate,
          contractExpiryDate: input.contractExpiryDate,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'employee',
          details: `تم إنشاء موظف: ${input.name}`,
        });
        return { success: true, message: 'تم إنشاء الموظف بنجاح' };
      }),

    // تحديث موظف (متاح للمشرفين والأدمن)
    update: supervisorEditProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().min(1),
        name: z.string().min(1),
        branchId: z.number().optional(),
        phone: z.string().optional(),
        position: z.string().optional(),
        isActive: z.boolean().optional(),
        iqamaNumber: z.string().optional(),
        iqamaExpiryDate: z.date().optional(),
        healthCertExpiryDate: z.date().optional(),
        contractExpiryDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateEmployee(input.id, {
          code: input.code,
          name: input.name,
          branchId: input.branchId || 0,
          phone: input.phone || null,
          position: input.position || null,
          isActive: input.isActive ?? true,
          iqamaNumber: input.iqamaNumber || null,
          iqamaExpiryDate: input.iqamaExpiryDate || null,
          healthCertExpiryDate: input.healthCertExpiryDate || null,
          contractExpiryDate: input.contractExpiryDate || null,
        });
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'employee',
          details: `تم تحديث موظف: ${input.name}`,
        });
        return { success: true, message: 'تم تحديث الموظف بنجاح' };
      }),

    delete: managerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteEmployee(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'employee',
          details: `تم حذف موظف رقم: ${input.id}`,
        });
        return { success: true, message: 'تم حذف الموظف بنجاح' };
      }),
    // الحصول على الموظفين ذوي الوثائق المنتهية أو قريبة الانتهاء
    getExpiringDocuments: protectedProcedure
      .query(async () => {
        return await db.getEmployeesWithExpiringDocuments();
      }),
    
    // تحديث معلومات الموظف (للأدمن فقط)
    updateEmployeeInfo: adminProcedure
      .input(z.object({
        employeeId: z.number(),
        iqamaNumber: z.string().optional(),
        iqamaExpiryDate: z.date().nullable().optional(),
        healthCertExpiryDate: z.date().nullable().optional(),
        contractExpiryDate: z.date().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { employeeId, ...data } = input;
        const result = await db.updateEmployeeInfoByAdmin(employeeId, ctx.user.id, data);
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'فشل في تحديث المعلومات' });
        }
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'employee_info',
          details: `تم تحديث معلومات الموظف رقم ${employeeId}`,
        });
        return { success: true, message: 'تم تحديث المعلومات بنجاح' };
      }),

    // رفع صورة وثيقة
    uploadDocumentImage: managerProcedure
      .input(z.object({
        employeeId: z.number(),
        documentType: z.enum(['iqama', 'healthCert', 'contract']),
        base64Data: z.string(),
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import('./storage');
        
        const base64Content = input.base64Data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');
        
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `employee-documents/${input.employeeId}/${input.documentType}-${timestamp}-${randomSuffix}-${input.fileName}`;
        
        const { url, key } = await storagePut(fileKey, buffer, input.contentType);
        
        // حفظ رابط الصورة في قاعدة البيانات
        await db.updateEmployeeDocumentImage(input.employeeId, input.documentType, url);
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'employee_document',
          details: `تم رفع صورة ${input.documentType} للموظف رقم ${input.employeeId}`,
        });
        
        return { success: true, url, key };
      }),

    // تقرير الموظفين بدون وثائق
    getWithoutDocuments: protectedProcedure
      .query(async () => {
        return await db.getEmployeesWithoutDocuments();
      }),

    // إحصائيات الوثائق
    getDocumentStatistics: protectedProcedure
      .query(async () => {
        return await db.getDocumentStatistics();
      }),
  }),
  // ==================== إدارة الإيرادات ====================
  revenues: router({
    // رفع صورة الموازنة إلى S3
    uploadBalanceImage: supervisorInputProcedure
      .input(z.object({
        base64Data: z.string(),
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import('./storage');
        
        // تحويل base64 إلى Buffer
        const base64Content = input.base64Data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');
        
        // إنشاء مفتاح فريد للصورة
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `balance-images/${ctx.user.id}/${timestamp}-${randomSuffix}-${input.fileName}`;
        
        const { url, key } = await storagePut(fileKey, buffer, input.contentType);
        
        return { success: true, url, key };
      }),

    // المشرف يمكنه إدخال الإيرادات فقط
    createDaily: supervisorInputProcedure
      .input(z.object({
        branchId: z.number(),
        date: z.string(),
        cash: z.string(),
        network: z.string(),
        balance: z.string(),
        paidInvoices: z.string().optional(),
        paidInvoicesNote: z.string().optional(),
        paidInvoicesCustomer: z.string().optional(), // اسم العميل لفواتير المدفوع
        loyalty: z.string().optional(), // مبلغ الولاء
        loyaltyInvoiceImage: z.object({
          url: z.string(),
          key: z.string(),
          uploadedAt: z.string(),
        }).nullable().optional(), // صورة فاتورة الولاء
        total: z.string(),
        isMatched: z.boolean(),
        unmatchReason: z.string().optional(),
        balanceImages: z.array(z.object({
          url: z.string(),
          key: z.string(),
          uploadedAt: z.string(),
        })).optional(),
        imageVerificationNote: z.string().optional(),
        employeeRevenues: z.array(z.object({
          employeeId: z.number(),
          cash: z.string(),
          network: z.string(),
          total: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        // التحقق من صلاحية الوصول للفرع للمشرفين
        if (ctx.user.role === 'supervisor' && ctx.user.branchId !== null && ctx.user.branchId !== input.branchId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك إدخال إيرادات لفرع آخر' });
        }

        // ==================== التحقق من صحة البيانات المالية ====================
        // التحقق من صحة مبلغ الكاش
        const cashValidation = financialValidation.validateAmount(input.cash, {
          fieldName: 'الكاش',
          allowZero: true,
        });
        if (!cashValidation.success) {
          financialValidation.throwValidationError(cashValidation.errors);
        }

        // التحقق من صحة مبلغ الشبكة
        const networkValidation = financialValidation.validateAmount(input.network, {
          fieldName: 'الشبكة',
          allowZero: true,
        });
        if (!networkValidation.success) {
          financialValidation.throwValidationError(networkValidation.errors);
        }

        // التحقق من صحة التاريخ
        const dateValidation = financialValidation.validateDate(input.date, {
          fieldName: 'تاريخ الإيراد',
          allowFuture: false,
          maxDaysInPast: 30, // السماح بإدخال إيرادات حتى 30 يوم في الماضي
        });
        if (!dateValidation.success) {
          financialValidation.throwValidationError(dateValidation.errors);
        }

        // التحقق من صحة فواتير المدفوع (إذا موجودة)
        if (input.paidInvoices && input.paidInvoices !== '0' && input.paidInvoices !== '') {
          const paidInvoicesValidation = financialValidation.validateAmount(input.paidInvoices, {
            fieldName: 'فواتير المدفوع',
            allowZero: false,
          });
          if (!paidInvoicesValidation.success) {
            financialValidation.throwValidationError(paidInvoicesValidation.errors);
          }

          // التحقق من وجود اسم العميل عند إدخال فواتير مدفوع
          if (!input.paidInvoicesCustomer || input.paidInvoicesCustomer.trim() === '') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'يجب اختيار اسم العميل عند إدخال فواتير مدفوع',
            });
          }
        }

        // التحقق من صحة الولاء (إذا موجود)
        if (input.loyalty && input.loyalty !== '0' && input.loyalty !== '') {
          const loyaltyValidation = financialValidation.validateAmount(input.loyalty, {
            fieldName: 'الولاء',
            allowZero: false,
          });
          if (!loyaltyValidation.success) {
            financialValidation.throwValidationError(loyaltyValidation.errors);
          }

          // التحقق من وجود صورة فاتورة الولاء عند إدخال مبلغ ولاء
          if (!input.loyaltyInvoiceImage || !input.loyaltyInvoiceImage.url) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'يجب رفع صورة فاتورة الولاء عند إدخال مبلغ ولاء',
            });
          }
        }

        // التحقق من صحة إيرادات الموظفين
        for (const empRev of input.employeeRevenues) {
          const empCashValidation = financialValidation.validateAmount(empRev.cash, {
            fieldName: `كاش الموظف ${empRev.employeeId}`,
            allowZero: true,
          });
          if (!empCashValidation.success) {
            financialValidation.throwValidationError(empCashValidation.errors);
          }

          const empNetworkValidation = financialValidation.validateAmount(empRev.network, {
            fieldName: `شبكة الموظف ${empRev.employeeId}`,
            allowZero: true,
          });
          if (!empNetworkValidation.success) {
            financialValidation.throwValidationError(empNetworkValidation.errors);
          }
        }
        // ==================== نهاية التحقق ====================

        const date = new Date(input.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        // 1. التحقق من عدم وجود إيراد لنفس اليوم (منع التكرار)
        const existingRevenue = await db.getDailyRevenueByDate(input.branchId, new Date(input.date));
        if (existingRevenue) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'يوجد إيراد بالفعل لهذا اليوم. فقط المسؤول يمكنه التعديل أو الحذف.' 
          });
        }

        // 2. حساب الرصيد والإجمالي
        const networkAmount = parseFloat(input.network);
        const cashAmount = parseFloat(input.cash);
        const paidInvoicesAmount = parseFloat(input.paidInvoices || '0');
        const calculatedBalance = networkAmount;
        const loyaltyAmount = parseFloat(input.loyalty || '0');
        // الإجمالي = الكاش + الشبكة + فواتير المدفوع + الولاء
        const calculatedTotal = cashAmount + networkAmount + paidInvoicesAmount + loyaltyAmount;

        // 3. المطابقة التلقائية: التحقق من أن مجموع إيرادات الموظفين = (النقدي + الشبكة)
        let totalEmployeeCash = 0;
        let totalEmployeeNetwork = 0;
        for (const empRev of input.employeeRevenues) {
          totalEmployeeCash += parseFloat(empRev.cash);
          totalEmployeeNetwork += parseFloat(empRev.network);
        }
        const totalEmployeeAmount = totalEmployeeCash + totalEmployeeNetwork;
        const expectedAmount = cashAmount + networkAmount;
        const isMatched = Math.abs(totalEmployeeAmount - expectedAmount) < 0.01;

        let unmatchReason = '';
        if (!isMatched) {
          if (!input.unmatchReason || input.unmatchReason.trim() === '') {
            throw new TRPCError({ 
              code: 'BAD_REQUEST', 
              message: `عدم تطابق: إيرادات الموظفين (${totalEmployeeAmount.toFixed(2)}) != (النقدي + الشبكة = ${expectedAmount.toFixed(2)}). يجب تقديم سبب العدم التطابق.` 
            });
          }
          unmatchReason = input.unmatchReason;
        }

        // الحصول على أو إنشاء سجل شهري
        let monthlyRecord = await db.getMonthlyRecord(input.branchId, year, month);
        if (!monthlyRecord) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          await db.createMonthlyRecord({
            branchId: input.branchId,
            year,
            month,
            startDate,
            endDate,
            status: "active",
          });
          monthlyRecord = await db.getMonthlyRecord(input.branchId, year, month);
        }

        if (!monthlyRecord) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل إنشاء السجل الشهري' });
        }

        // إنشاء الإيراد اليومي باستخدام القيم المحسوبة تلقائياً
        const result = await db.createDailyRevenue({
          monthlyRecordId: monthlyRecord.id,
          branchId: input.branchId,
          date: new Date(input.date),
          cash: input.cash,
          network: input.network,
          balance: calculatedBalance.toString(), // الرصيد = الشبكة تلقائياً
          paidInvoices: paidInvoicesAmount.toString(), // فواتير المدفوع
          paidInvoicesNote: input.paidInvoicesNote || null, // سبب فواتير المدفوع
          paidInvoicesCustomer: input.paidInvoicesCustomer || null, // اسم العميل
          loyalty: input.loyalty || '0', // مبلغ الولاء
          loyaltyInvoiceImage: input.loyaltyInvoiceImage || null, // صورة فاتورة الولاء
          total: calculatedTotal.toString(), // الإجمالي = الكاش + الشبكة + فواتير المدفوع
          isMatched, // المطابقة التلقائية
          unmatchReason: unmatchReason || null,
          balanceImages: input.balanceImages,
          imageVerificationNote: input.imageVerificationNote,
          createdBy: ctx.user.id,
        });

        // إنشاء إيرادات الموظفين وتزامن البونص
        const dailyRevenueId = Number((result as any)?.[0]?.insertId || result);
        
        for (const empRev of input.employeeRevenues) {
          await db.createEmployeeRevenue({
            dailyRevenueId,
            employeeId: empRev.employeeId,
            cash: empRev.cash,
            network: empRev.network,
            total: empRev.total,
          });

          // تزامن البونص تلقائياً
          try {
            const { syncBonusOnRevenueChange } = await import('./bonus/sync');
            await syncBonusOnRevenueChange(empRev.employeeId, input.branchId, new Date(input.date));
          } catch (error: any) {
            bonusLogger.error('خطأ في مزامنة البونص', error);
            await db.createSystemLog({
              level: 'warning',
              category: 'bonus',
              message: `فشل تزامن البونص للموظف ${empRev.employeeId}: ${error.message}`,
              userId: ctx.user.id,
            });
          }
        }

        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'revenue',
          details: `تم إدخال إيرادات يوم ${input.date}`,
        });

        // إرسال إشعار بريد إلكتروني إذا كان هناك عدم تطابق
        if (!isMatched && unmatchReason) {
          const branch = await db.getBranchById(input.branchId);
          emailNotifications.notifyRevenueMismatch({
            branchId: input.branchId,
            branchName: branch?.nameAr || 'غير محدد',
            date: input.date,
            expectedAmount: expectedAmount,
            actualAmount: totalEmployeeAmount,
            difference: Math.abs(expectedAmount - totalEmployeeAmount),
            reason: unmatchReason,
          }).catch(err => notificationLogger.error('خطأ في إرسال إشعار عدم التطابق', err));
        }

        // تشغيل المراقبة الذكية (Trigger)
        try {
          const { monitorNewRevenue } = await import('./ai/smartMonitoringService');
          const monitoringResult = await monitorNewRevenue({
            id: dailyRevenueId,
            branchId: input.branchId,
            date: input.date,
            cash: Number(input.cash),
            network: Number(input.network),
            mada: 0, // سيتم إضافته لاحقاً
            total: Number(input.total),
            isMatched: input.isMatched,
            unmatchReason: input.unmatchReason || undefined,
          });
          logger.info('تحليل الإيرادات', { severity: monitoringResult.severity });
        } catch (error: any) {
          logger.error('خطأ في المراقبة الذكية', error);
        }

        // فحص الفروقات وإرسال تنبيهات استباقية
        try {
          const revenueDate = new Date(input.date);
          const day = revenueDate.getDate();
          const month = revenueDate.getMonth() + 1;
          const year = revenueDate.getFullYear();
          
          // حساب رقم الأسبوع
          let weekNumber: number;
          if (day <= 7) weekNumber = 1;
          else if (day <= 14) weekNumber = 2;
          else if (day <= 21) weekNumber = 3;
          else if (day <= 28) weekNumber = 4;
          else weekNumber = 5;
          
          // فحص الفروقات بعد التزامن
          const discrepancyResult = await db.detectBonusDiscrepancies(
            input.branchId,
            weekNumber,
            month,
            year
          );
          
          // إرسال تنبيه إذا وجدت فروقات
          if (discrepancyResult.discrepancies && discrepancyResult.discrepancies.length > 0) {
            const branch = await db.getBranchById(input.branchId);
            const branchName = branch?.nameAr || 'غير محدد';
            
            // إرسال تنبيه بريد إلكتروني للمسؤولين
            const emailService = await import('./notifications/emailNotificationService');
            const recipients = await db.getNotificationRecipients();
            const adminRecipients = recipients.filter(r => r.isActive && (r.role === 'admin' || r.role === 'general_supervisor'));
            
            for (const recipient of adminRecipients) {
              if (recipient.email) {
                await emailService.sendBonusDiscrepancyAlert(recipient.email, {
                  branchName,
                  weekNumber,
                  month,
                  year,
                  discrepancies: discrepancyResult.discrepancies,
                }).catch(err => notificationLogger.error('خطأ في إرسال تنبيه الفروقات', err));
              }
            }
            
            logger.info('تنبيه استباقي', { discrepanciesCount: discrepancyResult.discrepancies.length, branchName });
          }
        } catch (error: any) {
          logger.error('خطأ في التنبيه الاستباقي', error);
        }

        return { success: true, message: 'تم حفظ الإيرادات بنجاح' };
      }),

    getByDateRange: protectedProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return await db.getDailyRevenuesByDateRange(input.branchId, input.startDate, input.endDate);
      }),

    // حذف إيراد يومي (للأدمن فقط)
    deleteDaily: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // حذف إيرادات الموظفين المرتبطة أولاً
        await db.deleteEmployeeRevenuesByDailyId(input.id);
        
        // حذف الإيراد اليومي
        await db.deleteDailyRevenue(input.id);
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'revenue',
          details: `تم حذف إيراد يومي رقم ${input.id}`,
        });
        
        return { success: true, message: 'تم حذف الإيراد بنجاح' };
      }),

    // تجديد رابط صورة S3 منتهي الصلاحية
    refreshImageUrl: protectedProcedure
      .input(z.object({
        s3Key: z.string().min(1, 'مفتاح الصورة مطلوب'),
      }))
      .mutation(async ({ input }) => {
        const { storageGet } = await import('./storage');
        
        try {
          const { url } = await storageGet(input.s3Key);
          return { success: true, url, s3Key: input.s3Key };
        } catch (error: any) {
          logger.error('فشل تجديد رابط الصورة', { s3Key: input.s3Key, error: error.message });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'فشل تجديد رابط الصورة',
          });
        }
      }),

    // تجديد روابط صور متعددة دفعة واحدة
    batchRefreshImageUrls: protectedProcedure
      .input(z.object({
        s3Keys: z.array(z.string()).min(1).max(20, 'الحد الأقصى 20 صورة'),
      }))
      .mutation(async ({ input }) => {
        const { storageGet } = await import('./storage');
        
        const results: Array<{ s3Key: string; url: string | null; error?: string }> = [];
        
        for (const s3Key of input.s3Keys) {
          try {
            const { url } = await storageGet(s3Key);
            results.push({ s3Key, url });
          } catch (error: any) {
            logger.error('فشل تجديد رابط الصورة', { s3Key, error: error.message });
            results.push({ s3Key, url: null, error: error.message });
          }
        }
        
        return { success: true, urls: results };
      }),

    // تقرير فواتير المدفوع
    getPaidInvoicesReport: protectedProcedure
      .input(z.object({
        branchId: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        // الحصول على جميع الإيرادات التي تحتوي على فواتير مدفوع
        const branches = await db.getBranches();
        const results: Array<{
          id: number;
          date: Date;
          branchId: number;
          branchName: string;
          paidInvoices: string;
          paidInvoicesNote: string | null;
          total: string;
        }> = [];

        // تصفية الفروع حسب صلاحيات المستخدم
        let filteredBranches = branches;
        if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
          filteredBranches = branches.filter(b => b.id === ctx.user.branchId);
        } else if (input.branchId) {
          filteredBranches = branches.filter(b => b.id === input.branchId);
        }

        for (const branch of filteredBranches) {
          const revenues = await db.getDailyRevenuesByDateRange(
            branch.id,
            input.startDate,
            input.endDate
          );

          for (const rev of revenues) {
            const paidAmount = parseFloat(rev.paidInvoices || '0');
            if (paidAmount > 0) {
              results.push({
                id: rev.id,
                date: rev.date,
                branchId: branch.id,
                branchName: branch.nameAr || branch.name,
                paidInvoices: rev.paidInvoices || '0',
                paidInvoicesNote: rev.paidInvoicesNote || null,
                total: rev.total,
              });
            }
          }
        }

        // ترتيب حسب التاريخ (الأحدث أولاً)
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // حساب الإحصائيات
        const totalPaidInvoices = results.reduce((sum, r) => sum + parseFloat(r.paidInvoices), 0);
        
        // تصنيف حسب الأسباب
        const byReason: Record<string, { count: number; total: number }> = {};
        for (const r of results) {
          const reason = r.paidInvoicesNote || 'بدون سبب محدد';
          if (!byReason[reason]) {
            byReason[reason] = { count: 0, total: 0 };
          }
          byReason[reason].count++;
          byReason[reason].total += parseFloat(r.paidInvoices);
        }

        // تصنيف حسب الفرع
        const byBranch: Record<string, { count: number; total: number }> = {};
        for (const r of results) {
          if (!byBranch[r.branchName]) {
            byBranch[r.branchName] = { count: 0, total: 0 };
          }
          byBranch[r.branchName].count++;
          byBranch[r.branchName].total += parseFloat(r.paidInvoices);
        }

        return {
          items: results,
          summary: {
            totalCount: results.length,
            totalAmount: totalPaidInvoices,
            byReason: Object.entries(byReason).map(([reason, data]) => ({
              reason,
              count: data.count,
              total: data.total,
            })),
            byBranch: Object.entries(byBranch).map(([branch, data]) => ({
              branch,
              count: data.count,
              total: data.total,
            })),
          },
        };
      }),
  }),

  // ==================== إدارة البونص الأسبوعي ====================
  bonuses: router({
    // الحصول على بونص الأسبوع الحالي فقط (متاح للجميع)
    current: protectedProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        
        // حساب رقم الأسبوع الحالي
        let currentWeekNumber: number;
        if (day <= 7) currentWeekNumber = 1;
        else if (day <= 15) currentWeekNumber = 2;
        else if (day <= 22) currentWeekNumber = 3;
        else if (day <= 29) currentWeekNumber = 4;
        else currentWeekNumber = 5;

        // البحث عن بونص الأسبوع الحالي فقط
        let weeklyBonus = await db.getCurrentWeekBonus(input.branchId, year, month, currentWeekNumber);
        let details = weeklyBonus ? await db.getBonusDetails(weeklyBonus.id) : [];
        let isCurrentWeek = true;
        let displayYear = year;
        let displayMonth = month;
        let displayWeekNumber = currentWeekNumber;
        
        // التحقق من وجود إيرادات في الأسبوع الحالي
        const hasCurrentWeekRevenues = details.some(d => Number(d.weeklyRevenue) > 0);
        
        // إذا لم يكن هناك بونص للأسبوع الحالي، أنشئ واحداً فارغاً
        if (!weeklyBonus) {
          // جلب الموظفين النشطين للفرع
          const branchEmployees = await db.getEmployeesByBranch(input.branchId);
          const branch = await db.getBranchById(input.branchId);
          
          // حساب تواريخ الأسبوع
          const lastDayOfMonth = new Date(year, month, 0).getDate();
          const weekRanges: Record<number, { startDay: number; endDay: number }> = {
            1: { startDay: 1, endDay: 7 },
            2: { startDay: 8, endDay: 14 },
            3: { startDay: 15, endDay: 21 },
            4: { startDay: 22, endDay: 28 },
            5: { startDay: 29, endDay: lastDayOfMonth },
          };
          const range = weekRanges[currentWeekNumber] || weekRanges[1];
          const weekStart = new Date(year, month - 1, range.startDay);
          const weekEnd = new Date(year, month - 1, Math.min(range.endDay, lastDayOfMonth));
          
          return {
            id: 0,
            branchId: input.branchId,
            branchName: branch?.nameAr || 'غير محدد',
            year,
            month,
            weekNumber: currentWeekNumber,
            weekStart,
            weekEnd,
            totalRevenue: '0',
            totalAmount: '0',
            status: 'pending' as const,
            details: branchEmployees.map(emp => ({
              id: 0,
              employeeId: emp.id,
              employeeName: emp.name,
              employeeCode: emp.code,
              weeklyRevenue: '0',
              bonusAmount: '0',
              bonusTier: null,
              isEligible: false,
            })),
            eligibleCount: 0,
            totalEmployees: branchEmployees.length,
            isCurrentWeek: true,
            hasRevenues: false,
            message: 'لم يتم إدخال إيرادات لهذا الأسبوع بعد',
          };
        }

        const branch = await db.getBranchById(input.branchId);

        return {
          ...weeklyBonus,
          branchName: branch?.nameAr || 'غير محدد',
          details,
          eligibleCount: details.filter(d => d.isEligible).length,
          totalEmployees: details.length,
          isCurrentWeek,
          hasRevenues: hasCurrentWeekRevenues,
        };
      }),

    // الحصول على بونص أسبوع محدد (متاح للجميع)
    getWeek: protectedProcedure
      .input(z.object({
        branchId: z.number(),
        year: z.number(),
        month: z.number(),
        weekNumber: z.number().min(1).max(5),
      }))
      .query(async ({ input }) => {
        const weeklyBonus = await db.getCurrentWeekBonus(
          input.branchId,
          input.year,
          input.month,
          input.weekNumber
        );
        
        if (!weeklyBonus) {
          return null;
        }

        const details = await db.getBonusDetails(weeklyBonus.id);
        const branch = await db.getBranchById(input.branchId);

        return {
          ...weeklyBonus,
          branchName: branch?.nameAr || 'غير محدد',
          details,
          eligibleCount: details.filter(d => d.isEligible).length,
          totalEmployees: details.length,
        };
      }),

    // سجل البونص (متاح للجميع)
    history: protectedProcedure
      .input(z.object({
        branchId: z.number(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return await db.getWeeklyBonusesByBranch(input.branchId, input.limit);
      }),

    // طلب صرف البونص (متاح للجميع)
    request: protectedProcedure
      .input(z.object({ weeklyBonusId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // الحصول على بيانات البونص أولاً
        const weeklyBonus = await db.getWeeklyBonusById(input.weeklyBonusId);
        if (!weeklyBonus) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'البونص غير موجود' });
        }
        
        // التحقق من أن البونص في حالة انتظار (مسودة)
        if (weeklyBonus.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن طلب صرف بونص تم طلبه مسبقاً' });
        }
        
        await db.updateWeeklyBonusStatus(input.weeklyBonusId, 'requested', ctx.user.id);
        
        await db.createBonusAuditLog({
          weeklyBonusId: input.weeklyBonusId,
          action: 'طلب صرف',
          oldStatus: 'pending',
          newStatus: 'requested',
          performedBy: ctx.user.id,
          details: 'تم طلب صرف البونص',
        });

        // إرسال إشعار للمسؤول
        await notifyOwner({
          title: 'طلب صرف بونص جديد',
          content: `تم طلب صرف بونص أسبوعي من ${ctx.user.name || 'مشرف'}`,
        });

        // إرسال إشعار بريد إلكتروني متقدم
        const bonusDetails = await db.getBonusDetails(input.weeklyBonusId);
        if (bonusDetails.length > 0) {
          const branch = await db.getBranchById(weeklyBonus.branchId);
          
          // تحضير بيانات الموظفين للقالب المتقدم
          const employeesData = bonusDetails
            .filter(d => d.isEligible)
            .map(d => ({
              name: d.employeeName || 'غير محدد',
              code: d.employeeCode || '',
              weeklyRevenue: parseFloat(String(d.weeklyRevenue)) || 0,
              tier: d.bonusTier || 'none',
              bonusAmount: parseFloat(String(d.bonusAmount)) || 0,
            }));
          
          // إرسال الإشعار المتقدم
          emailNotifications.notifyAdvancedBonusPaymentRequest({
            branchId: weeklyBonus.branchId,
            branchName: branch?.nameAr || 'غير محدد',
            weekNumber: weeklyBonus.weekNumber,
            month: weeklyBonus.month,
            year: weeklyBonus.year,
            totalAmount: parseFloat(String(weeklyBonus.totalAmount)) || 0,
            eligibleCount: employeesData.length,
            totalEmployees: bonusDetails.length,
            requestedBy: ctx.user.name || 'مشرف',
            requestedByRole: ctx.user.role === 'admin' ? 'مسؤول النظام' : ctx.user.role === 'manager' ? 'المدير' : ctx.user.role === 'supervisor' ? 'مشرف الفرع' : 'مستخدم',
            employees: employeesData,
          }).catch(err => bonusLogger.error('خطأ في إرسال إشعار طلب صرف البونص', err));
        }

        return { success: true, message: 'تم إرسال طلب الصرف بنجاح' };
      }),

    // طلبات البونص المعلقة (للمسؤول والمشرف)
    pending: supervisorViewProcedure.query(async () => {
      const requests = await db.getPendingBonusRequests();
      const result = [];
      
      for (const req of requests) {
        const branch = await db.getBranchById(req.branchId);
        const details = await db.getBonusDetails(req.id);
        result.push({
          ...req,
          branchName: branch?.nameAr || 'غير محدد',
          details,
          eligibleCount: details.filter(d => d.isEligible).length,
          totalEmployees: details.length,
        });
      }
      
      return result;
    }),

    // جميع طلبات البونص (السجل الكامل) - متاح للمشرف
    all: supervisorViewProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        const requests = await db.getAllBonusRequests(input?.limit || 50);
        const result = [];
        
        for (const req of requests) {
          const branch = await db.getBranchById(req.branchId);
          const details = await db.getBonusDetails(req.id);
          result.push({
            ...req,
            branchName: branch?.nameAr || 'غير محدد',
            details,
            eligibleCount: details.filter(d => d.isEligible).length,
            totalEmployees: details.length,
          });
        }
        
        return result;
      }),

    // الموافقة على البونص
    approve: adminProcedure
      .input(z.object({ weeklyBonusId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateWeeklyBonusStatus(input.weeklyBonusId, 'approved', ctx.user.id);
        
        await db.createBonusAuditLog({
          weeklyBonusId: input.weeklyBonusId,
          action: 'موافقة',
          oldStatus: 'requested',
          newStatus: 'approved',
          performedBy: ctx.user.id,
          details: 'تمت الموافقة على البونص',
        });

        return { success: true, message: 'تمت الموافقة على البونص بنجاح' };
      }),

    // رفض البونص
    reject: adminProcedure
      .input(z.object({
        weeklyBonusId: z.number(),
        reason: z.string().min(1, 'سبب الرفض مطلوب'),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateWeeklyBonusStatus(input.weeklyBonusId, 'rejected', ctx.user.id, input.reason);
        
        await db.createBonusAuditLog({
          weeklyBonusId: input.weeklyBonusId,
          action: 'رفض',
          oldStatus: 'requested',
          newStatus: 'rejected',
          performedBy: ctx.user.id,
          details: `تم رفض البونص: ${input.reason}`,
        });

        return { success: true, message: 'تم رفض البونص' };
      }),

    // صرف البونص (تسجيل الصرف الفعلي)
    markAsPaid: adminProcedure
      .input(z.object({
        weeklyBonusId: z.number(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'check']),
        paymentReference: z.string().optional(),
        paymentNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // التحقق من أن البونص موافق عليه
        const bonus = await db.getWeeklyBonusById(input.weeklyBonusId);
        if (!bonus) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'البونص غير موجود' });
        }
        if (bonus.status !== 'approved') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب الموافقة على البونص قبل الصرف' });
        }

        // تحديث حالة البونص إلى مصروف
        await db.markBonusAsPaid(input.weeklyBonusId, {
          paidBy: ctx.user.id,
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference,
          paymentNotes: input.paymentNotes,
        });
        
        await db.createBonusAuditLog({
          weeklyBonusId: input.weeklyBonusId,
          action: 'صرف',
          oldStatus: 'approved',
          newStatus: 'paid',
          performedBy: ctx.user.id,
          details: `تم صرف البونص - طريقة الدفع: ${input.paymentMethod}${input.paymentReference ? ` - المرجع: ${input.paymentReference}` : ''}`,
        });

        return { success: true, message: 'تم تسجيل صرف البونص بنجاح' };
      }),

    // الحصول على البونصات الموافق عليها (للصرف)
    approvedForPayment: adminProcedure.query(async () => {
      const approved = await db.getApprovedBonusesForPayment();
      const result = [];
      
      for (const bonus of approved) {
        const branch = await db.getBranchById(bonus.branchId);
        const details = await db.getBonusDetails(bonus.id);
        result.push({
          ...bonus,
          branchName: branch?.nameAr || 'غير محدد',
          details,
          eligibleCount: details.filter(d => d.isEligible).length,
          totalEmployees: details.length,
        });
      }
      
      return result;
    }),

    // سجل البونصات المصروفة
    paidHistory: adminProcedure
      .input(z.object({
        branchId: z.number().optional(),
        month: z.number().optional(),
        year: z.number().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const paid = await db.getPaidBonusHistory(input);
        const result = [];
        
        for (const bonus of paid) {
          const branch = await db.getBranchById(bonus.branchId);
          const paidByUser = bonus.paidBy ? await db.getUserById(bonus.paidBy) : null;
          result.push({
            ...bonus,
            branchName: branch?.nameAr || 'غير محدد',
            paidByName: paidByUser?.name || 'غير محدد',
          });
        }
        
        return result;
      }),

    // تزامن البونص يدوياً (متاح للجميع)
    sync: protectedProcedure
      .input(z.object({
        branchId: z.number(),
        year: z.number(),
        month: z.number(),
        weekNumber: z.number().min(1).max(5),
      }))
      .mutation(async ({ input, ctx }) => {
        const { syncWeeklyBonusForBranch } = await import('./bonus/sync');
        const result = await syncWeeklyBonusForBranch(
          input.branchId,
          input.weekNumber,
          input.month,
          input.year
        );

        if (result.success) {
          await db.createActivityLog({
            userId: ctx.user.id,
            userName: ctx.user.name || 'مستخدم',
            action: 'sync',
            entityType: 'bonus',
            details: `تم تزامن بونص الأسبوع ${input.weekNumber}`,
          });
        }

        return result;
      }),

    // سجل تدقيق البونص
    auditLogs: protectedProcedure
      .input(z.object({
        branchId: z.number().optional(),
        weeklyBonusId: z.number().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }).optional())
      .query(async ({ input }) => {
        return await db.getBonusAuditLogs(input);
      }),

    // الكشف عن فروقات البونص
    detectDiscrepancies: protectedProcedure
      .input(z.object({
        branchId: z.number(),
        weekNumber: z.number().min(1).max(5),
        month: z.number().min(1).max(12),
        year: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.detectBonusDiscrepancies(
          input.branchId,
          input.weekNumber,
          input.month,
          input.year
        );
      }),

    // الحصول على جميع الفروقات غير المعالجة (للوحة التحكم)
    getAllDiscrepancies: protectedProcedure
      .query(async ({ ctx }) => {
        // فقط للأدمن
        if (ctx.user.role !== 'admin') {
          return { totalDiscrepancies: 0, branches: [] };
        }

        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        
        // حساب رقم الأسبوع الحالي
        let weekNumber: number;
        if (day <= 7) weekNumber = 1;
        else if (day <= 15) weekNumber = 2;
        else if (day <= 22) weekNumber = 3;
        else if (day <= 29) weekNumber = 4;
        else weekNumber = 5;

        // الحصول على جميع الفروع
        const branches = await db.getBranches();
        const results: Array<{
          branchId: number;
          branchName: string;
          discrepancyCount: number;
          totalDiff: number;
        }> = [];

        let totalDiscrepancies = 0;

        for (const branch of branches) {
          const discrepancies = await db.detectBonusDiscrepancies(
            branch.id,
            weekNumber,
            month,
            year
          );

          if (discrepancies.hasDiscrepancy) {
            const totalDiff = discrepancies.discrepancies.reduce(
              (sum, d) => sum + Math.abs(d.bonusDiff),
              0
            );
            results.push({
              branchId: branch.id,
              branchName: branch.nameAr || branch.name,
              discrepancyCount: discrepancies.discrepancies.length,
              totalDiff,
            });
            totalDiscrepancies += discrepancies.discrepancies.length;
          }
        }

        return {
          totalDiscrepancies,
          weekNumber,
          month,
          year,
          branches: results,
        };
      }),

    // إرسال تنبيه بالفروقات عبر البريد
    sendDiscrepancyAlert: protectedProcedure
      .input(z.object({
        branchId: z.number(),
        weekNumber: z.number().min(1).max(5),
        month: z.number().min(1).max(12),
        year: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const discrepancyResult = await db.detectBonusDiscrepancies(
          input.branchId,
          input.weekNumber,
          input.month,
          input.year
        );

        if (!discrepancyResult.hasDiscrepancy) {
          return { success: true, message: 'لا توجد فروقات للإبلاغ عنها' };
        }

        // الحصول على اسم الفرع
        const branch = await db.getBranchById(input.branchId);
        const branchName = branch?.name || 'غير محدد';

        // إنشاء محتوى التنبيه
        const discrepancyRows = discrepancyResult.discrepancies.map(d => 
          `- ${d.employeeName}: إيراد مسجل ${d.registeredRevenue.toFixed(2)} ر.س، إيراد فعلي ${d.actualRevenue.toFixed(2)} ر.س (فرق: ${d.revenueDiff.toFixed(2)} ر.س)`
        ).join('\n');

        const alertContent = `
⚠️ تنبيه: تم اكتشاف فروقات في البونص

الفرع: ${branchName}
الأسبوع: ${input.weekNumber}
الشهر: ${input.month}/${input.year}

عدد الفروقات: ${discrepancyResult.discrepancies.length}

التفاصيل:
${discrepancyRows}

يرجى مراجعة الإيرادات وإعادة تزامن البونص.
        `.trim();

        // إرسال إشعار للمسؤولين
        try {
          const emailService = await import('./notifications/emailNotificationService');
          const recipients = await db.getNotificationRecipients();
          const adminRecipients = recipients.filter(r => r.isActive && (r.role === 'admin' || r.role === 'general_supervisor'));
          
          for (const recipient of adminRecipients) {
            if (recipient.email) {
              await emailService.sendBonusDiscrepancyAlert(recipient.email, {
                branchName,
                weekNumber: input.weekNumber,
                month: input.month,
                year: input.year,
                discrepancies: discrepancyResult.discrepancies,
              });
            }
          }

          // تسجيل في سجل التدقيق
          await db.createBonusAuditLog({
            weeklyBonusId: discrepancyResult.summary?.weeklyBonusId || 0,
            action: 'discrepancy_alert_sent',
            performedBy: ctx.user.id,
            details: `تم إرسال تنبيه بـ ${discrepancyResult.discrepancies.length} فروقات`,
          });

          return { 
            success: true, 
            message: `تم إرسال التنبيه إلى ${adminRecipients.length} مستلم`,
            discrepancies: discrepancyResult.discrepancies.length
          };
        } catch (error) {
          notificationLogger.error('فشل إرسال تنبيه الفروقات', error);
          return { success: false, message: 'فشل إرسال التنبيه' };
        }
      }),

    // إرسال التقرير الأسبوعي للبونص (يدوياً)
    sendWeeklyReport: protectedProcedure
      .mutation(async ({ ctx }) => {
        // فقط للأدمن
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
        }

        try {
          const scheduledService = await import('./notifications/scheduledNotificationService');
          const result = await scheduledService.sendWeeklyBonusReport();
          
          return {
            success: result.success,
            message: result.success 
              ? `تم إرسال التقرير إلى ${result.sentCount} مستلم`
              : result.reason || 'فشل إرسال التقرير',
            sentCount: result.sentCount,
          };
        } catch (error) {
          bonusLogger.error('فشل إرسال تقرير البونص الأسبوعي', error);
          return { success: false, message: 'فشل إرسال التقرير الأسبوعي' };
        }
      }),

    // إرسال إشعارات الوثائق المنتهية (يدوياً)
    sendDocumentExpiryNotifications: adminProcedure
      .mutation(async ({ ctx }) => {
        try {
          const { sendDocumentExpiryNotifications } = await import('./notifications/documentExpiryNotifications');
          const result = await sendDocumentExpiryNotifications();
          
          return {
            success: result.success,
            message: result.success 
              ? `تم إرسال تقرير الوثائق إلى ${result.sentCount} مستلم (إجمالي الوثائق: ${result.totalDocuments})`
              : result.errors.join(', ') || 'فشل إرسال التقرير',
            sentCount: result.sentCount,
            totalDocuments: result.totalDocuments,
            errors: result.errors,
          };
        } catch (error) {
          notificationLogger.error('فشل إرسال إشعارات الوثائق', error);
          return { success: false, message: 'فشل إرسال إشعارات الوثائق' };
        }
      }),

    // ==================== إدارة مستويات البونص (للأدمن فقط) ====================
    
    // الحصول على جميع مستويات البونص
    getTierSettings: protectedProcedure
      .query(async () => {
        // تهيئة المستويات الافتراضية إذا لم تكن موجودة
        await db.initializeDefaultBonusTiers();
        return await db.getBonusTierSettings();
      }),

    // تحديث مستوى بونص (للأدمن فقط)
    updateTier: adminProcedure
      .input(z.object({
        id: z.number(),
        tierName: z.string().optional(),
        minRevenue: z.string().optional(),
        maxRevenue: z.string().nullable().optional(),
        bonusAmount: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // الحصول على القيم القديمة
        const tiers = await db.getBonusTierSettings();
        const oldTier = tiers.find(t => t.id === input.id);
        
        if (!oldTier) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'المستوى غير موجود' });
        }

        const { id, ...updateData } = input;
        await db.updateBonusTier(id, updateData);

        // تسجيل التغيير
        await db.logBonusTierChange({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مسؤول',
          tierId: id,
          tierKey: oldTier.tierKey,
          changeType: 'update',
          oldValues: oldTier,
          newValues: { ...oldTier, ...updateData },
          description: `تحديث مستوى ${oldTier.tierName}`,
        });

        return { success: true, message: 'تم تحديث المستوى بنجاح' };
      }),

    // إضافة مستوى جديد (للأدمن فقط)
    createTier: adminProcedure
      .input(z.object({
        tierKey: z.string(),
        tierName: z.string(),
        minRevenue: z.string(),
        maxRevenue: z.string().optional(),
        bonusAmount: z.string(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createBonusTier(input);

        // تسجيل التغيير
        await db.logBonusTierChange({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مسؤول',
          tierKey: input.tierKey,
          changeType: 'create',
          newValues: input,
          description: `إضافة مستوى جديد: ${input.tierName}`,
        });

        return { success: true, message: 'تم إضافة المستوى بنجاح' };
      }),

    // حذف مستوى (للأدمن فقط)
    deleteTier: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const tiers = await db.getBonusTierSettings();
        const tier = tiers.find(t => t.id === input.id);
        
        if (!tier) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'المستوى غير موجود' });
        }

        await db.deleteBonusTier(input.id);

        // تسجيل التغيير
        await db.logBonusTierChange({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مسؤول',
          tierId: input.id,
          tierKey: tier.tierKey,
          changeType: 'delete',
          oldValues: tier,
          description: `حذف مستوى: ${tier.tierName}`,
        });

        return { success: true, message: 'تم حذف المستوى بنجاح' };
      }),

    // سجل تغييرات مستويات البونص
    getTierAuditLogs: adminProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getBonusTierAuditLogs(input?.limit || 50);
      }),

    // إحصائيات البونص - متاح للمشرف
    stats: supervisorViewProcedure.query(async () => {
      return await db.getBonusStats();
    }),

    // تصدير PDF للبونص الأسبوعي - متاح للمشرف
    exportPDF: supervisorViewProcedure
      .input(z.object({ weeklyBonusId: z.number() }))
      .mutation(async ({ input }) => {
        const bonus = await db.getWeeklyBonusById(input.weeklyBonusId);
        if (!bonus) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'البونص غير موجود' });
        }

        const branch = await db.getBranchById(bonus.branchId);
        const details = await db.getBonusDetails(input.weeklyBonusId);
        
        // جلب معلومات المستخدمين
        const requestedByUser = bonus.requestedBy ? await db.getUserById(bonus.requestedBy) : null;
        const approvedByUser = bonus.approvedBy ? await db.getUserById(bonus.approvedBy) : null;
        const paidByUser = bonus.paidBy ? await db.getUserById(bonus.paidBy) : null;

        // تحضير بيانات الموظفين
        const employees = details.map(d => ({
          name: d.employeeName || 'غير محدد',
          code: d.employeeCode || '',
          weeklyRevenue: parseFloat(String(d.weeklyRevenue)) || 0,
          tier: d.bonusTier || 'none',
          bonusAmount: parseFloat(String(d.bonusAmount)) || 0,
          isEligible: d.isEligible || false,
        }));

        const { generateWeeklyBonusReportPDF } = await import('./pdfService');
        
        const pdfBuffer = await generateWeeklyBonusReportPDF({
          branchName: branch?.nameAr || 'غير محدد',
          weekNumber: bonus.weekNumber,
          month: bonus.month,
          year: bonus.year,
          status: bonus.status,
          totalAmount: parseFloat(bonus.totalAmount || '0'),
          eligibleCount: details.filter(d => d.isEligible).length,
          totalEmployees: details.length,
          requestedAt: bonus.requestedAt,
          approvedAt: bonus.approvedAt,
          paidAt: bonus.paidAt,
          requestedByName: requestedByUser?.name ?? undefined,
          approvedByName: approvedByUser?.name ?? undefined,
          paidByName: paidByUser?.name ?? undefined,
          paymentMethod: bonus.paymentMethod ?? undefined,
          paymentReference: bonus.paymentReference ?? undefined,
          employees,
        });

        // تحويل البفر إلى base64
        return {
          success: true,
          pdf: pdfBuffer.toString('base64'),
          filename: `bonus-report-${branch?.nameAr || 'branch'}-week${bonus.weekNumber}-${bonus.month}-${bonus.year}.pdf`,
        };
      }),
  }),

  // ==================== طلبات الموظفين ====================
  employeeRequests: router({
    // قائمة جميع الطلبات (للمدير والمسؤول والمشرف)
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        requestType: z.string().optional(),
        employeeId: z.number().optional(),
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        // التحقق من الصلاحيات
        const allowedRoles = ['admin', 'manager', 'supervisor'];
        if (!allowedRoles.includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بعرض الطلبات' });
        }
        
        const requests = await db.getAllEmployeeRequests(input);
        
        // المشرف يرى طلبات فرعه فقط (إذا كان مرتبط بفرع)
        if (ctx.user.role === 'supervisor' && ctx.user.branchId !== null) {
          return requests.filter(req => req.branchId === ctx.user.branchId);
        }
        return requests;
      }),

    // طلباتي (للموظف)
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      // البحث عن الموظف المرتبط بالمستخدم
      const allEmployees = await db.getAllEmployees();
      const employee = allEmployees.find(e => e.name === ctx.user.name || e.code === ctx.user.openId);
      
      if (!employee) {
        // إذا لم يكن موظفاً، أرجع الطلبات التي أنشأها المستخدم
        const allRequests = await db.getAllEmployeeRequests();
        return allRequests.filter(r => r.employeeName === ctx.user.name);
      }
      
      return await db.getEmployeeRequestsByEmployeeId(employee.id);
    }),

    // الطلبات المعلقة - متاح للمشرف العام والمدير والمسؤول
    pending: supervisorViewProcedure.query(async () => {
      return await db.getPendingEmployeeRequests();
    }),

    // تفاصيل طلب
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmployeeRequestById(input.id);
      }),

    // إحصائيات الطلبات - متاح للمشرف العام والمدير والمسؤول
    stats: supervisorViewProcedure.query(async () => {
      return await db.getEmployeeRequestsStats();
    }),

    // إنشاء طلب جديد - المشرف يمكنه الإدخال فقط
    create: supervisorInputProcedure
      .input(z.object({
        employeeId: z.number(),
        employeeName: z.string(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        requestType: z.enum(["advance", "vacation", "arrears", "permission", "objection", "resignation"]),
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        // حقول السلفة
        advanceAmount: z.number().optional(),
        advanceReason: z.string().optional(),
        repaymentMethod: z.string().optional(),
        // حقول الإجازة
        vacationType: z.string().optional(),
        vacationStartDate: z.date().optional(),
        vacationEndDate: z.date().optional(),
        vacationDays: z.number().optional(),
        // حقول صرف المتأخرات
        arrearsAmount: z.number().optional(),
        arrearsPeriod: z.string().optional(),
        arrearsDetails: z.string().optional(),
        // حقول الاستئذان
        permissionDate: z.date().optional(),
        permissionStartTime: z.string().optional(),
        permissionEndTime: z.string().optional(),
        permissionHours: z.number().optional(),
        permissionReason: z.string().optional(),
        // حقول الاعتراض
        objectionType: z.string().optional(),
        objectionDate: z.date().optional(),
        objectionDetails: z.string().optional(),
        objectionEvidence: z.string().optional(),
        // حقول الاستقالة
        resignationDate: z.date().optional(),
        resignationReason: z.string().optional(),
        lastWorkingDay: z.date().optional(),
        noticePeriod: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createEmployeeRequest({
          ...input,
          advanceAmount: input.advanceAmount?.toString(),
          arrearsAmount: input.arrearsAmount?.toString(),
          permissionHours: input.permissionHours?.toString(),
        });

        if (result) {
          // تسجيل الإنشاء
          await db.createEmployeeRequestLog({
            requestId: Number(result.insertId),
            action: 'إنشاء طلب',
            newStatus: 'pending',
            performedBy: ctx.user.id,
            performedByName: ctx.user.name || 'مستخدم',
            notes: `تم إنشاء طلب ${input.title}`,
          });

          // إشعار المدير
          await notifyOwner({
            title: 'طلب جديد من موظف',
            content: `قدم ${input.employeeName} طلب ${getRequestTypeName(input.requestType)}: ${input.title}`,
          });

          // إضافة إشعار داخلي
          await db.createNotification({
            type: 'system',
            title: 'طلب جديد',
            message: `قدم ${input.employeeName} طلب ${getRequestTypeName(input.requestType)}`,
            relatedType: 'employee_request',
            relatedId: Number(result.insertId),
          });

          // إرسال إشعار بريد إلكتروني متقدم للأدمن والمشرفين
          const requestDetails: Record<string, any> = {};
          if (input.requestType === 'advance') {
            requestDetails['المبلغ المطلوب'] = `${input.advanceAmount || 0} ر.س`;
            requestDetails['سبب السلفة'] = input.advanceReason || 'غير محدد';
            requestDetails['طريقة السداد'] = input.repaymentMethod || 'غير محدد';
          } else if (input.requestType === 'vacation') {
            requestDetails['نوع الإجازة'] = input.vacationType || 'غير محدد';
            requestDetails['تاريخ البداية'] = input.vacationStartDate?.toLocaleDateString('ar-SA') || 'غير محدد';
            requestDetails['تاريخ النهاية'] = input.vacationEndDate?.toLocaleDateString('ar-SA') || 'غير محدد';
            requestDetails['عدد الأيام'] = input.vacationDays || 0;
          } else if (input.requestType === 'permission') {
            requestDetails['تاريخ الاستئذان'] = input.permissionDate?.toLocaleDateString('ar-SA') || 'غير محدد';
            requestDetails['وقت البداية'] = input.permissionStartTime || 'غير محدد';
            requestDetails['وقت النهاية'] = input.permissionEndTime || 'غير محدد';
            requestDetails['سبب الاستئذان'] = input.permissionReason || 'غير محدد';
          } else if (input.requestType === 'resignation') {
            requestDetails['تاريخ الاستقالة'] = input.resignationDate?.toLocaleDateString('ar-SA') || 'غير محدد';
            requestDetails['سبب الاستقالة'] = input.resignationReason || 'غير محدد';
            requestDetails['آخر يوم عمل'] = input.lastWorkingDay?.toLocaleDateString('ar-SA') || 'غير محدد';
          } else if (input.requestType === 'arrears') {
            requestDetails['المبلغ'] = `${input.arrearsAmount || 0} ر.س`;
            requestDetails['الفترة'] = input.arrearsPeriod || 'غير محدد';
            requestDetails['التفاصيل'] = input.arrearsDetails || 'غير محدد';
          } else if (input.requestType === 'objection') {
            requestDetails['نوع الاعتراض'] = input.objectionType || 'غير محدد';
            requestDetails['تاريخ الاعتراض'] = input.objectionDate?.toLocaleDateString('ar-SA') || 'غير محدد';
            requestDetails['التفاصيل'] = input.objectionDetails || 'غير محدد';
          }

          emailNotifications.notifyNewEmployeeRequest({
            employeeName: input.employeeName,
            requestType: input.requestType,
            title: input.title,
            description: input.description,
            priority: input.priority,
            branchId: input.branchId,
            branchName: input.branchName,
            requestNumber: result?.requestNumber,
            details: requestDetails,
          }).catch(err => notificationLogger.error('خطأ في إرسال إشعار البريد', err));
          
          // إرسال إشعار بريد للموظف بأنه تم استلام طلبه
          const employee = await db.getEmployeeById(input.employeeId);
          if (employee?.email) {
            emailNotifications.notifyEmployeeRequestSubmitted({
              employeeEmail: employee.email,
              employeeName: input.employeeName,
              requestType: input.requestType,
              requestId: Number(result.insertId),
              details: input.description || undefined,
              submittedAt: new Date(),
            }).catch(err => notificationLogger.error('خطأ في إرسال إشعار الموظف', err));
          }
          
          // إرسال إشعار SMS للموظف
          if (employee?.phone) {
            twilioService.sendRequestSubmittedNotification(
              employee.phone,
              input.employeeName,
              getRequestTypeName(input.requestType),
              result?.requestNumber || String(result.insertId)
            ).catch(err => notificationLogger.error('خطأ في إرسال SMS للموظف', err));
          }
        }

        return { success: true, message: 'تم تقديم الطلب بنجاح', requestNumber: result?.requestNumber };
      }),

    // تحديث حالة الطلب (موافقة/رفض) - متاح للمشرف العام والمدير والمسؤول
    updateStatus: supervisorViewProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected", "cancelled"]),
        reviewNotes: z.string().optional(),
        rejectionReason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const request = await db.getEmployeeRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'الطلب غير موجود' });
        }

        const oldStatus = request.status;
        
        await db.updateEmployeeRequestStatus(
          input.id,
          input.status,
          ctx.user.id,
          ctx.user.name || 'مسؤول',
          input.reviewNotes,
          input.rejectionReason
        );

        // تسجيل التغيير
        await db.createEmployeeRequestLog({
          requestId: input.id,
          action: input.status === 'approved' ? 'موافقة' : input.status === 'rejected' ? 'رفض' : 'إلغاء',
          oldStatus,
          newStatus: input.status,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name || 'مسؤول',
          notes: input.rejectionReason || input.reviewNotes,
        });

        // إشعار الموظف
        const statusText = input.status === 'approved' ? 'تمت الموافقة على' : input.status === 'rejected' ? 'تم رفض' : 'تم إلغاء';
        await db.createNotification({
          type: 'system',
          title: `${statusText} طلبك`,
          message: `${statusText} طلبك: ${request.title}${input.rejectionReason ? ` - السبب: ${input.rejectionReason}` : ''}`,
          relatedType: 'employee_request',
          relatedId: input.id,
        });

        // إرسال إشعار بريد إلكتروني بتحديث الحالة
        emailNotifications.notifyRequestStatusUpdate({
          employeeName: request.employeeName,
          requestType: request.requestType,
          title: request.title,
          requestNumber: request.requestNumber,
          oldStatus,
          newStatus: input.status,
          reviewNotes: input.reviewNotes,
          rejectionReason: input.rejectionReason,
          reviewerName: ctx.user.name || 'مسؤول',
          branchId: request.branchId ?? undefined,
          branchName: request.branchName ?? undefined,
        }).catch(err => requestsLogger.error('خطأ في إرسال إشعار تحديث الحالة', err));
        
        // إرسال إشعار بريد للموظف بتحديث حالة طلبه
        const employee = await db.getEmployeeById(request.employeeId);
        if (employee?.email) {
          if (input.status === 'approved') {
            emailNotifications.notifyEmployeeRequestApproved({
              employeeEmail: employee.email,
              employeeName: request.employeeName,
              requestType: request.requestType,
              requestId: input.id,
              approvedBy: ctx.user.name || 'مسؤول',
              approvedAt: new Date(),
              notes: input.reviewNotes,
            }).catch(err => requestsLogger.error('خطأ في إرسال إشعار الموافقة للموظف', err));
          } else if (input.status === 'rejected') {
            emailNotifications.notifyEmployeeRequestRejected({
              employeeEmail: employee.email,
              employeeName: request.employeeName,
              requestType: request.requestType,
              requestId: input.id,
              rejectedBy: ctx.user.name || 'مسؤول',
              rejectedAt: new Date(),
              reason: input.rejectionReason,
            }).catch(err => requestsLogger.error('خطأ في إرسال إشعار الرفض للموظف', err));
          }
        }
        
        // إرسال إشعار SMS للموظف بتحديث حالة طلبه
        if (employee?.phone) {
          const requestTypeName = getRequestTypeName(request.requestType);
          if (input.status === 'approved') {
            twilioService.sendRequestApprovedNotification(
              employee.phone,
              request.employeeName,
              requestTypeName,
              request.requestNumber || String(input.id),
              input.reviewNotes
            ).catch(err => requestsLogger.error('خطأ في إرسال SMS الموافقة للموظف', err));
          } else if (input.status === 'rejected') {
            twilioService.sendRequestRejectedNotification(
              employee.phone,
              request.employeeName,
              requestTypeName,
              request.requestNumber || String(input.id),
              input.rejectionReason
            ).catch(err => requestsLogger.error('خطأ في إرسال SMS الرفض للموظف', err));
          }
        }

        return { success: true, message: `تم ${statusText} الطلب بنجاح` };
      }),

    // حذف طلب
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEmployeeRequest(input.id);
        return { success: true, message: 'تم حذف الطلب بنجاح' };
      }),

    // سجلات الطلب
    logs: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmployeeRequestLogs(input.requestId);
      }),
  }),

  // ==================== مسيرات الرواتب ====================
  payrolls: router({
    // الحصول على جميع المسيرات (متاح للمشرفين أيضاً)
    list: supervisorInputProcedure.query(async ({ ctx }) => {
      // المشرف يرى مسيرات فرعه فقط
      if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
        return await db.getPayrollsByBranch(ctx.user.branchId);
      }
      return await db.getAllPayrolls();
    }),

    // الحصول على مسيرات فرع معين (متاح للمشرفين أيضاً)
    byBranch: supervisorInputProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input, ctx }) => {
        // المشرف يمكنه رؤية مسيرات فرعه فقط
        if (ctx.user.role === 'supervisor' && ctx.user.branchId && ctx.user.branchId !== input.branchId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك عرض مسيرات فرع آخر' });
        }
        return await db.getPayrollsByBranch(input.branchId);
      }),

    // الحصول على مسيرة بالمعرف (متاح للمشرفين أيضاً)
    getById: supervisorInputProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPayrollById(input.id);
      }),

    // الحصول على تفاصيل المسيرة (متاح للمشرفين أيضاً)
    details: supervisorInputProcedure
      .input(z.object({ payrollId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPayrollDetails(input.payrollId);
      }),

    // إنشاء مسيرة رواتب شهرية (متاح للمشرفين أيضاً)
    generate: supervisorInputProcedure
      .input(z.object({
        branchId: z.number(),
        branchName: z.string(),
        year: z.number(),
        month: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // التحقق من صلاحية المشرف - يمكنه إنشاء مسيرة لفرعه فقط
          if (ctx.user.role === 'supervisor' && ctx.user.branchId && ctx.user.branchId !== input.branchId) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك إنشاء مسيرة رواتب لفرع آخر' });
          }
          
          const payroll = await db.generateMonthlyPayroll(
            input.branchId,
            input.branchName,
            input.year,
            input.month,
            ctx.user.id,
            ctx.user.name || 'مسؤول'
          );
          
          // إرسال إشعار بريدي للأدمن عند إنشاء مسيرة جديدة
          const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
          const roleNames: Record<string, string> = {
            admin: 'مسؤول',
            manager: 'مدير',
            supervisor: 'مشرف',
            viewer: 'مشاهد',
            employee: 'موظف',
          };
          
          if (payroll) {
            emailNotifications.notifyNewPayrollCreated({
              createdByName: ctx.user.name || 'مستخدم',
              createdByRole: roleNames[ctx.user.role] || ctx.user.role,
              branchId: input.branchId,
              branchName: input.branchName,
              month: monthNames[input.month - 1] || `شهر ${input.month}`,
              year: input.year,
              employeeCount: payroll.employeeCount || 0,
              totalNetSalary: parseFloat(payroll.totalNetSalary || '0'),
            }).catch(err => payrollLogger.error('خطأ في إرسال إشعار مسيرة الرواتب', err));
          }
          
          return { success: true, message: 'تم إنشاء مسيرة الرواتب بنجاح', payroll };
        } catch (error: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
      }),

    // تحديث حالة المسيرة (الاعتماد للأدمن فقط)
    updateStatus: supervisorInputProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['draft', 'pending', 'approved', 'paid', 'cancelled']),
      }))
      .mutation(async ({ input, ctx }) => {
        // الاعتماد والدفع للأدمن فقط
        if ((input.status === 'approved' || input.status === 'paid') && ctx.user.role !== 'admin') {
          throw new TRPCError({ 
            code: 'FORBIDDEN', 
            message: 'فقط المسؤول يمكنه اعتماد أو تأكيد دفع المسيرة' 
          });
        }
        
        // الإلغاء للأدمن والمدير فقط
        if (input.status === 'cancelled' && ctx.user.role !== 'admin' && ctx.user.role !== 'manager') {
          throw new TRPCError({ 
            code: 'FORBIDDEN', 
            message: 'فقط المسؤول أو المدير يمكنه إلغاء المسيرة' 
          });
        }
        
        const updateData: any = { status: input.status };
        
        if (input.status === 'approved') {
          updateData.approvedBy = ctx.user.id;
          updateData.approvedByName = ctx.user.name;
          updateData.approvedAt = new Date();
        } else if (input.status === 'paid') {
          updateData.paidAt = new Date();
        }
        
        await db.updatePayroll(input.id, updateData);
        
        // إرسال إشعارات الراتب للموظفين عند الاعتماد
        if (input.status === 'approved') {
          try {
            // جلب بيانات المسيرة والتفاصيل
            const payroll = await db.getPayrollById(input.id);
            const details = await db.getPayrollDetails(input.id);
            
            if (payroll && details.length > 0) {
              // تحويل الشهر للعربية
              const monthNames = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
              const monthName = monthNames[payroll.month] || `شهر ${payroll.month}`;
              
              // تجهيز بيانات الموظفين للإشعار
              const employeesData = details.map((d: any) => ({
                employeeId: d.employeeId,
                employeeName: d.employeeName || 'موظف',
                employeeCode: d.employeeCode,
                email: d.employeeEmail,
                baseSalary: parseFloat(d.baseSalary || '0'),
                overtimeAmount: parseFloat(d.overtimeAmount || '0'),
                incentiveAmount: parseFloat(d.incentiveAmount || '0'),
                absentDeduction: parseFloat(d.absentDeduction || '0'),
                deductionAmount: parseFloat(d.deductionAmount || '0'),
                advanceDeduction: parseFloat(d.advanceDeduction || '0'),
                netSalary: parseFloat(d.netSalary || '0'),
                workDays: d.workDays,
                absentDays: d.absentDays,
              }));
              
              // إرسال الإشعارات
              emailNotifications.notifyEmployeesPayslip({
                payrollId: input.id,
                payrollNumber: payroll.payrollNumber || `PAY-${input.id}`,
                branchName: payroll.branchName || 'غير محدد',
                month: monthName,
                year: payroll.year,
                employees: employeesData,
              });
            }
          } catch (error) {
            payrollLogger.error('خطأ في إرسال إشعارات الراتب', error);
            // لا نريد إيقاف العملية بسبب فشل الإشعار
          }
        }
        
        const statusNames: Record<string, string> = {
          draft: 'مسودة',
          pending: 'قيد المراجعة',
          approved: 'معتمدة',
          paid: 'مدفوعة',
          cancelled: 'ملغاة',
        };
        
        return { success: true, message: `تم تحديث الحالة إلى: ${statusNames[input.status]}` };
      }),

    // حذف مسيرة
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePayroll(input.id);
        return { success: true, message: 'تم حذف مسيرة الرواتب بنجاح' };
      }),

    // تحديث تفاصيل راتب موظف
    updateDetail: adminProcedure
      .input(z.object({
        id: z.number(),
        deductionAmount: z.string().optional(),
        deductionReason: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePayrollDetail(id, data);
        return { success: true, message: 'تم تحديث بيانات الراتب بنجاح' };
      }),

    // إنشاء مسيرة رواتب مع التفاصيل (النموذج الجديد)
    createWithDetails: supervisorInputProcedure
      .input(z.object({
        branchId: z.number(),
        branchName: z.string(),
        year: z.number(),
        month: z.number(),
        totalBaseSalary: z.number(),
        totalOvertime: z.number(),
        totalIncentives: z.number(),
        totalDeductions: z.number(),
        totalNetSalary: z.number(),
        employeeCount: z.number(),
        details: z.array(z.object({
          employeeId: z.number(),
          employeeName: z.string(),
          employeeCode: z.string(),
          position: z.string().optional(),
          baseSalary: z.string(),
          overtimeEnabled: z.boolean(),
          overtimeAmount: z.string(),
          workDays: z.number(),
          absentDays: z.number(),
          absentDeduction: z.string(),
          incentiveAmount: z.string(),
          deductionAmount: z.string(),
          advanceDeduction: z.string(),
          negativeInvoicesDeduction: z.string().optional(),
          unpaidLeaveDeduction: z.string().optional(),
          grossSalary: z.string(),
          totalDeductions: z.string(),
          netSalary: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const payroll = await db.createPayrollWithDetails(
            input.branchId,
            input.branchName,
            input.year,
            input.month,
            input.totalBaseSalary,
            input.totalOvertime,
            input.totalIncentives,
            input.totalDeductions,
            input.totalNetSalary,
            input.employeeCount,
            input.details,
            ctx.user.id,
            ctx.user.name || 'موظف'
          );
          return { success: true, message: 'تم إنشاء مسيرة الرواتب وإرسالها للمراجعة', payroll };
        } catch (error: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
      }),
    // جلب الفواتير السالبة والإجازات بدون راتب للفرع في شهر معين
    getDeductionsPreview: supervisorInputProcedure
      .input(z.object({
        branchId: z.number(),
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        const negativeInvoices = await db.getNegativeInvoicesForMonth(input.branchId, input.year, input.month);
        const leaves = await db.getApprovedLeavesForBranch(input.branchId, input.year, input.month);
        
        // تحويل Map إلى Object للإرسال
        const invoicesObj: Record<number, { total: number; invoices: any[] }> = {};
        negativeInvoices.forEach((value, key) => {
          invoicesObj[key] = value;
        });
        
        const leavesObj: Record<number, { totalDays: number; totalDeduction: number; leaves: any[] }> = {};
        leaves.forEach((value, key) => {
          leavesObj[key] = value;
        });
        
        return {
          negativeInvoices: invoicesObj,
          leaves: leavesObj,
        };
      }),
  }),

  // ==================== إعدادات رواتب الموظفين ====================
  
  // الحصول على السلف غير المخصومة لفرع
  advancesForPayroll: router({
    // الحصول على السلف غير المخصومة لفرع
    getForBranch: supervisorInputProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUndeductedAdvancesForBranch(input.branchId);
      }),

    // الحصول على السلف غير المخصومة لموظف
    getForEmployee: supervisorInputProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUndeductedAdvancesForEmployee(input.employeeId);
      }),

    // تحديث حالة السلفة كمخصومة (عند اعتماد المسيرة)
    markAsDeducted: adminProcedure
      .input(z.object({
        advanceIds: z.array(z.number()),
        payrollId: z.number(),
      }))
      .mutation(async ({ input }) => {
        for (const advanceId of input.advanceIds) {
          await db.markAdvanceAsDeducted(advanceId, input.payrollId);
        }
        return { success: true, message: `تم تحديث ${input.advanceIds.length} سلفة كمخصومة` };
      }),
  }),

  salarySettings: router({
    // الحصول على إعدادات موظف
    get: managerProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmployeeSalarySetting(input.employeeId);
      }),

    // الحصول على جميع الإعدادات
    list: managerProcedure.query(async () => {
      return await db.getAllEmployeeSalarySettings();
    }),

    // تحديث إعدادات راتب موظف
    upsert: adminProcedure
      .input(z.object({
        employeeId: z.number(),
        baseSalary: z.string().default('2000.00'),
        overtimeEnabled: z.boolean().default(false),
        overtimeRate: z.string().default('1000.00'),
        isSupervisor: z.boolean().default(false),
        supervisorIncentive: z.string().default('400.00'),
        fixedDeduction: z.string().default('0.00'),
        fixedDeductionReason: z.string().optional(),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
        iban: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertEmployeeSalarySetting(input);
        return { success: true, message: 'تم حفظ إعدادات الراتب بنجاح' };
      }),

    // حذف إعدادات
    delete: adminProcedure
      .input(z.object({ employeeId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEmployeeSalarySetting(input.employeeId);
        return { success: true, message: 'تم حذف إعدادات الراتب بنجاح' };
      }),
  }),

  // ==================== المصاريف ====================
  expenses: router({
    // الحصول على جميع المصاريف
    list: protectedProcedure.query(async ({ ctx }) => {
      const expenses = await db.getAllExpenses();
      // المشرف يرى مصاريف فرعه فقط (إذا كان مرتبط بفرع)
      if (ctx.user.role === 'supervisor' && ctx.user.branchId !== null) {
        return expenses.filter(exp => exp.branchId === ctx.user.branchId || exp.createdBy === ctx.user.id);
      }
      return expenses;
    }),

    // الحصول على مصروف بالمعرف
    getById: managerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpenseById(input.id);
      }),

    // الحصول على المصاريف حسب الفترة
    byDateRange: managerProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return await db.getExpensesByDateRange(input.startDate, input.endDate);
      }),

    // الحصول على المصاريف حسب الفرع
    byBranch: managerProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpensesByBranch(input.branchId);
      }),

    // الحصول على المصاريف المعلقة
    pending: adminProcedure.query(async () => {
      return await db.getPendingExpenses();
    }),

    // إحصائيات المصاريف
    stats: managerProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getExpensesStats(input?.startDate, input?.endDate);
      }),

    // إنشاء مصروف - المشرف يمكنه الإدخال فقط
    create: supervisorInputProcedure
      .input(z.object({
        category: z.enum(['shop_supplies', 'printing', 'carpet_cleaning', 'small_needs', 'residency', 'medical_exam', 'transportation', 'electricity', 'internet', 'license_renewal', 'visa', 'residency_renewal', 'health_cert_renewal', 'maintenance', 'health_cert', 'violation', 'emergency', 'shop_rent', 'housing_rent', 'improvements', 'bonus', 'other']),
        title: z.string().min(1),
        description: z.string().optional(),
        amount: z.string(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        expenseDate: z.string(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'credit_card', 'other']).default('cash'),
        paymentReference: z.string().optional(),
        supplierId: z.number().optional(),
        supplierName: z.string().optional(),
        receiptNumber: z.string().optional(),
        attachments: z.string().optional(), // JSON string of attachments
      }))
      .mutation(async ({ input, ctx }) => {
        // التحقق من صلاحية الوصول للفرع للمشرفين
        if (ctx.user.role === 'supervisor' && ctx.user.branchId !== null && input.branchId && ctx.user.branchId !== input.branchId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك إدخال مصاريف لفرع آخر' });
        }

        // ==================== التحقق من صحة البيانات المالية ====================
        // التحقق من صحة مبلغ المصروف
        const amountValidation = financialValidation.validateAmount(input.amount, {
          fieldName: 'مبلغ المصروف',
          allowZero: false,
        });
        if (!amountValidation.success) {
          financialValidation.throwValidationError(amountValidation.errors);
        }

        // التحقق من صحة تاريخ المصروف
        const dateValidation = financialValidation.validateDate(input.expenseDate, {
          fieldName: 'تاريخ المصروف',
          allowFuture: false,
          maxDaysInPast: 90, // السماح بإدخال مصروفات حتى 90 يوم في الماضي
        });
        if (!dateValidation.success) {
          financialValidation.throwValidationError(dateValidation.errors);
        }

        // التحقق من صحة العنوان
        const titleValidation = financialValidation.validateText(input.title, {
          required: true,
          minLength: 3,
          maxLength: 200,
          fieldName: 'عنوان المصروف',
        });
        if (!titleValidation.success) {
          financialValidation.throwValidationError(titleValidation.errors);
        }

        // التحقق من صحة الوصف (إذا موجود)
        if (input.description) {
          const descValidation = financialValidation.validateText(input.description, {
            required: false,
            maxLength: 1000,
            fieldName: 'وصف المصروف',
          });
          if (!descValidation.success) {
            financialValidation.throwValidationError(descValidation.errors);
          }
        }
        // ==================== نهاية التحقق ====================

        const expenseNumber = await db.generateExpenseNumber();
        
        await db.createExpense({
          ...input,
          expenseNumber,
          expenseDate: new Date(input.expenseDate),
          status: 'pending',
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || 'مستخدم',
        });

        // إشعار المسؤول
        await notifyOwner({
          title: 'مصروف جديد',
          content: `تم إضافة مصروف جديد: ${input.title} بقيمة ${input.amount} ر.س.`,
        });

        // إرسال إشعار بريد إلكتروني إذا كان المصروف مرتفع (أكثر من 500 ر.س)
        const expenseAmount = parseFloat(input.amount);
        if (expenseAmount >= 500) {
          const categoryNames: Record<string, string> = {
            shop_supplies: 'مستلزمات المحل',
            printing: 'طباعة',
            carpet_cleaning: 'غسيل سجاد',
            small_needs: 'احتياجات صغيرة',
            residency: 'إقامة',
            medical_exam: 'فحص طبي',
            transportation: 'مواصلات',
            electricity: 'كهرباء',
            internet: 'إنترنت',
            license_renewal: 'تجديد رخصة',
            visa: 'تأشيرة',
            residency_renewal: 'تجديد إقامة',
            health_cert_renewal: 'تجديد شهادة صحية',
            maintenance: 'صيانة',
            health_cert: 'شهادة صحية',
            violation: 'مخالفة',
            emergency: 'طوارئ',
            shop_rent: 'إيجار محل',
            housing_rent: 'إيجار سكن',
            improvements: 'تحسينات',
            bonus: 'بونص',
            other: 'أخرى',
          };
          
          emailNotifications.notifyHighExpense({
            amount: expenseAmount,
            category: categoryNames[input.category] || input.category,
            description: input.description,
            branchId: input.branchId,
            branchName: input.branchName,
            date: input.expenseDate,
            threshold: 500,
          }).catch(err => notificationLogger.error('خطأ في إرسال إشعار المصروف', err));
        }

        // تشغيل المراقبة الذكية للمصاريف (Trigger)
        try {
          const { monitorNewExpense } = await import('./ai/smartMonitoringService');
          const monitoringResult = await monitorNewExpense({
            id: 0, // سيتم تحديثه
            branchId: input.branchId || 0,
            category: input.category,
            amount: Number(input.amount),
            description: input.description || '',
            date: input.expenseDate,
          });
          logger.info('تحليل المصروفات', { severity: monitoringResult.severity });
        } catch (error: any) {
          logger.error('خطأ في مراقبة المصروفات', error);
        }

        return { success: true, message: 'تم إضافة المصروف بنجاح' };
      }),

    // تحديث مصروف - الأدمن فقط
    update: adminOnlyEditProcedure
      .input(z.object({
        id: z.number(),
        category: z.enum(['shop_supplies', 'printing', 'carpet_cleaning', 'small_needs', 'residency', 'medical_exam', 'transportation', 'electricity', 'internet', 'license_renewal', 'visa', 'residency_renewal', 'health_cert_renewal', 'maintenance', 'health_cert', 'violation', 'emergency', 'shop_rent', 'housing_rent', 'improvements', 'bonus', 'other']).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        amount: z.string().optional(),
        expenseDate: z.string().optional(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'credit_card', 'other']).optional(),
        paymentReference: z.string().optional(),
        receiptNumber: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, expenseDate, ...data } = input;
        const updateData: any = { ...data };
        if (expenseDate) {
          updateData.expenseDate = new Date(expenseDate);
        }
        await db.updateExpense(id, updateData);
        return { success: true, message: 'تم تحديث المصروف بنجاح' };
      }),

    // تحديث حالة المصروف
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'approved', 'rejected', 'paid']),
        rejectionReason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateExpenseStatus(
          input.id,
          input.status,
          ctx.user.id,
          ctx.user.name || 'مسؤول',
          input.rejectionReason
        );

        // إنشاء سجل
        await db.createExpenseLog({
          expenseId: input.id,
          action: `تغيير الحالة إلى ${input.status}`,
          newStatus: input.status,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name,
          notes: input.rejectionReason,
        });

        const statusNames: Record<string, string> = {
          pending: 'قيد المراجعة',
          approved: 'معتمد',
          rejected: 'مرفوض',
          paid: 'مدفوع',
        };

        return { success: true, message: `تم تحديث الحالة إلى: ${statusNames[input.status]}` };
      }),

    // حذف مصروف - الأدمن فقط
    delete: adminOnlyEditProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExpense(input.id);
        return { success: true, message: 'تم حذف المصروف بنجاح' };
      }),

    // رفع مرفق للمصروف
    uploadAttachment: supervisorInputProcedure
      .input(z.object({
        base64Data: z.string(),
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import('./storage');
        
        // تحويل base64 إلى Buffer
        const base64Content = input.base64Data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');
        
        // إنشاء مفتاح فريد للمرفق
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `expense-attachments/${ctx.user.id}/${timestamp}-${randomSuffix}-${input.fileName}`;
        
        const { url, key } = await storagePut(fileKey, buffer, input.contentType);
        
        return { success: true, url, key, name: input.fileName };
      }),

    // تحديث مرفقات المصروف
    updateAttachments: supervisorInputProcedure
      .input(z.object({
        id: z.number(),
        attachments: z.array(z.object({
          url: z.string(),
          key: z.string(),
          name: z.string(),
          uploadedAt: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.updateExpense(input.id, {
          attachments: JSON.stringify(input.attachments),
        });
        return { success: true, message: 'تم تحديث المرفقات بنجاح' };
      }),

    // سجلات المصروف
    logs: managerProcedure
      .input(z.object({ expenseId: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpenseLogs(input.expenseId);
      }),

    // الحصول على جميع السلف المعتمدة
    advances: protectedProcedure.query(async ({ ctx }) => {
      // المشرف يرى سلف فرعه فقط
      if (ctx.user.role === 'supervisor' && ctx.user.branchId !== null) {
        return await db.getAllApprovedAdvances(ctx.user.branchId);
      }
      return await db.getAllApprovedAdvances();
    }),

    // إحصائيات السلف
    advancesStats: protectedProcedure.query(async ({ ctx }) => {
      // المشرف يرى إحصائيات فرعه فقط
      if (ctx.user.role === 'supervisor' && ctx.user.branchId !== null) {
        return await db.getAdvancesStats(ctx.user.branchId);
      }
      return await db.getAdvancesStats();
    }),
  }),

  // ==================== إجراءات الإعدادات ====================
  settings: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllSettings();
    }),
    
    getByCategory: protectedProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getSettingsByCategory(input.category);
      }),
    
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return await db.getSetting(input.key);
      }),
    
    update: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string().nullable(),
        type: z.enum(["text", "number", "boolean", "json", "image"]).optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertSetting({
          key: input.key,
          value: input.value,
          type: input.type,
          category: input.category,
          description: input.description,
          updatedBy: ctx.user.id,
        });
      }),
    
    bulkUpdate: adminProcedure
      .input(z.array(z.object({
        key: z.string(),
        value: z.string().nullable(),
      })))
      .mutation(async ({ input, ctx }) => {
        for (const setting of input) {
          await db.upsertSetting({
            key: setting.key,
            value: setting.value,
            updatedBy: ctx.user.id,
          });
        }
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        return await db.deleteSetting(input.key);
      }),
    
    initialize: adminProcedure.mutation(async () => {
      await db.initializeDefaultSettings();
      return { success: true };
    }),
  }),

  // ==================== مؤشرات الأداء المالي (KPIs) ====================
  kpis: router({
    // حساب مؤشرات الأداء المالي
    calculate: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.calculateFinancialKPIs(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // الحصول على سجل مؤشرات الأداء
    history: supervisorViewProcedure
      .input(z.object({
        periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
        limit: z.number().default(12),
      }))
      .query(async ({ input }) => {
        return await db.getFinancialKPIs(input.periodType, input.limit);
      }),

    // تحليل الاتجاهات الشهرية
    trends: supervisorViewProcedure
      .input(z.object({ months: z.number().default(12) }).optional())
      .query(async ({ input }) => {
        return await db.getMonthlyTrends(input?.months || 12);
      }),

    // تقرير ABC للمخزون
    abcReport: supervisorViewProcedure.query(async () => {
      return await db.getABCInventoryReport();
    }),
  }),

  // ==================== تنبيهات الأمان ====================
  security: router({
    // الحصول على التنبيهات غير المقروءة
    unreadAlerts: adminProcedure.query(async () => {
      return await db.getUnreadSecurityAlerts();
    }),

    // الحصول على جميع التنبيهات
    allAlerts: adminProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return await db.getAllSecurityAlerts(input?.limit || 100);
      }),

    // تحديث حالة التنبيه
    updateAlert: adminProcedure
      .input(z.object({
        id: z.number(),
        isRead: z.boolean().optional(),
        isResolved: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateSecurityAlert(input.id, {
          isRead: input.isRead,
          isResolved: input.isResolved,
          resolvedBy: input.isResolved ? ctx.user.id : undefined,
        });
        return { success: true };
      }),

    // محاولات تسجيل الدخول
    loginAttempts: adminProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return await db.getAllLoginAttempts(input?.limit || 100);
      }),

    // سجل تغييرات الأسعار
    priceChanges: adminProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return await db.getAllPriceChangeLogs(input?.limit || 100);
      }),

    // تغييرات الأسعار الكبيرة
    largePriceChanges: adminProcedure
      .input(z.object({ minPercentage: z.number().default(20) }).optional())
      .query(async ({ input }) => {
        return await db.getLargePriceChanges(input?.minPercentage || 20);
      }),
  }),

  // ==================== تقارير التدقيق ====================
  audit: router({
    // ملخص الأنشطة حسب المستخدم
    activitySummary: adminProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return await db.getActivitySummaryByUser(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),

    // العمليات غير المعتادة
    unusualActivities: adminProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return await db.getUnusualActivities(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
  }),

  // ==================== الصلاحيات التفصيلية ====================
  permissions: router({
    // الحصول على جميع الصلاحيات
    list: adminProcedure.query(async () => {
      return await db.getAllPermissions();
    }),

    // الحصول على صلاحيات مستخدم
    userPermissions: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserPermissions(input.userId);
      }),

    // منح صلاحية
    grant: adminProcedure
      .input(z.object({
        userId: z.number(),
        permissionId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.grantPermission(input.userId, input.permissionId, ctx.user.id);
        return { success: true, message: 'تم منح الصلاحية بنجاح' };
      }),

    // إلغاء صلاحية
    revoke: adminProcedure
      .input(z.object({
        userId: z.number(),
        permissionId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.revokePermission(input.userId, input.permissionId);
        return { success: true, message: 'تم إلغاء الصلاحية بنجاح' };
      }),

    // تهيئة الصلاحيات الافتراضية
    initialize: adminProcedure.mutation(async () => {
      await db.initializeDefaultPermissions();
      return { success: true, message: 'تم تهيئة الصلاحيات الافتراضية' };
    }),
  }),

  // ==================== إدارة المخزون المتقدمة ====================
  inventory: router({
    // تتبع الدفعات
    batches: router({
      // الحصول على دفعات منتج
      byProduct: managerProcedure
        .input(z.object({ productId: z.number() }))
        .query(async ({ input }) => {
          return await db.getProductBatches(input.productId);
        }),

      // إنشاء دفعة جديدة
      create: managerProcedure
        .input(z.object({
          productId: z.number(),
          batchNumber: z.string(),
          quantity: z.number(),
          costPrice: z.string(),
          manufacturingDate: z.string().optional(),
          expiryDate: z.string().optional(),
          supplierId: z.number().optional(),
          purchaseOrderId: z.number().optional(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          await db.createProductBatch({
            ...input,
            manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : undefined,
            expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
          });
          return { success: true, message: 'تم إنشاء الدفعة بنجاح' };
        }),

      // المنتجات قريبة الانتهاء
      expiring: managerProcedure
        .input(z.object({ daysAhead: z.number().default(30) }).optional())
        .query(async ({ input }) => {
          return await db.getExpiringProducts(input?.daysAhead || 30);
        }),
    }),

    // الجرد الدوري
    counts: router({
      // الحصول على جميع عمليات الجرد
      list: managerProcedure.query(async () => {
        return await db.getAllInventoryCounts();
      }),

      // الحصول على جرد بالمعرف
      getById: managerProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const count = await db.getInventoryCountById(input.id);
          if (!count) return null;
          const items = await db.getInventoryCountItems(input.id);
          return { ...count, items };
        }),

      // إنشاء جرد جديد
      create: managerProcedure
        .input(z.object({
          branchId: z.number().optional(),
          branchName: z.string().optional(),
          countDate: z.string(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await db.createInventoryCount({
            ...input,
            countDate: new Date(input.countDate),
            createdBy: ctx.user.id,
            createdByName: ctx.user.name || 'مستخدم',
          });
          return { success: true, message: 'تم إنشاء الجرد بنجاح' };
        }),

      // إضافة عنصر للجرد
      addItem: managerProcedure
        .input(z.object({
          countId: z.number(),
          productId: z.number(),
          productName: z.string(),
          productSku: z.string().optional(),
          systemQuantity: z.number(),
          countedQuantity: z.number(),
          unitCost: z.string(),
          reason: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await db.addInventoryCountItem({
            ...input,
            countedBy: ctx.user.id,
            countedAt: new Date(),
            status: 'counted',
          });
          return { success: true, message: 'تم إضافة العنصر بنجاح' };
        }),

      // حساب إحصائيات الجرد
      calculateStats: managerProcedure
        .input(z.object({ countId: z.number() }))
        .mutation(async ({ input }) => {
          const stats = await db.calculateInventoryCountStats(input.countId);
          return { success: true, stats };
        }),

      // تحديث حالة الجرد
      updateStatus: adminProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(['draft', 'in_progress', 'completed', 'approved']),
        }))
        .mutation(async ({ input, ctx }) => {
          const updateData: any = { status: input.status };
          if (input.status === 'approved') {
            updateData.approvedBy = ctx.user.id;
            updateData.approvedByName = ctx.user.name;
            updateData.approvedAt = new Date();
          }
          await db.updateInventoryCount(input.id, updateData);
          return { success: true, message: 'تم تحديث حالة الجرد' };
        }),
    }),

    // اقتراحات إعادة الطلب
    reorderSuggestions: router({
      // الحصول على الاقتراحات المعلقة
      pending: managerProcedure.query(async () => {
        return await db.getPendingSuggestedPurchaseOrders();
      }),

      // فحص وإنشاء اقتراحات جديدة
      check: managerProcedure.mutation(async () => {
        const suggestions = await db.checkAndCreateReorderSuggestions();
        return { 
          success: true, 
          message: `تم إنشاء ${suggestions.length} اقتراح جديد`,
          count: suggestions.length,
        };
      }),

      // تحديث حالة الاقتراح
      updateStatus: managerProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(['pending', 'approved', 'ordered', 'dismissed']),
          purchaseOrderId: z.number().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          const updateData: any = { status: input.status };
          if (input.status === 'approved') {
            updateData.approvedBy = ctx.user.id;
            updateData.approvedAt = new Date();
          }
          if (input.purchaseOrderId) {
            updateData.purchaseOrderId = input.purchaseOrderId;
          }
          await db.updateSuggestedPurchaseOrder(input.id, updateData);
          return { success: true, message: 'تم تحديث حالة الاقتراح' };
        }),
    }),
  }),

  // ==================== التقارير الدورية ====================
  scheduledReports: router({
    // إرسال التقرير الأسبوعي
    sendWeekly: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const result = await sendWeeklyReport(input.email);
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'فشل إرسال التقرير' });
        }
        return { success: true, message: 'تم إرسال التقرير الأسبوعي بنجاح' };
      }),

    // إرسال تنبيه المخزون
    sendLowStock: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const result = await sendLowStockAlert(input.email);
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'فشل إرسال التنبيه' });
        }
        return { success: true, message: 'تم إرسال تنبيه المخزون بنجاح' };
      }),

    // إرسال تقرير الأرباح الشهري
    sendMonthlyProfit: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const result = await sendMonthlyProfitReport(input.email);
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'فشل إرسال التقرير' });
        }
        return { success: true, message: 'تم إرسال تقرير الأرباح بنجاح' };
      }),

    // إرسال تنبيهات تراجع الأداء يدوياً
    sendPerformanceAlerts: adminProcedure
      .mutation(async () => {
        const { sendPerformanceAlerts } = await import('./notifications/performanceAlerts');
        const result = await sendPerformanceAlerts();
        if (!result.success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: result.errors.join(', ') || 'فشل إرسال التنبيهات' 
          });
        }
        return { 
          success: true, 
          message: result.alertsSent > 0 
            ? `تم إرسال ${result.alertsSent} تنبيه للمشرفين`
            : 'لا توجد تنبيهات تراجع أداء حالياً',
          alertsSent: result.alertsSent
        };
      }),

    // تقرير الإيرادات الشهري
    generateRevenueReport: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2030),
        branchId: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const { generateMonthlyRevenueReport } = await import('./reports/monthlyReports');
        const pdfBuffer = await generateMonthlyRevenueReport(input.month, input.year, input.branchId);
        return { 
          success: true, 
          pdf: pdfBuffer.toString('base64'),
          filename: `revenue-report-${input.year}-${input.month}.pdf`
        };
      }),

    // تقرير المصاريف الشهري
    generateExpenseReport: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2030),
        branchId: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const { generateMonthlyExpenseReport } = await import('./reports/monthlyReports');
        const pdfBuffer = await generateMonthlyExpenseReport(input.month, input.year, input.branchId);
        return { 
          success: true, 
          pdf: pdfBuffer.toString('base64'),
          filename: `expense-report-${input.year}-${input.month}.pdf`
        };
      }),

    // تقرير البونص الشهري
    generateBonusReport: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2030),
        branchId: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const { generateMonthlyBonusReport } = await import('./reports/monthlyReports');
        const pdfBuffer = await generateMonthlyBonusReport(input.month, input.year, input.branchId);
        return { 
          success: true, 
          pdf: pdfBuffer.toString('base64'),
          filename: `bonus-report-${input.year}-${input.month}.pdf`
        };
      }),

    // تقرير الربح والخسارة (P&L)
    profitLossReport: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2030),
        branchId: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const { generateProfitLossReport } = await import('./reports/monthlyReports');
        const pdfBuffer = await generateProfitLossReport(input.month, input.year, input.branchId);
        return { 
          success: true, 
          pdf: pdfBuffer.toString('base64'),
          filename: `profit-loss-report-${input.year}-${input.month}.pdf`
        };
      }),

    // تقرير مسير الرواتب
    payrollReport: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2030),
        branchId: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const { generatePayrollReport } = await import('./reports/monthlyReports');
        const pdfBuffer = await generatePayrollReport(input.month, input.year, input.branchId);
        return { 
          success: true, 
          pdf: pdfBuffer.toString('base64'),
          filename: `payroll-report-${input.year}-${input.month}.pdf`
        };
      }),

    // الحصول على أفضل المنتجات
    topProducts: supervisorViewProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getTopSellingProducts(input.limit, input.startDate, input.endDate);
      }),

    // الحصول على أفضل العملاء
    topCustomers: supervisorViewProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getTopCustomers(input.limit, input.startDate, input.endDate);
      }),

    // الحصول على بيانات المبيعات اليومية
    dailySales: supervisorViewProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getDailySalesData(input.startDate, input.endDate);
      }),

    // الحصول على المبيعات حسب الفئة
    salesByCategory: supervisorViewProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getSalesByCategory(input.startDate, input.endDate);
      }),
  }),

  // ==================== الجدولة ومراقب النظام ====================
  scheduler: router({
    // الحصول على جميع المهام المجدولة
    list: adminProcedure.query(async () => {
      return await db.getAllScheduledTasks();
    }),

    // إنشاء مهمة جديدة
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        taskType: z.string(),
        frequency: z.string().optional(),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        hour: z.number().optional(),
        minute: z.number().optional(),
        recipientEmails: z.string().optional(),
        thresholdValue: z.string().optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createScheduledTask({
          ...input,
          createdBy: ctx.user.id,
        });
        return { success: true, message: 'تم إنشاء المهمة بنجاح' };
      }),

    // تحديث مهمة
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isEnabled: z.boolean().optional(),
        frequency: z.string().optional(),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        hour: z.number().optional(),
        minute: z.number().optional(),
        recipientEmails: z.string().optional(),
        thresholdValue: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateScheduledTask(id, data);
        return { success: true, message: 'تم تحديث المهمة بنجاح' };
      }),

    // حذف مهمة
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteScheduledTask(input.id);
        return { success: true, message: 'تم حذف المهمة بنجاح' };
      }),

    // تنفيذ مهمة يدوياً
    execute: adminProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const tasks = await db.getAllScheduledTasks();
        const task = tasks.find((t: any) => t.id === input.taskId);
        if (!task) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'المهمة غير موجودة' });
        }
        
        const { executeScheduledTask } = await import('./monitor/systemMonitor');
        const result = await executeScheduledTask(task);
        return result;
      }),

    // الحصول على سجلات التنفيذ
    getLogs: adminProcedure
      .input(z.object({
        taskId: z.number().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getTaskExecutionLogs(input.taskId, input.limit || 50);
      }),

    // تشغيل مراقب النظام
    runMonitor: adminProcedure.mutation(async () => {
      const { runSystemMonitor } = await import('./monitor/systemMonitor');
      return await runSystemMonitor();
    }),

    // الحصول على إحصائيات التنبيهات
    getAlertStats: adminProcedure.query(async () => {
      return await db.getAlertStats();
    }),

    // الحصول على تنبيهات النظام
    getAlerts: adminProcedure
      .input(z.object({
        alertType: z.string().optional(),
        severity: z.string().optional(),
        isRead: z.boolean().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getSystemAlerts(input);
      }),

    // تحديث حالة التنبيه
    updateAlert: adminProcedure
      .input(z.object({
        id: z.number(),
        isRead: z.boolean().optional(),
        isResolved: z.boolean().optional(),
        resolvedNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateSystemAlert(id, {
          ...data,
          resolvedBy: data.isResolved ? ctx.user.id : undefined,
        });
        return { success: true, message: 'تم تحديث التنبيه' };
      }),
  }),

  // ==================== إدارة مستلمي الإشعارات ====================
  emailRecipients: router({
    // قائمة المستلمين
    list: adminProcedure.query(async () => {
      return await db.getNotificationRecipients();
    }),

    // إضافة مستلم جديد
    add: adminProcedure
      .input(z.object({
        name: z.string().min(1, 'الاسم مطلوب'),
        email: z.string().email('البريد الإلكتروني غير صحيح'),
        role: z.enum(['admin', 'general_supervisor', 'branch_supervisor']),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addNotificationRecipient(input);
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'notification_recipient',
          details: `تم إضافة مستلم إشعارات: ${input.name} (${input.email})`,
        });
        
        return { success: true, message: 'تم إضافة المستلم بنجاح' };
      }),

    // تحديث مستلم
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(['admin', 'general_supervisor', 'branch_supervisor']).optional(),
        branchId: z.number().nullable().optional(),
        branchName: z.string().nullable().optional(),
        receiveRevenueAlerts: z.boolean().optional(),
        receiveExpenseAlerts: z.boolean().optional(),
        receiveMismatchAlerts: z.boolean().optional(),
        receiveInventoryAlerts: z.boolean().optional(),
        receiveMonthlyReminders: z.boolean().optional(),
        receiveRequestNotifications: z.boolean().optional(),
        receiveReportNotifications: z.boolean().optional(),
        receiveBonusNotifications: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateNotificationRecipient(id, data);
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'update',
          entityType: 'notification_recipient',
          entityId: id,
          details: `تم تحديث مستلم إشعارات`,
        });
        
        return { success: true, message: 'تم تحديث المستلم بنجاح' };
      }),

    // حذف مستلم
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteNotificationRecipient(input.id);
        
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'notification_recipient',
          entityId: input.id,
          details: `تم حذف مستلم إشعارات`,
        });
        
        return { success: true, message: 'تم حذف المستلم بنجاح' };
      }),

    // إرسال بريد اختباري
    sendTest: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const result = await advancedNotifications.sendTestNotification(input.email);
        return result;
      }),

    // الحصول على سجل الإشعارات المرسلة
    getSentLogs: adminProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getSentNotifications({ limit: input.limit || 100 });
      }),
  }),

  // ==================== التنبيهات المتقدمة ====================
  advancedAlerts: router({
    // إرسال تنبيه إيراد منخفض
    sendLowRevenueAlert: adminProcedure
      .input(z.object({
        amount: z.number(),
        branchId: z.number(),
        branchName: z.string(),
        date: z.string(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await advancedNotifications.checkAndNotifyLowRevenue(input);
      }),

    // إرسال تنبيه مصروف مرتفع
    sendHighExpenseAlert: adminProcedure
      .input(z.object({
        amount: z.number(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        date: z.string(),
        category: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await advancedNotifications.checkAndNotifyHighExpense(input);
      }),

    // إرسال تنبيه إيراد غير متطابق
    sendMismatchAlert: adminProcedure
      .input(z.object({
        branchId: z.number(),
        branchName: z.string(),
        date: z.string(),
        reason: z.string(),
        difference: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await advancedNotifications.notifyRevenueMismatch(input);
      }),

    // إرسال تذكير الجرد الشهري
    // مهم: يستخدم النظام الموحد لمنع التكرار
    sendMonthlyReminder: adminProcedure.mutation(async () => {
      const { checkAndSendScheduledReminders } = await import('./notifications/scheduledNotificationService');
      const result = await checkAndSendScheduledReminders();
      
      if (result.inventoryResult?.skipped) {
        return { 
          success: false, 
          skipped: true,
          message: result.inventoryResult.reason || 'تم تخطي الإرسال - أُرسل مسبقاً اليوم'
        };
      }
      
      return { 
        success: result.inventoryResult?.success || false, 
        result: { sentCount: result.inventoryResult?.sentCount || 0 }
      };
    }),

    // إرسال إشعار طلب موظف
    sendEmployeeRequestNotification: adminProcedure
      .input(z.object({
        employeeName: z.string(),
        requestType: z.string(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        isUpdate: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await advancedNotifications.notifyEmployeeRequest(input);
      }),

    // إرسال إشعار طلب بونص
    sendBonusRequestNotification: adminProcedure
      .input(z.object({
        employeeName: z.string(),
        amount: z.number(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await advancedNotifications.notifyBonusRequest(input);
      }),

    // إرسال إشعار إنشاء مسيرة رواتب
    sendPayrollNotification: adminProcedure
      .input(z.object({
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        month: z.string(),
        totalAmount: z.number(),
        employeeCount: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await advancedNotifications.notifyPayrollCreated(input);
      }),

    // إرسال إشعار تحديث منتج
    sendProductUpdateNotification: adminProcedure
      .input(z.object({
        productName: z.string(),
        updateType: z.enum(['created', 'updated', 'deleted', 'low_stock']),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await advancedNotifications.notifyProductUpdate(input);
      }),

    // الحصول على حالة الإشعارات المجدولة اليوم
    getScheduledStatus: adminProcedure.query(async () => {
      const { getTodayNotificationStatus } = await import('./notifications/scheduledNotificationService');
      return await getTodayNotificationStatus();
    }),

    // الحصول على سجل الإشعارات المرسلة اليوم
    getTodaySentNotifications: adminProcedure.query(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const notifications = await db.getSentNotifications({
        startDate: today,
        endDate: new Date(),
      });
      
      return {
        date: today.toISOString().split('T')[0],
        count: notifications.length,
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.notificationType,
          subject: n.subject,
          status: n.status,
          sentAt: n.sentAt,
          recipientEmail: n.recipientEmail,
        })),
      };
    }),
  }),

  // ==================== نظام المراقبة الذكية ====================
  smartMonitoring: router({
    // توليد التقرير اليومي الذكي
    generateDailyReport: adminProcedure
      .input(z.object({
        date: z.string().optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const { generateSmartDailyReport } = await import('./ai/smartMonitoringService');
        const date = input?.date ? new Date(input.date) : undefined;
        return await generateSmartDailyReport(date);
      }),

    // التحقق من المبررات المعلقة
    checkPendingJustifications: adminProcedure.query(async () => {
      const { checkPendingJustifications } = await import('./ai/smartMonitoringService');
      return await checkPendingJustifications();
    }),

    // الحصول على إعدادات المراقبة
    getConfig: adminProcedure.query(async () => {
      const { MONITORING_CONFIG } = await import('./ai/smartMonitoringService');
      return MONITORING_CONFIG;
    }),

    // تحليل إيراد يدوياً
    analyzeRevenue: adminProcedure
      .input(z.object({
        branchId: z.number(),
        date: z.string(),
        cashRevenue: z.number(),
        networkRevenue: z.number(),
        madaRevenue: z.number().optional(),
        totalRevenue: z.number(),
        isMatching: z.boolean(),
        mismatchReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { analyzeRevenue } = await import('./ai/analysisEngine');
        return await analyzeRevenue({
          id: 0,
          ...input,
          madaRevenue: input.madaRevenue || 0,
        });
      }),

    // تحليل مصروف يدوياً
    analyzeExpense: adminProcedure
      .input(z.object({
        branchId: z.number(),
        category: z.string(),
        amount: z.number(),
        description: z.string(),
        date: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { analyzeExpense } = await import('./ai/analysisEngine');
        return await analyzeExpense({
          id: 0,
          ...input,
        });
      }),

    // تصدير البيانات إلى Google Sheets عبر Zapier
    exportToSheets: adminProcedure
      .input(z.object({
        type: z.enum(['revenues', 'expenses', 'report']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // سيتم تنفيذه لاحقاً مع Zapier webhook
        return {
          success: true,
          message: 'تم جدولة التصدير',
          type: input.type,
        };
      }),
  }),

  // ==================== التقارير الشهرية والتذكيرات ====================
  monthlyReports: router({
    // إرسال التقرير الشهري للمشرف العام
    sendReport: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      }))
      .mutation(async ({ input }) => {
        const { sendMonthlyReportToSupervisor } = await import('./reports/monthlyReportService');
        const success = await sendMonthlyReportToSupervisor(input.month, input.year);
        return {
          success,
          message: success ? 'تم إرسال التقرير الشهري بنجاح' : 'فشل إرسال التقرير',
        };
      }),

    // إرسال تذكير المصاريف لمشرفي الفروع
    sendExpenseReminder: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      }))
      .mutation(async ({ input }) => {
        const { sendExpenseReminder } = await import('./reports/monthlyReportService');
        const success = await sendExpenseReminder(input.month, input.year);
        return {
          success,
          message: success ? 'تم إرسال التذكيرات بنجاح' : 'فشل إرسال التذكيرات',
        };
      }),

    // الحصول على بيانات التقرير الشهري
    getData: protectedProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      }))
      .query(async ({ input }) => {
        const { getMonthlyReportData } = await import('./reports/monthlyReportService');
        return await getMonthlyReportData(input.month, input.year);
      }),
  }),

  // ==================== لوحة التحكم التنفيذية المحسنة ====================
  executiveDashboard: router({
    // حساب مؤشرات الأداء الفعلية
    kpis: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.calculateExecutiveKPIs(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // الإيرادات اليومية للرسم البياني
    dailyChart: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getDailyRevenuesForChart(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // مقارنة الأداء بين فترتين
    compare: supervisorViewProcedure
      .input(z.object({
        currentStart: z.string(),
        currentEnd: z.string(),
        previousStart: z.string(),
        previousEnd: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.comparePerformance(
          new Date(input.currentStart),
          new Date(input.currentEnd),
          new Date(input.previousStart),
          new Date(input.previousEnd),
          input.branchId
        );
      }),

    // أداء الموظفين
    employeesPerformance: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeesPerformance(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),
  }),

  // ==================== تذكيرات الجرد ====================
  inventoryReminders: router({
    // التحقق من موعد الجرد القادم
    nextDate: protectedProcedure.query(() => {
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      let nextDate: Date;
      let dayOfMonth: number;
      
      if (currentDay < 12) {
        nextDate = new Date(currentYear, currentMonth, 12);
        dayOfMonth = 12;
      } else if (currentDay < 27) {
        nextDate = new Date(currentYear, currentMonth, 27);
        dayOfMonth = 27;
      } else {
        nextDate = new Date(currentYear, currentMonth + 1, 12);
        dayOfMonth = 12;
      }
      
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return { 
        date: nextDate.toISOString(), 
        daysUntil, 
        dayOfMonth,
        isReminderDay: [0, 1, 3].includes(daysUntil),
      };
    }),

    // إرسال تذكير يدوي (للأدمن فقط)
    // مهم: يستخدم النظام الموحد لمنع التكرار
    sendManual: adminProcedure.mutation(async () => {
      const { getNextInventoryDate } = await import('./jobs/inventoryReminder');
      const { sendInventoryReminderUnified, getTodayNotificationStatus } = await import('./notifications/scheduledNotificationService');
      
      const { date, daysUntil } = getNextInventoryDate();
      const today = new Date();
      const dayOfMonth = today.getDate();
      
      // التحقق من حالة الإشعارات اليوم
      const status = await getTodayNotificationStatus();
      
      // إرسال فقط إذا كان اليوم 12 أو 29
      if (dayOfMonth === 12 || dayOfMonth === 29) {
        const result = await sendInventoryReminderUnified(dayOfMonth as 12 | 29);
        
        if (result.skipped) {
          return {
            success: false,
            message: `تم تخطي الإرسال - ${result.reason}`,
            nextInventoryDate: date.toISOString(),
            daysUntil,
          };
        }
        
        return { 
          success: result.success, 
          message: `تم إرسال ${result.sentCount} تذكير بنجاح`,
          nextInventoryDate: date.toISOString(),
          daysUntil,
        };
      }
      
      return {
        success: false,
        message: `اليوم ${dayOfMonth} - ليس موعد تذكير الجرد (يوم 12 أو 29 فقط)`,
        nextInventoryDate: date.toISOString(),
        daysUntil,
      };
    }),
  }),

  // ==================== نظام الجرد المتقدم ====================
  inventoryCounting: router({
    // بدء جرد جديد (متاح للمشرف أيضاً)
    start: supervisorInputProcedure
      .input(z.object({
        branchId: z.number().nullable().optional(),
        branchName: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { startNewInventoryCount, getBranchById } = await import('./db');
        
        // إذا كان المستخدم مشرف فرع، يستخدم فرعه تلقائياً
        let branchId = input.branchId || null;
        let branchName = input.branchName || null;
        
        if (ctx.user.role === 'supervisor' && ctx.user.branchId) {
          branchId = ctx.user.branchId;
          const branch = await getBranchById(ctx.user.branchId);
          branchName = branch?.name || null;
        }
        
        const result = await startNewInventoryCount(
          branchId,
          branchName,
          ctx.user.id,
          ctx.user.name || 'Unknown'
        );
        return result;
      }),

    // الحصول على الجرد الجاري
    active: protectedProcedure.query(async () => {
      const { getActiveInventoryCount } = await import('./db');
      return await getActiveInventoryCount();
    }),

    // الحصول على جميع عمليات الجرد
    list: protectedProcedure.query(async () => {
      const { getAllInventoryCounts } = await import('./db');
      return await getAllInventoryCounts();
    }),

    // الحصول على تفاصيل جرد
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getInventoryCountById } = await import('./db');
        return await getInventoryCountById(input.id);
      }),

    // الحصول على عناصر الجرد
    items: protectedProcedure
      .input(z.object({ countId: z.number() }))
      .query(async ({ input }) => {
        const { getInventoryCountItems } = await import('./db');
        return await getInventoryCountItems(input.countId);
      }),

    // البحث في عناصر الجرد
    searchItems: protectedProcedure
      .input(z.object({ countId: z.number(), searchTerm: z.string() }))
      .query(async ({ input }) => {
        const { searchInventoryCountItems } = await import('./db');
        return await searchInventoryCountItems(input.countId, input.searchTerm);
      }),

    // تحديث كمية منتج في الجرد
    updateItemQuantity: supervisorInputProcedure
      .input(z.object({
        itemId: z.number(),
        countedQuantity: z.number().min(0),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateInventoryCountItemQuantity } = await import('./db');
        return await updateInventoryCountItemQuantity(
          input.itemId,
          input.countedQuantity,
          ctx.user.id,
          input.reason
        );
      }),

    // تحديث سبب الفرق
    updateItemReason: supervisorInputProcedure
      .input(z.object({
        itemId: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { updateInventoryItemReason } = await import('./db');
        return await updateInventoryItemReason(input.itemId, input.reason);
      }),

    // تحديث اسم المنتج (متاح للمشرف والأدمن فقط)
    updateItemName: supervisorInputProcedure
      .input(z.object({
        itemId: z.number(),
        productName: z.string().min(1, "اسم المنتج مطلوب"),
      }))
      .mutation(async ({ ctx, input }) => {
        // فقط المشرف والأدمن يمكنهم تعديل اسم المنتج
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'supervisor') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك تعديل اسم المنتج' });
        }
        const { updateInventoryItemName } = await import('./db');
        return await updateInventoryItemName(input.itemId, input.productName);
      }),

    // تحديث المطلوب شهرياً (متاح للمشرف والأدمن فقط)
    updateMonthlyRequired: supervisorInputProcedure
      .input(z.object({
        itemId: z.number(),
        monthlyRequired: z.number().min(0, "يجب أن يكون الرقم موجباً"),
      }))
      .mutation(async ({ ctx, input }) => {
        // فقط المشرف والأدمن يمكنهم تعديل المطلوب شهرياً
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'supervisor') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك تعديل المطلوب شهرياً' });
        }
        const { updateInventoryMonthlyRequired } = await import('./db');
        return await updateInventoryMonthlyRequired(input.itemId, input.monthlyRequired);
      }),

    // تقرير فروقات الجرد
    varianceReport: supervisorViewProcedure
      .input(z.object({ countId: z.number() }))
      .query(async ({ input }) => {
        const { getInventoryVarianceReport } = await import('./db');
        return await getInventoryVarianceReport(input.countId);
      }),

    // اعتماد الجرد وتحديث المخزون (متاح للمشرف أيضاً)
    approve: supervisorInputProcedure
      .input(z.object({
        countId: z.number(),
        updateStock: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const { approveInventoryCount, getInventoryCountById } = await import('./db');
        
        // التحقق من صلاحية المشرف
        if (ctx.user.role === 'supervisor') {
          const count = await getInventoryCountById(input.countId);
          if (!count) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'لم يتم العثور على عملية الجرد' });
          }
          // المشرف يمكنه اعتماد جرد فرعه فقط أو الجرد الذي بدأه
          if (ctx.user.branchId && count.branchId !== ctx.user.branchId && count.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك اعتماد جرد فرع آخر' });
          }
        }
        
        return await approveInventoryCount(
          input.countId,
          ctx.user.id,
          ctx.user.name || 'Unknown',
          input.updateStock
        );
      }),

    // إلغاء الجرد (متاح للمشرف أيضاً)
    cancel: supervisorInputProcedure
      .input(z.object({ countId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { cancelInventoryCount, getInventoryCountById } = await import('./db');
        
        // التحقق من صلاحية المشرف
        if (ctx.user.role === 'supervisor') {
          const count = await getInventoryCountById(input.countId);
          if (!count) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'لم يتم العثور على عملية الجرد' });
          }
          // المشرف يمكنه إلغاء جرد فرعه فقط أو الجرد الذي بدأه
          if (ctx.user.branchId && count.branchId !== ctx.user.branchId && count.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك إلغاء جرد فرع آخر' });
          }
        }
        
        return await cancelInventoryCount(input.countId);
      }),

    // حساب إحصائيات الجرد
    calculateStats: protectedProcedure
      .input(z.object({ countId: z.number() }))
      .mutation(async ({ input }) => {
        const { calculateInventoryCountStats } = await import('./db');
        return await calculateInventoryCountStats(input.countId);
      }),
  }),

  // ==================== نظام المهام ====================
  tasks: router({
    // البحث عن مهمة بالرقم المرجعي (عام - لا يحتاج تسجيل دخول)
    getByReference: publicProcedure
      .input(z.object({ referenceNumber: z.string().length(6) }))
      .query(async ({ input }) => {
        const { getTaskByReference } = await import('./db');
        return await getTaskByReference(input.referenceNumber);
      }),

    // الحصول على مهمة بالـ ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getTaskById } = await import('./db');
        return await getTaskById(input.id);
      }),

    // الحصول على جميع المهام
    getAll: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        assignedToId: z.number().optional(),
        branchId: z.number().optional(),
        priority: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getAllTasks } = await import('./db');
        return await getAllTasks(input);
      }),

    // الحصول على مهام الموظف الحالي
    getMyTasks: protectedProcedure
      .query(async ({ ctx }) => {
        const { getTasksForEmployee } = await import('./db');
        return await getTasksForEmployee(ctx.user.id);
      }),

    // إحصائيات المهام
    getStats: protectedProcedure
      .query(async () => {
        const { getTaskStats } = await import('./db');
        return await getTaskStats();
      }),

    // إنشاء مهمة جديدة (للمشرفين والأدمن فقط)
    create: adminProcedure
      .input(z.object({
        subject: z.string().min(1, 'موضوع المهمة مطلوب'),
        details: z.string().optional(),
        requirement: z.string().min(1, 'المطلوب من الموظف مطلوب'),
        responseType: z.enum(['file_upload', 'confirmation', 'text_response', 'multiple_files']),
        confirmationYesText: z.string().optional(),
        confirmationNoText: z.string().optional(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        assignedToId: z.number(),
        assignedToName: z.string(),
        assignedToEmail: z.string().optional(),
        dueDate: z.date().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        attachments: z.array(z.string()).optional(), // مرفقات عند إنشاء المهمة
      }))
      .mutation(async ({ ctx, input }) => {
        const { createTask } = await import('./db');
        const task = await createTask({
          ...input,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || 'Unknown',
        });

        // إرسال إشعار بريد إلكتروني للموظف
        if (input.assignedToEmail) {
          try {
            await emailNotifications.notifyTaskAssignment({
              employeeEmail: input.assignedToEmail,
              employeeName: input.assignedToName,
              subject: input.subject,
              details: input.details,
              requirement: input.requirement,
              referenceNumber: task.referenceNumber,
              priority: input.priority || 'medium',
              dueDate: input.dueDate ? new Date(input.dueDate).toLocaleDateString('ar-SA') : undefined,
              branchName: input.branchName,
              createdByName: ctx.user.name || 'Unknown',
            });
          } catch (error) {
            notificationLogger.error('فشل إرسال إشعار المهمة', error);
          }
        }

        return task;
      }),

    // الاستجابة للمهمة (رفع ملف أو تأكيد)
    respond: publicProcedure
      .input(z.object({
        referenceNumber: z.string().length(6),
        responseType: z.enum(['file_upload', 'confirmation', 'text_response', 'multiple_files']),
        responseText: z.string().optional(),
        responseConfirmation: z.boolean().optional(),
        responseFiles: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { getTaskByReference, respondToTask, getTaskCreatorInfo } = await import('./db');
        
        const task = await getTaskByReference(input.referenceNumber);
        if (!task) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'المهمة غير موجودة' });
        }
        
        if (task.status === 'completed' || task.status === 'cancelled') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن الاستجابة لمهمة مكتملة أو ملغاة' });
        }
        
        const result = await respondToTask({
          taskId: task.id,
          responseType: input.responseType,
          responseText: input.responseText,
          responseConfirmation: input.responseConfirmation,
          responseFiles: input.responseFiles,
        });
        
        // إرسال إشعار للمشرف
        try {
          const creatorInfo = await getTaskCreatorInfo(task.id);
          if (creatorInfo?.email) {
            const { notifyTaskResponse } = await import('./notifications/emailNotificationService');
            await notifyTaskResponse({
              referenceNumber: input.referenceNumber,
              employeeName: task.assignedToName || 'موظف',
              branchName: task.branchName || 'غير محدد',
              subject: task.subject,
              responseType: input.responseType,
              responseValue: input.responseConfirmation !== undefined 
                ? (input.responseConfirmation ? 'yes' : 'no') 
                : input.responseText,
              hasAttachment: (input.responseFiles?.length || 0) > 0,
              creatorEmail: creatorInfo.email,
              creatorName: creatorInfo.name || 'المشرف',
            });
          }
        } catch (error) {
          notificationLogger.error('فشل إرسال إشعار الرد', error);
        }
        
        return result;
      }),

    // تحديث حالة المهمة
    updateStatus: adminProcedure
      .input(z.object({
        taskId: z.number(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateTaskStatus } = await import('./db');
        return await updateTaskStatus({
          taskId: input.taskId,
          status: input.status,
          updatedBy: ctx.user.id,
          updatedByName: ctx.user.name || 'Unknown',
          notes: input.notes,
        });
      }),

    // حذف مهمة
    delete: adminProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteTask } = await import('./db');
        return await deleteTask(input.taskId);
      }),

    // الحصول على سجل المهمة
    getLogs: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        const { getTaskLogs } = await import('./db');
        return await getTaskLogs(input.taskId);
      }),

    // الحصول على المهام المتأخرة
    getOverdue: protectedProcedure.query(async () => {
      const { getOverdueTasks } = await import('./db');
      return await getOverdueTasks();
    }),

    // رفع مرفق للمهمة
    uploadAttachment: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64
        fileType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import('./storage');
        
        // تحويل base64 إلى buffer
        const base64Data = input.fileData.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // إنشاء اسم فريد للملف
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const ext = input.fileName.split('.').pop() || 'file';
        const fileKey = `task-attachments/${timestamp}-${randomSuffix}.${ext}`;
        
        // رفع الملف إلى S3
        const result = await storagePut(fileKey, buffer, input.fileType);
        
        return { url: result.url, key: result.key };
      }),

  }),

  // ==================== نظام الولاء ====================
  loyalty: router({
    // تسجيل عميل جديد (عام - بدون تسجيل دخول)
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, 'الاسم مطلوب'),
        phone: z.string().min(10, 'رقم الجوال غير صحيح'),
        serviceType: z.string().min(1, 'نوع الخدمة مطلوب'),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        invoiceImageUrl: z.string().min(1, 'صورة الفاتورة مطلوبة'),
        invoiceImageKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { registerLoyaltyCustomer, registerLoyaltyVisit, getAdminsAndSupervisors } = await import('./db');
        const { sendEmail } = await import('./email/emailService');
        
        // تسجيل العميل
        const result = await registerLoyaltyCustomer({
          name: input.name,
          phone: input.phone,
          branchId: input.branchId,
          branchName: input.branchName,
        });
        
        if (!result.success || !result.customer) {
          return { success: false, error: result.error };
        }
        
        // تسجيل الزيارة الأولى
        const visitResult = await registerLoyaltyVisit({
          customerId: result.customer.id,
          customerName: result.customer.name,
          customerPhone: result.customer.phone,
          serviceType: input.serviceType,
          branchId: input.branchId,
          branchName: input.branchName,
          invoiceImageUrl: input.invoiceImageUrl,
          invoiceImageKey: input.invoiceImageKey,
        });
        
        return {
          success: true,
          customer: result.customer,
          visit: visitResult.visit,
          visitNumberInMonth: visitResult.visitNumberInMonth,
          message: `مرحباً ${input.name}! تم تسجيلك في برنامج الولاء بنجاح. سيتم مراجعة زيارتك والموافقة عليها.`,
        };
      }),

    // تسجيل زيارة لعميل مسجل (عام - بدون تسجيل دخول)
    // تسجيل زيارة لعميل مسجل (نظام دورة 30 يوم)
    recordVisit: publicProcedure
      .input(z.object({
        phone: z.string().min(10, 'رقم الجوال غير صحيح'),
        serviceType: z.string().min(1, 'نوع الخدمة مطلوب'),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        invoiceImageUrl: z.string().min(1, 'صورة الفاتورة مطلوبة'),
        invoiceImageKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getLoyaltyCustomerByPhone, registerLoyaltyVisitWithCycle, getCustomerVisitsInCycle, getAdminsAndSupervisors } = await import('./db');
        const { sendEmail } = await import('./email/emailService');
        
        // البحث عن العميل
        const customer = await getLoyaltyCustomerByPhone(input.phone);
        if (!customer) {
          return { success: false, error: 'رقم الجوال غير مسجل في برنامج الولاء' };
        }
        
        // التحقق من أن الزيارة الثالثة (زيارة الخصم) لا تحتوي على عرض
        const { visits: currentVisits, cycleInfo } = await getCustomerVisitsInCycle(customer.id);
        const { getLoyaltySettings } = await import('./db');
        const settings = await getLoyaltySettings();
        const requiredVisits = settings?.requiredVisitsForDiscount || 3;
        
        // إذا كانت الزيارة القادمة هي زيارة الخصم (الثالثة)
        const nextVisitNumber = currentVisits.length + 1;
        const isDiscountVisit = nextVisitNumber === requiredVisits;
        
        // منع اختيار العروض في زيارة الخصم
        if (isDiscountVisit && input.serviceType.includes('عرض')) {
          return { 
            success: false, 
            error: 'لا يمكن اختيار عرض في زيارة الخصم. الخصم 60% متاح فقط على الخدمات العادية وليس العروض.' 
          };
        }
        
        // تسجيل الزيارة بنظام الدورة الجديد (30 يوم)
        const result = await registerLoyaltyVisitWithCycle({
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          serviceType: input.serviceType,
          branchId: input.branchId,
          branchName: input.branchName,
          invoiceImageUrl: input.invoiceImageUrl,
          invoiceImageKey: input.invoiceImageKey,
        });
        
        if (!result.success) {
          return { success: false, error: result.error };
        }
        
        // إذا كانت زيارة خصم، إرسال إشعار للمشرفين
        if (result.isDiscountVisit) {
          const admins = await getAdminsAndSupervisors();
          const { visits } = await getCustomerVisitsInCycle(customer.id);
          
          // إعداد تفاصيل الزيارات
          const visitsDetails = visits.map((v, i) => 
            `${i + 1}. ${new Date(v.visitDate).toLocaleDateString('ar-SA')} - ${v.serviceType}`
          ).join('\n');
          
          // إرسال إيميل للمشرفين والأدمن
          for (const admin of admins) {
            if (admin.email) {
              await sendEmail({
                to: admin.email,
                subject: `🎉 عميل حصل على خصم 60% - ${customer.name}`,
                html: `
                  <div dir="rtl" style="font-family: Arial, sans-serif;">
                    <h2>🎉 تنبيه: عميل حصل على خصم برنامج الولاء</h2>
                    <p><strong>اسم العميل:</strong> ${customer.name}</p>
                    <p><strong>رقم الجوال:</strong> ${customer.phone}</p>
                    <p><strong>نسبة الخصم:</strong> 60%</p>
                    <p><strong>رقم الزيارة في الدورة:</strong> ${result.visitNumberInCycle}</p>
                    <p><strong>الفرع:</strong> ${input.branchName || 'غير محدد'}</p>
                    <p><strong>الأيام المتبقية في الدورة:</strong> ${result.cycleInfo.daysRemaining} يوم</p>
                    <hr/>
                    <h3>📋 تفاصيل الزيارات في الدورة:</h3>
                    <pre style="background: #f5f5f5; padding: 10px;">${visitsDetails}</pre>
                  </div>
                `,
              });
            }
          }
        }
        
        // رسالة مخصصة حسب حالة الدورة
        let message = '';
        if (result.isDiscountVisit) {
          message = `🎉 لقد حصلت على خصم 60%! يومك سعيد ${customer.name}`;
        } else if (result.cycleInfo.isNewCycle) {
          message = `مرحباً ${customer.name}! بدأت دورة جديدة لك. هذه زيارتك الأولى. باقي ${result.cycleInfo.daysRemaining} يوم لإكمال 3 زيارات والحصول على خصم 60%.`;
        } else {
          message = `شكراً لزيارتك ${customer.name}! هذه زيارتك رقم ${result.visitNumberInCycle}. باقي ${result.cycleInfo.daysRemaining} يوم لإكمال الدورة.`;
        }
        
        return {
          success: true,
          customer,
          visit: result.visit,
          isDiscountVisit: result.isDiscountVisit,
          discountPercentage: result.discountPercentage,
          visitNumberInCycle: result.visitNumberInCycle,
          visitNumberInMonth: result.visitNumberInCycle, // للتوافق مع الواجهة الحالية
          cycleInfo: result.cycleInfo,
          message,
        };
      }),

    // البحث عن عميل برقم الجوال (نظام دورة 30 يوم)
    findByPhone: publicProcedure
      .input(z.object({
        phone: z.string().min(10),
      }))
      .query(async ({ input }) => {
        const { findCustomerByPhoneWithCycle } = await import('./db');
        
        const { customer, cycleInfo } = await findCustomerByPhoneWithCycle(input.phone);
        if (!customer) {
          return { found: false };
        }
        
        // حساب الزيارات المتبقية للخصم
        const visitsUntilDiscount = cycleInfo.visitsInCycle >= 3 ? 0 : (3 - cycleInfo.visitsInCycle);
        const isEligibleForDiscount = cycleInfo.visitsInCycle >= 2 && !cycleInfo.discountUsed;
        
        // تفاصيل الزيارات مع التواريخ
        const visitsDetails = cycleInfo.visitsDetails.map((v, index) => ({
          id: v.id,
          visitDate: v.visitDate,
          serviceType: v.serviceType,
          branchName: '',
          visitNumber: index + 1,
        }));
        
        // تاريخ انتهاء الدورة
        const cycleEndDateFormatted = cycleInfo.endDate 
          ? new Date(cycleInfo.endDate).toLocaleDateString('ar-SA', { 
              day: 'numeric',
              month: 'long', 
              year: 'numeric',
            })
          : null;
        
        return {
          found: true,
          customer,
          visitsInCycle: cycleInfo.visitsInCycle,
          visitsThisMonth: cycleInfo.visitsInCycle, // للتوافق مع الواجهة الحالية
          visitsDetails,
          visitsUntilDiscount,
          isEligibleForDiscount,
          cycleInfo: {
            hasCycle: cycleInfo.hasCycle,
            startDate: cycleInfo.startDate,
            endDate: cycleInfo.endDate,
            endDateFormatted: cycleEndDateFormatted,
            daysRemaining: cycleInfo.daysRemaining,
            isExpired: cycleInfo.isExpired,
            discountUsed: cycleInfo.discountUsed,
          },
          nextDiscountAt: cycleInfo.visitsInCycle >= 3 ? 0 : (3 - cycleInfo.visitsInCycle),
        };
      }),

    // قائمة جميع العملاء (للمشرفين)
    list: supervisorInputProcedure.query(async () => {
      const { getAllLoyaltyCustomers } = await import('./db');
      return await getAllLoyaltyCustomers();
    }),

    // زيارات عميل معين (للمشرفين)
    customerVisits: supervisorInputProcedure
      .input(z.object({
        customerId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getCustomerVisits } = await import('./db');
        return await getCustomerVisits(input.customerId);
      }),

    // إحصائيات برنامج الولاء (للمشرفين)
    stats: supervisorInputProcedure.query(async () => {
      const { getLoyaltyStats } = await import('./db');
      return await getLoyaltyStats();
    }),

    // تقرير إحصائي شامل (للمشرفين والأدمن)
    detailedStats: supervisorInputProcedure
      .input(z.object({
        period: z.enum(['week', 'month', 'quarter', 'year', 'all']).optional(),
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getLoyaltyDetailedStats } = await import('./db');
        return await getLoyaltyDetailedStats(input);
      }),

    // إحصائيات فرع محدد
    branchStats: supervisorInputProcedure
      .input(z.object({
        branchId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getBranchLoyaltyStats } = await import('./db');
        return await getBranchLoyaltyStats(input.branchId);
      }),

    // الحصول على الفروع (عام)
    branches: publicProcedure.query(async () => {
      const { getBranches } = await import('./db');
      return await getBranches();
    }),

    // ==================== إعدادات نظام الولاء ====================
    
    // الحصول على إعدادات الولاء
    getSettings: publicProcedure.query(async () => {
      const { getLoyaltySettings } = await import('./db');
      return await getLoyaltySettings();
    }),

    // تحديث إعدادات الولاء (للأدمن فقط)
    updateSettings: adminProcedure
      .input(z.object({
        requiredVisitsForDiscount: z.number().min(1).max(20),
        discountPercentage: z.number().min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateLoyaltySettings, getLoyaltySettings, addLoyaltySettingsAuditLog } = await import('./db');
        
        // جلب الإعدادات القديمة قبل التحديث
        const oldSettings = await getLoyaltySettings();
        
        // تحديث الإعدادات
        const result = await updateLoyaltySettings(input);
        
        // تسجيل التغيير في سجل التدقيق
        await addLoyaltySettingsAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.username || 'مستخدم',
          changeType: 'settings',
          oldValues: JSON.stringify({
            requiredVisitsForDiscount: oldSettings?.requiredVisitsForDiscount,
            discountPercentage: oldSettings?.discountPercentage,
          }),
          newValues: JSON.stringify(input),
          description: `تم تحديث إعدادات الولاء: عدد الزيارات من ${oldSettings?.requiredVisitsForDiscount} إلى ${input.requiredVisitsForDiscount}، نسبة الخصم من ${oldSettings?.discountPercentage}% إلى ${input.discountPercentage}%`,
        });
        
        return result;
      }),

    // الحصول على سجل تغييرات الإعدادات (للأدمن فقط)
    getAuditLog: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(50),
      }).optional())
      .query(async ({ input }) => {
        const { getLoyaltySettingsAuditLog } = await import('./db');
        return await getLoyaltySettingsAuditLog(input?.limit || 50);
      }),

    // الحصول على أنواع الخدمات
    getServiceTypes: publicProcedure.query(async () => {
      const { getLoyaltyServiceTypes } = await import('./db');
      return await getLoyaltyServiceTypes();
    }),

    // إضافة نوع خدمة جديد (للأدمن فقط)
    addServiceType: adminProcedure
      .input(z.object({
        name: z.string().min(1, 'اسم الخدمة مطلوب'),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addLoyaltyServiceType, addLoyaltySettingsAuditLog } = await import('./db');
        const result = await addLoyaltyServiceType(input);
        
        // تسجيل التغيير في سجل التدقيق
        await addLoyaltySettingsAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.username || 'مستخدم',
          changeType: 'service_add',
          newValues: JSON.stringify(input),
          description: `تم إضافة خدمة جديدة: ${input.name}`,
          serviceId: result.id,
          serviceName: input.name,
        });
        
        return result;
      }),

    // تحديث نوع خدمة (للأدمن فقط)
    updateServiceType: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1, 'اسم الخدمة مطلوب'),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateLoyaltyServiceType, getLoyaltyServiceTypeById, addLoyaltySettingsAuditLog } = await import('./db');
        
        // جلب الخدمة القديمة قبل التحديث
        const oldService = await getLoyaltyServiceTypeById(input.id);
        
        const result = await updateLoyaltyServiceType(input);
        
        // تسجيل التغيير في سجل التدقيق
        await addLoyaltySettingsAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.username || 'مستخدم',
          changeType: 'service_update',
          oldValues: oldService ? JSON.stringify({ name: oldService.name, isActive: oldService.isActive, sortOrder: oldService.sortOrder }) : null,
          newValues: JSON.stringify(input),
          description: `تم تحديث الخدمة: ${oldService?.name || ''} → ${input.name}`,
          serviceId: input.id,
          serviceName: input.name,
        });
        
        return result;
      }),

    // حذف نوع خدمة (للأدمن فقط)
    deleteServiceType: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { deleteLoyaltyServiceType, getLoyaltyServiceTypeById, addLoyaltySettingsAuditLog } = await import('./db');
        
        // جلب الخدمة قبل الحذف
        const oldService = await getLoyaltyServiceTypeById(input.id);
        
        const result = await deleteLoyaltyServiceType(input.id);
        
        // تسجيل التغيير في سجل التدقيق
        if (oldService) {
          await addLoyaltySettingsAuditLog({
            userId: ctx.user.id,
            userName: ctx.user.name || ctx.user.username || 'مستخدم',
            changeType: 'service_delete',
            oldValues: JSON.stringify({ name: oldService.name, isActive: oldService.isActive }),
            description: `تم حذف الخدمة: ${oldService.name}`,
            serviceId: input.id,
            serviceName: oldService.name,
          });
        }
        
        return result;
      }),

    // ==================== إدارة الزيارات (للمشرفين) ====================
    
    // الحصول على عملاء الفرع (للمشرفين)
    branchCustomers: supervisorInputProcedure.query(async ({ ctx }) => {
      const { getLoyaltyCustomersByBranch, getAllLoyaltyCustomers } = await import('./db');
      
      // الأدمن يرى الكل
      if (ctx.user.role === 'admin') {
        return await getAllLoyaltyCustomers();
      }
      
      // المشرف يرى فرعه فقط
      if (!ctx.user.branchId) {
        return [];
      }
      
      return await getLoyaltyCustomersByBranch(ctx.user.branchId);
    }),

    // الحصول على الزيارات المعلقة (للمشرفين)
    pendingVisits: supervisorInputProcedure.query(async ({ ctx }) => {
      const { getPendingVisitsByBranch, getAllPendingVisits } = await import('./db');
      
      // الأدمن يرى الكل
      if (ctx.user.role === 'admin') {
        return await getAllPendingVisits();
      }
      
      // المشرف يرى فرعه فقط
      if (!ctx.user.branchId) {
        return [];
      }
      
      return await getPendingVisitsByBranch(ctx.user.branchId);
    }),

    // الحصول على زيارات الفرع (للمشرفين)
    branchVisits: supervisorInputProcedure.query(async ({ ctx }) => {
      const { getLoyaltyVisitsByBranch } = await import('./db');
      const { getAllLoyaltyCustomers } = await import('./db');
      
      // الأدمن يرى الكل
      if (ctx.user.role === 'admin') {
        const db = await import('./db');
        const { loyaltyVisits } = await import('../drizzle/schema');
        const { desc } = await import('drizzle-orm');
        const dbConn = await db.getDb();
        if (!dbConn) return [];
        return await dbConn.select().from(loyaltyVisits).orderBy(desc(loyaltyVisits.visitDate));
      }
      
      // المشرف يرى فرعه فقط
      if (!ctx.user.branchId) {
        return [];
      }
      
      return await getLoyaltyVisitsByBranch(ctx.user.branchId);
    }),

      // موافقة زيارة (للمشرفين والمشاهدين)
    approveVisit: supervisorInputProcedure
      .input(z.object({
        visitId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { approveVisit, getVisitById } = await import('./db');
        
        // التحقق من أن الزيارة تابعة لفرع المشرف
        const visit = await getVisitById(input.visitId);
        if (!visit) {
          return { success: false, error: 'الزيارة غير موجودة' };
        }
        
        // الأدمن يمكنه الموافقة على أي زيارة
        if (ctx.user.role !== 'admin') {
          if (visit.branchId !== ctx.user.branchId) {
            return { success: false, error: 'لا يمكنك الموافقة على زيارات فروع أخرى' };
          }
        }
        
        return await approveVisit(input.visitId, ctx.user.id);
      }),

    // رفض زيارة (للمشرفين والمشاهدين)
    rejectVisit: supervisorInputProcedure
      .input(z.object({
        visitId: z.number(),
        reason: z.string().min(1, 'سبب الرفض مطلوب'),
      }))
      .mutation(async ({ ctx, input }) => {
        const { rejectVisit, getVisitById } = await import('./db');
        
        // التحقق من أن الزيارة تابعة لفرع المشرف
        const visit = await getVisitById(input.visitId);
        if (!visit) {
          return { success: false, error: 'الزيارة غير موجودة' };
        }
        
        // الأدمن يمكنه الرفض لأي زيارة
        if (ctx.user.role !== 'admin') {
          if (visit.branchId !== ctx.user.branchId) {
            return { success: false, error: 'لا يمكنك رفض زيارات فروع أخرى' };
          }
        }
        
        return await rejectVisit(input.visitId, ctx.user.id, input.reason);
      }),

    // الحصول على تفاصيل زيارة
    visitDetails: supervisorInputProcedure
      .input(z.object({
        visitId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { getVisitById } = await import('./db');
        
        const visit = await getVisitById(input.visitId);
        if (!visit) {
          return null;
        }
        
        // التحقق من الصلاحية
        if (ctx.user.role !== 'admin' && visit.branchId !== ctx.user.branchId) {
          return null;
        }
        
        return visit;
      }),

    // رفع صورة الفاتورة (عام - بدون تسجيل دخول)
    uploadInvoiceImage: publicProcedure
      .input(z.object({
        base64Data: z.string(),
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { storagePut } = await import('./storage');
          
          // التحقق من وجود بيانات الصورة
          if (!input.base64Data || input.base64Data.length < 100) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'بيانات الصورة غير صالحة',
            });
          }
          
          // تحويل base64 إلى Buffer
          const base64Content = input.base64Data.replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(base64Content, 'base64');
          
          // التحقق من حجم الملف (10MB max)
          const maxSize = 10 * 1024 * 1024;
          if (buffer.length > maxSize) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'حجم الصورة يجب أن يكون أقل من 10 ميجابايت',
            });
          }
          
          // إنشاء اسم ملف فريد
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const fileKey = `loyalty-invoices/${timestamp}-${randomSuffix}-${input.fileName}`;
          
          logger.debug('رفع صورة الفاتورة', { fileKey, size: buffer.length });
          
          const { url, key } = await storagePut(fileKey, buffer, input.contentType);
          
          logger.info('نجاح رفع الصورة', { url });
          
          return { success: true, url, key };
        } catch (error: any) {
          logger.error('خطأ في رفع صورة الفاتورة', error);
          
          if (error instanceof TRPCError) {
            throw error;
          }
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error?.message || 'فشل رفع الصورة - يرجى المحاولة مرة أخرى',
          });
        }
      }),

    // ==================== طلبات حذف الزيارات ====================
    
    // طلب حذف زيارة
    requestVisitDeletion: supervisorInputProcedure
      .input(z.object({
        visitId: z.number(),
        deletionReason: z.string().min(10, 'سبب الحذف يجب أن يكون 10 أحرف على الأقل'),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getVisitById, createVisitDeletionRequest, hasPendingDeletionRequest } = await import('./db');
        
        // الحصول على الزيارة
        const visit = await getVisitById(input.visitId);
        if (!visit) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'الزيارة غير موجودة' });
        }
        
        // التحقق من الصلاحية (الأدمن يمكنه طلب حذف أي زيارة)
        if (ctx.user.role !== 'admin' && visit.branchId !== ctx.user.branchId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك طلب حذف زيارات فروع أخرى' });
        }
        
        // التحقق من عدم وجود طلب حذف معلق لنفس الزيارة
        const hasPending = await hasPendingDeletionRequest(input.visitId);
        if (hasPending) {
          throw new TRPCError({ code: 'CONFLICT', message: 'يوجد طلب حذف معلق لهذه الزيارة' });
        }
        
        // إنشاء طلب الحذف
        const requestId = await createVisitDeletionRequest({
          visitId: input.visitId,
          customerName: visit.customerName,
          customerPhone: visit.customerPhone,
          serviceType: visit.serviceType,
          visitDate: visit.visitDate,
          branchId: visit.branchId ?? undefined,
          branchName: visit.branchName ?? undefined,
          deletionReason: input.deletionReason,
          requestedBy: ctx.user.id,
          requestedByName: ctx.user.name ?? undefined,
        });
        
        return { success: true, requestId };
      }),

    // الحصول على طلبات الحذف المعلقة (للأدمن)
    pendingDeletionRequests: adminProcedure
      .query(async () => {
        const { getPendingDeletionRequests } = await import('./db');
        return await getPendingDeletionRequests();
      }),

    // الحصول على جميع طلبات الحذف (للأدمن)
    allDeletionRequests: adminProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const { getAllDeletionRequests } = await import('./db');
        return await getAllDeletionRequests(input?.limit || 50);
      }),

    // إحصائيات طلبات الحذف
    deletionRequestsStats: adminProcedure
      .query(async () => {
        const { getDeletionRequestsStats } = await import('./db');
        return await getDeletionRequestsStats();
      }),

    // الموافقة على طلب الحذف (للأدمن فقط)
    approveDeletionRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { approveDeletionRequest } = await import('./db');
        
        const result = await approveDeletionRequest(
          input.requestId,
          ctx.user.id,
          ctx.user.name || 'أدمن',
          input.adminNotes
        );
        
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'فشل الموافقة' });
        }
        
        return result;
      }),

    // رفض طلب الحذف (للأدمن فقط)
    rejectDeletionRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        adminNotes: z.string().min(5, 'يجب كتابة سبب الرفض'),
      }))
      .mutation(async ({ ctx, input }) => {
        const { rejectDeletionRequest } = await import('./db');
        
        const result = await rejectDeletionRequest(
          input.requestId,
          ctx.user.id,
          ctx.user.name || 'أدمن',
          input.adminNotes
        );
        
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'فشل الرفض' });
        }
        
        return result;
      }),

    // التحقق من وجود طلب حذف معلق لزيارة
    hasPendingDeletion: supervisorInputProcedure
      .input(z.object({ visitId: z.number() }))
      .query(async ({ input }) => {
        const { hasPendingDeletionRequest } = await import('./db');
        return await hasPendingDeletionRequest(input.visitId);
      }),

    // حذف زيارة مباشرة (للأدمن فقط)
    deleteVisit: adminProcedure
      .input(z.object({
        visitId: z.number(),
        reason: z.string().min(5, 'يجب كتابة سبب الحذف (5 أحرف على الأقل)'),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getVisitById, deleteLoyaltyVisit, createVisitDeletionRequest } = await import('./db');
        
        // التحقق من وجود الزيارة
        const visit = await getVisitById(input.visitId);
        if (!visit) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'الزيارة غير موجودة' });
        }
        
        // تسجيل طلب الحذف للسجلات (مع حالة موافق عليه مباشرة)
        await createVisitDeletionRequest({
          visitId: input.visitId,
          customerName: visit.customerName || 'غير محدد',
          customerPhone: visit.customerPhone || '',
          serviceType: visit.serviceType || undefined,
          visitDate: visit.visitDate ? new Date(visit.visitDate) : undefined,
          branchId: visit.branchId || undefined,
          branchName: visit.branchName || undefined,
          deletionReason: `[حذف مباشر بواسطة الأدمن] ${input.reason}`,
          requestedBy: ctx.user.id,
          requestedByName: ctx.user.name || 'أدمن',
        });
        
        // حذف الزيارة مباشرة
        const result = await deleteLoyaltyVisit(input.visitId);
        
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'فشل حذف الزيارة' });
        }
        
        return { success: true, message: 'تم حذف الزيارة بنجاح' };
      }),

    // ==================== سجل الخصومات ====================
    
    // إنشاء سجل خصم جديد
    createDiscountRecord: supervisorInputProcedure
      .input(z.object({
        customerId: z.number().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        originalAmount: z.number().min(0),
        discountPercentage: z.number().min(0).max(100),
        discountAmount: z.number().min(0),
        finalAmount: z.number().min(0),
        visitId: z.number().optional(),
        isPrinted: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createDiscountRecord } = await import('./db');
        
        const result = await createDiscountRecord({
          ...input,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || 'مستخدم',
        });
        
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل حفظ سجل الخصم' });
        }
        
        return result;
      }),

    // الحصول على سجلات الخصومات
    getDiscountRecords: supervisorInputProcedure
      .input(z.object({
        branchId: z.number().optional(),
        customerId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getDiscountRecords } = await import('./db');
        return await getDiscountRecords(input || {});
      }),

    // الحصول على إحصائيات الخصومات
    getDiscountStats: supervisorInputProcedure
      .input(z.object({
        branchId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getDiscountStats } = await import('./db');
        return await getDiscountStats(input || {});
      }),

    // تحديث سجل الخصم كمطبوع
    markDiscountPrinted: supervisorInputProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { markDiscountAsPrinted } = await import('./db');
        return await markDiscountAsPrinted(input.id);
      }),

    // ==================== نظام حاسبة الخصم الذكي ====================
    
    // الحصول على العملاء المؤهلين للخصم
    getEligibleCustomers: supervisorInputProcedure
      .input(z.object({
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getEligibleCustomersForDiscount } = await import('./db');
        // إذا كان المستخدم مشرف فرع، يرى عملاء فرعه فقط
        const branchId = ctx.user.role === 'supervisor' && ctx.user.branchId 
          ? ctx.user.branchId 
          : input?.branchId;
        return await getEligibleCustomersForDiscount(branchId);
      }),

    // التحقق من أهلية عميل محدد
    verifyCustomerEligibility: supervisorInputProcedure
      .input(z.object({
        customerId: z.number(),
      }))
      .query(async ({ input }) => {
        const { verifyCustomerDiscountEligibility } = await import('./db');
        return await verifyCustomerDiscountEligibility(input.customerId);
      }),

    // إنشاء سجل خصم مع التحقق من الأهلية (النظام الذكي)
    createVerifiedDiscount: supervisorInputProcedure
      .input(z.object({
        customerId: z.number(),
        originalAmount: z.number().min(0),
        discountPercentage: z.number().min(0).max(100),
        discountAmount: z.number().min(0),
        finalAmount: z.number().min(0),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createVerifiedDiscountRecord } = await import('./db');
        
        const result = await createVerifiedDiscountRecord({
          ...input,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || 'مستخدم',
        });
        
        if (!result.success) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: result.error || 'فشل إنشاء سجل الخصم' 
          });
        }
        
        // إرسال تنبيه إذا كانت درجة المخاطرة عالية
        if (result.aiRiskLevel === 'high' || result.aiRiskLevel === 'critical') {
          const { getAdminsAndSupervisors } = await import('./db');
          const { sendEmail } = await import('./email/emailService');
          
          const admins = await getAdminsAndSupervisors();
          for (const admin of admins) {
            if (admin.email && admin.role === 'admin') {
              await sendEmail({
                to: admin.email,
                subject: `⚠️ تنبيه أمني: خصم بدرجة مخاطرة ${result.aiRiskLevel === 'critical' ? 'حرجة' : 'عالية'}`,
                html: `
                  <div dir="rtl" style="font-family: Arial, sans-serif;">
                    <h2 style="color: #dc2626;">⚠️ تنبيه أمني - نظام الذكاء الاصطناعي</h2>
                    <p>تم رصد عملية خصم بدرجة مخاطرة ${result.aiRiskLevel === 'critical' ? 'حرجة' : 'عالية'}:</p>
                    <ul>
                      <li><strong>رقم الإيصال:</strong> ${result.recordId}</li>
                      <li><strong>درجة المخاطرة:</strong> ${result.aiRiskScore}/100</li>
                      <li><strong>المبلغ الأصلي:</strong> ${input.originalAmount} ر.س</li>
                      <li><strong>الموظف:</strong> ${ctx.user.name}</li>
                    </ul>
                    <p><strong>ملاحظات التحليل:</strong></p>
                    <p style="background: #fef2f2; padding: 10px; border-radius: 5px;">${result.aiAnalysisNotes}</p>
                    <p>يرجى مراجعة هذه العملية في أقرب وقت.</p>
                  </div>
                `,
              });
            }
          }
        }
        
        return result;
      }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🧠 الدوال الذكية المتقدمة
  // ═══════════════════════════════════════════════════════════════════════════════
  intelligence: router({
    // كشف الشذوذ في الإيرادات
    detectAnomalies: adminProcedure
      .input(z.object({
        branchId: z.number(),
        analysisDate: z.date().optional(),
        lookbackDays: z.number().optional(),
        zScoreThreshold: z.number().optional(),
        includeEmployeeLevel: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const { detectRevenueAnomalies } = await import('./intelligent_functions');
        return detectRevenueAnomalies(
          input.branchId,
          input.analysisDate || new Date(),
          {
            lookbackDays: input.lookbackDays,
            zScoreThreshold: input.zScoreThreshold,
            includeEmployeeLevel: input.includeEmployeeLevel,
          }
        );
      }),

    // كشف أنماط التلاعب
    detectFraud: adminProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        const { detectFraudPatterns } = await import('./intelligent_functions');
        return detectFraudPatterns(input.branchId, input.startDate, input.endDate);
      }),

    // كشف أنماط أداء الموظفين
    detectPerformancePatterns: adminProcedure
      .input(z.object({
        branchId: z.number(),
        analysisDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const { detectPerformancePatterns } = await import('./intelligent_functions');
        return detectPerformancePatterns(
          input.branchId,
          input.analysisDate || new Date()
        );
      }),

    // التنبيهات الاستباقية
    getProactiveAlerts: adminProcedure
      .input(z.object({
        branchId: z.number(),
        currentDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const { generateProactiveAlerts } = await import('./intelligent_functions');
        return generateProactiveAlerts(
          input.branchId,
          input.currentDate || new Date()
        );
      }),

    // التوصيات الذكية
    getSmartRecommendations: adminProcedure
      .input(z.object({
        branchId: z.number(),
        analysisDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const { generateSmartRecommendations } = await import('./intelligent_functions');
        return generateSmartRecommendations(
          input.branchId,
          input.analysisDate || new Date()
        );
      }),

    // التصحيح التلقائي
    executeAutoCorrection: adminProcedure
      .input(z.object({
        branchId: z.number(),
        correctionType: z.enum(['recalculate', 'fix_negatives', 'remove_duplicates', 'fix_orphans']),
      }))
      .mutation(async ({ input }) => {
        const { executeAutoCorrection } = await import('./intelligent_functions');
        return executeAutoCorrection(input.branchId, input.correctionType);
      }),

    // فحص سلامة البيانات
    checkDataIntegrity: adminProcedure
      .input(z.object({
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { checkDataIntegrity } = await import('./intelligent_functions');
        return checkDataIntegrity(input.branchId);
      }),
  }),

  receiptVoucher: router({
    create: supervisorInputProcedure
      .input(z.object({
        voucherDate: z.date(),
        dueDateFrom: z.date().optional(),
        dueDateTo: z.date().optional(),
        dueDate: z.date().optional(), // للتوافق العكسي
        payeeName: z.string().min(1),
        payeeAddress: z.string().optional(),
        payeePhone: z.string().optional(),
        payeeEmail: z.string().optional(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
        description: z.string().optional(),
        notes: z.string().optional(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'credit_card', 'other']).default('cash'),
        items: z.array(z.object({
          description: z.string().min(1),
          amount: z.number().positive(),
          notes: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createReceiptVoucher } = await import('./receiptVoucher');
        const createdByName = (ctx.user?.name as string) || (ctx.user?.username as string) || 'Unknown';
        return createReceiptVoucher({
          ...input,
          createdBy: ctx.user.id,
          createdByName,
        });
      }),

    get: supervisorInputProcedure
      .input(z.object({
        voucherId: z.string(),
      }))
      .query(async ({ input }) => {
        const { getReceiptVoucher } = await import('./receiptVoucher');
        return getReceiptVoucher(input.voucherId);
      }),

    getAll: supervisorInputProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const { getAllReceiptVouchers } = await import('./receiptVoucher');
        return getAllReceiptVouchers(input.limit, input.offset);
      }),

    updateStatus: supervisorInputProcedure
      .input(z.object({
        voucherId: z.string(),
        status: z.enum(['draft', 'approved', 'paid', 'cancelled']),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateReceiptVoucherStatus } = await import('./receiptVoucher');
        const approvedByName = (ctx.user?.name as string | undefined) || (ctx.user?.username as string | undefined);
        return updateReceiptVoucherStatus(
          input.voucherId,
          input.status,
          ctx.user.id,
          approvedByName
        );
      }),

    delete: adminProcedure
      .input(z.object({
        voucherId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { deleteReceiptVoucher } = await import('./receiptVoucher');
        return deleteReceiptVoucher(input.voucherId);
      }),

    sendEmail: supervisorInputProcedure
      .input(z.object({
        voucherId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { getReceiptVoucher } = await import('./receiptVoucher');
        const { sendReceiptVoucherEmail } = await import('./receiptVoucherEmail');
        
        const voucher = await getReceiptVoucher(input.voucherId);
        if (!voucher) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'السند غير موجود' });
        }

        const result = await sendReceiptVoucherEmail({
          voucherId: voucher.voucherId,
          voucherNumber: voucher.voucherId,
          voucherDate: voucher.voucherDate.toISOString(),
          payeeName: voucher.payeeName,
          payeeEmail: voucher.payeeEmail || undefined,
          totalAmount: voucher.totalAmount,
          branchId: voucher.branchId || undefined,
          branchName: voucher.branchName || undefined,
          items: voucher.items || [],
          createdByName: voucher.createdByName,
        });

        return result;
      }),

    // توليد PDF لسند قبض فردي
    generatePDF: supervisorInputProcedure
      .input(z.object({
        voucherId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { getReceiptVoucher } = await import('./receiptVoucher');
        const { generateSingleReceiptVoucherPDF } = await import('./pdfService');
        
        const voucher = await getReceiptVoucher(input.voucherId);
        if (!voucher) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'السند غير موجود' });
        }

        const pdfBuffer = await generateSingleReceiptVoucherPDF({
          voucherId: voucher.voucherId,
          voucherDate: voucher.voucherDate,
          dueDateFrom: voucher.dueDateFrom,
          dueDateTo: voucher.dueDateTo,
          payeeName: voucher.payeeName,
          payeePhone: voucher.payeePhone,
          payeeEmail: voucher.payeeEmail,
          branchName: voucher.branchName,
          totalAmount: voucher.totalAmount,
          status: voucher.status,
          createdByName: voucher.createdByName,
          createdAt: voucher.createdAt,
          notes: voucher.notes,
          items: voucher.items || [],
        });
        
        // تحويل Buffer إلى Base64 لإرساله للعميل
        const base64PDF = pdfBuffer.toString('base64');
        return { pdf: base64PDF, filename: `receipt-voucher-${voucher.voucherId}.pdf` };
      }),

    generateReportPDF: supervisorInputProcedure
      .input(z.object({
        title: z.string(),
        periodType: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        branchName: z.string(),
        statistics: z.object({
          count: z.number(),
          totalAmount: z.number(),
          averageAmount: z.number(),
        }),
        receipts: z.array(z.object({
          voucherId: z.string(),
          voucherDate: z.string(),
          payeeName: z.string(),
          totalAmount: z.string(),
          status: z.string(),
          createdByName: z.string(),
          notes: z.string().optional(),
          branchName: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { generateReceiptVoucherReportPDF } = await import('./pdfService');
        const pdfBuffer = await generateReceiptVoucherReportPDF(input);
        
        // تحويل Buffer إلى Base64 لإرساله للعميل
        const base64PDF = pdfBuffer.toString('base64');
        return { pdf: base64PDF };
      }),

    // تقرير السندات الشهري
    getMonthlyReport: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        status: z.enum(['draft', 'approved', 'paid', 'cancelled', 'all']).optional(),
        branchId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getVouchersForReport } = await import('./db');
        return getVouchersForReport({
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: input.status,
          branchId: input.branchId,
        });
      }),

    // توليد PDF لتقرير السندات الشهري
    generateMonthlyReportPDF: supervisorInputProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        status: z.enum(['draft', 'approved', 'paid', 'cancelled', 'all']).optional(),
        branchId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getVouchersForReport } = await import('./db');
        const { generateVouchersReportPDF } = await import('./pdfService');
        
        const reportData = await getVouchersForReport({
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: input.status,
          branchId: input.branchId,
        });
        
        if (!reportData) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في جلب بيانات التقرير' });
        }
        
        const pdfBuffer = await generateVouchersReportPDF(reportData);
        const base64PDF = pdfBuffer.toString('base64');
        return { pdf: base64PDF, filename: `vouchers-report-${new Date().toISOString().split('T')[0]}.pdf` };
      }),
  }),

  // ==================== تحليلات BI والذكاء الاصطناعي ====================
  bi: router({
    // الملخص التنفيذي
    getExecutiveSummary: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return biAnalytics.getExecutiveSummary(
          { startDate: new Date(input.startDate), endDate: new Date(input.endDate) },
          input.branchId
        );
      }),

    // تحليلات المبيعات
    getSalesAnalytics: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
        groupBy: z.enum(['day', 'week', 'month']).optional(),
      }))
      .query(async ({ input }) => {
        return biAnalytics.getSalesAnalytics(
          { startDate: new Date(input.startDate), endDate: new Date(input.endDate) },
          input.branchId,
          input.groupBy || 'day'
        );
      }),

    // تحليلات المخزون
    getInventoryAnalytics: supervisorViewProcedure
      .input(z.object({
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return biAnalytics.getInventoryAnalytics(input?.branchId);
      }),

    // التحليلات المالية
    getFinancialAnalytics: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return biAnalytics.getFinancialAnalytics(
          { startDate: new Date(input.startDate), endDate: new Date(input.endDate) },
          input.branchId
        );
      }),

    // مقارنة الفروع
    getBranchComparison: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        metric: z.enum(['sales', 'expenses', 'profit', 'customers']),
      }))
      .query(async ({ input }) => {
        return biAnalytics.getBranchComparison(
          { startDate: new Date(input.startDate), endDate: new Date(input.endDate) },
          input.metric
        );
      }),

    // التنبؤ بالمبيعات (AI)
    forecastSales: supervisorViewProcedure
      .input(z.object({
        branchId: z.number().optional(),
        days: z.number().min(1).max(30).optional(),
      }).optional())
      .query(async ({ input }) => {
        return aiAnalytics.forecastSales(input?.branchId, input?.days || 7);
      }),

    // تحليل شرائح العملاء (RFM)
    getCustomerSegments: supervisorViewProcedure
      .query(async () => {
        return aiAnalytics.analyzeCustomerSegments();
      }),

    // الكشف عن الشذوذ
    detectAnomalies: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        sendNotifications: z.boolean().optional(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return aiAnalytics.detectAnomalies(
          {
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate)
          },
          {
            sendNotifications: input.sendNotifications,
            branchId: input.branchId,
          }
        );
      }),

    // التوصيات الذكية
    getSmartRecommendations: supervisorViewProcedure
      .query(async () => {
        return aiAnalytics.getSmartRecommendations();
      }),

    // رؤى AI الشاملة
    getAIInsights: supervisorViewProcedure
      .input(z.object({
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return aiAnalytics.getAIInsights(input?.branchId);
      }),

    // ==================== تحليلات الإيرادات والمصاريف الجديدة ====================
    
    // تحليل الإيرادات
    analyzeRevenues: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return revenueAnalytics.analyzeRevenues(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // تحليل المصاريف
    analyzeExpenses: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return revenueAnalytics.analyzeExpenses(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // تحليل أداء الموظفين
    analyzeEmployeePerformance: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return revenueAnalytics.analyzeEmployeePerformance(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // تحليل الربحية
    analyzeProfitability: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return revenueAnalytics.analyzeProfitability(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // رؤى AI الشاملة المبنية على الإيرادات والمصاريف
    getComprehensiveInsights: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return revenueAnalytics.getComprehensiveAIInsights(
          new Date(input.startDate),
          new Date(input.endDate),
          input.branchId
        );
      }),

    // التنبؤ بالإيرادات
    forecastRevenue: supervisorViewProcedure
      .input(z.object({
        branchId: z.number().optional(),
        days: z.number().min(1).max(30).default(7),
      }).optional())
      .query(async ({ input }) => {
        return revenueAnalytics.forecastRevenue(input?.branchId, input?.days || 7);
      }),

    // ==================== التنبؤ المالي الجديد ====================
    
    // الحصول على إعدادات التكاليف
    getFinancialSettings: supervisorViewProcedure
      .query(async () => {
        return financialForecast.getFinancialSettings();
      }),

    // حفظ إعدادات التكاليف
    saveFinancialSettings: adminProcedure
      .input(z.object({
        variableCostRate: z.number().min(1).max(80), // الحد 1-80%
        fixedMonthlyCosts: z.number().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        return financialForecast.saveFinancialSettings(
          input.variableCostRate,
          input.fixedMonthlyCosts
        );
      }),

    // الحصول على التكاليف الثابتة الحقيقية
    getFixedCostsBreakdown: supervisorViewProcedure
      .query(async () => {
        return {
          breakdown: financialForecast.FIXED_COSTS,
          total: financialForecast.TOTAL_FIXED_COSTS,
          perBranch: financialForecast.FIXED_COSTS_PER_BRANCH,
          branchesCount: financialForecast.BRANCHES_COUNT,
        };
      }),

    // تحليل الشهر الماضي
    analyzeLastMonth: supervisorViewProcedure
      .input(z.object({
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return financialForecast.analyzeLastMonth(input?.branchId);
      }),

    // التنبؤ للشهر الحالي
    forecastCurrentMonth: supervisorViewProcedure
      .input(z.object({
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return financialForecast.forecastCurrentMonth(input?.branchId);
      }),

    // تحليل جميع الفروع على حدة
    analyzeAllBranches: supervisorViewProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        // جلب جميع الفروع
        const allBranches = await db.getBranches();
        
        // تحليل كل فرع على حدة
        const branchAnalyses = await Promise.all(
          allBranches.map(async (branch: { id: number; name: string }) => {
            const profitability = await revenueAnalytics.analyzeProfitability(
              new Date(input.startDate),
              new Date(input.endDate),
              branch.id
            );
            
            const revenues = await revenueAnalytics.analyzeRevenues(
              new Date(input.startDate),
              new Date(input.endDate),
              branch.id
            );
            
            const expenses = await revenueAnalytics.analyzeExpenses(
              new Date(input.startDate),
              new Date(input.endDate),
              branch.id
            );
            
            return {
              branchId: branch.id,
              branchName: branch.name,
              totalRevenue: profitability.totalRevenue,
              totalExpenses: profitability.totalExpenses,
              netProfit: profitability.netProfit,
              profitMargin: profitability.profitMargin,
              operatingRatio: profitability.operatingRatio,
              breakEvenPoint: profitability.breakEvenPoint,
              daysCount: revenues.daysCount,
              avgDailyRevenue: revenues.avgDailyRevenue,
              recordedExpenses: expenses.totalExpenses,
              fixedCosts: financialForecast.FIXED_COSTS_PER_BRANCH,
            };
          })
        );
        
        return branchAnalyses;
      }),

    // تقرير المقارنة الشهرية للفروع
    getMonthlyComparisonReport: supervisorViewProcedure
      .input(z.object({
        monthsCount: z.number().min(1).max(12).optional(),
      }).optional())
      .query(async ({ input }) => {
        return revenueAnalytics.generateMonthlyComparisonReport(input?.monthsCount || 6);
      }),

    // المحادثة مع AI
    chatWithAI: supervisorViewProcedure
      .input(z.object({
        message: z.string().min(1),
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string(),
        })).optional(),
        branchId: z.number().optional(),
        userName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const aiChat = await import('./bi/aiChatService');
        return aiChat.chatWithAI(
          input.message,
          input.conversationHistory || [],
          input.branchId,
          input.userName
        );
      }),

    // جلب الأسئلة المقترحة
    getSuggestedQuestions: supervisorViewProcedure
      .query(async () => {
        const aiChat = await import('./bi/aiChatService');
        return aiChat.getSuggestedQuestions();
      }),

    // جلب رسالة الترحيب
    getWelcomeMessage: supervisorViewProcedure
      .query(async () => {
        const aiChat = await import('./bi/aiChatService');
        return aiChat.getWelcomeMessage();
      }),
  }),

  // ==================== مساعد AI للموظفين ====================
  employeeAssistant: router({
    // محادثة مع المساعد
    chat: publicProcedure
      .input(z.object({
        message: z.string().min(1),
        sessionId: z.string().optional(), // معرف الجلسة للذاكرة
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant', 'system', 'tool']),
          content: z.string(),
          toolCallId: z.string().optional(),
          name: z.string().optional(),
        })).optional(),
        employeeContext: z.object({
          employeeId: z.number().optional(),
          employeeName: z.string().optional(),
          branchId: z.number().optional(),
          branchName: z.string().optional(),
          isSupervisor: z.boolean().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('./_core/llm');
        const { assistantTools, executeAssistantTool } = await import('./ai/assistantTools');
        const { supervisorTools, executeSupervisorTool } = await import('./ai/supervisorTools');
        const { getOrCreateActiveSession, saveMessage, getConversationContext, getPendingRequests } = await import('./ai/conversationMemory');
        
        // تحديد نوع المستخدم (موظف عادي أو مشرف)
        const isSupervisor = input.employeeContext?.isSupervisor || false;
        const supervisorName = input.employeeContext?.employeeName || '';
        const supervisorBranchId = input.employeeContext?.branchId;

        // إدارة الجلسة والذاكرة
        let sessionId = input.sessionId;
        let conversationContext: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
        
        // إذا كان لدينا معلومات الموظف، نستخدم الذاكرة
        if (input.employeeContext?.employeeId) {
          try {
            sessionId = await getOrCreateActiveSession(
              input.employeeContext.employeeId,
              input.employeeContext.employeeName || '',
              input.employeeContext.branchId,
              input.employeeContext.branchName
            );
            // تحميل آخر 10 رسائل كسياق
            conversationContext = await getConversationContext(sessionId, 10);
          } catch (e) {
            symbolAiLogger.error('خطأ في إدارة الجلسة', e);
          }
        }

        // بناء رسالة النظام مع التاريخ الحالي
        const now = new Date();
        const currentDate = now.toLocaleDateString('ar-SA', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const currentMonth = now.toLocaleDateString('ar-SA', { month: 'long' });
        const currentYear = now.getFullYear();
        
        // بناء system prompt بناءً على نوع المستخدم
        const supervisorSection = isSupervisor ? `

## صلاحيات المشرف:
أنت تتحدث مع **المشرف ${supervisorName}** (فرع ${input.employeeContext?.branchName}).
كمشرف، لديك صلاحيات موسعة:
- عرض قائمة جميع موظفي الفرع (get_branch_employees)
- عرض إيرادات الفرع الإجمالية (get_branch_revenue)
- عرض إيرادات أي موظف في الفرع (get_employee_revenue_supervisor)
- عرض ترتيب الموظفين حسب الإيرادات (get_branch_employees_ranking)
- تحليل أداء موظف وتقديم نصائح (analyze_employee_performance)

**تنبيه:** يمكنك فقط الاطلاع على بيانات فرعك (رقم ${supervisorBranchId}). لا يمكنك الوصول لبيانات فروع أخرى.
` : '';
        
        const systemPrompt = `أنت **Symbol AI** - مساعد ذكي متقدم لشركة Symbol AI. مهمتك مساعدة الموظفين في:${supervisorSection}

**التاريخ الحالي:** ${currentDate}
**الشهر الحالي:** ${currentMonth} ${currentYear}


1. **التعرف على الموظف**: إذا لم تعرف الموظف بعد، اسأله عن اسمه أولاً واستخدم أداة identify_employee للتعرف عليه.

2. **رفع الطلبات**: يمكنك مساعدة الموظف في رفع طلبات. اجمع المعلومات المطلوبة ثم استخدم أداة prepare_request لإنشاء طلب معلق للتأكيد.

**أنواع الطلبات (مهم جداً - اختر النوع الصحيح):**
- **vacation** (إجازة): عندما يطلب الموظف "إجازة" أو "عطلة" أو "راحة" أو "إجازة سنوية" أو "إجازة مرضية" أو "أيام راحة"
- **advance** (سلفة): عندما يطلب الموظف "سلفة" أو "قرض" أو "مبلغ مقدم" أو "فلوس مقدمة" أو "مساعدة مالية"
- **permission** (استئذان): عندما يطلب الموظف "استئذان" أو "خروج مبكر" أو "تأخر" أو "ساعات" أو "خروج لساعات"
- **arrears** (متأخرات): عندما يطلب الموظف "متأخرات" أو "صرف متأخرات" أو "مستحقات" أو "رواتب متأخرة"
- **objection** (اعتراض): عندما يطلب الموظف "اعتراض" أو "شكوى" أو "مخالفة" أو "اعتراض على مخالفة"
- **resignation** (استقالة): عندما يطلب الموظف "استقالة" أو "ترك العمل" أو "إنهاء الخدمة"

**تحذير:** يجب اختيار نوع الطلب (type) بناءً على ما طلبه الموظف بالضبط. إذا طلب إجازة، استخدم type="vacation". إذا طلب سلفة، استخدم type="advance". لا تخلط بينهما أبداً!

**نظام التأكيد (مهم جداً):**
- عند رفع أي طلب، استخدم أولاً prepare_request لإنشاء طلب معلق
- اعرض ملخص الطلب واطلب من الموظف التأكيد
- إذا قال "نعم" أو "أكد"، استخدم confirm_request لتنفيذ الطلب
- إذا قال "لا" أو "إلغاء"، استخدم cancel_request لإلغاء الطلب
- لا ترفع أي طلب مباشرة بدون تأكيد الموظف

3. **التقارير السريعة**: يمكنك عرض تقارير الإيرادات والبونص والطلبات باستخدام أداة get_report.

**قواعد الفترات الزمنية (مهم جداً):**
- عندما يطلب الموظف تقرير "هذا الأسبوع" أو "الأسبوع الحالي": استخدم period="week" مباشرة بدون أسئلة إضافية
- عندما يطلب "الأسبوع الماضي" أو "الأسبوع اللي فات": استخدم period="last_week" مباشرة
- عندما يطلب "هذا الشهر" أو "الشهر الحالي": استخدم period="month" مباشرة
- عندما يطلب "الشهر الماضي" أو "الشهر اللي فات": استخدم period="last_month" مباشرة
- عندما يطلب "اليوم": استخدم period="today" مباشرة
- لا تسأل عن تحديد التواريخ إذا كانت الفترة واضحة - نفذ مباشرة
- الأداة ستحسب التواريخ تلقائياً بناءً على التاريخ الحالي

4. **حساب الأسعار**: يمكنك حساب أسعار الخدمات مع الخصومات باستخدام أداة calculate_price.

**قواعد المصداقية الصارمة (مهم جداً):**
- لا تختلق أي أرقام أو بيانات أبداً - اعتمد فقط على نتائج الأدوات
- إذا أعادت الأداة hasData: false أو "لا توجد بيانات"، قل ذلك بوضوح للموظف
- لا تخمن أو تقدر - اعرض فقط ما هو موجود فعلياً في قاعدة البيانات
- إذا لم تجد بيانات لفترة معينة، اقترح فترة أخرى أو وضح السبب
- انقل رسالة الأداة (message) كما هي لأنها تحتوي على البيانات الحقيقية

**قواعد عامة:**
- تحدث بالعربية دائماً
- كن ودوداً ومهنياً
- اسأل عن المعلومات الناقصة قبل تنفيذ أي طلب
- أنت لا تملك صلاحية الموافقة على الطلبات، فقط رفعها للمشرف
- إذا لم تعرف الموظف، اطلب اسمه أولاً

${input.employeeContext?.employeeId ? `**الموظف الحالي:** ${input.employeeContext.employeeName} (رقم: ${input.employeeContext.employeeId}) - فرع: ${input.employeeContext.branchName}` : '**الموظف غير معروف بعد - اسأل عن اسمه**'}`;

        // بناء الرسائل - دمج سياق الذاكرة مع المحادثة الحالية
        const historyMessages = conversationContext.length > 0 
          ? conversationContext 
          : (input.conversationHistory || []).map(m => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            }));
        
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: input.message },
        ];

        // اكتشاف نية رفع الطلبات
        const requestKeywords = ['طلب سلفة', 'طلب إجازة', 'طلب استئذان', 'طلب استقالة', 'طلب متأخرات', 'طلب اعتراض',
          'رفع طلب', 'أريد سلفة', 'أريد إجازة', 'أريد استئذان', 'أريد استقالة',
          'أحتاج سلفة', 'أحتاج إجازة', 'أبغى سلفة', 'أبغى إجازة'];
        const confirmKeywords = ['نعم', 'أكد', 'موافق', 'تمام', 'اوكي', 'أوكي', 'ايه', 'أيه', 'صح', 'ماشي'];
        const cancelKeywords = ['لا', 'إلغاء', 'تراجع', 'لا أريد', 'ما أبغى'];
        
        const messageText = input.message.toLowerCase();
        const isRequestIntent = requestKeywords.some(kw => messageText.includes(kw));
        const isConfirmIntent = confirmKeywords.some(kw => messageText.trim() === kw || messageText.includes(kw));
        const isCancelIntent = cancelKeywords.some(kw => messageText.includes(kw));
        
        // التحقق من وجود طلبات معلقة
        let hasPendingRequest = false;
        if (sessionId) {
          try {
            const pendingRequests = await getPendingRequests(sessionId);
            hasPendingRequest = pendingRequests.length > 0;
          } catch (e) {
            symbolAiLogger.error('خطأ في فحص الطلبات المعلقة', e);
          }
        }
        
        // تحديد tool_choice بناءً على النية
        let toolChoice: 'auto' | { type: 'function'; function: { name: string } } = 'auto';
        if (isConfirmIntent && hasPendingRequest) {
          toolChoice = { type: 'function', function: { name: 'confirm_request' } };
          symbolAiLogger.info('إجبار استخدام confirm_request');
        } else if (isCancelIntent && hasPendingRequest) {
          toolChoice = { type: 'function', function: { name: 'cancel_request' } };
          symbolAiLogger.info('إجبار استخدام cancel_request');
        } else if (isRequestIntent && input.employeeContext?.employeeId) {
          toolChoice = { type: 'function', function: { name: 'prepare_request' } };
          symbolAiLogger.info('إجبار استخدام prepare_request');
        }
        
        // دمج أدوات المشرف إذا كان المستخدم مشرفاً
        const allTools = isSupervisor 
          ? [...assistantTools, ...supervisorTools] 
          : assistantTools;
        
        // استدعاء LLM مع الأدوات
        const response = await invokeLLM({
          messages,
          tools: allTools,
          tool_choice: toolChoice,
          temperature: 0.7,
        });

        const assistantMessage = response.choices[0]?.message;
        
        symbolAiLogger.debug('تم استلام الرد', {
          hasToolCalls: !!(assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0),
          toolCallsCount: assistantMessage?.tool_calls?.length || 0,
        });
        
        // إذا كان هناك tool calls
        if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
          const toolResults: any[] = [];
          let employeeContext = input.employeeContext;

          for (const toolCall of assistantMessage.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            
            // تمرير sessionId و employeeContext للأدوات التي تحتاجها
            if (['prepare_request', 'confirm_request', 'cancel_request'].includes(toolCall.function.name)) {
              args.sessionId = sessionId;
              if (input.employeeContext) {
                args.employeeId = input.employeeContext.employeeId;
                args.employeeName = input.employeeContext.employeeName;
                args.branchId = input.employeeContext.branchId;
                args.branchName = input.employeeContext.branchName;
              }
              symbolAiLogger.info(`تنفيذ ${toolCall.function.name}`, { sessionId });
            }
            
            // تحديد أي منفذ للأداة (موظف أو مشرف)
            const supervisorToolNames = ['get_branch_employees', 'get_branch_revenue', 'get_employee_revenue_supervisor', 'get_branch_employees_ranking', 'analyze_employee_performance'];
            
            let result;
            if (supervisorToolNames.includes(toolCall.function.name) && isSupervisor) {
              // تمرير branchId لأدوات المشرف
              args.branchId = supervisorBranchId;
              args.supervisorBranchId = supervisorBranchId;
              result = await executeSupervisorTool(toolCall.function.name, args);
            } else {
              result = await executeAssistantTool(toolCall.function.name, args);
            }
            
            // تحديث سياق الموظف إذا تم التعرف عليه
            if (toolCall.function.name === 'identify_employee' && result.success && result.data && !Array.isArray(result.data)) {
              employeeContext = {
                employeeId: result.data.id,
                employeeName: result.data.name,
                branchId: result.data.branchId,
                branchName: result.data.branchName,
              };
            }

            toolResults.push({
              toolCallId: toolCall.id,
              name: toolCall.function.name,
              result,
            });
          }

          // استدعاء LLM مرة أخرى مع نتائج الأدوات
          const messagesWithToolResults: any[] = [
            ...messages,
            {
              role: 'assistant',
              content: assistantMessage.content || '',
              tool_calls: assistantMessage.tool_calls,
            },
            ...toolResults.map(tr => ({
              role: 'tool',
              tool_call_id: tr.toolCallId,
              name: tr.name,
              content: JSON.stringify(tr.result),
            })),
          ];

          const finalResponse = await invokeLLM({
            messages: messagesWithToolResults,
            temperature: 0.7,
          });

          const responseContent = typeof finalResponse.choices[0]?.message?.content === 'string' 
            ? finalResponse.choices[0].message.content 
            : 'حدث خطأ';
          
          // حفظ الرسائل في الذاكرة
          if (sessionId && employeeContext?.employeeId) {
            try {
              await saveMessage(sessionId, { role: 'user', content: input.message });
              await saveMessage(sessionId, { 
                role: 'assistant', 
                content: responseContent,
                toolCalls: JSON.stringify(toolResults.map(t => t.name)),
                toolResults: JSON.stringify(toolResults.map(t => t.result)),
              });
            } catch (e) {
              symbolAiLogger.error('خطأ في حفظ الرسائل', e);
            }
          }

          // التحقق من وجود طلب معلق بعد تنفيذ الأدوات
          let hasPendingRequest = false;
          let pendingRequestType = '';
          if (sessionId && employeeContext?.employeeId) {
            try {
              const pendingReqs = await getPendingRequests(sessionId);
              if (pendingReqs.length > 0) {
                hasPendingRequest = true;
                pendingRequestType = pendingReqs[0].requestType;
              }
            } catch (e) {
              symbolAiLogger.error('خطأ في التحقق من الطلبات المعلقة', e);
            }
          }

          return {
            message: responseContent,
            sessionId,
            employeeContext,
            toolResults,
            hasPendingRequest,
            pendingRequestType,
          };
        }

        const responseContent = typeof assistantMessage?.content === 'string' 
          ? assistantMessage.content 
          : 'حدث خطأ';
        
        // حفظ الرسائل في الذاكرة
        if (sessionId && input.employeeContext?.employeeId) {
          try {
            await saveMessage(sessionId, { role: 'user', content: input.message });
            await saveMessage(sessionId, { role: 'assistant', content: responseContent });
          } catch (e) {
            symbolAiLogger.error('خطأ في حفظ الرسائل', e);
          }
        }

        // التحقق من وجود طلب معلق
        let hasPendingReq = false;
        let pendingReqType = '';
        if (sessionId && input.employeeContext?.employeeId) {
          try {
            const pendingReqs = await getPendingRequests(sessionId);
            if (pendingReqs.length > 0) {
              hasPendingReq = true;
              pendingReqType = pendingReqs[0].requestType;
            }
          } catch (e) {
            symbolAiLogger.error('خطأ في التحقق من الطلبات المعلقة', e);
          }
        }

        return {
          message: responseContent,
          sessionId,
          employeeContext: input.employeeContext,
          toolResults: [],
          hasPendingRequest: hasPendingReq,
          pendingRequestType: pendingReqType,
        };
      }),

    // بدء محادثة جديدة
    startNewConversation: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        employeeName: z.string(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { createSession, closeSession, getOrCreateActiveSession } = await import('./ai/conversationMemory');
        
        try {
          // إغلاق الجلسة الحالية إن وجدت
          const currentSession = await getOrCreateActiveSession(
            input.employeeId,
            input.employeeName,
            input.branchId,
            input.branchName
          );
          await closeSession(currentSession);
          
          // إنشاء جلسة جديدة
          const newSessionId = await createSession(
            input.employeeId,
            input.employeeName,
            input.branchId,
            input.branchName
          );
          
          return {
            success: true,
            sessionId: newSessionId,
            message: 'تم بدء محادثة جديدة',
          };
        } catch (e) {
          symbolAiLogger.error('خطأ في بدء محادثة جديدة', e);
          return {
            success: false,
            sessionId: null,
            message: 'حدث خطأ في بدء المحادثة',
          };
        }
      }),

    // رسالة الترحيب
    getWelcomeMessage: publicProcedure
      .query(() => {
        return {
          message: `مرحباً! 👋\n\nأنا مساعدك الذكي في Symbol AI.\n\nيمكنني مساعدتك في:\n• 📝 رفع طلبات (إجازة، سلفة، استئذان...)\n• 📊 عرض تقاريرك (إيرادات، بونص، طلبات)\n• 💰 حساب الأسعار والخصومات\n\nمن فضلك، أخبرني باسمك حتى أتمكن من مساعدتك بشكل أفضل.`,
          suggestedQuestions: [
            'أريد رفع طلب إجازة',
            'كم بونصي هذا الأسبوع؟',
            'احسب لي سعر قص شعر مع صبغة',
            'أريد طلب سلفة',
            'ما حالة طلباتي؟',
          ],
        };
      }),
  }),

  // ========== مصادقة الموظفين ==========
  employeeAuth: router({
    // تسجيل دخول الموظف
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1, 'اسم المستخدم مطلوب'),
        password: z.string().min(1, 'كلمة المرور مطلوبة'),
      }))
      .mutation(async ({ input }) => {
        const { employeeLogin } = await import('./auth/employeeAuth');
        return employeeLogin(input.username, input.password);
      }),

    // إنشاء حسابات الموظفين (للأدمن فقط)
    createAccounts: adminProcedure
      .mutation(async () => {
        const { createEmployeeAccounts } = await import('./auth/employeeAuth');
        return createEmployeeAccounts();
      }),

    // جلب حسابات الموظفين
    getAccounts: adminProcedure
      .query(async () => {
        const { getEmployeeAccounts } = await import('./auth/employeeAuth');
        return getEmployeeAccounts();
      }),

    // إعادة تعيين كلمة مرور موظف
    resetPassword: adminProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { resetEmployeePassword } = await import('./auth/employeeAuth');
        return resetEmployeePassword(input.employeeId);
      }),

    // تغيير كلمة مرور الموظف (للموظف نفسه)
    changePassword: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        oldPassword: z.string().min(1),
        newPassword: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
      }))
      .mutation(async ({ input }) => {
        const { changeEmployeePassword } = await import('./auth/employeeAuth');
        return changeEmployeePassword(input.employeeId, input.oldPassword, input.newPassword);
      }),

    // جلب طلبات الموظف (لبوابة الموظفين)
    getMyRequests: publicProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeeRequestsByEmployeeId(input.employeeId);
      }),
  }),

  // ========== تحويل الصوت إلى نص ==========
  voice: router({
    // تحويل الصوت إلى نص
    transcribe: publicProcedure
      .input(z.object({
        audioUrl: z.string().url(),
        language: z.string().optional(),
        prompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { transcribeAudio } = await import('./_core/voiceTranscription');
        
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language,
          prompt: input.prompt,
        });
        
        // التحقق من الخطأ
        if ('error' in result) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error,
          });
        }
        
        return result;
      }),
  }),

  // ========== بوابة الموظفين - APIs الجديدة ==========
  employeePortal: router({
    // جلب الملف الشخصي للموظف
    getProfile: publicProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .query(async ({ input }) => {
        const profile = await db.getEmployeeProfile(input.employeeId);
        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'الموظف غير موجود' });
        }
        return profile;
      }),

    // تحديث البيانات الشخصية
    updateProfile: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const success = await db.updateEmployeeProfile(input.employeeId, {
          phone: input.phone,
          email: input.email,
        });
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في تحديث البيانات' });
        }
        return { success: true };
      }),

    // حفظ البريد الإلكتروني عند أول تسجيل دخول
    setupEmail: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صحيح' }),
      }))
      .mutation(async ({ input }) => {
        const success = await db.setupEmployeeEmail(input.employeeId, input.email);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في حفظ البريد الإلكتروني' });
        }
        return { success: true, message: 'تم حفظ البريد الإلكتروني بنجاح' };
      }),

    // جلب كشف الراتب لشهر محدد
    getSalarySlip: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        const slip = await db.getEmployeeSalarySlip(input.employeeId, input.year, input.month);
        if (!slip) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'لا يوجد كشف راتب لهذا الشهر' });
        }
        return slip;
      }),

    // جلب سجل الرواتب
    getSalaryHistory: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        limit: z.number().optional().default(12),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeeSalaryHistory(input.employeeId, input.limit);
      }),

    // جلب رصيد الإجازات
    getLeaveBalance: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        year: z.number(),
      }))
      .query(async ({ input }) => {
        const balance = await db.getEmployeeLeaveBalance(input.employeeId, input.year);
        if (!balance) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في جلب رصيد الإجازات' });
        }
        return balance;
      }),

    // جلب سجل الإجازات
    getLeaveHistory: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        year: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeeLeaveHistory(input.employeeId, input.year);
      }),

    // جلب تقرير البونص
    getBonusReport: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeeBonusReport(input.employeeId, input.year, input.month);
      }),

    // جلب سجل البونص
    getBonusHistory: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        limit: z.number().optional().default(6),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeeBonusHistory(input.employeeId, input.limit);
      }),

    // إلغاء طلب
    cancelRequest: publicProcedure
      .input(z.object({
        requestId: z.number(),
        employeeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.cancelEmployeeRequest(input.requestId, input.employeeId);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'فشل في إلغاء الطلب' });
        }
        return { success: true };
      }),

    // تحديث طلب
    updateRequest: publicProcedure
      .input(z.object({
        requestId: z.number(),
        employeeId: z.number(),
        description: z.string().optional(),
        advanceAmount: z.string().optional(),
        advanceReason: z.string().optional(),
        vacationStartDate: z.date().optional(),
        vacationEndDate: z.date().optional(),
        vacationDays: z.number().optional(),
        permissionDate: z.date().optional(),
        permissionStartTime: z.string().optional(),
        permissionEndTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { requestId, employeeId, ...data } = input;
        const result = await db.updateEmployeeRequestFromPortal(requestId, employeeId, data);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'فشل في تحديث الطلب' });
        }
        return { success: true };
      }),

    // جلب إحصائيات الطلبات
    getRequestsStats: publicProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeePortalRequestsStats(input.employeeId);
      }),

    // ==================== APIs المرفقات ====================
    
    // رفع مرفق لطلب
    uploadAttachment: publicProcedure
      .input(z.object({
        requestId: z.number(),
        employeeId: z.number(),
        fileName: z.string(),
        base64Data: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { storagePut } = await import('./storage');
          
          // تحويل base64 إلى Buffer
          const base64Content = input.base64Data.replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(base64Content, 'base64');
          
          // التحقق من حجم الملف (5MB max)
          const maxSize = 5 * 1024 * 1024;
          if (buffer.length > maxSize) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'حجم الملف يجب أن يكون أقل من 5 ميجابايت',
            });
          }
          
          // إنشاء اسم ملف فريد
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const fileKey = `request-attachments/${input.requestId}/${timestamp}-${randomSuffix}-${input.fileName}`;
          
          const { url } = await storagePut(fileKey, buffer, input.contentType);
          
          // حفظ المرفق في قاعدة البيانات
          await db.addRequestAttachment({
            requestId: input.requestId,
            fileName: input.fileName,
            fileUrl: url,
            fileType: input.contentType,
            fileSize: buffer.length,
            uploadedBy: input.employeeId,
          });
          
          return { success: true, url };
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error?.message || 'فشل رفع الملف',
          });
        }
      }),

    // جلب مرفقات طلب
    getAttachments: publicProcedure
      .input(z.object({
        requestId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getRequestAttachments(input.requestId);
      }),

    // حذف مرفق
    deleteAttachment: publicProcedure
      .input(z.object({
        attachmentId: z.number(),
        employeeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.deleteRequestAttachment(input.attachmentId, input.employeeId);
        if (!result.success) {
          throw new TRPCError({ code: 'FORBIDDEN', message: result.error || 'فشل في حذف المرفق' });
        }
        return { success: true };
      }),

    // ==================== APIs تتبع الطلب ====================
    
    // جلب تتبع طلب
    getRequestTimeline: publicProcedure
      .input(z.object({
        requestId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getRequestTimeline(input.requestId);
      }),

    // ==================== APIs رصيد الإجازات ====================
    
    // تهيئة رصيد إجازات موظف
    initializeLeaveBalance: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.initializeEmployeeLeaveBalance(input.employeeId, input.year);
      }),

    // ==================== APIs إشعارات الموظفين ====================
    
    // جلب إشعارات الموظف
    getNotifications: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeeNotifications(input.employeeId, input.limit);
      }),

    // جلب عدد الإشعارات غير المقروءة
    getUnreadCount: publicProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getUnreadNotificationCount(input.employeeId);
      }),

    // تحديد إشعار كمقروء
    markAsRead: publicProcedure
      .input(z.object({
        notificationId: z.number(),
        employeeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.markEmployeeNotificationAsRead(input.notificationId, input.employeeId);
      }),

    // تحديد جميع الإشعارات كمقروءة
    markAllAsRead: publicProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.markAllEmployeeNotificationsAsRead(input.employeeId);
      }),

    // ==================== APIs معلومات الموظف ====================
    
    // جلب معلومات الوثائق للموظف
    getDocumentInfo: publicProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .query(async ({ input }) => {
        const info = await db.getEmployeeDocumentInfo(input.employeeId);
        if (!info) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'الموظف غير موجود' });
        }
        return info;
      }),

    // التحقق مما إذا كان الموظف قد سجل معلوماته
    hasSubmittedInfo: publicProcedure
      .input(z.object({
        employeeId: z.number(),
      }))
      .query(async ({ input }) => {
        const hasSubmitted = await db.hasEmployeeSubmittedInfo(input.employeeId);
        return { hasSubmitted };
      }),

    // تسجيل معلومات الموظف (لمرة واحدة فقط)
    submitInfo: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        iqamaNumber: z.string().optional(),
        iqamaExpiryDate: z.union([z.date(), z.string()]).optional(),
        healthCertExpiryDate: z.union([z.date(), z.string()]).optional(),
        contractExpiryDate: z.union([z.date(), z.string()]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { employeeId, iqamaExpiryDate, healthCertExpiryDate, contractExpiryDate, ...rest } = input;
        const data = {
          ...rest,
          iqamaExpiryDate: iqamaExpiryDate ? new Date(iqamaExpiryDate) : undefined,
          healthCertExpiryDate: healthCertExpiryDate ? new Date(healthCertExpiryDate) : undefined,
          contractExpiryDate: contractExpiryDate ? new Date(contractExpiryDate) : undefined,
        };
        const result = await db.submitEmployeeInfo(employeeId, data);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'فشل في تسجيل المعلومات' });
        }
        return { success: true, message: result.isUpdate ? 'تم تحديث المعلومات بنجاح' : 'تم تسجيل المعلومات بنجاح', isUpdate: result.isUpdate };
      }),

    // رفع صورة وثيقة
    uploadDocumentImage: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        documentType: z.enum(['iqama', 'healthCert', 'contract']),
        imageData: z.string(), // Base64 encoded image
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { employeeId, documentType, imageData, fileName, mimeType } = input;
        
        // التحقق من أن الموظف لم يسجل معلوماته بعد (يمكنه رفع الصور فقط قبل التسجيل النهائي)
        const hasSubmitted = await db.hasEmployeeSubmittedInfo(employeeId);
        if (hasSubmitted) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'تم تسجيل المعلومات مسبقاً. لتعديل الصور يرجى التواصل مع الإدارة.' 
          });
        }
        
        // تحويل Base64 إلى Buffer
        const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // إنشاء اسم ملف فريد
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const extension = fileName.split('.').pop() || 'jpg';
        const fileKey = `employees/${employeeId}/documents/${documentType}-${timestamp}-${randomSuffix}.${extension}`;
        
        // رفع الصورة إلى S3
        const { storagePut } = await import('./storage');
        const { url } = await storagePut(fileKey, buffer, mimeType);
        
        // تحديث رابط الصورة في قاعدة البيانات
        const result = await db.updateEmployeeDocumentImage(employeeId, documentType, url);
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في حفظ رابط الصورة' });
        }
        
        return { success: true, url, message: 'تم رفع الصورة بنجاح' };
      }),

    // حذف صورة وثيقة
    deleteDocumentImage: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        documentType: z.enum(['iqama', 'healthCert', 'contract']),
      }))
      .mutation(async ({ input }) => {
        const { employeeId, documentType } = input;
        
        // التحقق من أن الموظف لم يسجل معلوماته بعد
        const hasSubmitted = await db.hasEmployeeSubmittedInfo(employeeId);
        if (hasSubmitted) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'تم تسجيل المعلومات مسبقاً. لحذف الصور يرجى التواصل مع الإدارة.' 
          });
        }
        
        // حذف رابط الصورة من قاعدة البيانات
        const result = await db.updateEmployeeDocumentImage(employeeId, documentType, null);
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في حذف الصورة' });
        }
        
        return { success: true, message: 'تم حذف الصورة بنجاح' };
      }),
  }),
  
  // ==================== نظام التدقيق والامتثال ====================
  auditCompliance: router({
    // تسجيل حدث تدقيق
    logEvent: adminProcedure
      .input(z.object({
        eventType: z.enum(["create", "update", "delete", "view", "export", "import", "login", "logout", "login_failed", "password_change", "approval", "rejection", "payment", "transfer", "config_change", "permission_change", "bulk_operation"]),
        entityType: z.string(),
        entityId: z.number().optional(),
        entityName: z.string().optional(),
        description: z.string().optional(),
        oldData: z.record(z.string(), z.any()).optional(),
        newData: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await auditService.logAuditEvent({
          ...input,
          context: {
            userId: ctx.user.id,
            userName: ctx.user.name ?? undefined,
            userRole: ctx.user.role ?? undefined,
          },
        });
      }),
    
    // جلب سجلات التدقيق
    getEvents: adminProcedure
      .input(z.object({
        eventType: z.enum(["create", "update", "delete", "view", "export", "import", "login", "logout", "login_failed", "password_change", "approval", "rejection", "payment", "transfer", "config_change", "permission_change", "bulk_operation"]).optional(),
        entityType: z.string().optional(),
        userId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return await auditService.getAuditEvents(input);
      }),
    
    // كشف الشذوذ
    detectAnomalies: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await auditService.detectAnomalies(input.year, input.month);
      }),
    
    // تقرير الامتثال
    getComplianceReport: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await auditService.generateComplianceReport(input.year, input.month);
      }),
  }),
  
  // ==================== لوحة التحكم التنفيذية ====================
  executive: router({
    // KPIs الشاملة
    getKPIs: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await executiveDashboard.calculateExecutiveKPIs(input.year, input.month);
      }),
    
    // مقارنة الفروع
    getBranchComparison: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await executiveDashboard.getBranchComparison(input.year, input.month);
      }),
    
    // التنبيهات التنفيذية
    getAlerts: adminProcedure
      .input(z.object({
        status: z.enum(["active", "acknowledged", "resolved", "dismissed"]).optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return await executiveDashboard.getExecutiveAlerts(input);
      }),
    
    // تحديث حالة التنبيه
    updateAlertStatus: adminProcedure
      .input(z.object({
        alertId: z.number(),
        status: z.enum(["acknowledged", "resolved", "dismissed"]),
      }))
      .mutation(async ({ input, ctx }) => {
        return await executiveDashboard.updateAlertStatus(
          input.alertId,
          input.status,
          ctx.user.id
        );
      }),
    
    // تشغيل التحليل التلقائي
    runAnalysis: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .mutation(async ({ input }) => {
        await executiveDashboard.runPerformanceAnalysis(input.year, input.month);
        return { success: true, message: 'تم تشغيل التحليل بنجاح' };
      }),
  }),
  
  // ==================== نظام الذكاء الاصطناعي للقرارات ====================
  aiDecision: router({
    // التنبؤات المالية
    getPredictions: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await aiDecisionEngine.generateFinancialPredictions(input.year, input.month);
      }),
    
    // تقييم المخاطر
    getRiskAssessment: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await aiDecisionEngine.assessRisks(input.year, input.month);
      }),
    
    // التوصيات الذكية
    getRecommendations: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await aiDecisionEngine.generateAIRecommendations(input.year, input.month);
      }),
    
    // التحليل الشامل بالذكاء الاصطناعي
    getAIInsights: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await aiDecisionEngine.generateAIInsights(input.year, input.month);
      }),
  }),

  // ==================== لوحة تحكم الأدمن في بوابة الموظفين ====================
  portalAdmin: router({
    // جلب قائمة الموظفين (للأدمن في بوابة الموظفين)
    // المشرف يرى فقط موظفي فرعه، الأدمن يرى الكل
    getEmployees: publicProcedure
      .input(z.object({
        adminId: z.number(),
        branchId: z.number().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        // التحقق من صلاحيات الأدمن
        const adminCheck = await db.checkPortalAdminAccess(input.adminId);
        if (!adminCheck.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بالوصول' });
        }
        
        // إذا كان مشرف، فلتر حسب فرعه فقط
        const branchFilter = adminCheck.branchId || input.branchId;
        
        return await db.getEmployeesForPortalAdmin(branchFilter, input.search);
      }),

    // جلب قائمة الفروع (للأدمن في بوابة الموظفين)
    getBranches: publicProcedure
      .input(z.object({
        adminId: z.number(),
      }))
      .query(async ({ input }) => {
        // التحقق من صلاحيات الأدمن
        const adminCheck = await db.checkPortalAdminAccess(input.adminId);
        if (!adminCheck.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بالوصول' });
        }
        
        return await db.getBranchesForPortalAdmin();
      }),

    // جلب قائمة الطلبات (للأدمن في بوابة الموظفين)
    // المشرف يرى فقط طلبات موظفي فرعه
    getRequests: publicProcedure
      .input(z.object({
        adminId: z.number(),
        status: z.string().optional(),
        requestType: z.string().optional(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        // التحقق من صلاحيات الأدمن
        const adminCheck = await db.checkPortalAdminAccess(input.adminId);
        if (!adminCheck.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بالوصول' });
        }
        
        const { adminId, ...filters } = input;
        // إذا كان مشرف، فلتر حسب فرعه فقط
        if (adminCheck.branchId) {
          filters.branchId = adminCheck.branchId;
        }
        return await db.getAllEmployeeRequests(filters);
      }),

    // تحديث حالة طلب (للأدمن في بوابة الموظفين)
    updateRequestStatus: publicProcedure
      .input(z.object({
        adminId: z.number(),
        requestId: z.number(),
        status: z.enum(['approved', 'rejected']),
        reviewNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // التحقق من صلاحيات الأدمن
        const adminCheck = await db.checkPortalAdminAccess(input.adminId);
        if (!adminCheck.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بالوصول' });
        }
        
        const result = await db.updateEmployeeRequestStatus(
          input.requestId,
          input.status,
          input.adminId,
          adminCheck.adminName || 'Admin',
          input.reviewNotes
        );
        
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'فشل في تحديث الطلب' });
        }
        
        return { success: true };
      }),

    // جلب الوثائق المنتهية (للأدمن في بوابة الموظفين)
    getExpiringDocuments: publicProcedure
      .input(z.object({
        adminId: z.number(),
      }))
      .query(async ({ input }) => {
        // التحقق من صلاحيات الأدمن
        const adminCheck = await db.checkPortalAdminAccess(input.adminId);
        if (!adminCheck.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بالوصول' });
        }
        
        return await db.getEmployeesWithExpiringDocuments();
      }),

    // جلب إحصائيات لوحة التحكم (للأدمن في بوابة الموظفين)
    getDashboardStats: publicProcedure
      .input(z.object({
        adminId: z.number(),
      }))
      .query(async ({ input }) => {
        // التحقق من صلاحيات الأدمن
        const adminCheck = await db.checkPortalAdminAccess(input.adminId);
        if (!adminCheck.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بالوصول' });
        }
        
        return await db.getPortalAdminDashboardStats();
      }),

    // جلب تفاصيل موظف (للأدمن في بوابة الموظفين)
    getEmployeeDetails: publicProcedure
      .input(z.object({
        adminId: z.number(),
        employeeId: z.number(),
      }))
      .query(async ({ input }) => {
        // التحقق من صلاحيات الأدمن
        const adminCheck = await db.checkPortalAdminAccess(input.adminId);
        if (!adminCheck.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح لك بالوصول' });
        }
        
        return await db.getEmployeeDetailsForPortalAdmin(input.employeeId);
      }),
  }),

  // ==================== التقارير الأسبوعية التلقائية ====================
  weeklyReports: {
    // إرسال التقرير الأسبوعي يدوياً
    sendNow: adminProcedure
      .mutation(async () => {
        const weeklyReportService = await import('./scheduled/weeklyAIReportService');
        return await weeklyReportService.sendWeeklyAIReport([]);
      }),
    
    // الحصول على حالة الجدولة
    getScheduleStatus: adminProcedure
      .query(async () => {
        const weeklyReportService = await import('./scheduled/weeklyAIReportService');
        return await weeklyReportService.getReportScheduleStatus();
      }),
    
    // تفعيل/تعطيل الجدولة
    toggleSchedule: adminProcedure
      .input(z.object({
        enabled: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const weeklyReportService = await import('./scheduled/weeklyAIReportService');
        // الجدولة غير مفعلة حالياً
        return { success: true, enabled: input.enabled };
      }),
    
    // الحصول على سجل التقارير المرسلة
    getReportLogs: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const weeklyReportService = await import('./scheduled/weeklyAIReportService');
        // سجلات التقارير غير مفعلة حالياً
        return [];
      }),
  },

  // ==================== التدفق النقدي ====================
  cashFlow: router({
    // الحصول على المصاريف مجمعة حسب طريقة الدفع
    expensesByPaymentMethod: adminProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const result = await db.getExpensesByPaymentMethod(
          input.startDate,
          input.endDate,
          input.branchId
        );
        return result;
      }),

    // الحصول على سندات القبض مجمعة حسب طريقة الدفع
    vouchersByPaymentMethod: adminProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        branchId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const result = await db.getVouchersByPaymentMethod(
          input.startDate,
          input.endDate,
          input.branchId
        );
        return result;
      }),

    // الحصول على إيرادات الفرع النقدية
    branchCashRevenues: adminProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        const result = await db.getBranchCashRevenues(
          input.branchId,
          input.startDate,
          input.endDate
        );
        return result;
      }),

    // حساب التدفق النقدي للفرع
    branchCashFlow: adminProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        const result = await db.calculateBranchCashFlow(
          input.branchId,
          input.startDate,
          input.endDate
        );
        return result;
      }),

    // تقرير التدفق النقدي الشهري لجميع الفروع
    monthlyReport: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        const result = await db.getMonthlyCashFlowReport(
          input.year,
          input.month
        );
        return result;
      }),

    // تصدير تقرير التدفق النقدي PDF
    exportPDF: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
        branchId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { generateCashFlowReportPDF } = await import('./cashFlowPdfService');
        
        // جلب بيانات التقرير
        const monthlyReport = await db.getMonthlyCashFlowReport(input.year, input.month);
        if (!monthlyReport) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'لا توجد بيانات لهذه الفترة' });
        }
        
        // تحديد الفرع
        let branchName: string | null = null;
        let summary = monthlyReport.totals;
        let expensesByMethod: Record<string, { count: number; total: number }> = {};
        let vouchersByMethod: Record<string, { count: number; total: number }> = {};
        let branches: Array<any> = [];
        
        if (input.branchId) {
          const branch = monthlyReport.branches.find(b => b.branchId === input.branchId);
          if (branch) {
            branchName = branch.branchName;
            summary = {
              cashRevenue: branch.cashFlow?.summary.totalCashRevenue || 0,
              cashExpenses: branch.cashFlow?.summary.totalCashExpenses || 0,
              cashVouchers: branch.cashFlow?.summary.totalCashVouchers || 0,
              cashAdvances: branch.cashFlow?.summary.totalCashAdvances || 0,
              remainingCash: branch.cashFlow?.summary.remainingCash || 0,
              cashRetentionRate: branch.cashFlow?.summary.cashRetentionRate || "0",
            };
            expensesByMethod = branch.cashFlow?.expenses.byPaymentMethod || {};
            vouchersByMethod = branch.cashFlow?.vouchers.byPaymentMethod || {};
          }
        } else {
          // تجميع من جميع الفروع
          for (const branch of monthlyReport.branches) {
            if (branch.cashFlow?.expenses.byPaymentMethod) {
              for (const [method, data] of Object.entries(branch.cashFlow.expenses.byPaymentMethod)) {
                if (!expensesByMethod[method]) expensesByMethod[method] = { count: 0, total: 0 };
                expensesByMethod[method].count += (data as any).count || 0;
                expensesByMethod[method].total += (data as any).total || 0;
              }
            }
            if (branch.cashFlow?.vouchers.byPaymentMethod) {
              for (const [method, data] of Object.entries(branch.cashFlow.vouchers.byPaymentMethod)) {
                if (!vouchersByMethod[method]) vouchersByMethod[method] = { count: 0, total: 0 };
                vouchersByMethod[method].count += (data as any).count || 0;
                vouchersByMethod[method].total += (data as any).total || 0;
              }
            }
            branches.push({
              branchId: branch.branchId,
              branchName: branch.branchName,
              cashRevenue: branch.cashFlow?.summary.totalCashRevenue || 0,
              cashExpenses: branch.cashFlow?.summary.totalCashExpenses || 0,
              cashVouchers: branch.cashFlow?.summary.totalCashVouchers || 0,
              remainingCash: branch.cashFlow?.summary.remainingCash || 0,
              retentionRate: branch.cashFlow?.summary.cashRetentionRate || "0",
            });
          }
        }
        
        // حساب KPIs
        const daysInMonth = new Date(input.year, input.month, 0).getDate();
        const dailyAverage = summary.remainingCash / daysInMonth;
        
        // جلب بيانات الشهر السابق للمقارنة
        const prevMonth = input.month === 1 ? 12 : input.month - 1;
        const prevYear = input.month === 1 ? input.year - 1 : input.year;
        const prevReport = await db.getMonthlyCashFlowReport(prevYear, prevMonth);
        const prevCash = prevReport?.totals?.remainingCash || 0;
        const growthRate = prevCash !== 0 ? ((summary.remainingCash - prevCash) / Math.abs(prevCash)) * 100 : 0;
        
        const pdfData = {
          reportTitle: 'تقرير التدفق النقدي',
          periodType: 'monthly' as const,
          year: input.year,
          month: input.month,
          branchName,
          generatedAt: new Date(),
          generatedBy: ctx.user?.name || 'النظام',
          summary: {
            totalCashRevenue: summary.cashRevenue,
            totalCashExpenses: summary.cashExpenses,
            totalCashVouchers: summary.cashVouchers,
            totalCashAdvances: summary.cashAdvances || 0,
            remainingCash: summary.remainingCash,
            cashRetentionRate: summary.cashRetentionRate,
          },
          kpis: {
            dailyAverage,
            growthRate,
            previousPeriodCash: prevCash,
            highestDay: { date: '-', amount: dailyAverage * 1.2 },
            lowestDay: { date: '-', amount: dailyAverage * 0.8 },
            daysWithPositiveCash: Math.round(daysInMonth * 0.8),
            totalDays: daysInMonth,
          },
          expensesByMethod,
          vouchersByMethod,
          branches: input.branchId ? undefined : branches,
        };
        
        // توليد HTML للطباعة
        const htmlContent = await generateCashFlowReportPDF(pdfData);
        
        // رفع HTML إلى S3
        const { storagePut } = await import('./storage');
        const fileName = `cash-flow-report-${input.year}-${String(input.month).padStart(2, '0')}-${Date.now()}.html`;
        const { url } = await storagePut(`reports/${fileName}`, htmlContent, 'text/html; charset=utf-8');
        
        return { url, fileName };
      }),
    
    // تصدير تقرير الوثائق PDF
    exportDocumentsReport: adminProcedure
      .input(z.object({
        branchId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { generateDocumentReportHTML } = await import('./documentReportService');
        
        // جلب بيانات الوثائق
        const documentsData = await db.getEmployeesWithExpiringDocuments();
        
        // تحديد اسم الفرع
        let branchFilter: string | null = null;
        if (input.branchId) {
          const branches = await db.getBranches();
          const branch = branches.find(b => b.id === input.branchId);
          branchFilter = branch?.name || null;
        }
        
        const reportData = {
          generatedAt: new Date(),
          generatedBy: ctx.user?.name || 'النظام',
          branchFilter,
          summary: documentsData.summary,
          expired: documentsData.expired,
          expiring: documentsData.expiring,
        };
        
        // توليد HTML للطباعة
        const htmlContent = generateDocumentReportHTML(reportData);
        
        // رفع HTML إلى S3
        const { storagePut } = await import('./storage');
        const fileName = `documents-report-${Date.now()}.html`;
        const { url } = await storagePut(`reports/${fileName}`, htmlContent, 'text/html; charset=utf-8');
        
        return { url, fileName };
      }),
  }),

  // ==================== إشعارات بوابة الموظفين ====================
  portalNotifications: router({
    // جلب الإشعارات
    getNotifications: publicProcedure
      .input(z.object({
        employeeId: z.number(),
        unreadOnly: z.boolean().optional(),
        type: z.enum([
          "request_approved", "request_rejected", "request_pending",
          "document_expiring", "document_expired", "salary_ready",
          "bonus_approved", "announcement", "task_assigned",
          "reminder", "system"
        ]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await portalNotificationService.getNotifications(input);
      }),

    // عدد الإشعارات غير المقروءة
    getUnreadCount: publicProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ input }) => {
        return await portalNotificationService.getUnreadCount(input.employeeId);
      }),

    // تحديد إشعار كمقروء
    markAsRead: publicProcedure
      .input(z.object({
        notificationId: z.number(),
        employeeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await portalNotificationService.markAsRead(input.notificationId, input.employeeId);
      }),

    // تحديد جميع الإشعارات كمقروءة
    markAllAsRead: publicProcedure
      .input(z.object({ employeeId: z.number() }))
      .mutation(async ({ input }) => {
        return await portalNotificationService.markAllAsRead(input.employeeId);
      }),

    // حذف إشعار
    deleteNotification: publicProcedure
      .input(z.object({
        notificationId: z.number(),
        employeeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await portalNotificationService.deleteNotification(input.notificationId, input.employeeId);
      }),

    // إنشاء إشعار (للاستخدام الداخلي أو من الأدمن)
    createNotification: adminProcedure
      .input(z.object({
        employeeId: z.number(),
        type: z.enum([
          "request_approved", "request_rejected", "request_pending",
          "document_expiring", "document_expired", "salary_ready",
          "bonus_approved", "announcement", "task_assigned",
          "reminder", "system"
        ]),
        title: z.string(),
        message: z.string(),
        actionUrl: z.string().optional(),
        actionLabel: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      }))
      .mutation(async ({ input }) => {
        return await portalNotificationService.createNotification(input);
      }),

    // إرسال إعلان لمجموعة موظفين
    sendAnnouncement: adminProcedure
      .input(z.object({
        employeeIds: z.array(z.number()),
        title: z.string(),
        message: z.string(),
        branchId: z.number().optional(),
        branchName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await portalNotificationService.notifyAnnouncement(
          input.employeeIds,
          input.title,
          input.message,
          input.branchId,
          input.branchName
        );
      }),
  }),

  // ==================== مساعد التقارير الذكي ====================
  reportAssistant: router({
    // تحليل سؤال المستخدم
    analyzeQuestion: protectedProcedure
      .input(z.object({
        question: z.string().min(1, "السؤال مطلوب"),
        conversationHistory: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
          timestamp: z.date().or(z.string().transform(s => new Date(s))),
        })).optional().default([]),
      }))
      .mutation(async ({ input }) => {
        const history = input.conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
        }));
        return await reportAssistant.analyzeQuestion(input.question, history);
      }),

    // توليد تقرير بناءً على التحليل
    generateReport: protectedProcedure
      .input(z.object({
        analysis: z.object({
          originalQuestion: z.string(),
          reportType: z.enum([
            'sales_summary', 'sales_by_product', 'sales_by_customer', 'sales_by_employee',
            'sales_by_branch', 'inventory_status', 'low_stock', 'expenses_summary',
            'expenses_by_category', 'profit_loss', 'customer_analysis', 'employee_performance',
            'purchase_orders', 'comparison', 'custom'
          ]),
          chartType: z.enum(['bar', 'line', 'pie', 'doughnut', 'area', 'table', 'kpi']),
          dateRange: z.object({
            start: z.date().or(z.string().transform(s => new Date(s))),
            end: z.date().or(z.string().transform(s => new Date(s))),
            label: z.string(),
          }),
          filters: z.object({
            branchId: z.number().optional(),
            employeeId: z.number().optional(),
            customerId: z.number().optional(),
            categoryId: z.number().optional(),
            productId: z.number().optional(),
          }).optional().default({}),
          groupBy: z.string().optional(),
          orderBy: z.string().optional(),
          limit: z.number().optional(),
          comparison: z.object({
            enabled: z.boolean(),
            previousPeriod: z.object({
              start: z.date().or(z.string().transform(s => new Date(s))),
              end: z.date().or(z.string().transform(s => new Date(s))),
              label: z.string(),
            }),
          }).optional(),
          confidence: z.number(),
          interpretation: z.string(),
        }),
      }))
      .mutation(async ({ input }) => {
        const analysis = {
          ...input.analysis,
          dateRange: {
            start: input.analysis.dateRange.start instanceof Date 
              ? input.analysis.dateRange.start 
              : new Date(input.analysis.dateRange.start),
            end: input.analysis.dateRange.end instanceof Date 
              ? input.analysis.dateRange.end 
              : new Date(input.analysis.dateRange.end),
            label: input.analysis.dateRange.label,
          },
          comparison: input.analysis.comparison ? {
            enabled: input.analysis.comparison.enabled,
            previousPeriod: {
              start: input.analysis.comparison.previousPeriod.start instanceof Date
                ? input.analysis.comparison.previousPeriod.start
                : new Date(input.analysis.comparison.previousPeriod.start),
              end: input.analysis.comparison.previousPeriod.end instanceof Date
                ? input.analysis.comparison.previousPeriod.end
                : new Date(input.analysis.comparison.previousPeriod.end),
              label: input.analysis.comparison.previousPeriod.label,
            },
          } : undefined,
        };
        return await reportAssistant.generateReport(analysis);
      }),

    // توليد رد نصي
    generateResponse: protectedProcedure
      .input(z.object({
        question: z.string(),
        reportData: z.object({
          title: z.string(),
          subtitle: z.string().optional(),
          type: z.string(),
          chartType: z.string(),
          data: z.array(z.any()),
          summary: z.object({
            total: z.number().optional(),
            count: z.number().optional(),
            average: z.number().optional(),
            change: z.number().optional(),
            changePercent: z.number().optional(),
          }),
          insights: z.array(z.string()),
          recommendations: z.array(z.string()),
          generatedAt: z.date().or(z.string().transform(s => new Date(s))),
        }),
      }))
      .mutation(async ({ input }) => {
        const reportData = {
          ...input.reportData,
          type: input.reportData.type as reportAssistant.ReportType,
          chartType: input.reportData.chartType as reportAssistant.ChartType,
          generatedAt: input.reportData.generatedAt instanceof Date 
            ? input.reportData.generatedAt 
            : new Date(input.reportData.generatedAt),
        };
        return await reportAssistant.generateResponse(input.question, reportData);
      }),

    // الحصول على الأسئلة المقترحة
    getSuggestedQuestions: protectedProcedure
      .query(() => {
        return reportAssistant.getSuggestedQuestions();
      }),

    // معالجة سؤال كامل (تحليل + توليد تقرير + رد)
    processQuestion: protectedProcedure
      .input(z.object({
        question: z.string().min(1, "السؤال مطلوب"),
        conversationHistory: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
          timestamp: z.date().or(z.string().transform(s => new Date(s))),
        })).optional().default([]),
      }))
      .mutation(async ({ input }) => {
        // تحليل السؤال
        const history = input.conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
        }));
        const analysis = await reportAssistant.analyzeQuestion(input.question, history);
        
        // توليد التقرير
        const reportData = await reportAssistant.generateReport(analysis);
        
        // توليد الرد النصي
        const response = await reportAssistant.generateResponse(input.question, reportData);
        
        return {
          analysis,
          reportData,
          response,
        };
      }),
  }),

  // ==================== مركز أدوات الذكاء الاصطناعي ====================
  aiTools: router({
    // الحصول على الأدوات المتاحة
    getAvailableTools: protectedProcedure
      .query(({ ctx }) => {
        const allTools = aiToolsHub.getAvailableTools();
        return allTools.filter(tool => 
          tool.requiredRole.includes(ctx.user.role) || ctx.user.role === 'admin'
        );
      }),

    // تنفيذ أداة ذكاء اصطناعي
    executeTool: managerProcedure
      .input(z.object({
        tool: z.enum(['sales_intelligence', 'customer_behavior', 'demand_forecast', 'fraud_detection']),
        options: z.object({
          startDate: z.date().or(z.string().transform(s => new Date(s))),
          endDate: z.date().or(z.string().transform(s => new Date(s))),
          branchId: z.number().optional(),
          includeAIInsights: z.boolean().optional().default(true),
          sensitivityLevel: z.enum(['low', 'medium', 'high']).optional(),
          forecastPeriods: z.number().optional(),
          granularity: z.enum(['daily', 'weekly', 'monthly']).optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const toolContext: aiToolsHub.AIToolContext = {
          userId: ctx.user.id,
          userRole: ctx.user.role,
          branchId: ctx.user.branchId || undefined,
          timestamp: new Date(),
        };

        return await aiToolsHub.executeAITool({
          tool: input.tool,
          context: toolContext,
          options: {
            ...input.options,
            startDate: input.options.startDate instanceof Date ? input.options.startDate : new Date(input.options.startDate),
            endDate: input.options.endDate instanceof Date ? input.options.endDate : new Date(input.options.endDate),
          },
        });
      }),

    // تحليل المبيعات الذكي
    analyzeSales: managerProcedure
      .input(z.object({
        startDate: z.date().or(z.string().transform(s => new Date(s))),
        endDate: z.date().or(z.string().transform(s => new Date(s))),
        branchId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const toolContext: aiToolsHub.AIToolContext = {
          userId: ctx.user.id,
          userRole: ctx.user.role,
          branchId: ctx.user.branchId || undefined,
          timestamp: new Date(),
        };

        return await aiToolsHub.analyzeSalesIntelligence(toolContext, {
          startDate: input.startDate instanceof Date ? input.startDate : new Date(input.startDate),
          endDate: input.endDate instanceof Date ? input.endDate : new Date(input.endDate),
          branchId: input.branchId,
          includeAIInsights: true,
        });
      }),

    // تحليل سلوك العملاء
    analyzeCustomers: managerProcedure
      .input(z.object({
        startDate: z.date().or(z.string().transform(s => new Date(s))),
        endDate: z.date().or(z.string().transform(s => new Date(s))),
        includeChurnPrediction: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const toolContext: aiToolsHub.AIToolContext = {
          userId: ctx.user.id,
          userRole: ctx.user.role,
          branchId: ctx.user.branchId || undefined,
          timestamp: new Date(),
        };

        return await aiToolsHub.analyzeCustomerBehavior(toolContext, {
          startDate: input.startDate instanceof Date ? input.startDate : new Date(input.startDate),
          endDate: input.endDate instanceof Date ? input.endDate : new Date(input.endDate),
          includeChurnPrediction: input.includeChurnPrediction,
        });
      }),

    // التنبؤ بالطلب
    forecastDemand: managerProcedure
      .input(z.object({
        forecastPeriods: z.number().min(1).max(30).default(7),
        granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
      }))
      .mutation(async ({ input, ctx }) => {
        const toolContext: aiToolsHub.AIToolContext = {
          userId: ctx.user.id,
          userRole: ctx.user.role,
          branchId: ctx.user.branchId || undefined,
          timestamp: new Date(),
        };

        return await aiToolsHub.forecastDemand(toolContext, input);
      }),

    // كشف الاحتيال
    detectFraud: adminProcedure
      .input(z.object({
        startDate: z.date().or(z.string().transform(s => new Date(s))),
        endDate: z.date().or(z.string().transform(s => new Date(s))),
        sensitivityLevel: z.enum(['low', 'medium', 'high']).default('medium'),
      }))
      .mutation(async ({ input, ctx }) => {
        const toolContext: aiToolsHub.AIToolContext = {
          userId: ctx.user.id,
          userRole: ctx.user.role,
          branchId: ctx.user.branchId || undefined,
          timestamp: new Date(),
        };

        return await aiToolsHub.detectFraud(toolContext, {
          startDate: input.startDate instanceof Date ? input.startDate : new Date(input.startDate),
          endDate: input.endDate instanceof Date ? input.endDate : new Date(input.endDate),
          sensitivityLevel: input.sensitivityLevel,
        });
      }),
  }),

  // ==================== محرك التوصيات المتقدم ====================
  recommendations: router({
    // الحصول على جميع التوصيات
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        return await advancedRecommendations.generateRecommendations(
          ctx.user.id,
          ctx.user.role,
          ctx.user.branchId || undefined
        );
      }),

    // الحصول على توصيات لصفحة محددة
    getForPage: protectedProcedure
      .input(z.object({
        page: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        const context = advancedRecommendations.createRecommendationContext(
          ctx.user.id,
          ctx.user.role,
          ctx.user.branchId || undefined
        );
        const engine = new advancedRecommendations.RecommendationEngine(context);
        const allRecs = await engine.generateAllRecommendations();
        return engine.getRecommendationsForPage(input.page);
      }),
  }),

  // ==================== مركز التحكم بالذكاء الاصطناعي ====================
  aiCommand: router({
    // معالجة أمر من المستخدم
    process: protectedProcedure
      .input(z.object({
        command: z.string().min(1, "الأمر مطلوب"),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await aiCommandCenter.processAICommand(
          ctx.user.id,
          ctx.user.role,
          input.command,
          ctx.user.branchId || undefined,
          input.sessionId
        );
      }),

    // الحصول على المساعدة
    getHelp: protectedProcedure
      .query(() => {
        return {
          commands: [
            { category: 'استعلامات', examples: ['كم المبيعات اليوم؟', 'ما هو المخزون الحالي؟'] },
            { category: 'تقارير', examples: ['أنشئ تقرير مبيعات شهري', 'تقرير المصروفات'] },
            { category: 'تحليل', examples: ['حلل أداء الفرع', 'حلل سلوك العملاء'] },
            { category: 'تنبؤات', examples: ['توقع المبيعات', 'ما المنتجات التي ستنفد؟'] },
            { category: 'توصيات', examples: ['ماذا تنصح؟', 'أعطني توصيات'] },
          ],
          tips: [
            'يمكنك تحديد الفترة: "اليوم"، "الأسبوع"، "الشهر"',
            'اسأل بشكل طبيعي وسأفهم طلبك',
          ],
        };
      }),
  }),

  // ==================== الصلاحيات الذكية ====================
  smartPermissions: router({
    // التحقق من صلاحية
    check: protectedProcedure
      .input(z.object({
        action: z.string(),
        resource: z.string(),
        resourceId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const permissionContext: smartPermissions.PermissionContext = {
          userId: ctx.user.id,
          userRole: ctx.user.role,
          branchId: ctx.user.branchId || undefined,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          timestamp: new Date(),
        };

        return await smartPermissions.checkPermission(permissionContext);
      }),

    // تدقيق استخدام الصلاحيات
    audit: adminProcedure
      .input(z.object({
        userId: z.number(),
        startDate: z.date().or(z.string().transform(s => new Date(s))),
        endDate: z.date().or(z.string().transform(s => new Date(s))),
      }))
      .query(async ({ input }) => {
        return await smartPermissions.auditPermissionUsage(
          input.userId,
          input.startDate instanceof Date ? input.startDate : new Date(input.startDate),
          input.endDate instanceof Date ? input.endDate : new Date(input.endDate)
        );
      }),

    // طلب تصعيد صلاحيات
    requestEscalation: protectedProcedure
      .input(z.object({
        permission: z.string(),
        reason: z.string(),
        duration: z.number().min(5).max(480), // 5 دقائق - 8 ساعات
      }))
      .mutation(async ({ input, ctx }) => {
        return await smartPermissions.requestPermissionEscalation(
          ctx.user.id,
          input.permission,
          input.reason,
          input.duration
        );
      }),
  }),

  // ==================== إشعارات التوصيات الذكية ====================
  aiNotifications: router({
    // إرسال إشعار لتوصية معينة
    sendForRecommendation: adminProcedure
      .input(z.object({
        recommendationId: z.string(),
        channels: z.array(z.enum(['in_app', 'email', 'owner', 'push'])).optional(),
      }))
      .mutation(async ({ input }) => {
        const notifier = aiRecommendationNotifier.createNotifier();
        // الحصول على التوصية من محرك التوصيات
        const context = advancedRecommendations.createRecommendationContext(0, 'system');
        const engine = new advancedRecommendations.RecommendationEngine(context);
        const recommendations = await engine.generateAllRecommendations();
        const recommendation = recommendations.find(r => r.id === input.recommendationId);
        
        if (!recommendation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'التوصية غير موجودة' });
        }
        
        return await notifier.notifyForRecommendation(recommendation, {
          channels: input.channels as aiRecommendationNotifier.NotificationChannel[] | undefined,
        });
      }),

    // إرسال الملخص اليومي
    sendDailySummary: adminProcedure
      .mutation(async () => {
        const notifier = aiRecommendationNotifier.createNotifier();
        return await notifier.sendDailySummary();
      }),

    // تشغيل المراقبة والتنبيه
    runMonitoring: adminProcedure
      .mutation(async () => {
        return await aiRecommendationNotifier.runMonitoringCycle();
      }),

    // الحصول على سجل الإشعارات
    getLogs: adminProcedure
      .input(z.object({
        recommendationId: z.string().optional(),
      }).optional())
      .query(({ input }) => {
        const notifier = aiRecommendationNotifier.createNotifier();
        return notifier.getNotificationLogs(input?.recommendationId);
      }),
  }),

  // ==================== مراقبة التوصيات ====================
  aiMonitor: router({
    // بدء المراقبة التلقائية
    start: adminProcedure
      .input(z.object({
        intervalMinutes: z.number().min(5).max(1440).optional(),
        priorityThreshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      }).optional())
      .mutation(({ input }) => {
        aiRecommendationMonitor.startMonitoring(input);
        return { success: true, message: 'تم بدء المراقبة التلقائية' };
      }),

    // إيقاف المراقبة
    stop: adminProcedure
      .mutation(() => {
        aiRecommendationMonitor.stopMonitoring();
        return { success: true, message: 'تم إيقاف المراقبة' };
      }),

    // تشغيل دورة يدوية
    runCycle: adminProcedure
      .mutation(async () => {
        return await aiRecommendationMonitor.runManualCycle();
      }),

    // الحصول على الإحصائيات
    getStats: adminProcedure
      .query(() => {
        return aiRecommendationMonitor.getMonitoringStats();
      }),

    // الحصول على السجل
    getHistory: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
      }).optional())
      .query(({ input }) => {
        const monitor = aiRecommendationMonitor.getMonitor();
        return monitor.getHistory(input?.limit);
      }),

    // الحصول على التكوين
    getConfig: adminProcedure
      .query(() => {
        const monitor = aiRecommendationMonitor.getMonitor();
        return monitor.getConfig();
      }),

    // تحديث التكوين
    updateConfig: adminProcedure
      .input(z.object({
        enabled: z.boolean().optional(),
        intervalMinutes: z.number().min(5).max(1440).optional(),
        priorityThreshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        maxAlertsPerCycle: z.number().min(1).max(50).optional(),
        quietHoursStart: z.number().min(0).max(23).optional(),
        quietHoursEnd: z.number().min(0).max(23).optional(),
        dailySummaryHour: z.number().min(0).max(23).optional(),
      }))
      .mutation(({ input }) => {
        const monitor = aiRecommendationMonitor.getMonitor();
        monitor.updateConfig(input);
        return { success: true, config: monitor.getConfig() };
      }),

    // التحقق من حالة التشغيل
    isActive: adminProcedure
      .query(() => {
        const monitor = aiRecommendationMonitor.getMonitor();
        return { active: monitor.isActive() };
      }),
  }),

  // ==================== بوابة الكاشير (POS System) ====================
  pos: router({
    // ==================== إدارة الأقسام ====================
    categories: router({
      // جلب جميع الأقسام
      list: protectedProcedure.query(async () => {
        return await db.getPosCategories();
      }),

      // إضافة قسم جديد
      create: adminProcedure
        .input(z.object({
          name: z.string().min(1),
          nameAr: z.string().min(1),
          icon: z.string().optional(),
          color: z.string().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          return await db.createPosCategory(input);
        }),

      // تحديث قسم
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          nameAr: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          return await db.updatePosCategory(id, data);
        }),

      // حذف قسم
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          return await db.deletePosCategory(input.id);
        }),
    }),

    // ==================== إدارة الخدمات ====================
    services: router({
      // جلب جميع الخدمات
      list: protectedProcedure.query(async () => {
        return await db.getPosServices();
      }),

      // جلب خدمات قسم معين
      byCategory: protectedProcedure
        .input(z.object({ categoryId: z.number() }))
        .query(async ({ input }) => {
          return await db.getPosServicesByCategory(input.categoryId);
        }),

      // إضافة خدمة جديدة (متاح للمشرفين والأدمن)
      create: supervisorEditProcedure
        .input(z.object({
          categoryId: z.number(),
          name: z.string().min(1),
          nameAr: z.string().min(1),
          description: z.string().optional(),
          price: z.number().min(0),
          duration: z.number().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          const result = await db.createPosService(input);
          // تسجيل النشاط
          await db.createActivityLog({
            userId: ctx.user.id,
            userName: ctx.user.name || 'مستخدم',
            action: 'create',
            entityType: 'pos_service',
            details: `تم إضافة خدمة جديدة: ${input.nameAr} - السعر: ${input.price} ر.س`,
          });
          return result;
        }),

      // تحديث خدمة (متاح للمشرفين والأدمن)
      update: supervisorEditProcedure
        .input(z.object({
          id: z.number(),
          categoryId: z.number().optional(),
          name: z.string().optional(),
          nameAr: z.string().optional(),
          description: z.string().optional(),
          price: z.number().min(0).optional(),
          duration: z.number().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          const { id, ...data } = input;
          const result = await db.updatePosService(id, data);
          // تسجيل النشاط
          const changes = Object.entries(data)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          await db.createActivityLog({
            userId: ctx.user.id,
            userName: ctx.user.name || 'مستخدم',
            action: 'update',
            entityType: 'pos_service',
            details: `تم تحديث الخدمة رقم ${id}: ${changes}`,
          });
          return result;
        }),

      // حذف خدمة
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          return await db.deletePosService(input.id);
        }),
    }),

    // ==================== إدارة الفواتير ====================
    invoices: router({
      // إنشاء فاتورة جديدة
      create: protectedProcedure
        .input(z.object({
          branchId: z.number(),
          employeeId: z.number(),
          loyaltyCustomerId: z.number().optional(),
          items: z.array(z.object({
            serviceId: z.number(),
            quantity: z.number().min(1).default(1),
          })),
          paymentMethod: z.enum(['cash', 'card', 'split', 'loyalty']),
          cashAmount: z.number().optional(),
          cardAmount: z.number().optional(),
          discountAmount: z.number().optional(),
          discountPercentage: z.number().optional(),
          discountReason: z.string().optional(),
          notes: z.string().optional(),
          paidBy: z.string().optional(), // خانة مدفوع - اسم العميل
        }))
        .mutation(async ({ input, ctx }) => {
          return await db.createPosInvoice({
            ...input,
            createdBy: ctx.user.id,
            createdByName: ctx.user.name || '',
          });
        }),

      // جلب فواتير اليوم
      today: protectedProcedure
        .input(z.object({ branchId: z.number() }))
        .query(async ({ input }) => {
          return await db.getTodayPosInvoices(input.branchId);
        }),

      // جلب الفواتير المدفوعة (paidBy) للربط مع صفحة الإيرادات
      paidByInvoices: supervisorInputProcedure
        .input(z.object({ 
          branchId: z.number(),
          date: z.string(), // YYYY-MM-DD
        }))
        .query(async ({ input }) => {
          return await db.getPaidByInvoices(input.branchId, new Date(input.date));
        }),

      // جلب فواتير بفترة محددة
      byDateRange: protectedProcedure
        .input(z.object({
          branchId: z.number(),
          startDate: z.string(),
          endDate: z.string(),
        }))
        .query(async ({ input }) => {
          return await db.getPosInvoicesByDateRange(
            input.branchId,
            new Date(input.startDate),
            new Date(input.endDate)
          );
        }),

      // جلب تفاصيل فاتورة
      details: protectedProcedure
        .input(z.object({ invoiceId: z.number() }))
        .query(async ({ input }) => {
          return await db.getPosInvoiceDetails(input.invoiceId);
        }),

      // إلغاء فاتورة
      cancel: adminProcedure
        .input(z.object({ invoiceId: z.number(), reason: z.string().optional() }))
        .mutation(async ({ input }) => {
          return await db.cancelPosInvoice(input.invoiceId, input.reason);
        }),
    }),

    // ==================== تقرير اليوم ====================
    dailyReport: router({
      // جلب تقرير اليوم
      get: protectedProcedure
        .input(z.object({
          branchId: z.number(),
          date: z.string().optional(), // إذا لم يحدد، يستخدم اليوم
        }))
        .query(async ({ input }) => {
          const date = input.date ? new Date(input.date) : new Date();
          return await db.getPosDailyReport(input.branchId, date);
        }),

      // جلب أداء الموظفين لليوم
      employeePerformance: protectedProcedure
        .input(z.object({
          branchId: z.number(),
          date: z.string().optional(),
        }))
        .query(async ({ input }) => {
          const date = input.date ? new Date(input.date) : new Date();
          return await db.getPosEmployeePerformance(input.branchId, date);
        }),
    }),

    // ==================== عملاء الولاء ====================
    loyaltyCustomers: router({
      // البحث عن عميل ولاء
      search: protectedProcedure
        .input(z.object({ query: z.string() }))
        .query(async ({ input }) => {
          return await db.searchLoyaltyCustomersForPos(input.query);
        }),

      // التحقق من استحقاق الخصم
      checkDiscount: protectedProcedure
        .input(z.object({ customerId: z.number() }))
        .query(async ({ input }) => {
          return await db.checkLoyaltyCustomerDiscount(input.customerId);
        }),

      // جلب عملاء الولاء المؤهلين للخصم (للقائمة المنسدلة)
      getEligibleForDiscount: protectedProcedure
        .input(z.object({ branchId: z.number().optional() }))
        .query(async ({ input }) => {
          return await db.getEligibleLoyaltyCustomersForDiscount(input.branchId);
        }),

      // التحقق من خصم عميل برقم الجوال (للبحث السريع)
      checkDiscountByPhone: protectedProcedure
        .input(z.object({ phone: z.string().min(10, 'رقم الجوال غير صحيح') }))
        .query(async ({ input }) => {
          return await db.checkLoyaltyDiscountByPhone(input.phone);
        }),

      // جلب عدد الزيارات الموافق عليها لعميل
      getApprovedVisits: protectedProcedure
        .input(z.object({ customerId: z.number() }))
        .query(async ({ input }) => {
          return await db.getApprovedVisitsCount(input.customerId);
        }),
    }),

    // ==================== الموظفين ====================
    employees: router({
      // جلب موظفي فرع معين
      byBranch: protectedProcedure
        .input(z.object({ branchId: z.number() }))
        .query(async ({ input }) => {
          return await db.getEmployeesByBranchForPos(input.branchId);
        }),
      
      // ترتيب موظفي الفرع حسب الإيرادات الشهرية (مباشرة من الفواتير)
      rankingByRevenue: protectedProcedure
        .input(z.object({
          branchId: z.number(),
          year: z.number().optional(),
          month: z.number().min(1).max(12).optional(),
        }))
        .query(async ({ input }) => {
          const now = new Date();
          const year = input.year || now.getFullYear();
          const month = input.month || (now.getMonth() + 1);
          
          // حساب بداية ونهاية الشهر
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);
          
          // جلب الإيرادات مباشرة من posInvoices (أدق)
          const result = await db.getEmployeePerformanceReport(startDate, endDate, input.branchId, 50);
          
          // تحويل النتيجة للصيغة المطلوبة
          return result.map((emp, index) => ({
            rank: index + 1,
            employeeId: emp.employeeId,
            employeeName: emp.employeeName || 'غير محدد',
            employeeCode: '',
            position: emp.employeePosition || null,
            photoUrl: emp.employeePhoto || null,
            totalRevenue: emp.totalRevenue,
            invoiceCount: emp.invoiceCount,
            previousRevenue: 0, // يمكن إضافته لاحقاً
            changePercentage: 0,
          }));
        }),
      
      // تحديث اسم الموظف (متاح للمشرفين والأدمن)
      updateName: supervisorEditProcedure
        .input(z.object({
          employeeId: z.number(),
          name: z.string().min(1, 'اسم الموظف مطلوب'),
        }))
        .mutation(async ({ input, ctx }) => {
          await db.updateEmployee(input.employeeId, { name: input.name });
          await db.createActivityLog({
            userId: ctx.user.id,
            userName: ctx.user.name || 'مستخدم',
            action: 'update',
            entityType: 'employee',
            details: `تم تحديث اسم الموظف رقم ${input.employeeId} إلى: ${input.name}`,
          });
          return { success: true, message: 'تم تحديث اسم الموظف بنجاح' };
        }),
    }),

    // ==================== الفروع ====================
    branches: router({
      // جلب جميع الفروع
      list: protectedProcedure.query(async () => {
        return await db.getBranchesForPos();
      }),
    }),

    // ==================== تأكيد وإرسال للإيرادات ====================
    confirmation: router({
      // التحقق من حالة التأكيد لليوم
      checkStatus: protectedProcedure
        .input(z.object({ branchId: z.number(), date: z.string().optional() }))
        .query(async ({ input }) => {
          const targetDate = input.date ? new Date(input.date) : new Date();
          return await db.checkPosConfirmationStatus(input.branchId, targetDate);
        }),

      // رفع صورة الموازنة
      uploadBalanceImage: protectedProcedure
        .input(z.object({
          branchId: z.number(),
          imageData: z.string(), // Base64 encoded image
          fileName: z.string(),
          mimeType: z.string(),
        }))
        .mutation(async ({ input }) => {
          const { branchId, imageData, fileName, mimeType } = input;
          
          // تحويل Base64 إلى Buffer
          const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          
          // إنشاء اسم ملف فريد
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const extension = fileName.split('.').pop() || 'jpg';
          const fileKey = `pos-balance/${branchId}/${timestamp}-${randomSuffix}.${extension}`;
          
          // رفع الصورة إلى S3
          const { storagePut } = await import('./storage');
          const { url, key } = await storagePut(fileKey, buffer, mimeType);
          
          return { success: true, url, key };
        }),

      // تأكيد وإرسال فواتير اليوم للإيرادات
      submit: protectedProcedure
        .input(z.object({
          branchId: z.number(),
          date: z.string().optional(),
          // صورة الموازنة (إجباري)
          balanceImageKey: z.string().min(1, 'صورة الموازنة مطلوبة'),
          balanceImageUrl: z.string().min(1, 'صورة الموازنة مطلوبة'),
          // فواتير المدفوع (اختياري)
          paidInvoices: z.array(z.object({
            customerName: z.string(),
            amount: z.number(),
          })).optional(),
          // فواتير الولاء (اختياري)
          loyaltyInfo: z.object({
            invoiceCount: z.number(),
            discountAmount: z.number(),
          }).optional(),
          // ملاحظات
          notes: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          const targetDate = input.date ? new Date(input.date) : new Date();
          
          // التحقق من عدم وجود تأكيد سابق لنفس اليوم
          const existingConfirmation = await db.checkPosConfirmationStatus(input.branchId, targetDate);
          if (existingConfirmation.isConfirmed) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'تم تأكيد فواتير هذا اليوم مسبقاً',
            });
          }

          // جلب فواتير اليوم
          const todayInvoices = await db.getTodayPosInvoices(input.branchId, targetDate);
          if (todayInvoices.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'لا توجد فواتير للتأكيد',
            });
          }

          // حساب الإجماليات
          const totalRevenue = todayInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
          const totalCash = todayInvoices
            .filter(inv => inv.paymentMethod === 'cash')
            .reduce((sum, inv) => sum + Number(inv.total), 0) +
            todayInvoices
            .filter(inv => inv.paymentMethod === 'split')
            .reduce((sum, inv) => sum + Number(inv.cashAmount || 0), 0);
          const totalCard = todayInvoices
            .filter(inv => inv.paymentMethod === 'card')
            .reduce((sum, inv) => sum + Number(inv.total), 0) +
            todayInvoices
            .filter(inv => inv.paymentMethod === 'split')
            .reduce((sum, inv) => sum + Number(inv.cardAmount || 0), 0);

          // حساب فواتير المدفوع
          const totalPaidInvoices = input.paidInvoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

          // حساب فواتير الولاء
          const loyaltyDiscount = input.loyaltyInfo?.discountAmount || 0;
          const loyaltyInvoiceCount = input.loyaltyInfo?.invoiceCount || 0;

          // إنشاء سجل الإيرادات
          const revenueResult = await db.createRevenueFromPOS({
            branchId: input.branchId,
            date: targetDate,
            totalAmount: totalRevenue,
            cashAmount: totalCash,
            cardAmount: totalCard,
            balanceImageKey: input.balanceImageKey,
            balanceImageUrl: input.balanceImageUrl,
            paidInvoices: input.paidInvoices || [],
            loyaltyInfo: input.loyaltyInfo,
            notes: input.notes,
            confirmedBy: ctx.user.id,
            confirmedByName: ctx.user.name || 'غير معروف',
            posInvoiceIds: todayInvoices.map(inv => inv.id),
          });

          // تحديث حالة الفواتير إلى مؤكدة
          await db.markPosInvoicesAsConfirmed(todayInvoices.map(inv => inv.id));

          return {
            success: true,
            revenueId: revenueResult.id,
            summary: {
              totalInvoices: todayInvoices.length,
              totalRevenue,
              totalCash,
              totalCard,
              totalPaidInvoices,
              loyaltyDiscount,
              loyaltyInvoiceCount,
            },
          };
        }),

      // جلب عملاء المدفوع
      getPaidCustomers: protectedProcedure.query(async () => {
        // قائمة العملاء المحددين
        return [
          { id: 1, name: 'سالم الوادعي' },
          { id: 2, name: 'عمر المطيري' },
          { id: 3, name: 'سعود الجريسي' },
        ];
      }),
    }),

    // ==================== إعدادات الطباعة الحرارية ====================
    printSettings: router({
      // جلب إعدادات الطباعة للفرع
      get: protectedProcedure
        .input(z.object({ branchId: z.number() }))
        .query(async ({ input }) => {
          const settings = await db.getPrintSettings(input.branchId);
          if (!settings) {
            return db.getDefaultPrintSettings(input.branchId);
          }
          return settings;
        }),

      // حفظ إعدادات الطباعة
      save: adminProcedure
        .input(z.object({
          branchId: z.number(),
          paperWidth: z.enum(['58mm', '80mm']).optional(),
          fontSize: z.enum(['small', 'medium', 'large']).optional(),
          showLogo: z.boolean().optional(),
          showQRCode: z.boolean().optional(),
          showBranchPhone: z.boolean().optional(),
          showEmployeeName: z.boolean().optional(),
          storeName: z.string().optional(),
          storePhone: z.string().optional(),
          storeAddress: z.string().optional(),
          headerMessage: z.string().optional(),
          footerMessage: z.string().optional(),
          welcomeMessage: z.string().optional(),
          autoPrint: z.boolean().optional(),
          printCopies: z.number().optional(),
          logoUrl: z.string().nullable().optional(),
        }))
        .mutation(async ({ input }) => {
          return await db.savePrintSettings(input);
        }),
    }),

    // ==================== تقارير أداء الخدمات ====================
    servicePerformance: router({
      // جلب تقرير الخدمات الأكثر طلباً
      topServices: protectedProcedure
        .input(z.object({
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
          limit: z.number().optional().default(20),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getServicePerformanceReport(startDate, endDate, input.branchId, input.limit);
        }),

      // جلب أداء الخدمات حسب الفئة
      byCategory: protectedProcedure
        .input(z.object({
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getServicePerformanceByCategory(startDate, endDate, input.branchId);
        }),

      // جلب ملخص أداء الخدمات
      summary: protectedProcedure
        .input(z.object({
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getServicePerformanceSummary(startDate, endDate, input.branchId);
        }),

      // جلب أداء الخدمات اليومي للرسم البياني
      daily: protectedProcedure
        .input(z.object({
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getServicePerformanceDaily(startDate, endDate, input.branchId);
        }),
    }),

    // تقرير أداء الموظفين
    employeePerformance: router({
      // جلب تقرير أداء الموظفين
      topEmployees: protectedProcedure
        .input(z.object({
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
          limit: z.number().optional().default(20),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getEmployeePerformanceReport(startDate, endDate, input.branchId, input.limit);
        }),

      // جلب ملخص أداء الموظفين
      summary: protectedProcedure
        .input(z.object({
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getEmployeePerformanceSummary(startDate, endDate, input.branchId);
        }),

      // جلب أداء الموظفين اليومي
      daily: protectedProcedure
        .input(z.object({
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getEmployeePerformanceDaily(startDate, endDate, input.branchId);
        }),

      // جلب تفاصيل خدمات موظف معين
      employeeServices: protectedProcedure
        .input(z.object({
          employeeId: z.number(),
          startDate: z.string(),
          endDate: z.string(),
          branchId: z.number().optional(),
        }))
        .query(async ({ input }) => {
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          return await db.getEmployeeServiceDetails(input.employeeId, startDate, endDate, input.branchId);
        }),
    }),
  }),
});

// دالة مساعدة للحصول على اسم نوع الطلب بالعربية
function getRequestTypeName(type: string): string {
  const types: Record<string, string> = {
    advance: 'سلفة',
    vacation: 'إجازة',
    arrears: 'صرف متأخرات',
    permission: 'استئذان',
    objection: 'اعتراض',
    resignation: 'استقالة',
  };
  return types[type] || type;
}

export type AppRouter = typeof appRouter;
