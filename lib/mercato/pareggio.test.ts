import { describe, expect, it } from "vitest";
import { inflazionePareggio, tassoReale } from "../costi/inflazione";
import { leggiPareggio } from "./pareggio";

describe("inflazionePareggio", () => {
  it("è l'inverso esatto di tassoReale", () => {
    const nominale = 3.6;
    const reale = 1.4;
    const pareggio = inflazionePareggio(nominale, reale);
    expect(tassoReale(nominale, pareggio)).toBeCloseTo(reale, 10);
  });

  it("non è la sottrazione: su tassi alti lo scarto si vede", () => {
    // 8% nominale contro 3% reale: l'approssimazione direbbe 5%.
    expect(inflazionePareggio(8, 3)).toBeCloseTo(4.854, 3);
  });

  it("con rendimento reale nullo il pareggio è il rendimento nominale", () => {
    expect(inflazionePareggio(2.5, 0)).toBeCloseTo(2.5, 10);
  });
});

describe("leggiPareggio", () => {
  it("pareggio sopra l'attesa: conviene il tasso fisso", () => {
    expect(leggiPareggio(2.4, 1.6)).toEqual({ verdetto: "fisso", scartoPp: 0.8 });
  });

  it("pareggio sotto l'attesa: conviene l'indicizzato", () => {
    expect(leggiPareggio(1.2, 2)).toEqual({
      verdetto: "indicizzato",
      scartoPp: -0.8,
    });
  });

  /**
   * Sotto il decimo di punto non si dichiara un vincitore: le due scadenze
   * non sono identiche e l'attesa di inflazione è un numero tondo, quindi
   * sarebbe una precisione che i dati non hanno.
   */
  it("differenze minime restano un pareggio", () => {
    expect(leggiPareggio(2.04, 2).verdetto).toBe("pari");
    expect(leggiPareggio(1.95, 2).verdetto).toBe("pari");
    expect(leggiPareggio(2.11, 2).verdetto).toBe("fisso");
  });
});
