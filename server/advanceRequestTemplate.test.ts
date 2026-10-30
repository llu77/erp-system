import { describe, expect, it } from "vitest";
import { ESTABLISHMENTS, GROUP_ESTABLISHMENT } from "../shared/branding";
import {
  buildAdvanceRequestDocumentData,
  isAdvanceRequestSigned,
  renderAdvanceRequestHtml,
  repaymentMethodLabel,
  type AdvanceRequestEmployeeSource,
  type AdvanceRequestSource,
  type AdvanceDeductionSource,
} from "../shared/advanceRequestTemplate";

const ASSETS = {
  logo: "",
  supervisorSignature: "data:image/png;base64,SUPERVISOR",
  managerSignature: "data:image/png;base64,MANAGER",
  stamp: "data:image/png;base64,STAMP",
};
const PRINTED_AT = new Date("2026-10-30T09:00:00Z");

function request(
  over: Partial<AdvanceRequestSource> = {}
): AdvanceRequestSource {
  return {
    id: 44,
    requestNumber: "REQ-261012-0044",
    createdAt: new Date("2026-10-12T21:30:00Z"),
    status: "approved",
    employeeId: 7,
    employeeName: "محمد القحطاني",
    branchId: 1,
    branchName: "فرع لبن",
    advanceAmount: "1500.00",
    advanceReason: "مصاريف علاج",
    description: "وصف الطلب",
    repaymentMethod: "installments",
    reviewedByName: "عمر المطيري",
    reviewedAt: new Date("2026-10-13T09:00:00Z"),
    reviewNotes: "تُخصم على ثلاثة أشهر",
    rejectionReason: null,
    ...over,
  };
}

const EMPLOYEE: AdvanceRequestEmployeeSource = {
  code: "EMP-0007",
  isSupervisor: false,
  iqamaNumber: "2412345678",
  nationality: "باكستاني",
  phone: "0551234567",
  hireDate: "2021-03-10",
};

const render = (
  r = request(),
  deduction: AdvanceDeductionSource = {},
  employee: AdvanceRequestEmployeeSource | null = EMPLOYEE
) =>
  renderAdvanceRequestHtml(
    buildAdvanceRequestDocumentData(r, employee, deduction),
    { assets: ASSETS, printedAt: PRINTED_AT }
  );

/** النص المرئي بدون الوسوم */
const visible = (html: string) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/g, " ")
    .replace(/<script>[\s\S]*?<\/script>/g, " ")
    .replace(/<\/?(strong|b|span|small)[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("بيانات طلب السلفة", () => {
  it("maps the request, employee and payroll deduction reference", () => {
    const data = buildAdvanceRequestDocumentData(request(), EMPLOYEE, {
      payroll: {
        payrollNumber: "PAY-2026-10-0003",
        year: 2026,
        month: 10,
        status: "approved",
      },
      settlement: { settlementNumber: "EOS-2026-0001" },
    });
    expect(data).toMatchObject({
      requestId: 44,
      amount: 1500,
      reason: "مصاريف علاج",
      repaymentMethod: "installments",
      branchName: "فرع لبن",
      employee: {
        id: 7,
        code: "EMP-0007",
        hireDate: "2021-03-10",
        phone: "0551234567",
      },
      deduction: {
        kind: "payroll",
        reference: "PAY-2026-10-0003",
        period: "أكتوبر 2026",
        status: "approved",
      },
    });
  });

  it("falls back to the description, the settlement reference and empty employee fields", () => {
    const data = buildAdvanceRequestDocumentData(
      request({
        advanceReason: "  ",
        repaymentMethod: null,
        advanceAmount: null,
      }),
      null,
      { settlement: { settlementNumber: "EOS-2026-0001", status: "approved" } }
    );
    expect(data.reason).toBe("وصف الطلب");
    expect(data.amount).toBe(0);
    expect(data.repaymentMethod).toBeNull();
    expect(data.employee.code).toBe("");
    expect(data.deduction).toEqual({
      kind: "end_of_service",
      reference: "EOS-2026-0001",
      period: null,
      status: "approved",
    });
  });

  it("labels repayment methods in Arabic (salary deduction by default)", () => {
    expect(repaymentMethodLabel("salary_deduction")).toBe("خصم من الراتب");
    expect(repaymentMethodLabel("installments")).toBe("أقساط شهرية");
    expect(repaymentMethodLabel("full_payment")).toBe("سداد كامل");
    expect(repaymentMethodLabel(null)).toBe("خصم من الراتب");
    expect(repaymentMethodLabel("other")).toBe("other");
  });
});

describe("قالب طلب السلفة", () => {
  it("is an official RTL letter with number, Riyadh date and the formal request paragraph", () => {
    const html = render();
    const text = visible(html);
    expect(html).toContain('<html dir="rtl" lang="ar">');
    expect(html).toContain("size: A4");
    expect(text).toContain("طلب سلفة");
    expect(text).toContain("REQ-261012-0044");
    // 21:30Z = 13/10 في الرياض
    expect(text).toContain("13/10/2026");
    expect(text).toContain(
      "أتقدم أنا الموقع أدناه / محمد القحطاني، رقم الإقامة / الهوية (2412345678)، الرقم الوظيفي (EMP-0007)، بطلب سلفة مالية بمبلغ (1,500.00 ريال سعودي) فقط ألف وخمسمائة ريال سعودي لا غير، وذلك لـمصاريف علاج، على أن تُسترد على أقساط شهرية تُخصم من راتبي، وأتعهد بسدادها وفق ما ورد أعلاه"
    );
    expect(text).toContain("السادة / مؤسسة قصه وتخفيف");
  });

  it("brands the letter with the establishment of the request branch", () => {
    expect(render()).toContain(ESTABLISHMENTS.qessa.nameAr);
    expect(render(request({ branchName: "فرع طويق" }))).toContain(
      ESTABLISHMENTS.tadarruj.nameAr
    );
    const other = render(request({ branchName: null }));
    expect(other).toContain(GROUP_ESTABLISHMENT.nameAr);
    for (const html of [render(), other]) {
      expect(html).not.toMatch(/symbol|سيمبول/i);
      expect(html).not.toMatch(/X{4,}/);
    }
  });

  it("shows the fixed job title: barber, or supervisor for a supervisor account", () => {
    const titleCell = (title: string) =>
      `<div class="lbl">المسمى الوظيفي</div><div class="val">${title}</div>`;
    expect(render()).toContain(titleCell("حلاق"));
    const supervisor = render(request(), {}, { ...EMPLOYEE, isSupervisor: true });
    expect(supervisor).toContain(titleCell("مشرف"));
    expect(supervisor).not.toContain(titleCell("حلاق"));
  });

  it("approved: decision with reviewer, notes, deduction reference, signatures and stamp", () => {
    const html = render(request(), {
      payroll: {
        payrollNumber: "PAY-2026-10-0003",
        year: 2026,
        month: 10,
        status: "paid",
      },
    });
    const text = visible(html);
    expect(isAdvanceRequestSigned("approved")).toBe(true);
    expect(text).toContain(
      "تمت الموافقة على الطلب بواسطة عمر المطيري بتاريخ 13/10/2026 12:00"
    );
    expect(text).toContain("ملاحظات الاعتماد: تُخصم على ثلاثة أشهر");
    expect(text).toContain(
      "خُصمت السلفة من مسير رواتب شهر أكتوبر 2026 رقم PAY-2026-10-0003"
    );
    expect(html).toContain(ASSETS.stamp);
    expect(html).toContain(ASSETS.managerSignature);
    expect(html).toContain(ASSETS.supervisorSignature);
    // نص الاعتماد عادي بلا تظليل أخضر
    expect(html).toContain('class="decision decision-approved"');
    expect(html).not.toContain("ok-box");
    const approvedRule = html.match(/\.decision-approved \{[^}]*\}/)?.[0] ?? "";
    expect(approvedRule).not.toBe("");
    expect(approvedRule).not.toMatch(/background|border|color/);
    expect(html).not.toContain('class="watermark');
    // مسيرة لم تُعتمد بعد: مُدرجة للخصم
    expect(
      visible(
        render(request(), {
          payroll: {
            payrollNumber: "P1",
            year: 2026,
            month: 11,
            status: "draft",
          },
        })
      )
    ).toContain("أُدرجت السلفة للخصم في مسير رواتب شهر نوفمبر 2026 رقم P1");
    expect(
      visible(
        render(request(), { settlement: { settlementNumber: "EOS-2026-0001" } })
      )
    ).toContain("سُوّيت السلفة ضمن المخالصة النهائية رقم EOS-2026-0001");
  });

  it("rejected: rejection box with the reason and no signatures or stamp", () => {
    const html = render(
      request({
        status: "rejected",
        rejectionReason: "تجاوز الحد المسموح",
        reviewNotes: null,
      })
    );
    const text = visible(html);
    expect(isAdvanceRequestSigned("rejected")).toBe(false);
    expect(text).toContain("تم رفض الطلب بواسطة عمر المطيري");
    expect(text).toContain("سبب الرفض: تجاوز الحد المسموح");
    expect(html).toContain('<div class="watermark cancelled">مرفوض</div>');
    expect(html).not.toContain(ASSETS.stamp);
    expect(html).not.toContain(ASSETS.managerSignature);
    expect(text).not.toContain("تمت الموافقة على الطلب");
  });

  it("pending and cancelled: watermark and no signatures", () => {
    const pending = render(
      request({
        status: "pending",
        reviewedByName: null,
        reviewedAt: null,
        reviewNotes: null,
      })
    );
    expect(visible(pending)).toContain("بانتظار الاعتماد");
    expect(pending).toContain(
      '<div class="watermark draft">بانتظار الاعتماد</div>'
    );
    expect(pending).not.toContain(ASSETS.stamp);
    const cancelled = render(request({ status: "cancelled" }));
    expect(cancelled).toContain('<div class="watermark cancelled">ملغي</div>');
    expect(visible(cancelled)).toContain("ملغي - تم إلغاء هذا الطلب");
    expect(cancelled).not.toContain(ASSETS.stamp);
    expect(cancelled).not.toContain(ASSETS.managerSignature);
  });

  it("defaults the repayment method to salary deduction", () => {
    const text = visible(render(request({ repaymentMethod: null })));
    expect(text).toContain("على أن تُسترد خصماً من راتبي الشهري");
    expect(text).toContain("خصم من الراتب");
  });

  it("escapes every user-provided text", () => {
    const evil = `<script>alert(1)</script>`;
    const html = render(
      request({
        employeeName: evil,
        requestNumber: evil,
        branchName: evil,
        advanceReason: evil,
        repaymentMethod: evil,
        reviewedByName: evil,
        reviewNotes: evil,
      }),
      {
        payroll: {
          payrollNumber: evil,
          year: 2026,
          month: 10,
          status: "approved",
        },
      },
      {
        ...EMPLOYEE,
        code: evil,
        position: evil,
        iqamaNumber: evil,
        nationality: evil,
        phone: evil,
      }
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
