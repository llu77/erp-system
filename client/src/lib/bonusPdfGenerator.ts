/**
 * تقرير البونص للطباعة / الحفظ كـ PDF (من جهة الواجهة)
 *
 * - أسماء المستويات من البيانات (الاسم المحفوظ وقت الاحتساب) وليس من خريطة ثابتة
 * - التوقيعات والختم تظهر فقط عندما يكون البونص معتمداً أو مصروفاً
 * - يرمي خطأ إذا منع المتصفح فتح نافذة الطباعة
 */

import { SIGNATURES } from "@shared/branding";
import { formatBonusPeriodLabel } from "@shared/bonus";
import {
  BONUS_PAYMENT_METHOD_LABELS,
  getBonusStatusLabel,
  getTierColorHex,
  getTierDisplayName,
  isFinalBonusStatus,
  isLockedBonusStatus,
} from "@shared/bonusHelpers";
import { getReadableTextColor } from "./bonusUi";

// تعريف الأنواع
export interface BonusPdfEmployee {
  employeeName: string | null;
  employeeCode: string | null;
  weeklyRevenue: string | number;
  bonusTier: string | null;
  /** اسم المستوى المحفوظ وقت الاحتساب */
  tierName?: string | null;
  /** اسم المستوى للعرض (من الخادم) */
  tierLabel?: string | null;
  bonusAmount: string | number;
  isEligible: boolean | null;
}

export interface BonusPdfRequest {
  id: number;
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  periodLabel?: string | null;
  status: string;
  totalAmount: string | number;
  approvedAmount?: string | number | null;
  paidAmount?: string | number | null;
  eligibleCount: number;
  totalEmployees: number;
  requestedAt?: string | Date | null;
  approvedAt?: string | Date | null;
  paidAt?: string | Date | null;
  rejectionReason?: string | null;
  requestedByName?: string | null;
  approvedByName?: string | null;
  paidByName?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  details: BonusPdfEmployee[];
}

export interface BonusPdfTier {
  tierKey: string;
  tierName: string;
  minRevenue: number;
  maxRevenue: number | null;
  bonusAmount: number;
  color?: string | null;
}

export interface BonusPdfOptions {
  /** المستويات الحالية (لدليل المستويات وألوانها) */
  tiers?: BonusPdfTier[] | null;
  /** عنوان التقرير */
  title?: string;
}

/** خطأ منع النوافذ المنبثقة */
export class PrintWindowBlockedError extends Error {
  constructor() {
    super("منع المتصفح فتح نافذة الطباعة - يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مرة أخرى");
    this.name = "PrintWindowBlockedError";
  }
}

// حماية النصوص داخل HTML
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// تنسيق العملة
function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  return `${(Number.isFinite(num) ? num : 0).toFixed(2)} ر.س`;
}

// تاريخ ميلادي dd/mm/yyyy
function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatAmountShort(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** المبلغ النهائي حسب الحالة (المصروف ← المعتمد ← المحتسب) */
function getFinalAmount(request: BonusPdfRequest): string | number {
  if (request.status === "paid") return request.paidAmount ?? request.approvedAmount ?? request.totalAmount;
  if (request.status === "approved") return request.approvedAmount ?? request.totalAmount;
  return request.totalAmount;
}

/**
 * HTML تقرير البونص (دالة نقية قابلة للاختبار)
 */
export function buildBonusReportHtml(request: BonusPdfRequest, options: BonusPdfOptions = {}): string {
  const tiers = options.tiers ? options.tiers.map(t => ({ ...t, color: t.color ?? undefined })) : null;
  const isFinal = isFinalBonusStatus(request.status);
  const periodLabel = request.periodLabel || formatBonusPeriodLabel(request.weekNumber, request.month, request.year);
  const totalRevenue = request.details.reduce((sum, emp) => sum + (parseFloat(String(emp.weeklyRevenue)) || 0), 0);

  // صفوف الجدول
  const tableRows = request.details
    .map((emp, index) => {
      const tierLabel = emp.tierLabel || getTierDisplayName(emp.bonusTier, emp.tierName, tiers);
      const hex = getTierColorHex(emp.bonusTier, tiers);
      return `
    <tr>
      <td>${index + 1}</td>
      <td class="name-cell">${escapeHtml(emp.employeeName || "غير معروف")}</td>
      <td>${escapeHtml(emp.employeeCode || "-")}</td>
      <td>${formatCurrency(emp.weeklyRevenue)}</td>
      <td><span class="tier-badge" style="background:${hex};color:${getReadableTextColor(hex)}">${escapeHtml(tierLabel)}</span></td>
      <td class="bonus-cell">${emp.isEligible ? formatCurrency(emp.bonusAmount) : "-"}</td>
    </tr>`;
    })
    .join("");

  // دليل المستويات (من إعدادات المدير الحالية): لا يُطبع لفترة مقفلة لأن مبالغها
  // احتُسبت بمستويات وقت الطلب وقد تكون الإعدادات تغيرت بعدها
  const legend =
    tiers && tiers.length > 0 && !isLockedBonusStatus(request.status)
      ? `
        <div class="legend">
          <div class="legend-title">مستويات البونص (إيراد الموظف في الفترة)</div>
          <div class="legend-grid">
            ${[...tiers]
              .sort((a, b) => a.minRevenue - b.minRevenue)
              .map(t => {
                const range = t.maxRevenue !== null ? `${formatAmountShort(t.minRevenue)} - ${formatAmountShort(t.maxRevenue)}` : `${formatAmountShort(t.minRevenue)} فأكثر`;
                return `<div class="legend-item"><span class="legend-dot" style="background:${getTierColorHex(t.tierKey, tiers)}"></span>${escapeHtml(t.tierName)}: ${range} ر.س ← ${formatCurrency(t.bonusAmount)}</div>`;
              })
              .join("")}
          </div>
        </div>`
      : "";

  // بيانات الاعتماد والصرف
  const approvalLines: string[] = [];
  if (request.requestedAt) {
    approvalLines.push(`طلب الصرف: ${escapeHtml(request.requestedByName || "-")} - ${formatDate(request.requestedAt)}`);
  }
  if (request.approvedAt) {
    approvalLines.push(`الاعتماد: ${escapeHtml(request.approvedByName || "-")} - ${formatDate(request.approvedAt)}`);
  }
  if (request.status === "paid") {
    const method = request.paymentMethod ? BONUS_PAYMENT_METHOD_LABELS[request.paymentMethod] ?? request.paymentMethod : "-";
    approvalLines.push(
      `الصرف: ${escapeHtml(request.paidByName || "-")} - ${formatDate(request.paidAt)} - ${escapeHtml(method)}` +
        (request.paymentReference ? ` - المرجع: ${escapeHtml(request.paymentReference)}` : "")
    );
  }

  // التوقيعات والختم للمعتمد أو المصروف فقط
  const signatures = isFinal
    ? `
        <div class="signatures-section">
          <div class="signatures-header">الموافقات والتوقيعات</div>
          <div class="signatures-content">
            <div class="signature-box">
              <div class="title">${escapeHtml(SIGNATURES.supervisor.title)}</div>
              <img src="${SIGNATURES.supervisor.image}" alt="توقيع ${escapeHtml(SIGNATURES.supervisor.name)}">
              <div class="signature-line"></div>
              <div class="name">${escapeHtml(SIGNATURES.supervisor.name)}</div>
              <div class="role">${escapeHtml(SIGNATURES.supervisor.title)}</div>
            </div>
            <div class="signature-box">
              <img src="${SIGNATURES.stamp.image}" alt="${escapeHtml(SIGNATURES.stamp.label)}" class="stamp">
              <div class="role">${escapeHtml(SIGNATURES.stamp.label)}</div>
            </div>
            <div class="signature-box">
              <div class="title">${escapeHtml(SIGNATURES.manager.title)}</div>
              <img src="${SIGNATURES.manager.image}" alt="توقيع ${escapeHtml(SIGNATURES.manager.name)}">
              <div class="signature-line"></div>
              <div class="name">${escapeHtml(SIGNATURES.manager.name)}</div>
              <div class="role">${escapeHtml(SIGNATURES.manager.title)}</div>
            </div>
          </div>
        </div>`
    : `
        <div class="not-approved">
          <strong>تقرير غير معتمد</strong> - الحالة: ${escapeHtml(getBonusStatusLabel(request.status))}.
          لا يصلح هذا التقرير للصرف قبل اعتماد البونص.
          ${request.status === "rejected" && request.rejectionReason ? `<div>سبب الرفض: ${escapeHtml(request.rejectionReason)}</div>` : ""}
        </div>`;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(options.title || "تقرير البونص")} - ${escapeHtml(request.branchName)} - ${escapeHtml(periodLabel)}</title>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 10mm; }
        body {
          font-family: 'IBM Plex Sans Arabic', 'Tajawal', Arial, sans-serif;
          background: #fff; color: #1e293b; font-size: 12px; line-height: 1.6; direction: rtl;
        }
        .container { max-width: 210mm; margin: 0 auto; padding: 0; position: relative; }

        /* رأس التقرير */
        .header {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white; padding: 20px 25px; border-radius: 8px 8px 0 0;
          display: flex; justify-content: space-between; align-items: center;
        }
        .header-info h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .header-info .subtitle { color: #d4af37; font-size: 11px; }
        .header-info .report-title { font-size: 14px; margin-top: 8px; opacity: 0.9; }
        .logo { width: 60px; height: 60px; object-fit: contain; }
        .gold-line { height: 3px; background: linear-gradient(90deg, #d4af37, #f4d03f, #d4af37); }

        /* بطاقة المعلومات */
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; padding: 15px 20px; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 12px; }
        .info-item label { display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; }
        .info-item .value { font-size: 13px; font-weight: 600; color: #0f172a; }
        .info-item .value.status { color: ${isFinal ? "#22c55e" : "#f97316"}; }
        .info-item .value.amount { color: #d4af37; }
        .info-divider { height: 1px; background: #e2e8f0; margin: 12px 0; }
        .eligible-info { font-size: 11px; color: #64748b; }
        .eligible-info strong { color: #0f172a; }
        .approval-lines { margin-top: 6px; font-size: 10px; color: #475569; }

        /* الجدول */
        .table-header { background: #334155; color: white; padding: 8px 15px; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background: #475569; color: white; padding: 10px 8px; font-size: 11px; font-weight: 600; text-align: center; }
        td { padding: 10px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) { background: #f8fafc; }
        .name-cell { text-align: right; font-weight: 500; }
        .bonus-cell { font-weight: 600; color: #22c55e; }
        .tier-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 500; }
        .total-row { background: #e2e8f0 !important; font-weight: 700; }
        .total-row .bonus-cell { color: #22c55e; font-size: 13px; }

        /* دليل المستويات */
        .legend { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 15px; margin-bottom: 15px; background: #f8fafc; }
        .legend-title { font-size: 11px; font-weight: 600; margin-bottom: 6px; }
        .legend-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 15px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 10px; }
        .legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

        /* التوقيعات */
        .signatures-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 20px; overflow: hidden; }
        .signatures-header { background: #334155; color: white; padding: 8px 15px; font-size: 11px; font-weight: 600; text-align: center; }
        .signatures-content { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 15px; gap: 10px; }
        .signature-box { text-align: center; }
        .signature-box .title { font-size: 10px; color: #64748b; margin-bottom: 8px; }
        .signature-box img { max-width: 100px; max-height: 50px; object-fit: contain; }
        .signature-box .stamp { max-width: 80px; max-height: 80px; }
        .signature-line { width: 100px; height: 1px; background: #64748b; margin: 8px auto; }
        .signature-box .name { font-size: 11px; font-weight: 600; color: #0f172a; }
        .signature-box .role { font-size: 9px; color: #64748b; }

        /* تقرير غير معتمد */
        .not-approved { margin-top: 20px; border: 2px dashed #f97316; background: #fff7ed; color: #9a3412; border-radius: 8px; padding: 12px 15px; font-size: 11px; }
        .watermark {
          position: fixed; top: 40%; left: 0; right: 0; text-align: center;
          font-size: 90px; font-weight: 700; color: rgba(249, 115, 22, 0.12);
          transform: rotate(-30deg); pointer-events: none; z-index: 0;
        }

        /* ذيل التقرير */
        .footer { background: #0f172a; color: #d4af37; padding: 10px; text-align: center; font-size: 9px; margin-top: 20px; border-radius: 6px; }

        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .container { max-width: 100%; }
        }
      </style>
    </head>
    <body>
      ${isFinal ? "" : '<div class="watermark">غير معتمد</div>'}
      <div class="container">
        <!-- رأس التقرير -->
        <div class="header">
          <div class="header-info">
            <h1>Symbol AI</h1>
            <div class="subtitle">نظام إدارة الصالونات</div>
            <div class="report-title">${escapeHtml(options.title || "تقرير البونص")}</div>
          </div>
          <img src="/symbol-ai-logo.png" alt="Logo" class="logo">
        </div>

        <div class="gold-line"></div>

        <!-- بطاقة المعلومات -->
        <div class="info-card">
          <div class="info-grid">
            <div class="info-item">
              <label>الفرع</label>
              <div class="value">${escapeHtml(request.branchName)}</div>
            </div>
            <div class="info-item">
              <label>الفترة</label>
              <div class="value">${escapeHtml(periodLabel)}</div>
            </div>
            <div class="info-item">
              <label>الحالة</label>
              <div class="value status">${escapeHtml(getBonusStatusLabel(request.status))}</div>
            </div>
            <div class="info-item">
              <label>${request.status === "paid" ? "المبلغ المصروف" : request.status === "approved" ? "المبلغ المعتمد" : "إجمالي البونص"}</label>
              <div class="value amount">${formatCurrency(getFinalAmount(request))}</div>
            </div>
          </div>
          <div class="info-divider"></div>
          <div class="eligible-info">
            الموظفين المؤهلين: <strong>${request.eligibleCount} من ${request.totalEmployees}</strong>
          </div>
          ${approvalLines.length > 0 ? `<div class="approval-lines">${approvalLines.map(line => `<div>${line}</div>`).join("")}</div>` : ""}
        </div>

        <!-- جدول الموظفين -->
        <div class="table-header">تفاصيل بونص الموظفين</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px">#</th>
              <th style="width: 150px">اسم الموظف</th>
              <th style="width: 80px">الكود</th>
              <th style="width: 100px">الإيراد في الفترة</th>
              <th style="width: 90px">المستوى</th>
              <th style="width: 90px">البونص</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td></td>
              <td class="name-cell">الإجمالي</td>
              <td></td>
              <td>${formatCurrency(totalRevenue)}</td>
              <td>${request.eligibleCount} مؤهل</td>
              <td class="bonus-cell">${formatCurrency(request.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        ${legend}

        ${signatures}

        <!-- ذيل التقرير -->
        <div class="footer">
          Symbol AI ERP System | تاريخ الإنشاء: ${formatDate(new Date())} | رقم التقرير: BR-${request.id || "-"}
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * فتح تقرير البونص للطباعة أو الحفظ كـ PDF
 * يرمي PrintWindowBlockedError إذا منع المتصفح النافذة المنبثقة
 */
export async function generateBonusPDF(request: BonusPdfRequest, options: BonusPdfOptions = {}): Promise<void> {
  const htmlContent = buildBonusReportHtml(request, options);

  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    throw new PrintWindowBlockedError();
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();

  // انتظار تحميل الصور ثم الطباعة (مرة واحدة حتى لو سبق حدث التحميل تعيين المعالج)
  let printed = false;
  const print = () => {
    if (printed || printWindow.closed) return;
    printed = true;
    printWindow.print();
  };
  printWindow.onload = () => setTimeout(print, 300);
  setTimeout(print, 1500);
}
