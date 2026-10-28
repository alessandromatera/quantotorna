/**
 * Chi ha emesso il titolo — e quindi quale aliquota si applica.
 *
 * Sul listino dei titoli di Stato esteri l'emittente NON è un'etichetta: è il
 * dato da cui dipende se il guadagno è tassato al 12,5% o al 26%. Per questo
 * il riconoscimento funziona al contrario di quello domestico: sulla lista
 * dei BTP un nome mai visto è ragionevolmente un BTP, qui un nome mai visto
 * viene SCARTATO. Meglio un titolo in meno che un 26% mostrato col 12,5%.
 *
 * Al 12,5% ci sono gli Stati della «white list» (D.M. 4/9/1996 e successive
 * modifiche, richiamato dall'art. 11 c.4 lett. c del D.Lgs. 239/1996) e gli
 * organismi internazionali costituiti in base ad accordi resi esecutivi in
 * Italia (BEI, Banca Mondiale, MES, Unione Europea). NON ci sono le agenzie
 * nazionali, per quanto pubbliche e garantite: KfW è tedesca ma è
 * un'agenzia, non la Germania, e i suoi titoli vanno al 26%. È esattamente
 * il tipo di distinzione che un riconoscimento «per assonanza» sbaglierebbe.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CENSIMENTO DEL LISTINO, 24/08/2026
 *
 * Il listino `euro-obbligazioni` ha 75 pagine e 1.483 titoli: NON è solo
 * roba sovrana, dentro ci sono anche i corporate (Goldman Sachs, Intesa,
 * Enel, Snam…) e le agenzie nazionali (KfW, Rentenbank). È il motivo per cui
 * qui si riconosce per elenco chiuso e si scarta tutto il resto.
 *
 * Sovrani in EURO effettivamente quotati, con quanti titoli:
 *   Germania 78 (Bund, Bobl, Schatz, Bundei) · Francia 72 (Oat, Oatei, Oati,
 *   strip) · Spagna 63 · Romania 40 · Belgio 37 · Grecia 35 · Austria 35 ·
 *   Finlandia 28 · Paesi Bassi 24 · Portogallo 23 · Polonia 21 · Lituania 19
 *   · Irlanda 18 · Bulgaria 16 · Ungheria 16 · Lettonia 15 · Slovenia 7 ·
 *   Cipro 4 · Croazia 3 · Estonia 3.
 * Sovranazionali: BEI 72 · Unione Europea 66 · MES 22 · Banca Mondiale 13.
 *
 * Molti sovrani emettono in euro sotto ISIN **XS** e non sotto il codice del
 * proprio paese (Romania, Polonia, Lituania, Bulgaria, Ungheria, Lettonia,
 * Cipro, Croazia, Estonia): è il motivo per cui il controllo sull'ISIN
 * accetta il codice del paese, XS ed EU. Un controllo fissato sul solo
 * codice nazionale avrebbe scartato in silenzio 130 titoli veri.
 *
 * Gli Stati elencati qui sotto ma NON presenti sul listino ci sono lo stesso:
 * il giorno in cui ne compare uno la riga non viene scartata, e un titolo
 * comprato altrove può stare in anagrafica con il suo emittente vero.
 * L'insieme è dichiarato: i 27 dell'Unione, i tre dello Spazio economico
 * europeo, Regno Unito e Svizzera — Stati la cui appartenenza alla white
 * list non è mai stata in discussione. RESTANO FUORI Turchia, Serbia,
 * Albania, Ucraina e Russia: la loro posizione è cambiata nel tempo e
 * andrebbe verificata prima di usarla, e qui un errore significa mostrare un
 * 26% con la matematica del 12,5%.
 *
 * Modulo puro, senza dipendenze dalla UI.
 */

export const EMITTENTI = [
  "IT",
  "AT",
  "BE",
  "BG",
  "CY",
  "HR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IS",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NO",
  "NL",
  "PL",
  "PT",
  "GB",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
  "HU",
  "UE",
  "MES",
  "sovra",
] as const;
export type Emittente = (typeof EMITTENTI)[number];

export interface DescrizioneEmittente {
  /** Nome esteso, per le note. */
  nome: string;
  /** Etichetta breve, per badge e filtri. */
  breve: string;
  /**
   * Rating S&P dell'emittente, o null se non rilevato. Vedi RATING_RILEVATI:
   * è un dato inserito a mano e datato, non scaricato.
   */
  rating: string | null;
  /** Quando quel rating è stato letto e scritto qui dentro (ISO). */
  ratingRilevato: string | null;
  /**
   * Perché un emittente quotato sul MOT non ha il rating S&P: la pagina
   * scrive «rating n.d.», e qui sta il motivo.
   */
  senzaRating?: string;
  /**
   * Cedole per anno sui titoli in EURO di questo emittente. L'Italia paga
   * semestrale sui titoli domestici, tutti i sovrani dell'area euro pagano
   * ANNUALE — e i listini riflettono la convenzione, pubblicando la cedola
   * già annua. Sbagliare questo numero sposta lo YTM in modo silenzioso,
   * quindi sta scritto per ciascuno invece di essere dedotto da un `if`.
   */
  frequenzaCedola: number;
  /**
   * Prefissi ISIN ammessi, SECONDA chiave del riconoscimento. Oltre al codice
   * del paese ci sono XS ed EU, sotto cui molti sovrani emettono in euro.
   * Vuoto = non si controlla, ed è il caso dei sovranazionali, che emettono
   * sotto codici di mezzo mondo (la BEI ha titoli XS, EU, DE e US).
   */
  isin: string[];
  /**
   * Come il listino nomina i titoli di questo emittente: il primo token, o i
   * primi due quando il nome ne richiede due ("European Union", "World
   * Bank"). Per gli Stati presenti sul MOT sono nomi RILEVATI il 24/08/2026;
   * per gli altri sono le denominazioni ufficiali del programma di emissione.
   */
  marcatori: string[];
  /** Ne sono state viste righe sul listino il 24/08/2026. */
  suMot: boolean;
  /**
   * true per gli organismi internazionali: stessa aliquota agevolata degli
   * Stati, ma NON sono Stati — e la categoria in cui finiscono in anagrafica
   * è `sovranazionale`, non `titoloStatoEstero`.
   */
  sovranazionale?: true;
}

/**
 * DATA in cui i rating sono stati riletti tutti insieme l'ultima volta, e
 * data mostrata nella UI.
 *
 * NON è un dato scaricato: il MOT non lo pubblica e nessuna fonte ufficiale
 * si lascia leggere da un programma — le agenzie mostrano i rating dopo la
 * registrazione e ne vietano lo scaricamento automatico, la piattaforma
 * europea dell'ESMA li ha tutti ma la ricerca chiede un CAPTCHA. Quindi è
 * una costante del codice. Il rating è dell'EMITTENTE e non del singolo
 * titolo — tutti i BTP hanno il rating dell'Italia — perciò i valori da
 * tenere aggiornati sono pochi.
 *
 * Limite dichiarato, ed è il motivo per cui la data è esposta: un
 * declassamento non si aggiorna da solo. Quando S&P pubblica una revisione
 * il giro lo segnala all'autore (lib/mercato/revisioni-rating.ts): il valore
 * va riletto e corretto qui, con la sua data in `ratingRilevato`, che è per
 * emittente. Si mostra la sola scala S&P per non dare l'impressione di un
 * consenso fra agenzie che non c'è.
 *
 * Riletti il 28/10/2026 sui comunicati dei Tesori e delle agenzie del debito
 * e sulla stampa, perché S&P mostra i suoi solo dopo la registrazione: dei
 * ventiquattro valori inseriti il 27/07 e il 24/08/2026 ne erano cambiati
 * dodici, alcuni da anni. La Francia era AA-, ed è A+ dal 17/10/2025; la
 * Croazia BBB+, A- dal 2024 e A dal 13/03/2026; l'Estonia il rating S&P non
 * ce l'ha più.
 */
export const RATING_RILEVATI = "2026-10-28";
export const RATING_FONTE = "S&P, scala del debito sovrano a lungo termine";

/** ISIN sotto cui i sovrani emettono in euro oltre al proprio codice paese. */
const ISIN_INTERNAZIONALI = ["XS", "EU"];

function stato(
  nome: string,
  breve: string,
  paese: string,
  marcatori: string[],
  extra: Partial<DescrizioneEmittente> = {},
): DescrizioneEmittente {
  return {
    nome,
    breve,
    rating: null,
    ratingRilevato: null,
    frequenzaCedola: 1,
    isin: [paese, ...ISIN_INTERNAZIONALI],
    marcatori,
    suMot: false,
    ...extra,
  };
}

/** Scorciatoia per uno Stato che il listino quota davvero, con il suo rating. */
function quotato(
  nome: string,
  breve: string,
  paese: string,
  marcatori: string[],
  rating: string,
  ratingRilevato = RATING_RILEVATI,
): DescrizioneEmittente {
  return stato(nome, breve, paese, marcatori, {
    rating,
    ratingRilevato,
    suMot: true,
  });
}

export const DESCRIZIONI: Record<Emittente, DescrizioneEmittente> = {
  // ── Area euro, presenti sul listino ────────────────────────────────────
  IT: {
    ...quotato(
      "Repubblica Italiana",
      "Italia",
      "IT",
      // Solo i nomi dei titoli DOMESTICI: le eurobbligazioni "Italy" con ISIN
      // XS restano fuori di proposito, vedi NON_TRATTATI.
      ["btp", "bot", "cct", "ctz"],
      "BBB+",
    ),
    // UNICO emittente a cedola semestrale, e non è un dettaglio: il listino
    // pubblica la cedola di PERIODO sui titoli italiani e già annua su
    // quelli esteri. Un 1 qui dentro dimezzerebbe in silenzio ogni cedola
    // dei BTP e con essa ogni rendimento.
    frequenzaCedola: 2,
  },
  DE: quotato(
    "Repubblica Federale di Germania",
    "Germania",
    "DE",
    ["bund", "bobl", "schatz", "bundei"],
    "AAA",
  ),
  ES: quotato(
    "Regno di Spagna",
    "Spagna",
    "ES",
    ["obligaciones", "obligacionesei", "bonos", "bonosei"],
    "A+",
  ),
  AT: quotato(
    "Repubblica d'Austria",
    "Austria",
    "AT",
    ["austria", "republautric"],
    "AA+",
  ),
  BE: quotato(
    "Regno del Belgio",
    "Belgio",
    "BE",
    ["belgium", "olo"],
    "AA-",
  ),
  FR: quotato(
    "Repubblica Francese",
    "Francia",
    "FR",
    // "Oati" e "Oatei" sono i due indicizzati; "oatstrip…" i titoli separati.
    ["oat", "oatei", "oati", "oatstrip", "oatstripfran", "btan", "france"],
    "A+",
  ),
  NL: quotato(
    "Regno dei Paesi Bassi",
    "Paesi Bassi",
    "NL",
    ["netherlands", "nederland", "dsl"],
    "AAA",
  ),
  FI: quotato("Repubblica di Finlandia", "Finlandia", "FI", ["finland", "rfgb"], "AA+"),
  IE: quotato("Irlanda", "Irlanda", "IE", ["ireland", "irish"], "AA+"),
  PT: quotato("Repubblica Portoghese", "Portogallo", "PT", ["portugal", "ot"], "A+"),
  GR: quotato(
    "Repubblica Ellenica",
    "Grecia",
    "GR",
    ["ggb", "greece", "hellenic"],
    "BBB",
  ),
  SI: quotato(
    "Repubblica di Slovenia",
    "Slovenia",
    "SI",
    ["slovenia", "slovenija"],
    "AA",
  ),
  CY: quotato("Repubblica di Cipro", "Cipro", "CY", ["cyprus"], "A"),
  HR: quotato("Repubblica di Croazia", "Croazia", "HR", ["croatia"], "A"),
  EE: stato("Repubblica di Estonia", "Estonia", "EE", ["estonia"], {
    suMot: true,
    senzaRating:
      "S&P non valuta più l'Estonia: il rating è stato ritirato fra il 2024 e il 2025, su richiesta dello Stato.",
  }),
  LT: quotato("Repubblica di Lituania", "Lituania", "LT", ["lithuania"], "A"),
  LV: quotato("Repubblica di Lettonia", "Lettonia", "LV", ["latvia"], "A"),

  // ── Fuori dall'euro ma sul listino con emissioni in euro ───────────────
  RO: quotato("Romania", "Romania", "RO", ["romania"], "BBB-"),
  PL: quotato("Repubblica di Polonia", "Polonia", "PL", ["poland", "polska"], "A-"),
  HU: quotato("Ungheria", "Ungheria", "HU", ["hungary"], "BBB-"),
  BG: quotato("Repubblica di Bulgaria", "Bulgaria", "BG", ["bulgaria"], "BBB+"),

  // ── White list europea, oggi non quotata sul MOT ───────────────────────
  CZ: stato("Repubblica Ceca", "Rep. Ceca", "CZ", ["czech"]),
  DK: stato("Regno di Danimarca", "Danimarca", "DK", ["denmark"]),
  IS: stato("Repubblica d'Islanda", "Islanda", "IS", ["iceland"]),
  LI: stato("Principato del Liechtenstein", "Liechtenstein", "LI", ["liechtenstein"]),
  LU: stato("Granducato di Lussemburgo", "Lussemburgo", "LU", ["luxembourg"]),
  MT: stato("Repubblica di Malta", "Malta", "MT", ["malta"]),
  NO: stato("Regno di Norvegia", "Norvegia", "NO", ["norway"]),
  GB: stato("Regno Unito", "Regno Unito", "GB", ["gilt", "ukt"]),
  SK: stato("Repubblica Slovacca", "Slovacchia", "SK", ["slovakia", "slovak"]),
  SE: stato("Regno di Svezia", "Svezia", "SE", ["sweden"]),
  CH: stato("Confederazione Svizzera", "Svizzera", "CH", ["switzerland"]),

  // ── Organismi internazionali ───────────────────────────────────────────
  UE: {
    nome: "Unione Europea (SURE, NextGenerationEU)",
    breve: "Unione Eur.",
    rating: "AA+",
    ratingRilevato: RATING_RILEVATI,
    frequenzaCedola: 1,
    isin: [],
    marcatori: ["eu", "european union"],
    suMot: true,
    sovranazionale: true,
  },
  MES: {
    nome: "Meccanismo Europeo di Stabilità (ESM)",
    breve: "MES",
    rating: "AAA",
    ratingRilevato: RATING_RILEVATI,
    frequenzaCedola: 1,
    isin: [],
    marcatori: ["esm"],
    suMot: true,
    sovranazionale: true,
  },
  sovra: {
    nome: "Organismo sovranazionale (BEI, Banca Mondiale, BERS, CEB…)",
    breve: "Sovranaz.",
    rating: "AAA",
    ratingRilevato: RATING_RILEVATI,
    frequenzaCedola: 1,
    isin: [],
    marcatori: [
      "eib",
      "bei",
      "birs",
      "world bank",
      "world",
      "iadb",
      "ebrd",
      "ifc",
      "coe",
      "adb",
      "afdb",
      "aiib",
    ],
    suMot: true,
    sovranazionale: true,
  },
};

/**
 * Emittenti che il listino contiene ma che NON si trattano, con il motivo.
 * Non è una lista di esclusione tecnica: è quello che si risponde a chi
 * chiede perché un titolo che sul MOT c'è, in catalogo non c'è.
 */
export const NON_TRATTATI: Record<string, string> = {
  kfw: "è un'agenzia nazionale tedesca, non la Germania: pubblica e garantita, ma i suoi titoli sono tassati al 26%",
  rentenbank:
    "è un'agenzia nazionale tedesca, non la Germania: i suoi titoli sono tassati al 26%",
  cdp: "è un'agenzia nazionale italiana, non lo Stato: i suoi titoli sono tassati al 26%",
  /**
   * Il caso davvero ambiguo del listino, e sono 43 titoli. L'EFSF è una
   * società di diritto lussemburghese partecipata dagli Stati dell'area euro,
   * non un organismo internazionale costituito da un trattato: sulla lettera
   * della norma non rientra fra gli emittenti agevolati, nella prassi molti
   * intermediari lo trattano al 12,5%. Finché la cosa non è verificata resta
   * fuori — nel dubbio si perde un titolo, non si mostra mezza imposta.
   */
  efsf: "è l'EFSF, società lussemburghese partecipata dagli Stati dell'area euro: il trattamento fiscale non è univoco (12,5% o 26% a seconda della lettura) e finché non è verificato resta fuori",
  /**
   * Eurobbligazioni della Repubblica Italiana (ISIN XS). Stessa aliquota dei
   * BTP, ma la cedola non è semestrale come sul mercato domestico, e il
   * motore la frequenza la deduce dall'emittente: mostrarle darebbe uno YTM
   * sbagliato in silenzio, che è peggio che non mostrarle.
   */
  italy:
    "è un'eurobbligazione della Repubblica Italiana: l'aliquota è quella dei BTP, ma la cedola non segue la cadenza semestrale del mercato domestico e il motore dedurrebbe la frequenza sbagliata",
};

/**
 * Scala S&P dal migliore al peggiore. Arriva fino alla speculativa perché la
 * white list non è una lista di paesi solidi: è una lista di paesi che
 * scambiano informazioni fiscali con l'Italia, e le due cose non coincidono.
 */
const SCALA = [
  "AAA",
  "AA+",
  "AA",
  "AA-",
  "A+",
  "A",
  "A-",
  "BBB+",
  "BBB",
  "BBB-",
  "BB+",
  "BB",
  "BB-",
  "B+",
  "B",
  "B-",
];

/**
 * Gradini di distanza fra due emittenti sulla scala S&P: positivo se `a` è
 * più solido di `b`. Null se anche un solo rating manca o non è sulla scala.
 */
export function distanzaRating(a: Emittente, b: Emittente): number | null {
  const ra = DESCRIZIONI[a].rating;
  const rb = DESCRIZIONI[b].rating;
  if (ra == null || rb == null) return null;
  const ia = SCALA.indexOf(ra);
  const ib = SCALA.indexOf(rb);
  return ia < 0 || ib < 0 ? null : ib - ia;
}

/** Gli emittenti di cui si conosce il rating, dal più solido al meno solido. */
export function emittentiConRating(): Emittente[] {
  return EMITTENTI.filter((e) => DESCRIZIONI[e].rating != null).sort(
    (a, b) => distanzaRating(b, a) ?? 0,
  );
}

/**
 * I nomi con cui i Tesori chiamano i titoli INDICIZZATI all'inflazione.
 * Elenco chiuso, e non la regola «finisce per ei» che sembrerebbe naturale:
 * quella regola prende anche «Bei», cioè la Banca Europea per gli
 * Investimenti, e ne farebbe un indicizzato — con il prezzo letto come reale
 * e un rendimento «reale» che non esiste. Rilevato il 24/08/2026: sono 36
 * titoli BEI in catalogo.
 */
const MARCATORI_INDICIZZATI = new Set([
  "bundei",
  "obligacionesei",
  "bonosei",
  "oatei",
  "oati",
  "btpi",
]);

/** true se il nome è quello di un titolo indicizzato all'inflazione. */
export function isIndicizzatoDalNome(nome: string): boolean {
  const primo = nome.trim().split(/[\s-]+/)[0]?.toLowerCase() ?? "";
  return MARCATORI_INDICIZZATI.has(primo);
}

/** true se l'emittente è un organismo internazionale e non uno Stato. */
export function isSovranazionale(emittente: Emittente): boolean {
  return DESCRIZIONI[emittente].sovranazionale === true;
}

/** Marcatore → emittente, costruito una volta sola dalla tabella. */
const PER_MARCATORE = new Map<string, Emittente>();
for (const e of EMITTENTI) {
  for (const m of DESCRIZIONI[e].marcatori) {
    if (!PER_MARCATORE.has(m)) PER_MARCATORE.set(m, e);
  }
}

/**
 * Cosa può venire SUBITO DOPO il nome dell'emittente in un titolo di Stato:
 * il tipo di flusso (Tf/Fx tasso fisso, Tv/Fr variabile, Zc zero coupon),
 * un'etichetta di programma (Green, Sustainable…), la cedola in percentuale
 * o direttamente la scadenza ("Mz37", "Gen31", "Oct32").
 *
 * È la seconda metà del riconoscimento, e serve contro una trappola che né
 * il nome né l'ISIN intercettano: sul listino il primo token di «Portugal
 * Telecom Tf 5% …» è identico a quello di un titolo di Stato portoghese, e
 * l'ISIN non aiuta perché sono entrambi PT. Il tipo di flusso invece c'è
 * sempre sui sovrani e non è mai al secondo posto di una ragione sociale.
 */
/**
 * Il tipo di flusso a volte è ATTACCATO alla cedola ("Tf2,625%", "Fx2.95%"):
 * il listino non è coerente nemmeno su questo, e un'alternativa che pretenda
 * lo spazio scarta titoli veri dell'Unione Europea.
 */
const SEGUITO_DA =
  /^(?:(?:tf|fx|tv|fr|zc)[\d.,]*%?|[\d.,]+%?|[a-z]{2,4}\d{2,4})$/i;

/**
 * Parole di PROGRAMMA che i Tesori infilano fra il proprio nome e il tipo di
 * flusso. Sono un vocabolario chiuso, preso dai nomi veri del listino il
 * 24/08/2026, e si possono saltare:
 *
 *   "Eu Sure Bond Tf 0% Ot30 Eur"          → sure, bond
 *   "Eu Next Gen Green Bond Tf 0,4% Fb37"  → next, gen, green, bond
 *   "World Bank Sustain Fx 2.9% Feb34 Eur" → sustain
 *   "Bobl Green Fx 2.1% Apr29 Eur"         → green
 *
 * Restano fuori le parole che fanno di un nome una ragione sociale
 * ("Telecom", "Holding", "Finance"): è quello il confine che impedisce a
 * «Portugal Telecom» di prendersi l'aliquota del Portogallo.
 */
const ETICHETTE_PROGRAMMA = new Set([
  "green",
  "social",
  "sustainable",
  "sustainability",
  "sustain",
  "sust",
  "sure",
  "next",
  "gen",
  "nextgen",
  "ngeu",
  "bond",
  "bonds",
  "blue",
  "sdg",
  "esg",
  "climate",
  "recovery",
  "union",
  "bank",
  // Programmi dell'Unione Europea: assistenza macrofinanziaria (anche
  // all'Ucraina) e SAFE.
  "mfa",
  "ukr",
  "fa",
  "safe",
]);

/** Quante etichette di programma si accettano prima del tipo di flusso. */
const MAX_ETICHETTE = 5;

/**
 * Emittente dal nome del listino estero, o null se non riconosciuto — e in
 * quel caso la riga va scartata, non indovinata.
 *
 * Servono TRE cose concordi: un marcatore noto in testa al nome, un token
 * seguente che dica il tipo di flusso o la scadenza, e un prefisso ISIN
 * compatibile. Il marcatore può essere di due parole ("European Union",
 * "World Bank") e in quel caso il token da controllare è il terzo.
 *
 * L'ISIN è opzionale nella firma per non rompere chi ha solo il nome, ma
 * senza di esso passano solo gli emittenti per cui l'ISIN non è una chiave,
 * cioè gli organismi internazionali.
 */
export function riconosciEmittente(nome: string, isin?: string): Emittente | null {
  const esito = analizzaNome(nome, isin);
  return esito.emittente ?? null;
}

/** Cosa il riconoscimento ha capito di un nome, e dove si è fermato. */
interface EsitoNome {
  emittente?: Emittente;
  /** Perché non è stato riconosciuto; assente se lo è stato. */
  motivo?: string;
}

function analizzaNome(nome: string, isin?: string): EsitoNome {
  const token = nome
    .trim()
    .split(/[\s-]+/)
    .map((t) => t.toLowerCase());
  const primiDue = `${token[0] ?? ""} ${token[1] ?? ""}`.trim();

  // Il marcatore di due parole ha la precedenza: "European Union" non è
  // "European" seguito da un token qualsiasi.
  let emittente = PER_MARCATORE.get(primiDue);
  let i = 2;
  if (!emittente) {
    emittente = PER_MARCATORE.get(token[0] ?? "");
    i = 1;
  }
  if (!emittente) {
    const noto = NON_TRATTATI[token[0] ?? ""];
    return {
      motivo: noto
        ? `${nome}: ${noto}`
        : `emittente non riconosciuto (${nome}): senza certezza che sia uno Stato white list l'aliquota sarebbe un'ipotesi`,
    };
  }

  // Si saltano le etichette di programma ("Sure Bond", "Next Gen Green"…) e
  // si pretende poi il tipo di flusso o la scadenza.
  let saltate = 0;
  while (
    i < token.length &&
    saltate < MAX_ETICHETTE &&
    ETICHETTE_PROGRAMMA.has(token[i])
  ) {
    i++;
    saltate++;
  }
  if (!SEGUITO_DA.test(token[i] ?? "")) {
    return {
      motivo: `${nome}: dopo il nome dell'emittente non c'è il tipo di flusso (Tf, Fx, Zc…) né una scadenza, quindi non è nella forma con cui il listino nomina i titoli di Stato — può essere un emittente omonimo o un titolo a struttura particolare`,
    };
  }

  const prefissi = DESCRIZIONI[emittente].isin;
  if (prefissi.length === 0) return { emittente }; // organismi internazionali
  if (!isin) {
    return { motivo: `${nome}: senza ISIN il nome da solo non basta a stabilire l'emittente` };
  }
  if (!prefissi.some((p) => isin.toUpperCase().startsWith(p))) {
    return {
      motivo: `${nome} (${isin}): il nome è quello di ${DESCRIZIONI[emittente].nome} ma il prefisso ISIN non è fra quelli con cui emette (${prefissi.join(", ")})`,
    };
  }
  return { emittente };
}

/**
 * Perché una riga NON è stata riconosciuta. Serve a rispondere a chi vede un
 * titolo sul MOT e non lo trova in catalogo: «non riconosciuto» va bene per
 * l'ennesimo corporate, non per KfW o per l'EFSF, che sono fuori per una
 * ragione precisa e discutibile.
 */
export function motivoNonRiconosciuto(nome: string, isin?: string): string {
  return (
    analizzaNome(nome, isin).motivo ??
    `${nome}: riconosciuto, nessun motivo di scarto`
  );
}

/**
 * Valute diverse dall'euro, con cui Borsa Italiana chiude il nome del titolo
 * ("World Bank Tf 3% Ot26 Aud"). Il motore lavora in centesimi di
 * EURO: su un titolo in altra valuta il rendimento dipenderebbe dal cambio a
 * scadenza, che nessuno conosce, e il numero mostrato sarebbe finto.
 *
 * Il confine a sinistra non è `\b` ma «non una lettera»: sul listino c'è
 * "Italy 33usd 5,375", dove la divisa è attaccata all'anno e un confine di
 * parola non la vedrebbe.
 */
const VALUTE_ESTERE =
  /(?<![a-z])(aud|cad|chf|usd|gbp|jpy|nok|sek|dkk|nzd|try|zar|pln|huf|czk|ron|brl|cny|inr|mxn|idr|php|rub|itl)(?![a-z])/i;

export function isValutaEstera(nome: string): boolean {
  return VALUTE_ESTERE.test(nome);
}

/**
 * Cedole per anno. I titoli di Stato italiani pagano SEMESTRALE; i sovrani
 * dell'area euro pagano ANNUALE — e il listino ne riflette la convenzione,
 * pubblicando la cedola già annua invece che di periodo. Sbagliare questo
 * numero sposta lo YTM in modo silenzioso.
 */
export function frequenzaCedola(emittente: Emittente): number {
  return DESCRIZIONI[emittente].frequenzaCedola;
}
