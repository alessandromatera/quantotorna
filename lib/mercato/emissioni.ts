/**
 * Regole pure dell'aggiornamento dei dati di emissione: da quale fonte viene
 * un dato, quali titoli chiedere a onvista e in che ordine, quando un nuovo
 * valore è davvero diverso dal vecchio.
 *
 * Le fonti, nell'ordine: i risultati d'asta del MEF per i titoli italiani
 * (lib/prezzi/mef.ts), la scheda onvista per gli altri e per gli italiani
 * che il MEF dell'anno non copre (lib/prezzi/onvista.ts), la scheda di Borsa
 * Italiana per la sola data di godimento quando manca.
 */

export const FONTE_MEF = "MEF, risultati d'asta";
export const FONTE_ONVISTA = "onvista.de (WM Datenservice)";
export const FONTE_BORSA_ITALIANA = "Borsa Italiana, data di godimento";

export interface EmissioneSalvata {
  prezzoEmissione: number | null;
  dataEmissione: string | null;
  fonte: string;
  dataAggiornamento: string;
}

/** Dato completo: prezzo e data, il minimo perché il disaggio si calcoli. */
export function completa(r: EmissioneSalvata | undefined): boolean {
  return r?.prezzoEmissione != null && r.dataEmissione != null;
}

/**
 * Gli ISIN da chiedere a onvista in questo aggiornamento, al più `massimo`:
 * solo quelli senza dati completi. Un dato del MEF non si chiede a nessun
 * altro (la data, se manca, la dà Borsa Italiana); un titolo già chiesto oggi
 * senza successo aspetta domani.
 *
 * Prima i titoli mai chiesti, nell'ordine del catalogo, poi quelli chiesti
 * invano, dal tentativo più vecchio. Nell'ordine del catalogo e basta, una
 * quarantina di titoli che onvista non copre occuperebbero tutti i posti ogni
 * giorno, e i nuovi non verrebbero chiesti mai.
 */
export function daChiedereAOnvista(params: {
  catalogo: string[];
  salvate: Map<string, EmissioneSalvata>;
  oggi: string;
  massimo: number;
}): string[] {
  const { catalogo, salvate, oggi, massimo } = params;
  const mai: string[] = [];
  const falliti: { isin: string; quando: string }[] = [];
  for (const isin of catalogo) {
    const r = salvate.get(isin);
    if (completa(r)) continue;
    if (r?.fonte.startsWith(FONTE_MEF)) continue;
    if (!r) {
      mai.push(isin);
      continue;
    }
    if (r.dataAggiornamento === oggi && r.fonte.includes("onvista")) continue;
    falliti.push({ isin, quando: r.dataAggiornamento });
  }
  // `sort` è stabile: a pari data resta l'ordine del catalogo.
  falliti.sort((a, b) => a.quando.localeCompare(b.quando));
  return [...mai, ...falliti.map((f) => f.isin)].slice(0, massimo);
}

/**
 * Un nuovo valore cambia davvero il conto? Sotto il mezzo millesimo è lo
 * stesso prezzo scritto con più decimali; 99,615 al posto di 99,62 invece è
 * una correzione, e va mostrata.
 */
export function cambiato(
  prima: EmissioneSalvata | undefined,
  dopo: { prezzoEmissione: number; dataEmissione: string },
): boolean {
  if (!completa(prima)) return false;
  return (
    Math.abs(prima!.prezzoEmissione! - dopo.prezzoEmissione) >= 0.0005 ||
    prima!.dataEmissione !== dopo.dataEmissione
  );
}
