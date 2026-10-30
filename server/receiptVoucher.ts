/**
 * خدمة السندات المالية (سند قبض / سند صرف)
 *
 * - الإنشاء داخل معاملة واحدة (رأس السند + البنود) مع ترقيم متسلسل لكل نوع وسنة
 * - الإجماليات وتوزيع الدفع تُحسب على الخادم فقط (لا يُوثق بأرقام الواجهة)
 * - المشرف يُنشئ ويعرض سندات فرعه فقط، والاعتماد / الصرف / الإلغاء للمدير والمسؤول فقط
 * - تغيير الحالة بتحديث مشروط (WHERE status = الحالة الحالية) لمنع التعارض
 * - عند الاعتماد تُحفظ أسماء الموقعين (لا تظهر التوقيعات والختم إلا بعد الاعتماد)
 */

import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from './db';
import {
  branches,
  receiptVouchers,
  receiptVoucherItems,
  type ReceiptVoucher,
  type ReceiptVoucherItem,
} from '../drizzle/schema';
import { SIGNATURES } from '../shared/branding';
import {
  VOUCHER_PREFIX,
  VOUCHER_TITLES,
  canTransitionVoucher,
  computeVoucherItems,
  getAllowedVoucherTransitions,
  getVoucherStatusLabel,
  nextVoucherNumber,
  resolvePaymentSplit,
  toVoucherDateString,
  todayVoucherDate,
  validatePaymentDetails,
  voucherYear,
  type VoucherItemInput,
  type VoucherPartyType,
  type VoucherPaymentMethod,
  type VoucherStatus,
  type VoucherType,
} from '../shared/vouchers';

// ==================== الأنواع ====================

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Exec = Db | Tx;

export type VoucherWithItems = ReceiptVoucher & { items: ReceiptVoucherItem[] };

/** المستخدم المنفذ للعملية */
export interface VoucherActor {
  id: number;
  name: string | null;
  role: string;
  branchId: number | null;
}

export class VoucherError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST' | 'FORBIDDEN' | 'INTERNAL_SERVER_ERROR' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'VoucherError';
  }
}

type DateInput = Date | string | null | undefined;

export interface CreateVoucherInput {
  voucherDate?: DateInput;
  dueDateFrom?: DateInput;
  dueDateTo?: DateInput;
  dueDate?: DateInput; // للتوافق العكسي
  partyName?: string | null;
  partyType?: VoucherPartyType | null;
  partyId?: number | null;
  payeeName?: string | null;
  payeeAddress?: string | null;
  payeePhone?: string | null;
  payeeEmail?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  description?: string | null;
  notes?: string | null;
  paymentMethod?: VoucherPaymentMethod | null;
  cashAmount?: number | string | null;
  bankAmount?: number | string | null;
  checkAmount?: number | string | null;
  bankName?: string | null;
  bankReference?: string | null;
  checkNumber?: string | null;
  checkDate?: DateInput;
  checkBank?: string | null;
  items: VoucherItemInput[];
}

export interface VoucherListFilters {
  voucherType?: VoucherType | 'all';
  status?: VoucherStatus | 'all';
  branchId?: number | null;
  /** YYYY-MM-DD */
  startDate?: string | null;
  /** YYYY-MM-DD */
  endDate?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

// ==================== أدوات داخلية ====================

/** الأدوار التي تعتمد وتصرف وتلغي السندات */
export const VOUCHER_APPROVER_ROLES = ['admin', 'manager'] as const;
/** الأدوار التي تُنشئ السندات */
export const VOUCHER_CREATOR_ROLES = ['admin', 'manager', 'supervisor'] as const;

export function isVoucherApprover(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager';
}

export function canCreateVoucher(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'supervisor';
}

/** هل يقتصر المستخدم على فرعه؟ (غير المدير/المسؤول المرتبط بفرع) */
export function scopedBranchId(actor: Pick<VoucherActor, 'role' | 'branchId'>): number | null {
  if (isVoucherApprover(actor.role)) return null;
  if (actor.branchId != null) return actor.branchId;
  // المشرف العام (viewer) غير المرتبط بفرع: عرض كل الفروع
  if (actor.role === 'viewer') return null;
  // غير ذلك (مشرف فرع أو موظف بدون فرع) لا يحصل على صلاحية كل الفروع
  throw new VoucherError('حسابك غير مرتبط بفرع', 'FORBIDDEN');
}

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new VoucherError('خطأ في الاتصال بقاعدة البيانات', 'INTERNAL_SERVER_ERROR');
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0);
}

function insertId(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { insertId?: number })?.insertId ?? 0);
}

export function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || e?.cause?.code === 'ER_DUP_ENTRY' || e?.cause?.errno === 1062;
}

function cleanText(value: unknown, maxLength?: number): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return maxLength ? s.slice(0, maxLength) : s;
}

/**
 * قيمة حقل DATE في MySQL كنص YYYY-MM-DD مباشرة
 * (بدون كائن Date حتى لا ينزاح اليوم بسبب المنطقة الزمنية للخادم أو الاتصال)
 */
function dateOnlyToDb(ymd: string): SQL {
  return sql`${ymd}`;
}

/** تاريخ اختياري بصيغة YYYY-MM-DD (null إن لم يُرسل) */
function optionalDateString(value: DateInput, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const ymd = toVoucherDateString(value);
  if (!ymd) throw new VoucherError(`${label} غير صحيح`);
  return ymd;
}

function normalizeType(type: unknown): VoucherType {
  if (type === 'receipt' || type === 'payment') return type;
  throw new VoucherError('نوع السند غير صحيح');
}

function typeOf(voucher: Pick<ReceiptVoucher, 'voucherType'>): VoucherType {
  return voucher.voucherType === 'payment' ? 'payment' : 'receipt';
}

async function findBranchName(exec: Exec, branchId: number): Promise<string | null> {
  const rows = await exec.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1);
  return rows[0]?.name ?? null;
}

async function findVoucherRow(exec: Exec, voucherId: string): Promise<ReceiptVoucher | null> {
  const rows = await exec.select().from(receiptVouchers).where(eq(receiptVouchers.voucherId, voucherId)).limit(1);
  return rows[0] ?? null;
}

/** أعلى تسلسل موجود لنفس النوع والسنة (يدعم الصيغة القديمة RV-YYYY-NNN) */
async function maxSequenceFor(exec: Exec, type: VoucherType, year: number): Promise<number> {
  const rows = await exec
    .select({
      maxSeq: sql<string | number | null>`MAX(CAST(SUBSTRING_INDEX(${receiptVouchers.voucherId}, '-', -1) AS UNSIGNED))`,
    })
    .from(receiptVouchers)
    .where(like(receiptVouchers.voucherId, `${VOUCHER_PREFIX[type]}-${year}-%`));
  const n = Number(rows[0]?.maxSeq ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function assertBranchAccess(actor: VoucherActor, voucher: Pick<ReceiptVoucher, 'branchId'>) {
  const scope = scopedBranchId(actor);
  if (scope !== null && voucher.branchId !== scope) {
    throw new VoucherError('لا يمكنك الوصول لسندات فرع آخر', 'FORBIDDEN');
  }
}

// ==================== الإنشاء ====================

/**
 * إنشاء سند قبض أو صرف
 * - المبالغ تُحسب من البنود (الكمية × سعر الوحدة أو المبلغ)
 * - توزيع الدفع (نقداً / حوالة / شيك) يجب أن يساوي الإجمالي
 * - فرع المشرف يُفرض من حسابه ولا يُقبل من الواجهة
 */
export async function createVoucher(
  type: VoucherType,
  data: CreateVoucherInput,
  actor: VoucherActor
): Promise<{ success: true; id: number; voucherId: string; voucherType: VoucherType; totalAmount: number }> {
  const voucherType = normalizeType(type);
  if (!canCreateVoucher(actor.role)) {
    throw new VoucherError('غير مصرح لك بإنشاء السندات', 'FORBIDDEN');
  }

  // البنود والإجمالي
  const computed = computeVoucherItems(data.items);
  if (!computed.ok) throw new VoucherError(computed.error);

  // توزيع الدفع
  const splitResult = resolvePaymentSplit(computed.total, {
    paymentMethod: data.paymentMethod ?? null,
    cashAmount: data.cashAmount,
    bankAmount: data.bankAmount,
    checkAmount: data.checkAmount,
  });
  if (!splitResult.ok) throw new VoucherError(splitResult.error);
  const split = splitResult.split;
  const detailsError = validatePaymentDetails(split, {
    bankName: data.bankName,
    bankReference: data.bankReference,
    checkNumber: data.checkNumber,
    checkDate: data.checkDate,
    checkBank: data.checkBank,
  });
  if (detailsError) throw new VoucherError(detailsError);

  // التواريخ
  // المشرف لا يختار التاريخ: تاريخ اليوم بتوقيت الرياض (المدير والمسؤول يمكنهم تحديده)
  const voucherDateStr = data.voucherDate && isVoucherApprover(actor.role)
    ? toVoucherDateString(data.voucherDate)
    : todayVoucherDate();
  if (!voucherDateStr) throw new VoucherError('تاريخ السند غير صحيح');
  const dueDateFrom = optionalDateString(data.dueDateFrom ?? data.dueDate, 'تاريخ بداية الفترة');
  const dueDateTo = optionalDateString(data.dueDateTo, 'تاريخ نهاية الفترة');
  if (dueDateFrom && dueDateTo && dueDateFrom > dueDateTo) {
    throw new VoucherError('تاريخ بداية الفترة يجب أن يكون قبل تاريخ نهايتها');
  }
  const checkDate = split.checkAmount > 0 ? optionalDateString(data.checkDate, 'تاريخ الشيك') : null;

  const db = await requireDb();
  const actorName = cleanText(actor.name) || 'مستخدم';

  // الفرع: المشرف يُفرض فرعه، والمدير يختار
  const forcedBranch = scopedBranchId(actor);
  const branchId = forcedBranch !== null ? forcedBranch : (data.branchId ?? null);
  let branchName: string | null = null;
  if (branchId) {
    branchName = await findBranchName(db, branchId);
    if (!branchName) {
      if (forcedBranch !== null) branchName = cleanText(data.branchName, 100);
      else throw new VoucherError('الفرع المحدد غير موجود');
    }
  } else if (forcedBranch === null) {
    branchName = cleanText(data.branchName, 100);
  }

  // الطرف والمستلم
  let partyName = cleanText(data.partyName, 255);
  let partyType: VoucherPartyType | null = data.partyType ?? null;
  let partyId: number | null = data.partyId ?? null;
  let payeeName = cleanText(data.payeeName, 255);

  if (voucherType === 'receipt') {
    // سند القبض: "استلمنا من" افتراضياً الفرع - المشرف الذي سلّم المبلغ
    if (!partyName) {
      partyName = [branchName, actorName].filter(Boolean).join(' - ');
      partyType = branchId ? 'branch' : 'other';
      partyId = branchId;
    }
    // المستلم الفعلي (Received by)
    if (!payeeName) payeeName = actorName;
  } else {
    // سند الصرف: "صرفنا إلى" إلزامي
    if (!partyName) partyName = payeeName;
    if (!partyName) throw new VoucherError('يرجى إدخال اسم المصروف له');
    if (!payeeName) payeeName = partyName;
  }

  const description = cleanText(data.description) ?? (computed.items.length === 1 ? computed.items[0].description : null);

  const values = {
    voucherType,
    voucherDate: dateOnlyToDb(voucherDateStr),
    dueDateFrom: dueDateFrom ? dateOnlyToDb(dueDateFrom) : null,
    dueDateTo: dueDateTo ? dateOnlyToDb(dueDateTo) : null,
    dueDate: dueDateFrom ? dateOnlyToDb(dueDateFrom) : null, // للتوافق العكسي
    partyName,
    partyType,
    partyId,
    payeeName: payeeName as string,
    payeeAddress: cleanText(data.payeeAddress),
    payeePhone: cleanText(data.payeePhone, 20),
    payeeEmail: cleanText(data.payeeEmail, 320),
    branchId,
    branchName,
    description,
    notes: cleanText(data.notes),
    totalAmount: computed.total.toFixed(2),
    status: 'draft' as const,
    paymentMethod: split.paymentMethod,
    cashAmount: split.cashAmount.toFixed(2),
    bankAmount: split.bankAmount.toFixed(2),
    checkAmount: split.checkAmount.toFixed(2),
    bankName: split.bankAmount > 0 ? cleanText(data.bankName, 100) : null,
    bankReference: split.bankAmount > 0 ? cleanText(data.bankReference, 100) : null,
    checkNumber: split.checkAmount > 0 ? cleanText(data.checkNumber, 50) : null,
    checkDate: checkDate ? dateOnlyToDb(checkDate) : null,
    checkBank: split.checkAmount > 0 ? cleanText(data.checkBank, 100) : null,
    createdBy: actor.id,
    createdByName: actorName,
  };

  const year = voucherYear(voucherDateStr);

  // محاولة + إعادة واحدة عند تعارض رقم السند (إنشاء متزامن)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await db.transaction(async tx => {
        const voucherNumber = nextVoucherNumber(voucherType, year, await maxSequenceFor(tx, voucherType, year));
        const header = await tx.insert(receiptVouchers).values({ ...values, voucherId: voucherNumber });
        const id = insertId(header);
        if (!id) throw new VoucherError('فشل في إنشاء السند', 'INTERNAL_SERVER_ERROR');

        await tx.insert(receiptVoucherItems).values(
          computed.items.map(item => ({
            voucherId: id,
            itemNumber: item.itemNumber,
            description: item.description.slice(0, 500),
            quantity: item.quantity.toFixed(2),
            unitPrice: item.unitPrice === null ? null : item.unitPrice.toFixed(2),
            amount: item.amount.toFixed(2),
            notes: item.notes,
          }))
        );
        return { id, voucherNumber };
      });
      return {
        success: true,
        id: result.id,
        voucherId: result.voucherNumber,
        voucherType,
        totalAmount: computed.total,
      };
    } catch (error) {
      if (isDuplicateKeyError(error) && attempt === 0) continue;
      if (isDuplicateKeyError(error)) {
        throw new VoucherError('تعذر توليد رقم سند فريد، يرجى إعادة المحاولة', 'CONFLICT');
      }
      throw error;
    }
  }
  throw new VoucherError('تعذر توليد رقم سند فريد، يرجى إعادة المحاولة', 'CONFLICT');
}

// ==================== القراءة ====================

/** جلب سند مع بنوده (بدون تحقق صلاحيات) */
export async function getVoucherWithItems(voucherId: string): Promise<VoucherWithItems | null> {
  const db = await getDb();
  if (!db) return null;
  const voucher = await findVoucherRow(db, voucherId);
  if (!voucher) return null;
  const items = await db
    .select()
    .from(receiptVoucherItems)
    .where(eq(receiptVoucherItems.voucherId, voucher.id))
    .orderBy(receiptVoucherItems.itemNumber);
  return { ...voucher, items };
}

/** جلب سند مع التحقق من صلاحية الفرع */
export async function getVoucher(voucherId: string, actor: VoucherActor): Promise<VoucherWithItems> {
  const voucher = await getVoucherWithItems(voucherId);
  if (!voucher) throw new VoucherError('السند غير موجود', 'NOT_FOUND');
  assertBranchAccess(actor, voucher);
  return voucher;
}

/** قائمة السندات مع الفلاتر (المشرف: فرعه فقط) */
export async function listVouchers(filters: VoucherListFilters, actor?: VoucherActor): Promise<ReceiptVoucher[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [];
  if (filters.voucherType && filters.voucherType !== 'all') {
    conditions.push(eq(receiptVouchers.voucherType, filters.voucherType));
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(receiptVouchers.status, filters.status));
  }

  const scope = actor ? scopedBranchId(actor) : null;
  const branchId = scope !== null ? scope : (filters.branchId ?? null);
  if (branchId) conditions.push(eq(receiptVouchers.branchId, branchId));

  // مقارنة التواريخ كنص YYYY-MM-DD حتى لا تتأثر بالمنطقة الزمنية
  const start = filters.startDate ? toVoucherDateString(filters.startDate) : null;
  const end = filters.endDate ? toVoucherDateString(filters.endDate) : null;
  if (start) conditions.push(sql`${receiptVouchers.voucherDate} >= ${start}`);
  if (end) conditions.push(sql`${receiptVouchers.voucherDate} <= ${end}`);

  const search = cleanText(filters.search, 100);
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    const match = or(
      like(receiptVouchers.voucherId, pattern),
      like(receiptVouchers.partyName, pattern),
      like(receiptVouchers.payeeName, pattern),
      like(receiptVouchers.description, pattern)
    );
    if (match) conditions.push(match);
  }

  const limit = Math.min(Math.max(1, Math.floor(filters.limit ?? 100)), 500);
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));

  return await db
    .select()
    .from(receiptVouchers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(receiptVouchers.voucherDate), desc(receiptVouchers.id))
    .limit(limit)
    .offset(offset);
}

// ==================== تغيير الحالة ====================

export interface UpdateVoucherStatusResult {
  success: true;
  voucherId: string;
  status: VoucherStatus;
}

/**
 * تغيير حالة السند (اعتماد / صرف / إلغاء)
 * - للمدير والمسؤول فقط
 * - الانتقالات حسب نوع السند (canTransitionVoucher)
 * - تحديث مشروط بالحالة الحالية لمنع التعارض
 */
export async function updateVoucherStatus(
  voucherId: string,
  to: VoucherStatus,
  actor: VoucherActor,
  options: { reason?: string | null } = {}
): Promise<UpdateVoucherStatusResult> {
  if (!isVoucherApprover(actor.role)) {
    throw new VoucherError('اعتماد السندات وصرفها وإلغاؤها متاح للمدير والمسؤول فقط', 'FORBIDDEN');
  }
  const db = await requireDb();
  const voucher = await findVoucherRow(db, voucherId);
  if (!voucher) throw new VoucherError('السند غير موجود', 'NOT_FOUND');

  const type = typeOf(voucher);
  const from = voucher.status as VoucherStatus;
  if (from === to) {
    throw new VoucherError(`السند بالفعل في حالة "${getVoucherStatusLabel(to, type).ar}"`, 'CONFLICT');
  }
  if (!canTransitionVoucher(type, from, to)) {
    const allowed = getAllowedVoucherTransitions(type, from).map(s => getVoucherStatusLabel(s, type).ar);
    throw new VoucherError(
      `لا يمكن تحويل ${VOUCHER_TITLES[type].ar} من "${getVoucherStatusLabel(from, type).ar}" إلى "${getVoucherStatusLabel(to, type).ar}"` +
        (allowed.length ? ` (المسموح: ${allowed.join('، ')})` : ' (حالة نهائية)')
    );
  }

  const now = new Date();
  const actorName = cleanText(actor.name) || 'مستخدم';
  const set: Partial<typeof receiptVouchers.$inferInsert> = { status: to };

  if (to === 'approved') {
    set.approvedBy = actor.id;
    set.approvedByName = actorName;
    set.approvedAt = now;
    // حفظ أسماء الموقعين لحظة الاعتماد
    set.signedBy1 = SIGNATURES.supervisor.name;
    set.signedBy2 = SIGNATURES.manager.name;
  } else if (to === 'paid') {
    set.paidBy = actor.id;
    set.paidByName = actorName;
    set.paidAt = now;
  } else if (to === 'cancelled') {
    const reason = cleanText(options.reason, 1000);
    if (!reason || reason.length < 3) throw new VoucherError('يرجى كتابة سبب الإلغاء');
    set.cancelledBy = actor.id;
    set.cancelledByName = actorName;
    set.cancelledAt = now;
    set.cancellationReason = reason;
  }

  const res = await db
    .update(receiptVouchers)
    .set(set)
    .where(and(eq(receiptVouchers.id, voucher.id), eq(receiptVouchers.status, from)));
  if (affectedRows(res) === 0) {
    throw new VoucherError('تم تعديل السند من مستخدم آخر، يرجى تحديث الصفحة', 'CONFLICT');
  }
  return { success: true, voucherId: voucher.voucherId, status: to };
}

// ==================== الحذف ====================

/** حذف سند (المسودات فقط) مع بنوده */
export async function deleteVoucher(voucherId: string, actor?: VoucherActor): Promise<{ success: true }> {
  if (actor && actor.role !== 'admin') {
    throw new VoucherError('حذف السندات متاح للمسؤول فقط', 'FORBIDDEN');
  }
  const db = await requireDb();
  const voucher = await findVoucherRow(db, voucherId);
  if (!voucher) throw new VoucherError('السند غير موجود', 'NOT_FOUND');
  if (voucher.status !== 'draft') {
    throw new VoucherError('لا يمكن حذف سند معتمد أو ملغي، يمكن حذف المسودات فقط (استخدم الإلغاء بدلاً من ذلك)', 'CONFLICT');
  }

  await db.transaction(async tx => {
    const res = await tx
      .delete(receiptVouchers)
      .where(and(eq(receiptVouchers.id, voucher.id), eq(receiptVouchers.status, 'draft')));
    if (affectedRows(res) === 0) {
      throw new VoucherError('تم تعديل السند من مستخدم آخر، يرجى تحديث الصفحة', 'CONFLICT');
    }
    await tx.delete(receiptVoucherItems).where(eq(receiptVoucherItems.voucherId, voucher.id));
  });
  return { success: true };
}

// ==================== دوال التوافق العكسي ====================
// (أسماء الدوال القديمة: تُبقي الاستدعاءات السابقة تعمل)

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof VoucherError) return error.message;
  console.error(fallback, error);
  return fallback;
}

/** @deprecated استخدم createVoucher('receipt', ...) */
export async function createReceiptVoucher(data: CreateVoucherInput & {
  createdBy: number;
  createdByName: string;
  createdByRole?: string;
  createdByBranchId?: number | null;
}): Promise<{ success: boolean; voucherId?: string; error?: string }> {
  try {
    const result = await createVoucher('receipt', data, {
      id: data.createdBy,
      name: data.createdByName,
      role: data.createdByRole ?? 'admin',
      branchId: data.createdByBranchId ?? null,
    });
    return { success: true, voucherId: result.voucherId };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'حدث خطأ أثناء إنشاء السند') };
  }
}

/** @deprecated استخدم getVoucherWithItems */
export async function getReceiptVoucher(voucherId: string) {
  return getVoucherWithItems(voucherId);
}

/** @deprecated استخدم listVouchers */
export async function getAllReceiptVouchers(limit = 50, offset = 0) {
  return listVouchers({ limit, offset });
}

/** @deprecated استخدم updateVoucherStatus */
export async function updateReceiptVoucherStatus(
  voucherId: string,
  status: 'draft' | 'approved' | 'paid' | 'cancelled',
  approvedBy?: number,
  approvedByName?: string,
  options: { role?: string; reason?: string | null } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateVoucherStatus(
      voucherId,
      status,
      { id: approvedBy ?? 0, name: approvedByName ?? null, role: options.role ?? 'admin', branchId: null },
      { reason: options.reason }
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'حدث خطأ أثناء تحديث السند') };
  }
}

/** @deprecated استخدم deleteVoucher */
export async function deleteReceiptVoucher(voucherId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteVoucher(voucherId);
    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'حدث خطأ أثناء حذف السند') };
  }
}

