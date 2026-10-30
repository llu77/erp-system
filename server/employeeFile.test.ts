import { describe, expect, it } from "vitest";
import {
  base64ByteLength,
  daysUntil,
  describeDocumentExpiry,
  documentDateToTimestamp,
  documentStatusFor,
  employeeJobTitle,
  formatArabicDate,
  formatDaysLeft,
  isValidIban,
  normalizeIqamaNumber,
  sanitizeFileName,
  sniffContentType,
  validateEmployeeFile,
  worstDocumentStatus,
  EMPLOYEE_FILE_MAX_BYTES,
  JOB_TITLE_BARBER,
  JOB_TITLE_SUPERVISOR,
} from "../shared/employeeFile";
import {
  buildDocumentStorageKey,
  buildEmployeeUpdatePatch,
  buildOpenPayrollOverride,
  buildSalarySettingsPatch,
  changedDocumentFields,
  decodeEmployeeUpload,
  documentUploadSchema,
  effectiveSalarySettings,
  employeeUpdateSchema,
  mergeSalarySettings,
  salarySettingsSaveSchema,
} from "./employeeFile/schemas";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const PDF_HEADER = Array.from("%PDF-1.7").map(c => c.charCodeAt(0));
const WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
];

function bytes(header: number[], total = 32): Uint8Array {
  const out = new Uint8Array(total);
  out.set(header);
  return out;
}

function base64Of(header: number[], total = 32): string {
  return Buffer.from(bytes(header, total)).toString("base64");
}

describe("job title", () => {
  it("is always barber, or supervisor for a supervisor account", () => {
    expect(JOB_TITLE_BARBER).toBe("حلاق");
    expect(JOB_TITLE_SUPERVISOR).toBe("مشرف");
    expect(employeeJobTitle(true)).toBe("مشرف");
    expect(employeeJobTitle(1)).toBe("مشرف");
    expect(employeeJobTitle(false)).toBe("حلاق");
    expect(employeeJobTitle(0)).toBe("حلاق");
    expect(employeeJobTitle(null)).toBe("حلاق");
    expect(employeeJobTitle(undefined)).toBe("حلاق");
  });

  it("cannot be entered from the employee forms", () => {
    expect(employeeUpdateSchema.parse({ id: 1, position: "مدير" })).not.toHaveProperty("position");
  });
});

describe("daysUntil (Riyadh calendar day)", () => {
  // 2026-10-30 22:30 UTC = 2026-10-31 01:30 Riyadh
  const lateNightUtc = new Date("2026-10-30T22:30:00Z");

  it("counts whole Riyadh days, not UTC days", () => {
    expect(daysUntil("2026-10-31", lateNightUtc)).toBe(0);
    expect(daysUntil("2026-11-01", lateNightUtc)).toBe(1);
    expect(daysUntil("2026-10-30", lateNightUtc)).toBe(-1);
  });

  it("treats a stored midnight-UTC timestamp as that same day", () => {
    const stored = new Date("2026-11-05T00:00:00Z");
    expect(daysUntil(stored, new Date("2026-11-05T08:00:00Z"))).toBe(0);
    expect(daysUntil(stored, new Date("2026-11-04T20:59:00Z"))).toBe(1);
  });

  it("returns null without a date", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
    expect(daysUntil("not a date")).toBeNull();
  });

  it("handles month and year boundaries", () => {
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
    expect(daysUntil("2028-03-01", "2028-02-28")).toBe(2); // 2028 is a leap year
  });
});

describe("document status thresholds", () => {
  it("expired below zero days, including yesterday", () => {
    expect(documentStatusFor("iqama", -1)).toBe("expired");
    expect(documentStatusFor("contract", -400)).toBe("expired");
  });

  it("critical from today through 7 days", () => {
    expect(documentStatusFor("iqama", 0)).toBe("critical");
    expect(documentStatusFor("health", 7)).toBe("critical");
    expect(documentStatusFor("contract", 7)).toBe("critical");
  });

  it("warning window is 30 days for iqama and health, 60 for the contract", () => {
    expect(documentStatusFor("iqama", 8)).toBe("warning");
    expect(documentStatusFor("iqama", 30)).toBe("warning");
    expect(documentStatusFor("iqama", 31)).toBe("valid");
    expect(documentStatusFor("health", 30)).toBe("warning");
    expect(documentStatusFor("health", 31)).toBe("valid");
    expect(documentStatusFor("contract", 31)).toBe("warning");
    expect(documentStatusFor("contract", 60)).toBe("warning");
    expect(documentStatusFor("contract", 61)).toBe("valid");
  });

  it("missing when no date", () => {
    expect(documentStatusFor("iqama", null)).toBe("missing");
    expect(describeDocumentExpiry("health", null)).toEqual({
      expiry: null,
      daysLeft: null,
      status: "missing",
    });
  });

  it("describes a document from its stored date", () => {
    const info = describeDocumentExpiry(
      "iqama",
      new Date("2026-11-10T00:00:00Z"),
      new Date("2026-10-31T09:00:00Z")
    );
    expect(info).toEqual({
      expiry: "2026-11-10",
      daysLeft: 10,
      status: "warning",
    });
  });

  it("picks the worst status for the employee badge", () => {
    expect(worstDocumentStatus(["valid", "warning", "missing"])).toBe(
      "warning"
    );
    expect(worstDocumentStatus(["valid", "missing"])).toBe("missing");
    expect(worstDocumentStatus(["critical", "expired", "valid"])).toBe(
      "expired"
    );
    expect(worstDocumentStatus(["valid", "valid", "valid"])).toBe("valid");
    expect(worstDocumentStatus([])).toBe("missing");
  });

  it("formats the remaining days in Arabic", () => {
    expect(formatDaysLeft(-3)).toBe("منتهية منذ 3 يوم");
    expect(formatDaysLeft(0)).toBe("تنتهي اليوم");
    expect(formatDaysLeft(1)).toBe("تنتهي غداً");
    expect(formatDaysLeft(12)).toBe("متبقي 12 يوم");
    expect(formatDaysLeft(null)).toBe("لا يوجد تاريخ");
  });

  it("formats dates in the Gregorian calendar", () => {
    const text = formatArabicDate("2026-10-30");
    expect(text).toContain("أكتوبر");
    expect(formatArabicDate(null)).toBe("-");
  });

  it("stores a day as midnight UTC of the same day", () => {
    expect(documentDateToTimestamp("2026-02-28").toISOString()).toBe(
      "2026-02-28T00:00:00.000Z"
    );
  });
});

describe("file validation", () => {
  it("detects real file types from their bytes", () => {
    expect(sniffContentType(bytes(PNG_HEADER))).toBe("image/png");
    expect(sniffContentType(bytes(JPEG_HEADER))).toBe("image/jpeg");
    expect(sniffContentType(bytes(PDF_HEADER))).toBe("application/pdf");
    expect(sniffContentType(bytes(WEBP_HEADER))).toBe("image/webp");
    expect(sniffContentType(bytes([0x3c, 0x73, 0x76, 0x67]))).toBeNull(); // <svg
  });

  it("accepts images for the photo and PDF only for documents", () => {
    expect(
      validateEmployeeFile({
        kind: "photo",
        contentType: "image/png",
        size: 100,
      }).ok
    ).toBe(true);
    expect(
      validateEmployeeFile({
        kind: "photo",
        contentType: "application/pdf",
        size: 100,
      }).ok
    ).toBe(false);
    expect(
      validateEmployeeFile({
        kind: "iqama",
        contentType: "application/pdf",
        size: 100,
      }).ok
    ).toBe(true);
    expect(
      validateEmployeeFile({
        kind: "contract",
        contentType: "image/svg+xml",
        size: 100,
      }).ok
    ).toBe(false);
    expect(
      validateEmployeeFile({
        kind: "health",
        contentType: "image/jpg",
        size: 100,
      })
    ).toEqual({
      ok: true,
      contentType: "image/jpeg",
    });
  });

  it("rejects empty and oversized files", () => {
    expect(
      validateEmployeeFile({ kind: "iqama", contentType: "image/png", size: 0 })
        .ok
    ).toBe(false);
    expect(
      validateEmployeeFile({
        kind: "iqama",
        contentType: "image/png",
        size: EMPLOYEE_FILE_MAX_BYTES,
      }).ok
    ).toBe(true);
    const tooBig = validateEmployeeFile({
      kind: "iqama",
      contentType: "image/png",
      size: EMPLOYEE_FILE_MAX_BYTES + 1,
    });
    expect(tooBig).toEqual({ ok: false, error: "حجم الملف يتجاوز 5 ميجابايت" });
  });

  it("rejects content that does not match the declared type", () => {
    const result = validateEmployeeFile({
      kind: "iqama",
      contentType: "image/png",
      size: 32,
      bytes: bytes(PDF_HEADER),
    });
    expect(result.ok).toBe(false);
  });

  it("computes the decoded size of a base64 payload", () => {
    const encoded = base64Of(PNG_HEADER, 100);
    expect(base64ByteLength(encoded)).toBe(100);
    expect(base64ByteLength(`data:image/png;base64,${encoded}`)).toBe(100);
    expect(base64ByteLength("")).toBe(0);
  });

  it("sanitizes file names and forces the real extension", () => {
    expect(sanitizeFileName("../../etc/passwd", "image/png")).toBe(
      "passwd.png"
    );
    expect(sanitizeFileName("صورة الإقامة.JPG", "image/jpeg")).toBe("file.jpg");
    expect(sanitizeFileName("my iqama (1).php.png", "image/png")).toBe(
      "my-iqama-1-php.png"
    );
    expect(sanitizeFileName("", "application/pdf")).toBe("file.pdf");
    expect(sanitizeFileName("a".repeat(200), "image/webp")).toBe(
      `${"a".repeat(60)}.webp`
    );
  });

  it("decodes an upload and checks its real type", () => {
    const ok = decodeEmployeeUpload({
      kind: "iqama",
      base64: `data:application/pdf;base64,${base64Of(PDF_HEADER)}`,
      contentType: "application/pdf",
      fileName: "عقد.pdf",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.contentType).toBe("application/pdf");
      expect(ok.fileName).toBe("file.pdf");
      expect(ok.buffer.length).toBe(32);
    }

    const spoofed = decodeEmployeeUpload({
      kind: "photo",
      base64: base64Of(PDF_HEADER),
      contentType: "image/png",
      fileName: "photo.png",
    });
    expect(spoofed.ok).toBe(false);

    const garbage = decodeEmployeeUpload({
      kind: "photo",
      base64: "not base64!!",
      contentType: "image/png",
      fileName: "x",
    });
    expect(garbage).toEqual({ ok: false, error: "تعذر قراءة الملف المرسل" });
  });

  it("validates the upload input", () => {
    expect(
      documentUploadSchema.safeParse({
        employeeId: 1,
        kind: "passport",
        base64: "AA==",
        contentType: "image/png",
      }).success
    ).toBe(false);
    const parsed = documentUploadSchema.parse({
      employeeId: 1,
      kind: "photo",
      base64: "AA==",
      contentType: "image/png",
    });
    expect(parsed.fileName).toBe("");
  });

  it("builds a storage key under the employee folder", () => {
    const key = buildDocumentStorageKey(
      7,
      "health",
      "cert.pdf",
      "abc123",
      new Date(1700000000000)
    );
    expect(key).toBe(
      "employee-documents/7/health-1700000000000-abc123-cert.pdf"
    );
  });
});

describe("employee update patch", () => {
  const current = {
    iqamaNumber: "2123456789",
    iqamaExpiryDate: new Date("2027-01-15T00:00:00Z"),
    healthCertExpiryDate: null,
    contractExpiryDate: new Date("2026-12-01T00:00:00Z"),
  };
  const now = new Date("2026-10-30T10:00:00Z");

  it("keeps omitted fields and clears null ones", () => {
    const input = employeeUpdateSchema.parse({
      id: 1,
      phone: null,
      // المسمى لا يُدخل يدوياً: يُتجاهل إن أُرسل
      position: "مدير صالون",
      nationality: "",
    });
    const { id, ...fields } = input;
    const { patch, documentsChanged } = buildEmployeeUpdatePatch(
      fields,
      null,
      5,
      now
    );
    expect(patch).toEqual({ phone: null, nationality: null });
    expect(documentsChanged).toBe(false);
    expect(id).toBe(1);
  });

  it("accepts YYYY-MM-DD or Date for document dates and stores midnight UTC", () => {
    const input = employeeUpdateSchema.parse({
      id: 1,
      iqamaExpiryDate: "2027-03-01",
      contractExpiryDate: new Date("2027-06-30T00:00:00Z"),
      healthCertExpiryDate: null,
    });
    expect(input.iqamaExpiryDate).toBe("2027-03-01");
    expect(input.contractExpiryDate).toBe("2027-06-30");
    const { id: _id, ...fields } = input;
    const { patch } = buildEmployeeUpdatePatch(fields, current, 5, now);
    expect(patch.iqamaExpiryDate).toEqual(new Date("2027-03-01T00:00:00Z"));
    expect(patch.contractExpiryDate).toEqual(new Date("2027-06-30T00:00:00Z"));
    expect(patch.healthCertExpiryDate).toBeNull();
  });

  it("rejects invalid dates and non-numeric iqama numbers", () => {
    expect(
      employeeUpdateSchema.safeParse({ id: 1, iqamaExpiryDate: "2027-02-30" })
        .success
    ).toBe(false);
    expect(
      employeeUpdateSchema.safeParse({ id: 1, iqamaNumber: "21ABC" }).success
    ).toBe(false);
    expect(
      employeeUpdateSchema.parse({ id: 1, iqamaNumber: "٢١٢٣ ٤٥٦ ٧٨٩" })
        .iqamaNumber
    ).toBe("2123456789");
    expect(normalizeIqamaNumber("۲۱-23")).toBe("2123");
  });

  it("records who entered document data only when it actually changed", () => {
    const same = buildEmployeeUpdatePatch(
      {
        iqamaNumber: "2123456789",
        iqamaExpiryDate: "2027-01-15",
        healthCertExpiryDate: null,
      },
      current,
      5,
      now
    );
    expect(same.documentsChanged).toBe(false);
    expect(same.patch.infoSubmittedBy).toBeUndefined();

    const changed = buildEmployeeUpdatePatch(
      { healthCertExpiryDate: "2027-02-01" },
      current,
      5,
      now
    );
    expect(changed.documentsChanged).toBe(true);
    expect(changed.patch.infoSubmittedBy).toBe(5);
    // إكمال التسجيل في البوابة للموظف وحده: تعديل الإدارة لا يقفل رفع الصور من البوابة
    expect(changed.patch.infoSubmittedAt).toBeUndefined();
  });

  it("for a new employee, only non-empty document data counts", () => {
    expect(
      changedDocumentFields({ iqamaNumber: null, iqamaExpiryDate: null }, null)
    ).toEqual([]);
    expect(
      changedDocumentFields(
        { iqamaNumber: "2123", contractExpiryDate: "2027-01-01" },
        null
      )
    ).toEqual(["iqamaNumber", "contractExpiryDate"]);
  });
});

describe("salary settings", () => {
  it("validates amounts and IBAN", () => {
    expect(
      salarySettingsSaveSchema.safeParse({ employeeId: 1, baseSalary: -1 })
        .success
    ).toBe(false);
    expect(
      salarySettingsSaveSchema.safeParse({
        employeeId: 1,
        overtimeRate: 2_000_000,
      }).success
    ).toBe(false);
    expect(
      salarySettingsSaveSchema.safeParse({ employeeId: 1, baseSalary: 0 })
        .success
    ).toBe(true);
    expect(
      salarySettingsSaveSchema.safeParse({
        employeeId: 1,
        iban: "SA03 8000 0000 6080 1016 7519",
      }).success
    ).toBe(true);
    expect(
      salarySettingsSaveSchema.safeParse({
        employeeId: 1,
        iban: "SA03 8000 0000 6080 1016 7518",
      }).success
    ).toBe(false);
    expect(
      salarySettingsSaveSchema.safeParse({ employeeId: 1, iban: "" }).success
    ).toBe(true);
    expect(
      salarySettingsSaveSchema.safeParse({ employeeId: 1, iban: null }).success
    ).toBe(true);
  });

  it("checks IBAN format and checksum", () => {
    expect(isValidIban("SA0380000000608010167519")).toBe(true);
    expect(isValidIban("sa03 8000 0000 6080 1016 7519")).toBe(true);
    expect(isValidIban("GB82WEST12345698765432")).toBe(true);
    expect(isValidIban("SA038000000060801016751")).toBe(false); // too short
    expect(isValidIban("1234")).toBe(false);
  });

  it("only writes the fields that were sent (partial-safe)", () => {
    expect(buildSalarySettingsPatch({ baseSalary: 2500.555 })).toEqual({
      baseSalary: "2500.56",
    });
    expect(
      buildSalarySettingsPatch({
        overtimeEnabled: true,
        fixedDeductionReason: "  ",
        iban: "sa03 8000 0000 6080 1016 7519",
        bankName: " الراجحي ",
      })
    ).toEqual({
      overtimeEnabled: true,
      fixedDeductionReason: null,
      iban: "SA0380000000608010167519",
      bankName: "الراجحي",
    });
    expect(buildSalarySettingsPatch({})).toEqual({});
  });

  it("falls back to the payroll defaults when nothing is saved", () => {
    expect(effectiveSalarySettings(undefined)).toMatchObject({
      baseSalary: 2000,
      overtimeEnabled: false,
      overtimeRate: 1000,
      isSupervisor: false,
      supervisorIncentive: 400,
      fixedDeduction: 0,
    });
    expect(
      effectiveSalarySettings({ baseSalary: "3000.00", overtimeRate: "abc" })
    ).toMatchObject({
      baseSalary: 3000,
      overtimeRate: 1000,
    });
  });

  it("merges a partial update onto the previous values", () => {
    const prev = effectiveSalarySettings({
      baseSalary: "3000.00",
      isSupervisor: true,
      supervisorIncentive: "500.00",
    });
    const next = mergeSalarySettings(prev, { overtimeEnabled: true });
    expect(next).toMatchObject({
      baseSalary: 3000,
      isSupervisor: true,
      supervisorIncentive: 500,
      overtimeEnabled: true,
    });
  });

  it("sends only changed line inputs to open payrolls", () => {
    const prev = effectiveSalarySettings(undefined);
    expect(
      buildOpenPayrollOverride(prev, { ...prev, baseSalary: 2600 })
    ).toEqual({});
    expect(
      buildOpenPayrollOverride(prev, { ...prev, overtimeEnabled: true })
    ).toEqual({ overtimeEnabled: true });
    expect(
      buildOpenPayrollOverride(prev, { ...prev, isSupervisor: true })
    ).toEqual({ incentiveAmount: 400 });
    expect(
      buildOpenPayrollOverride(
        { ...prev, isSupervisor: true },
        { ...prev, isSupervisor: false }
      )
    ).toEqual({ incentiveAmount: 0 });
    // تغيير قيمة الحافز لغير المشرف لا يؤثر
    expect(
      buildOpenPayrollOverride(prev, { ...prev, supervisorIncentive: 600 })
    ).toEqual({});
    expect(
      buildOpenPayrollOverride(prev, {
        ...prev,
        fixedDeduction: 150,
        fixedDeductionReason: "سكن",
      })
    ).toEqual({ otherDeduction: 150, otherDeductionReason: "سكن" });
  });
});
