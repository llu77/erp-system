import { describe, expect, it } from "vitest";

// اختبارات حساب الرواتب
describe("Payroll Calculation", () => {
  // الثوابت
  const BASE_SALARY = 2000;
  const OVERTIME_AMOUNT = 1000;
  const SUPERVISOR_INCENTIVE = 400;

  // دالة حساب الراتب
  function calculateSalary(options: {
    baseSalary: number;
    hasOvertime: boolean;
    isSupervisor: boolean;
    deductions: number;
    advances: number;
  }) {
    let total = options.baseSalary;
    
    if (options.hasOvertime) {
      total += OVERTIME_AMOUNT;
    }
    
    if (options.isSupervisor) {
      total += SUPERVISOR_INCENTIVE;
    }
    
    total -= options.deductions;
    total -= options.advances;
    
    return Math.max(0, total); // لا يمكن أن يكون الراتب سالباً
  }

  it("should calculate base salary correctly", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: false,
      isSupervisor: false,
      deductions: 0,
      advances: 0,
    });
    expect(result).toBe(2000);
  });

  it("should add overtime amount when enabled", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: true,
      isSupervisor: false,
      deductions: 0,
      advances: 0,
    });
    expect(result).toBe(3000); // 2000 + 1000
  });

  it("should add supervisor incentive", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: false,
      isSupervisor: true,
      deductions: 0,
      advances: 0,
    });
    expect(result).toBe(2400); // 2000 + 400
  });

  it("should calculate full salary with all additions", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: true,
      isSupervisor: true,
      deductions: 0,
      advances: 0,
    });
    expect(result).toBe(3400); // 2000 + 1000 + 400
  });

  it("should subtract deductions correctly", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: false,
      isSupervisor: false,
      deductions: 500,
      advances: 0,
    });
    expect(result).toBe(1500); // 2000 - 500
  });

  it("should subtract advances correctly", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: false,
      isSupervisor: false,
      deductions: 0,
      advances: 300,
    });
    expect(result).toBe(1700); // 2000 - 300
  });

  it("should handle all deductions together", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: true,
      isSupervisor: true,
      deductions: 200,
      advances: 500,
    });
    expect(result).toBe(2700); // 2000 + 1000 + 400 - 200 - 500
  });

  it("should not return negative salary", () => {
    const result = calculateSalary({
      baseSalary: BASE_SALARY,
      hasOvertime: false,
      isSupervisor: false,
      deductions: 3000,
      advances: 0,
    });
    expect(result).toBe(0);
  });
});

// اختبارات تصنيفات المصاريف
describe("Expense Categories", () => {
  const validCategories = [
    "operational",
    "administrative",
    "marketing",
    "maintenance",
    "utilities",
    "rent",
    "salaries",
    "supplies",
    "transportation",
    "other",
  ];

  it("should have 10 expense categories", () => {
    expect(validCategories.length).toBe(10);
  });

  it("should include operational category", () => {
    expect(validCategories).toContain("operational");
  });

  it("should include rent category", () => {
    expect(validCategories).toContain("rent");
  });

  it("should include salaries category", () => {
    expect(validCategories).toContain("salaries");
  });
});

// اختبارات حالات المصاريف
describe("Expense Status Flow", () => {
  const statusFlow = {
    pending: ["approved", "rejected"],
    approved: ["paid"],
    rejected: [],
    paid: [],
  };

  it("should allow pending to be approved", () => {
    expect(statusFlow.pending).toContain("approved");
  });

  it("should allow pending to be rejected", () => {
    expect(statusFlow.pending).toContain("rejected");
  });

  it("should allow approved to be paid", () => {
    expect(statusFlow.approved).toContain("paid");
  });

  it("should not allow rejected to change status", () => {
    expect(statusFlow.rejected.length).toBe(0);
  });

  it("should not allow paid to change status", () => {
    expect(statusFlow.paid.length).toBe(0);
  });
});

// اختبارات حالات مسيرة الرواتب
describe("Payroll Status Flow", () => {
  const statusFlow = {
    draft: ["pending", "cancelled"],
    pending: ["approved", "cancelled"],
    approved: ["paid"],
    paid: [],
    cancelled: [],
  };

  it("should allow draft to be sent for review", () => {
    expect(statusFlow.draft).toContain("pending");
  });

  it("should allow pending to be approved", () => {
    expect(statusFlow.pending).toContain("approved");
  });

  it("should allow approved to be paid", () => {
    expect(statusFlow.approved).toContain("paid");
  });

  it("should not allow paid to change status", () => {
    expect(statusFlow.paid.length).toBe(0);
  });
});

// اختبارات تنسيق المبالغ
describe("Amount Formatting", () => {
  function formatAmount(amount: number): string {
    return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 });
  }

  it("should format whole numbers with decimals", () => {
    const result = formatAmount(1000);
    // الأرقام العربية: ٠١٢٣٤٥٦٧٨٩
    expect(result).toContain("٠٠"); // الأرقام العربية
  });

  it("should format decimal numbers correctly", () => {
    const result = formatAmount(1234.56);
    expect(result).toContain("٥٦"); // الأرقام العربية
  });

  it("should handle zero", () => {
    const result = formatAmount(0);
    expect(result).toBe("٠٫٠٠"); // الأرقام العربية
  });
});

// اختبارات طرق الدفع
describe("Payment Methods", () => {
  const validMethods = ["cash", "bank_transfer", "check", "credit_card", "other"];

  it("should have 5 payment methods", () => {
    expect(validMethods.length).toBe(5);
  });

  it("should include cash method", () => {
    expect(validMethods).toContain("cash");
  });

  it("should include bank transfer method", () => {
    expect(validMethods).toContain("bank_transfer");
  });
});

// اختبارات رقم المسيرة
describe("Payroll Number Generation", () => {
  function generatePayrollNumber(year: number, month: number, branchId: number): string {
    const monthStr = month.toString().padStart(2, '0');
    return `PAY-${year}${monthStr}-${branchId.toString().padStart(4, '0')}`;
  }

  it("should generate correct payroll number format", () => {
    const result = generatePayrollNumber(2024, 12, 1);
    expect(result).toBe("PAY-202412-0001");
  });

  it("should pad month with zero", () => {
    const result = generatePayrollNumber(2024, 1, 1);
    expect(result).toBe("PAY-202401-0001");
  });

  it("should pad branch ID with zeros", () => {
    const result = generatePayrollNumber(2024, 6, 5);
    expect(result).toBe("PAY-202406-0005");
  });
});

// اختبارات رقم المصروف
describe("Expense Number Generation", () => {
  function generateExpenseNumber(id: number): string {
    return `EXP-${id.toString().padStart(6, '0')}`;
  }

  it("should generate correct expense number format", () => {
    const result = generateExpenseNumber(1);
    expect(result).toBe("EXP-000001");
  });

  it("should pad with zeros correctly", () => {
    const result = generateExpenseNumber(123);
    expect(result).toBe("EXP-000123");
  });

  it("should handle large numbers", () => {
    const result = generateExpenseNumber(999999);
    expect(result).toBe("EXP-999999");
  });
});
