import { describe, expect, it } from "vitest";
import {
  ESTABLISHMENTS,
  GROUP_ESTABLISHMENT,
  getEstablishmentForBranch,
  getEstablishmentForBranches,
  matchEstablishmentKey,
} from "../shared/branding";

describe("getEstablishmentForBranch", () => {
  it("maps Laban to مؤسسة قصه وتخفيف and Tuwaiq to مؤسسة تدرج وتخفيف", () => {
    expect(getEstablishmentForBranch("فرع لبن").nameAr).toBe("مؤسسة قصه وتخفيف");
    expect(getEstablishmentForBranch("فرع طويق").nameAr).toBe("مؤسسة تدرج وتخفيف");
    expect(getEstablishmentForBranch("فرع طريق").key).toBe("tadarruj");
  });

  it("matches English names, diacritics, tatweel and object branches", () => {
    expect(getEstablishmentForBranch("Laban Branch")).toBe(ESTABLISHMENTS.qessa);
    expect(getEstablishmentForBranch("TUWAIQ")).toBe(ESTABLISHMENTS.tadarruj);
    expect(getEstablishmentForBranch("فرع لَبَن")).toBe(ESTABLISHMENTS.qessa);
    expect(getEstablishmentForBranch("فرع طـويق")).toBe(ESTABLISHMENTS.tadarruj);
    expect(getEstablishmentForBranch({ name: "Olaya", nameAr: "فرع لبن" })).toBe(ESTABLISHMENTS.qessa);
    expect(getEstablishmentForBranch({ branchName: "طويق" })).toBe(ESTABLISHMENTS.tadarruj);
  });

  it("matches whole words only and falls back to the group identity", () => {
    expect(getEstablishmentForBranch("فرع لبنان")).toBe(GROUP_ESTABLISHMENT);
    expect(getEstablishmentForBranch("فرع العليا")).toBe(GROUP_ESTABLISHMENT);
    expect(getEstablishmentForBranch(null)).toBe(GROUP_ESTABLISHMENT);
    expect(getEstablishmentForBranch("")).toBe(GROUP_ESTABLISHMENT);
    expect(matchEstablishmentKey("لبن", "طويق")).toBeNull();
  });

  it("never prints the system name on documents", () => {
    for (const e of [ESTABLISHMENTS.qessa, ESTABLISHMENTS.tadarruj, GROUP_ESTABLISHMENT]) {
      expect(e.name).toBe("");
      expect(e.logo).toBe("");
      expect(`${e.nameAr} ${e.email}`).not.toMatch(/symbol|سيمبول/i);
    }
  });
});

describe("getEstablishmentForBranches", () => {
  it("uses the shared establishment when every branch agrees, else the group", () => {
    expect(getEstablishmentForBranches(["فرع لبن", "Laban"])).toBe(ESTABLISHMENTS.qessa);
    expect(getEstablishmentForBranches(["فرع لبن", "فرع طويق"])).toBe(GROUP_ESTABLISHMENT);
    expect(getEstablishmentForBranches([])).toBe(GROUP_ESTABLISHMENT);
  });
});
