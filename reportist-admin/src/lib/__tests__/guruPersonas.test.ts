import { describe, it, expect } from "vitest";
import { findGuruPersona, getGuruPersonaBilingual } from "../guruPersonas";

describe("guruPersonas bilingual & alias resolution", () => {
  it("resolves 애스워스 다모다란 and aliases to Aswath Damodaran in English", () => {
    const rawNames = [
      "애스워스 다모다란",
      "애스워스-다모다란",
      "애스워스다모다란",
      "아스워스 다모다란",
      "아스워스-다모다란",
      "다모다란",
      "damodaran",
    ];

    for (const raw of rawNames) {
      const persona = findGuruPersona(raw);
      expect(persona, `Failed for ${raw}`).not.toBeNull();
      expect(persona?.englishName).toBe("Aswath Damodaran");

      const bi = getGuruPersonaBilingual(persona!, true);
      expect(bi?.name).toBe("Aswath Damodaran");
      expect(bi?.quote).toBeTruthy();
      expect(bi?.style).toBe("Dean of Valuation / Intrinsic DCF & Corporate Finance");
    }
  });

  it("resolves other roster gurus accurately", () => {
    const templeton = findGuruPersona("존-템플턴");
    expect(templeton).not.toBeNull();
    expect(templeton?.englishName).toBe("John Templeton");

    const buffett = findGuruPersona("워런-버핏");
    expect(buffett).not.toBeNull();
    expect(buffett?.englishName).toBe("Warren Buffett");
  });
});
