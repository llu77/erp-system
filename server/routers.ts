import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";

// إجراء للمدير فقط
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

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
  }),

  // ==================== إدارة الفروع ====================
  branches: router({
    list: protectedProcedure.query(async () => {
      return await db.getBranches();
    }),

    create: adminProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        nameAr: z.string().min(1),
        address: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createBranch(input);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'branch',
          details: `تم إنشاء فرع: ${input.nameAr}`,
        });
        return { success: true, message: 'تم إنشاء الفرع بنجاح' };
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
        branchId: z.number(),
        phone: z.string().optional(),
        position: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createEmployee(input);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'مستخدم',
          action: 'create',
          entityType: 'employee',
          details: `تم إنشاء موظف: ${input.name}`,
        });
        return { success: true, message: 'تم إنشاء الموظف بنجاح' };
      }),
  }),

  // ==================== إدارة الإيرادات ====================
  revenues: router({
    createDaily: managerProcedure
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
});

export type AppRouter = typeof appRouter;
