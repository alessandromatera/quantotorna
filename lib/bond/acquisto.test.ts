import { describe, expect, it } from "vitest";
import { metricheCatalogo, parametriTitolo, type TitoloValutato } from "../catalogo/metriche";
import { TARIFFA_NULLA } from "../costi/commissioni";
import { simulaAcquisto } from "./acquisto";

/** Un BTP inventato. */
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

describe("simulaAcquisto", () => {
  it("senza commissioni, sul nominale e al prezzo della tabella, dà lo YTM della tabella", () => {
    const tabella = metricheCatalogo({
      versione: 1,
      data: OGGI,
      generato: `${OGGI}T18:00:00Z`,
      euribor6m: null,
      titoli: [btp],
      emissioni: { [btp.isin]: btp.emissione! },
      documentiMef: [],
      rapporto: { scartate: [], fontiMancanti: [] },
    }).flussiNoti[0];
    const s = simulaAcquisto(parametriTitolo(btp, OGGI), TARIFFA_NULLA)!;
    expect(s.ytmNettoPct).toBe(tabella.ytmNettoPct);
    expect(s.ytmLordoPct).toBe(tabella.ytmLordoPct);
    expect(s.dataRegolamento).toBe("2026-10-22");
  });

  it("cedole nette più rimborso netto fanno gli incassi dello YTM, al centesimo", () => {
    const s = simulaAcquisto(parametriTitolo(btp, OGGI, 25_000, 97.5), TARIFFA_NULLA)!;
    expect(s.cedole.totaleNetto + s.rimborso.netto).toBe(s.rendimento!.incassiNetti);
    expect(s.rimborso.lordo).toBe(2_500_000);
    // Disaggio di 0,80 punti su 25.000 nominali, al 12,5%: 25 €.
    expect(s.rimborso.impostaDisaggio).toBe(2_500);
  });

  it("le commissioni entrano nell'addebito e abbassano lo YTM netto, non il lordo", () => {
    const senza = simulaAcquisto(parametriTitolo(btp, OGGI), TARIFFA_NULLA)!;
    const con = simulaAcquisto(parametriTitolo(btp, OGGI), {
      percentuale: 0.19,
      minimo: 295,
      massimo: 1_900,
      fisso: 0,
    })!;
    // 0,19% di 9.800 € = 18,62 €.
    expect(con.commissioni).toBe(1_862);
    expect(con.addebito - senza.addebito).toBe(1_862);
    expect(con.ytmNettoPct!).toBeLessThan(senza.ytmNettoPct!);
    expect(con.ytmLordoPct).toBe(senza.ytmLordoPct);
  });

  it("su uno step-up le cedole si raggruppano per gradino", () => {
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
    const s = simulaAcquisto(parametriTitolo(stepUp, OGGI), TARIFFA_NULLA)!;
    expect(s.cedole.gruppi.map((g) => g.dal)).toEqual(["2026-12-01", "2028-09-01"]);
    expect(s.cedole.gruppi[1].lorda).toBeGreaterThan(s.cedole.gruppi[0].lorda);
  });

  it("niente da calcolare se il titolo scade prima del regolamento", () => {
    const bot: TitoloValutato = { ...btp, tipo: "bot", cedolaAnnua: 0, dataScadenza: "2026-10-21" };
    expect(simulaAcquisto(parametriTitolo(bot, OGGI), TARIFFA_NULLA)).toBeNull();
  });
});
