import { describe, expect, it } from "vitest";
import { grigliaScenari, shockDiPareggio, simulaUscita } from "./whatif";
import type { ParametriBond } from "./ytm";
import { ytmNetto } from "./ytm";

/** Un BTP lungo, 2,45% settembre 2050, ai prezzi di mercato di agosto 2026. */
const LUNGO: ParametriBond = {
  categoria: "btpFisso",
  quantita: 10000,
  prezzo: 67.84,
  prezzoCarico: 67.84,
  cedolaAnnua: 2.45,
  frequenzaCedola: 2,
  dataScadenza: "2050-09-01",
  dataRiferimento: "2026-08-24",
};

/** Stesso emittente, scadenza corta: serve per i confronti di rischio. */
const CORTO: ParametriBond = {
  ...LUNGO,
  prezzo: 97.75,
  prezzoCarico: 97.75,
  cedolaAnnua: 2.85,
  dataScadenza: "2031-02-01",
};

describe("simulaUscita", () => {
  it("a curva ferma il titolo sotto la pari risale: è il roll-down", () => {
    const esito = simulaUscita({ bond: LUNGO, dataUscita: "2029-08-24", shockPct: 0 })!;
    expect(esito.prezzoUscita).toBeGreaterThan(LUNGO.prezzo);
    expect(esito.variazionePrezzoPct).toBeGreaterThan(0);
    // Il rendimento supera la cedola corrente (2,45/67,84 = 3,61%) proprio
    // perché al prezzo si aggiunge la risalita verso la pari.
    expect(esito.rendimentoAnnuoPct).toBeGreaterThan(3.61);
  });

  it("i tassi che salgono abbassano il prezzo di uscita, e viceversa", () => {
    const su = simulaUscita({ bond: LUNGO, dataUscita: "2029-08-24", shockPct: 1 })!;
    const fermo = simulaUscita({ bond: LUNGO, dataUscita: "2029-08-24", shockPct: 0 })!;
    const giu = simulaUscita({ bond: LUNGO, dataUscita: "2029-08-24", shockPct: -1 })!;
    expect(su.prezzoUscita).toBeLessThan(fermo.prezzoUscita);
    expect(giu.prezzoUscita).toBeGreaterThan(fermo.prezzoUscita);
    expect(su.guadagnoNetto).toBeLessThan(giu.guadagnoNetto);
  });

  it("più lunga è la scadenza, più lo stesso shock morde", () => {
    const lungo = simulaUscita({ bond: LUNGO, dataUscita: "2027-08-24", shockPct: 1 })!;
    const corto = simulaUscita({ bond: CORTO, dataUscita: "2027-08-24", shockPct: 1 })!;
    expect(lungo.variazionePrezzoPct).toBeLessThan(corto.variazionePrezzoPct);
  });

  it("uscire alla scadenza è il rimborso: prezzo 100 e nessun rateo", () => {
    const esito = simulaUscita({ bond: LUNGO, dataUscita: "2050-09-01", shockPct: 3 })!;
    expect(esito.aScadenza).toBe(true);
    expect(esito.prezzoUscita).toBe(100);
    expect(esito.rateoVendita).toBe(0);
    // A scadenza lo shock non cambia niente: il rimborso è alla pari.
    const conAltroShock = simulaUscita({
      bond: LUNGO,
      dataUscita: "2050-09-01",
      shockPct: -3,
    })!;
    expect(conAltroShock.incassoNetto).toBe(esito.incassoNetto);
  });

  it("tenuto a scadenza rende MENO dello YTM: le cedole non si reinvestono", () => {
    const esito = simulaUscita({ bond: LUNGO, dataUscita: "2060-01-01", shockPct: 0 })!;
    expect(esito.dataUscita).toBe(LUNGO.dataScadenza);
    // Lo YTM presuppone di reinvestire ogni cedola AL TASSO DELLO YTM stesso.
    // Qui le cedole restano liquide, e su ventiquattro anni la differenza è
    // circa un punto l'anno: non è uno scarto di arrotondamento, è l'ipotesi
    // di reinvestimento che si vede in faccia.
    const ytm = ytmNetto(LUNGO)! * 100;
    expect(esito.rendimentoAnnuoPct!).toBeLessThan(ytm);
    expect(ytm - esito.rendimentoAnnuoPct!).toBeGreaterThan(0.5);
  });

  it("sul corto la stessa differenza si assottiglia: meno cedole da reinvestire", () => {
    const lungo = simulaUscita({ bond: LUNGO, dataUscita: "2060-01-01", shockPct: 0 })!;
    const corto = simulaUscita({ bond: CORTO, dataUscita: "2060-01-01", shockPct: 0 })!;
    const scartoLungo = ytmNetto(LUNGO)! * 100 - lungo.rendimentoAnnuoPct!;
    const scartoCorto = ytmNetto(CORTO)! * 100 - corto.rendimentoAnnuoPct!;
    expect(scartoCorto).toBeLessThan(scartoLungo);
  });

  it("uscire in perdita crea capienza fiscale, non solo un rosso", () => {
    const esito = simulaUscita({ bond: LUNGO, dataUscita: "2027-08-24", shockPct: 2 })!;
    expect(esito.plusMinus).toBeLessThan(0);
    expect(esito.impostaPlusvalenza).toBe(0);
    expect(esito.minusvalenzaGenerata).not.toBeNull();
    expect(esito.minusvalenzaGenerata!.importo).toBeGreaterThan(0);
    // Quarto anno successivo a quello dell'operazione.
    expect(esito.minusvalenzaGenerata!.dataScadenza).toBe("2031-12-31");
  });

  it("lo zainetto abbatte l'imposta sulla plusvalenza", () => {
    const scenario = { bond: LUNGO, dataUscita: "2031-08-24", shockPct: -1 };
    const senza = simulaUscita(scenario)!;
    const capiente = simulaUscita({
      ...scenario,
      zainetto: [
        { annoCompetenza: 2028, importoResiduo: 500_000, dataScadenza: "2032-12-31" },
      ],
    })!;
    expect(senza.plusMinus).toBeGreaterThan(0);
    expect(senza.impostaPlusvalenza).toBeGreaterThan(0);
    // Zainetto più grande della plusvalenza: assorbe tutto e l'imposta sparisce.
    expect(capiente.minusvalenzeAssorbite).toBe(senza.plusMinus);
    expect(capiente.impostaPlusvalenza).toBe(0);
  });

  it("una voce di zainetto già scaduta non compensa niente", () => {
    const scenario = { bond: LUNGO, dataUscita: "2031-08-24", shockPct: -1 };
    const senza = simulaUscita(scenario)!;
    // Minusvalenza 2026: utilizzabile fino al 31/12/2030, quindi morta per
    // un'operazione dell'agosto 2031.
    const scaduta = simulaUscita({
      ...scenario,
      zainetto: [
        { annoCompetenza: 2026, importoResiduo: 100_000, dataScadenza: "2030-12-31" },
      ],
    })!;
    expect(scaduta.minusvalenzeAssorbite).toBe(0);
    expect(scaduta.impostaPlusvalenza).toBe(senza.impostaPlusvalenza);
  });

  it("con la tariffa la commissione d'uscita segue il controvalore dello scenario", () => {
    // Tariffa inventata: 0,15% con minimo 2,50 € e massimo 12 €.
    const tariffa = { percentuale: 0.15, minimo: 250, massimo: 1200, fisso: 0 };
    const scenario = { bond: LUNGO, dataUscita: "2029-08-24", tariffa };
    const crollo = simulaUscita({ ...scenario, shockPct: 3 })!;
    const rally = simulaUscita({ ...scenario, shockPct: -2 })!;
    // È il punto della tariffa proporzionale: uscire da un titolo crollato
    // costa meno che uscire da uno in guadagno, perché la base è il
    // controvalore. Nel rally il controvalore sfonda il tetto dei 12 €.
    expect(crollo.commissioniVendita).toBeLessThan(rally.commissioniVendita);
    expect(rally.commissioniVendita).toBe(1200);
    // Su un taglio piccolo la stessa tariffa resta proporzionale.
    const piccolo = simulaUscita({
      ...scenario,
      bond: { ...LUNGO, quantita: 1000 },
      shockPct: 0,
    })!;
    expect(piccolo.commissioniVendita).toBeGreaterThanOrEqual(250);
    expect(piccolo.commissioniVendita).toBeLessThan(1200);
  });

  it("niente rendimento annualizzato sotto il mese, e niente su titoli scaduti", () => {
    const brevissimo = simulaUscita({
      bond: LUNGO,
      dataUscita: "2026-09-01",
      shockPct: 0,
    })!;
    expect(brevissimo.rendimentoAnnuoPct).toBeNull();
    expect(brevissimo.guadagnoNetto).not.toBeNull();
    const scaduto = simulaUscita({
      bond: { ...LUNGO, dataRiferimento: "2051-01-01" },
      dataUscita: "2051-06-01",
      shockPct: 0,
    });
    expect(scaduto).toBeNull();
  });
});

describe("shockDiPareggio", () => {
  /** Scorciatoia: la soglia in bp, e fallisce se il caso non è quello. */
  const soglia = (par: Parameters<typeof shockDiPareggio>[0]) => {
    const esito = shockDiPareggio(par);
    expect(esito?.tipo).toBe("soglia");
    return esito != null && esito.tipo === "soglia" ? esito.bp : NaN;
  };

  it("il cuscinetto si ispessisce con il tempo", () => {
    const par = { bond: LUNGO, shockPct: 0 };
    const a1 = soglia({ ...par, dataUscita: "2027-08-24" });
    const a3 = soglia({ ...par, dataUscita: "2029-08-24" });
    const a5 = soglia({ ...par, dataUscita: "2031-08-24" });
    expect(a1).toBeLessThan(a3);
    expect(a3).toBeLessThan(a5);
    // A un anno il margine è sottile: bastano pochi decimi di punto.
    expect(a1).toBeLessThan(50);
  });

  it("un titolo corto sopporta molto più movimento di uno lungo", () => {
    const lungo = soglia({ bond: LUNGO, dataUscita: "2027-08-24", shockPct: 0 });
    const corto = soglia({ bond: CORTO, dataUscita: "2027-08-24", shockPct: 0 });
    expect(corto).toBeGreaterThan(lungo);
  });

  it("distingue «non puoi perdere» da «perdi comunque»", () => {
    // A un anno dal rimborso il prezzo non ha spazio per crollare: qualunque
    // rialzo plausibile lascia l'uscita in guadagno. È il caso che un
    // trattino avrebbe confuso con il suo opposto.
    const quasiScaduto = shockDiPareggio({
      bond: { ...CORTO, dataScadenza: "2027-10-15", cedolaAnnua: 2.7, prezzo: 99.77 },
      dataUscita: "2027-08-24",
      shockPct: 0,
    });
    expect(quasiScaduto).toEqual({ tipo: "sempreInGuadagno" });

    // Taglio minuscolo su orizzonte breve: le due commissioni minime pesano
    // più di qualunque movimento del prezzo, e l'uscita è in perdita in ogni
    // scenario. Il caso opposto, e va detto con parole opposte.
    const inPerditaComunque = shockDiPareggio({
      bond: {
        categoria: "btpFisso",
        quantita: 200,
        prezzo: 99.5,
        prezzoCarico: 99.5,
        cedolaAnnua: 0,
        frequenzaCedola: 2,
        dataScadenza: "2026-11-01",
        dataRiferimento: "2026-08-24",
      },
      dataUscita: "2026-09-10",
      shockPct: 0,
      tariffa: { percentuale: 0.15, minimo: 250, massimo: 1200, fisso: 0 },
    });
    expect(inPerditaComunque).toEqual({ tipo: "sempreInPerdita" });
  });

  it("a scadenza non c'è pareggio: si incassa 100 comunque", () => {
    expect(
      shockDiPareggio({ bond: LUNGO, dataUscita: "2050-09-01", shockPct: 0 }),
    ).toEqual({ tipo: "sempreInGuadagno" });
  });
});

describe("grigliaScenari", () => {
  it("una riga per orizzonte, una colonna per shock", () => {
    const griglia = grigliaScenari({ bond: LUNGO }, [1, 3, 5], [-1, 0, 1]);
    expect(griglia).toHaveLength(3);
    expect(griglia[0].dataUscita).toBe("2027-08-24");
    expect(griglia[2].dataUscita).toBe("2031-08-24");
    expect(griglia[0].esiti).toHaveLength(3);
    expect(griglia.every((r) => r.pareggio != null)).toBe(true);
  });
});
