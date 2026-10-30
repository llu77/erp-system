import { describe, expect, it, vi } from "vitest";

// توليد PDF يحتاج متصفحاً: نستبدل خطوة التحويل فقط ونُبقي تحميل الصور الحقيقي
vi.mock("./voucherPdf", async importOriginal => {
  const actual = await importOriginal<typeof import("./voucherPdf")>();
  return { ...actual, renderHtmlToPdf: vi.fn(async (html: string) => Buffer.from(html, "utf8")) };
});

import { COMPANY_INFO, SIGNATURES } from "../shared/branding";
import {
  calculateEndOfServiceSettlement,
  type EndOfServiceCalcInput,
  type EndOfServiceDocumentData,
} from "../shared/endOfService";
import {
  arabicWeekdayName,
  renderEndOfServiceDocumentHtml,
  renderEndOfServiceLetterHtml,
  renderFinalSettlementHtml,
  type EndOfServiceTemplateOptions,
} from "../shared/endOfServiceTemplate";
import { formatVoucherAmount } from "../shared/vouchers";
import {
  PRINT_FONT_PATH,
  autoPrintScript,
  bilingualHtml,
  printFontFaceCss,
  renderVoucherHtml,
  resolveVoucherAssets,
  type VoucherTemplateData,
} from "../shared/voucherTemplate";
import { endOfServiceFileName, generateEndOfServicePDF, renderEndOfServiceHtmlEmbedded } from "./endOfServicePdf";
import { loadVoucherAssets, renderHtmlToPdf } from "./voucherPdf";

const ASSETS = {
  logo: "data:image/png;base64,LOGO",
  supervisorSignature: "data:image/png;base64,SUPERVISOR_SIG",
  managerSignature: "data:image/png;base64,MANAGER_SIG",
  stamp: "data:image/png;base64,COMPANY_STAMP",
};
const PRINTED_AT = new Date("2026-10-30T09:00:00Z");

const BASE_INPUT: EndOfServiceCalcInput = {
  hireDate: "2019-03-10",
  lastWorkingDay: "2026-10-31",
  baseSalary: 4500,
  fixedAllowances: 1250,
  annualLeaveDaysTaken: 96,
  lastPayrollMonth: { year: 2026, month: 9 },
  otherAdditions: 300,
  otherDeductions: 200,
  advances: [
    { id: 1, label: "سلفة طلب رقم REQ-2026-0142", amount: 1500, date: "2026-08-12" },
    { id: 2, label: "سلفة طلب رقم REQ-2026-0201", amount: 750, date: "2026-09-20" },
  ],
  violations: [{ id: 7, label: "تأخر عن الدوام", amount: 150, date: "2026-10-05" }],
};

function calc(overrides: Partial<EndOfServiceCalcInput> = {}) {
  const r = calculateEndOfServiceSettlement({ ...BASE_INPUT, ...overrides });
  if (!r.ok) throw new Error(r.error);
  return r.calculation;
}

function doc(overrides: Partial<EndOfServiceDocumentData> = {}, input: Partial<EndOfServiceCalcInput> = {}): EndOfServiceDocumentData {
  const merged = { ...BASE_INPUT, ...input };
  return {
    settlementNumber: "EOS-2026-0007",
    status: "draft",
    reason: "contract_expiry",
    letterDate: "2026-10-01",
    employeeName: "محمد عبدالله القحطاني",
    employeeCode: "EMP-0042",
    nationality: "سعودي",
    idNumber: "1087654321",
    position: "مشرف صالون أول",
    branchName: "فرع العليا",
    hireDate: merged.hireDate,
    contractEndDate: "2026-10-31",
    lastWorkingDay: merged.lastWorkingDay,
    baseSalary: merged.baseSalary,
    fixedAllowances: merged.fixedAllowances,
    calculation: calc(input),
    advances: merged.advances,
    violations: merged.violations,
    otherAdditionsNote: "بدل تذاكر سفر",
    otherDeductionsNote: "عهدة غير مسلمة",
    createdByName: "أحمد المحاسب",
    createdAt: "2026-10-01T07:30:00Z",
    ...overrides,
  };
}

const opts = (extra: EndOfServiceTemplateOptions = {}): EndOfServiceTemplateOptions => ({ assets: ASSETS, printedAt: PRINTED_AT, ...extra });
const letter = (d: EndOfServiceDocumentData, extra?: EndOfServiceTemplateOptions) => renderEndOfServiceLetterHtml(d, opts(extra));
const settlement = (d: EndOfServiceDocumentData, extra?: EndOfServiceTemplateOptions) => renderFinalSettlementHtml(d, opts(extra));

/** النص المرئي لمطابقة الجمل الكاملة: الوسوم الكتلية فواصل، والوسوم السطرية تُحذف دون مسافة */
function visibleText(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/g, " ")
    .replace(/<\/?(?:div|p|li|ol|td|th|tr|table|thead|tbody|tfoot|section|header|footer|main|h1|h2|br|img)\b[^>]*>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

describe("arabicWeekdayName", () => {
  it("names the weekday of a YYYY-MM-DD date", () => {
    expect(arabicWeekdayName("2026-10-31")).toBe("السبت");
    expect(arabicWeekdayName("2026-10-30")).toBe("الجمعة");
    expect(arabicWeekdayName("2024-02-29")).toBe("الخميس");
    expect(arabicWeekdayName("2026-11-01")).toBe("الأحد");
  });

  it("returns null for invalid dates", () => {
    expect(arabicWeekdayName("2026-02-30")).toBeNull();
    expect(arabicWeekdayName("")).toBeNull();
    expect(arabicWeekdayName(null)).toBeNull();
  });
});

describe("خطاب انتهاء العقد وعدم التجديد", () => {
  const d = doc({ status: "approved", approvedByName: "عمر المطيري", approvedAt: "2026-10-02T09:15:00Z" });
  const html = letter(d);
  const text = visibleText(html);

  it("is an RTL Arabic A4 page with the letterhead and title", () => {
    expect(html).toContain('<html dir="rtl" lang="ar">');
    expect(html).toContain("size: A4");
    expect(html).toContain("إشعار انتهاء عقد العمل وعدم التجديد");
    expect(html).toContain("NOTICE OF CONTRACT EXPIRY AND NON-RENEWAL");
    expect(html).toContain(COMPANY_INFO.nameAr);
    expect(html).toContain(COMPANY_INFO.name);
    expect(html).toContain(ASSETS.logo);
  });

  it("fills the reference line and the employee details", () => {
    expect(text).toContain("الرقم: EOS-2026-0007");
    expect(text).toContain("التاريخ: 01/10/2026م");
    expect(text).toContain("المكرم / محمد عبدالله القحطاني المحترم");
    for (const value of ["EMP-0042", "سعودي", "1087654321", "مشرف صالون أول", "فرع العليا"]) expect(text).toContain(value);
    expect(text).toContain("رقم الهوية / الإقامة");
  });

  it("contains the fixed text with the employee's dates, service period and weekday", () => {
    expect(text).toContain("السلام عليكم ورحمة الله وبركاته، وبعد:");
    expect(text).toContain("الموضوع: إشعار بانتهاء عقد العمل وعدم تجديده");
    expect(text).toContain(
      `تود ${COMPANY_INFO.nameAr} إحاطتكم علماً بأن عقد العمل المبرم معكم، والذي بدأ اعتباراً من تاريخ 10/03/2019م، تنتهي مدته بتاريخ 31/10/2026م، وقد قررت المنشأة عدم تجديده بعد انتهاء مدته، وذلك وفقاً لأحكام نظام العمل في المملكة العربية السعودية ولائحته التنفيذية.`
    );
    expect(text).toContain(
      "وبناءً عليه، يكون آخر يوم عمل لكم لدى المنشأة هو يوم السبت الموافق 31/10/2026م، وتنتهي العلاقة التعاقدية بانتهاء هذا اليوم."
    );
    expect(text).toContain(`مكافأة نهاية الخدمة عن كامل مدة خدمتكم البالغة (${d.calculation.serviceText})`);
    expect(d.calculation.serviceText).toBe("7 سنوات و7 أشهر و22 يوماً");
    expect(text).toContain("وذلك وفق المخالصة النهائية المرفقة وخلال المدة المحددة نظاماً.");
    expect(text).toContain("ونأمل منكم التكرم بما يلي قبل آخر يوم عمل:");
    expect(text).toContain("تسليم جميع العُهد والممتلكات الخاصة بالمنشأة (الأجهزة، المفاتيح، البطاقات، المستندات) إلى الإدارة.");
    expect(text).toContain("استكمال إجراءات إخلاء الطرف مع الإدارة المختصة.");
    expect(text).toContain("تسليم ما لديكم من أعمال ومهام قائمة إلى من تحدده الإدارة.");
    expect(text).toContain("ويحق لكم الحصول على شهادة خدمة توضح مدة عملكم ومهنتكم وآخر أجر تقاضيتموه، وذلك عند طلبها.");
    expect(text).toContain("وتتقدم إدارة المنشأة لكم بخالص الشكر والتقدير على ما بذلتموه من جهود خلال فترة عملكم، متمنين لكم دوام التوفيق والنجاح.");
    expect(text).toContain("وتقبلوا خالص التحية والتقدير،،");
  });

  it("has both signature blocks and the employee's acknowledgment", () => {
    expect(text).toContain(SIGNATURES.manager.title);
    expect(text).toContain(SIGNATURES.manager.name);
    expect(text).toContain(SIGNATURES.supervisor.title);
    expect(text).toContain(SIGNATURES.supervisor.name);
    expect(text).toContain("إقرار استلام: أقر أنا الموقع أدناه بأنني استلمت أصل هذا الإشعار وعلمت بما ورد فيه.");
    expect(text).toMatch(/الاسم: محمد عبدالله القحطاني التوقيع: التاريخ:/);
  });

  it("hides empty employee details and drops the weekday for an invalid date", () => {
    const html2 = letter(doc({ nationality: null, idNumber: "  ", position: "", branchName: undefined, lastWorkingDay: "2026-13-01" }));
    const text2 = visibleText(html2);
    expect(text2).toContain("الرقم الوظيفي EMP-0042");
    expect(text2).not.toContain("الجنسية");
    expect(text2).not.toContain("رقم الهوية / الإقامة");
    expect(text2).not.toContain("المسمى الوظيفي");
    expect(text2).not.toContain("الفرع");
    expect(text2).toContain("يكون آخر يوم عمل لكم لدى المنشأة هو -، وتنتهي");
  });

  it("does not print the settlement figures or calculation warnings", () => {
    expect(html).not.toContain(formatVoucherAmount(d.calculation.netAmount));
    for (const warning of calc({ annualLeaveDaysTaken: 0, lastPayrollMonth: { year: 2026, month: 10 } }).warnings) {
      expect(html).not.toContain(warning);
    }
  });
});

describe("المخالصة النهائية", () => {
  const d = doc({ status: "approved", approvedByName: "عمر المطيري", approvedAt: "2026-10-02T09:15:00Z" });
  const c = d.calculation;
  const html = settlement(d);
  const text = visibleText(html);

  it("is an RTL Arabic page with number, date and status badge", () => {
    expect(html).toContain('<html dir="rtl" lang="ar">');
    expect(html).toContain("مخالصة نهائية وإبراء ذمة");
    expect(html).toContain("FINAL SETTLEMENT AND RELEASE");
    expect(html).toContain("EOS-2026-0007");
    expect(html).toContain("01/10/2026");
    expect(html).toMatch(/class="status-badge status-approved">معتمد</);
  });

  it("lists the employee details and the service period", () => {
    for (const value of [
      "محمد عبدالله القحطاني", "EMP-0042", "سعودي", "1087654321", "مشرف صالون أول", "فرع العليا",
      "10/03/2019", "31/10/2026", "انتهاء مدة العقد وعدم التجديد",
    ]) {
      expect(text).toContain(value);
    }
    expect(text).toContain(`${c.serviceText} (${c.service.totalDays} يوماً)`);
  });

  it("shows the calculation basis", () => {
    expect(text).toContain("الأجر الأساسي 4,500.00");
    expect(text).toContain("البدلات الثابتة 1,250.00");
    expect(text).toContain("الأجر الشهري المعتمد 5,750.00");
    expect(text).toContain(`أجر اليوم (الأجر ÷ 30) ${formatVoucherAmount(c.dailyWage)}`);
  });

  it("explains each entitlement and totals them", () => {
    expect(text).toContain("مكافأة نهاية الخدمة (المادة 84 من نظام العمل)");
    expect(text).toContain("نصف أجر شهر × 5.000 سنة");
    expect(text).toContain(`أجر شهر × ${(c.service.yearsDecimal - 5).toFixed(3)} سنة`);
    expect(text).toContain(formatVoucherAmount(c.eosAward));
    expect(text).toContain("مقابل الإجازة السنوية غير المستخدمة (المادة 111)");
    expect(text).toContain(`${String(c.leaveBalanceDays)} يوم × ${formatVoucherAmount(c.dailyWage)}`);
    expect(text).toContain(`(المستحق ${c.accruedLeaveDays} − المستخدم 96)`);
    expect(text).toContain("الأجر المستحق حتى آخر يوم عمل");
    expect(text).toContain(`30 يوم × ${formatVoucherAmount(c.dailyWage)}`);
    expect(text).toContain("من 01/10/2026 حتى 31/10/2026");
    expect(text).toContain("مستحقات أخرى بدل تذاكر سفر 300.00");
    expect(text).toContain(`إجمالي المستحقات ${formatVoucherAmount(c.totalEntitlements)}`);
  });

  it("lists every deduction and totals them", () => {
    expect(text).toContain("سلفة سلفة طلب رقم REQ-2026-0142 12/08/2026 1,500.00");
    expect(text).toContain("سلفة سلفة طلب رقم REQ-2026-0201 20/09/2026 750.00");
    expect(text).toContain("مخالفة تأخر عن الدوام 05/10/2026 150.00");
    expect(text).toContain("خصومات أخرى عهدة غير مسلمة 200.00");
    expect(text).toContain(`إجمالي الخصومات ${formatVoucherAmount(c.totalDeductions)}`);
    expect(text).not.toContain("لا توجد خصومات");
  });

  it("shows the net amount in figures and words with the release declaration", () => {
    expect(c.netAmount).toBeGreaterThan(0);
    expect(text).toContain("صافي المستحق للموظف");
    expect(text).not.toContain("على الموظف");
    expect(text).toContain(formatVoucherAmount(c.netAmount));
    expect(text).toContain(c.netAmountWords);
    expect(text).toContain(
      `أقر أنا الموقع أدناه / محمد عبدالله القحطاني، رقم الهوية / الإقامة (1087654321)، بأنني استلمت من ${COMPANY_INFO.nameAr} كامل مستحقاتي العمالية عن كامل مدة خدمتي لديها من تاريخ 10/03/2019م حتى تاريخ 31/10/2026م، بما في ذلك مكافأة نهاية الخدمة ومقابل الإجازات والأجور وجميع البدلات، بمبلغ صافٍ وقدره (${formatVoucherAmount(c.netAmount)} ريال سعودي) ${c.netAmountWords}، وأنه لم يعد لي أي حق أو مطالبة من أي نوع قِبَل المنشأة، وأبرئ ذمتها إبراءً عاماً شاملاً نهائياً.`
    );
  });

  it("has the preparer, supervisor, manager and employee signature areas", () => {
    expect(text).toContain("أعدّه");
    expect(text).toContain("أحمد المحاسب");
    expect(text).toContain(SIGNATURES.supervisor.title);
    expect(text).toContain(SIGNATURES.manager.title);
    expect(text).toContain("اسم الموظف: محمد عبدالله القحطاني");
    expect(text).toContain("البصمة");
    expect(text).toContain("اعتُمدت بواسطة عمر المطيري");
  });

  it("shows one 'no deductions' row and hides optional rows when they are zero", () => {
    const d2 = doc({}, { advances: [], violations: [], otherDeductions: 0, otherAdditions: 0 });
    const t2 = visibleText(settlement(d2));
    expect(t2).toContain("لا توجد خصومات");
    expect(t2).toContain("إجمالي الخصومات 0.00");
    expect(t2).not.toContain("خصومات أخرى");
    expect(t2).not.toContain("مستحقات أخرى");
  });

  it("omits the after-five-years line for shorter service", () => {
    const d2 = doc({}, { hireDate: "2023-11-01" });
    const t2 = visibleText(settlement(d2));
    expect(t2).toContain("نصف أجر شهر × 3.000 سنة");
    expect(t2).not.toContain("أجر شهر × 0");
  });

  it("explains manual leave and salary figures with their notes", () => {
    const d2 = doc(
      { leaveNote: "حسب سجل الموارد البشرية", salaryNote: "أيام عمل فعلية" },
      { leaveBalanceDaysOverride: 12.5, salaryDaysOverride: 18 }
    );
    const t2 = visibleText(settlement(d2));
    expect(t2).toContain(`12.5 يوم × ${formatVoucherAmount(d2.calculation.dailyWage)}`);
    expect(t2).toContain("(رصيد معتمد يدوياً: حسب سجل الموارد البشرية)");
    expect(t2).not.toContain("(المستحق");
    expect(t2).toContain(`18 يوم × ${formatVoucherAmount(d2.calculation.dailyWage)}`);
    expect(t2).toContain("(أيام عمل فعلية)");
  });

  it("uses the 'owed by the employee' wording when deductions exceed entitlements", () => {
    const d2 = doc({ status: "approved", idNumber: null }, { otherDeductions: 90000 });
    expect(d2.calculation.netAmount).toBeLessThan(0);
    const t2 = visibleText(settlement(d2));
    expect(t2).toContain("صافي المستحق على الموظف");
    expect(t2).not.toContain("صافي المستحق للموظف");
    expect(t2).toContain(formatVoucherAmount(Math.abs(d2.calculation.netAmount)));
    expect(t2).not.toContain(`-${formatVoucherAmount(Math.abs(d2.calculation.netAmount))}`);
    expect(t2).toContain(
      `أقر أنا الموقع أدناه / محمد عبدالله القحطاني، بأن ذمتي مشغولة للمنشأة بمبلغ وقدره (${formatVoucherAmount(Math.abs(d2.calculation.netAmount))} ريال سعودي) ${d2.calculation.netAmountWords} بعد تسوية جميع مستحقاتي، وأتعهد بسداده.`
    );
    expect(t2).not.toContain("وأبرئ ذمتها");
    expect(t2).not.toContain("رقم الهوية / الإقامة (");
  });

  it("prints the payment method and reference only once paid", () => {
    const paid = visibleText(settlement(doc({ status: "paid", paymentMethod: "bank_transfer", paymentReference: "TRX-998", paidAt: "2026-11-03T10:00:00Z" })));
    expect(paid).toContain("طريقة الصرف: تحويل بنكي");
    expect(paid).toContain("المرجع: TRX-998");
    expect(paid).toContain("تم الصرف");
    expect(text).not.toContain("طريقة الصرف");
  });

  it("never prints calculation warnings", () => {
    const d2 = doc({}, { annualLeaveDaysTaken: 0, lastPayrollMonth: { year: 2026, month: 10 }, otherDeductions: 90000 });
    expect(d2.calculation.warnings.length).toBe(3);
    const html2 = settlement(d2) + letter(d2);
    for (const warning of d2.calculation.warnings) expect(html2).not.toContain(warning);
  });
});

describe("التوقيعات والختم والعلامة المائية حسب الحالة", () => {
  const kinds = [
    ["letter", letter],
    ["settlement", settlement],
  ] as const;

  for (const [kind, render] of kinds) {
    it(`${kind}: draft shows pending areas and the draft watermark, without signatures or stamp`, () => {
      const html = render(doc({ status: "draft" }));
      expect(html).not.toContain(ASSETS.managerSignature);
      expect(html).not.toContain(ASSETS.supervisorSignature);
      expect(html).not.toContain(ASSETS.stamp);
      expect(html).toContain("مسودة - غير معتمدة");
      expect(html).toContain("بانتظار الاعتماد");
      expect(html).not.toContain("ملغاة");
    });

    for (const status of ["approved", "paid"]) {
      it(`${kind}: ${status} shows both signatures and the stamp without a watermark`, () => {
        const html = render(doc({ status }));
        expect(html).toContain(ASSETS.managerSignature);
        expect(html).toContain(ASSETS.supervisorSignature);
        expect(html).toContain(ASSETS.stamp);
        expect(html).not.toContain("مسودة - غير معتمدة");
        expect(html).not.toContain("بانتظار الاعتماد");
        expect(html).not.toContain('class="watermark');
      });
    }

    it(`${kind}: cancelled shows the cancelled watermark and the reason, without signatures`, () => {
      const html = render(doc({ status: "cancelled", cancellationReason: "تم تجديد العقد", cancelledByName: "عمر المطيري" }));
      expect(html).toContain('<div class="watermark cancelled">ملغاة</div>');
      expect(visibleText(html)).toContain("سبب الإلغاء: تم تجديد العقد");
      expect(html).toContain("عمر المطيري");
      expect(html).not.toContain(ASSETS.managerSignature);
      expect(html).not.toContain(ASSETS.stamp);
      expect(html).not.toContain("مسودة - غير معتمدة");
    });

    it(`${kind}: resolves default asset paths, signing only after approval`, () => {
      const base = "https://erp.example.com/";
      const draft = renderEndOfServiceDocumentHtml(kind, doc({ status: "draft" }), { assetBaseUrl: base });
      const approved = renderEndOfServiceDocumentHtml(kind, doc({ status: "approved" }), { assetBaseUrl: base });
      expect(draft).not.toContain(SIGNATURES.manager.image);
      expect(draft).not.toContain(SIGNATURES.supervisor.image);
      expect(draft).not.toContain(SIGNATURES.stamp.image);
      expect(approved).toContain(`https://erp.example.com${SIGNATURES.manager.image}`);
      expect(approved).toContain(`https://erp.example.com${SIGNATURES.supervisor.image}`);
      expect(approved).toContain(`https://erp.example.com${SIGNATURES.stamp.image}`);
      expect(approved).toContain(`https://erp.example.com${COMPANY_INFO.logo}`);
      // الخط يُعرّف بوزن عادي حتى يظهر الخط العريض العربي
      expect(approved).toContain(printFontFaceCss(`https://erp.example.com${PRINT_FONT_PATH}`, "EosArabic", "normal"));
    });
  }
});

describe("التهريب وبيانات الشركة", () => {
  const evil = "<script>alert(1)</script>";
  const evilImg = '<img src=x onerror="alert(2)">';
  const d = doc({
    status: "paid",
    employeeName: `أحمد ${evil}`,
    employeeCode: evilImg,
    nationality: evil,
    idNumber: evil,
    position: evil,
    branchName: evil,
    notes: `ملاحظة ${evil}`,
    otherAdditionsNote: evilImg,
    otherDeductionsNote: evilImg,
    leaveNote: evil,
    salaryNote: evil,
    paymentMethod: evil,
    paymentReference: evilImg,
    createdByName: evil,
    approvedByName: evil,
    paidByName: evil,
    settlementNumber: `EOS-2026-0001${evil}`,
    advances: [{ id: 1, label: evil, amount: 10, date: "2026-01-01" }],
    violations: [{ id: 2, label: evilImg, amount: 10 }],
  });

  for (const [kind, html] of [
    ["letter", letter(d)],
    ["settlement", settlement(d)],
    ["cancelled settlement", settlement({ ...d, status: "cancelled", cancellationReason: evil, cancelledByName: evilImg })],
  ] as const) {
    it(`${kind}: escapes every user-provided value`, () => {
      expect(html).not.toContain("<script");
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });
  }

  it("prints user notes on the settlement (escaped)", () => {
    expect(visibleText(settlement(d))).toContain("ملاحظات: ملاحظة &lt;script&gt;");
  });

  it("hides placeholder company values and shows real ones", () => {
    for (const html of [letter(doc()), settlement(doc())]) {
      expect(html).not.toMatch(/X{4,}/);
      expect(html).toContain(COMPANY_INFO.address);
      expect(html).toContain(COMPANY_INFO.email);
      expect(html).toContain(COMPANY_INFO.subtitle);
    }
    const company = { phone: "+966 11 222 3333", cr: "س.ت: 1010101010", vat: "الرقم الضريبي: 300000000000003", email: "XXXX@example.com" };
    for (const html of [letter(doc(), { company }), settlement(doc(), { company })]) {
      expect(html).toContain("+966 11 222 3333");
      expect(html).toContain("س.ت: 1010101010");
      expect(html).toContain("الرقم الضريبي: 300000000000003");
      expect(html).not.toContain("XXXX@example.com");
    }
  });

  it("uses an overridden company name in the letter text and the declaration", () => {
    const company = { nameAr: "مؤسسة الاختبار", name: "Test Co" };
    expect(visibleText(letter(doc(), { company }))).toContain("تود مؤسسة الاختبار إحاطتكم علماً");
    expect(visibleText(settlement(doc(), { company }))).toContain("بأنني استلمت من مؤسسة الاختبار كامل مستحقاتي");
  });
});

describe("خيارات المستند", () => {
  it("dispatches on the document kind", () => {
    const d = doc();
    expect(renderEndOfServiceDocumentHtml("letter", d, opts())).toBe(letter(d));
    expect(renderEndOfServiceDocumentHtml("settlement", d, opts())).toBe(settlement(d));
  });

  it("adds the auto-print script only on request", () => {
    expect(letter(doc(), { autoPrint: true })).toContain("window.print()");
    expect(settlement(doc(), { autoPrint: true })).toContain("window.print()");
    expect(letter(doc())).not.toContain("<script");
  });

  it("prints the document number and print time in the footer", () => {
    for (const html of [letter(doc()), settlement(doc())]) {
      const text = visibleText(html);
      expect(text).toContain("رقم المستند: EOS-2026-0007");
      expect(text).toContain("تاريخ الطباعة: 30/10/2026 12:00");
    }
  });
});

describe("توليد PDF لإنهاء الخدمة على الخادم", () => {
  it("embeds the real images and signs only after approval", () => {
    const stamp = loadVoucherAssets().stamp as string;
    expect(stamp).toMatch(/^data:image\//);
    expect(renderEndOfServiceHtmlEmbedded(doc({ status: "approved" }), "letter")).toContain(stamp);
    expect(renderEndOfServiceHtmlEmbedded(doc({ status: "paid" }), "settlement")).toContain(stamp);
    expect(renderEndOfServiceHtmlEmbedded(doc({ status: "draft" }), "letter")).not.toContain(stamp);
    expect(renderEndOfServiceHtmlEmbedded(doc({ status: "draft" }), "settlement")).not.toContain(stamp);
  });

  it("renders the requested document through the shared PDF renderer", async () => {
    const letterPdf = (await generateEndOfServicePDF(doc({ status: "approved" }), "letter")).toString("utf8");
    const settlementPdf = (await generateEndOfServicePDF(doc({ status: "approved" }), "settlement")).toString("utf8");
    expect(vi.mocked(renderHtmlToPdf)).toHaveBeenCalledTimes(2);
    expect(letterPdf).toContain("إشعار انتهاء عقد العمل وعدم التجديد");
    expect(letterPdf).toContain(loadVoucherAssets().managerSignature as string);
    expect(settlementPdf).toContain("مخالصة نهائية وإبراء ذمة");
    expect(settlementPdf).toContain("صافي المستحق للموظف");
  });

  it("builds safe file names", () => {
    expect(endOfServiceFileName({ settlementNumber: "EOS-2026-0001" }, "letter")).toBe("end-of-service-letter-EOS-2026-0001.pdf");
    expect(endOfServiceFileName({ settlementNumber: "../EOS 1" }, "settlement")).toBe("final-settlement-___EOS_1.pdf");
  });
});

describe("قالب السندات بعد مشاركة الأدوات المساعدة", () => {
  const voucher: VoucherTemplateData = {
    voucherType: "receipt",
    voucherId: "RV-2026-0001",
    voucherDate: "2026-10-30",
    status: "approved",
    partyName: "فرع العليا",
    totalAmount: "2000.00",
    paymentMethod: "cash",
    cashAmount: "2000.00",
    createdByName: "أحمد",
  };

  it("keeps the voucher's assets, bilingual labels and print script, with a regular-weight font face", () => {
    const html = renderVoucherHtml(voucher, { assetBaseUrl: "https://erp.example.com/", autoPrint: true, printedAt: PRINTED_AT });
    // الخط ملف عادي واحد: يُعلن بوزن عادي حتى يُركّب المتصفح الخط العريض (لا يظهر العريض مع "100 900")
    expect(html).toContain(
      "@font-face { font-family: 'VoucherArabic'; src: url('https://erp.example.com/fonts/NotoSansArabic-Regular.ttf') format('truetype'); font-weight: normal; }"
    );
    expect(html).toContain('src="https://erp.example.com/signatures/company_stamp.png"');
    expect(html).toContain('src="https://erp.example.com/signatures/manager_signature.png"');
    expect(html).toContain('<span class="ar">التاريخ</span><span class="sep"> / </span><span class="en">Date</span>');
    expect(html).toContain(bilingualHtml("التاريخ", "Date"));
    expect(html).toContain(autoPrintScript());
    expect(renderVoucherHtml(voucher, { printedAt: PRINTED_AT })).not.toContain("@font-face");
  });

  it("resolves explicit assets before public paths", () => {
    expect(resolveVoucherAssets({ assets: { stamp: "S" } })).toEqual({
      logo: COMPANY_INFO.logo,
      supervisorSignature: SIGNATURES.supervisor.image,
      managerSignature: SIGNATURES.manager.image,
      stamp: "S",
      font: undefined,
    });
    expect(resolveVoucherAssets({ assetBaseUrl: "https://x.test" }).font).toBe(`https://x.test${PRINT_FONT_PATH}`);
    expect(printFontFaceCss(undefined)).toBe("");
    expect(printFontFaceCss("a'b")).toContain("url('a%27b')");
  });
});
