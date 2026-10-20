import { describe, expect, it } from "vitest";
import { leggiCatalogo } from "./formato";

/** Un catalogo minimo e valido, con un titolo inventato. */
function grezzo(): Record<string, unknown> {
  return {
    versione: 1,
    data: "2026-10-20",
    generato: "2026-10-20T18:00:00Z",
    euribor6m: { percentuale: 2.1, periodo: "2026-09" },
    titoli: [
      {
        isin: "IT0000000011",
        nome: "Btp Inventato 3% Mz31",
        tipo: "fisso",
        emittente: "IT",
        cedolaAnnua: 3,
        frequenzaCedola: 2,
        dataScadenza: "2031-03-01",
        prezzo: 98.5,
        spread: null,
        gradiniCedola: null,
        scambi: { mediana: 120_000, sedute: 63, attive: 63 },
      },
    ],
    emissioni: {
      IT0000000011: {
        prezzoEmissione: 99.4,
        dataEmissione: "2021-03-01",
        fonte: "MEF, risultati d'asta",
        dataAggiornamento: "2026-10-20",
      },
    },
    documentiMef: [{ url: "https://example.org/asta.pdf", esito: "letto" }],
    rapporto: { scartate: [], fontiMancanti: [] },
  };
}

describe("leggiCatalogo", () => {
  it("accetta un catalogo in forma", () => {
    const c = leggiCatalogo(grezzo());
    expect(c.emissioni.IT0000000011.prezzoEmissione).toBe(99.4);
    expect(c.euribor6m?.periodo).toBe("2026-09");
  });

  it("rifiuta una versione diversa", () => {
    expect(() => leggiCatalogo({ ...grezzo(), versione: 2 })).toThrow(/versione 2/);
  });

  it("dice quale campo è fuori forma", () => {
    const g = grezzo();
    (g.titoli as Record<string, unknown>[])[0].prezzo = "98,5";
    expect(() => leggiCatalogo(g)).toThrow("titoli[0].prezzo: atteso un numero");
  });

  it("rifiuta famiglie ed emittenti che il motore non conosce", () => {
    const g = grezzo();
    (g.titoli as Record<string, unknown>[])[0].tipo = "corporate";
    expect(() => leggiCatalogo(g)).toThrow(/tipo: «corporate» sconosciuto/);
    const h = grezzo();
    (h.titoli as Record<string, unknown>[])[0].emittente = "XX";
    expect(() => leggiCatalogo(h)).toThrow(/emittente: «XX» sconosciuto/);
  });

  it("rifiuta date impossibili, ISIN duplicati e cataloghi vuoti", () => {
    const g = grezzo();
    (g.titoli as Record<string, unknown>[])[0].dataScadenza = "2031-02-30";
    expect(() => leggiCatalogo(g)).toThrow(/dataScadenza: attesa una data ISO/);
    const h = grezzo();
    h.titoli = [...(h.titoli as unknown[]), ...(h.titoli as unknown[])];
    expect(() => leggiCatalogo(h)).toThrow(/compare due volte/);
    expect(() => leggiCatalogo({ ...grezzo(), titoli: [] })).toThrow(/nessun titolo/);
  });

  it("rifiuta un'emissione a metà, ma accetta il tentativo andato a vuoto", () => {
    const g = grezzo();
    (g.emissioni as Record<string, Record<string, unknown>>).IT0000000011.dataEmissione = "ieri";
    expect(() => leggiCatalogo(g)).toThrow("emissioni.IT0000000011.dataEmissione: attesa una data ISO");
    const h = grezzo();
    h.emissioni = {
      IT0000000011: {
        prezzoEmissione: null,
        dataEmissione: null,
        fonte: "onvista: prezzo di emissione non pubblicato",
        dataAggiornamento: "2026-10-20",
      },
    };
    expect(leggiCatalogo(h).emissioni.IT0000000011.prezzoEmissione).toBeNull();
  });

  it("accetta i vuoti dichiarati: scambi mai letti, Euribor assente", () => {
    const g = grezzo();
    const t = (g.titoli as Record<string, unknown>[])[0];
    t.scambi = null;
    g.euribor6m = null;
    const c = leggiCatalogo(g);
    expect(c.titoli[0].scambi).toBeNull();
    expect(c.euribor6m).toBeNull();
  });
});
