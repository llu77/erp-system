/**
 * POS Revenue Aggregation - تجميع فواتير الكاشير لإيرادات الموظفين
 *
 * دالة نقية (بدون قاعدة بيانات) تُستخدم عند تأكيد فواتير اليوم وعند إعادة الاحتساب:
 * - تُحتسب الفواتير المكتملة فقط (completed) - الملغاة والمسترجعة لا تدخل
 * - الكاش = فواتير الكاش + الجزء النقدي من الفواتير المقسمة
 * - الشبكة = فواتير الشبكة + جزء الشبكة من الفواتير المقسمة
 * - الإجمالي = مجموع إجمالي الفواتير المكتملة (يشمل فواتير الولاء)
 */

export interface PosInvoiceForAggregation {
  employeeId: number;
  employeeName?: string | null;
  total: string | number | null;
  paymentMethod: string;
  cashAmount?: string | number | null;
  cardAmount?: string | number | null;
  status: string;
}

export interface EmployeePosRevenue {
  employeeId: number;
  employeeName: string | null;
  cash: number;
  network: number;
  total: number;
  invoiceCount: number;
}

export interface PosAggregationResult {
  /** إجماليات الفرع لليوم (من الفواتير المكتملة فقط) */
  branch: {
    total: number;
    cash: number;
    network: number;
    invoiceCount: number;
  };
  /** عدد الفواتير المستبعدة (ملغاة / مسترجعة) */
  excludedCount: number;
  /** إيرادات كل موظف */
  employees: EmployeePosRevenue[];
}

function toAmount(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** هل الفاتورة تُحتسب في الإيراد؟ */
export function isCountablePosInvoice(invoice: Pick<PosInvoiceForAggregation, "status">): boolean {
  return invoice.status === "completed";
}

/** توزيع مبلغ الفاتورة بين الكاش والشبكة */
export function splitPosInvoicePayment(invoice: PosInvoiceForAggregation): { cash: number; network: number } {
  switch (invoice.paymentMethod) {
    case "cash":
      return { cash: toAmount(invoice.total), network: 0 };
    case "card":
      return { cash: 0, network: toAmount(invoice.total) };
    case "split":
      return { cash: toAmount(invoice.cashAmount), network: toAmount(invoice.cardAmount) };
    default:
      // فواتير الولاء وغيرها لا تدخل في الكاش أو الشبكة
      return { cash: 0, network: 0 };
  }
}

/**
 * تجميع فواتير الكاشير ليوم واحد حسب الموظف
 */
export function aggregatePosInvoices(invoices: PosInvoiceForAggregation[]): PosAggregationResult {
  const byEmployee = new Map<number, EmployeePosRevenue>();
  let branchTotal = 0;
  let branchCash = 0;
  let branchNetwork = 0;
  let invoiceCount = 0;
  let excludedCount = 0;

  for (const invoice of invoices) {
    if (!isCountablePosInvoice(invoice)) {
      excludedCount++;
      continue;
    }

    const total = toAmount(invoice.total);
    const { cash, network } = splitPosInvoicePayment(invoice);

    branchTotal += total;
    branchCash += cash;
    branchNetwork += network;
    invoiceCount++;

    const existing = byEmployee.get(invoice.employeeId) ?? {
      employeeId: invoice.employeeId,
      employeeName: invoice.employeeName ?? null,
      cash: 0,
      network: 0,
      total: 0,
      invoiceCount: 0,
    };
    existing.cash += cash;
    existing.network += network;
    existing.total += total;
    existing.invoiceCount++;
    if (!existing.employeeName && invoice.employeeName) existing.employeeName = invoice.employeeName;
    byEmployee.set(invoice.employeeId, existing);
  }

  const employees = Array.from(byEmployee.values())
    .map(e => ({ ...e, cash: round2(e.cash), network: round2(e.network), total: round2(e.total) }))
    .sort((a, b) => a.employeeId - b.employeeId);

  return {
    branch: {
      total: round2(branchTotal),
      cash: round2(branchCash),
      network: round2(branchNetwork),
      invoiceCount,
    },
    excludedCount,
    employees,
  };
}
