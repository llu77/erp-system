/**
 * طلب السلفة الرسمي (صفحة A4 RTL) - مشترك بين بوابة الموظفين والنظام الرئيسي والخادم (PDF)
 * - خطاب من الموظف إلى الإدارة بترويسة مؤسسة فرع الطلب
 * - قسم الاعتماد: الموافقة (التوقيعات والختم) / الرفض (السبب بدون ختم) / بانتظار الاعتماد / ملغي
 * - جميع النصوص المُدخلة من المستخدم تُهرّب قبل إدراجها في HTML
 */

import { employeeJobTitle } from "./employeeFile";
import { amountToArabicWords, toVoucherDateString } from "./vouchers";
import type { EmployeeDocumentTemplateOptions } from "./payslipTemplate";
import {
  arabicMonthName,
  bi,
  buildEmployeeDocContext,
  dateText,
  dateTimeText,
  esc,
  money,
  num,
  present,
  proseDate,
  renderDocumentShell,
  renderFooter,
  renderSigner,
  renderWatermark,
  statusClass,
  DOC_ACCENT,
  DOC_ACCENT_SOFT,
  type EmployeeDocContext,
} from "./employeeDocumentBase";

export const REPAYMENT_METHOD_LABELS: Record<string, string> = {
  salary_deduction: "خصم من الراتب",
  installments: "أقساط شهرية",
  full_payment: "سداد كامل",
};

export function repaymentMethodLabel(code: string | null | undefined): string {
  if (!code) return REPAYMENT_METHOD_LABELS.salary_deduction;
  return REPAYMENT_METHOD_LABELS[code] ?? code;
}

/** صيغة الاسترداد داخل نص الطلب: "على أن تُسترد {..}" */
const REPAYMENT_PHRASES: Record<string, string> = {
  salary_deduction: "خصماً من راتبي الشهري",
  installments: "على أقساط شهرية تُخصم من راتبي",
  full_payment: "دفعة واحدة كاملة",
};

export function repaymentPhrase(code: string | null | undefined): string {
  if (!code) return REPAYMENT_PHRASES.salary_deduction;
  return REPAYMENT_PHRASES[code] ?? code;
}

export const ADVANCE_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار الاعتماد",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export function advanceRequestStatusLabel(
  status: string | null | undefined
): string {
  return (
    ADVANCE_REQUEST_STATUS_LABELS[String(status ?? "")] ?? String(status ?? "-")
  );
}

export interface AdvanceRequestDocumentData {
  requestId: number;
  requestNumber: string;
  /** تاريخ تقديم الطلب */
  requestDate: string | Date;
  /** pending | approved | rejected | cancelled */
  status: string;
  branchId: number | null;
  branchName: string | null;
  employee: {
    id: number;
    name: string;
    code: string;
    position?: string | null;
    iqamaNumber?: string | null;
    nationality?: string | null;
    phone?: string | null;
    hireDate?: string | null;
  };
  amount: number;
  reason?: string | null;
  /** salary_deduction | installments | full_payment */
  repaymentMethod?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | Date | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  /** أين خُصمت السلفة (إن خُصمت). status = حالة المسيرة أو المخالصة */
  deduction?: {
    kind: "payroll" | "end_of_service";
    reference: string;
    period?: string | null;
    status?: string | null;
  } | null;
}

/** التوقيعات والختم: للطلب الموافق عليه فقط */
export function isAdvanceRequestSigned(
  status: string | null | undefined
): boolean {
  return status === "approved";
}

// ==================== تحويل صف الطلب إلى بيانات المستند ====================

type DateLike = Date | string | null | undefined;

/** صف الطلب (employeeRequests) كما يرجعه الخادم */
export interface AdvanceRequestSource {
  id: number;
  requestNumber: string;
  createdAt: Date | string;
  status: string;
  employeeId: number;
  employeeName: string;
  branchId?: number | null;
  branchName?: string | null;
  advanceAmount?: number | string | null;
  advanceReason?: string | null;
  description?: string | null;
  repaymentMethod?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: DateLike;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
}

/** بيانات الموظف من ملفه (اختيارية) */
export interface AdvanceRequestEmployeeSource {
  code?: string | null;
  /** علامة المشرف في ملف الموظف: تحدد المسمى (مشرف / حلاق) */
  isSupervisor?: boolean | null;
  iqamaNumber?: string | null;
  nationality?: string | null;
  phone?: string | null;
  hireDate?: DateLike;
}

/** مرجع الخصم: المسيرة التي أُدرجت فيها السلفة أو المخالصة النهائية التي سُوّيت فيها */
export interface AdvanceDeductionSource {
  payroll?: {
    payrollNumber: string;
    year: number;
    month: number;
    status?: string | null;
  } | null;
  settlement?: { settlementNumber: string; status?: string | null } | null;
}

/**
 * بيانات طلب السلفة من صف الطلب وملف الموظف ومرجع الخصم
 * - السبب: advanceReason ثم وصف الطلب
 * - المسيرة أولاً، ثم المخالصة النهائية
 */
export function buildAdvanceRequestDocumentData(
  request: AdvanceRequestSource,
  employee: AdvanceRequestEmployeeSource | null = null,
  deduction: AdvanceDeductionSource = {}
): AdvanceRequestDocumentData {
  let ref: AdvanceRequestDocumentData["deduction"] = null;
  if (deduction.payroll) {
    const p = deduction.payroll;
    ref = {
      kind: "payroll",
      reference: p.payrollNumber,
      period: `${arabicMonthName(p.month)} ${p.year}`,
      status: present(p.status),
    };
  } else if (deduction.settlement) {
    ref = {
      kind: "end_of_service",
      reference: deduction.settlement.settlementNumber,
      period: null,
      status: present(deduction.settlement.status),
    };
  }
  return {
    requestId: request.id,
    requestNumber: request.requestNumber,
    requestDate: request.createdAt,
    status: String(request.status || "pending"),
    branchId: request.branchId ?? null,
    branchName: present(request.branchName),
    employee: {
      id: request.employeeId,
      name: request.employeeName,
      code: present(employee?.code) ?? "",
      position: employee ? employeeJobTitle(employee.isSupervisor) : null,
      iqamaNumber: present(employee?.iqamaNumber),
      nationality: present(employee?.nationality),
      phone: present(employee?.phone),
      hireDate: toVoucherDateString(employee?.hireDate ?? null),
    },
    amount: Math.abs(num(request.advanceAmount)),
    reason: present(request.advanceReason) ?? present(request.description),
    repaymentMethod: present(request.repaymentMethod),
    reviewedByName: present(request.reviewedByName),
    reviewedAt: request.reviewedAt ?? null,
    reviewNotes: present(request.reviewNotes),
    rejectionReason: present(request.rejectionReason),
    deduction: ref,
  };
}

// ==================== القالب ====================

function infoCell(label: string, value: unknown): string | null {
  const v = present(value);
  return v
    ? `<div class="cell"><div class="lbl">${label}</div><div class="val">${esc(v)}</div></div>`
    : null;
}

function deductionText(
  d: NonNullable<AdvanceRequestDocumentData["deduction"]>
): string {
  if (d.kind === "end_of_service") {
    return `سُوّيت السلفة ضمن المخالصة النهائية رقم <b class="ltr">${esc(d.reference)}</b>`;
  }
  const done = d.status === "approved" || d.status === "paid";
  const verb = done ? "خُصمت السلفة من" : "أُدرجت السلفة للخصم في";
  return `${verb} مسير رواتب ${d.period ? `شهر ${esc(d.period)} ` : ""}رقم <b class="ltr">${esc(d.reference)}</b>`;
}

function renderDecision(
  ctx: EmployeeDocContext,
  data: AdvanceRequestDocumentData
): string {
  const reviewer = present(data.reviewedByName);
  const reviewedAt = data.reviewedAt ? dateTimeText(data.reviewedAt) : null;
  const notes = present(data.reviewNotes);
  const by = `${reviewer ? ` بواسطة <b>${esc(reviewer)}</b>` : ""}${reviewedAt ? ` بتاريخ <span class="ltr">${esc(reviewedAt)}</span>` : ""}`;

  if (ctx.status === "approved") {
    const deduction = data.deduction
      ? `<div class="decision-line">${deductionText(data.deduction)}</div>`
      : "";
    // نص الاعتماد عادي بلا تظليل (التوقيع والختم أسفله هما علامة الاعتماد)
    return `
      <div class="decision decision-approved">
        <div class="decision-head">&#10004; تمت الموافقة على الطلب${by}</div>
        <div class="decision-line">بمبلغ <b>${money(data.amount)} ريال سعودي</b>، على أن تُسترد ${esc(repaymentPhrase(data.repaymentMethod))}.</div>
        ${notes ? `<div class="decision-line"><b>ملاحظات الاعتماد:</b> <span class="user-text">${esc(notes)}</span></div>` : ""}
        ${deduction}
      </div>`;
  }
  if (ctx.status === "rejected") {
    const reason = present(data.rejectionReason) ?? notes;
    return `
      <div class="alert-box decision">
        <div class="decision-head">&#10006; تم رفض الطلب${by}</div>
        <div class="decision-line"><b>سبب الرفض:</b> <span class="user-text">${reason ? esc(reason) : "-"}</span></div>
        ${notes && notes !== reason ? `<div class="decision-line"><b>ملاحظات:</b> <span class="user-text">${esc(notes)}</span></div>` : ""}
      </div>`;
  }
  if (ctx.status === "cancelled") {
    return `
      <div class="alert-box decision">
        <div class="decision-head">ملغي - تم إلغاء هذا الطلب${reviewedAt ? ` بتاريخ <span class="ltr">${esc(reviewedAt)}</span>` : ""}</div>
        ${notes ? `<div class="decision-line"><b>ملاحظات:</b> <span class="user-text">${esc(notes)}</span></div>` : ""}
      </div>`;
  }
  return `
      <div class="wait-box decision">
        <div class="decision-head">بانتظار الاعتماد</div>
        <div class="decision-line">الطلب قيد المراجعة لدى الإدارة، ولا يُعد معتمداً حتى يحمل توقيع الإدارة وختمها.</div>
      </div>`;
}

/** طلب السلفة (HTML كامل) */
export function renderAdvanceRequestHtml(
  data: AdvanceRequestDocumentData,
  options: EmployeeDocumentTemplateOptions = {}
): string {
  const status = String(data.status || "pending");
  const ctx = buildEmployeeDocContext(
    data.branchName,
    status,
    isAdvanceRequestSigned(status),
    options
  );
  const e = data.employee;
  const amount = Math.abs(num(data.amount));
  const reason = present(data.reason);

  const watermark =
    status === "cancelled"
      ? renderWatermark("ملغي", "cancelled")
      : status === "rejected"
        ? renderWatermark("مرفوض", "cancelled")
        : !ctx.signed
          ? renderWatermark("بانتظار الاعتماد", "draft")
          : "";

  const infoCells = [
    infoCell("الرقم الوظيفي", e.code),
    infoCell("المسمى الوظيفي", e.position),
    infoCell("الفرع", data.branchName),
    infoCell("رقم الإقامة / الهوية", e.iqamaNumber),
    infoCell("الجنسية", e.nationality),
    infoCell("رقم الجوال", e.phone),
    infoCell("تاريخ المباشرة", e.hireDate ? dateText(e.hireDate) : null),
  ].filter((c): c is string => c !== null);

  const strong = (v: string) => `<strong>${v}</strong>`;
  const idClause = present(e.iqamaNumber)
    ? `، رقم الإقامة / الهوية (${strong(esc(present(e.iqamaNumber)))})`
    : "";
  const codeClause = present(e.code)
    ? `، الرقم الوظيفي (${strong(esc(present(e.code)))})`
    : "";
  const reasonClause = reason ? `، وذلك لـ${strong(esc(reason))}` : "";
  const paragraph = `أتقدم أنا الموقع أدناه / ${strong(esc(e.name))}${idClause}${codeClause}، بطلب سلفة مالية بمبلغ (${strong(`${money(amount)} ريال سعودي`)}) ${esc(amountToArabicWords(amount))}${reasonClause}، على أن تُسترد ${strong(esc(repaymentPhrase(data.repaymentMethod)))}، وأتعهد بسدادها وفق ما ورد أعلاه، وأوافق على خصم المتبقي منها من مستحقاتي لدى المنشأة في حال انتهاء علاقتي التعاقدية قبل سدادها كاملة.`;

  const pendingText =
    status === "cancelled"
      ? "ملغي"
      : status === "rejected"
        ? "مرفوض"
        : "بانتظار الاعتماد";

  const body = `
    <div class="title-row">
      <div class="info-box">
        <div class="lbl">${bi("رقم الطلب", "Request No.")}</div>
        <div class="val ltr">${esc(data.requestNumber)}</div>
      </div>
      <div class="doc-title">
        <h1>طلب سلفة</h1>
        <h2>SALARY ADVANCE REQUEST</h2>
        <div class="title-rule"></div>
      </div>
      <div class="info-box">
        <div class="lbl">${bi("تاريخ الطلب", "Date")}</div>
        <div class="val">${esc(dateText(data.requestDate))}</div>
        <div class="badge-wrap"><span class="status-badge status-${statusClass(status)}">${esc(advanceRequestStatusLabel(status))}</span></div>
      </div>
    </div>

    <main class="letter-body">
      <div class="addressee">
        <span>السادة / ${strong(esc(ctx.company.nameAr))}</span>
        <span>المحترمين</span>
      </div>
      <div class="addressee-sub">إدارة الموارد البشرية والشؤون المالية</div>

      ${infoCells.length > 0 ? `<div class="emp-info">${infoCells.join("")}</div>` : ""}

      <p class="greeting">السلام عليكم ورحمة الله وبركاته، وبعد:</p>
      <p class="subject"><span>الموضوع: طلب سلفة مالية</span></p>

      <div class="amount-strip">
        <div class="amount-cell main"><div class="lbl">مبلغ السلفة</div><div class="val ltr">${money(amount)} <small>ريال</small></div></div>
        <div class="amount-cell words"><div class="lbl">المبلغ كتابةً</div><div class="val">${esc(amountToArabicWords(amount))}</div></div>
        <div class="amount-cell"><div class="lbl">طريقة السداد</div><div class="val">${esc(repaymentMethodLabel(data.repaymentMethod))}</div></div>
      </div>

      <p class="para">${paragraph}</p>
      <p class="closing">وتقبلوا خالص التحية والتقدير،،</p>

      <section class="applicant">
        <div class="ack-field"><span>مقدم الطلب:</span> <span class="blank">${esc(e.name)}</span></div>
        <div class="ack-field"><span>التوقيع:</span> <span class="blank">&nbsp;</span></div>
        <div class="ack-field short"><span>التاريخ:</span> <span class="blank">${esc(proseDate(data.requestDate))}</span></div>
      </section>
    </main>

    <section class="approval">
      <div class="sec-title">${bi("قرار الإدارة", "Management Decision")}</div>
      ${renderDecision(ctx, data)}
      <section class="sign-row">
        ${renderSigner(ctx, "supervisor", false, pendingText)}
        ${renderSigner(ctx, "manager", true, pendingText)}
      </section>
    </section>`;

  return renderDocumentShell({
    ctx,
    title: `طلب سلفة - ${e.name} - ${data.requestNumber}`,
    kind: "advance",
    watermark,
    body,
    footer: renderFooter(ctx, "طلب سلفة", "رقم الطلب", data.requestNumber),
    extraCss: ADVANCE_STYLES,
    autoPrint: options.autoPrint,
  });
}

const ADVANCE_STYLES = `
  .letter-body { font-size: 12.5px; line-height: 1.85; }
  .addressee { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; font-weight: 700; margin-top: 4px; }
  .addressee-sub { font-size: 11.5px; color: #3f4753; margin-bottom: 8px; }
  .emp-info { display: flex; flex-wrap: wrap; border: 1px solid #cfd6df; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
  .emp-info .cell { flex: 1 1 0; min-width: 28mm; padding: 2px 8px 3px; border-left: 1px solid #cfd6df; line-height: 1.45; }
  .emp-info .cell:last-child { border-left: none; }
  .emp-info .lbl { font-size: 9px; color: #5b6573; }
  .emp-info .val { font-size: 11.5px; font-weight: 700; }
  .greeting { font-weight: 700; margin-bottom: 2px; }
  .subject { text-align: center; font-weight: 700; font-size: 13.5px; margin: 4px 0 8px; }
  .subject span { border-bottom: 1.5px solid ${DOC_ACCENT}; padding-bottom: 1px; }
  .amount-strip { display: flex; align-items: stretch; border: 1.5px solid ${DOC_ACCENT}; border-radius: 6px; overflow: hidden; margin-bottom: 10px; break-inside: avoid; }
  .amount-cell { padding: 3px 10px; border-left: 1px solid #cfd6df; line-height: 1.45; }
  .amount-cell:last-child { border-left: none; }
  .amount-cell .lbl { font-size: 9.5px; color: #5b6573; }
  .amount-cell .val { font-size: 12px; font-weight: 700; }
  .amount-cell.main { background: ${DOC_ACCENT}; color: #fff; white-space: nowrap; }
  .amount-cell.main .lbl { color: #dbe3ee; }
  .amount-cell.main .val { font-size: 17px; }
  .amount-cell.main small { font-size: 10px; font-weight: 600; }
  .amount-cell.words { flex: 1; background: ${DOC_ACCENT_SOFT}; }
  .para { text-align: justify; margin-bottom: 6px; }
  .closing { text-align: center; font-weight: 700; margin-top: 6px; }
  .applicant { display: flex; gap: 14px; margin-top: 14px; break-inside: avoid; }
  .approval { margin-top: 14px; break-inside: avoid; page-break-inside: avoid; }
  .decision { margin-top: 4px; line-height: 1.75; }
  .decision-approved { margin-top: 6px; padding: 0 2px; font-size: 11.5px; }
  .decision-head { font-weight: 700; font-size: 12px; }
  .decision-line { font-size: 11.5px; }
  .approval .sign-row { margin-top: 10px; justify-content: space-around; }
  .approval .sign-row .sig { flex: 0 0 68mm; }
  .sig-area { height: 66px; }
  .sig-img { height: 60px; width: 146px; }
  .stamp-img { width: 130px; height: 130px; }
`;
