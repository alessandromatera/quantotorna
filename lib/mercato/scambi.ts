/**
 * Quanto si scambia un titolo sul MOT: la sintesi dello storico, le soglie
 * del filtro e il modo di scriverlo. Modulo puro, senza dipendenze dalla UI.
 *
 * La misura è la MEDIANA del controvalore per seduta negli ultimi tre mesi
 * (lib/prezzi/euronext.ts), accanto al numero di sedute in cui il titolo ha
 * scambiato. Mediana e non media: la media la tirano su pochi blocchi
 * grossi — Romania 2032, il 20/10/2026: media 103 mila euro, mediana 42 mila —
 * mentre a chi compra diecimila nominali serve la seduta tipica. E la
 * frequenza accanto, perché una mediana a zero non dice se il titolo scambia
 * una volta a settimana o mai.
 */

import { formatNumero } from "../client/format";

export interface SintesiScambi {
  /** Mediana del controvalore per seduta, in euro, sedute senza scambi comprese. */
  mediana: number;
  /** Sedute nel periodo. */
  sedute: number;
  /** Sedute con almeno uno scambio. */
  attive: number;
}

/** Null senza sedute: un titolo senza storico non è un titolo che non scambia. */
export function sintetizzaScambi(controvalori: number[]): SintesiScambi | null {
  if (controvalori.length === 0) return null;
  const ordinati = [...controvalori].sort((a, b) => a - b);
  const meta = Math.floor(ordinati.length / 2);
  const mediana =
    ordinati.length % 2 === 1 ? ordinati[meta] : (ordinati[meta - 1] + ordinati[meta]) / 2;
  return {
    mediana: Math.round(mediana),
    sedute: controvalori.length,
    attive: controvalori.filter((c) => c > 0).length,
  };
}

export interface SogliaScambi {
  chiave: string;
  nome: string;
  /** Mediana in euro per seduta, estremo incluso. */
  minimo: number;
}

/**
 * Rilevato il 20/10/2026 sui 470 titoli del catalogo, tre mesi di sedute: la
 * mediana tipica è 4,4 milioni per i BTP a tasso fisso, 138 mila per la
 * Romania, 137 mila per la Francia, 62 mila per la Germania, 48 mila per la
 * Spagna, qualche centinaio di euro per la Grecia e zero per Irlanda e
 * Finlandia, che scambiano una seduta su due o meno. Con queste soglie
 * restavano 293, 187 e 145 titoli.
 *
 * Solo minimi: «quanto deve scambiare almeno» è l'unica domanda che ha senso
 * sulla liquidità — nessuno cerca i titoli che non si riescono a vendere.
 */
export const SOGLIE_SCAMBI: SogliaScambi[] = [
  { chiave: "qualche", nome: "almeno 50 mila €", minimo: 50_000 },
  { chiave: "buoni", nome: "almeno 250 mila €", minimo: 250_000 },
  { chiave: "alti", nome: "almeno 1 milione €", minimo: 1_000_000 },
];

/**
 * true se la mediana arriva alla soglia. Senza dato (non letto) il titolo
 * resta fuori, come i titoli senza duration con una fascia di volatilità
 * attiva: non si sa dove metterlo, e farlo passare direbbe che scambia.
 */
export function superaSoglia(mediana: number | null, soglia: SogliaScambi): boolean {
  return mediana != null && mediana >= soglia.minimo;
}

function decimale(n: number): string {
  return n.toFixed(1).replace(".", ",").replace(/,0$/, "");
}

/**
 * Il controvalore alla precisione con cui si scrive: decimi di milione,
 * migliaia, centinaia sotto le diecimila, euro sotto il migliaio. Lo usa
 * anche l'ordinamento, perché due titoli che leggono «163 mila €» sono a
 * pari merito.
 */
export function arrotondaControvalore(euro: number): number {
  if (euro >= 1_000_000) return Math.round(euro / 100_000) * 100_000;
  if (euro >= 10_000) return Math.round(euro / 1_000) * 1_000;
  if (euro >= 1_000) return Math.round(euro / 100) * 100;
  return Math.round(euro);
}

/**
 * «5,3 mln €», «163 mila €», «850 €». Arrotondato apposta: su una misura
 * così variabile le cifre dopo la seconda non dicono niente.
 */
export function formatControvalore(euro: number): string {
  const tondo = arrotondaControvalore(euro);
  if (tondo >= 1_000_000) return `${decimale(tondo / 1_000_000)} mln €`;
  if (tondo >= 10_000) return `${tondo / 1_000} mila €`;
  if (tondo >= 1_000) return `${decimale(tondo / 1_000)} mila €`;
  return `${tondo} €`;
}

/** «1 contratto», «29 contratti». */
export function formatContratti(n: number): string {
  return n === 1 ? "1 contratto" : `${formatNumero(n)} contratti`;
}

/** «scambiato in 62 sedute su 65», «mai scambiato in 65 sedute». */
export function formatFrequenza(s: SintesiScambi): string {
  return s.attive === 0
    ? `mai scambiato in ${s.sedute} sedute`
    : `scambiato in ${s.attive} ${s.attive === 1 ? "seduta" : "sedute"} su ${s.sedute}`;
}
