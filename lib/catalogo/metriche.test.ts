import { describe, expect, it } from "vitest";
import { ytmLordo } from "../bond/ytm";
import type { EmissioneSalvata } from "../mercato/emissioni";
import type { Catalogo, TitoloCatalogo } from "./formato";
import {
  CONDIZIONI_RIFERIMENTO,
  metricheCatalogo,
  parametriTitolo,
  pct,
  righeConCondizioni,
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
    expect(t.nettoSuSpesa!.incassi).toBeGreaterThan(1_000_000);
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
      // Lo stesso titolo a tasso fisso al 3%: stessi flussi, stessa data.
      const fisso = { ...titolo({ isin: "IT0000000128", cedolaAnnua: 3, prezzo: 101 }), emissione: null };
      expect(v.ytmLordoPct).toBe(pct(ytmLordo(parametriTitolo(fisso, "2026-10-20"))));
    });

    it("senza Euribor resta in elenco col motivo", () => {
      const m = metricheCatalogo(
        catalogo([titolo({ isin: "IT0000000136", ...cct })], { euribor6m: null }),
      );
      expect(m.variabili[0].ytmNettoPct).toBeNull();
      expect(m.variabili[0].motivoNonCalcolabile).toMatch(/Euribor/);
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
    // Ogni 5.000 € spesi: la metà di ogni 10.000, a meno degli arrotondamenti
    // al centesimo di ogni cedola.
    const guadagno = meta.flussiNoti[0].nettoSuSpesa!.guadagno;
    expect(Math.abs(guadagno - m.flussiNoti[0].nettoSuSpesa!.guadagno / 2)).toBeLessThanOrEqual(10);
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

  it("il netto a scadenza conta la quota fissa una volta, sulla somma spesa", () => {
    // 10 € per eseguito, comunque. Con 10.000 € su un titolo a 50 si compra
    // un ordine solo da circa 20.000 nominali: la quota si paga una volta.
    // Riproporzionare l'acquisto dei 10.000 nominali (5.000 €) la conterebbe
    // due volte.
    const fisso = { percentuale: 0, minimo: 0, massimo: 0, fisso: 1_000 };
    const senza = m.flussiNoti[1].nettoSuSpesa!;
    const con = rifai(10_000, fisso).flussiNoti[1].nettoSuSpesa!;
    const perso = senza.incassi - con.incassi;
    // I 10 € che vanno in commissione non si comprano: a scadenza mancano
    // quanto sarebbero diventati, cioè 10 € per quanto torna ogni euro speso
    // (quasi due, su un titolo a 50). Un po' meno, perché la commissione
    // riduce la plusvalenza tassata. Due quote ne farebbero mancare il doppio.
    const resa = senza.incassi / 1_000_000;
    expect(perso).toBeGreaterThan(1_000 * resa * 0.9);
    expect(perso).toBeLessThan(1_000 * resa * 1.05);
  });
});
