import { describe, expect, it } from "vitest";
import type { RigaCatalogo } from "../prezzi/borsaitaliana";
import { leggiCatalogo, type Catalogo } from "./formato";
import { aggiornaCatalogo, type Fonti } from "./scaricamento";

const OGGI = "2026-10-20";
const opzioni = { oggi: OGGI, generato: `${OGGI}T17:30:00Z` };

/** Righe di listino inventate. */
function riga(isin: string, campi: Partial<RigaCatalogo> = {}): RigaCatalogo {
  return {
    isin,
    nome: `Btp Inventato ${isin.slice(-3)}`,
    cedolaAnnua: 3,
    dataScadenza: "2031-03-01",
    prezzo: 98,
    tipo: "fisso",
    emittente: "IT",
    frequenzaCedola: 2,
    ...campi,
  };
}

/** Fonti che rispondono tutte, con niente di nuovo: ogni test cambia la sua. */
function fonti(campi: Partial<Fonti> = {}): Fonti {
  return {
    listini: async () => ({ righe: [riga("IT0000000011")], scartate: [], pagine: 1 }),
    euribor6m: async () => ({ percentuale: 2.05, periodo: "2026-09", nome: "Euribor 6 mesi" }),
    elencaDocumentiMef: async () => [],
    leggiDocumentiMef: async () => [],
    schedaStepUp: async () => {
      throw new Error("scheda non prevista in questo test");
    },
    emissioneOnvista: async () => {
      throw new Error("prezzo di emissione non pubblicato");
    },
    dataGodimento: async () => {
      throw new Error("data non prevista in questo test");
    },
    scambi: async (isin) => ({
      letti: new Map(isin.map((i) => [i, { mediana: 50_000, sedute: 63, attive: 60 }])),
      falliti: [],
    }),
    ...campi,
  };
}

function ieri(campi: Partial<Catalogo> = {}): Catalogo {
  return {
    versione: 1,
    data: "2026-10-19",
    generato: "2026-10-19T17:30:00Z",
    euribor6m: { percentuale: 2.1, periodo: "2026-08" },
    titoli: [],
    emissioni: {},
    documentiMef: [],
    rapporto: { scartate: [], fontiMancanti: [] },
    ...campi,
  };
}

describe("aggiornaCatalogo", () => {
  it("senza listini fallisce: il catalogo di ieri resta com'era", async () => {
    await expect(
      aggiornaCatalogo(
        null,
        fonti({
          listini: async () => {
            throw new Error("Borsa Italiana ha risposto 503");
          },
        }),
        opzioni,
      ),
    ).rejects.toThrow(/catalogo invariato: Borsa Italiana ha risposto 503/);
    await expect(
      aggiornaCatalogo(null, fonti({ listini: async () => ({ righe: [], scartate: [], pagine: 1 }) }), opzioni),
    ).rejects.toThrow(/vuoti/);
  });

  it("scrive un catalogo che la pagina sa leggere", async () => {
    const { catalogo, rapporto } = await aggiornaCatalogo(null, fonti(), opzioni);
    expect(leggiCatalogo(JSON.parse(JSON.stringify(catalogo)))).toEqual(catalogo);
    expect(catalogo.titoli[0].scambi).toEqual({ mediana: 50_000, sedute: 63, attive: 60 });
    expect(rapporto.perTipo.fisso).toBe(1);
    expect(catalogo.rapporto.fontiMancanti).toEqual([]);
  });

  it("tiene i dati di emissione di ieri e non li richiede", async () => {
    const chiesti: string[] = [];
    const emissione = {
      prezzoEmissione: 99.1,
      dataEmissione: "2021-03-01",
      fonte: "onvista.de (WM Datenservice)",
      dataAggiornamento: "2026-09-01",
    };
    const { catalogo } = await aggiornaCatalogo(
      ieri({ emissioni: { IT0000000011: emissione } }),
      fonti({
        listini: async () => ({ righe: [riga("IT0000000011"), riga("IT0000000029")], scartate: [], pagine: 1 }),
        emissioneOnvista: async (isin) => {
          chiesti.push(isin);
          return { prezzoEmissione: 99.8, dataEmissione: "2022-01-15" };
        },
      }),
      opzioni,
    );
    expect(chiesti).toEqual(["IT0000000029"]);
    expect(catalogo.emissioni.IT0000000011).toEqual(emissione);
    expect(catalogo.emissioni.IT0000000029.prezzoEmissione).toBe(99.8);
  });

  it("il MEF vince su onvista, e la correzione si dice", async () => {
    const { catalogo, rapporto } = await aggiornaCatalogo(
      ieri({
        emissioni: {
          IT0000000011: {
            prezzoEmissione: 99.1,
            dataEmissione: "2021-03-01",
            fonte: "onvista.de (WM Datenservice)",
            dataAggiornamento: "2026-09-01",
          },
        },
      }),
      fonti({
        elencaDocumentiMef: async () => [{ url: "https://example.org/a.pdf", data: "2026-10-14" }],
        leggiDocumentiMef: async (d) =>
          d.map((x) => ({
            url: x.url,
            tipo: "letto" as const,
            risultato: {
              isin: "IT0000000011",
              prezzoFiscale: 99.05,
              dataEmissione: "2021-03-01",
              dataScadenza: "2031-03-01",
            },
          })),
      }),
      opzioni,
    );
    expect(catalogo.emissioni.IT0000000011.fonte).toBe("MEF, risultati d'asta");
    expect(rapporto.cambiati).toHaveLength(1);
    expect(catalogo.documentiMef).toEqual([{ url: "https://example.org/a.pdf", esito: "letto" }]);
  });

  it("un risultato d'asta di un titolo non ancora quotato si tiene per quando arriva", async () => {
    const asta = {
      prezzoEmissione: 99.4,
      dataEmissione: "2026-10-15",
      fonte: "MEF, risultati d'asta",
      dataAggiornamento: "2026-10-14",
    };
    const vecchio = { ...asta, dataAggiornamento: "2026-01-10" };
    const { catalogo } = await aggiornaCatalogo(
      ieri({ emissioni: { IT0000000037: asta, IT0000000045: vecchio } }),
      fonti(),
      opzioni,
    );
    expect(catalogo.emissioni.IT0000000037).toEqual(asta);
    // Fuori dal catalogo da troppo: è un titolo scaduto.
    expect(catalogo.emissioni.IT0000000045).toBeUndefined();
  });

  it("onvista senza dato: il tentativo si annota, i valori noti restano", async () => {
    const { catalogo, rapporto } = await aggiornaCatalogo(null, fonti(), opzioni);
    expect(rapporto.onvista).toEqual({
      chiesti: 1,
      trovati: 0,
      senzaDato: [{ isin: "IT0000000011", motivo: "prezzo di emissione non pubblicato" }],
    });
    expect(catalogo.emissioni.IT0000000011).toEqual({
      prezzoEmissione: null,
      dataEmissione: null,
      fonte: "onvista: prezzo di emissione non pubblicato",
      dataAggiornamento: OGGI,
    });
    expect(rapporto.senzaEmissione).toEqual(["IT0000000011"]);
  });

  it("senza BCE resta l'Euribor di ieri, e la pagina lo dice", async () => {
    const { catalogo } = await aggiornaCatalogo(
      ieri(),
      fonti({
        euribor6m: async () => {
          throw new Error("la BCE ha risposto 500");
        },
      }),
      opzioni,
    );
    expect(catalogo.euribor6m).toEqual({ percentuale: 2.1, periodo: "2026-08" });
    expect(catalogo.rapporto.fontiMancanti).toEqual([
      { fonte: "BCE (Euribor 6 mesi)", errore: "la BCE ha risposto 500" },
    ]);
  });

  it("senza Euronext gli scambi restano «non letti», non a zero", async () => {
    const { catalogo } = await aggiornaCatalogo(
      null,
      fonti({
        scambi: async () => {
          throw new Error("Euronext ha risposto 403");
        },
      }),
      opzioni,
    );
    expect(catalogo.titoli[0].scambi).toBeNull();
    expect(catalogo.rapporto.fontiMancanti.map((f) => f.fonte)).toEqual(["Euronext (scambi)"]);
  });

  it("il piano di uno step-up si tiene da ieri, senza rileggere la scheda", async () => {
    const gradini = [
      { dal: "2024-06-01", cedolaAnnua: 2.5 },
      { dal: "2028-06-01", cedolaAnnua: 3.1 },
    ];
    const { catalogo, rapporto } = await aggiornaCatalogo(
      ieri({
        titoli: [
          {
            isin: "IT0000000052",
            nome: "Btp Inventato Step-up",
            tipo: "stepUp",
            emittente: "IT",
            cedolaAnnua: 2.5,
            frequenzaCedola: 4,
            dataScadenza: "2030-06-01",
            prezzo: 100.4,
            spread: null,
            gradiniCedola: gradini,
            scambi: null,
          },
        ],
      }),
      fonti({
        listini: async () => ({
          righe: [
            riga("IT0000000052", {
              tipo: "stepUp",
              cedolaListino: 0.625,
              dataScadenza: "2030-06-01",
              prezzo: 100.5,
            }),
            riga("IT0000000060", { tipo: "stepUp", cedolaListino: 0.7, dataScadenza: "2031-06-01" }),
          ],
          scartate: [],
          pagine: 1,
        }),
      }),
      opzioni,
    );
    expect(catalogo.titoli.map((t) => t.isin)).toEqual(["IT0000000052"]);
    expect(catalogo.titoli[0].gradiniCedola).toEqual(gradini);
    expect(catalogo.titoli[0].frequenzaCedola).toBe(4);
    // Il nuovo, senza scheda, resta fuori col motivo.
    expect(rapporto.scartate.map((s) => s.isin)).toEqual(["IT0000000060"]);
  });
});
