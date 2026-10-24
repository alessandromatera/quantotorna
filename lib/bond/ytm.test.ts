import { describe, expect, it } from "vitest";
import { anniTraActAct, dataRegolamento } from "../date";
import { analisiDuration, sensibilitaTassi } from "./durata";
import {
  addebitoDisaggio,
  capitalGainRimborso,
  cedoleFuture,
  controvaloreTelQuel,
  creditiAcquisto,
  creditoDisaggio,
  esborsoNetto,
  flussiLordi,
  flussiNetti,
  impostaDisaggioCessione,
  impostaScartoAcquisto,
  isScartoAnticipato,
  perAcquisto,
  prezzoTeorico,
  rateoAllaData,
  rendimentoNetto,
  stornoImpostaRateo,
  ytmLordo,
  ytmNetto,
  ytmNettoSenzaCapitalGain,
  type ParametriBond,
} from "./ytm";

/** Zero coupon a un anno esatto (365 giorni). */
const zeroCoupon: ParametriBond = {
  categoria: "btpFisso",
  quantita: 10000,
  prezzo: 95,
  prezzoCarico: 95,
  cedolaAnnua: 0,
  frequenzaCedola: 1,
  dataScadenza: "2027-07-23",
  dataRiferimento: "2026-07-23",
};

describe("ytmLordo", () => {
  it("zero coupon a 95 con un anno esatto: 100/95 − 1 ≈ 5,263%", () => {
    expect(ytmLordo(zeroCoupon)).toBeCloseTo(100 / 95 - 1, 4);
  });

  it("titolo alla pari con cedola annua del 4%: YTM ≈ 4%", () => {
    const y = ytmLordo({
      categoria: "btpFisso",
      quantita: 10000,
      prezzo: 100,
      prezzoCarico: 100,
      cedolaAnnua: 4,
      frequenzaCedola: 1,
      dataScadenza: "2028-07-23",
      dataRiferimento: "2026-07-23",
    });
    expect(y).toBeCloseTo(0.04, 2);
  });
});

describe("ytmNetto", () => {
  it("titolo di Stato alla pari: cedola tassata al 12,5% → ≈ 3,5% netto", () => {
    const y = ytmNetto({
      categoria: "btpFisso",
      quantita: 10000,
      prezzo: 100,
      prezzoCarico: 100,
      cedolaAnnua: 4,
      frequenzaCedola: 1,
      dataScadenza: "2028-07-23",
      dataRiferimento: "2026-07-23",
    });
    expect(y).toBeCloseTo(0.035, 2);
  });

  it("zero coupon sotto la pari: imposta sul rimborso col meccanismo del 48,08%", () => {
    // Plusvalenza a rimborso: 1.000,00 € → imposta 125,01 €
    // Netto incassato: 10.000,00 − 125,01 = 9.874,99 su esborso 9.000,00
    const y = ytmNetto({ ...zeroCoupon, prezzo: 90, prezzoCarico: 90 });
    expect(y).toBeCloseTo(987499 / 900000 - 1, 4);
  });

  it("le commissioni riducono il rendimento netto", () => {
    const senza = ytmNetto(zeroCoupon)!;
    const con = ytmNetto({ ...zeroCoupon, commissioni: 1900 })!;
    expect(con).toBeLessThan(senza);
  });
});

describe("rendimentoNetto", () => {
  it("zero coupon a un anno: guadagno netto = rimborso netto − esborso", () => {
    const r = rendimentoNetto(zeroCoupon)!;
    // Plus a rimborso 500,00 € → imposta 62,50 €; incassi 9.937,50 su 9.500,00.
    expect(r.esborso).toBe(950_000);
    expect(r.incassiNetti).toBe(993_750);
    expect(r.guadagnoNetto).toBe(43_750);
    expect(r.anniResidui).toBe(1);
    expect(r.guadagnoNettoAnnuo).toBe(43_750);
  });

  it("coerente con lo YTM netto: guadagno/esborso ≈ tasso su un anno", () => {
    const r = rendimentoNetto(zeroCoupon)!;
    expect(r.guadagnoNetto / r.esborso).toBeCloseTo(ytmNetto(zeroCoupon)!, 6);
  });

  it("su più anni il valore annuo è la media lineare del guadagno", () => {
    const p = { ...zeroCoupon, dataScadenza: "2030-07-23" };
    const r = rendimentoNetto(p)!;
    // Anni esatti, non arrotondati: l'arrotondamento è della pagina.
    expect(r.anniResidui).toBe(anniTraActAct("2026-07-23", "2030-07-23"));
    expect(r.guadagnoNettoAnnuo).toBe(
      Math.round(r.guadagnoNetto / anniTraActAct("2026-07-23", "2030-07-23")),
    );
  });

  it("le commissioni entrano nell'esborso e riducono il guadagno", () => {
    const senza = rendimentoNetto(zeroCoupon)!;
    const con = rendimentoNetto({ ...zeroCoupon, commissioni: 1900 })!;
    expect(con.esborso).toBe(senza.esborso + 1900);
    expect(con.guadagnoNetto).toBe(senza.guadagnoNetto - 1900);
  });

  it("titolo già scaduto: nessun rendimento da calcolare", () => {
    expect(
      rendimentoNetto({ ...zeroCoupon, dataScadenza: "2026-07-23" }),
    ).toBeNull();
  });
});

describe("analisiDuration", () => {
  it("zero coupon a 2 anni: Macaulay ≈ 2, modificata = Macaulay/(1+y)", () => {
    const analisi = analisiDuration({
      ...zeroCoupon,
      dataScadenza: "2028-07-23",
    })!;
    expect(analisi.durationMacaulay).toBeCloseTo(2, 1);
    expect(analisi.durationModificata).toBeCloseTo(
      analisi.durationMacaulay / (1 + analisi.ytmLordo),
      6,
    );
  });

  it("una cedola più alta accorcia la duration", () => {
    const base = {
      categoria: "btpFisso" as const,
      quantita: 10000,
      prezzo: 100,
      prezzoCarico: 100,
      frequenzaCedola: 2,
      dataScadenza: "2035-04-30",
      dataRiferimento: "2026-07-23",
    };
    const bassa = analisiDuration({ ...base, cedolaAnnua: 1 })!;
    const alta = analisiDuration({ ...base, cedolaAnnua: 4 })!;
    expect(alta.durationMacaulay).toBeLessThan(bassa.durationMacaulay);
  });
});

describe("sensibilitaTassi", () => {
  const btp: ParametriBond = {
    categoria: "btpFisso",
    quantita: 10000,
    prezzo: 91.2,
    prezzoCarico: 91.2,
    cedolaAnnua: 1.1,
    frequenzaCedola: 2,
    dataScadenza: "2031-06-01",
    dataRiferimento: "2026-07-23",
  };

  it("con shock nullo restituisce circa il prezzo attuale", () => {
    const punti = sensibilitaTassi(btp)!;
    const zero = punti.find((p) => p.shock === 0)!;
    expect(zero.prezzo).toBeCloseTo(91.2, 1);
    expect(zero.variazionePct).toBeCloseTo(0, 1);
  });

  it("il prezzo scende quando i tassi salgono, e viceversa", () => {
    const punti = sensibilitaTassi(btp)!;
    for (let i = 1; i < punti.length; i++) {
      expect(punti[i].prezzo).toBeLessThan(punti[i - 1].prezzo);
    }
    expect(punti.find((p) => p.shock === 2)!.prezzo).toBeLessThan(91.2);
    expect(punti.find((p) => p.shock === -2)!.prezzo).toBeGreaterThan(91.2);
  });
});

describe("rateo: storno immediato sull'acquisto, cedole tassate per intero", () => {
  /**
   * Comprato a metà periodo cedolare: si paga mezza cedola di rateo e il
   * sostituto d'imposta ne storna subito l'imposta (DLgs 239/96). La cedola
   * successiva è tassata per intero, sia su un acquisto sia su un lotto già
   * posseduto: non esiste un «rateo residuo» da scomputare.
   */
  const aMetaPeriodo: ParametriBond = {
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 100,
    prezzoCarico: 100,
    cedolaAnnua: 4,
    frequenzaCedola: 1,
    dataScadenza: "2029-07-23",
    dataRiferimento: "2027-01-22",
  };

  it("la prima cedola paga l'imposta piena, con o senza acquisto", () => {
    // 400 € lordi meno il 12,5% = 350 €.
    expect(flussiNetti(aMetaPeriodo)[0].importo).toBe(350_00);
    expect(flussiNetti(perAcquisto(aMetaPeriodo))[0].importo).toBe(350_00);
  });

  it("su un titolo posseduto non c'è storno: il tel quel è quanto si incasserebbe", () => {
    expect(stornoImpostaRateo(aMetaPeriodo)).toBe(0);
    expect(esborsoNetto(aMetaPeriodo)).toBe(controvaloreTelQuel(aMetaPeriodo));
  });

  it("su un acquisto lo storno riduce l'esborso alla data di regolamento", () => {
    const acquisto = perAcquisto(aMetaPeriodo);
    expect(acquisto.acquisto).toBe(true);
    expect(acquisto.dataRiferimento).toBe(dataRegolamento(aMetaPeriodo.dataRiferimento));
    expect(acquisto.dataCarico).toBe(acquisto.dataRiferimento);
    const storno = stornoImpostaRateo(acquisto);
    expect(storno).toBeGreaterThan(0);
    expect(esborsoNetto(acquisto)).toBe(controvaloreTelQuel(acquisto) - storno);
  });

  it("i crediti di un acquisto: storno sul rateo pagato e credito sul disaggio", () => {
    const titolo = {
      categoria: "btpFisso" as const,
      quantita: 10_000,
      dataScadenza: "2032-06-01",
      prezzoEmissione: 99.07,
      dataEmissione: "2021-11-01",
    };
    // Stesso caso del BTP 2032 qui sotto: rateo 27,51 → storno 3,44; credito 5,35.
    const crediti = creditiAcquisto(titolo, 27_51, "2026-09-15");
    expect(crediti).toEqual({ stornoRateo: 3_44, creditoDisaggio: 5_35, impostaScarto: 0, totale: 8_79 });
    // Senza dati di emissione resta solo lo storno; senza rateo solo il disaggio.
    expect(creditiAcquisto({ ...titolo, dataEmissione: undefined }, 27_51, "2026-09-15").totale).toBe(3_44);
    expect(creditiAcquisto(titolo, 0, "2026-09-15").totale).toBe(5_35);
  });

  /**
   * Il caso che rendeva il numero visibilmente falso: cedola alta e scadenza
   * a poche settimane. Il rateo vale quasi quanto tutto il rendimento
   * residuo, e tassarlo produceva uno YTM netto NEGATIVO su un titolo che
   * non perde un centesimo.
   */
  it("un titolo a cedola alta prossimo alla scadenza non rende più meno di zero", () => {
    const quasiScaduto: ParametriBond = {
      categoria: "btpFisso",
      quantita: 10_000,
      prezzo: 100.5,
      prezzoCarico: 100.5,
      cedolaAnnua: 7,
      frequenzaCedola: 1,
      dataScadenza: "2026-11-01",
      dataRiferimento: "2026-08-25",
    };
    expect(ytmNetto(quasiScaduto)).toBeLessThan(0);
    expect(ytmNetto(perAcquisto(quasiScaduto))).toBeGreaterThan(0);
  });

  /**
   * Il rateo del riepilogo dell'ordine, quando l'intermediario lo conta su
   * un'altra data valuta: entra nell'esborso al posto di quello calcolato,
   * con il suo storno. Le cedole future non cambiano.
   */
  it("un rateo noto sostituisce quello calcolato, storno compreso", () => {
    const acquisto = perAcquisto(aMetaPeriodo);
    const calcolato = rateoAllaData(acquisto);
    expect(ytmNetto({ ...acquisto, rateo: calcolato })).toBe(ytmNetto(acquisto));
    const noto = { ...acquisto, rateo: calcolato + 10_00 };
    expect(rateoAllaData(noto)).toBe(calcolato + 10_00);
    // 10 € di rateo in più costano 10 € meno il 12,5% stornato: 8,75 €.
    expect(esborsoNetto(noto) - esborsoNetto(acquisto)).toBe(8_75);
    expect(flussiNetti(noto)).toEqual(flussiNetti(acquisto));
    expect(ytmNetto(noto)!).toBeLessThan(ytmNetto(acquisto)!);
  });

  it("il credito non regala mai più dell'imposta che si sarebbe pagata", () => {
    const acquisto = perAcquisto(aMetaPeriodo);
    const lordi = flussiLordi(acquisto);
    const netti = flussiNetti(acquisto);
    for (let i = 0; i < lordi.length; i++)
      expect(netti[i].importo).toBeLessThanOrEqual(lordi[i].importo);
  });
});

/**
 * Riferimenti presi il 14/09/2026 da un calcolo esterno indipendente
 * (regolamento 15/09/2026, 10.000 nominali, senza commissioni), con i flussi
 * al centesimo e rendimenti e duration a due decimali. Se uno di questi test
 * si rompe, il motore ha smesso di dire quello che dice il riferimento.
 */
describe("allineamento con il calcolo di riferimento", () => {
  const regolamento = "2026-09-15";
  // `perAcquisto` sposterebbe la data a T+2: qui la data di regolamento è
  // già quella del riferimento, quindi si imposta il flag a mano.
  const acquisto = (p: Omit<ParametriBond, "acquisto" | "dataCarico">): ParametriBond => ({
    ...p,
    acquisto: true,
    dataCarico: regolamento,
  });
  const pct2 = (v: number | null) => (v == null ? null : Math.round(v * 10000) / 100);

  /** BTP 01/06/2032 0,95% a 85,29: sotto la pari, con disaggio (emesso a 99,07). */
  const btp2032 = acquisto({
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 85.29,
    prezzoCarico: 85.29,
    cedolaAnnua: 0.95,
    frequenzaCedola: 2,
    dataScadenza: "2032-06-01",
    dataRiferimento: regolamento,
    prezzoEmissione: 99.07,
    dataEmissione: "2021-11-01",
  });

  it("BTP 2032 0,95%: rateo, storno, credito e addebito disaggio, capital gain", () => {
    expect(stornoImpostaRateo(btp2032)).toBe(3_44); // rateo lordo 27,51
    expect(creditoDisaggio(btp2032)).toBe(5_35);
    expect(addebitoDisaggio(btp2032)).toBe(11_63);
    expect(prezzoTeorico(btp2032, regolamento)).toBeCloseTo(99.498, 3);
    // Nel riferimento: 177,60. Qui 177,61 per il 48,08% di legge contro il
    // 12,5% secco (12,5008% contro 12,5%): un centesimo su 1.420 €.
    expect(capitalGainRimborso(btp2032).plusvalenza).toBe(1_420_81);
    expect(capitalGainRimborso(btp2032).imposta).toBe(177_61);
    expect(esborsoNetto(btp2032)).toBe(8_547_72); // «Controvalore di regolamento»
  });

  it("BTP 2032 0,95%: 3,88% lordo, 3,42% netto, 3,74% netto senza CG", () => {
    expect(pct2(ytmLordo(btp2032))).toBe(3.88);
    expect(pct2(ytmNetto(btp2032))).toBe(3.42);
    expect(pct2(ytmNettoSenzaCapitalGain(btp2032))).toBe(3.74);
    // Saldo dei flussi nel riferimento 1.761,77 (qui 1.761,76 per il centesimo sopra).
    expect(rendimentoNetto(btp2032)!.guadagnoNetto).toBe(1_761_76);
  });

  /** BTP 01/05/2031 6% a 109,78: sopra la pari, emesso a 102,40 (niente disaggio). */
  const btp2031 = acquisto({
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 109.78,
    prezzoCarico: 109.78,
    cedolaAnnua: 6,
    frequenzaCedola: 2,
    dataScadenza: "2031-05-01",
    dataRiferimento: regolamento,
    prezzoEmissione: 102.4,
    dataEmissione: "1999-11-01",
  });

  it("BTP 2031 6%: emesso sopra la pari, nessun disaggio, nessun capital gain", () => {
    expect(creditoDisaggio(btp2031)).toBe(0);
    expect(addebitoDisaggio(btp2031)).toBe(0);
    expect(capitalGainRimborso(btp2031).imposta).toBe(0);
    expect(esborsoNetto(btp2031)).toBe(11_173_45);
    expect(pct2(ytmLordo(btp2031))).toBe(3.72);
    expect(pct2(ytmNetto(btp2031))).toBe(3.0);
  });

  /** BTP 15/01/2027 0,85% a 99,405: quattro mesi alla scadenza. */
  const btp2027 = acquisto({
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 99.405,
    prezzoCarico: 99.405,
    cedolaAnnua: 0.85,
    frequenzaCedola: 2,
    dataScadenza: "2027-01-15",
    dataRiferimento: regolamento,
    prezzoEmissione: 99.61,
    dataEmissione: "2019-11-15",
  });

  it("BTP 2027 0,85%: 2,66% lordo, 2,32% netto, 2,55% senza CG", () => {
    expect(creditoDisaggio(btp2027)).toBe(4_65);
    expect(addebitoDisaggio(btp2027)).toBe(4_88);
    expect(capitalGainRimborso(btp2027).imposta).toBe(7_21);
    expect(esborsoNetto(btp2027)).toBe(9_948_38);
    expect(pct2(ytmLordo(btp2027))).toBe(2.66);
    expect(pct2(ytmNetto(btp2027))).toBe(2.32);
    expect(pct2(ytmNettoSenzaCapitalGain(btp2027))).toBe(2.55);
  });

  /** BTP 15/11/2030 4% a 101,13: sopra la pari ma emesso a 99 (disaggio senza CG). */
  const btp2030 = acquisto({
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 101.13,
    prezzoCarico: 101.13,
    cedolaAnnua: 4,
    frequenzaCedola: 2,
    dataScadenza: "2030-11-15",
    dataRiferimento: regolamento,
    prezzoEmissione: 99,
    dataEmissione: "2023-09-15",
  });

  it("BTP 2030 4%: 3,74% lordo, 3,22% netto; il disaggio c'è anche sopra la pari", () => {
    expect(creditoDisaggio(btp2030)).toBe(5_23);
    expect(addebitoDisaggio(btp2030)).toBe(12_50);
    expect(capitalGainRimborso(btp2030).imposta).toBe(0);
    expect(esborsoNetto(btp2030)).toBe(10_224_76);
    expect(pct2(ytmLordo(btp2030))).toBe(3.74);
    expect(pct2(ytmNetto(btp2030))).toBe(3.22);
    expect(pct2(ytmNettoSenzaCapitalGain(btp2030))).toBe(3.22);
  });

  it("senza prezzo o data di emissione il titolo è trattato come emesso alla pari", () => {
    const senzaData = { ...btp2032, dataEmissione: undefined };
    expect(creditoDisaggio(senzaData)).toBe(0);
    expect(addebitoDisaggio(senzaData)).toBe(0);
    expect(prezzoTeorico(senzaData, regolamento)).toBe(100);
    expect(capitalGainRimborso(senzaData).plusvalenza).toBe(1_471_00);
  });

  it("su un titolo posseduto il credito sul disaggio è storia: resta solo l'addebito", () => {
    const posseduto = { ...btp2032, acquisto: undefined, dataCarico: "2024-06-01" };
    expect(creditoDisaggio(posseduto)).toBe(0);
    expect(stornoImpostaRateo(posseduto)).toBe(0);
    expect(addebitoDisaggio(posseduto)).toBe(11_63);
    // La plusvalenza si misura dal prezzo teorico alla data di carico, più
    // basso di quello di oggi: meno plusvalenza, meno imposta.
    expect(capitalGainRimborso(posseduto).plusvalenza).toBeLessThan(
      capitalGainRimborso(btp2032).plusvalenza,
    );
  });
});

describe("BOT: scarto tassato in anticipo, plusvalenza sul prezzo teorico", () => {
  const regolamento = "2026-10-20";
  const pct2 = (v: number | null) => (v == null ? null : Math.round(v * 10000) / 100);
  const bot = (prezzo: number, prezzoEmissione: number, dataEmissione: string, dataScadenza: string): ParametriBond => ({
    categoria: "bot",
    quantita: 10_000,
    prezzo,
    prezzoCarico: prezzo,
    cedolaAnnua: 0,
    frequenzaCedola: 1,
    dataScadenza,
    dataRiferimento: regolamento,
    prezzoEmissione,
    dataEmissione,
    acquisto: true,
    dataCarico: regolamento,
  });

  /**
   * BOT 14/01/2027, emesso il 14/01/2026 a 97,904, quotato 99,381 con
   * regolamento il 20/10/2026. Nel calcolo di riferimento del 16/10/2026:
   * imposta sul disaggio 6,17 € all'acquisto, capital gain
   * 1,57 € a scadenza (qui 1,56 col 48,08% di legge), rendimenti 2,67% lordo,
   * 2,33% netto, 2,40% senza CG.
   */
  const gennaio27 = bot(99.381, 97.904, "2026-01-14", "2027-01-14");

  it("all'acquisto si paga l'imposta sullo scarto che resta, a scadenza niente", () => {
    expect(isScartoAnticipato(gennaio27)).toBe(true);
    // 2,096 punti × 10.000 × 12,5% = 26,20 €, per 86 giorni su 365.
    expect(impostaScartoAcquisto(gennaio27)).toBe(6_17);
    expect(creditoDisaggio(gennaio27)).toBe(0);
    expect(esborsoNetto(gennaio27)).toBe(9_938_10 + 6_17);
    expect(impostaDisaggioCessione(gennaio27)).toBe(0);
  });

  it("la plusvalenza è la distanza dal prezzo teorico, ed è compensabile", () => {
    expect(prezzoTeorico(gennaio27, regolamento)).toBeCloseTo(99.5061, 4);
    const cg = capitalGainRimborso(gennaio27);
    expect(cg.plusvalenza).toBe(12_51);
    expect(cg.imposta).toBe(1_56);
    // Imposta totale come nel modello semplificato (7,74 €): cambiano i
    // tempi e la natura, non l'importo.
    expect(impostaScartoAcquisto(gennaio27) + cg.imposta).toBe(7_73);
  });

  it("rendimenti come il riferimento: 2,67% lordo, 2,33% netto, 2,40% senza CG", () => {
    expect(pct2(ytmLordo(gennaio27))).toBe(2.67);
    expect(pct2(ytmNetto(gennaio27))).toBe(2.33);
    expect(pct2(ytmNettoSenzaCapitalGain(gennaio27))).toBe(2.4);
  });

  /**
   * BOT 14/10/2027 a 96,943, sopra il prezzo teorico (96,932): nel
   * riferimento imposta sul disaggio 38,34 €, nessun capital gain, 2,79%
   * netto. Il
   * modello semplificato dava 2,81%: compensava la perdita con lo scarto,
   * che è reddito di capitale e non lo consente.
   */
  it("comprato sopra il teorico: niente plusvalenza, e la perdita non riduce lo scarto", () => {
    const ottobre27 = bot(96.943, 96.881, "2026-10-14", "2027-10-14");
    // 3,119 × 10.000 × 12,5% × 359/365 = 38,3466 €: qui 38,35, arrotondato
    // al centesimo; il riferimento 38,34, che tronca l'imposta per unità a 4
    // decimali.
    expect(impostaScartoAcquisto(ottobre27)).toBe(38_35);
    expect(capitalGainRimborso(ottobre27).plusvalenza).toBeLessThan(0);
    expect(capitalGainRimborso(ottobre27).imposta).toBe(0);
    expect(pct2(ytmNetto(ottobre27))).toBe(2.79);
  });

  it("chi vende prima della scadenza si vede restituire l'imposta sul residuo", () => {
    // Al 01/12/2026 mancano 44 giorni: 26,20 € × 44/365 = 3,16 €.
    expect(impostaDisaggioCessione(gennaio27, "2026-12-01")).toBe(-3_16);
    // Su un BTP, all'opposto, chi vende paga il disaggio maturato.
    const btp = { categoria: "btpFisso" as const, quantita: 10_000, dataScadenza: "2032-06-01", prezzoEmissione: 99.07, dataEmissione: "2021-11-01" };
    expect(impostaDisaggioCessione(btp, "2026-09-15")).toBe(addebitoDisaggio(btp, "2026-09-15"));
    expect(impostaDisaggioCessione(btp, "2026-09-15")).toBeGreaterThan(0);
  });

  it("crediti d'acquisto di un BOT: nessun credito, l'imposta sullo scarto a parte", () => {
    const titolo = { categoria: "bot" as const, quantita: 10_000, dataScadenza: "2027-01-14", prezzoEmissione: 97.904, dataEmissione: "2026-01-14" };
    expect(creditiAcquisto(titolo, 0, regolamento)).toEqual({
      stornoRateo: 0,
      creditoDisaggio: 0,
      impostaScarto: 6_17,
      totale: 0,
    });
  });

  it("senza dati di emissione resta il modello semplificato: tutto scarto a scadenza", () => {
    const senzaDati = { ...gennaio27, prezzoEmissione: undefined, dataEmissione: undefined };
    expect(isScartoAnticipato(senzaDati)).toBe(false);
    expect(impostaScartoAcquisto(senzaDati)).toBe(0);
    // 6,19 punti × 10.000 × 12,5% pieno = 7,74 €, a scadenza.
    expect(capitalGainRimborso(senzaDati)).toEqual({ plusvalenza: 61_90, imposta: 7_74 });
  });
});

describe("rendimentoNetto", () => {
  /**
   * BTP 2,65% dicembre 2027 a 99,35, regolamento 22/10/2026: 1,1096 anni.
   * Diviso per gli anni arrotondati a 1,11 la cifra annua veniva 282,96 €
   * invece di 283,07: si divide per gli anni esatti.
   */
  it("la cifra annua divide il guadagno per gli anni esatti", () => {
    const r = rendimentoNetto(
      perAcquisto({
        categoria: "btpFisso",
        quantita: 10_000,
        prezzo: 99.35,
        prezzoCarico: 99.35,
        cedolaAnnua: 2.65,
        frequenzaCedola: 2,
        dataScadenza: "2027-12-01",
        dataRiferimento: "2026-10-20",
      }),
    )!;
    expect(r.anniResidui).toBeCloseTo(1.1096, 4);
    expect([r.esborso, r.guadagnoNetto, r.guadagnoNettoAnnuo]).toEqual([1_002_560, 31_409, 28_307]);
  });
});

/**
 * Step-up, contro il calcolo di riferimento del 19/10/2026 (10.000
 * nominali, regolamento 21/10/2026, prezzo di chiusura). Su tutti gli
 * undici step-up quotati date, cedole lorde, rateo e storno sono identici;
 * restano due arrotondamenti noti: la tassa su una cedola da 65,00 € è
 * 8,125 € e il riferimento la tronca (8,12) dove il motore arrotonda (8,13),
 * e sulla plusvalenza il motore applica il 48,08% × 26% di legge.
 */
describe("step-up: allineamento con il calcolo di riferimento", () => {
  /** BTP Più febbraio 2033: trimestrale, 2,85% per quattro anni poi 3,70%. */
  const piu = perAcquisto({
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 94.66,
    prezzoCarico: 94.66,
    cedolaAnnua: 2.85,
    frequenzaCedola: 4,
    gradiniCedola: [
      { dal: "2025-02-25", cedolaAnnua: 2.85 },
      { dal: "2029-02-25", cedolaAnnua: 3.7 },
    ],
    dataScadenza: "2033-02-25",
    dataRiferimento: "2026-10-19",
  });

  it("BTP Più: rateo e storno sul gradino in corso", () => {
    expect(piu.dataRiferimento).toBe("2026-10-21");
    expect(rateoAllaData(piu)).toBe(4414);
    expect(stornoImpostaRateo(piu)).toBe(552);
  });

  it("BTP Più: il gradino lo decide l'inizio del periodo, non il giorno di pagamento", () => {
    const cedole = cedoleFuture(piu);
    expect(cedole).toHaveLength(26);
    const del = (data: string) => cedole.find((c) => c.data === data)!.lorda;
    // Il 25/02/2029 si paga il trimestre novembre-febbraio, ancora al 2,85%;
    // il 25/05/2029 il primo al 3,70%.
    expect(del("2026-11-25")).toBe(7125);
    expect(del("2029-02-25")).toBe(7125);
    expect(del("2029-05-25")).toBe(9250);
    expect(del("2033-02-25")).toBe(9250);
    expect(flussiLordi(piu).at(-1)).toEqual({ data: "2033-02-25", importo: 1_009_250 });
  });

  /** BTP Futura aprile 2037: semestrale, quattro gradini da quattro anni. */
  const futura = perAcquisto({
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 74.64,
    prezzoCarico: 74.64,
    cedolaAnnua: 1.2,
    frequenzaCedola: 2,
    gradiniCedola: [
      { dal: "2021-04-27", cedolaAnnua: 0.75 },
      { dal: "2025-04-27", cedolaAnnua: 1.2 },
      { dal: "2029-04-27", cedolaAnnua: 1.65 },
      { dal: "2033-04-27", cedolaAnnua: 2 },
    ],
    dataScadenza: "2037-04-27",
    dataRiferimento: "2026-10-19",
  });

  it("BTP Futura 2037: tutti i gradini futuri, con la loro tassa", () => {
    expect(rateoAllaData(futura)).toBe(5803);
    expect(stornoImpostaRateo(futura)).toBe(725);
    const cedole = cedoleFuture(futura);
    expect(cedole).toHaveLength(22);
    const del = (data: string) => cedole.find((c) => c.data === data)!;
    expect(del("2026-10-27")).toMatchObject({ lorda: 6000, imposta: 750 });
    expect(del("2029-04-27")).toMatchObject({ lorda: 6000, imposta: 750 });
    expect(del("2029-10-27")).toMatchObject({ lorda: 8250, imposta: 1031 });
    expect(del("2033-10-27")).toMatchObject({ lorda: 10_000, imposta: 1250 });
  });

  it("i netti sono i lordi meno la tassa di ciascuna cedola", () => {
    const lordi = flussiLordi(futura);
    const netti = flussiNetti(futura);
    const cedole = cedoleFuture(futura);
    expect(netti).toHaveLength(lordi.length);
    for (const [i, c] of cedole.slice(0, -1).entries()) {
      expect(netti[i]).toEqual({ data: c.data, importo: c.netta });
    }
  });

  it("un solo gradino è un tasso fisso: stessi flussi, stesso YTM", () => {
    const fisso: ParametriBond = {
      categoria: "btpFisso",
      quantita: 10_000,
      prezzo: 97,
      prezzoCarico: 97,
      cedolaAnnua: 3,
      frequenzaCedola: 2,
      dataScadenza: "2030-04-27",
      dataRiferimento: "2026-10-19",
    };
    const aGradino = { ...fisso, gradiniCedola: [{ dal: "2020-04-27", cedolaAnnua: 3 }] };
    expect(flussiNetti(perAcquisto(aGradino))).toEqual(flussiNetti(perAcquisto(fisso)));
    expect(ytmNetto(perAcquisto(aGradino))).toBe(ytmNetto(perAcquisto(fisso)));
  });
});

/** Frazione → percentuale a due decimali, come la mostra la pagina. */
const percento = (v: number | null) => (v == null ? null : Math.round(v * 10_000) / 100);

describe("CCTeu: cedola e rateo ACT/360, come li calcola il Tesoro", () => {
  // CCTeu inventato: scadenza 15/04/2032, cedola stimata 3,10% (Euribor
  // 2,10% + spread 1,00%), comprato il 23/10/2026 a 101,20: regolamento il
  // 27/10/2026.
  const cct = perAcquisto({
    categoria: "btpFisso",
    quantita: 10_000,
    prezzo: 101.2,
    prezzoCarico: 101.2,
    cedolaAnnua: 3.1,
    frequenzaCedola: 2,
    convenzioneCedola: "act360",
    dataScadenza: "2032-04-15",
    dataRiferimento: "2026-10-23",
  });
  const { convenzioneCedola: _, ...actAct } = cct;

  it("rateo: 10.000 × 3,10% × 12/360 = 10,33 €, non 10,22 €", () => {
    expect(cct.dataRiferimento).toBe("2026-10-27");
    expect(rateoAllaData(cct)).toBe(1033);
    expect(rateoAllaData(actAct)).toBe(1022);
    expect(stornoImpostaRateo(cct)).toBe(129);
  });

  it("2,93% lordo e 2,53% netto, contro 2,88% e 2,49% in ACT/ACT", () => {
    expect(percento(ytmLordo(cct))).toBe(2.93);
    expect(percento(ytmNetto(cct))).toBe(2.53);
    expect(percento(ytmLordo(actAct))).toBe(2.88);
    expect(percento(ytmNetto(actAct))).toBe(2.49);
  });

  it("le cedole future variano coi giorni del semestre", () => {
    const cedole = cedoleFuture(cct);
    expect(cedole[0]).toMatchObject({ data: "2027-04-15", lorda: 15_672 });
    expect(cedole[1]).toMatchObject({ data: "2027-10-15", lorda: 15_758 });
    expect(new Set(cedole.map((c) => c.lorda)).size).toBeGreaterThan(1);
  });

  it("duration e sensibilità con la stessa convenzione", () => {
    // A shock nullo il riprezzamento torna al prezzo solo se il rateo che
    // toglie è quello del tel quel da cui è uscito lo YTM.
    expect(sensibilitaTassi(cct, [0])![0].prezzo).toBeCloseTo(101.2, 3);
    expect(analisiDuration(cct)!.ytmLordo).toBe(ytmLordo(cct));
  });
});
