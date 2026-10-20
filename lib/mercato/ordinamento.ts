/**
 * Ordinamento dei candidati del catalogo BTP: una colonna e un verso, scelti
 * cliccando l'intestazione, e il raggruppamento per anno di scadenza.
 *
 * Prima erano due file di bottoni, «ordina per» e «poi per», e la seconda
 * diceva meno di quanto prometteva. Il secondo criterio decide solo a pari
 * merito sul primo, e misurato il 20/10/2026 sui 446 titoli della tabella
 * il pari merito era raro proprio dove serviva: con la scadenza (il
 * predefinito, «scadenza → YTM») cadeva sulla stessa data il 12% delle
 * righe, quindi la lista era solo cronologica e non «il migliore per ogni
 * scadenza»; con la plus a rimborso il 2%. Quella domanda la fa il
 * raggruppamento per ANNO, dove i titoli che condividono l'anno sono il 98%.
 *
 * Il confronto avviene alla PRECISIONE MOSTRATA a schermo (YTM, cedola,
 * prezzo e duration a due decimali, importi in centesimi, scambi come li
 * scrive `formatControvalore`): due righe che leggono «3,12%» sono a pari
 * merito, e decide lo spareggio — lo YTM netto, o la scadenza quando si
 * ordina già per YTM —, poi l'ISIN, perché l'ordine resti riproducibile.
 *
 * Modulo puro, senza dipendenze dalla UI.
 */

import { arrotondaControvalore } from "./scambi";

export type ChiaveOrdinamento =
  | "scadenza"
  | "cedola"
  | "prezzo"
  | "plus"
  | "ytm"
  | "netto"
  | "duration"
  | "scambi";

export type Verso = "asc" | "desc";

export interface Ordinamento {
  chiave: ChiaveOrdinamento;
  verso: Verso;
}

/**
 * Il verso del primo clic su una colonna: prima la scadenza più vicina, il
 * prezzo più basso e il titolo meno volatile; prima il valore più alto per
 * rendimento, cedola, plus a rimborso e scambi. Il secondo clic inverte.
 */
export const VERSO_INIZIALE: Record<ChiaveOrdinamento, Verso> = {
  scadenza: "asc",
  cedola: "desc",
  prezzo: "asc",
  plus: "desc",
  ytm: "desc",
  netto: "desc",
  duration: "asc",
  scambi: "desc",
};

/** Il predefinito: con il raggruppamento per anno, il migliore di ogni anno in cima. */
export const ORDINAMENTO_PREDEFINITO: Ordinamento = { chiave: "ytm", verso: "desc" };

/** Come si legge l'ordine attuale, per dirlo a parole sopra la tabella. */
export const NOMI_ORDINAMENTO: Record<ChiaveOrdinamento, string> = {
  scadenza: "scadenza",
  cedola: "cedola",
  prezzo: "prezzo",
  plus: "plus a rimborso",
  ytm: "YTM netto",
  netto: "netto a scadenza",
  duration: "duration",
  scambi: "scambi",
};

export function descriviOrdinamento(o: Ordinamento): string {
  const verso =
    o.chiave === "scadenza"
      ? o.verso === "asc"
        ? "dalla più vicina"
        : "dalla più lontana"
      : o.verso === "asc"
        ? "dal più basso"
        : "dal più alto";
  return `${NOMI_ORDINAMENTO[o.chiave]}, ${verso}`;
}

export interface CandidatoOrdinabile {
  isin: string;
  dataScadenza: string;
  ytmNettoPct: number | null;
  plusRimborso10k: number;
  cedolaAnnua: number;
  prezzo: number;
  /** Duration modificata: la misura della volatilità del prezzo. */
  durationModificata: number | null;
  /** Mediana degli euro scambiati per seduta; null se non letta. */
  scambiMediana: number | null;
  /** Centesimi che si ritrovano a scadenza spendendo oggi 10.000 €; null se non calcolati. */
  netto10kInvestiti: { incassi: number } | null;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Il valore della colonna come lo si legge a schermo; null se manca. */
function valore(t: CandidatoOrdinabile, chiave: ChiaveOrdinamento): number | string | null {
  switch (chiave) {
    case "scadenza":
      return t.dataScadenza;
    case "cedola":
      return round2(t.cedolaAnnua);
    case "prezzo":
      return round2(t.prezzo);
    case "plus":
      return t.plusRimborso10k;
    case "ytm":
      return t.ytmNettoPct == null ? null : round2(t.ytmNettoPct);
    case "netto":
      return t.netto10kInvestiti?.incassi ?? null;
    case "duration":
      return t.durationModificata == null ? null : round2(t.durationModificata);
    case "scambi":
      return t.scambiMediana == null ? null : arrotondaControvalore(t.scambiMediana);
  }
}

/**
 * Negativo se `a` viene prima di `b`. Chi non ha il valore (YTM non
 * calcolato, duration o scambi assenti) finisce in fondo in entrambi i
 * versi: invertire l'ordine non deve portare in cima le righe vuote.
 */
function confronta(a: CandidatoOrdinabile, b: CandidatoOrdinabile, o: Ordinamento): number {
  const va = valore(a, o.chiave);
  const vb = valore(b, o.chiave);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const diff =
    typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
  return o.verso === "asc" ? diff : -diff;
}

/** Chi decide a pari merito: lo YTM netto, o la scadenza quando si ordina già per YTM. */
export function spareggio(chiave: ChiaveOrdinamento): Ordinamento {
  return chiave === "ytm" ? { chiave: "scadenza", verso: "asc" } : { chiave: "ytm", verso: "desc" };
}

/** Copia ordinata: colonna scelta, poi lo spareggio, poi l'ISIN. */
export function ordinaCandidati<T extends CandidatoOrdinabile>(titoli: T[], o: Ordinamento): T[] {
  const secondo = spareggio(o.chiave);
  return [...titoli].sort(
    (a, b) => confronta(a, b, o) || confronta(a, b, secondo) || a.isin.localeCompare(b.isin),
  );
}

/** Clic su un'intestazione: la stessa colonna inverte, un'altra parte dal suo verso iniziale. */
export function cambiaOrdinamento(attuale: Ordinamento, chiave: ChiaveOrdinamento): Ordinamento {
  return attuale.chiave === chiave
    ? { chiave, verso: attuale.verso === "asc" ? "desc" : "asc" }
    : { chiave, verso: VERSO_INIZIALE[chiave] };
}

export interface GruppoAnno<T> {
  anno: number;
  titoli: T[];
}

/**
 * Titoli già ordinati, divisi per anno di scadenza senza toccare l'ordine
 * dentro ciascun anno. Gli anni vanno dal più vicino, tranne quando si
 * ordina per scadenza dalla più lontana: lì anche i gruppi la seguono.
 */
export function raggruppaPerAnno<T extends { dataScadenza: string }>(
  ordinati: T[],
  o: Ordinamento,
): GruppoAnno<T>[] {
  const perAnno = new Map<number, T[]>();
  for (const t of ordinati) {
    const anno = Number(t.dataScadenza.slice(0, 4));
    const lista = perAnno.get(anno);
    if (lista) lista.push(t);
    else perAnno.set(anno, [t]);
  }
  const decrescente = o.chiave === "scadenza" && o.verso === "desc";
  return [...perAnno.entries()]
    .sort((a, b) => (decrescente ? b[0] - a[0] : a[0] - b[0]))
    .map(([anno, titoli]) => ({ anno, titoli }));
}
