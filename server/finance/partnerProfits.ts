/**
 * أرباح الشركاء (للمسؤول فقط): بيانات الملخص الشهري وملف PDF لكل فرع
 * - الفروع النشطة التي تطابق مؤسسة لها نسب شركاء (matchEstablishmentKey على nameAr/name)
 * - الأرقام من getBranchMonthlyFinancials (نفس مصدر الربح والخسارة)
 * - الفروع النشطة بدون نسب شركاء تُعرض منفصلة (unassigned)
 */

import * as db from "../db";
import { getBranchMonthlyFinancials } from "./branchFinancials";
import { ensureFixedExpensesForViewedMonth } from "../expenses/autoExpenses";
import { loadDocumentAssetsForBranch, renderHtmlToPdf } from "../voucherPdf";
import {
  branchDisplayName,
  buildPartnerProfitStatement,
  partnerKeyForBranch,
  type PartnerProfitStatement,
  type PartnerProfitsSummary,
} from "../../shared/partnerProfits";
import { renderPartnerProfitsHtml } from "../../shared/partnerProfitsTemplate";

/**
 * ملخص أرباح الشركاء لشهر: بيان لكل فرع له نسب شركاء + الفروع بدون نسب
 * options.branchId: بيان فرع واحد فقط (لملف PDF) بدون حساب باقي الفروع
 */
export async function getPartnerProfits(
  year: number,
  month: number,
  options: { branchId?: number } = {}
): Promise<PartnerProfitsSummary> {
  await ensureFixedExpensesForViewedMonth(year, month);
  const allBranches = await db.getBranches();
  const active = allBranches.filter(
    b => b.isActive !== false && (options.branchId == null || b.id === options.branchId)
  );

  const branches: PartnerProfitStatement[] = [];
  const unassigned: PartnerProfitsSummary["unassigned"] = [];
  for (const branch of active) {
    const key = partnerKeyForBranch(branch);
    if (!key) {
      unassigned.push({ id: branch.id, name: branchDisplayName(branch) });
      continue;
    }
    const financials = await getBranchMonthlyFinancials(year, month, branch.id);
    branches.push(buildPartnerProfitStatement({ year, month, branch, key, financials }));
  }
  return { year, month, branches, unassigned };
}

/** HTML البيان بالخط مضمّناً (ترويسة مؤسسة الفرع) */
export function renderPartnerProfitsHtmlEmbedded(
  statement: PartnerProfitStatement,
  options: { printedAt?: Date } = {}
): string {
  return renderPartnerProfitsHtml(statement, {
    assets: loadDocumentAssetsForBranch(statement.branchName),
    printedAt: options.printedAt,
  });
}

export async function generatePartnerProfitsPDF(statement: PartnerProfitStatement): Promise<Buffer> {
  return renderHtmlToPdf(renderPartnerProfitsHtmlEmbedded(statement));
}

/** اسم ملف PDF بأحرف لاتينية آمنة: partner-profits-qessa-1-2026-10.pdf */
export function partnerProfitsFileName(
  statement: Pick<PartnerProfitStatement, "establishmentKey" | "branchId" | "year" | "month">
): string {
  const safe = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, "_");
  return `partner-profits-${safe(statement.establishmentKey)}-${statement.branchId}-${statement.year}-${String(statement.month).padStart(2, "0")}.pdf`;
}
