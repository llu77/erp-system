import { getDb } from './db';
import { receiptVouchers, receiptVoucherItems, InsertReceiptVoucher, InsertReceiptVoucherItem } from '../drizzle/schema';
import { eq, desc, like } from 'drizzle-orm';

// توليد معرف السند
async function generateReceiptVoucherId(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('خطأ في الاتصال بقاعدة البيانات');

  const today = new Date();
  const year = today.getFullYear();
  
  // البحث عن آخر سند في السنة الحالية
  const lastVoucher = await db.select()
    .from(receiptVouchers)
    .where(like(receiptVouchers.voucherId, `RV-${year}-%`))
    .orderBy(desc(receiptVouchers.id))
    .limit(1);

  const nextNumber = (lastVoucher.length > 0 ? 
    parseInt(lastVoucher[0].voucherId.split('-')[2]) + 1 : 1);

  return `RV-${year}-${String(nextNumber).padStart(3, '0')}`;
}

// إنشاء سند قبض جديد
export async function createReceiptVoucher(data: {
  voucherDate: Date;
  dueDate?: Date; // تاريخ الاستحقاق (من)
  dueDateTo?: Date; // تاريخ الاستحقاق (إلى)
  payeeName: string;
  payeeAddress?: string;
  payeePhone?: string;
  payeeEmail?: string;
  branchId?: number;
  branchName?: string;
  description?: string;
  notes?: string;
  items: Array<{
    description: string;
    amount: number;
    notes?: string;
  }>;
  createdBy: number;
  createdByName: string;
}): Promise<{ success: boolean; voucherId?: string; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };

  try {
    const voucherId = await generateReceiptVoucherId();
    
    // حساب المجموع
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

    // إنشاء السند
    await db.insert(receiptVouchers).values({
      voucherId,
      voucherDate: data.voucherDate,
      dueDate: data.dueDate,
      dueDateTo: data.dueDateTo,
      payeeName: data.payeeName,
      payeeAddress: data.payeeAddress,
      payeePhone: data.payeePhone,
      payeeEmail: data.payeeEmail,
      branchId: data.branchId,
      branchName: data.branchName,
      description: data.description,
      notes: data.notes,
      totalAmount: totalAmount.toString(),
      status: 'draft',
      createdBy: data.createdBy,
      createdByName: data.createdByName,
    });

    // الحصول على معرف السند المُنشأ
    const createdVoucher = await db.select()
      .from(receiptVouchers)
      .where(eq(receiptVouchers.voucherId, voucherId))
      .limit(1);

    if (!createdVoucher[0]) {
      return { success: false, error: 'فشل في إنشاء السند' };
    }

    // إضافة البنود
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      await db.insert(receiptVoucherItems).values({
        voucherId: createdVoucher[0].id,
        itemNumber: i + 1,
        description: item.description,
        amount: item.amount.toString(),
        notes: item.notes,
      });
    }

    return { success: true, voucherId };
  } catch (error) {
    console.error('خطأ في إنشاء سند القبض:', error);
    return { success: false, error: 'حدث خطأ أثناء إنشاء السند' };
  }
}

// الحصول على سند قبض
export async function getReceiptVoucher(voucherId: string) {
  const db = await getDb();
  if (!db) return null;

  const voucher = await db.select()
    .from(receiptVouchers)
    .where(eq(receiptVouchers.voucherId, voucherId))
    .limit(1);

  if (!voucher[0]) return null;

  const items = await db.select()
    .from(receiptVoucherItems)
    .where(eq(receiptVoucherItems.voucherId, voucher[0].id));

  return { ...voucher[0], items };
}

// الحصول على جميع سندات القبض
export async function getAllReceiptVouchers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(receiptVouchers)
    .orderBy(desc(receiptVouchers.createdAt))
    .limit(limit)
    .offset(offset);
}

// تحديث حالة السند
export async function updateReceiptVoucherStatus(
  voucherId: string,
  status: 'draft' | 'approved' | 'paid' | 'cancelled',
  approvedBy?: number,
  approvedByName?: string
) {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };

  try {
    await db.update(receiptVouchers)
      .set({
        status,
        approvedBy: approvedBy || undefined,
        approvedByName: approvedByName || undefined,
        approvedAt: status === 'approved' ? new Date() : undefined,
      })
      .where(eq(receiptVouchers.voucherId, voucherId));

    return { success: true };
  } catch (error) {
    return { success: false, error: 'حدث خطأ أثناء تحديث السند' };
  }
}

// حذف سند قبض
export async function deleteReceiptVoucher(voucherId: string) {
  const db = await getDb();
  if (!db) return { success: false, error: 'خطأ في الاتصال بقاعدة البيانات' };

  try {
    const voucher = await db.select()
      .from(receiptVouchers)
      .where(eq(receiptVouchers.voucherId, voucherId))
      .limit(1);

    if (!voucher[0]) {
      return { success: false, error: 'السند غير موجود' };
    }

    // حذف البنود
    await db.delete(receiptVoucherItems)
      .where(eq(receiptVoucherItems.voucherId, voucher[0].id));

    // حذف السند
    await db.delete(receiptVouchers)
      .where(eq(receiptVouchers.voucherId, voucherId));

    return { success: true };
  } catch (error) {
    return { success: false, error: 'حدث خطأ أثناء حذف السند' };
  }
}
