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
    // Ieri la BCE aveva risposto: l'ultima lettura è il giorno di ieri.
    expect(catalogo.rapporto.fontiMancanti).toEqual([
      { fonte: "BCE (Euribor 6 mesi)", errore: "la BCE ha risposto 500", ultimaLettura: "2026-10-19" },
    ]);
  });

  it("senza Euronext e senza un catalogo di ieri gli scambi restano «non letti», non a zero", async () => {
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
    expect(catalogo.rapporto.fontiMancanti).toEqual([
      { fonte: "Euronext (scambi)", errore: "Euronext ha risposto 403", ultimaLettura: null },
    ]);
  });

  /** Un titolo di ieri con i suoi scambi, per vedere cosa resta quando Euronext non risponde. */
  function titoloDiIeri(isin: string, mediana: number): Catalogo["titoli"][number] {
    return {
      isin,
      nome: `Btp Inventato ${isin.slice(-3)}`,
      tipo: "fisso",
      emittente: "IT",
      cedolaAnnua: 3,
      frequenzaCedola: 2,
      dataScadenza: "2031-03-01",
      prezzo: 98,
      spread: null,
      gradiniCedola: null,
      scambi: { mediana, sedute: 64, attive: 61 },
    };
  }

  it("se Euronext non dà niente restano gli scambi di ieri, col giorno dell'ultima lettura", async () => {
    const { catalogo } = await aggiornaCatalogo(
      ieri({ titoli: [titoloDiIeri("IT0000000011", 42_000)] }),
      fonti({
        listini: async () => ({ righe: [riga("IT0000000011"), riga("IT0000000029")], scartate: [], pagine: 1 }),
        scambi: async () => ({ letti: new Map(), falliti: [] }),
      }),
      opzioni,
    );
    expect(catalogo.titoli.map((t) => t.scambi?.mediana ?? null)).toEqual([42_000, null]);
    expect(catalogo.rapporto.fontiMancanti).toEqual([
      { fonte: "Euronext (scambi)", errore: "nessuno storico letto", ultimaLettura: "2026-10-19" },
    ]);
  });

  it("se Euronext mancava già ieri, l'ultima lettura resta quella che ieri riportava", async () => {
    const { catalogo } = await aggiornaCatalogo(
      ieri({
        titoli: [titoloDiIeri("IT0000000011", 42_000)],
        rapporto: {
          scartate: [],
          fontiMancanti: [{ fonte: "Euronext (scambi)", errore: "nessuno storico letto", ultimaLettura: "2026-10-16" }],
        },
      }),
      fonti({
        scambi: async () => {
          throw new Error("Euronext ha risposto 503");
        },
      }),
      opzioni,
    );
    expect(catalogo.titoli[0].scambi?.mediana).toBe(42_000);
    expect(catalogo.rapporto.fontiMancanti[0].ultimaLettura).toBe("2026-10-16");
  });

  it("se Euronext risponde per qualche titolo, quelli che non legge restano «non letti»", async () => {
    const { catalogo } = await aggiornaCatalogo(
      ieri({ titoli: [titoloDiIeri("IT0000000011", 42_000), titoloDiIeri("IT0000000029", 9_000)] }),
      fonti({
        listini: async () => ({ righe: [riga("IT0000000011"), riga("IT0000000029")], scartate: [], pagine: 1 }),
        scambi: async () => ({
          letti: new Map([["IT0000000029", { mediana: 11_000, sedute: 65, attive: 60 }]]),
          falliti: [{ isin: "IT0000000011", motivo: "storico vuoto" }],
        }),
      }),
      opzioni,
    );
    expect(catalogo.titoli.map((t) => t.scambi?.mediana ?? null)).toEqual([null, 11_000]);
    expect(catalogo.rapporto.fontiMancanti).toEqual([]);
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

  describe("BTP Valore Insieme: la cedola unica dalla scheda di Borsa Italiana", () => {
    const insieme = riga("IT0000000078", {
      nome: "Btp Valore Insieme Inventato",
      tipo: "cedolaUnica",
      cedolaAnnua: 0,
      dataScadenza: "2031-10-27",
      prezzo: 100,
    });
    const listini = async () => ({ righe: [insieme], scartate: [], pagine: 1 });
    const scheda = (descrizione: string) => async () => ({
      godimento: "2026-10-27",
      periodicita: null,
      descrizione,
    });

    it("durante il collocamento resta in catalogo col minimo, che non è definitivo", async () => {
      const { catalogo } = await aggiornaCatalogo(
        null,
        fonti({
          listini,
          schedaStepUp: scheda(
            "L'importo minimo della cedola è pari al 22,25% del valore nominale del prestito e verrà pagata in un'unica soluzione a scadenza",
          ),
        }),
        opzioni,
      );
      expect(catalogo.titoli[0].cedolaUnica).toEqual({
        percentuale: 22.25,
        definitiva: false,
        godimento: "2026-10-27",
      });
      // Il catalogo scritto si rilegge.
      expect(leggiCatalogo(JSON.parse(JSON.stringify(catalogo))).titoli[0].cedolaUnica).toEqual(
        catalogo.titoli[0].cedolaUnica,
      );
    });

    it("una cedola definitiva di ieri si tiene, senza rileggere la scheda", async () => {
      const definitiva = { percentuale: 22.7, definitiva: true, godimento: "2026-10-27" };
      const { catalogo } = await aggiornaCatalogo(
        ieri({
          titoli: [
            {
              isin: "IT0000000078",
              nome: "Btp Valore Insieme Inventato",
              tipo: "cedolaUnica",
              emittente: "IT",
              cedolaAnnua: 0,
              frequenzaCedola: 2,
              dataScadenza: "2031-10-27",
              prezzo: 100,
              spread: null,
              gradiniCedola: null,
              cedolaUnica: definitiva,
              scambi: null,
            },
          ],
        }),
        fonti({ listini }),
        opzioni,
      );
      expect(catalogo.titoli[0].cedolaUnica).toEqual(definitiva);
    });

    it("senza scheda e senza ieri resta fuori col motivo", async () => {
      const { catalogo, rapporto } = await aggiornaCatalogo(null, fonti({ listini }), opzioni);
      expect(catalogo.titoli).toEqual([]);
      expect(rapporto.scartate[0]).toMatchObject({ isin: "IT0000000078" });
    });
  });
});
