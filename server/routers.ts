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
  // المشرف يمكنه الإدخال فقط
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'manager' && ctx.user.role !== 'employee') {
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

  // ==================== إدارة أوامر الشراء ====================
  purchaseOrders: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllPurchaseOrders();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getPurchaseOrderById(input.id);
        if (!order) return null;
        const items = await db.getPurchaseOrderItems(input.id);
        return { ...order, items };
      }),

    create: managerProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        supplierName: z.string().optional(),
        expectedDate: z.date().optional(),
        taxRate: z.string().optional(),
        shippingCost: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number().optional(),
          productName: z.string(),
          productSku: z.string().optional(),
          quantity: z.number().min(1),
          unitCost: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deletePurchaseOrder(input.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'delete',
          entityType: 'purchase_order',
          entityId: input.id,
          details: `تم حذف أمر الشراء`,
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
  }),

  // ==================== لوحة التحكم والتقارير ====================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDashboardStats();
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
        employeeRevenues: z.array(z.object({
          employeeId: z.number(),
          cash: z.string(),
          network: z.string(),
          total: z.string(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const date = new Date(input.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

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

        // إنشاء الإيراد اليومي
        const result = await db.createDailyRevenue({
          monthlyRecordId: monthlyRecord.id,
          branchId: input.branchId,
          date: new Date(input.date),
          cash: input.cash,
          network: input.network,
          balance: input.balance,
          total: input.total,
          isMatched: input.isMatched,
          unmatchReason: input.unmatchReason,
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
  }),

  // ==================== إدارة البونص الأسبوعي ====================
  bonuses: router({
    // الحصول على بونص الأسبوع الحالي
    current: managerProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        
        // حساب رقم الأسبوع
        let weekNumber: number;
        if (day <= 7) weekNumber = 1;
        else if (day <= 15) weekNumber = 2;
        else if (day <= 22) weekNumber = 3;
        else if (day <= 29) weekNumber = 4;
        else weekNumber = 5;

        const weeklyBonus = await db.getCurrentWeekBonus(input.branchId, year, month, weekNumber);
        
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

    // الحصول على بونص أسبوع محدد
    getWeek: managerProcedure
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

    // سجل البونص
    history: managerProcedure
      .input(z.object({
        branchId: z.number(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return await db.getWeeklyBonusesByBranch(input.branchId, input.limit);
      }),

    // طلب صرف البونص
    request: managerProcedure
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

    // تزامن البونص يدوياً
    sync: managerProcedure
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
    // قائمة جميع الطلبات (للمدير والمسؤول)
    list: managerProcedure
      .input(z.object({
        status: z.string().optional(),
        requestType: z.string().optional(),
        employeeId: z.number().optional(),
        branchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllEmployeeRequests(input);
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

    // الطلبات المعلقة
    pending: managerProcedure.query(async () => {
      return await db.getPendingEmployeeRequests();
    }),

    // تفاصيل طلب
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmployeeRequestById(input.id);
      }),

    // إحصائيات الطلبات
    stats: managerProcedure.query(async () => {
      return await db.getEmployeeRequestsStats();
    }),

    // إنشاء طلب جديد
    create: protectedProcedure
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
        }

        return { success: true, message: 'تم تقديم الطلب بنجاح', requestNumber: result?.requestNumber };
      }),

    // تحديث حالة الطلب (موافقة/رفض)
    updateStatus: managerProcedure
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
    list: managerProcedure.query(async () => {
      return await db.getAllExpenses();
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
        category: z.enum(['operational', 'administrative', 'marketing', 'maintenance', 'utilities', 'rent', 'salaries', 'supplies', 'transportation', 'other']),
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

        return { success: true, message: 'تم إضافة المصروف بنجاح' };
      }),

    // تحديث مصروف - الأدمن فقط
    update: adminOnlyEditProcedure
      .input(z.object({
        id: z.number(),
        category: z.enum(['operational', 'administrative', 'marketing', 'maintenance', 'utilities', 'rent', 'salaries', 'supplies', 'transportation', 'other']).optional(),
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
    calculate: managerProcedure
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
    history: managerProcedure
      .input(z.object({
        periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
        limit: z.number().default(12),
      }))
      .query(async ({ input }) => {
        return await db.getFinancialKPIs(input.periodType, input.limit);
      }),

    // تحليل الاتجاهات الشهرية
    trends: managerProcedure
      .input(z.object({ months: z.number().default(12) }).optional())
      .query(async ({ input }) => {
        return await db.getMonthlyTrends(input?.months || 12);
      }),

    // تقرير ABC للمخزون
    abcReport: managerProcedure.query(async () => {
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
    topProducts: managerProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getTopSellingProducts(input.limit, input.startDate, input.endDate);
      }),

    // الحصول على أفضل العملاء
    topCustomers: managerProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getTopCustomers(input.limit, input.startDate, input.endDate);
      }),

    // الحصول على بيانات المبيعات اليومية
    dailySales: managerProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getDailySalesData(input.startDate, input.endDate);
      }),

    // الحصول على المبيعات حسب الفئة
    salesByCategory: managerProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getSalesByCategory(input.startDate, input.endDate);
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
