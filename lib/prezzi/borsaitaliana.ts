/**
 * Borsa Italiana (MOT), letta una volta al giorno dallo scaricamento. Due
 * usi distinti:
 *
 * - i LISTINI, per il catalogo dei titoli di Stato ad aliquota agevolata
 *   (`scaricaListaBtp`, il grosso di questo file);
 * - la SCHEDA di un singolo ISIN, solo per quello che il listino non dice:
 *   il piano cedolare di uno step-up nuovo e la data di godimento.
 *
 * Questo è scraping HTML, con i limiti dichiarati che comporta: se la
 * struttura della pagina cambia, il parse produce zero righe e
 * l'aggiornamento FALLISCE in modo visibile (mai dati parziali silenziosi).
 * I prezzi sono l'"ultimo" di Borsa Italiana, con il ritardo del sito.
 *
 * Si scaricano QUATTRO listini, che hanno la stessa identica struttura di
 * tabella: `btp`, `cct`, `bot` — titoli italiani — e `euro-obbligazioni`,
 * che è quello dei titoli di Stato ESTERI (Bund, Bonos, Austria, Belgio).
 * Ogni riga viene poi classificata per famiglia di flusso (TIPI_CATALOGO) e,
 * sul listino estero, per emittente: prezzo e cedola di un indicizzato o di
 * un variabile significano un'altra cosa, e l'emittente decide l'aliquota.
 * Quello che il motore non sa calcolare viene SCARTATO col motivo, mai fatto
 * passare per tasso fisso italiano.
 *
 * NON si scarica `obbligazioni-euro` — nome simile, contenuto opposto.
 * Rilevato il 27/07/2026: 69 strumenti, di cui 66 corporate al 26% (banche,
 * utility, agenzie come CDP) e 3 white list, tutte e tre strutturate e
 * comunque fuori dal modello. Il rapporto rischio/beneficio è pessimo:
 * sbagliare significherebbe mostrare un 26% con la matematica del 12,5%.
 */

import type { GradinoCedola } from "../bond/cedole";
import type { TipoCatalogo } from "../categorie";
import {
  frequenzaCedola,
  isIndicizzatoDalNome,
  isValutaEstera,
  motivoNonRiconosciuto,
  riconosciEmittente,
  type Emittente,
} from "../mercato/emittenti";
import type { SchedaStepUp } from "../mercato/stepup";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const TIMEOUT_MS = 15_000;
/**
 * Tetto di pagine per listino. Rilevate il 24/08/2026: 75 pagine sul listino
 * estero (che contiene anche corporate e agenzie, non solo sovrani), 11 sui
 * BTP, una su CCT e BOT. Centoventi lascia margine alla crescita del listino
 * e resta un limite.
 */
const MAX_PAGINE = 120;
/**
 * Pagine chieste insieme. Una dopo l'altra le circa novanta pagine dei quattro
 * listini richiedevano più di un minuto (0,6-0,9 secondi ciascuna, misurato il
 * 19/10/2026); quattro alla volta è quanto apre un browser, e il tempo scende
 * a un quarto. L'ordine di lettura non cambia: le pagine si esaminano in
 * sequenza e quelle chieste oltre l'ultima (il sito risponde 200 senza righe)
 * vengono ignorate.
 */
export const PAGINE_IN_PARALLELO = 4;

function urlListino(sezione: string, pagina: number): string {
  return `https://www.borsaitaliana.it/borsa/obbligazioni/mot/${sezione}/lista.html?&page=${pagina}&lang=it`;
}

/**
 * Attese prima di riprovare quando il sito risponde 429 (troppe richieste).
 * Rilevato il 19/10/2026: un secondo aggiornamento lanciato un minuto dopo il
 * primo veniva respinto alla sedicesima pagina, e un minuto dopo il limite
 * era già passato. Il sito non dice quanto aspettare (niente Retry-After):
 * si rallenta invece di fallire, e solo se dopo l'ultima attesa risponde
 * ancora 429 l'aggiornamento fallisce, dicendolo.
 */
const ATTESE_429_MS = [2_000, 5_000, 15_000, 30_000];

/** `fetch` verso Borsa Italiana, con le attese sul 429. */
async function chiedi(url: string, opzioni: RequestInit = {}): Promise<Response> {
  for (let tentativo = 0; ; tentativo++) {
    const risposta = await fetch(url, {
      ...opzioni,
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (risposta.status !== 429 || tentativo >= ATTESE_429_MS.length) return risposta;
    const indicata = Number(risposta.headers.get("retry-after"));
    const attesa = Number.isFinite(indicata) && indicata > 0 ? indicata * 1000 : ATTESE_429_MS[tentativo];
    await new Promise((fatto) => setTimeout(fatto, Math.min(attesa, 60_000)));
  }
}

async function scaricaPagina(sezione: string, pagina: number): Promise<string> {
  const risposta = await chiedi(urlListino(sezione, pagina));
  if (!risposta.ok) {
    throw new Error(
      `Borsa Italiana ha risposto ${risposta.status} (${sezione}, pagina ${pagina})`,
    );
  }
  return risposta.text();
}

/**
 * I listini scaricati e la famiglia con cui nascono le loro righe. Solo la
 * sezione `btp` è mista — dentro ci sono anche strip, BTP€i e BTP Italia —
 * e va classificata riga per riga dal nome; cct e bot sono omogenee.
 */
const LISTINI: { sezione: string; tipo: TipoCatalogo | "daNome"; estero?: true }[] = [
  { sezione: "btp", tipo: "daNome" },
  { sezione: "cct", tipo: "ccteu" },
  { sezione: "bot", tipo: "bot" },
  // Titoli di Stato esteri: qui l'emittente decide l'aliquota, quindi la
  // riga viene scartata se non lo si riconosce con certezza.
  { sezione: "euro-obbligazioni", tipo: "daNome", estero: true },
];

export interface RigaCatalogo {
  isin: string;
  nome: string;
  /**
   * Percentuale annua. Nominale per i `fisso`, REALE per gli indicizzati,
   * zero per chi non ha cedole. Sui `ccteu` è zero e il dato utile è
   * `spread`: la cedola in corso il listino non la pubblica.
   */
  cedolaAnnua: number;
  /** ISO. */
  dataScadenza: string;
  /** Base 100. Prezzo REALE per gli indicizzati. */
  prezzo: number;
  tipo: TipoCatalogo;
  emittente: Emittente;
  /** Cedole per anno: 2 sui titoli italiani, 1 sui sovrani esteri. */
  frequenzaCedola: number;
  /** Solo `ccteu`: punti sopra l'Euribor 6m, dal nome. */
  spread?: number;
  /**
   * Solo `stepUp`: la cedola del periodo in corso come la scrive il listino
   * (di PERIODO, trimestrale o semestrale secondo il titolo). Serve solo a
   * verificare il piano e non va in catalogo: `cedolaAnnua`, i gradini e la
   * frequenza arrivano dal piano (lib/mercato/stepup.ts).
   */
  cedolaListino?: number | null;
  /** Solo `stepUp`, a piano risolto. */
  gradiniCedola?: GradinoCedola[];
}

export interface EsitoParse {
  righe: RigaCatalogo[];
  /** Righe trovate ma scartate (senza prezzo o campi non riconosciuti). */
  scartate: { isin: string; motivo: string }[];
}

/**
 * La lista mescola formati: "7,25" (virgola decimale) e "3.85" (punto
 * decimale nei nomi tipo "Btp Fx 3.85% Jul34 Eur"). Con la virgola i punti
 * sono migliaia; senza virgola il punto è il decimale — su questi numeri
 * (cedole e prezzi in base 100) le migliaia non esistono.
 */
function numeroFlessibile(testo: string): number | null {
  const pulito = testo.trim();
  if (pulito === "") return null;
  const normalizzato = pulito.includes(",")
    ? pulito.replace(/\./g, "").replace(",", ".")
    : pulito;
  const n = Number(normalizzato);
  return Number.isFinite(n) ? n : null;
}

/**
 * Famiglia del titolo dal nome usato sul MOT. I nomi veri rilevati il
 * 27/07/2026 sono di sei forme:
 *
 *   "Btp-1nv26 7,25%" · "Btp Tf 3,50% Mz30 Eur" · "Btpgreen 4%Ap35eur"  → fisso
 *   "Btpstripital Zc Feb28 Eur" · "Btp Coupon Strip Zc Nv26 Eur"       → zero coupon
 *   "Btpi Tf 1,25% St32 Eur" · "Btpi-15st26 3,1%"                       → BTP€i
 *   "Btp Italia Mz28 Eur"                                              → BTP Italia
 *   "Btp Valore Gn27 Eur" · "Btp Futura Ap37 Eur" · "Btp Piu' Sc Fb33 Eur" → step-up
 *   "Btp Valore Insieme Oc Oct31 Eur"                                  → scartato
 *
 * Il riconoscimento è per PREFISSO e non per sottostringa: il vecchio filtro
 * cercava "btpi" ovunque nel nome e così lasciava passare "Btp Italia" (che
 * non contiene la sequenza) valutandolo come tasso fisso, mentre non
 * riguardava affatto gli strip. Un titolo mai visto prima ricade su `fisso`:
 * è la forma di gran lunga più comune, e le altre hanno tutte un marcatore
 * esplicito nel nome.
 *
 * Si scarta solo ciò che il motore non sa CALCOLARE. Un trattamento fiscale
 * diverso non è un motivo per nascondere un titolo: è un'informazione da
 * mostrare accanto ai suoi numeri.
 */
/**
 * Spread di un CCTeu, dal nome. Si aggancia al `+` e non al `%`, perché il
 * segno di percentuale a volte manca:
 *
 *   "Cct-Eu Tv Eur6m+0,65% Ap29 Eur"  → 0.65
 *   "Cct-Eu Tv Eur6m+1,15 Ot31 Eur"   → 1.15   (senza %)
 *   "Cct-Eu Fr Eur6m+1.05% Apr32 Eur" → 1.05   (punto decimale)
 */
function spreadDalNome(nome: string): number | undefined {
  const trovato = nome.match(/\+\s*([\d,.]+)\s*%?/)?.[1];
  return (trovato ? numeroFlessibile(trovato) : null) ?? undefined;
}

/**
 * Famiglia di flusso sul listino estero: titoli a cedola fissa, zero coupon
 * (marcati "Zc", compresi gli strip francesi) e indicizzati all'inflazione.
 *
 * Gli indicizzati si riconoscono da un ELENCO CHIUSO di nomi
 * (`isIndicizzatoDalNome`) e non dalla regola «finisce per ei», che pure
 * descrive bene Bundei e Obligacionesei: quella regola prende anche «Bei»,
 * la Banca Europea per gli Investimenti, e ne farebbe un indicizzato quotato
 * a prezzo reale. Trentasei titoli letti nel modo sbagliato, con rendimenti
 * plausibili e falsi.
 */
function classificaEsteroDalNome(nome: string): TipoCatalogo {
  if (/\bzc\b/i.test(nome)) return "zeroCoupon";
  if (isIndicizzatoDalNome(nome)) return "indicizzatoEuro";
  return "fisso";
}

function classificaDalNome(nome: string): TipoCatalogo | { scarta: string } {
  if (/strip/i.test(nome)) return "zeroCoupon";
  // Il BTP Valore Insieme (ottobre 2026) non ha gradini: una cedola sola,
  // pagata a scadenza, con base 30E/360. Il motore non lo modella ancora.
  if (/\bvalore\s+insieme\b/i.test(nome)) {
    return {
      scarta:
        "BTP Valore Insieme: una sola cedola pagata a scadenza, struttura che il motore non gestisce ancora",
    };
  }
  // Il BTP Più (2025) è uno step-up come Valore e Futura: sul listino il nome
  // non porta la cedola, e la colonna dà solo il gradino in corso. Letto
  // come tasso fisso usciva con metà cedola (1,425% invece di 2,85% → 3,7%)
  // e un rendimento netto dell'1,97% dove il piano vero dà il 3,66%
  // (verificato il 14/09/2026). Il piano lo dà
  // lib/mercato/stepup.ts.
  if (/\b(valore|futura|piu['’]?)\b/i.test(nome)) return "stepUp";
  if (/\bbtp\s*italia\b/i.test(nome)) return "italia";
  if (/^btp\s*€?i(?![a-z])/i.test(nome)) return "indicizzatoEuro";
  return "fisso";
}

/**
 * Parse puro di una pagina di listino (separato per essere testabile).
 *
 * `tipoListino` è la famiglia con cui nascono le righe: "daNome" per la
 * sezione btp, che è mista, oppure una famiglia fissa per cct e bot, dove
 * l'intero listino è omogeneo e il nome non aggiunge nulla.
 */
export function parseListaBtp(
  html: string,
  tipoListino: TipoCatalogo | "daNome" = "daNome",
  estero = false,
): EsitoParse {
  const righe: RigaCatalogo[] = [];
  const scartate: { isin: string; motivo: string }[] = [];
  const visti = new Set<string>();

  for (const blocco of html.split("<tr")) {
    // Il prefisso ISIN è il paese di emissione: IT sui titoli italiani, ma
    // DE/ES/AT/BE su quelli esteri. Fissarlo a "IT" farebbe leggere zero
    // righe dal listino estero, senza alcun errore visibile.
    const isin = blocco.match(/\/scheda\/([A-Z]{2}[0-9A-Z]{10})-MOTX/)?.[1];
    if (!isin || visti.has(isin) || !blocco.includes("<td")) continue;
    visti.add(isin);

    const celle = [...blocco.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    // Colonne attese: [0] isin+nome+ultimo, [1] nome, [2] ultimo prezzo,
    // [3] cedola semestrale, [4] scadenza gg/mm/aaaa.
    const nome = celle[1];
    const prezzo = celle[2] ? numeroFlessibile(celle[2]) : null;
    const scadenzaIT = celle[4]?.match(/(\d{2})\/(\d{2})\/(\d{4})/);

    if (!nome || !scadenzaIT) {
      scartate.push({ isin, motivo: "colonne non riconosciute" });
      continue;
    }
    // Sul listino estero l'emittente NON si indovina: è lui a decidere se il
    // guadagno è al 12,5% o al 26%, e un nome non riconosciuto va scartato.
    let emittente: Emittente = "IT";
    if (estero) {
      if (isValutaEstera(nome)) {
        scartate.push({
          isin,
          motivo: `non è in euro (${nome}): il rendimento dipenderebbe dal cambio a scadenza`,
        });
        continue;
      }
      // Nome E prefisso ISIN devono concordare: un corporate che porta il
      // nome del suo Stato emette comunque sotto un codice suo, e senza il
      // secondo controllo si prenderebbe l'aliquota agevolata.
      const riconosciuto = riconosciEmittente(nome, isin);
      if (!riconosciuto) {
        // Alcuni emittenti sono noti e lasciati fuori APPOSTA (KfW, EFSF):
        // dirlo con il loro motivo evita di rispondere «non riconosciuto» a
        // chi vede il titolo sul MOT e si chiede perché in catalogo non c'è.
        scartate.push({ isin, motivo: motivoNonRiconosciuto(nome, isin) });
        continue;
      }
      emittente = riconosciuto;
    }

    const tipo = estero
      ? classificaEsteroDalNome(nome)
      : tipoListino === "daNome"
        ? classificaDalNome(nome)
        : tipoListino;
    if (typeof tipo !== "string") {
      scartate.push({ isin, motivo: `${tipo.scarta} (${nome})` });
      continue;
    }
    if (prezzo == null || prezzo <= 0) {
      scartate.push({ isin, motivo: "prezzo assente (non scambiato)" });
      continue;
    }
    // Cedola annua dal nome ("Btp-1nv26 7,25%" → 7,25); in mancanza,
    // dalla colonna della cedola semestrale × 2 — è il caso dei BTP Italia,
    // il cui nome porta solo la scadenza e la cui cedola è quella REALE.
    // Su strip, BOT e CCTeu entrambe non valgono: i primi due cedole non ne
    // hanno, e il numero nel nome di un CCTeu è lo SPREAD, non una cedola —
    // prenderlo per tale darebbe un rendimento inventato.
    if (tipo === "stepUp") {
      // La colonna è la cedola del periodo in corso, trimestrale o
      // semestrale secondo il titolo: non si sa ancora quale, e non dice
      // nulla dei gradini futuri. Resta da parte per verificare il piano.
      righe.push({
        isin,
        nome,
        cedolaAnnua: 0,
        dataScadenza: `${scadenzaIT[3]}-${scadenzaIT[2]}-${scadenzaIT[1]}`,
        prezzo,
        tipo,
        emittente,
        frequenzaCedola: frequenzaCedola(emittente),
        cedolaListino: celle[3] ? numeroFlessibile(celle[3]) : null,
      });
      continue;
    }
    const senzaCedola = tipo === "zeroCoupon" || tipo === "bot" || tipo === "ccteu";
    const dalNome = nome.match(/([\d,.]+)\s*%/)?.[1];
    // La colonna cedola segue la convenzione dell'emittente: di PERIODO sui
    // titoli italiani (semestrale, da raddoppiare) e già ANNUA su quelli
    // esteri, che pagano una volta l'anno. Applicare il × 2 anche lì
    // raddoppierebbe in silenzio ogni rendimento.
    const perAnno = estero ? 1 : 2;
    const cedolaAnnua = senzaCedola
      ? 0
      : ((dalNome ? numeroFlessibile(dalNome) : null) ??
        (celle[3] ? (numeroFlessibile(celle[3]) ?? 0) * perAnno : null));
    if (cedolaAnnua == null || cedolaAnnua > 20) {
      scartate.push({ isin, motivo: `cedola non riconosciuta (${dalNome ?? celle[3]})` });
      continue;
    }

    righe.push({
      isin,
      nome,
      cedolaAnnua,
      dataScadenza: `${scadenzaIT[3]}-${scadenzaIT[2]}-${scadenzaIT[1]}`,
      prezzo,
      tipo,
      emittente,
      frequenzaCedola: frequenzaCedola(emittente),
      ...(tipo === "ccteu" ? { spread: spreadDalNome(nome) } : {}),
    });
  }

  return { righe, scartate };
}

/**
 * Scarica tutte le pagine di UN listino, fino a quella vuota.
 *
 * La condizione di arresto è «questa pagina non ha portato NESSUN ISIN mai
 * visto», e non «non ha portato righe buone»: sono due cose diverse e la
 * seconda si è rivelata un errore costoso. Rilevato il 24/08/2026 sul listino
 * `euro-obbligazioni`: la pagina 8 è fatta interamente di titoli senza prezzo
 * e di KfW, quindi non produce nemmeno una riga accettata; fermandosi lì si
 * perdevano le pagine 9-12, cioè TUTTA la Spagna (46 titoli) e i
 * sovranazionali, senza il minimo segnale — il catalogo diceva semplicemente
 * che la Spagna non è quotata sul MOT.
 *
 * Restano due protezioni contro un sito che risponda sempre la stessa cosa:
 * il tetto di pagine e il controllo sugli ISIN già visti, che comprende
 * anche quelli scartati.
 */
async function scaricaListino(
  sezione: string,
  tipo: TipoCatalogo | "daNome",
  estero = false,
): Promise<EsitoParse & { pagine: number }> {
  const tutte = new Map<string, RigaCatalogo>();
  const scartate: { isin: string; motivo: string }[] = [];
  /** Ogni ISIN incontrato, accettato o scartato: serve a riconoscere una pagina ripetuta. */
  const visti = new Set<string>();
  let pagine = 0;
  let finito = false;

  for (let inizio = 1; inizio <= MAX_PAGINE && !finito; inizio += PAGINE_IN_PARALLELO) {
    const numeri = Array.from(
      { length: Math.min(PAGINE_IN_PARALLELO, MAX_PAGINE - inizio + 1) },
      (_, i) => inizio + i,
    );
    const testi = await Promise.all(numeri.map((n) => scaricaPagina(sezione, n)));
    for (const [i, html] of testi.entries()) {
      const esito = parseListaBtp(html, tipo, estero);
      pagine = numeri[i];
      const primaDi = visti.size;
      for (const r of esito.righe) {
        tutte.set(r.isin, r);
        visti.add(r.isin);
      }
      for (const s of esito.scartate) {
        scartate.push(s);
        visti.add(s.isin);
      }
      // Nessun ISIN mai visto in questa pagina → siamo oltre l'ultima pagina,
      // oppure il sito sta ripetendo la stessa. In entrambi i casi si smette,
      // e le pagine successive dello stesso blocco non si leggono.
      if (visti.size === primaDi) {
        finito = true;
        break;
      }
    }
  }

  if (tutte.size === 0) {
    throw new Error(
      `Nessun titolo riconosciuto nel listino ${sezione}: probabilmente la struttura della pagina di Borsa Italiana è cambiata`,
    );
  }
  return { righe: [...tutte.values()], scartate, pagine };
}

/**
 * Scarica tutti i listini. Se anche uno solo smette di essere leggibile
 * l'intero aggiornamento fallisce e il catalogo resta com'era: un catalogo a
 * metà, dove mancano i BOT ma non si capisce perché, sarebbe peggio di uno
 * vecchio ma coerente.
 */
export async function scaricaListaBtp(): Promise<
  EsitoParse & { pagine: number }
> {
  const righe: RigaCatalogo[] = [];
  const scartate: { isin: string; motivo: string }[] = [];
  let pagine = 0;

  for (const { sezione, tipo, estero } of LISTINI) {
    const esito = await scaricaListino(sezione, tipo, estero);
    righe.push(...esito.righe);
    scartate.push(...esito.scartate);
    pagine += esito.pagine;
  }
  return { righe, scartate, pagine };
}

/* --------------------------------------------------------------------------
 * Scheda del singolo titolo: piano di uno step-up e data di godimento.
 * ----------------------------------------------------------------------- */

/**
 * Sezione neutra per la scheda: il percorso non filtra nulla (verificato il
 * 28/07/2026 su BTP, CCTeu, BOT, corporate e sovrani esteri, tutti
 * raggiungibili da qui), quindi non serve sapere in anticipo in quale
 * listino sta il titolo.
 */
function urlScheda(isin: string): string {
  return `https://www.borsaitaliana.it/borsa/obbligazioni/mot/obbligazioni-in-euro/scheda/${isin}-MOTX.html?lang=it`;
}

function testoPulito(grezzo: string): string {
  return grezzo
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Valore della riga con questa etichetta nelle tabelle della scheda, dove
 * l'etichetta sta in un `<strong>` e il valore nella cella accanto
 * (`<span class="t-text -right">`).
 */
function valoreEtichettato(html: string, etichetta: string): string | null {
  const inizio = html.indexOf(`<strong>${etichetta}</strong>`);
  if (inizio < 0) return null;
  const cella = html
    .slice(inizio, inizio + 500)
    .match(/-right"[^>]*>([\s\S]*?)<\/span>/)?.[1];
  const pulito = cella ? testoPulito(cella) : "";
  return pulito === "" ? null : pulito;
}

/** "27/07/26" o "27/07/2026" → ISO. Le date della scheda sono sempre passate. */
function dataITinISO(testo: string | null): string | null {
  const parti = testo?.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!parti) return null;
  const anno = parti[3].length === 2 ? `20${parti[3]}` : parti[3];
  return `${anno}-${parti[2]}-${parti[1]}`;
}

/**
 * Data di godimento dalla scheda: il giorno da cui maturano interessi e
 * disaggio di emissione. Serve quando di un titolo si conosce il prezzo di
 * emissione ma non la data.
 */
export function parseDataGodimento(html: string): string | null {
  return dataITinISO(valoreEtichettato(html, "Data Godimento"));
}

/**
 * Quello che la scheda dice di uno step-up: godimento, periodicità e il
 * testo «Descrizione Payout», da cui lib/mercato/stepup.ts ricava i gradini.
 * Il testo sta in uno `<span class="t-text">` senza `-right`, quindi non si
 * legge con `valoreEtichettato`: lì si prenderebbe la cella successiva.
 */
export function parseSchedaStepUp(html: string): SchedaStepUp {
  const inizio = html.indexOf("<strong>Descrizione Payout</strong>");
  const cella =
    inizio < 0
      ? null
      : html
          .slice(inizio)
          .match(/<\/td>\s*<td[^>]*>\s*<span class="t-text">([\s\S]*?)<\/span>/)?.[1];
  const descrizione = cella ? testoPulito(cella) : "";
  return {
    godimento: parseDataGodimento(html),
    periodicita: valoreEtichettato(html, "Periodicit&agrave; cedola"),
    descrizione: descrizione === "" ? null : descrizione,
  };
}

export async function schedaStepUpMot(isin: string): Promise<SchedaStepUp> {
  const risposta = await chiedi(urlScheda(isin), { redirect: "manual" });
  if (risposta.status !== 200) {
    throw new Error(`Borsa Italiana ha risposto ${risposta.status}`);
  }
  const html = await risposta.text();
  if (!html.includes(isin)) {
    throw new Error("la scheda ricevuta non è quella dell'ISIN richiesto");
  }
  return parseSchedaStepUp(html);
}

export async function dataGodimentoMot(isin: string): Promise<string> {
  const risposta = await chiedi(urlScheda(isin), { redirect: "manual" });
  if (risposta.status !== 200) {
    throw new Error(`Borsa Italiana ha risposto ${risposta.status}`);
  }
  const html = await risposta.text();
  if (!html.includes(isin)) {
    throw new Error("la scheda ricevuta non è quella dell'ISIN richiesto");
  }
  const data = parseDataGodimento(html);
  if (!data) throw new Error("data di godimento assente sulla scheda");
  return data;
}
