/**
 * Prezzo e data di emissione dei titoli di Stato italiani dalla fonte
 * primaria: i risultati d'asta e di collocamento sindacato che il MEF
 * (Dipartimento del Tesoro) pubblica in PDF, uno per operazione.
 *
 * Ogni documento riporta, oltre al prezzo di quell'asta, il «Prezzo Fiscale»:
 * il prezzo di emissione ai fini dell'imposta, che per i titoli emessi in più
 * tranche è quello della PRIMA (art. 11 DLgs 239/96). È il numero che decide
 * il disaggio di un BTP e lo scarto di un BOT. Verificato il 19/10/2026: sui
 * titoli confrontati coincide con il prezzo di emissione di WM Datenservice
 * (onvista) e con quello dei calcoli di riferimento, che evidentemente lo
 * prendono da qui. Accanto c'è la «Data Emissione», da cui matura.
 *
 * Le pagine del sito elencano i documenti dell'anno in corso, per tipo di
 * titolo. Si leggono solo quelli nuovi (l'elenco dei già letti lo tiene
 * chi chiama): una volta salvato, il prezzo di emissione di un titolo non
 * cambia più. Scraping dichiarato: se una pagina o un PDF cambiano forma,
 * il documento risulta «non letto» col motivo e nessun dato viene inventato.
 */

import { righePdf } from "./pdf";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const TIMEOUT_MS = 20_000;
const BASE = "https://www.dt.mef.gov.it";
const INDICE = `${BASE}/it/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/`;
/** Richieste insieme verso il sito del MEF, come per Borsa Italiana. */
const IN_PARALLELO = 4;

export interface DocumentoMef {
  url: string;
  /** ISO, dal nome del file (l'ultima data che contiene); null se assente. */
  data: string | null;
}

export interface RisultatoMef {
  isin: string;
  /** Base 100: il «Prezzo Fiscale», prezzo di emissione della prima tranche. */
  prezzoFiscale: number;
  /** ISO: la «Data Emissione» del titolo. */
  dataEmissione: string;
  /** ISO, per controllo incrociato con il catalogo. */
  dataScadenza: string | null;
}

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** «01 settembre 2026» → "2026-09-01"; null se non è una data italiana. */
export function dataItaliana(testo: string): string | null {
  const m = testo.trim().toLowerCase().match(/^(\d{1,2})°?\s+([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const mese = MESI.indexOf(m[2]);
  if (mese < 0) return null;
  return `${m[3]}-${String(mese + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Le pagine dei risultati per tipo di titolo, dall'indice del sito. */
export function pagineRisultati(html: string): string[] {
  const percorsi = html.matchAll(
    /href="(\/it\/debito_pubblico\/emissioni_titoli_di_stato_interni\/risultati_aste\/risultati_[a-z0-9_-]+\/(?:index\.html)?)"/g,
  );
  return [...new Set([...percorsi].map((m) => BASE + m[1]))];
}

/**
 * I PDF di risultato di una pagina. Restano fuori i «Comunicato» e i
 * «Dettagli» dei sindacati: sono testo in prosa, senza ISIN né prezzo
 * fiscale; lo stesso titolo ha comunque il suo «Risultati collocamento».
 */
export function documentiDellaPagina(html: string): DocumentoMef[] {
  const documenti: DocumentoMef[] = [];
  for (const m of html.matchAll(/href="([^"]+\.pdf)"/g)) {
    const percorso = m[1];
    const file = decodeURIComponent(percorso.split("/").pop() ?? "");
    if (!/risultati/i.test(file) || /^(comunicato|dettagli)/i.test(file)) continue;
    const date = [...file.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)];
    const ultima = date[date.length - 1];
    documenti.push({
      url: new URL(percorso, BASE).toString(),
      data: ultima ? `${ultima[3]}-${ultima[2]}-${ultima[1]}` : null,
    });
  }
  return documenti;
}

function valore(righe: string[], etichetta: string): string | null {
  for (const r of righe) {
    if (r.toLowerCase().startsWith(etichetta.toLowerCase())) {
      const resto = r.slice(etichetta.length).trim();
      if (resto !== "") return resto;
    }
  }
  return null;
}

/**
 * Parse puro del testo di un risultato d'asta o di collocamento. Torna il
 * motivo invece di un dato parziale: senza ISIN, prezzo fiscale e data di
 * emissione il documento non serve.
 */
export function leggiRisultato(righe: string[]): RisultatoMef | { motivo: string } {
  // Sulle riaperture l'ISIN porta il richiamo a una nota: «IT0005402117(*)».
  const isin = valore(righe, "Codice ISIN")?.match(/^(IT[0-9A-Z]{10})(?![0-9A-Z])/)?.[1];
  if (!isin) return { motivo: "codice ISIN non trovato" };
  const prezzo = valore(righe, "Prezzo Fiscale")?.match(/^(\d{1,3}(?:\.\d{3})*),(\d+)$/);
  const prezzoFiscale = prezzo ? Number(`${prezzo[1].replace(/\./g, "")}.${prezzo[2]}`) : null;
  if (prezzoFiscale == null || prezzoFiscale <= 50 || prezzoFiscale > 150) {
    return { motivo: `prezzo fiscale non riconosciuto (${valore(righe, "Prezzo Fiscale") ?? "assente"})` };
  }
  const dataEmissione = dataItaliana(valore(righe, "Data Emissione") ?? "");
  if (!dataEmissione) return { motivo: "data di emissione non riconosciuta" };
  return {
    isin,
    prezzoFiscale,
    dataEmissione,
    dataScadenza: dataItaliana(valore(righe, "Data Scadenza") ?? ""),
  };
}

async function scarica(url: string): Promise<Response> {
  const risposta = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!risposta.ok) throw new Error(`il MEF ha risposto ${risposta.status} (${url})`);
  return risposta;
}

async function aBlocchi<T, R>(voci: T[], fai: (v: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const esiti: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < voci.length; i += IN_PARALLELO) {
    esiti.push(...(await Promise.allSettled(voci.slice(i, i + IN_PARALLELO).map(fai))));
  }
  return esiti;
}

/**
 * Tutti i documenti di risultato elencati sul sito, dal più recente. Fallisce
 * se l'indice non porta più nessuna pagina: vorrebbe dire che il sito è
 * cambiato, e un elenco vuoto passerebbe per «nessuna asta».
 */
export async function elencaDocumentiMef(): Promise<DocumentoMef[]> {
  const pagine = pagineRisultati(await (await scarica(INDICE)).text());
  if (pagine.length === 0) {
    throw new Error("nessuna pagina di risultati nell'indice del MEF: la struttura del sito è cambiata");
  }
  const perUrl = new Map<string, DocumentoMef>();
  const esiti = await aBlocchi(pagine, async (p) => documentiDellaPagina(await (await scarica(p)).text()));
  for (const e of esiti) {
    if (e.status === "fulfilled") for (const d of e.value) perUrl.set(d.url, d);
  }
  if (perUrl.size === 0) throw new Error("nessun documento di risultato nelle pagine del MEF");
  return [...perUrl.values()].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
}

export type EsitoDocumentoMef =
  | { url: string; tipo: "letto"; risultato: RisultatoMef }
  /** Scaricato ma non interpretabile: va registrato col motivo. */
  | { url: string; tipo: "illeggibile"; motivo: string }
  /** Non scaricato (rete, sito giù): si riprova la volta dopo. */
  | { url: string; tipo: "nonScaricato"; motivo: string };

/** Legge i documenti indicati, distinguendo un PDF illeggibile da uno non arrivato. */
export async function leggiDocumentiMef(documenti: DocumentoMef[]): Promise<EsitoDocumentoMef[]> {
  const esiti = await aBlocchi(documenti, async (d) =>
    Buffer.from(await (await scarica(d.url)).arrayBuffer()),
  );
  return esiti.map((e, i): EsitoDocumentoMef => {
    const url = documenti[i].url;
    if (e.status === "rejected") {
      return { url, tipo: "nonScaricato", motivo: e.reason instanceof Error ? e.reason.message : String(e.reason) };
    }
    const letto = leggiRisultato(righePdf(e.value));
    return "motivo" in letto
      ? { url, tipo: "illeggibile", motivo: letto.motivo }
      : { url, tipo: "letto", risultato: letto };
  });
}
