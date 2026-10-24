import { describe, expect, it } from "vitest";
import { metricheCatalogo, parametriTitolo, type TitoloValutato } from "../catalogo/metriche";
import { TARIFFA_NULLA } from "../costi/commissioni";
import { simulaAcquisto } from "./acquisto";
import { simulaUscita } from "./whatif";

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

  it("tenuto fino al rimborso dà lo stesso conto di «Se esco prima» a scadenza", () => {
    const tariffa = { percentuale: 0.19, minimo: 295, massimo: 1_900, fisso: 0 };
    const bond = parametriTitolo(btp, OGGI);
    const senza = simulaAcquisto(bond, TARIFFA_NULLA)!;
    const con = simulaAcquisto(bond, tariffa)!;
    // Le commissioni d'acquisto fanno parte del costo fiscale.
    expect(con.rimborso.plusvalenza).toBe(senza.rimborso.plusvalenza - 1_862);
    expect(con.rimborso.impostaPlusvalenza).toBeLessThan(senza.rimborso.impostaPlusvalenza);

    const uscita = simulaUscita({
      bond: { ...bond, commissioni: con.commissioni },
      dataUscita: btp.dataScadenza,
      shockPct: 0,
      tariffa,
    })!;
    // Al rimborso non si paga una commissione di vendita.
    expect(uscita.commissioniVendita).toBe(0);
    expect(uscita.plusMinus).toBe(con.rimborso.plusvalenza);
    expect(uscita.impostaPlusvalenza).toBe(con.rimborso.impostaPlusvalenza);
    expect(uscita.esborso).toBe(con.costoNetto);
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

describe("BTP appena emesso, con la prima cedola corta", () => {
  // BTP inventato 3,50% semestrale, godimento 01/10/2026, scadenza
  // 01/08/2036, comprato il 23/10/2026 a 100,50: regolamento 27/10/2026.
  const nuovo: TitoloValutato = {
    ...btp,
    isin: "IT0000000037",
    nome: "Btp Inventato 3,5% Ag36",
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
  const GIORNO = "2026-10-23";
  const s = simulaAcquisto(parametriTitolo(nuovo, GIORNO), TARIFFA_NULLA)!;
  // Lo stesso titolo senza godimento: il calendario all'indietro dalla
  // scadenza, con la prima cedola piena e il rateo dal 01/08/2026.
  const piena = simulaAcquisto(parametriTitolo({ ...nuovo, emissione: null }, GIORNO), TARIFFA_NULLA)!;

  it("il rateo matura dal godimento, e l'addebito con lui", () => {
    expect(s.dataRegolamento).toBe("2026-10-27");
    // 175 € × 26/184 = 24,73 €, non 175 € × 87/184 = 82,74 €.
    expect(s.rateo).toBe(2_473);
    expect(piena.rateo).toBe(8_274);
    expect(s.addebito).toBe(1_007_473);
    expect(piena.addebito).toBe(1_013_274);
  });

  it("la prima cedola paga i giorni dal godimento, le altre sono piene", () => {
    // 175 € × 123/184 = 116,98 € lordi, 102,36 € netti; poi 175 € lordi.
    expect(s.cedole.primaCorta).toBe(true);
    expect(s.cedole.gruppi).toEqual([
      { numero: 1, lorda: 11_698, netta: 10_236, dal: "2027-02-01" },
      { numero: 19, lorda: 17_500, netta: 15_312, dal: "2027-08-01" },
    ]);
    expect(piena.cedole.primaCorta).toBe(false);
    expect(piena.cedole.gruppi).toEqual([{ numero: 20, lorda: 17_500, netta: 15_312, dal: "2027-02-01" }]);
  });

  it("il rendimento non cambia: rateo e prima cedola si compensano", () => {
    expect(s.ytmLordoPct).toBe(3.47);
    expect(piena.ytmLordoPct).toBe(3.47);
    expect(Math.abs(s.ytmNettoPct! - piena.ytmNettoPct!)).toBeLessThan(0.01);
    expect(s.cedole.totaleNetto + s.rimborso.netto).toBe(s.rendimento!.incassiNetti);
  });
});

describe("BTP Valore Insieme: una cedola sola, a scadenza", () => {
  // BTP inventato: cedola unica del 22,70% a scadenza, godimento 27/10/2026,
  // scadenza 27/10/2031, comprato il 26/11/2026 a 101 (regolamento il
  // 30/11/2026).
  const insieme: TitoloValutato = {
    ...btp,
    isin: "IT0000000045",
    nome: "Btp Valore Insieme Inventato",
    tipo: "cedolaUnica",
    cedolaAnnua: 0,
    dataScadenza: "2031-10-27",
    prezzo: 101,
    cedolaUnica: { percentuale: 22.7, definitiva: true, godimento: "2026-10-27" },
    emissione: null,
  };
  const s = simulaAcquisto(parametriTitolo(insieme, "2026-11-26"), TARIFFA_NULLA)!;

  it("il rateo matura in 30E/360 su tutto il periodo di cinque anni", () => {
    expect(s.dataRegolamento).toBe("2026-11-30");
    // 2.270 € × 33/1.800 = 41,62 €.
    expect(s.rateo).toBe(4_162);
    expect(s.addebito).toBe(1_010_000 + 4_162);
    // 12,5% di 41,62 € = 5,20 €, rimborsati subito.
    expect(s.stornoRateo).toBe(520);
  });

  it("una cedola sola: 2.270 € lordi, 1.986,25 € netti, il giorno del rimborso", () => {
    expect(s.cedole).toMatchObject({
      numero: 1,
      lordaPeriodo: 227_000,
      nettaPeriodo: 198_625,
      primaCorta: false,
      gruppi: [{ numero: 1, lorda: 227_000, netta: 198_625, dal: "2031-10-27" }],
    });
    expect(s.cedole.totaleNetto + s.rimborso.netto).toBe(s.rendimento!.incassiNetti);
  });

  it("«Se esco prima» dopo tre anni: il rateo di vendita è la cedola maturata, tassata al 12,5%", () => {
    const uscita = simulaUscita({ bond: parametriTitolo(insieme, "2026-11-26"), dataUscita: "2029-10-27", shockPct: 0 })!;
    expect(uscita.cedoleLorde).toBe(0);
    // 2.270 € × 1.080/1.800 = 1.362 €; 12,5% = 170,25 €.
    expect(uscita.rateoVendita).toBe(136_200);
    expect(uscita.impostaCedoleRateo).toBe(17_025);
    // A scadenza coi tassi fermi rende quanto lo YTM netto.
    const aScadenza = simulaUscita({ bond: parametriTitolo(insieme, "2026-11-26"), dataUscita: "2031-10-27", shockPct: 0 })!;
    expect(Math.abs(aScadenza.rendimentoAnnuoPct! - s.ytmNettoPct!)).toBeLessThan(0.01);
  });
});
