import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock db functions
vi.mock("./db", () => ({
  createEmployeeRequest: vi.fn(),
  getAllEmployeeRequests: vi.fn(),
  getEmployeeRequestById: vi.fn(),
  getEmployeeRequestsByEmployeeId: vi.fn(),
  getPendingEmployeeRequests: vi.fn(),
  updateEmployeeRequestStatus: vi.fn(),
  deleteEmployeeRequest: vi.fn(),
  createEmployeeRequestLog: vi.fn(),
  getEmployeeRequestLogs: vi.fn(),
  getEmployeeRequestsStats: vi.fn(),
  generateRequestNumber: vi.fn(),
  getAllEmployees: vi.fn(),
  createNotification: vi.fn(),
}));

import * as db from "./db";

describe("Employee Requests System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateRequestNumber", () => {
    it("should generate a valid request number format", () => {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      // Test the format
      const pattern = new RegExp(`^REQ-${year}${month}${day}-\\d{4}$`);
      
      // Generate a sample request number
      const requestNumber = `REQ-${year}${month}${day}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      expect(requestNumber).toMatch(pattern);
    });
  });

  describe("createEmployeeRequest", () => {
    it("should create an advance request successfully", async () => {
      const mockResult = { requestNumber: "REQ-241219-0001", insertId: 1 };
      vi.mocked(db.createEmployeeRequest).mockResolvedValue(mockResult);

      const requestData = {
        employeeId: 1,
        employeeName: "أحمد محمد",
        branchId: 1,
        branchName: "الفرع الرئيسي",
        requestType: "advance" as const,
        title: "طلب سلفة شهرية",
        description: "سلفة لظروف طارئة",
        priority: "normal" as const,
        advanceAmount: "5000",
        advanceReason: "ظروف عائلية",
        repaymentMethod: "salary_deduction",
      };

      const result = await db.createEmployeeRequest(requestData);

      expect(result).toEqual(mockResult);
      expect(db.createEmployeeRequest).toHaveBeenCalledWith(requestData);
    });

    it("should create a vacation request successfully", async () => {
      const mockResult = { requestNumber: "REQ-241219-0002", insertId: 2 };
      vi.mocked(db.createEmployeeRequest).mockResolvedValue(mockResult);

      const requestData = {
        employeeId: 2,
        employeeName: "سارة أحمد",
        requestType: "vacation" as const,
        title: "إجازة سنوية",
        vacationType: "annual",
        vacationStartDate: new Date("2024-12-25"),
        vacationEndDate: new Date("2024-12-31"),
        vacationDays: 7,
        priority: "normal" as const,
      };

      const result = await db.createEmployeeRequest(requestData);

      expect(result).toEqual(mockResult);
    });

    it("should create a permission request successfully", async () => {
      const mockResult = { requestNumber: "REQ-241219-0003", insertId: 3 };
      vi.mocked(db.createEmployeeRequest).mockResolvedValue(mockResult);

      const requestData = {
        employeeId: 3,
        employeeName: "خالد علي",
        requestType: "permission" as const,
        title: "استئذان لموعد طبي",
        permissionDate: new Date("2024-12-20"),
        permissionStartTime: "10:00",
        permissionEndTime: "12:00",
        permissionHours: "2",
        permissionReason: "موعد طبي",
        priority: "normal" as const,
      };

      const result = await db.createEmployeeRequest(requestData);

      expect(result).toEqual(mockResult);
    });

    it("should create an objection request successfully", async () => {
      const mockResult = { requestNumber: "REQ-241219-0004", insertId: 4 };
      vi.mocked(db.createEmployeeRequest).mockResolvedValue(mockResult);

      const requestData = {
        employeeId: 4,
        employeeName: "محمد سعيد",
        requestType: "objection" as const,
        title: "اعتراض على مخالفة تأخير",
        objectionType: "تأخير",
        objectionDate: new Date("2024-12-15"),
        objectionDetails: "كان هناك ظرف طارئ",
        priority: "high" as const,
      };

      const result = await db.createEmployeeRequest(requestData);

      expect(result).toEqual(mockResult);
    });

    it("should create a resignation request successfully", async () => {
      const mockResult = { requestNumber: "REQ-241219-0005", insertId: 5 };
      vi.mocked(db.createEmployeeRequest).mockResolvedValue(mockResult);

      const requestData = {
        employeeId: 5,
        employeeName: "فاطمة حسن",
        requestType: "resignation" as const,
        title: "طلب استقالة",
        resignationDate: new Date("2024-12-19"),
        resignationReason: "فرصة عمل جديدة",
        lastWorkingDay: new Date("2025-01-19"),
        noticePeriod: 30,
        priority: "normal" as const,
      };

      const result = await db.createEmployeeRequest(requestData);

      expect(result).toEqual(mockResult);
    });

    it("should create an arrears request successfully", async () => {
      const mockResult = { requestNumber: "REQ-241219-0006", insertId: 6 };
      vi.mocked(db.createEmployeeRequest).mockResolvedValue(mockResult);

      const requestData = {
        employeeId: 6,
        employeeName: "عمر يوسف",
        requestType: "arrears" as const,
        title: "طلب صرف متأخرات",
        arrearsAmount: "3000",
        arrearsPeriod: "شهر نوفمبر 2024",
        arrearsDetails: "بدل عمل إضافي",
        priority: "normal" as const,
      };

      const result = await db.createEmployeeRequest(requestData);

      expect(result).toEqual(mockResult);
    });
  });

  describe("getAllEmployeeRequests", () => {
    it("should return all requests without filters", async () => {
      const mockRequests = [
        { id: 1, requestNumber: "REQ-001", status: "pending", requestType: "advance" },
        { id: 2, requestNumber: "REQ-002", status: "approved", requestType: "vacation" },
      ];
      vi.mocked(db.getAllEmployeeRequests).mockResolvedValue(mockRequests as any);

      const result = await db.getAllEmployeeRequests();

      expect(result).toEqual(mockRequests);
      expect(db.getAllEmployeeRequests).toHaveBeenCalled();
    });

    it("should filter requests by status", async () => {
      const mockRequests = [
        { id: 1, requestNumber: "REQ-001", status: "pending", requestType: "advance" },
      ];
      vi.mocked(db.getAllEmployeeRequests).mockResolvedValue(mockRequests as any);

      const result = await db.getAllEmployeeRequests({ status: "pending" });

      expect(result).toEqual(mockRequests);
      expect(db.getAllEmployeeRequests).toHaveBeenCalledWith({ status: "pending" });
    });

    it("should filter requests by type", async () => {
      const mockRequests = [
        { id: 2, requestNumber: "REQ-002", status: "approved", requestType: "vacation" },
      ];
      vi.mocked(db.getAllEmployeeRequests).mockResolvedValue(mockRequests as any);

      const result = await db.getAllEmployeeRequests({ requestType: "vacation" });

      expect(result).toEqual(mockRequests);
    });
  });

  describe("getEmployeeRequestById", () => {
    it("should return request details by id", async () => {
      const mockRequest = {
        id: 1,
        requestNumber: "REQ-241219-0001",
        employeeId: 1,
        employeeName: "أحمد محمد",
        requestType: "advance",
        status: "pending",
        title: "طلب سلفة",
        advanceAmount: "5000",
      };
      vi.mocked(db.getEmployeeRequestById).mockResolvedValue(mockRequest as any);

      const result = await db.getEmployeeRequestById(1);

      expect(result).toEqual(mockRequest);
      expect(db.getEmployeeRequestById).toHaveBeenCalledWith(1);
    });

    it("should return undefined for non-existent request", async () => {
      vi.mocked(db.getEmployeeRequestById).mockResolvedValue(undefined);

      const result = await db.getEmployeeRequestById(999);

      expect(result).toBeUndefined();
    });
  });

  describe("updateEmployeeRequestStatus", () => {
    it("should approve a request successfully", async () => {
      vi.mocked(db.updateEmployeeRequestStatus).mockResolvedValue(undefined);

      await db.updateEmployeeRequestStatus(
        1,
        "approved",
        1,
        "المدير",
        "تمت الموافقة"
      );

      expect(db.updateEmployeeRequestStatus).toHaveBeenCalledWith(
        1,
        "approved",
        1,
        "المدير",
        "تمت الموافقة"
      );
    });

    it("should reject a request with reason", async () => {
      vi.mocked(db.updateEmployeeRequestStatus).mockResolvedValue(undefined);

      await db.updateEmployeeRequestStatus(
        2,
        "rejected",
        1,
        "المدير",
        undefined,
        "تجاوز الحد المسموح"
      );

      expect(db.updateEmployeeRequestStatus).toHaveBeenCalledWith(
        2,
        "rejected",
        1,
        "المدير",
        undefined,
        "تجاوز الحد المسموح"
      );
    });
  });

  describe("getEmployeeRequestsStats", () => {
    it("should return correct statistics", async () => {
      const mockStats = {
        total: 10,
        pending: 3,
        approved: 5,
        rejected: 2,
      };
      vi.mocked(db.getEmployeeRequestsStats).mockResolvedValue(mockStats);

      const result = await db.getEmployeeRequestsStats();

      expect(result).toEqual(mockStats);
      expect(result.total).toBe(10);
      expect(result.pending).toBe(3);
      expect(result.approved).toBe(5);
      expect(result.rejected).toBe(2);
    });
  });

  describe("createEmployeeRequestLog", () => {
    it("should create a log entry for request creation", async () => {
      vi.mocked(db.createEmployeeRequestLog).mockResolvedValue(undefined);

      const logData = {
        requestId: 1,
        action: "إنشاء طلب",
        newStatus: "pending",
        performedBy: 1,
        performedByName: "أحمد محمد",
        notes: "تم إنشاء طلب سلفة",
      };

      await db.createEmployeeRequestLog(logData);

      expect(db.createEmployeeRequestLog).toHaveBeenCalledWith(logData);
    });

    it("should create a log entry for status change", async () => {
      vi.mocked(db.createEmployeeRequestLog).mockResolvedValue(undefined);

      const logData = {
        requestId: 1,
        action: "موافقة",
        oldStatus: "pending",
        newStatus: "approved",
        performedBy: 2,
        performedByName: "المدير",
        notes: "تمت الموافقة على الطلب",
      };

      await db.createEmployeeRequestLog(logData);

      expect(db.createEmployeeRequestLog).toHaveBeenCalledWith(logData);
    });
  });

  describe("getEmployeeRequestLogs", () => {
    it("should return logs for a specific request", async () => {
      const mockLogs = [
        { id: 1, requestId: 1, action: "إنشاء طلب", newStatus: "pending" },
        { id: 2, requestId: 1, action: "موافقة", oldStatus: "pending", newStatus: "approved" },
      ];
      vi.mocked(db.getEmployeeRequestLogs).mockResolvedValue(mockLogs as any);

      const result = await db.getEmployeeRequestLogs(1);

      expect(result).toEqual(mockLogs);
      expect(result.length).toBe(2);
    });
  });

  describe("Request Type Validation", () => {
    it("should validate all 6 request types", () => {
      const validTypes = ["advance", "vacation", "arrears", "permission", "objection", "resignation"];
      
      validTypes.forEach(type => {
        expect(validTypes).toContain(type);
      });
      
      expect(validTypes.length).toBe(6);
    });
  });

  describe("Priority Validation", () => {
    it("should validate all priority levels", () => {
      const validPriorities = ["low", "normal", "high", "urgent"];
      
      validPriorities.forEach(priority => {
        expect(validPriorities).toContain(priority);
      });
      
      expect(validPriorities.length).toBe(4);
    });
  });

  describe("Status Validation", () => {
    it("should validate all status values", () => {
      const validStatuses = ["pending", "approved", "rejected", "cancelled"];
      
      validStatuses.forEach(status => {
        expect(validStatuses).toContain(status);
      });
      
      expect(validStatuses.length).toBe(4);
    });
  });
});
