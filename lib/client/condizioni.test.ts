import { describe, expect, it } from "vitest";
import { CONDIZIONI_PREDEFINITE, leggiCondizioni, zainettoVivo } from "./condizioni";

describe("leggiCondizioni", () => {
  it("senza salvataggio, o con un salvataggio rotto, valgono quelle di partenza", () => {
    expect(leggiCondizioni(null)).toEqual(CONDIZIONI_PREDEFINITE);
    expect(leggiCondizioni("{non è json")).toEqual(CONDIZIONI_PREDEFINITE);
    expect(leggiCondizioni("[1,2]")).toEqual(CONDIZIONI_PREDEFINITE);
  });

  it("tiene i campi validi e rimpiazza quelli fuori forma uno per uno", () => {
    const c = leggiCondizioni(
      JSON.stringify({
        nominale: 25_000,
        tariffa: { percentuale: 0.15, minimo: "tanto", massimo: 1_500, fisso: 0 },
        compensazioneTitoliStatoRidotta: "sì",
        inflazioneAttesa: 2.4,
      }),
    );
    expect(c.nominale).toBe(25_000);
    expect(c.tariffa).toEqual({ percentuale: 0.15, minimo: 0, massimo: 1_500, fisso: 0 });
    expect(c.compensazioneTitoliStatoRidotta).toBe(false);
    expect(c.inflazioneAttesa).toBe(2.4);
  });

  it("rifiuta nominali assurdi", () => {
    expect(leggiCondizioni(JSON.stringify({ nominale: -5 })).nominale).toBe(10_000);
    expect(leggiCondizioni(JSON.stringify({ nominale: 1e12 })).nominale).toBe(10_000);
  });

  it("zainetto: scarta le voci senza senso e ricalcola la scadenza dall'anno", () => {
    const c = leggiCondizioni(
      JSON.stringify({
        zainetto: [
          { annoCompetenza: 2025, importoResiduo: 120_000, dataScadenza: "2099-01-01" },
          { annoCompetenza: 2023, importoResiduo: 50_000 },
          { annoCompetenza: 2024.5, importoResiduo: 1_000 },
          { annoCompetenza: 2024, importoResiduo: -3 },
          "voce",
        ],
      }),
    );
    expect(c.zainetto).toEqual([
      { annoCompetenza: 2023, importoResiduo: 50_000, dataScadenza: "2027-12-31" },
      { annoCompetenza: 2025, importoResiduo: 120_000, dataScadenza: "2029-12-31" },
    ]);
  });
});

describe("zainettoVivo", () => {
  it("lascia fuori le minusvalenze già scadute alla data", () => {
    const voci = leggiCondizioni(
      JSON.stringify({
        zainetto: [
          { annoCompetenza: 2021, importoResiduo: 10_000 },
          { annoCompetenza: 2022, importoResiduo: 20_000 },
        ],
      }),
    ).zainetto;
    expect(zainettoVivo(voci, "2026-10-20").map((v) => v.annoCompetenza)).toEqual([2022]);
  });
});
