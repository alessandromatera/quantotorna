import type { GruppoAnno } from "./ordinamento";

/**
 * La tabella dei tassi fissi a pagine invece che tutta di seguito: seicento
 * righe sono un elenco che non finisce, sul telefono soprattutto.
 *
 * Divisa per anno, una pagina è un anno di scadenza intero: la domanda della
 * scaletta è «cosa scade quell'anno». Gli anni con pochi titoli, quasi tutti
 * oltre il 2040, si accorpano ai successivi finché la pagina ne ha almeno
 * `MINIMO_PER_PAGINA`: quaranta bottoni, metà con due titoli, non si
 * sfogliano. Senza anni, pagine di `RIGHE_PER_PAGINA` righe nell'ordine
 * scelto.
 */
export const MINIMO_PER_PAGINA = 10;
export const RIGHE_PER_PAGINA = 50;

export interface PaginaTabella<T> {
  /** «2027», «2043–2044», o «1–50» senza anni. */
  etichetta: string;
  /** Gli anni della pagina nell'ordine della tabella; senza anni, un gruppo con `anno` null. */
  gruppi: { anno: number | null; titoli: T[] }[];
  /** Quante righe ha. */
  righe: number;
  /** Gli anni che contiene: vuoto senza anni. */
  anni: number[];
}

function contaRighe(gruppi: { titoli: unknown[] }[]): number {
  return gruppi.reduce((somma, g) => somma + g.titoli.length, 0);
}

function paginaDiAnni<T>(gruppi: GruppoAnno<T>[]): PaginaTabella<T> {
  const anni = gruppi.map((g) => g.anno);
  const da = Math.min(...anni);
  const a = Math.max(...anni);
  return { etichetta: da === a ? String(da) : `${da}–${a}`, gruppi, righe: contaRighe(gruppi), anni };
}

/**
 * Una pagina per anno, nell'ordine dei gruppi. Un anno da `minimo` titoli in
 * su sta da solo; quelli più piccoli e consecutivi si sommano finché arrivano
 * a `minimo`, e una coda che in fondo non ci arriva si unisce alla pagina di
 * anni piccoli prima di lei. Un anno grande non si accorpa mai: se arriva
 * dopo pochi titoli piccoli, o li ha subito dopo, quelli restano una pagina
 * corta.
 */
export function paginePerAnno<T>(gruppi: GruppoAnno<T>[], minimo = MINIMO_PER_PAGINA): PaginaTabella<T>[] {
  const pagine: PaginaTabella<T>[] = [];
  let piccoli: GruppoAnno<T>[] = [];
  /** Gli anni dell'ultima pagina, se è fatta di anni piccoli: lì va a finire la coda. */
  let ultimiPiccoli: GruppoAnno<T>[] | null = null;
  for (const g of gruppi) {
    if (g.titoli.length >= minimo) {
      if (piccoli.length > 0) pagine.push(paginaDiAnni(piccoli));
      piccoli = [];
      pagine.push(paginaDiAnni([g]));
      ultimiPiccoli = null;
      continue;
    }
    piccoli.push(g);
    if (contaRighe(piccoli) >= minimo) {
      pagine.push(paginaDiAnni(piccoli));
      ultimiPiccoli = piccoli;
      piccoli = [];
    }
  }
  if (piccoli.length > 0) {
    if (ultimiPiccoli) pagine[pagine.length - 1] = paginaDiAnni([...ultimiPiccoli, ...piccoli]);
    else pagine.push(paginaDiAnni(piccoli));
  }
  return pagine;
}

/** Senza anni: pezzi di `perPagina` righe, nell'ordine in cui arrivano. */
export function pagineDiRighe<T>(titoli: T[], perPagina = RIGHE_PER_PAGINA): PaginaTabella<T>[] {
  const pagine: PaginaTabella<T>[] = [];
  for (let i = 0; i < titoli.length; i += perPagina) {
    const pezzo = titoli.slice(i, i + perPagina);
    pagine.push({
      etichetta: `${i + 1}–${i + pezzo.length}`,
      gruppi: [{ anno: null, titoli: pezzo }],
      righe: pezzo.length,
      anni: [],
    });
  }
  return pagine;
}

/**
 * La pagina scelta da chi guarda. Con gli anni si ricorda un anno: cambiando
 * filtri, ordine o condizioni le pagine si rifanno, e si resta su quella che
 * lo contiene. Senza anni si ricorda il numero della pagina insieme
 * all'elenco su cui è stata scelta: se l'elenco cambia (un altro ordine, un
 * filtro), la pagina 3 non vuol dire più niente e si torna alla prima.
 */
export type SceltaPagina = { anno: number } | { indice: number; elenco: unknown };

export function indicePagina<T>(
  pagine: PaginaTabella<T>[],
  scelta: SceltaPagina | null,
  elenco: unknown,
): number {
  if (scelta == null) return 0;
  if ("anno" in scelta) {
    const i = pagine.findIndex((p) => p.anni.includes(scelta.anno));
    return i < 0 ? 0 : i;
  }
  return scelta.elenco === elenco && scelta.indice < pagine.length && pagine[scelta.indice].anni.length === 0
    ? scelta.indice
    : 0;
}

/** Cosa ricordare quando si sceglie la pagina `indice`. */
export function sceltaDi<T>(pagine: PaginaTabella<T>[], indice: number, elenco: unknown): SceltaPagina {
  const anni = pagine[indice]?.anni ?? [];
  return anni.length > 0 ? { anno: anni[0] } : { indice, elenco };
}
