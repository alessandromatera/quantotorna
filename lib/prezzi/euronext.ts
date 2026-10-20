/**
 * Storico delle sedute di un titolo del MOT da Euronext, proprietaria di
 * Borsa Italiana: per ogni seduta quantità, contratti e controvalore. Serve
 * a dire quanto scambia un titolo DI SOLITO. Il listino di Borsa Italiana i
 * volumi non li pubblica, e la sua pagina per titolo ne dà una seduta sola,
 * troppo rumorosa per decidere: la Romania 2032 (XS2109812508) il 19/10/2026
 * ha scambiato 11 mila euro, ma in tre mesi ha scambiato in 62 sedute su 65
 * con una mediana di 42 mila.
 *
 * È il CSV che il sito offre come download dei dati storici. Verificato il
 * 20/10/2026: la riga del 19/10 del BTP 4,2% Mz34 coincide al centesimo con
 * il listino ufficiale di Borsa Italiana (5.326.000 nominali, 133 contratti,
 * 5.303.018 euro); 470 titoli in 27 secondi, quattro alla volta, nessun
 * rifiuto. Le sedute senza scambi ci sono, a zero. Un ISIN che Euronext non
 * conosce dà l'intestazione senza righe: è un errore, non un titolo fermo.
 *
 * Scraping dichiarato come le altre fonti: se il file cambia forma la
 * lettura lo dice e il titolo resta senza dato, mai con un numero indovinato.
 */

import { aggiungiGiorni } from "../date";
import { sintetizzaScambi, type SintesiScambi } from "../mercato/scambi";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const TIMEOUT_MS = 15_000;

/** Tre mesi di calendario: circa 65 sedute. */
export const GIORNI_STORICO = 91;

/** Richieste insieme: come per i listini di Borsa Italiana. */
const IN_PARALLELO = 4;

/** Attese prima di riprovare su un 429, come per Borsa Italiana. Mai visto, il 20/10/2026. */
const ATTESE_429_MS = [2_000, 5_000, 15_000, 30_000];

/**
 * Se nessuno dei primi venti titoli si legge, il file è cambiato o il sito
 * non risponde: chiederne altri quattrocento non direbbe niente di nuovo.
 */
const FALLIMENTI_PER_ARRENDERSI = 20;

export interface SedutaEuronext {
  /** ISO. */
  data: string;
  /** Nominale scambiato. */
  quantita: number;
  contratti: number;
  /** Euro. */
  controvalore: number;
}

function urlStorico(isin: string, da: string, a: string): string {
  return `https://live.euronext.com/en/ajax/AwlHistoricalPrice/getFullDownloadAjax/${isin}-MOTX?format=csv&decimal_separator=.&date_form=d/m/Y&op=&adjusted=&base100=&startdate=${da}&enddate=${a}`;
}

/**
 * Parse puro del CSV. Le colonne si cercano per nome nell'intestazione, non
 * per posizione: l'ISIN sconosciuto ha già un'intestazione con una colonna in
 * meno (niente «vwap»), segno che l'ordine non è garantito.
 */
export function parseStoricoEuronext(
  csv: string,
  isin: string,
): SedutaEuronext[] | { motivo: string } {
  const linee = csv.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim());
  // Senza questo controllo si leggerebbe lo storico di un altro titolo.
  if (!linee.slice(0, 5).includes(isin)) {
    return { motivo: "il file ricevuto non è quello dell'ISIN richiesto" };
  }
  const intestazione = linee.find((l) => l.startsWith("Date;"));
  const colonne = intestazione?.split(";").map((c) => c.replace(/"/g, ""));
  const indice = (nome: string) => colonne?.indexOf(nome) ?? -1;
  const [data, quantita, contratti, controvalore] = [
    indice("Date"),
    indice("Number of Shares"),
    indice("Number of Trades"),
    indice("Turnover"),
  ];
  if ([data, quantita, contratti, controvalore].some((i) => i < 0)) {
    return { motivo: "intestazione non riconosciuta: la struttura del file di Euronext è cambiata" };
  }

  const sedute: SedutaEuronext[] = [];
  for (const linea of linee) {
    const giorno = linea.match(/^(\d{2})\/(\d{2})\/(\d{4});/);
    if (!giorno) continue;
    const celle = linea.split(";");
    const numero = (i: number) => Number(celle[i] === "" ? 0 : celle[i]);
    const seduta = {
      data: `${giorno[3]}-${giorno[2]}-${giorno[1]}`,
      quantita: numero(quantita),
      contratti: numero(contratti),
      controvalore: numero(controvalore),
    };
    if (![seduta.quantita, seduta.contratti, seduta.controvalore].every(Number.isFinite)) {
      return { motivo: `riga illeggibile (${linea.slice(0, 40)})` };
    }
    sedute.push(seduta);
  }
  if (sedute.length === 0) {
    return { motivo: "nessuna seduta nello storico: titolo non quotato sul MOT secondo Euronext" };
  }
  return sedute;
}

async function chiedi(url: string): Promise<Response> {
  for (let tentativo = 0; ; tentativo++) {
    const risposta = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (risposta.status !== 429 || tentativo >= ATTESE_429_MS.length) return risposta;
    await new Promise((fatto) => setTimeout(fatto, ATTESE_429_MS[tentativo]));
  }
}

/**
 * Le sedute CHIUSE degli ultimi tre mesi: quella di oggi resta fuori anche se
 * il file la portasse, perché a mercato aperto sarebbe una giornata a metà.
 */
export async function storicoScambi(isin: string, oggi: string): Promise<SedutaEuronext[]> {
  const risposta = await chiedi(urlStorico(isin, aggiungiGiorni(oggi, -GIORNI_STORICO), oggi));
  if (!risposta.ok) throw new Error(`Euronext ha risposto ${risposta.status}`);
  const esito = parseStoricoEuronext(await risposta.text(), isin);
  if ("motivo" in esito) throw new Error(esito.motivo);
  const chiuse = esito.filter((s) => s.data < oggi);
  if (chiuse.length === 0) throw new Error("nessuna seduta chiusa nello storico");
  return chiuse;
}

/**
 * Quanto scambia di solito ogni titolo, per tutti gli ISIN. Un titolo che
 * non si legge resta senza dato, col motivo; non ferma gli altri.
 */
export async function scaricaStoricoScambi(
  isin: string[],
  oggi: string,
): Promise<{ letti: Map<string, SintesiScambi>; falliti: { isin: string; motivo: string }[] }> {
  const letti = new Map<string, SintesiScambi>();
  const falliti: { isin: string; motivo: string }[] = [];
  let prossimo = 0;
  async function lavora() {
    while (prossimo < isin.length) {
      if (letti.size === 0 && falliti.length >= FALLIMENTI_PER_ARRENDERSI) return;
      const codice = isin[prossimo++];
      try {
        const sintesi = sintetizzaScambi((await storicoScambi(codice, oggi)).map((s) => s.controvalore));
        if (sintesi) letti.set(codice, sintesi);
      } catch (e) {
        falliti.push({ isin: codice, motivo: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(IN_PARALLELO, isin.length) }, lavora));
  // Quelli mai chiesti perché ci si è arresi: vanno contati, non persi.
  for (const codice of isin.slice(prossimo)) {
    falliti.push({ isin: codice, motivo: "non chiesto: i primi titoli erano tutti illeggibili" });
  }
  return { letti, falliti };
}
