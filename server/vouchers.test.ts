import { describe, it, expect, vi } from "vitest";

// خدمة السندات تستورد قاعدة البيانات والبريد: نستبدلها حتى تعمل الاختبارات بدون اتصال
vi.mock("./db", () => ({ getDb: async () => null }));
vi.mock("./email/emailService", () => ({ sendEmail: vi.fn(async () => ({ success: true })) }));

import {
  canTransitionVoucher,
  computeVoucherItems,
  formatPaymentSplitText,
  getAllowedVoucherTransitions,
  isVoucherSigned,
  maxVoucherSequence,
  nextVoucherNumber,
  parseVoucherSequence,
  resolvePaymentSplit,
  toVoucherDateString,
  validatePaymentDetails,
  voucherYear,
  type VoucherStatus,
} from "../shared/vouchers";
import { renderVoucherHtml, type VoucherTemplateData } from "../shared/voucherTemplate";
import { SIGNATURES } from "../shared/branding";
import {
  createVoucher,
  isDuplicateKeyError,
  isVoucherApprover,
  canCreateVoucher,
  scopedBranchId,
  updateVoucherStatus,
  VoucherError,
} from "./receiptVoucher";
import { loadVoucherAssets, readPublicAssetAsDataUri, renderVoucherHtmlEmbedded, voucherFileName } from "./voucherPdf";
import { buildVoucherEmailHtml } from "./receiptVoucherEmail";

const ASSETS = {
  logo: "data:image/png;base64,LOGO",
  supervisorSignature: "data:image/png;base64,SUPERVISOR_SIG",
  managerSignature: "data:image/png;base64,MANAGER_SIG",
  stamp: "data:image/png;base64,COMPANY_STAMP",
};

function voucher(overrides: Partial<VoucherTemplateData> = {}): VoucherTemplateData {
  return {
    voucherType: "receipt",
    voucherId: "RV-2026-0001",
    voucherDate: "2026-10-30",
    status: "draft",
    partyName: "فرع العليا - أحمد",
    partyType: "branch",
    payeeName: "عمر المطيري",
    branchName: "فرع العليا",
    description: "تسليم مبالغ كاش",
    totalAmount: "2000.00",
    paymentMethod: "mixed",
    cashAmount: "500.00",
    bankAmount: "1500.00",
    checkAmount: "0.00",
    bankName: "الراجحي",
    bankReference: "TX-778",
    items: [{ description: "تسليم مبالغ كاش", quantity: "1", unitPrice: "2000.00", amount: "2000.00" }],
    createdByName: "أحمد",
    createdAt: new Date("2026-10-30T08:00:00Z"),
    ...overrides,
  };
}

const render = (v: VoucherTemplateData) => renderVoucherHtml(v, { assets: ASSETS, printedAt: new Date("2026-10-30T09:00:00Z") });

describe("renderVoucherHtml - التوقيعات والختم بعد الاعتماد فقط", () => {
  const signatureMarkers = ["SUPERVISOR_SIG", "MANAGER_SIG", "COMPANY_STAMP"];

  it.each(["draft", "cancelled"])("does not show signatures or stamp when %s", status => {
    const html = render(voucher({ status }));
    for (const marker of signatureMarkers) expect(html).not.toContain(marker);
    expect(html).toContain(status === "draft" ? "مسودة / DRAFT" : "ملغي / CANCELLED");
  });

  it("shows both signatures and the stamp when approved", () => {
    const html = render(voucher({ status: "approved", approvedByName: "المدير", approvedAt: new Date("2026-10-30T10:00:00Z") }));
    for (const marker of signatureMarkers) expect(html).toContain(marker);
    expect(html).toContain(SIGNATURES.supervisor.name);
    expect(html).toContain(SIGNATURES.manager.name);
    expect(html).not.toContain("DRAFT");
    expect(html).toContain("اعتُمد بواسطة المدير");
  });

  it("shows signatures and stamp on a paid payment voucher", () => {
    const html = render(voucher({ voucherType: "payment", voucherId: "PV-2026-0003", status: "paid", paidByName: "المحاسب" }));
    for (const marker of signatureMarkers) expect(html).toContain(marker);
    expect(html).toContain("سند صرف");
    expect(html).toContain("PAYMENT VOUCHER");
    expect(html).toContain("صرفنا إلى");
  });

  it("shows the receipt title and the received-by line", () => {
    const html = render(voucher());
    expect(html).toContain("سند قبض");
    expect(html).toContain("RECEIPT VOUCHER");
    expect(html).toContain("استلمنا من");
    expect(html).toContain("فرع العليا - أحمد");
    expect(html).toContain("Received By");
    expect(html).toContain("عمر المطيري");
  });

  it("uses asset base url for images when no explicit assets are given", () => {
    const html = renderVoucherHtml(voucher({ status: "approved" }), { assetBaseUrl: "https://erp.example.com/" });
    expect(html).toContain(`https://erp.example.com${SIGNATURES.stamp.image}`);
    expect(html).toContain(`https://erp.example.com${SIGNATURES.manager.image}`);
    const draft = renderVoucherHtml(voucher({ status: "draft" }), { assetBaseUrl: "https://erp.example.com" });
    expect(draft).not.toContain(SIGNATURES.stamp.image);
    expect(draft).not.toContain(SIGNATURES.supervisor.image);
  });
});

describe("renderVoucherHtml - المحتوى والتهريب", () => {
  it("escapes user supplied text everywhere", () => {
    const evil = `<script>alert("x")</script>`;
    const html = render(voucher({
      status: "cancelled",
      partyName: evil,
      payeeName: `<img src=x onerror=alert(1)>`,
      branchName: evil,
      description: evil,
      notes: evil,
      bankName: evil,
      bankReference: `"><b>`,
      cancellationReason: evil,
      cancelledByName: evil,
      createdByName: evil,
      items: [{ description: evil, quantity: 1, amount: 2000, notes: evil }],
    }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain(`"><b>`);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("adds the print script only when autoPrint is requested", () => {
    expect(render(voucher())).not.toContain("<script");
    expect(renderVoucherHtml(voucher(), { assets: ASSETS, autoPrint: true })).toContain("window.print()");
  });

  it("shows the amount in Arabic and English words", () => {
    const html = render(voucher());
    expect(html).toContain("فقط ألفان ريال سعودي لا غير");
    expect(html).toContain("Two Thousand Saudi Riyals Only");
    expect(html).toContain("2,000.00");
  });

  it("shows the payment split lines and bank details", () => {
    const html = render(voucher());
    expect(html).toContain("نقداً 500 ريال، حوالة بنكية 1,500 ريال");
    expect(html).toContain("الراجحي");
    expect(html).toContain("TX-778");
  });

  it("falls back to the legacy payment method when there is no split", () => {
    const html = render(voucher({ paymentMethod: "bank_transfer", cashAmount: null, bankAmount: null, checkAmount: null }));
    expect(html).toContain("حوالة بنكية 2,000 ريال");
  });

  it("shows cheque details", () => {
    const html = render(voucher({
      cashAmount: 0,
      bankAmount: 0,
      checkAmount: 2000,
      checkNumber: "000123",
      checkDate: "2026-11-05",
      checkBank: "الأهلي",
    }));
    expect(html).toContain("شيك 2,000 ريال");
    expect(html).toContain("000123");
    expect(html).toContain("05/11/2026");
    expect(html).toContain("الأهلي");
  });

  it("renders items with quantity and unit price", () => {
    const html = render(voucher({
      totalAmount: 150,
      cashAmount: 150,
      bankAmount: 0,
      items: [
        { description: "أكياس", quantity: 3, unitPrice: 25, amount: 75 },
        { description: "منظفات", quantity: 1, unitPrice: 75, amount: 75 },
      ],
    }));
    expect(html).toContain("أكياس");
    expect(html).toContain("25.00");
    expect(html).toContain("150.00");
    expect(html).toContain("فقط مائة وخمسون ريال سعودي لا غير");
  });

  it("shows the cancellation reason on cancelled vouchers", () => {
    const html = render(voucher({ status: "cancelled", cancellationReason: "مبلغ مكرر", cancelledByName: "المدير" }));
    expect(html).toContain("سبب الإلغاء");
    expect(html).toContain("مبلغ مكرر");
  });
});

describe("computeVoucherItems", () => {
  it("multiplies quantity by unit price and sums in halalas", () => {
    const r = computeVoucherItems([
      { description: "بند 1", quantity: 3, unitPrice: 0.1 },
      { description: "بند 2", quantity: 2, unitPrice: 12.345 },
      { description: "بند 3", amount: "100.10" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.map(i => i.amount)).toEqual([0.3, 24.7, 100.1]);
    expect(r.items[1].unitPrice).toBe(12.35);
    expect(r.items[2].quantity).toBe(1);
    expect(r.items[2].unitPrice).toBeNull();
    expect(r.total).toBe(125.1);
    expect(r.items.map(i => i.itemNumber)).toEqual([1, 2, 3]);
  });

  it("rejects empty lists and invalid lines", () => {
    expect(computeVoucherItems([])).toMatchObject({ ok: false });
    expect(computeVoucherItems(null)).toMatchObject({ ok: false });
    expect(computeVoucherItems([{ description: " ", amount: 10 }])).toMatchObject({ ok: false });
    expect(computeVoucherItems([{ description: "x", quantity: 0, unitPrice: 10 }])).toMatchObject({ ok: false });
    expect(computeVoucherItems([{ description: "x", unitPrice: -1 }])).toMatchObject({ ok: false });
    expect(computeVoucherItems([{ description: "x", amount: 0 }])).toMatchObject({ ok: false });
    expect(computeVoucherItems([{ description: "x" }])).toMatchObject({ ok: false });
  });
});

describe("resolvePaymentSplit / validatePaymentDetails", () => {
  it("accepts an explicit split equal to the total and derives mixed", () => {
    const r = resolvePaymentSplit(2000, { cashAmount: 500, bankAmount: 1500 });
    expect(r).toEqual({ ok: true, split: { paymentMethod: "mixed", cashAmount: 500, bankAmount: 1500, checkAmount: 0 } });
  });

  it("rejects a split that does not equal the total", () => {
    const r = resolvePaymentSplit(2000, { cashAmount: 500, bankAmount: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("لا يساوي إجمالي السند");
    expect(resolvePaymentSplit(100, { cashAmount: 100.01 }).ok).toBe(false);
  });

  it("handles floating point split amounts exactly", () => {
    expect(resolvePaymentSplit(0.3, { cashAmount: 0.1, bankAmount: 0.2 }).ok).toBe(true);
  });

  it("puts the whole amount in the selected method without a split", () => {
    expect(resolvePaymentSplit(750, {})).toMatchObject({ ok: true, split: { paymentMethod: "cash", cashAmount: 750 } });
    expect(resolvePaymentSplit(750, { paymentMethod: "check" })).toMatchObject({ ok: true, split: { checkAmount: 750 } });
    expect(resolvePaymentSplit(750, { paymentMethod: "mixed" }).ok).toBe(false);
  });

  it("rejects negative amounts and zero totals", () => {
    expect(resolvePaymentSplit(100, { cashAmount: 150, bankAmount: -50 }).ok).toBe(false);
    expect(resolvePaymentSplit(0, { cashAmount: 0 }).ok).toBe(false);
  });

  it("requires cheque number and date for cheque payments", () => {
    const r = resolvePaymentSplit(300, { checkAmount: 300 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(validatePaymentDetails(r.split, {})).toContain("رقم الشيك");
    expect(validatePaymentDetails(r.split, { checkNumber: "12" })).toContain("تاريخ الشيك");
    expect(validatePaymentDetails(r.split, { checkNumber: "12", checkDate: "2026-11-01" })).toBeNull();
  });

  it("formats the split text", () => {
    expect(formatPaymentSplitText({ cashAmount: 500, bankAmount: 1500, totalAmount: 2000 })).toBe("نقداً 500 ريال، حوالة بنكية 1,500 ريال");
  });
});

describe("انتقالات حالة السند", () => {
  const statuses: VoucherStatus[] = ["draft", "approved", "paid", "cancelled"];

  it("receipt: draft → approved | cancelled, approved → cancelled only", () => {
    expect(getAllowedVoucherTransitions("receipt", "draft")).toEqual(["approved", "cancelled"]);
    expect(getAllowedVoucherTransitions("receipt", "approved")).toEqual(["cancelled"]);
    expect(canTransitionVoucher("receipt", "approved", "paid")).toBe(false);
    expect(canTransitionVoucher("receipt", "draft", "paid")).toBe(false);
  });

  it("payment: draft → approved | cancelled, approved → paid | cancelled", () => {
    expect(getAllowedVoucherTransitions("payment", "draft")).toEqual(["approved", "cancelled"]);
    expect(getAllowedVoucherTransitions("payment", "approved")).toEqual(["paid", "cancelled"]);
    expect(canTransitionVoucher("payment", "draft", "paid")).toBe(false);
    expect(canTransitionVoucher("payment", "paid", "cancelled")).toBe(false);
  });

  it("paid and cancelled are final and nothing returns to draft", () => {
    for (const type of ["receipt", "payment"] as const) {
      for (const from of statuses) expect(canTransitionVoucher(type, from, "draft")).toBe(false);
      expect(getAllowedVoucherTransitions(type, "cancelled")).toEqual([]);
      expect(getAllowedVoucherTransitions(type, "paid")).toEqual([]);
    }
  });

  it("only approved and paid vouchers are signed", () => {
    expect(isVoucherSigned("approved")).toBe(true);
    expect(isVoucherSigned("paid")).toBe(true);
    expect(isVoucherSigned("draft")).toBe(false);
    expect(isVoucherSigned("cancelled")).toBe(false);
    expect(isVoucherSigned(undefined)).toBe(false);
  });
});

describe("ترقيم السندات", () => {
  it("formats per type and year with four digits", () => {
    expect(nextVoucherNumber("receipt", 2026, 0)).toBe("RV-2026-0001");
    expect(nextVoucherNumber("receipt", 2026, null)).toBe("RV-2026-0001");
    expect(nextVoucherNumber("payment", 2026, 41)).toBe("PV-2026-0042");
    expect(nextVoucherNumber("payment", 2027, "9999")).toBe("PV-2027-10000");
  });

  it("continues after legacy three-digit numbers", () => {
    expect(parseVoucherSequence("RV-2026-010")).toBe(10);
    expect(parseVoucherSequence("garbage")).toBe(0);
    const max = maxVoucherSequence(["RV-2026-001", "RV-2026-012", "RV-2026-0009", null, undefined]);
    expect(max).toBe(12);
    expect(nextVoucherNumber("receipt", 2026, max)).toBe("RV-2026-0013");
  });

  it("takes the year from the voucher date in Riyadh time", () => {
    expect(voucherYear("2026-01-05")).toBe(2026);
    // 31 ديسمبر 22:30 بتوقيت UTC = 1 يناير في الرياض
    expect(toVoucherDateString(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
    expect(toVoucherDateString("2026-10-30")).toBe("2026-10-30");
    expect(toVoucherDateString("")).toBeNull();
  });
});

describe("خدمة السندات - الصلاحيات والتحقق", () => {
  const supervisor = { id: 5, name: "مشرف", role: "supervisor", branchId: 3 };
  const manager = { id: 2, name: "مدير", role: "manager", branchId: null };

  it("only admin and manager approve; supervisors are scoped to their branch", () => {
    expect(isVoucherApprover("admin")).toBe(true);
    expect(isVoucherApprover("manager")).toBe(true);
    expect(isVoucherApprover("supervisor")).toBe(false);
    expect(isVoucherApprover("employee")).toBe(false);
    expect(canCreateVoucher("supervisor")).toBe(true);
    expect(canCreateVoucher("employee")).toBe(false);
    expect(canCreateVoucher("viewer")).toBe(false);
    expect(scopedBranchId(supervisor)).toBe(3);
    expect(scopedBranchId({ role: "admin", branchId: 3 })).toBeNull();
    expect(scopedBranchId(manager)).toBeNull();
  });

  it("rejects status changes by supervisors before touching the database", async () => {
    await expect(updateVoucherStatus("RV-2026-0001", "approved", supervisor)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates totals and the payment split before touching the database", async () => {
    const base = { items: [{ description: "x", quantity: 1, unitPrice: 100 }] };
    await expect(createVoucher("payment", { ...base, partyName: "مورد", cashAmount: 40, bankAmount: 50 }, manager))
      .rejects.toThrow("لا يساوي إجمالي السند");
    await expect(createVoucher("receipt", { items: [] }, manager)).rejects.toBeInstanceOf(VoucherError);
    await expect(createVoucher("receipt", base, { ...supervisor, role: "employee" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createVoucher("payment", { ...base, checkAmount: 100 }, manager)).rejects.toThrow("رقم الشيك");
  });

  it("detects duplicate key errors, including wrapped driver errors", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isDuplicateKeyError({ errno: 1062 })).toBe(true);
    expect(isDuplicateKeyError({ cause: { code: "ER_DUP_ENTRY", errno: 1062 } })).toBe(true);
    expect(isDuplicateKeyError(new Error("other"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});

describe("توليد السند على الخادم (الصور المضمّنة)", () => {
  it("embeds existing public images as data URIs and ignores missing ones", () => {
    expect(readPublicAssetAsDataUri(SIGNATURES.stamp.image)).toMatch(/^data:image\/png;base64,/);
    expect(readPublicAssetAsDataUri("/signatures/does-not-exist.png")).toBeUndefined();
    expect(readPublicAssetAsDataUri("/../package.json")).toBeUndefined();
    expect(readPublicAssetAsDataUri("/signatures/company_stamp.png", ["/nonexistent-dir"])).toBeUndefined();
  });

  it("loads all voucher assets", () => {
    const assets = loadVoucherAssets({ includeFont: false });
    expect(assets.stamp).toMatch(/^data:image\//);
    expect(assets.supervisorSignature).toMatch(/^data:image\//);
    expect(assets.managerSignature).toMatch(/^data:image\//);
    expect(assets.logo).toMatch(/^data:image\//);
    expect(assets.font).toBeUndefined();
  });

  it("renders embedded images only once approved", () => {
    const stamp = loadVoucherAssets().stamp as string;
    expect(renderVoucherHtmlEmbedded(voucher({ status: "approved" }))).toContain(stamp);
    expect(renderVoucherHtmlEmbedded(voucher({ status: "draft" }))).not.toContain(stamp);
  });

  it("builds safe file names", () => {
    expect(voucherFileName({ voucherId: "PV-2026-0001", voucherType: "payment" }, "pdf")).toBe("payment-voucher-PV-2026-0001.pdf");
    expect(voucherFileName({ voucherId: "../RV 1", voucherType: "receipt" }, "html")).toBe("receipt-voucher-___RV_1.html");
  });
});

describe("بريد السند", () => {
  it("escapes user text and shows amount in words", () => {
    const html = buildVoucherEmailHtml(voucher({ partyName: "<b>x</b>", description: "<script>1</script>" }), "<i>intro</i>");
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<i>intro</i>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("فقط ألفان ريال سعودي لا غير");
    expect(html).toContain("بانتظار اعتماد الإدارة");
  });
});
