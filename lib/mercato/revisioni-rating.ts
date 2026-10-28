/**
 * Quando ricontrollare i rating scritti a mano in lib/mercato/emittenti.ts.
 *
 * I rating non si scaricano (vedi RATING_RILEVATI), ma si sa QUANDO possono
 * cambiare: il regolamento europeo sulle agenzie di rating (art. 8 bis del
 * Reg. CE 1060/2009) obbliga ogni agenzia a pubblicare a fine dicembre le
 * date dell'anno dopo in cui rivedrà i rating degli Stati dell'Unione (S&P
 * ne fissa due o tre per Stato), sempre di venerdì dopo la chiusura dei
 * mercati. Il giro confronta
 * queste date con quella di rilevazione e avvisa l'autore, che rilegge il
 * rating e lo corregge.
 *
 * Fuori calendario un'agenzia può muoversi solo in casi eccezionali, ma
 * succede: S&P ha declassato la Francia il 17/10/2025, prima della data
 * fissata. Per questo, e per UE, MES e sovranazionali, che qui non hanno
 * date, un rating rilevato da più di un anno si ricontrolla comunque.
 *
 * Modulo puro, senza dipendenze dalla UI.
 */
import { formatDataIT, giorniTra } from "../date";
import { DESCRIZIONI, EMITTENTI, type DescrizioneEmittente, type Emittente } from "./emittenti";

/**
 * Le date in cui S&P pubblica le revisioni dei rating sovrani, per
 * emittente, in ordine.
 *
 * Quelle del 2026 vengono dal calendario di dicembre 2025 come l'ha
 * riportato la stampa (il documento di S&P non si è trovato), riscontrato
 * il 28/10/2026 sulle revisioni uscite: ogni data passata qui è una
 * revisione di cui si è trovata notizia, o una data del calendario
 * coerente con quelle. Il calendario dava Cipro al 15/05 e al 13/11, ma S&P
 * l'ha rivista il 18/09: qui c'è solo quella. Il calendario dell'anno nuovo
 * esce a fine dicembre: va aggiunto qui, e spostato CALENDARIO_SP_FINO_AL.
 */
export const REVISIONI_SP: Partial<Record<Emittente, readonly string[]>> = {
  IT: ["2026-01-30", "2026-05-15", "2026-11-13"],
  DE: ["2026-04-24", "2026-10-23"],
  ES: ["2026-03-13", "2026-09-11"],
  AT: ["2026-02-06", "2026-08-07"],
  BE: ["2026-04-24", "2026-10-23"],
  FR: ["2026-05-29", "2026-11-27"],
  NL: ["2026-04-17", "2026-10-16"],
  FI: ["2026-04-24", "2026-10-23"],
  IE: ["2026-03-20", "2026-09-18"],
  PT: ["2026-02-27", "2026-08-28"],
  GR: ["2026-04-24", "2026-10-23"],
  SI: ["2026-03-27", "2026-09-25"],
  CY: ["2026-09-18"],
  HR: ["2026-03-13", "2026-09-11"],
  LT: ["2026-05-29", "2026-11-27"],
  LV: ["2026-05-29", "2026-11-27"],
  RO: ["2026-04-03", "2026-10-02"],
  PL: ["2026-05-08", "2026-11-06"],
  HU: ["2026-05-29", "2026-11-27"],
  BG: ["2026-05-15", "2026-11-13"],
};

/** L'ultimo giorno coperto da REVISIONI_SP: dopo, manca il calendario. */
export const CALENDARIO_SP_FINO_AL = "2026-12-31";

/** Oltre questi giorni un rating si ricontrolla anche senza revisioni. */
export const RATING_VALIDO_GIORNI = 365;

/**
 * Cosa ricontrollare il giorno `oggi`, una riga per avviso: gli emittenti
 * che S&P ha rivisto dopo la rilevazione, quelli rilevati da più di un anno,
 * e il calendario se è finito.
 *
 * Una revisione conta dal giorno dopo: S&P pubblica il venerdì sera, dopo il
 * giro, e il giro del venerdì non la vede ancora. Una revisione nel giorno
 * stesso della rilevazione conta come già letta: il rating si rilegge dopo
 * la pubblicazione, non prima.
 */
export function avvisiRating(
  oggi: string,
  descrizioni: Record<Emittente, DescrizioneEmittente> = DESCRIZIONI,
  revisioni: Partial<Record<Emittente, readonly string[]>> = REVISIONI_SP,
  calendarioFinoAl: string = CALENDARIO_SP_FINO_AL,
): string[] {
  const avvisi: string[] = [];
  if (oggi > calendarioFinoAl) {
    avvisi.push(
      `Il calendario delle revisioni S&P arriva al ${formatDataIT(calendarioFinoAl)}: ` +
        "va aggiunto quello nuovo in lib/mercato/revisioni-rating.ts.",
    );
  }
  for (const e of EMITTENTI) {
    const { breve, rating, ratingRilevato } = descrizioni[e];
    if (rating == null || ratingRilevato == null) continue;
    const passate = (revisioni[e] ?? []).filter((r) => r > ratingRilevato && r < oggi);
    if (passate.length > 0) {
      avvisi.push(
        `${breve} (${rating}): S&P ha pubblicato una revisione il ` +
          `${formatDataIT(passate[passate.length - 1])}, dopo la rilevazione del ${formatDataIT(ratingRilevato)}.`,
      );
    } else if (giorniTra(ratingRilevato, oggi) > RATING_VALIDO_GIORNI) {
      avvisi.push(`${breve} (${rating}): rilevato il ${formatDataIT(ratingRilevato)}, più di un anno fa.`);
    }
  }
  return avvisi;
}

/** Gli avvisi in Markdown, per il riepilogo del giro su GitHub. */
export function riepilogoAvvisiRating(avvisi: string[]): string {
  return [
    "### Rating da riverificare sul sito di S&P",
    "",
    ...avvisi.map((a) => `- ${a}`),
    "",
    "Si correggono in `lib/mercato/emittenti.ts`, con la data della lettura in `ratingRilevato`.",
    "",
  ].join("\n");
}
