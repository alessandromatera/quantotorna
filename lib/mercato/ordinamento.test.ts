import { describe, expect, it } from "vitest";
import {
  ORDINAMENTO_PREDEFINITO,
  cambiaOrdinamento,
  descriviOrdinamento,
  ordinaCandidati,
  raggruppaPerAnno,
  spareggio,
  type CandidatoOrdinabile,
} from "./ordinamento";

function btp(p: Partial<CandidatoOrdinabile> & { isin: string }): CandidatoOrdinabile {
  return {
    dataScadenza: "2030-01-01",
    ytmNettoPct: 3,
    plusRimborso: 0,
    cedolaAnnua: 3,
    prezzo: 100,
    durationModificata: 3,
    scambiMediana: 100_000,
    nettoSuSpesa: { incassi: 1_100_000 },
    ...p,
  };
}

const isin = (titoli: CandidatoOrdinabile[]) => titoli.map((t) => t.isin);

describe("ordinaCandidati", () => {
  it("per scadenza: la più vicina prima, o la più lontana invertendo", () => {
    const titoli = [
      btp({ isin: "C", dataScadenza: "2032-03-01" }),
      btp({ isin: "A", dataScadenza: "2027-09-15" }),
      btp({ isin: "B", dataScadenza: "2029-12-01" }),
    ];
    expect(isin(ordinaCandidati(titoli, { chiave: "scadenza", verso: "asc" }))).toEqual(["A", "B", "C"]);
    expect(isin(ordinaCandidati(titoli, { chiave: "scadenza", verso: "desc" }))).toEqual(["C", "B", "A"]);
  });

  it("per YTM: il rendimento migliore prima", () => {
    const titoli = [btp({ isin: "A", ytmNettoPct: 2.5 }), btp({ isin: "B", ytmNettoPct: 3.4 })];
    expect(isin(ordinaCandidati(titoli, { chiave: "ytm", verso: "desc" }))).toEqual(["B", "A"]);
  });

  /** «3,12%» e «3,12%» sono a pari merito anche se i valori pieni differiscono. */
  it("a pari YTM mostrato decide la scadenza più vicina", () => {
    const titoli = [
      btp({ isin: "A", ytmNettoPct: 3.121, dataScadenza: "2031-01-01" }),
      btp({ isin: "B", ytmNettoPct: 3.119, dataScadenza: "2029-01-01" }),
    ];
    expect(isin(ordinaCandidati(titoli, { chiave: "ytm", verso: "desc" }))).toEqual(["B", "A"]);
  });

  it("su ogni altra colonna, a pari merito decide lo YTM netto più alto", () => {
    const titoli = [
      btp({ isin: "A", cedolaAnnua: 4, ytmNettoPct: 3.1 }),
      btp({ isin: "B", cedolaAnnua: 4, ytmNettoPct: 3.5 }),
      btp({ isin: "C", cedolaAnnua: 5, ytmNettoPct: 2.9 }),
    ];
    expect(isin(ordinaCandidati(titoli, { chiave: "cedola", verso: "desc" }))).toEqual(["C", "B", "A"]);
    expect(spareggio("cedola")).toEqual({ chiave: "ytm", verso: "desc" });
    expect(spareggio("ytm")).toEqual({ chiave: "scadenza", verso: "asc" });
  });

  it("chi non ha il valore finisce in fondo in entrambi i versi", () => {
    const titoli = [
      btp({ isin: "A", durationModificata: null }),
      btp({ isin: "B", durationModificata: 7 }),
      btp({ isin: "C", durationModificata: 1.5 }),
    ];
    expect(isin(ordinaCandidati(titoli, { chiave: "duration", verso: "asc" }))).toEqual(["C", "B", "A"]);
    expect(isin(ordinaCandidati(titoli, { chiave: "duration", verso: "desc" }))).toEqual(["B", "C", "A"]);
  });

  /** Due titoli che leggono «163 mila €» sono a pari merito: decide lo YTM. */
  it("per scambi: alla precisione con cui si scrivono", () => {
    const titoli = [
      btp({ isin: "A", scambiMediana: 163_151, ytmNettoPct: 3 }),
      btp({ isin: "B", scambiMediana: 162_700, ytmNettoPct: 3.4 }),
      btp({ isin: "C", scambiMediana: null }),
      btp({ isin: "D", scambiMediana: 4_400_000 }),
    ];
    expect(isin(ordinaCandidati(titoli, { chiave: "scambi", verso: "desc" }))).toEqual(["D", "B", "A", "C"]);
  });

  /**
   * Il netto a scadenza premia anche il tempo: a parità di rendimento annuo,
   * dieci anni danno più euro di due. È la domanda «quanto mi ritrovo», non
   * «quanto rende», e dentro lo stesso anno coincide quasi con lo YTM.
   */
  it("per netto a scadenza: chi restituisce di più prima", () => {
    const titoli = [
      btp({ isin: "A", nettoSuSpesa: { incassi: 1_080_000 } }),
      btp({ isin: "B", nettoSuSpesa: { incassi: 1_420_000 } }),
      btp({ isin: "C", nettoSuSpesa: null }),
    ];
    expect(isin(ordinaCandidati(titoli, { chiave: "netto", verso: "desc" }))).toEqual(["B", "A", "C"]);
  });

  it("per prezzo: il più basso prima", () => {
    const titoli = [btp({ isin: "A", prezzo: 101.2 }), btp({ isin: "B", prezzo: 87.1 })];
    expect(isin(ordinaCandidati(titoli, { chiave: "prezzo", verso: "asc" }))).toEqual(["B", "A"]);
  });

  it("a pari merito su tutto resta stabile sull'ISIN, e non tocca l'array di partenza", () => {
    const titoli = [btp({ isin: "B" }), btp({ isin: "A" })];
    expect(isin(ordinaCandidati(titoli, { chiave: "plus", verso: "desc" }))).toEqual(["A", "B"]);
    expect(isin(titoli)).toEqual(["B", "A"]);
  });
});

describe("cambiaOrdinamento", () => {
  it("la stessa colonna inverte, un'altra parte dal suo verso iniziale", () => {
    expect(cambiaOrdinamento({ chiave: "ytm", verso: "desc" }, "ytm")).toEqual({ chiave: "ytm", verso: "asc" });
    expect(cambiaOrdinamento({ chiave: "ytm", verso: "asc" }, "scadenza")).toEqual({ chiave: "scadenza", verso: "asc" });
    expect(cambiaOrdinamento({ chiave: "ytm", verso: "desc" }, "duration")).toEqual({ chiave: "duration", verso: "asc" });
    expect(cambiaOrdinamento({ chiave: "ytm", verso: "desc" }, "scambi")).toEqual({ chiave: "scambi", verso: "desc" });
  });
});

describe("descriviOrdinamento", () => {
  it("dice a parole colonna e verso", () => {
    expect(descriviOrdinamento(ORDINAMENTO_PREDEFINITO)).toBe("YTM netto, dal più alto");
    expect(descriviOrdinamento({ chiave: "scadenza", verso: "asc" })).toBe("scadenza, dalla più vicina");
    expect(descriviOrdinamento({ chiave: "duration", verso: "asc" })).toBe("duration, dal più basso");
  });
});

describe("raggruppaPerAnno", () => {
  /** La domanda più comune: per ogni anno, il migliore in cima. */
  it("divide per anno senza toccare l'ordine dentro l'anno", () => {
    const ordinati = ordinaCandidati(
      [
        btp({ isin: "A", dataScadenza: "2031-02-01", ytmNettoPct: 3.2 }),
        btp({ isin: "B", dataScadenza: "2029-06-01", ytmNettoPct: 3.0 }),
        btp({ isin: "C", dataScadenza: "2031-11-01", ytmNettoPct: 3.6 }),
        btp({ isin: "D", dataScadenza: "2029-01-01", ytmNettoPct: 3.3 }),
      ],
      ORDINAMENTO_PREDEFINITO,
    );
    const gruppi = raggruppaPerAnno(ordinati, ORDINAMENTO_PREDEFINITO);
    expect(gruppi.map((g) => [g.anno, isin(g.titoli)])).toEqual([
      [2029, ["D", "B"]],
      [2031, ["C", "A"]],
    ]);
  });

  it("per scadenza dalla più lontana, anche gli anni la seguono", () => {
    const o = { chiave: "scadenza", verso: "desc" } as const;
    const ordinati = ordinaCandidati(
      [btp({ isin: "A", dataScadenza: "2029-01-01" }), btp({ isin: "B", dataScadenza: "2033-01-01" })],
      o,
    );
    expect(raggruppaPerAnno(ordinati, o).map((g) => g.anno)).toEqual([2033, 2029]);
  });
});
