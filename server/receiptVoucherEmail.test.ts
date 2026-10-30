import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";

// قاعدة بيانات وهمية: تُرجع الموظفين المحددين وتحتفظ بشرط الاستعلام لفحصه
const state = vi.hoisted(() => ({
  staff: [] as Array<{ id: number; name: string; username: string; email: string | null; role: string; branchId: number | null }>,
  where: null as unknown,
  failFor: new Set<string>(),
}));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: async (condition: unknown) => {
          state.where = condition;
          return state.staff;
        },
      }),
    }),
  }),
}));
vi.mock("./email/emailService", () => ({
  sendEmail: vi.fn(async ({ to }: { to: string }) =>
    state.failFor.has(to) ? { success: false, error: "SMTP رفض" } : { success: true }
  ),
}));
vi.mock("./voucherPdf", () => ({
  generateVoucherPDF: async () => Buffer.from("pdf"),
  renderVoucherHtmlEmbedded: () => "<html></html>",
  voucherFileName: () => "voucher.pdf",
}));
vi.mock("./receiptVoucher", () => ({ getVoucherWithItems: async () => null }));

import { sendVoucherEmail, type VoucherEmailData } from "./receiptVoucherEmail";
import { sendEmail } from "./email/emailService";

function voucher(overrides: Partial<VoucherEmailData> = {}): VoucherEmailData {
  return {
    voucherType: "payment",
    voucherId: "PV-2026-0001",
    voucherDate: "2026-10-30",
    status: "draft",
    partyName: "مورد",
    payeeName: "مورد",
    totalAmount: "100.00",
    branchId: 3,
    items: [{ description: "x", quantity: 1, amount: 100 }],
    ...overrides,
  };
}

describe("sendVoucherEmail - المستقبلون والنتيجة", () => {
  beforeEach(() => {
    state.staff = [
      { id: 1, name: "مسؤول", username: "admin", email: "admin@x.com", role: "admin", branchId: null },
      { id: 2, name: "مدير", username: "mgr", email: "mgr@x.com", role: "manager", branchId: null },
    ];
    state.failFor = new Set();
    state.where = null;
    vi.mocked(sendEmail).mockClear();
  });

  it("only queries active staff accounts", async () => {
    await sendVoucherEmail(voucher());
    const { sql, params } = new MySqlDialect().sqlToQuery(state.where as SQL);
    expect(sql).toContain("`isActive` = ?");
    expect(params).toContain(true);
  });

  it("reports failed recipients and marks the result partial", async () => {
    state.failFor = new Set(["mgr@x.com"]);
    const result = await sendVoucherEmail(voucher());
    expect(result.success).toBe(true);
    expect(result.partial).toBe(true);
    expect(result.sentTo).toHaveLength(1);
    expect(result.failed).toEqual([{ email: "mgr@x.com", error: "SMTP رفض" }]);
  });

  it("is not partial when every recipient fails or every recipient succeeds", async () => {
    const ok = await sendVoucherEmail(voucher());
    expect(ok).toMatchObject({ success: true, partial: false, failed: [] });

    state.failFor = new Set(["admin@x.com", "mgr@x.com"]);
    const none = await sendVoucherEmail(voucher());
    expect(none.success).toBe(false);
    expect(none.partial).toBe(false);
    expect(none.failed.map(f => f.email)).toEqual(["mgr@x.com", "admin@x.com"]);
  });

  it("asks managers to review drafts only, never cancelled vouchers", async () => {
    await sendVoucherEmail(voucher({ status: "draft" }));
    const draftHtml = vi.mocked(sendEmail).mock.calls.map(([opts]) => opts.html).join("");
    expect(draftHtml).toContain("بانتظار مراجعتك واعتمادك");

    vi.mocked(sendEmail).mockClear();
    await sendVoucherEmail(voucher({ status: "cancelled" }));
    const cancelledHtml = vi.mocked(sendEmail).mock.calls.map(([opts]) => opts.html).join("");
    expect(cancelledHtml).not.toContain("بانتظار مراجعتك واعتمادك");
  });
});
