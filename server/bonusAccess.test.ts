import { describe, it, expect } from "vitest";
import { getBonusBranchScope, assertBonusBranchAccess } from "./bonus/access";

describe("bonus branch scope", () => {
  it("gives admin and manager all branches", () => {
    expect(getBonusBranchScope({ role: "admin", branchId: null })).toBeNull();
    expect(getBonusBranchScope({ role: "manager", branchId: 4 })).toBeNull();
  });
  it("limits a supervisor to their branch", () => {
    expect(getBonusBranchScope({ role: "supervisor", branchId: 2 })).toBe(2);
    expect(() => assertBonusBranchAccess({ role: "supervisor", branchId: 2 }, 3)).toThrow();
  });
  it("refuses a supervisor that is not linked to a branch", () => {
    expect(() => getBonusBranchScope({ role: "supervisor", branchId: null })).toThrow(/غير مرتبط بفرع/);
  });
  it("keeps a general supervisor (viewer) without a branch on all branches", () => {
    expect(getBonusBranchScope({ role: "viewer", branchId: null })).toBeNull();
  });
});
