import { describe, expect, it } from "vitest";
import { FONTE_MEF, FONTE_ONVISTA, cambiato, completa, daChiedereAOnvista, type EmissioneSalvata } from "./emissioni";

const oggi = "2026-10-20";
const riga = (fonte: string, prezzo: number | null = 99, data: string | null = "2024-01-11", agg = "2026-10-19"): EmissioneSalvata => ({
  prezzoEmissione: prezzo,
  dataEmissione: data,
  fonte,
  dataAggiornamento: agg,
});

describe("daChiedereAOnvista", () => {
  const salvate = new Map<string, EmissioneSalvata>([
    ["COMPLETO", riga(FONTE_ONVISTA)],
    ["MEF_SENZA_DATA", riga(FONTE_MEF, 99, null)],
    ["FALLITO_IERI", riga("onvista: prezzo di emissione non pubblicato", null, null)],
    ["FALLITO_OGGI", riga("onvista: prezzo di emissione non pubblicato", null, null, oggi)],
    ["FALLITO_A_MAGGIO", riga("onvista: prezzo di emissione non pubblicato", null, null, "2026-05-02")],
  ]);

  it("solo chi non ha dati completi: prima i mai chiesti, poi i falliti dal più vecchio", () => {
    const scelti = daChiedereAOnvista({
      catalogo: [
        "NUOVO",
        "COMPLETO",
        "MEF_SENZA_DATA",
        "FALLITO_IERI",
        "FALLITO_OGGI",
        "ALTRO",
        "FALLITO_A_MAGGIO",
      ],
      salvate,
      oggi,
      massimo: 40,
    });
    // Il MEF non si richiede altrove; chi ha fallito oggi aspetta domani.
    expect(scelti).toEqual(["NUOVO", "ALTRO", "FALLITO_A_MAGGIO", "FALLITO_IERI"]);
  });

  /** Altrimenti i titoli che onvista non copre occuperebbero tutti i posti, ogni giorno. */
  it("i falliti non tolgono il posto ai mai chiesti", () => {
    const tutti = new Map<string, EmissioneSalvata>([
      ["A", riga("onvista: non pubblicato", null, null)],
      ["B", riga("onvista: non pubblicato", null, null)],
    ]);
    expect(
      daChiedereAOnvista({ catalogo: ["A", "B", "C"], salvate: tutti, oggi, massimo: 1 }),
    ).toEqual(["C"]);
  });

  it("rispetta il tetto", () => {
    expect(
      daChiedereAOnvista({ catalogo: ["A", "B", "C"], salvate: new Map(), oggi, massimo: 2 }),
    ).toEqual(["A", "B"]);
  });
});

describe("completa e cambiato", () => {
  it("serve sia il prezzo sia la data", () => {
    expect(completa(riga(FONTE_MEF))).toBe(true);
    expect(completa(riga(FONTE_MEF, null))).toBe(false);
    expect(completa(riga(FONTE_MEF, 99, null))).toBe(false);
    expect(completa(undefined)).toBe(false);
  });

  it("più decimali dello stesso prezzo non sono un cambiamento", () => {
    expect(cambiato(riga(FONTE_ONVISTA, 99.97), { prezzoEmissione: 99.969, dataEmissione: "2024-01-11" })).toBe(true);
    expect(cambiato(riga(FONTE_ONVISTA, 99.62), { prezzoEmissione: 99.6202, dataEmissione: "2024-01-11" })).toBe(false);
    expect(cambiato(riga(FONTE_ONVISTA), { prezzoEmissione: 99, dataEmissione: "2024-01-12" })).toBe(true);
    expect(cambiato(undefined, { prezzoEmissione: 99, dataEmissione: "2024-01-12" })).toBe(false);
  });
});
