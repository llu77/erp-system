import { describe, expect, it } from "vitest";
import {
  ESTABLISHMENTS,
  GROUP_ESTABLISHMENT,
  SIGNATURES,
} from "../shared/branding";
import {
  buildPayslipDocumentData,
  isPayslipSigned,
  renderPayslipHtml,
  type PayslipDetailSource,
  type PayslipPayrollSource,
} from "../shared/payslipTemplate";
import { daysText } from "../shared/employeeDocumentBase";

const ASSETS = {
  logo: "",
  supervisorSignature: "data:image/png;base64,SUPERVISOR",
  managerSignature: "data:image/png;base64,MANAGER",
  stamp: "data:image/png;base64,STAMP",
};
const PRINTED_AT = new Date("2026-10-30T09:00:00Z");

function payroll(
  over: Partial<PayslipPayrollSource> = {}
): PayslipPayrollSource {
  return {
    id: 12,
    payrollNumber: "PAY-2026-10-0003",
    branchId: 1,
    branchName: "فرع لبن",
    year: 2026,
    month: 10,
    periodStart: new Date("2026-09-30T21:00:00Z"),
    periodEnd: new Date("2026-10-31T20:59:59Z"),
    status: "approved",
    createdByName: "أحمد المحاسب",
    createdAt: new Date("2026-10-28T08:00:00Z"),
    approvedByName: "عمر المطيري",
    approvedAt: new Date("2026-10-29T10:30:00Z"),
    paidAt: null,
    ...over,
  };
}

function detail(over: Partial<PayslipDetailSource> = {}): PayslipDetailSource {
  return {
    employeeId: 7,
    employeeName: "محمد القحطاني",
    employeeCode: "EMP-0007",
    position: "حلاق",
    baseSalary: "2000.00",
    overtimeEnabled: true,
    overtimeAmount: "1000.00",
    incentiveAmount: "400.00",
    isSupervisor: true,
    workDays: 25,
    absentDays: 2,
    absentDeduction: "200.00",
    leaveDays: 3,
    leaveDeduction: "150.00",
    leaveType: "طارئة",
    leaveDetails: JSON.stringify([
      {
        requestId: 1,
        type: "طارئة",
        kind: "emergency",
        days: 3,
        startDate: "2026-10-10",
        endDate: "2026-10-12",
      },
    ]),
    advanceDeduction: "500.00",
    advanceDetails: JSON.stringify({
      items: [
        { id: 3, amount: 300, title: "سلفة شخصية", approvedAt: "2026-10-05" },
        {
          id: 4,
          amount: 200,
          title: "سلفة علاج",
          approvedAt: new Date("2026-10-14T22:30:00Z").toISOString(),
        },
      ],
      deferredIds: [9],
      deferredItems: [{ id: 9, amount: 999, title: "مؤجلة", approvedAt: null }],
    }),
    violationsDeduction: "100.00",
    violationsDetails: JSON.stringify({
      items: [
        {
          id: 9,
          amount: 100,
          violationType: "تأخير",
          violationDate: "2026-10-08",
          description: "ساعتين",
        },
      ],
      deferredIds: [],
    }),
    negativeInvoicesDeduction: "75.50",
    negativeInvoicesDetails: JSON.stringify([
      {
        id: 5,
        invoiceNumber: "INV-1201",
        amount: 75.5,
        reason: "خصم غير مصرح",
        invoiceDate: "2026-10-20",
      },
    ]),
    deductionAmount: "50.00",
    deductionReason: "تلف أدوات",
    grossSalary: "3400.00",
    totalDeductions: "1075.50",
    netSalary: "2324.50",
    notes: null,
    ...over,
  };
}

const EXTRAS = {
  iqamaNumber: "2412345678",
  nationality: "باكستاني",
  hireDate: "2021-03-10",
  bankName: "مصرف الراجحي",
  iban: "SA0380000000608010167519",
};

const render = (p = payroll(), d = detail(), extras = EXTRAS) =>
  renderPayslipHtml(buildPayslipDocumentData(p, d, extras), {
    assets: ASSETS,
    printedAt: PRINTED_AT,
  });

describe("بيانات قسيمة الراتب من سطر المسيرة", () => {
  const data = buildPayslipDocumentData(payroll(), detail(), EXTRAS);

  it("maps the saved snapshot amounts without recalculating", () => {
    expect(data.payrollId).toBe(12);
    expect(data.periodStart).toBe("2026-10-01");
    expect(data.periodEnd).toBe("2026-10-31");
    expect(data.branchName).toBe("فرع لبن");
    expect(data.earnings).toEqual({
      baseSalary: 2000,
      overtimeEnabled: true,
      overtimeAmount: 1000,
      incentiveAmount: 400,
      isSupervisor: true,
    });
    expect(data.deductions).toMatchObject({
      absentDeduction: 200,
      leaveDeduction: 150,
      advanceDeduction: 500,
      violationsDeduction: 100,
      negativeInvoicesDeduction: 75.5,
      otherDeduction: 50,
      otherDeductionReason: "تلف أدوات",
    });
    expect(data.totals).toEqual({
      grossSalary: 3400,
      totalDeductions: 1075.5,
      netSalary: 2324.5,
    });
    expect(data.employee).toMatchObject({
      id: 7,
      code: "EMP-0007",
      iqamaNumber: "2412345678",
      iban: "SA0380000000608010167519",
    });
  });

  it("parses item snapshots: deducted advances only, Riyadh calendar dates, leave amounts by kind", () => {
    expect(data.items.advances).toEqual([
      { label: "سلفة شخصية", amount: 300, date: "2026-10-05", note: null },
      // 22:30Z = اليوم التالي في الرياض
      { label: "سلفة علاج", amount: 200, date: "2026-10-15", note: null },
    ]);
    expect(data.items.violations).toEqual([
      { label: "تأخير", amount: 100, date: "2026-10-08", note: "ساعتين" },
    ]);
    // طارئة: نصف أجر اليوم × 3 = (3000/30) × 0.5 × 3
    expect(data.items.leaves).toEqual([
      expect.objectContaining({
        label: "إجازة طارئة",
        amount: 150,
        date: "2026-10-10",
        endDate: "2026-10-12",
        days: 3,
      }),
    ]);
    expect(data.items.negativeInvoices).toEqual([
      {
        label: "فاتورة INV-1201",
        amount: 75.5,
        date: "2026-10-20",
        note: "خصم غير مصرح",
      },
    ]);
  });

  it("tolerates missing or broken JSON and missing extras", () => {
    const d = buildPayslipDocumentData(
      payroll({ id: undefined, periodStart: null, periodEnd: null }),
      detail({
        advanceDetails: "not json",
        violationsDetails: null,
        leaveDetails: "{}",
        negativeInvoicesDetails: undefined,
      })
    );
    expect(d.payrollId).toBe(0);
    expect(d.items).toEqual({
      advances: [],
      violations: [],
      leaves: [],
      negativeInvoices: [],
    });
    expect(d.employee.iqamaNumber).toBeNull();
    expect(d.employee.bankName).toBeNull();
    expect(d.periodStart).toBeNull();
  });

  it("uses the line paid date before the payroll paid date", () => {
    const d = buildPayslipDocumentData(
      payroll({ status: "paid", paidAt: "2026-10-30T07:00:00Z" }),
      detail({ paidAt: "2026-10-31T07:00:00Z" })
    );
    expect(d.paidAt).toBe("2026-10-31T07:00:00Z");
  });
});

describe("قالب قسيمة الراتب", () => {
  it("is an RTL A4 Arabic payroll statement with title, month and payroll number", () => {
    const html = render();
    expect(html).toContain('<html dir="rtl" lang="ar">');
    expect(html).toContain("size: A4");
    expect(html).toContain("<h1>مسير راتب</h1>");
    expect(html).not.toContain("مسيرة");
    expect(html).toContain("PAYROLL STATEMENT");
    expect(html).not.toContain("قسيمة");
    expect(html).not.toContain("PAYSLIP");
    expect(html).toContain("شهر أكتوبر 2026");
    expect(html).toContain("PAY-2026-10-0003");
    expect(html).toContain("01/10/2026 - 31/10/2026");
    // بدون @import للخطوط من الشبكة
    expect(html).not.toContain("@import");
  });

  it("has no employee acknowledgement (issued by management)", () => {
    for (const status of ["draft", "approved", "paid"]) {
      const html = render(payroll({ status }));
      expect(html).not.toContain("إقرار");
      expect(html).not.toContain("أقر أنا");
      expect(html).not.toContain('class="ack"');
    }
  });

  it("shows the fixed job title saved from the employee account", () => {
    const titleCell = (title: string) =>
      `<div class="lbl">المسمى الوظيفي</div><div class="val">${title}</div>`;
    // المسمى المحفوظ من الحساب يتقدم على علامة إعدادات الراتب (التي تحدد الحافز فقط)
    const supervisorAccount = render(payroll(), detail({ isSupervisor: false, position: "مشرف" }));
    expect(supervisorAccount).toContain(titleCell("مشرف"));
    const barberAccount = render(payroll(), detail({ isSupervisor: true, position: "حلاق" }));
    expect(barberAccount).toContain(titleCell("حلاق"));
    // سطور قديمة بمسمى حر: من علامة المشرف في السطر
    const legacy = render(payroll(), detail({ isSupervisor: false, position: "مدير صالون" }));
    expect(legacy).toContain(titleCell("حلاق"));
    expect(legacy).not.toContain("مدير صالون");
    expect(render(payroll(), detail({ isSupervisor: true, position: null }))).toContain(titleCell("مشرف"));
  });

  it("brands the payslip with the establishment of the payroll branch", () => {
    expect(render()).toContain(ESTABLISHMENTS.qessa.nameAr);
    expect(render(payroll({ branchName: "فرع طويق" }))).toContain(
      ESTABLISHMENTS.tadarruj.nameAr
    );
    const other = render(payroll({ branchName: "فرع غير معروف" }));
    expect(other).toContain(GROUP_ESTABLISHMENT.nameAr);
    for (const html of [render(), other]) {
      expect(html).not.toMatch(/symbol|سيمبول/i);
      expect(html).not.toMatch(/X{4,}/);
      // لا شعار للمؤسسة: بدون وسم صورة
      expect(html).not.toContain('alt="logo"');
    }
  });

  it("shows employee, bank and every deduction item with its date", () => {
    const html = render();
    for (const text of [
      "محمد القحطاني",
      "EMP-0007",
      "2412345678",
      "باكستاني",
      "10/03/2021",
      "مصرف الراجحي",
      "SA0380000000608010167519",
      "سلفة شخصية",
      "05/10/2026",
      "سلفة علاج",
      "تأخير",
      "08/10/2026",
      "INV-1201",
      "خصم غير مصرح",
      "تلف أدوات",
      "إجازة طارئة",
      "من 10/10/2026 إلى 12/10/2026",
      "الإجازات (3 أيام)",
      "3,400.00",
      "-1,075.50",
      "2,324.50",
    ]) {
      expect(html).toContain(text);
    }
    // المؤجلة لا تظهر
    expect(html).not.toContain("مؤجلة");
  });

  it("writes the net amount in Arabic words", () => {
    const html = render();
    expect(html).toContain(
      "فقط ألفان وثلاثمائة وأربعة وعشرون ريال سعودي وخمسون هللة لا غير"
    );
    const negative = render(payroll(), detail({ netSalary: "-120.00" }));
    expect(negative).toContain("صافي المستحق على الموظف");
    expect(negative).toContain("فقط مائة وعشرون ريال سعودي لا غير");
  });

  it("signs and stamps only approved or paid payrolls", () => {
    for (const status of ["approved", "paid"]) {
      const html = render(payroll({ status }));
      expect(isPayslipSigned(status)).toBe(true);
      expect(html).toContain(ASSETS.stamp);
      expect(html).toContain(ASSETS.managerSignature);
      expect(html).toContain(ASSETS.supervisorSignature);
      expect(html).not.toContain('class="watermark');
      expect(html).toContain("اعتُمد المسير بواسطة عمر المطيري");
    }
    expect(
      render(payroll({ status: "paid", paidAt: "2026-10-30T07:00:00Z" }))
    ).toContain("تم صرف الراتب بتاريخ 30/10/2026 10:00");
    for (const status of ["draft", "pending", "cancelled"]) {
      const html = render(payroll({ status }));
      expect(isPayslipSigned(status)).toBe(false);
      expect(html).not.toContain(ASSETS.stamp);
      expect(html).not.toContain(ASSETS.managerSignature);
      expect(html).not.toContain(ASSETS.supervisorSignature);
    }
    expect(render(payroll({ status: "pending" }))).toContain(
      '<div class="watermark draft">مسودة - غير معتمد</div>'
    );
    expect(render(payroll({ status: "pending" }))).toContain(
      "بانتظار اعتماد المسير -"
    );
    expect(render(payroll({ status: "cancelled" }))).toContain(
      '<div class="watermark cancelled">ملغى</div>'
    );
  });

  it("uses the public signature paths when no embedded assets are given", () => {
    const html = renderPayslipHtml(
      buildPayslipDocumentData(payroll(), detail()),
      { assetBaseUrl: "https://erp.example.com" }
    );
    expect(html).toContain(`https://erp.example.com${SIGNATURES.stamp.image}`);
    expect(html).toContain(
      "https://erp.example.com/fonts/NotoSansArabic-Regular.ttf"
    );
  });

  it("escapes every user-provided text", () => {
    const evil = `<img src=x onerror="alert(1)">`;
    const html = render(
      payroll({
        branchName: evil,
        payrollNumber: evil,
        approvedByName: evil,
        createdByName: evil,
      }),
      detail({
        employeeName: evil,
        employeeCode: evil,
        position: evil,
        deductionReason: evil,
        notes: evil,
        leaveType: evil,
        advanceDetails: JSON.stringify({
          items: [{ id: 1, amount: 10, title: evil, approvedAt: null }],
        }),
        violationsDetails: JSON.stringify({
          items: [
            {
              id: 1,
              amount: 10,
              violationType: evil,
              violationDate: "2026-10-01",
              description: evil,
            },
          ],
        }),
        negativeInvoicesDetails: JSON.stringify([
          {
            id: 1,
            invoiceNumber: evil,
            amount: 1,
            reason: evil,
            invoiceDate: "2026-10-01",
          },
        ]),
      }),
      {
        ...EXTRAS,
        iqamaNumber: evil,
        nationality: evil,
        bankName: evil,
        iban: evil,
      }
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("formats day counts in proper Arabic", () => {
    expect(daysText(1)).toBe("يوم واحد");
    expect(daysText(2)).toBe("يومان");
    expect(daysText(3)).toBe("3 أيام");
    expect(daysText(10)).toBe("10 أيام");
    expect(daysText(11)).toBe("11 يوماً");
    expect(daysText(0)).toBe("0 يوم");
    expect(daysText(1.5)).toBe("1.5 يوم");
  });
});
