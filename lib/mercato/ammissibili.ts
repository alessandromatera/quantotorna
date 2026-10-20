/**
 * Titoli che non vale la pena mostrare.
 *
 * Un YTM NETTO negativo significa una cosa sola: portando il titolo a
 * scadenza si riceve meno di quanto si paga oggi, imposte comprese. Non è un
 * compromesso da valutare — è una perdita certa, e in un catalogo da qualche
 * centinaio di righe occupa spazio che serve alle alternative.
 *
 * Si guarda il NETTO e non il lordo perché è il numero che la pagina mette in
 * prima colonna e su cui ordina: un titolo può avere un lordo appena positivo
 * e un netto sotto zero — l'imposta sulle cedole c'è comunque, mentre la
 * minusvalenza a rimborso nello YTM non genera crediti — e in quel caso a
 * perdere sono i soldi veri, non quelli al lordo.
 *
 * NON si scarta chi ha il rendimento a `null`: «non calcolabile» non è
 * «negativo». Un CCTeu senza Euribor o un titolo con un prezzo di catalogo
 * anomalo restano visibili, con il loro motivo accanto; per nasconderli c'è
 * il filtro `soloConRendimento`, che è una scelta di chi guarda.
 *
 * La regola vive qui e non nella pagina perché una soglia duplicata è una
 * soglia che prima o poi diverge: lo scaricamento giornaliero e la pagina
 * devono scartare gli stessi titoli.
 *
 * Modulo puro: nessuna dipendenza da React, dal DB o dalle API.
 */

/** Un titolo con il rendimento netto già calcolato, in percentuale. */
export interface ConRendimentoNetto {
  /** Percentuale annua netta; null quando il motore non l'ha prodotta. */
  ytmNettoPct: number | null;
}

/**
 * `false` solo per un rendimento netto sotto zero. Null e zero passano: il
 * primo è un dato mancante, il secondo è un pareggio, e nessuno dei due è
 * la perdita certa che questa regola toglie di mezzo.
 */
export function rendimentoAccettabile(ytmNettoPct: number | null): boolean {
  return ytmNettoPct == null || ytmNettoPct >= 0;
}

/** Scarta i titoli a rendimento netto negativo, conservando l'ordine. */
export function soloRendimentiAccettabili<T extends ConRendimentoNetto>(
  titoli: T[],
): T[] {
  return titoli.filter((t) => rendimentoAccettabile(t.ytmNettoPct));
}

/** Quanti ne toglierebbe: serve a dirlo, invece di farli sparire in silenzio. */
export function quantiScartati(titoli: ConRendimentoNetto[]): number {
  return titoli.length - soloRendimentiAccettabili(titoli).length;
}
