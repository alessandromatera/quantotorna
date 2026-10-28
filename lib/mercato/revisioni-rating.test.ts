import { describe, expect, it } from "vitest";
import { isDataISO } from "../date";
import { DESCRIZIONI, EMITTENTI, type DescrizioneEmittente, type Emittente } from "./emittenti";
import {
  CALENDARIO_SP_FINO_AL,
  REVISIONI_SP,
  avvisiRating,
  riepilogoAvvisiRating,
} from "./revisioni-rating";

/** Le descrizioni vere, col rating solo sugli emittenti dati e la loro data. */
function conRilevati(rilevati: Partial<Record<Emittente, string>>): Record<Emittente, DescrizioneEmittente> {
  const d = {} as Record<Emittente, DescrizioneEmittente>;
  for (const e of EMITTENTI) {
    const r = rilevati[e];
    d[e] = { ...DESCRIZIONI[e], rating: r == null ? null : "AA", ratingRilevato: r ?? null };
  }
  return d;
}

const LONTANO = "2099-12-31";

describe("REVISIONI_SP", () => {
  /**
   * Il regolamento vuole le revisioni dei rating sovrani di venerdì, dopo la
   * chiusura: una data che non è un venerdì è un errore di trascrizione.
   */
  it("sono date vere, in ordine, di venerdì, dentro il calendario", () => {
    for (const date of Object.values(REVISIONI_SP)) {
      expect(date!.length).toBeGreaterThan(0);
      for (const d of date!) {
        expect(isDataISO(d)).toBe(true);
        expect(new Date(`${d}T00:00:00Z`).getUTCDay()).toBe(5);
        expect(d <= CALENDARIO_SP_FINO_AL).toBe(true);
      }
      expect([...date!].sort()).toEqual(date);
    }
  });

  /** Solo Stati col rating: UE, MES e sovranazionali non hanno calendario. */
  it("riguardano solo Stati di cui si mostra il rating", () => {
    for (const e of Object.keys(REVISIONI_SP) as Emittente[]) {
      expect(DESCRIZIONI[e].rating).not.toBe(null);
      expect(DESCRIZIONI[e].sovranazionale).toBeUndefined();
    }
  });
});

describe("avvisiRating", () => {
  it("il giorno della rilettura non c'è niente da ricontrollare", () => {
    expect(avvisiRating("2026-10-28")).toEqual([]);
  });

  /** S&P pubblica il venerdì sera, dopo il giro: si avvisa dal lunedì. */
  it("avvisa dal giorno dopo la revisione, non il giorno stesso", () => {
    const d = conRilevati({ IT: "2026-10-28" });
    const revisioni = { IT: ["2026-11-13"] };
    expect(avvisiRating("2026-11-13", d, revisioni, LONTANO)).toEqual([]);
    expect(avvisiRating("2026-11-16", d, revisioni, LONTANO)).toEqual([
      "Italia (AA): S&P ha pubblicato una revisione il 13/11/2026, dopo la rilevazione del 28/10/2026.",
    ]);
  });

  it("smette di avvisare quando il rating è riletto, anche il giorno stesso della revisione", () => {
    const revisioni = { IT: ["2026-11-13"] };
    expect(avvisiRating("2026-11-16", conRilevati({ IT: "2026-11-13" }), revisioni, LONTANO)).toEqual([]);
    expect(avvisiRating("2026-11-16", conRilevati({ IT: "2026-11-16" }), revisioni, LONTANO)).toEqual([]);
  });

  it("fra più revisioni passate cita l'ultima", () => {
    const avvisi = avvisiRating(
      "2027-01-04",
      conRilevati({ FR: "2026-05-01" }),
      { FR: ["2026-05-29", "2026-11-27"] },
      LONTANO,
    );
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0]).toContain("il 27/11/2026");
  });

  /** UE, MES e sovranazionali non hanno date: li ferma l'età. */
  it("senza revisioni, avvisa quando il rating ha più di un anno", () => {
    const d = conRilevati({ UE: "2026-10-28" });
    expect(avvisiRating("2027-10-28", d, {}, LONTANO)).toEqual([]);
    expect(avvisiRating("2027-10-29", d, {}, LONTANO)).toEqual([
      "Unione Eur. (AA): rilevato il 28/10/2026, più di un anno fa.",
    ]);
  });

  it("avvisa quando il calendario è finito", () => {
    const avvisi = avvisiRating("2027-01-04", conRilevati({}), {}, "2026-12-31");
    expect(avvisi).toEqual([
      "Il calendario delle revisioni S&P arriva al 31/12/2026: va aggiunto quello nuovo in lib/mercato/revisioni-rating.ts.",
    ]);
  });

  it("gli emittenti senza rating non avvisano", () => {
    expect(avvisiRating("2026-11-16", conRilevati({}), { IT: ["2026-11-13"] }, LONTANO)).toEqual([]);
  });
});

describe("riepilogoAvvisiRating", () => {
  it("elenca gli avvisi e dice dove correggere", () => {
    const testo = riepilogoAvvisiRating(["primo", "secondo"]);
    expect(testo).toContain("### Rating da riverificare");
    expect(testo).toContain("- primo\n- secondo");
    expect(testo).toContain("lib/mercato/emittenti.ts");
  });
});
