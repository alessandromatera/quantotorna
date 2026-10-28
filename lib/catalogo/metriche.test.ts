import { describe, expect, it } from "vitest";
import { simulaAcquisto } from "../bond/acquisto";
import { ytmLordo } from "../bond/ytm";
import type { EmissioneSalvata } from "../mercato/emissioni";
import type { Catalogo, TitoloCatalogo } from "./formato";
import {
  CONDIZIONI_RIFERIMENTO,
  metricheCatalogo,
  parametriTitolo,
  pct,
  righeConCondizioni,
  titoliInElenco,
} from "./metriche";

/** Titoli inventati: ISIN, nomi e prezzi non sono di mercato. */
function titolo(campi: Partial<TitoloCatalogo> & Pick<TitoloCatalogo, "isin">): TitoloCatalogo {
  return {
    nome: `Titolo ${campi.isin}`,
    tipo: "fisso",
    emittente: "IT",
    cedolaAnnua: 3,
    frequenzaCedola: 2,
    dataScadenza: "2031-03-01",
    prezzo: 98,
    spread: null,
    gradiniCedola: null,
    scambi: null,
    ...campi,
  };
}

function catalogo(titoli: TitoloCatalogo[], campi: Partial<Catalogo> = {}): Catalogo {
  return {
    versione: 1,
    data: "2026-10-20",
    generato: "2026-10-20T18:00:00Z",
    euribor6m: { percentuale: 2.1, periodo: "2026-09" },
    titoli,
    emissioni: {},
    documentiMef: [],
    rapporto: { scartate: [], fontiMancanti: [] },
    ...campi,
  };
}

describe("metricheCatalogo", () => {
  it("un tasso fisso sotto la pari: rendimento, plusvalenza compensabile, duration", () => {
    const m = metricheCatalogo(catalogo([titolo({ isin: "IT0000000011" })]));
    const [t] = m.flussiNoti;
    expect(t.categoria).toBe("btpFisso");
    expect(t.ytmNettoPct).toBeGreaterThan(0);
    expect(t.ytmLordoPct!).toBeGreaterThan(t.ytmNettoPct!);
    // 10.000 nominali da 98 a 100, emesso alla pari: 200 € di plusvalenza.
    expect(t.plusRimborso).toBe(20_000);
    expect(t.plusCompensabile).toBe(true);
    expect(t.durationModificata).toBeGreaterThan(3);
    expect(t.rendimentoNominale!.incassi).toBeGreaterThan(1_000_000);
  });

  it("lascia fuori chi scade il giorno dei prezzi e ordina per scadenza", () => {
    const m = metricheCatalogo(
      catalogo([
        titolo({ isin: "IT0000000029", dataScadenza: "2033-06-01" }),
        titolo({ isin: "IT0000000037", dataScadenza: "2026-10-20" }),
        titolo({ isin: "IT0000000045", dataScadenza: "2028-06-01" }),
      ]),
    );
    expect(m.flussiNoti.map((t) => t.isin)).toEqual(["IT0000000045", "IT0000000029"]);
  });

  it("toglie i rendimenti netti negativi e dice quanti sono", () => {
    const m = metricheCatalogo(
      catalogo([
        titolo({ isin: "IT0000000052" }),
        titolo({ isin: "IT0000000060", cedolaAnnua: 0.5, prezzo: 108 }),
      ]),
    );
    expect(m.flussiNoti.map((t) => t.isin)).toEqual(["IT0000000052"]);
    expect(m.nascostiYtmNegativo).toBe(1);
  });

  it("unisce i dati di emissione per ISIN e conta i tassi fissi che ne sono senza", () => {
    const emissione: EmissioneSalvata = {
      prezzoEmissione: 99.5,
      dataEmissione: "2021-03-01",
      fonte: "MEF, risultati d'asta",
      dataAggiornamento: "2026-10-01",
    };
    const m = metricheCatalogo(
      catalogo(
        [
          titolo({ isin: "IT0000000078" }),
          titolo({ isin: "IT0000000086" }),
          titolo({ isin: "IT0000000094" }),
        ],
        {
          emissioni: {
            IT0000000078: emissione,
            IT0000000094: { ...emissione, prezzoEmissione: null },
          },
        },
      ),
    );
    expect(m.flussiNoti.find((t) => t.isin === "IT0000000078")?.emissione).toEqual(emissione);
    expect(m.flussiNoti.find((t) => t.isin === "IT0000000086")?.emissione).toBeNull();
    expect(m.senzaEmissione).toBe(2);
  });

  describe("BOT", () => {
    const bot = { tipo: "bot" as const, cedolaAnnua: 0, prezzo: 99, dataScadenza: "2027-04-14" };

    it("senza dati d'asta il differenziale è tutto scarto, fuori dallo zainetto", () => {
      const [t] = metricheCatalogo(catalogo([titolo({ isin: "IT0000000102", ...bot })])).flussiNoti;
      expect(t.categoria).toBe("bot");
      expect(t.scartoAnticipato).toBe(false);
      expect(t.plusCompensabile).toBe(false);
    });

    it("con prezzo e data d'asta lo scarto è tassato in anticipo e il resto è compensabile", () => {
      const [t] = metricheCatalogo(
        catalogo([titolo({ isin: "IT0000000110", ...bot })], {
          emissioni: {
            IT0000000110: {
              prezzoEmissione: 98.2,
              dataEmissione: "2026-04-14",
              fonte: "MEF, risultati d'asta",
              dataAggiornamento: "2026-10-01",
            },
          },
        }),
      ).flussiNoti;
      expect(t.scartoAnticipato).toBe(true);
      expect(t.plusCompensabile).toBe(true);
    });
  });

  describe("CCTeu", () => {
    const cct = { tipo: "ccteu" as const, cedolaAnnua: 0, spread: 0.9, prezzo: 101 };

    it("cedola stimata = Euribor + spread, rendimento allo stesso regolamento di un fisso", () => {
      const m = metricheCatalogo(catalogo([titolo({ isin: "IT0000000128", ...cct })]));
      const [v] = m.variabili;
      expect(v.cedolaStimata).toBe(3);
      expect(v.motivoNonCalcolabile).toBeNull();
      // Lo stesso titolo a tasso fisso al 3%, con cedole e rateo ACT/360:
      // stessi flussi, stessa data.
      const fisso = { ...titolo({ isin: "IT0000000128", cedolaAnnua: 3, prezzo: 101 }), emissione: null };
      expect(v.ytmLordoPct).toBe(
        pct(ytmLordo({ ...parametriTitolo(fisso, "2026-10-20"), convenzioneCedola: "act360" })),
      );
    });

    it("cedola e rateo ACT/360: 2,93% lordo e 2,53% netto", () => {
      // CCTeu inventato con scadenza 15/04/2032 e spread 1,00% sull'Euribor
      // al 2,10%, a 101,20 il 23/10/2026: regolamento il 27/10/2026.
      const t = titolo({ isin: "IT0000000201", ...cct, spread: 1, prezzo: 101.2, dataScadenza: "2032-04-15" });
      const m = metricheCatalogo(catalogo([t], { data: "2026-10-23" }));
      const [v] = m.variabili;
      expect(v.cedolaStimata).toBe(3.1);
      expect(v.ytmLordoPct).toBe(2.93);
      expect(v.ytmNettoPct).toBe(2.53);
      // È la riga del catalogo a dare la convenzione al motore.
      expect(parametriTitolo({ ...t, emissione: null }, "2026-10-23").convenzioneCedola).toBe("act360");
      expect(parametriTitolo({ ...titolo({ isin: "IT0000000011" }), emissione: null }, "2026-10-23").convenzioneCedola)
        .toBeUndefined();
    });

    it("senza Euribor resta in elenco col motivo", () => {
      const m = metricheCatalogo(
        catalogo([titolo({ isin: "IT0000000136", ...cct })], { euribor6m: null }),
      );
      expect(m.variabili[0].ytmNettoPct).toBeNull();
      expect(m.variabili[0].motivoNonCalcolabile).toMatch(/Euribor/);
    });
  });

  describe("BTP Valore Insieme: una cedola sola, a scadenza", () => {
    // BTP inventato: cedola unica del 22,70% a scadenza, godimento
    // 27/10/2026, scadenza 27/10/2031, a 100 il 23/10/2026 (regolamento il
    // 27/10, rateo zero).
    const insieme = (definitiva: boolean, percentuale = definitiva ? 22.7 : 22.25) =>
      titolo({
        isin: "IT0000000219",
        nome: "Btp Valore Insieme Inventato",
        tipo: "cedolaUnica",
        cedolaAnnua: 0,
        dataScadenza: "2031-10-27",
        prezzo: 100,
        cedolaUnica: { percentuale, definitiva, godimento: "2026-10-27" },
      });

    it("con la cedola definitiva sta fra i flussi noti: 4,18% lordo e 3,69% netto, come Borsa Italiana", () => {
      // Borsa Italiana scrive 4,17% e 3,69% a 100: 1,227^(1/5) − 1 = 4,176%,
      // e al netto (22,70% × 0,875 = 19,8625%) 3,690%.
      const m = metricheCatalogo(catalogo([insieme(true)], { data: "2026-10-23" }));
      expect(m.cedoleUniche).toEqual([]);
      const [r] = m.flussiNoti;
      expect(r.cedolaUnica).toEqual({ percentuale: 22.7, definitiva: true, godimento: "2026-10-27" });
      expect(r.categoria).toBe("btpFisso");
      expect(r.ytmLordoPct).toBe(4.18);
      expect(r.ytmNettoPct).toBe(3.69);
      // 2.270 € lordi, 1.986,25 € netti sui 10.000 nominali comprati a 100.
      expect(r.rendimentoNominale).toMatchObject({ incassi: 1_198_625, guadagno: 198_625 });
      expect(r.durationModificata).toBeGreaterThan(4.7);
      // Il listino le dà cedola zero: in tabella c'è quella del motore, che
      // la ordina per cedola fra i titoli che pagano altrettanto l'anno.
      expect(r.cedolaAnnua).toBeCloseTo(22.7 / 5, 10);
      expect(r.frequenzaCedola).toBe(0.2);
    });

    it("col minimo del collocamento resta a parte, senza rendimento e col motivo", () => {
      const m = metricheCatalogo(catalogo([insieme(false)], { data: "2026-10-23" }));
      expect(m.flussiNoti).toEqual([]);
      const [r] = m.cedoleUniche;
      expect(r.cedolaUnica.definitiva).toBe(false);
      expect(r.motivoNonCalcolabile).toMatch(/minimo.*22,25%/);
      expect(titoliInElenco(m)).toBe(1);
    });

    it("la riga si rifà con le condizioni di chi guarda, come gli altri fissi", () => {
      const c = catalogo([insieme(true)], { data: "2026-10-23" });
      const m = metricheCatalogo(c);
      const tariffa = { percentuale: 0.19, minimo: 295, massimo: 1_900, fisso: 0 };
      const con = righeConCondizioni(m, c.euribor6m, { nominale: 10_000, tariffa });
      expect(con.flussiNoti[0].ytmNettoPct!).toBeLessThan(m.flussiNoti[0].ytmNettoPct!);
      expect(righeConCondizioni(m, c.euribor6m, CONDIZIONI_RIFERIMENTO).flussiNoti).toEqual(m.flussiNoti);
    });

    it("al motore arriva come una cedola sola, con il rateo in 30E/360", () => {
      const p = parametriTitolo({ ...insieme(true), emissione: null }, "2026-10-23");
      expect(p).toMatchObject({
        cedolaAnnua: 22.7 / 5,
        frequenzaCedola: 0.2,
        convenzioneCedola: "30E360",
        dataEmissione: "2026-10-27",
      });
      expect(() => parametriTitolo({ ...insieme(false), emissione: null }, "2026-10-23")).toThrow(/definitiva/);
    });
  });

  describe("indicizzati", () => {
    const btpei = {
      tipo: "indicizzatoEuro" as const,
      cedolaAnnua: 1.2,
      prezzo: 99,
      dataScadenza: "2032-05-15",
    };

    it("pareggio col tasso fisso italiano più vicino, mai con un altro emittente", () => {
      const m = metricheCatalogo(
        catalogo([
          titolo({ isin: "IT0000000144", ...btpei }),
          titolo({ isin: "DE0000000011", emittente: "DE", dataScadenza: "2032-05-15", frequenzaCedola: 1 }),
          titolo({ isin: "IT0000000151", dataScadenza: "2032-09-01", cedolaAnnua: 3.5, prezzo: 100 }),
          titolo({ isin: "IT0000000169", dataScadenza: "2034-09-01", cedolaAnnua: 3.5, prezzo: 100 }),
        ]),
      );
      const [i] = m.indicizzati;
      expect(i.ytmRealeLordoPct).toBeGreaterThan(0);
      expect(i.confronto?.isin).toBe("IT0000000151");
      expect(i.confronto!.pareggioPct).toBeGreaterThan(1.5);
    });

    it("senza un gemello italiano entro un anno e mezzo non c'è pareggio", () => {
      const m = metricheCatalogo(
        catalogo([
          titolo({ isin: "IT0000000177", ...btpei }),
          titolo({ isin: "IT0000000185", dataScadenza: "2036-09-01" }),
        ]),
      );
      expect(m.indicizzati[0].confronto).toBeNull();
      expect(m.indicizzati[0].motivoNonCalcolabile).toMatch(/548 giorni/);
    });

    it("BTP Italia: nessun rendimento, col motivo", () => {
      const m = metricheCatalogo(
        catalogo([titolo({ isin: "IT0000000193", tipo: "italia", cedolaAnnua: 1.6 })]),
      );
      expect(m.indicizzati[0].categoria).toBe("btpItalia");
      expect(m.indicizzati[0].ytmRealeLordoPct).toBeNull();
      expect(m.indicizzati[0].motivoNonCalcolabile).toMatch(/FOI/);
    });
  });
});

describe("righeConCondizioni", () => {
  const conCcteu = catalogo([
    titolo({ isin: "IT0000000011" }),
    // Un titolo a 50: diecimila nominali costano cinquemila euro.
    titolo({ isin: "IT0000000029", prezzo: 50, cedolaAnnua: 0.5, dataScadenza: "2041-03-01" }),
    titolo({ isin: "IT0000000037", tipo: "ccteu", cedolaAnnua: 0, spread: 1.1, prezzo: 101 }),
  ]);
  const m = metricheCatalogo(conCcteu);
  const rifai = (nominale: number, tariffa = CONDIZIONI_RIFERIMENTO.tariffa) =>
    righeConCondizioni(m, conCcteu.euribor6m, { nominale, tariffa });

  it("con le condizioni di riferimento sono le righe della pagina compilata", () => {
    const r = righeConCondizioni(m, conCcteu.euribor6m, CONDIZIONI_RIFERIMENTO);
    expect(r.flussiNoti).toEqual(m.flussiNoti);
    expect(r.variabili).toEqual(m.variabili);
  });

  it("a metà nominale, metà plusvalenza e metà euro; lo YTM non cambia", () => {
    const meta = rifai(5_000);
    expect(meta.flussiNoti[0].plusRimborso).toBe(m.flussiNoti[0].plusRimborso / 2);
    expect(meta.flussiNoti[0].ytmNettoPct).toBe(m.flussiNoti[0].ytmNettoPct);
    // Su 5.000 nominali la metà del guadagno di 10.000, a meno degli
    // arrotondamenti al centesimo di ogni cedola.
    const guadagno = meta.flussiNoti[0].rendimentoNominale!.guadagno;
    expect(Math.abs(guadagno - m.flussiNoti[0].rendimentoNominale!.guadagno / 2)).toBeLessThanOrEqual(10);
  });

  it("le commissioni abbassano lo YTM netto, anche dei CCTeu, e non il lordo", () => {
    const tariffa = { percentuale: 0.19, minimo: 295, massimo: 1_900, fisso: 0 };
    const con = rifai(10_000, tariffa);
    expect(con.flussiNoti[0].ytmNettoPct!).toBeLessThan(m.flussiNoti[0].ytmNettoPct!);
    expect(con.flussiNoti[0].ytmLordoPct).toBe(m.flussiNoti[0].ytmLordoPct);
    expect(con.variabili[0].ytmNettoPct!).toBeLessThan(m.variabili[0].ytmNettoPct!);
    // Entrano nel costo fiscale: la plusvalenza a rimborso scende di tanto.
    // 0,19% di 9.800 € = 18,62 €.
    expect(m.flussiNoti[0].plusRimborso - con.flussiNoti[0].plusRimborso).toBe(1_862);
  });

  it("il netto a scadenza è il conto di «Se lo compro», commissioni comprese", () => {
    // Chi apre la riga deve ritrovare le cifre della tabella: stesso
    // nominale, stessa tariffa, stesso prezzo di chiusura. Anche con una
    // quota fissa, che non cresce con la quantità.
    const tariffa = { percentuale: 0.19, minimo: 295, massimo: 1_900, fisso: 1_000 };
    for (const nominale of [10_000, 3_000]) {
      const righe = rifai(nominale, tariffa).flussiNoti;
      for (const t of righe) {
        const dettaglio = simulaAcquisto(parametriTitolo(t, m.data, nominale), tariffa)!.rendimento!;
        expect(t.rendimentoNominale).toEqual({
          incassi: dettaglio.incassiNetti,
          guadagno: dettaglio.guadagnoNetto,
          annuo: dettaglio.guadagnoNettoAnnuo,
          anni: dettaglio.anniResidui,
        });
      }
    }
  });
});
