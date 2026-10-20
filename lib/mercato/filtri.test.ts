import { describe, expect, it } from "vitest";
import {
  FASCE_VOLATILITA,
  FILTRI_VUOTI,
  ORIZZONTI,
  estremiOrizzonte,
  filtra,
  filtriAttivi,
  inFascia,
  intervalloAnni,
  orizzonteAttivo,
  type Filtrabile,
} from "./filtri";

const CAMPIONE: Filtrabile[] = [
  {
    isin: "IT0001086567",
    nome: "Btp-1nv26 7,25%",
    tipo: "fisso",
    emittente: "IT",
    dataScadenza: "2026-11-01",
    toccaZainetto: true,
    rendimentoPct: 2.1,
    durationModificata: 0.2,
    scambiMediana: 4_000_000,
  },
  {
    isin: "IT0003268890",
    nome: "Btpstripital Zc Feb28 Eur",
    tipo: "zeroCoupon",
    emittente: "IT",
    dataScadenza: "2028-02-01",
    toccaZainetto: false,
    rendimentoPct: 2.66,
    durationModificata: 1.4,
    scambiMediana: 48_000,
  },
  {
    isin: "IT0005666851",
    nome: "Bot Zc Aug26 A Eur",
    tipo: "bot",
    emittente: "IT",
    dataScadenza: "2026-08-14",
    toccaZainetto: false,
    rendimentoPct: 1.9,
    durationModificata: 0.1,
    scambiMediana: 4_400_000,
  },
  {
    isin: "IT0005451361",
    nome: "Cct-Eu Tv Eur6m+0,65% Ap29 Eur",
    tipo: "ccteu",
    emittente: "IT",
    dataScadenza: "2029-04-15",
    toccaZainetto: true,
    rendimentoPct: null,
    durationModificata: null,
    scambiMediana: 2_000_000,
  },
  {
    isin: "IT0005532723",
    nome: "Btp Italia Mz28 Eur",
    tipo: "italia",
    emittente: "IT",
    dataScadenza: "2028-03-14",
    toccaZainetto: true,
    rendimentoPct: null,
    durationModificata: null,
    scambiMediana: null,
  },
  {
    isin: "DE0001102614",
    nome: "Bund Fx 2.5% Aug54 Eur",
    tipo: "fisso",
    emittente: "DE",
    dataScadenza: "2054-08-15",
    toccaZainetto: true,
    rendimentoPct: 3.1,
    durationModificata: 17.8,
    scambiMediana: 0,
  },
];

describe("filtra", () => {
  it("senza criteri non toglie nulla", () => {
    expect(filtra(CAMPIONE, FILTRI_VUOTI)).toHaveLength(6);
    expect(filtriAttivi(FILTRI_VUOTI)).toBe(false);
  });

  it("famiglie: lista vuota significa tutte, non nessuna", () => {
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, famiglie: [] })).toHaveLength(6);
    expect(
      filtra(CAMPIONE, { ...FILTRI_VUOTI, famiglie: ["bot", "ccteu"] }).map(
        (t) => t.tipo,
      ),
    ).toEqual(["bot", "ccteu"]);
  });

  it("emittenti: filtra per chi ha emesso, non per famiglia", () => {
    expect(
      filtra(CAMPIONE, { ...FILTRI_VUOTI, emittenti: ["DE"] }).map((t) => t.isin),
    ).toEqual(["DE0001102614"]);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, emittenti: ["IT"] })).toHaveLength(5);
    expect(filtriAttivi({ ...FILTRI_VUOTI, emittenti: ["DE"] })).toBe(true);
  });

  it("gli anni sono inclusivi da entrambi i lati", () => {
    const soloDue = filtra(CAMPIONE, {
      ...FILTRI_VUOTI,
      annoMin: 2026,
      annoMax: 2026,
    });
    expect(soloDue.map((t) => t.isin)).toEqual(["IT0001086567", "IT0005666851"]);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, annoMin: 2029 })).toHaveLength(2);
  });

  it("solo compensabili esclude zero coupon e BOT", () => {
    expect(
      filtra(CAMPIONE, { ...FILTRI_VUOTI, soloCompensabili: true }).map((t) => t.isin),
    ).toEqual([
      "IT0001086567",
      "IT0005451361",
      "IT0005532723",
      "DE0001102614",
    ]);
  });

  it("solo con rendimento esclude chi non ne ha uno calcolato", () => {
    expect(
      filtra(CAMPIONE, { ...FILTRI_VUOTI, soloConRendimento: true }).map((t) => t.isin),
    ).toEqual([
      "IT0001086567",
      "IT0003268890",
      "IT0005666851",
      "DE0001102614",
    ]);
  });

  it("il testo cerca in nome e ISIN, senza distinzione di maiuscole", () => {
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, testo: "italia" })).toHaveLength(1);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, testo: "IT0005451" })).toHaveLength(1);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, testo: "it0005" })).toHaveLength(3);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, testo: "bund" })).toHaveLength(1);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, testo: "  BOT " })).toHaveLength(1);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, testo: "inesistente" })).toHaveLength(0);
  });

  it("i criteri si combinano in AND", () => {
    const r = filtra(CAMPIONE, {
      ...FILTRI_VUOTI,
      annoMax: 2028,
      soloConRendimento: true,
      soloCompensabili: true,
    });
    expect(r.map((t) => t.isin)).toEqual(["IT0001086567"]);
  });
});

describe("filtriAttivi", () => {
  it("riconosce ogni singolo criterio", () => {
    expect(filtriAttivi({ ...FILTRI_VUOTI, famiglie: ["bot"] })).toBe(true);
    expect(filtriAttivi({ ...FILTRI_VUOTI, annoMin: 2027 })).toBe(true);
    expect(filtriAttivi({ ...FILTRI_VUOTI, soloCompensabili: true })).toBe(true);
    expect(filtriAttivi({ ...FILTRI_VUOTI, testo: "btp" })).toBe(true);
    // Solo spazi non è un filtro.
    expect(filtriAttivi({ ...FILTRI_VUOTI, testo: "   " })).toBe(false);
  });
});

describe("intervalloAnni", () => {
  it("copre l'intero campione", () => {
    expect(intervalloAnni(CAMPIONE)).toEqual({ min: 2026, max: 2054 });
  });

  it("senza titoli non inventa estremi", () => {
    expect(intervalloAnni([])).toBeNull();
  });
});

describe("orizzonti", () => {
  /**
   * Le fasce sono contigue e coprono senza buchi: un titolo non deve poter
   * sfuggire a tutte e quattro. Si toccano agli estremi (2–5 e 5–10
   * condividono il 5) perché filtrano su ANNI, non su date: un titolo che
   * scade fra 5 anni e 3 mesi cade nell'anno di calendario condiviso, e
   * mostrarlo in entrambe le fasce è meglio che perderlo.
   */
  it("le fasce coprono tutto l'arco senza buchi", () => {
    for (let i = 1; i < ORIZZONTI.length; i++) {
      expect(ORIZZONTI[i].da).toBe(ORIZZONTI[i - 1].a);
    }
    expect(ORIZZONTI[0].da).toBe(0);
    expect(ORIZZONTI[ORIZZONTI.length - 1].a).toBeNull();
  });

  it("traduce l'orizzonte in anni di calendario", () => {
    expect(estremiOrizzonte(ORIZZONTI[0], 2026)).toEqual({
      annoMin: 2026,
      annoMax: 2028,
    });
    expect(estremiOrizzonte(ORIZZONTI[2], 2026)).toEqual({
      annoMin: 2031,
      annoMax: 2036,
    });
  });

  /** «Oltre 10 anni» non ha limite superiore: prende anche i secolari. */
  it("l'ultima fascia non ha tetto", () => {
    const e = estremiOrizzonte(ORIZZONTI[3], 2026);
    expect(e).toEqual({ annoMin: 2036, annoMax: null });
    const lontano: Filtrabile = {
      isin: "AT0000A0U3T4",
      nome: "Austria Tf 0,85% Gn2120 Eur",
      tipo: "fisso",
      emittente: "AT",
      dataScadenza: "2120-06-30",
      toccaZainetto: true,
      rendimentoPct: 2.5,
      durationModificata: 45,
      scambiMediana: 12_000,
    };
    expect(
      filtra([lontano], { ...FILTRI_VUOTI, annoMin: e.annoMin, annoMax: e.annoMax }),
    ).toHaveLength(1);
  });

  it("riconosce quale scorciatoia è attiva, e nessuna se il range è a mano", () => {
    const e = estremiOrizzonte(ORIZZONTI[1], 2026);
    expect(
      orizzonteAttivo({ ...FILTRI_VUOTI, annoMin: e.annoMin, annoMax: e.annoMax }, 2026),
    ).toBe("medio");
    expect(orizzonteAttivo(FILTRI_VUOTI, 2026)).toBeNull();
    expect(
      orizzonteAttivo({ ...FILTRI_VUOTI, annoMin: 2031, annoMax: 2031 }, 2026),
    ).toBeNull();
  });
});

describe("filtra — scambi", () => {
  /**
   * Il campione ha uno strip con una mediana da 48 mila euro, un Bund con la
   * mediana a zero e un BTP Italia non letto (null): tutti e tre restano fuori
   * da ogni soglia, ma per motivi diversi — e lo zero non va confuso col dato
   * mancante.
   */
  it("tiene solo chi arriva alla soglia", () => {
    expect(
      filtra(CAMPIONE, { ...FILTRI_VUOTI, scambi: "qualche" }).map((t) => t.isin),
    ).toEqual(["IT0001086567", "IT0005666851", "IT0005451361"]);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, scambi: "alti" })).toHaveLength(3);
    expect(filtriAttivi({ ...FILTRI_VUOTI, scambi: "buoni" })).toBe(true);
  });

  it("si combina con gli altri criteri", () => {
    expect(
      filtra(CAMPIONE, { ...FILTRI_VUOTI, scambi: "qualche", famiglie: ["bot"] }).map(
        (t) => t.isin,
      ),
    ).toEqual(["IT0005666851"]);
  });
});

describe("filtra — volatilità", () => {
  it("le fasce si leggono dalla duration; chi non ce l'ha resta fuori", () => {
    const bassa = filtra(CAMPIONE, { ...FILTRI_VUOTI, volatilita: "bassa" });
    expect(bassa.map((t) => t.isin).sort()).toEqual(
      ["IT0001086567", "IT0003268890", "IT0005666851"].sort(),
    );
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, volatilita: "altissima" }).map((t) => t.isin)).toEqual([
      "DE0001102614",
    ]);
    expect(filtra(CAMPIONE, { ...FILTRI_VUOTI, volatilita: "media" })).toHaveLength(0);
    expect(filtriAttivi({ ...FILTRI_VUOTI, volatilita: "alta" })).toBe(true);
  });

  it("gli estremi delle fasce: inclusi in basso, esclusi in alto, senza buchi", () => {
    const [bassa, media, alta, altissima] = FASCE_VOLATILITA;
    expect(inFascia(2, bassa)).toBe(false);
    expect(inFascia(2, media)).toBe(true);
    expect(inFascia(5, media)).toBe(false);
    expect(inFascia(5, alta)).toBe(true);
    expect(inFascia(10, alta)).toBe(false);
    expect(inFascia(10, altissima)).toBe(true);
    expect(inFascia(30, altissima)).toBe(true);
    expect(inFascia(null, bassa)).toBe(false);
  });
});
