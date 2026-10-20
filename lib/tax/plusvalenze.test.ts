import { describe, expect, it } from "vitest";
import {
  registraMinusvalenza,
  tassaPlusvalenza,
  tassaPlusvalenzaEntrambe,
} from "./plusvalenze";
import type { VoceZainetto } from "./zainetto";

describe("plusvalenza da titoli di Stato — meccanismo del 48,08%", () => {
  const voce2022: VoceZainetto = {
    annoCompetenza: 2022,
    importoResiduo: 300000, // 3.000,00 €
    dataScadenza: "2026-12-31",
  };

  it("senza zainetto: 12,5008% effettivo, non 12,5% esatto", () => {
    const esito = tassaPlusvalenza({
      plusvalenza: 1_000_000, // 10.000,00 €
      voci: [],
      data: "2026-06-30",
      compensazioneTitoliStatoRidotta: false,
    });
    expect(esito.imponibile).toBe(480800);
    // 4.808,00 × 26% = 1.250,08 € — non 1.250,00
    expect(esito.imposta).toBe(125008);
    expect(esito.aliquotaEffettiva).toBeCloseTo(0.125008, 6);
  });

  it("variante PIENA (default): lo zainetto compensa il 100% della plusvalenza", () => {
    const esito = tassaPlusvalenza({
      plusvalenza: 1_000_000,
      voci: [voce2022],
      data: "2026-06-30",
      compensazioneTitoliStatoRidotta: false,
    });
    expect(esito.minusvalenzeAssorbite).toBe(300000);
    // Scoperto 7.000,00 → imponibile 3.365,60 → imposta 875,06 €
    expect(esito.imponibile).toBe(336560);
    expect(esito.imposta).toBe(87506);
  });

  it("variante RIDOTTA: lo zainetto compensa solo la base al 48,08%", () => {
    const esito = tassaPlusvalenza({
      plusvalenza: 1_000_000,
      voci: [voce2022],
      data: "2026-06-30",
      compensazioneTitoliStatoRidotta: true,
    });
    // Base ridotta 4.808,00 → assorbiti 3.000,00 → restano 1.808,00 → imposta 470,08 €
    expect(esito.minusvalenzeAssorbite).toBe(300000);
    expect(esito.imponibile).toBe(180800);
    expect(esito.imposta).toBe(47008);
  });

  it("tassaPlusvalenzaEntrambe restituisce le due varianti affiancate", () => {
    const { compensazionePiena, compensazioneRidotta } = tassaPlusvalenzaEntrambe({
      plusvalenza: 1_000_000,
      voci: [voce2022],
      data: "2026-06-30",
    });
    expect(compensazionePiena.imposta).toBe(87506);
    expect(compensazioneRidotta.imposta).toBe(47008);
  });

  it("una voce scaduta non compensa: le due varianti tornano a coincidere", () => {
    const { compensazionePiena, compensazioneRidotta } = tassaPlusvalenzaEntrambe({
      plusvalenza: 1_000_000,
      voci: [voce2022],
      data: "2027-01-15",
    });
    expect(compensazionePiena.minusvalenzeAssorbite).toBe(0);
    expect(compensazionePiena.imposta).toBe(compensazioneRidotta.imposta);
  });
});

describe("registraMinusvalenza", () => {
  it("entra al 48,08% solo nella variante ridotta", () => {
    const ridotta = registraMinusvalenza({
      minusvalenza: 100000, // 1.000,00 €
      annoVendita: 2026,
      compensazioneTitoliStatoRidotta: true,
    });
    expect(ridotta).toEqual({
      annoCompetenza: 2026,
      importo: 48080, // 480,80 €
      dataScadenza: "2030-12-31",
    });

    const piena = registraMinusvalenza({
      minusvalenza: 100000,
      annoVendita: 2026,
      compensazioneTitoliStatoRidotta: false,
    });
    expect(piena.importo).toBe(100000);
  });

  /**
   * Il motivo per cui il flag governa entrambi i lati. Con la riduzione
   * applicata solo in entrata, una perdita e un guadagno di pari importo
   * sullo stesso titolo lascerebbero 64,90 € di imposta su un'operazione in
   * pari. Qui si verifica che entrambe le varianti chiudano a zero.
   */
  it("perdita e guadagno di pari importo: imposta zero in entrambe", () => {
    for (const ridotta of [false, true]) {
      const minus = registraMinusvalenza({
        minusvalenza: 100000,
        annoVendita: 2026,
        compensazioneTitoliStatoRidotta: ridotta,
      });
      const esito = tassaPlusvalenza({
        plusvalenza: 100000,
        voci: [
          {
            annoCompetenza: 2026,
            importoResiduo: minus.importo,
            dataScadenza: minus.dataScadenza,
          },
        ],
        data: "2026-07-29",
        compensazioneTitoliStatoRidotta: ridotta,
      });
      expect(esito.imposta).toBe(0);
    }
  });

  it("input negativo: errore esplicito", () => {
    expect(() =>
      registraMinusvalenza({
        minusvalenza: -1,
        annoVendita: 2026,
        compensazioneTitoliStatoRidotta: false,
      }),
    ).toThrow();
    expect(() =>
      tassaPlusvalenza({
        plusvalenza: -1,
        voci: [],
        data: "2026-01-01",
        compensazioneTitoliStatoRidotta: false,
      }),
    ).toThrow();
  });
});
