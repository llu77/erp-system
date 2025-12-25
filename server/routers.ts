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
  const allowedRoles = ['admin', 'manager', 'employee', 'supervisor'];
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

    create: managerProcedure
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

    update: managerProcedure
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

    updateStatus: managerProcedure
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
        }).catch(err => console.error('خطأ في إرسال إشعار أمر الشراء:', err));

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
  }),

  // ==================== إدارة الفروع ====================
  branches: router({
    list: protectedProcedure.query(async () => {
      return await db.getBranches();
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
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createEmployee({
          code: input.code,
          name: input.name,
          branchId: input.branchId || 0,
          phone: input.phone,
          position: input.position,
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

    update: managerProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().min(1),
        name: z.string().min(1),
        branchId: z.number().optional(),
        phone: z.string().optional(),
        position: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateEmployee(input.id, {
          code: input.code,
          name: input.name,
          branchId: input.branchId || 0,
          phone: input.phone || null,
          position: input.position || null,
          isActive: input.isActive ?? true,
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
        const calculatedBalance = networkAmount;
        // الإجمالي = الكاش + الشبكة
        const calculatedTotal = cashAmount + networkAmount;

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
          total: calculatedTotal.toString(), // الإجمالي = النقدي فقط
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
            console.error('Bonus sync error:', error.message);
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
          }).catch(err => console.error('خطأ في إرسال إشعار عدم التطابق:', err));
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
          console.log('[Smart Monitoring] Revenue analyzed:', monitoringResult.severity);
        } catch (error: any) {
          console.error('[Smart Monitoring] Error:', error.message);
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
  }),

  // ==================== إدارة البونص الأسبوعي ====================
  bonuses: router({
    // الحصول على بونص الأسبوع الحالي أو آخر أسبوع يحتوي على إيرادات (متاح للجميع)
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

        // البحث عن أسبوع يحتوي على إيرادات (الأسبوع الحالي أولاً، ثم الأسبوع السابق)
        let weeklyBonus = await db.getCurrentWeekBonus(input.branchId, year, month, currentWeekNumber);
        let details = weeklyBonus ? await db.getBonusDetails(weeklyBonus.id) : [];
        
        // إذا كان الأسبوع الحالي فارغاً أو كل الإيرادات 0، ابحث عن الأسبوع السابق
        const hasRevenues = details.some(d => Number(d.weeklyRevenue) > 0);
        
        if (!weeklyBonus || !hasRevenues) {
          // جرب الأسبوع السابق
          const prevWeekNumber = currentWeekNumber > 1 ? currentWeekNumber - 1 : 5;
          const prevMonth = currentWeekNumber > 1 ? month : (month > 1 ? month - 1 : 12);
          const prevYear = currentWeekNumber > 1 ? year : (month > 1 ? year : year - 1);
          
          const prevWeeklyBonus = await db.getCurrentWeekBonus(input.branchId, prevYear, prevMonth, prevWeekNumber);
          if (prevWeeklyBonus) {
            const prevDetails = await db.getBonusDetails(prevWeeklyBonus.id);
            const prevHasRevenues = prevDetails.some(d => Number(d.weeklyRevenue) > 0);
            
            if (prevHasRevenues) {
              weeklyBonus = prevWeeklyBonus;
              details = prevDetails;
            }
          }
        }
        
        if (!weeklyBonus) {
          return null;
        }

        const branch = await db.getBranchById(input.branchId);

        return {
          ...weeklyBonus,
          branchName: branch?.nameAr || 'غير محدد',
          details,
          eligibleCount: details.filter(d => d.isEligible).length,
          totalEmployees: details.length,
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
          const now = new Date();
          const branchId = bonusDetails[0].employeeId ? (await db.getEmployeeById(bonusDetails[0].employeeId))?.branchId || 1 : 1;
          const weeklyBonus = await db.getCurrentWeekBonus(branchId, now.getFullYear(), now.getMonth() + 1, Math.ceil(now.getDate() / 7));
          if (weeklyBonus) {
            const branch = await db.getBranchById(weeklyBonus.branchId);
            const userDetail = bonusDetails.find(d => d.employeeName === ctx.user.name);
            
            emailNotifications.notifyBonusRequest({
              employeeName: ctx.user.name || 'مشرف',
              amount: userDetail ? parseFloat(String(userDetail.bonusAmount)) : parseFloat(String(weeklyBonus.totalAmount)),
              weekNumber: weeklyBonus.weekNumber,
              month: weeklyBonus.month,
              year: weeklyBonus.year,
              branchId: weeklyBonus.branchId,
              branchName: branch?.nameAr || 'غير محدد',
              weeklyRevenue: userDetail ? parseFloat(String(userDetail.weeklyRevenue)) : 0,
              tier: userDetail?.bonusTier || 'none',
            }).catch(err => console.error('خطأ في إرسال إشعار طلب البونص:', err));
          }
        }

        return { success: true, message: 'تم إرسال طلب الصرف بنجاح' };
      }),

    // طلبات البونص المعلقة (للمسؤول)
    pending: adminProcedure.query(async () => {
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
          }).catch(err => console.error('خطأ في إرسال إشعار البريد:', err));
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
        }).catch(err => console.error('خطأ في إرسال إشعار تحديث الحالة:', err));

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
    // الحصول على جميع المسيرات
    list: managerProcedure.query(async () => {
      return await db.getAllPayrolls();
    }),

    // الحصول على مسيرات فرع معين
    byBranch: managerProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPayrollsByBranch(input.branchId);
      }),

    // الحصول على مسيرة بالمعرف
    getById: managerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPayrollById(input.id);
      }),

    // الحصول على تفاصيل المسيرة
    details: managerProcedure
      .input(z.object({ payrollId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPayrollDetails(input.payrollId);
      }),

    // إنشاء مسيرة رواتب شهرية
    generate: adminProcedure
      .input(z.object({
        branchId: z.number(),
        branchName: z.string(),
        year: z.number(),
        month: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const payroll = await db.generateMonthlyPayroll(
            input.branchId,
            input.branchName,
            input.year,
            input.month,
            ctx.user.id,
            ctx.user.name || 'مسؤول'
          );
          return { success: true, message: 'تم إنشاء مسيرة الرواتب بنجاح', payroll };
        } catch (error: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
      }),

    // تحديث حالة المسيرة
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['draft', 'pending', 'approved', 'paid', 'cancelled']),
      }))
      .mutation(async ({ input, ctx }) => {
        const updateData: any = { status: input.status };
        
        if (input.status === 'approved') {
          updateData.approvedBy = ctx.user.id;
          updateData.approvedByName = ctx.user.name;
          updateData.approvedAt = new Date();
        } else if (input.status === 'paid') {
          updateData.paidAt = new Date();
        }
        
        await db.updatePayroll(input.id, updateData);
        
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
  }),

  // ==================== إعدادات رواتب الموظفين ====================
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
      }))
      .mutation(async ({ input, ctx }) => {
        // التحقق من صلاحية الوصول للفرع للمشرفين
        if (ctx.user.role === 'supervisor' && ctx.user.branchId !== null && input.branchId && ctx.user.branchId !== input.branchId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك إدخال مصاريف لفرع آخر' });
        }
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
          }).catch(err => console.error('خطأ في إرسال إشعار المصروف:', err));
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
          console.log('[Smart Monitoring] Expense analyzed:', monitoringResult.severity);
        } catch (error: any) {
          console.error('[Smart Monitoring] Expense Error:', error.message);
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

    // سجلات المصروف
    logs: managerProcedure
      .input(z.object({ expenseId: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpenseLogs(input.expenseId);
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
        return await db.getSentNotifications(input.limit || 100);
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
    sendMonthlyReminder: adminProcedure.mutation(async () => {
      return await advancedNotifications.sendMonthlyInventoryReminder();
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
