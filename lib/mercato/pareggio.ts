/**
 * Lettura dell'inflazione di pareggio: quale dei due titoli conviene, dato
 * quello che ci si aspetta dall'inflazione.
 *
 * Il calcolo del pareggio sta in `lib/costi/inflazione.ts`; qui c'è solo il
 * confronto con l'aspettativa, isolato dalla UI perché è una lettura
 * finanziaria e non una questione di grafica.
 *
 * Modulo puro, senza dipendenze dalla UI.
 */

export type Verdetto = "fisso" | "indicizzato" | "pari";

/**
 * Soglia di indifferenza, in punti percentuali. Sotto un decimo di punto la
 * differenza è dentro l'errore di tutto il resto — scadenze non identiche,
 * prezzi con il ritardo del sito, un'aspettativa di inflazione che è un
 * numero tondo — e dichiarare un vincitore sarebbe una precisione finta.
 */
const INDIFFERENZA_PP = 0.1;

export interface LetturaPareggio {
  verdetto: Verdetto;
  /** Punti percentuali fra pareggio e attesa, con segno (positivo = pareggio più alto). */
  scartoPp: number;
}

/**
 * `pareggioPct` è l'inflazione che rende i due titoli equivalenti,
 * `attesaPct` quella che ci si aspetta davvero (il valore di partenza o
 * quello scelto da chi guarda).
 *
 * Se l'inflazione attesa supera il pareggio, l'indicizzato incassa più di
 * quanto il suo prezzo sconti: conviene lui. Sotto il pareggio conviene il
 * tasso fisso, che quel rendimento lo ha già bloccato.
 */
export function leggiPareggio(
  pareggioPct: number,
  attesaPct: number,
): LetturaPareggio {
  const scartoPp = Math.round((pareggioPct - attesaPct) * 100) / 100;
  if (Math.abs(scartoPp) < INDIFFERENZA_PP) return { verdetto: "pari", scartoPp };
  return { verdetto: scartoPp > 0 ? "fisso" : "indicizzato", scartoPp };
}
