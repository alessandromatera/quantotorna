import { describe, expect, it } from "vitest";
import { inflazionePareggio, tassoReale } from "./inflazione";

describe("tassoReale", () => {
  it("usa Fisher esatto, non la sottrazione", () => {
    // (1,0035 / 1,02) − 1 = −1,6176…%, non −1,65%
    expect(tassoReale(0.35, 2)).toBeCloseTo(-1.6176, 3);
  });

  it("un rendimento pari all'inflazione dà zero reale", () => {
    expect(tassoReale(2, 2)).toBeCloseTo(0, 10);
  });

  it("senza inflazione reale e nominale coincidono", () => {
    expect(tassoReale(3.15, 0)).toBeCloseTo(3.15, 10);
  });

  it("la differenza da «nominale − inflazione» cresce coi tassi alti", () => {
    const esatto = tassoReale(10, 8);
    expect(esatto).toBeCloseTo(1.8519, 3); // non 2%
    expect(esatto).toBeLessThan(2);
  });
});

describe("inflazionePareggio", () => {
  it("è l'inverso esatto di tassoReale", () => {
    const pareggio = inflazionePareggio(3.6, 1.4);
    expect(tassoReale(3.6, pareggio)).toBeCloseTo(1.4, 10);
  });

  it("non è la sottrazione: su tassi alti lo scarto si vede", () => {
    // 8% nominale contro 3% reale: l'approssimazione direbbe 5%.
    expect(inflazionePareggio(8, 3)).toBeCloseTo(4.854, 3);
  });
});
