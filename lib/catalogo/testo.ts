import {
  formatDataIT,
  formatEuro,
  formatPct,
  formatPrezzoMot,
} from "../client/format";
import { URL_CODICE, URL_SITO } from "../sito";
import { NOMINALE_RIFERIMENTO, type MetricheCatalogo } from "./metriche";

/**
 * Il sito in testo semplice, per chi lo legge senza browser: i modelli
 * linguistici e i loro motori di ricerca. Due file, scritti alla
 * compilazione insieme alle pagine:
 *
 * - `/llms.txt`, l'indice del sito nel formato proposto su llmstxt.org: cosa
 *   è, come fa i conti in breve, dove sono pagine e dati;
 * - `/rendimenti.md`, i numeri del giorno in tabelle Markdown: gli stessi
 *   della pagina compilata (10.000 nominali, prezzo di chiusura, nessuna
 *   commissione), da citare senza dover eseguire JavaScript.
 *
 * Modulo puro: i numeri vengono dalle metriche, qui si scrivono e basta.
 */

/** Una cella di tabella Markdown: niente barre verticali né a capo dentro. */
function cella(testo: string): string {
  return testo.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

function riga(celle: string[]): string {
  return `| ${celle.map(cella).join(" | ")} |`;
}

function tabella(intestazioni: string[], righe: string[][]): string {
  return [
    riga(intestazioni),
    riga(intestazioni.map(() => "---")),
    ...righe.map(riga),
  ].join("\n");
}

const pctONulla = (v: number | null) => (v == null ? "—" : formatPct(v));

export function rendimentiInMarkdown(m: MetricheCatalogo): string {
  const nominale = NOMINALE_RIFERIMENTO.toLocaleString("it-IT");
  return [
    `# Rendimenti netti dei titoli di Stato sul MOT — ${formatDataIT(m.data)}`,
    "",
    `Fonte: ${URL_SITO}/ (metodologia: ${URL_SITO}/metodologia/). Prezzi di chiusura del MOT ` +
      `di Borsa Italiana del ${formatDataIT(m.data)}, regolamento a due giorni lavorativi. ` +
      `Rendimento netto secondo il fisco italiano: 12,5% su cedole, rateo e disaggio di ` +
      `emissione; plusvalenza a rimborso al 26% sul 48,08%, senza zainetto. Su ${nominale} ` +
      `nominali e senza commissioni. Non è consulenza finanziaria.`,
    "",
    `## Tasso fisso, step-up, strip e BOT (${m.flussiNoti.length} titoli)`,
    "",
    "YTM netto e lordo: rendimento annuo composto tenendo fino a scadenza. «Netto ogni " +
      `${nominale} € spesi»: cedole nette più rimborso netto che si incassano spendendo oggi ` +
      `${nominale} €, rateo e crediti d'imposta compresi; le cedole non si reinvestono.`,
    "",
    tabella(
      ["Titolo", "ISIN", "Scadenza", "Cedola", "Prezzo", "YTM netto", "YTM lordo", `Netto ogni ${nominale} € spesi`],
      m.flussiNoti.map((t) => [
        t.nome,
        t.isin,
        formatDataIT(t.dataScadenza),
        formatPct(t.cedolaAnnua),
        formatPrezzoMot(t.prezzo),
        pctONulla(t.ytmNettoPct),
        pctONulla(t.ytmLordoPct),
        t.nettoSuSpesa ? formatEuro(t.nettoSuSpesa.incassi) : "—",
      ]),
    ),
    "",
    `## Tasso variabile, CCTeu (${m.variabili.length} titoli)`,
    "",
    "Cedola stimata: Euribor 6 mesi più lo spread del titolo. Il rendimento suppone che " +
      "l'Euribor resti dov'è fino alla scadenza: serve a confrontare, non a prevedere.",
    "",
    tabella(
      ["Titolo", "ISIN", "Scadenza", "Spread", "Cedola stimata", "Prezzo", "YTM netto"],
      m.variabili.map((t) => [
        t.nome,
        t.isin,
        formatDataIT(t.dataScadenza),
        t.spread == null ? "—" : formatPct(t.spread, 3),
        t.cedolaStimata == null ? "—" : formatPct(t.cedolaStimata, 3),
        formatPrezzoMot(t.prezzo),
        t.ytmNettoPct == null ? `— (${t.motivoNonCalcolabile ?? "non calcolabile"})` : formatPct(t.ytmNettoPct),
      ]),
    ),
    "",
    `## Indicizzati all'inflazione (${m.indicizzati.length} titoli)`,
    "",
    "Prezzo e cedola reali: il rendimento è reale e lordo. L'inflazione di pareggio è quella " +
      "che fa rendere quanto il titolo a tasso fisso dello stesso emittente di scadenza più vicina.",
    "",
    tabella(
      ["Titolo", "ISIN", "Scadenza", "Prezzo reale", "Rendimento reale lordo", "Inflazione di pareggio"],
      m.indicizzati.map((t) => [
        t.nome,
        t.isin,
        formatDataIT(t.dataScadenza),
        formatPrezzoMot(t.prezzo),
        t.ytmRealeLordoPct == null ? "—" : formatPct(t.ytmRealeLordoPct),
        t.confronto
          ? `${formatPct(t.confronto.pareggioPct)} (contro ${t.confronto.nome})`
          : `— (${t.motivoNonCalcolabile ?? "non calcolabile"})`,
      ]),
    ),
    "",
  ].join("\n");
}

export function llmsTxt(m: MetricheCatalogo): string {
  const quanti = m.flussiNoti.length + m.variabili.length + m.indicizzati.length;
  return [
    "# quantotorna",
    "",
    "> Quanto rende davvero un titolo di Stato quotato sul MOT di Borsa Italiana, tenuto fino " +
      "a scadenza: rendimento netto secondo il fisco italiano e cifra finale in euro. BTP, BOT, " +
      `CCTeu, BTP€i e titoli di Stato esteri e sovranazionali: ${quanti} titoli, prezzi di ` +
      `chiusura del ${formatDataIT(m.data)}, aggiornati ogni giorno feriale.`,
    "",
    "Sito statico in italiano, senza pubblicità, cookie né statistiche di visita, con il codice " +
      "aperto. I conti li fa un motore di funzioni pure con test; ogni semplificazione è " +
      "dichiarata nella metodologia. In breve:",
    "",
    "- imposte: 12,5% su cedole, rateo e disaggio di emissione; plusvalenze e minusvalenze al " +
      "26% sul 48,08% della base (12,5% effettivo), compensabili con lo zainetto;",
    "- rendimento a scadenza (YTM) netto alla data di regolamento, due giorni lavorativi dopo " +
      "il giorno dei prezzi, con lo storno dell'imposta sul rateo pagato;",
    "- la plusvalenza a rimborso si misura dal prezzo teorico (emissione più disaggio maturato), " +
      "non da 100;",
    "- nella pagina chi guarda può scegliere nominale e commissioni, e simulare l'acquisto o la " +
      "vendita prima della scadenza; i dati che scrive restano nel suo browser.",
    "",
    "Non è consulenza finanziaria: i numeri sono forniti così come sono.",
    "",
    "## Pagine",
    "",
    `- [Titoli](${URL_SITO}/): la tabella di tutti i titoli con YTM netto e lordo, plusvalenza a rimborso, netto a scadenza, duration e scambi`,
    `- [Metodologia](${URL_SITO}/metodologia/): come si fanno i conti, le imposte, le semplificazioni, le fonti e le verifiche`,
    "",
    "## Dati",
    "",
    `- [Rendimenti del giorno](${URL_SITO}/rendimenti.md): le tabelle dei titoli in Markdown, con gli stessi numeri della pagina`,
    `- [Catalogo del giorno](${URL_SITO}/dati/catalogo.json): i dati di partenza in JSON (prezzi, cedole, scadenze, dati di emissione), senza numeri calcolati`,
    "",
    "## Optional",
    "",
    `- [Codice sorgente](${URL_CODICE}): AGPL-3.0`,
    "",
  ].join("\n");
}
