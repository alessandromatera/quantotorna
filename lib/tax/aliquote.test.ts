import { describe, expect, it } from "vitest";
import { ALIQUOTA_ORDINARIA, QUOTA_IMPONIBILE_TITOLI_STATO } from "./aliquote";

describe("meccanismo del 48,08%", () => {
  it("il 26% sul 48,08% dà il 12,5008% effettivo (non esattamente 12,5%)", () => {
    expect(ALIQUOTA_ORDINARIA * QUOTA_IMPONIBILE_TITOLI_STATO).toBeCloseTo(
      0.125008,
      6,
    );
  });
});
