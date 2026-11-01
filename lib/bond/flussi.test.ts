import { describe, expect, it } from "vitest";
import { parametriTitolo, type TitoloValutato } from "../catalogo/metriche";
import { TARIFFA_NULLA, type TariffaMercato } from "../costi/commissioni";
import { simulaAcquisto } from "./acquisto";
import { pianoFlussi } from "./flussi";
import { flussiNetti } from "./ytm";

/** Un BTP inventato, con disaggio. */
const btp: TitoloValutato = {
  isin: "IT0000000011",
  nome: "Btp Inventato 3% Mz31",
  tipo: "fisso",
  emittente: "IT",
  cedolaAnnua: 3,
  frequenzaCedola: 2,
  dataScadenza: "2031-03-01",
  prezzo: 98,
  spread: null,
  gradiniCedola: null,
  emissione: {
    prezzoEmissione: 99.2,
    dataEmissione: "2021-03-01",
    fonte: "MEF, risultati d'asta",
    dataAggiornamento: "2026-10-01",
  },
  scambi: null,
};
const OGGI = "2026-10-20";

const bot: TitoloValutato = {
  ...btp,
  isin: "IT0000000052",
  nome: "Bot Inventato Ap27",
  tipo: "bot",
  cedolaAnnua: 0,
  frequenzaCedola: 1,
  dataScadenza: "2027-04-14",
  prezzo: 98.4,
  emissione: {
    prezzoEmissione: 97.8,
    dataEmissione: "2026-04-14",
    fonte: "MEF, risultati d'asta",
    dataAggiornamento: "2026-10-01",
  },
};

const stepUp: TitoloValutato = {
  ...btp,
  isin: "IT0000000029",
  tipo: "stepUp",
  frequenzaCedola: 4,
  cedolaAnnua: 2.5,
  dataScadenza: "2030-06-01",
  prezzo: 100.5,
  gradiniCedola: [
    { dal: "2024-06-01", cedolaAnnua: 2.5 },
    { dal: "2028-06-01", cedolaAnnua: 3.1 },
  ],
  emissione: null,
};

const nuovo: TitoloValutato = {
  ...btp,
  isin: "IT0000000037",
  cedolaAnnua: 3.5,
  dataScadenza: "2036-08-01",
  prezzo: 100.5,
  emissione: {
    prezzoEmissione: 100,
    dataEmissione: "2026-10-01",
    fonte: "MEF, risultati d'asta",
    dataAggiornamento: "2026-10-22",
  },
};

const insieme: TitoloValutato = {
  ...btp,
  isin: "IT0000000045",
  tipo: "cedolaUnica",
  cedolaAnnua: 0,
  dataScadenza: "2031-10-27",
  prezzo: 101,
  cedolaUnica: { percentuale: 22.7, definitiva: true, godimento: "2026-10-27" },
  emissione: null,
};

const CON_COMMISSIONI: TariffaMercato = { percentuale: 0.19, minimo: 295, massimo: 1_900, fisso: 0 };

const casi: [string, TitoloValutato, string][] = [
  ["BTP con disaggio", btp, OGGI],
  ["BOT con scarto", bot, OGGI],
  ["step-up", stepUp, OGGI],
  ["prima cedola corta", nuovo, "2026-10-23"],
  ["cedola unica", insieme, "2026-11-26"],
];

describe("pianoFlussi", () => {
  for (const [nome, titolo, giorno] of casi) {
    for (const [etichetta, tariffa] of [
      ["senza commissioni", TARIFFA_NULLA],
      ["con commissioni", CON_COMMISSIONI],
    ] as const) {
      it(`${nome}, ${etichetta}: il totale è il guadagno netto di «Se lo compro», al centesimo`, () => {
        const base = parametriTitolo(titolo, giorno, 25_000);
        const s = simulaAcquisto(base, tariffa)!;
        const piano = pianoFlussi(base, tariffa)!;
        expect(piano.costo).toBe(s.costoNetto);
        expect(piano.guadagnoNetto).toBe(s.rendimento!.guadagnoNetto);
        const netti = piano.righe.reduce((somma, r) => somma + r.netto, 0);
        expect(netti).toBe(piano.guadagnoNetto);
        expect(piano.righe[piano.righe.length - 1].cumulato).toBe(piano.guadagnoNetto);
      });

      it(`${nome}, ${etichetta}: le date dopo l'acquisto sono i flussi netti del motore`, () => {
        const base = parametriTitolo(titolo, giorno, 25_000);
        const s = simulaAcquisto(base, tariffa)!;
        const piano = pianoFlussi(base, tariffa)!;
        const motore = flussiNetti({ ...base, commissioni: s.commissioni });
        expect(piano.righe.slice(1).map((r) => ({ data: r.data, importo: r.netto }))).toEqual(motore);
      });
    }
  }

  it("la prima riga è l'acquisto al regolamento, in uscita per il costo netto", () => {
    const base = parametriTitolo(btp, OGGI, 25_000);
    const s = simulaAcquisto(base, CON_COMMISSIONI)!;
    const [acquisto] = pianoFlussi(base, CON_COMMISSIONI)!.righe;
    expect(acquisto.tipo).toBe("acquisto");
    expect(acquisto.data).toBe("2026-10-22");
    expect(acquisto.lordo).toBe(-s.addebito);
    expect(acquisto.netto).toBe(-s.costoNetto);
    expect(acquisto.cumulato).toBe(-s.costoNetto);
    // Imposte: il rimborso su rateo e disaggio, a favore di chi compra.
    expect(acquisto.imposte).toBe(s.stornoRateo + s.creditoDisaggio);
  });

  it("l'ultima riga ha la cedola e il rimborso a 100, senza commissione di vendita", () => {
    const base = parametriTitolo(btp, OGGI, 25_000);
    const s = simulaAcquisto(base, CON_COMMISSIONI)!;
    const piano = pianoFlussi(base, CON_COMMISSIONI)!;
    const ultima = piano.righe[piano.righe.length - 1];
    expect(ultima.tipo).toBe("cedolaRimborso");
    expect(ultima.data).toBe("2031-03-01");
    expect(ultima.lordo).toBe(s.cedole.gruppi[s.cedole.gruppi.length - 1].lorda + s.rimborso.lordo);
    const rimborso = s.rimborso.netto;
    expect(ultima.netto).toBe(s.cedole.gruppi[s.cedole.gruppi.length - 1].netta + rimborso);
    expect(ultima.imposte).toBeLessThan(0);
  });

  it("BOT: niente cedole, un'imposta sullo scarto all'acquisto e il rimborso a 100", () => {
    const base = parametriTitolo(bot, OGGI, 25_000);
    const s = simulaAcquisto(base, TARIFFA_NULLA)!;
    const piano = pianoFlussi(base, TARIFFA_NULLA)!;
    expect(s.impostaScarto).toBeGreaterThan(0);
    expect(piano.righe.map((r) => r.tipo)).toEqual(["acquisto", "rimborso"]);
    expect(piano.righe[0].imposte).toBe(s.stornoRateo + s.creditoDisaggio - s.impostaScarto);
    expect(piano.righe[1].lordo).toBe(2_500_000);
  });

  it("step-up: le cedole lorde crescono col gradino", () => {
    const piano = pianoFlussi(parametriTitolo(stepUp, OGGI, 25_000), TARIFFA_NULLA)!;
    const cedole = piano.righe.filter((r) => r.tipo === "cedola");
    expect(cedole[cedole.length - 1].lordo).toBeGreaterThan(cedole[0].lordo);
  });

  it("prima cedola corta: la prima cedola è più piccola delle altre", () => {
    const piano = pianoFlussi(parametriTitolo(nuovo, "2026-10-23", 10_000), TARIFFA_NULLA)!;
    expect(piano.righe[1].lordo).toBe(11_698);
    expect(piano.righe[2].lordo).toBe(17_500);
  });

  it("il cumulato parte in negativo e dice quando si rientra", () => {
    const piano = pianoFlussi(parametriTitolo(btp, OGGI, 25_000), TARIFFA_NULLA)!;
    expect(piano.righe[0].cumulato).toBeLessThan(0);
    expect(piano.rientro).toBe(piano.righe.find((r) => r.cumulato >= 0)!.data);
  });

  it("null se scade prima del regolamento", () => {
    const scaduto: TitoloValutato = { ...bot, dataScadenza: "2026-10-21" };
    expect(pianoFlussi(parametriTitolo(scaduto, OGGI), TARIFFA_NULLA)).toBeNull();
  });
});
