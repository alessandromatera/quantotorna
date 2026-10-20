/**
 * Le due classificazioni di un titolo: quella FISCALE, che decide come il
 * motore lo tassa, e la FAMIGLIA del listino, che decide cosa significano
 * prezzo e cedola della riga.
 *
 * Convenzioni comuni a tutto il motore:
 * - importi in CENTESIMI di euro, interi (lib/money.ts);
 * - date ISO `YYYY-MM-DD`; il formato italiano è solo della pagina;
 * - prezzi in base 100 del nominale (98.45), cedole e tassi in percentuale
 *   annua (3.5 = 3,50%);
 * - quantità = NOMINALE in euro.
 */

/**
 * Categoria fiscale. Sono tutte al 12,5% sui redditi di capitale e al 48,08%
 * × 26% sulle plusvalenze: quantotorna tratta solo titoli di Stato italiani,
 * Stati della white list e organismi sovranazionali, e l'elenco chiuso di
 * lib/mercato/emittenti.ts scarta tutto il resto. Corporate, agenzie
 * nazionali ed ETF qui non arrivano.
 */
export const CATEGORIE_STRUMENTO = [
  "btpFisso",
  "ccteu",
  "btpItalia",
  /**
   * BOT, e più in generale lo scarto di emissione tassato come reddito di
   * capitale: vedi `isScartoAnticipato` in lib/bond/ytm.ts.
   */
  "bot",
  /**
   * Stati della white list (Bund, Bonos, Austria, Belgio…): stessa aliquota
   * dei titoli italiani, emittente e rischio di credito diversi.
   */
  "titoloStatoEstero",
  "sovranazionale",
] as const;
export type CategoriaStrumento = (typeof CATEGORIE_STRUMENTO)[number];

/**
 * Famiglia del titolo nel listino MOT. Determina COSA SIGNIFICANO prezzo e
 * cedola della riga, quindi quali metriche il motore può calcolare:
 *
 * - `fisso`: cedola nominale costante, prezzo nominale. Il modello a tasso
 *   fisso vale per intero (YTM netto, duration, plusvalenza a rimborso).
 * - `zeroCoupon`: strip di BTP e zero coupon esteri. Un solo incasso a
 *   scadenza; sugli strip italiani il guadagno è SCARTO DI EMISSIONE, reddito
 *   di capitale al 12,5% pieno che NON si compensa con lo zainetto.
 * - `bot`: Buoni Ordinari del Tesoro. Zero coupon a breve, con lo scarto
 *   tassato in anticipo all'asta.
 * - `ccteu`: tasso variabile, cedola = Euribor 6m + spread. Il listino
 *   pubblica lo spread (nel nome) ma non la cedola in corso: il rendimento
 *   si calcola con l'Euribor di oggi, nell'ipotesi dichiarata che resti lì.
 * - `indicizzatoEuro`: BTP€i. Cedola REALE su capitale rivalutato con l'HICP
 *   area euro; il MOT ne quota il prezzo REALE. Dagli stessi campi il motore
 *   ricava un rendimento REALE — cambia il significato, non la matematica.
 *   Gli importi in euro effettivi richiederebbero il coefficiente di
 *   indicizzazione, e per questo non vengono mostrati.
 * - `italia`: BTP Italia. Rivalutazione FOI pagata per cassa ogni semestre e
 *   premio fedeltà: NON esiste un rendimento a scadenza senza proiettare
 *   l'inflazione. Si mostra per essere riconosciuto, non per essere valutato.
 * - `stepUp`: BTP Valore, Più e Futura. Cedola fissata in partenza ma
 *   crescente a gradini (`gradiniCedola`): i flussi sono noti e il motore li
 *   calcola cedola per cedola. Il listino pubblica solo la cedola in corso,
 *   quindi il piano viene dalla scheda di Borsa Italiana o da
 *   lib/mercato/stepup.ts.
 */
export const TIPI_CATALOGO = [
  "fisso",
  "zeroCoupon",
  "bot",
  "ccteu",
  "indicizzatoEuro",
  "italia",
  "stepUp",
] as const;
export type TipoCatalogo = (typeof TIPI_CATALOGO)[number];
