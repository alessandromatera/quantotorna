/** Formattazione per la pagina (gira nel browser, ri-esporta i moduli puri). */
import { formatEuro } from "../money";

export { formatEuro };
export { formatDataIT, giorniTra, oggiISO } from "../date";

/** 1550000 → "15,5k €" per assi e spazi stretti. */
export function formatEuroCompatto(centesimi: number): string {
  const euro = centesimi / 100;
  const assoluto = Math.abs(euro);
  const segno = euro < 0 ? "-" : "";
  if (assoluto >= 1_000_000)
    return `${segno}${(assoluto / 1_000_000).toFixed(1).replace(".", ",")}M €`;
  if (assoluto >= 1_000) {
    const migliaia = assoluto / 1_000;
    const testo = Number.isInteger(migliaia)
      ? migliaia.toString()
      : migliaia.toFixed(1).replace(".", ",");
    return `${segno}${testo}k €`;
  }
  return `${segno}${assoluto.toFixed(0)} €`;
}

/**
 * Punti che separano gruppi di tre cifre, senza virgola: "5.000", "12.500",
 * "1.250.000". All'italiana sono migliaia; leggerli come decimali faceva di
 * "5.000" cinque euro.
 */
const MIGLIAIA = /^-?\d{1,3}(\.\d{3})+$/;

/**
 * Input utente in euro → centesimi. Formato italiano: la virgola separa i
 * decimali, i punti sono separatori delle migliaia ("1.234,56", "5.000").
 * Senza virgola e senza gruppi di migliaia, un punto è accettato come
 * separatore decimale ("1234.56", "9.5").
 */
export function parseEuroInCentesimi(testo: string): number | null {
  const pulito = testo.trim().replace(/\s|€/g, "");
  if (pulito === "") return null;
  const normalizzato = pulito.includes(",") || MIGLIAIA.test(pulito)
    ? pulito.replace(/\./g, "").replace(",", ".")
    : pulito;
  const n = Number(normalizzato);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Quantità: come gli importi, "10.000" sono diecimila nominali. Non vale per
 * i prezzi, dove "99.875" è un prezzo a tre decimali (vedi `parseNumeroIT`).
 */
export function parseQuantitaIT(testo: string): number | null {
  const pulito = testo.trim().replace(/\s/g, "");
  return parseNumeroIT(MIGLIAIA.test(pulito) ? pulito.replace(/\./g, "") : pulito);
}

/** Numero con virgola ("91,2") → numero JS, per prezzi e quantità. */
export function parseNumeroIT(testo: string): number | null {
  const pulito = testo.trim().replace(/\s|€/g, "");
  if (pulito === "") return null;
  const normalizzato = pulito.includes(",")
    ? pulito.replace(/\./g, "").replace(",", ".")
    : pulito;
  const n = Number(normalizzato);
  return Number.isFinite(n) ? n : null;
}

export function formatPct(valore: number, decimali = 2): string {
  return `${valore.toFixed(decimali).replace(".", ",")}%`;
}

/** Percentuale con segno esplicito: +1,20% / −0,80%. */
export function formatPctSegno(valore: number, decimali = 2): string {
  return `${valore > 0 ? "+" : ""}${formatPct(valore, decimali)}`;
}

/** Importo con segno esplicito, per delta e plus/minusvalenze. */
export function formatEuroSegno(centesimi: number): string {
  return `${centesimi > 0 ? "+" : ""}${formatEuro(centesimi)}`;
}

/** Prezzo di un titolo in base 100: due decimali, unico formato del sito. */
export function formatPrezzo(prezzo: number, decimali = 2): string {
  return prezzo.toFixed(decimali).replace(".", ",");
}

/**
 * Prezzo come lo quota il MOT: due decimali, tre quando servono. Arrotondare
 * sempre a due cambierebbe il prezzo (100,118 non è 100,12); oltre il terzo
 * decimale, una media direbbe cifre che nessuno quota.
 */
export function formatPrezzoMot(prezzo: number): string {
  const millesimi = Math.round(prezzo * 1000) / 1000;
  return formatPrezzo(millesimi, Math.abs(millesimi * 100 - Math.round(millesimi * 100)) > 1e-9 ? 3 : 2);
}

/** Numero generico all'italiana: 12345.6 → "12.345,6". */
export function formatNumero(valore: number, decimali = 0): string {
  const fisso = Math.abs(valore).toFixed(decimali);
  const [intero, parte] = fisso.split(".");
  const conPunti = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const segno = valore < 0 ? "-" : "";
  return parte ? `${segno}${conPunti},${parte}` : `${segno}${conPunti}`;
}

/** Centesimi → testo per un campo di input ("1234,50"), senza separatori. */
export function euroInInput(centesimi: number): string {
  return (centesimi / 100).toFixed(2).replace(".", ",");
}

/** Numero → testo per un campo di input, con la virgola e senza zeri inutili. */
export function numeroInInput(valore: number): string {
  return String(Math.round(valore * 1e6) / 1e6).replace(".", ",");
}
