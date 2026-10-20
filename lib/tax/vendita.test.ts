import { describe, expect, it } from "vitest";
import { calcolaVendita } from "./vendita";

describe("calcolaVendita — LIFO + tassazione", () => {
  it("rimborso in plusvalenza: entrambe le varianti, che coincidono senza zainetto", () => {
    const esito = calcolaVendita({
      lotti: [
        { id: 1, quantita: 10000, prezzoCarico: 91.3, commissioni: 800, dataAcquisto: "2022-09-12" },
      ],
      quantita: 10000,
      prezzo: 100, // rimborso alla pari
      voci: [],
      data: "2030-03-01",
    });
    // 10.000,00 − (9.130,00 + 8,00) = 862,00 €
    expect(esito.lifo.plusMinus).toBe(86200);
    expect(esito.nuovaMinusvalenza).toBeUndefined();
    // Imponibile 48,08%: 414,45 € → imposta 107,76 €
    expect(esito.plusvalenza?.compensazionePiena.imposta).toBe(10776);
    expect(esito.plusvalenza?.compensazioneRidotta.imposta).toBe(10776);
  });

  it("vendita in perdita: le due varianti divergono sul 48,08%", () => {
    const esito = calcolaVendita({
      lotti: [
        { id: 1, quantita: 10000, prezzoCarico: 102, commissioni: 0, dataAcquisto: "2024-01-10" },
      ],
      quantita: 10000,
      prezzo: 100,
      voci: [],
      data: "2026-07-23",
    });
    expect(esito.lifo.plusMinus).toBe(-20000); // −200,00 €
    expect(esito.plusvalenza).toBeUndefined();
    expect(esito.nuovaMinusvalenza!.compensazionePiena).toEqual({
      annoCompetenza: 2026,
      importo: 20000,
      dataScadenza: "2030-12-31",
    });
    expect(esito.nuovaMinusvalenza!.compensazioneRidotta.importo).toBe(9616);
  });

  it("vendita esattamente in pari: né plusvalenza né minusvalenza", () => {
    const esito = calcolaVendita({
      lotti: [
        { id: 1, quantita: 1000, prezzoCarico: 100, commissioni: 0, dataAcquisto: "2024-01-10" },
      ],
      quantita: 1000,
      prezzo: 100,
      voci: [],
      data: "2026-07-23",
    });
    expect(esito.lifo.plusMinus).toBe(0);
    expect(esito.plusvalenza).toBeUndefined();
    expect(esito.nuovaMinusvalenza).toBeUndefined();
  });
});
