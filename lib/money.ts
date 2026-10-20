/**
 * Rappresentazione monetaria del motore: CENTESIMI di euro, interi.
 * Questo è l'unico punto in cui si arrotonda: ogni calcolo che produce un
 * importo monetario deve passare da arrotondaCentesimi.
 */

export type Centesimi = number;

/**
 * Arrotondamento monetario: metà allontanata dallo zero
 * ("round half away from zero"), simmetrico per importi negativi.
 * 234,5 → 235; −234,5 → −235; 234,4 → 234.
 */
export function arrotondaCentesimi(valore: number): Centesimi {
  return Math.sign(valore) * Math.round(Math.abs(valore));
}

/** Euro (anche con decimali) → centesimi interi. */
export function eurCent(importoEuro: number): Centesimi {
  return arrotondaCentesimi(importoEuro * 100);
}

/** Centesimi → euro numerici (solo per calcoli di visualizzazione). */
export function inEuro(centesimi: Centesimi): number {
  return centesimi / 100;
}

/**
 * Formattazione italiana: 123456 → "1.234,56 €".
 * Implementata a mano (non con toLocaleString) perché il risultato non deve
 * dipendere dai dati ICU disponibili nel runtime.
 */
export function formatEuro(centesimi: Centesimi): string {
  // Arrotondamento difensivo: `% 100` su un valore frazionario produceva
  // "12,34.5 €". Ogni importo dovrebbe già passare da `arrotondaCentesimi`,
  // ma questa è una funzione pubblica e non può fidarsi di chi la chiama.
  if (!Number.isFinite(centesimi)) return "—";
  const intero = arrotondaCentesimi(centesimi);
  const assoluto = Math.abs(intero);
  const euro = Math.floor(assoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimali = (assoluto % 100).toString().padStart(2, "0");
  return `${intero < 0 ? "-" : ""}${euro},${decimali} €`;
}
