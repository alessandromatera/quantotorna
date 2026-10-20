/**
 * Prezzo e data di emissione dei titoli NON italiani — e di riserva per
 * quelli italiani che i documenti del MEF dell'anno non coprono — dalla
 * scheda del titolo su onvista.de.
 *
 * Per i titoli di Stato esteri, sovranazionali e corporate non esiste una
 * fonte primaria unica: ogni Tesoro pubblica le sue aste a modo suo, e chi
 * colloca per sindacato lo scrive solo nel prospetto. onvista pubblica per
 * ogni ISIN l'anagrafica di WM Datenservice, il fornitore di dati di
 * riferimento delle banche tedesche: verificato il 19/10/2026 su 66 titoli
 * di 25 emittenti contro un calcolo di riferimento, prezzo e data coincidono
 * in 59 casi, in 4 sono più precisi (99,615 dove il riferimento arrotonda a
 * 99,62), in uno il riferimento lo metteva a 100 per difetto (Grecia 2029:
 * 99,796); mancava in 2.
 *
 * I dati stanno nel JSON che la pagina incorpora (`__NEXT_DATA__`, campo
 * `bondsBaseData`). Scraping dichiarato: se la pagina cambia forma o l'ISIN
 * non c'è, la funzione lo dice e non restituisce niente — mai un prezzo
 * indovinato.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const TIMEOUT_MS = 15_000;

export interface EmissioneOnvista {
  /** Base 100. */
  prezzoEmissione: number;
  /** ISO. */
  dataEmissione: string;
}

const VALUTE_CONFLUITE_NELL_EURO = new Set([
  "ITL", "DEM", "FRF", "ESP", "ATS", "BEF", "NLG", "PTE", "FIM", "IEP", "GRD", "LUF",
]);

interface BaseDati {
  priceEmission?: number | null;
  isoCurrencyPriceEmission?: string | null;
  datetimeEmission?: string | null;
  datetimeStartCalculationInterest?: string | null;
}

/** Parse puro della pagina: i dati di emissione, o il motivo per cui non ci sono. */
export function leggiSchedaOnvista(
  html: string,
  isin: string,
): EmissioneOnvista | { motivo: string } {
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return { motivo: "pagina senza dati strutturati: la struttura di onvista è cambiata" };
  let dati: { props?: { pageProps?: { data?: { snapshot?: Record<string, unknown> } } } };
  try {
    dati = JSON.parse(json);
  } catch {
    return { motivo: "dati della pagina illeggibili" };
  }
  const snapshot = dati.props?.pageProps?.data?.snapshot;
  const strumento = snapshot?.instrument as { isin?: string } | undefined;
  // Un ISIN sconosciuto rimanda alla ricerca: senza questo controllo si
  // leggerebbe la pagina di un altro titolo.
  if (strumento?.isin !== isin) return { motivo: "titolo non presente su onvista" };
  const base = snapshot?.bondsBaseData as BaseDati | undefined;
  if (!base) return { motivo: "scheda senza dati obbligazionari" };
  const prezzo = base.priceEmission;
  if (prezzo == null || !Number.isFinite(prezzo) || prezzo <= 0 || prezzo > 200) {
    return { motivo: "prezzo di emissione non pubblicato" };
  }
  // Il prezzo è in base 100, quindi non dipende dalla valuta finché il titolo
  // è quello: i BTP emessi in lire e ridenominati in euro (1996-1998) portano
  // ancora «ITL», con lo stesso prezzo percentuale. Un'altra valuta invece è
  // un altro titolo, o un prezzo che non si sa leggere.
  const valuta = base.isoCurrencyPriceEmission;
  if (valuta && valuta !== "EUR" && !VALUTE_CONFLUITE_NELL_EURO.has(valuta)) {
    return { motivo: `prezzo di emissione in ${valuta}` };
  }
  const data = (base.datetimeEmission ?? base.datetimeStartCalculationInterest)?.slice(0, 10);
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { motivo: "data di emissione non pubblicata" };
  return { prezzoEmissione: prezzo, dataEmissione: data };
}

/** Scarica e legge la scheda di un ISIN. Fallisce col motivo, mai a metà. */
export async function emissioneOnvista(isin: string): Promise<EmissioneOnvista> {
  const risposta = await fetch(`https://www.onvista.de/anleihen/${isin}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!risposta.ok) throw new Error(`onvista ha risposto ${risposta.status}`);
  const esito = leggiSchedaOnvista(await risposta.text(), isin);
  if ("motivo" in esito) throw new Error(esito.motivo);
  return esito;
}
