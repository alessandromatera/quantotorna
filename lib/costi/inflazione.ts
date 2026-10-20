/**
 * Rendimento REALE e inflazione di pareggio.
 *
 * Il tasso d'inflazione è un parametro, non un dato osservato: il valore di
 * partenza è il 2%, l'obiettivo di medio termine della BCE — un riferimento,
 * non una misura — e chi guarda lo può cambiare.
 *
 * Semplificazione dichiarata: un tasso costante per tutto il periodo.
 */

/** Obiettivo BCE di medio termine: un riferimento, non un dato osservato. */
export const INFLAZIONE_PREDEFINITA = 2;

/**
 * Equazione di Fisher, forma esatta:
 *   (1 + reale) = (1 + nominale) / (1 + inflazione)
 *
 * Non l'approssimazione «nominale − inflazione», che sbaglia tanto più
 * quanto i tassi sono alti.
 */
export function tassoReale(nominalePct: number, inflazionePct: number): number {
  return ((1 + nominalePct / 100) / (1 + inflazionePct / 100) - 1) * 100;
}

/**
 * INFLAZIONE DI PAREGGIO fra un titolo a tasso fisso e uno indicizzato di
 * pari scadenza: il tasso di inflazione al quale i due rendono uguale.
 *
 *   (1 + pareggio) = (1 + nominale) / (1 + reale)
 *
 * È la stessa equazione di `tassoReale` risolta rispetto all'inflazione —
 * infatti `tassoReale(nominale, pareggio) === reale`. Si legge così: se
 * l'inflazione futura sarà PIÙ ALTA del pareggio vince l'indicizzato, se
 * sarà più bassa vince il tasso fisso.
 *
 * Da confrontare con rendimenti LORDI di entrambi i titoli: il netto di un
 * indicizzato dipende dalla rivalutazione del capitale, che è tassata e non
 * è nota in anticipo. È anche la convenzione con cui il breakeven viene
 * quotato sul mercato.
 *
 * Non è una previsione: è quanto il mercato sta già scontando oggi.
 */
export function inflazionePareggio(nominalePct: number, realePct: number): number {
  return ((1 + nominalePct / 100) / (1 + realePct / 100) - 1) * 100;
}
