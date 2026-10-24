import { TIPI_CATALOGO, type TipoCatalogo } from "../categorie";
import { aggiungiGiorni } from "../date";
import { risolviCedoleUniche, type CedolaUnica } from "../mercato/cedola-unica";
import {
  FONTE_BORSA_ITALIANA,
  FONTE_MEF,
  FONTE_ONVISTA,
  cambiato,
  completa,
  daChiedereAOnvista,
  type EmissioneSalvata,
} from "../mercato/emissioni";
import type { SintesiScambi } from "../mercato/scambi";
import {
  cedolaAnnuaInCorso,
  risolviPianiStepUp,
  type PianoStepUp,
  type SchedaStepUp,
} from "../mercato/stepup";
import type { EsitoParse } from "../prezzi/borsaitaliana";
import type { DocumentoMef, EsitoDocumentoMef } from "../prezzi/mef";
import type { EmissioneOnvista } from "../prezzi/onvista";
import type { TassoBce } from "../prezzi/tassi-bce";
import { VERSIONE_CATALOGO, type Catalogo, type TitoloCatalogo } from "./formato";

/**
 * Lo scaricamento di un giorno: dal catalogo di ieri e dalle fonti di oggi
 * al catalogo di oggi.
 *
 * 1. i listini del MOT da Borsa Italiana, che sostituiscono i titoli —
 *    prezzi, cedole, scadenze; ogni riga scartata è riportata col motivo. Ai
 *    BTP step-up serve il piano delle cedole, che il listino non ha: si
 *    tiene quello di ieri, e per un titolo nuovo si legge la sua scheda. Al
 *    BTP Valore Insieme serve la cedola unica, anche lei dalla scheda;
 * 2. prezzi e date di emissione, che servono al disaggio e che Borsa
 *    Italiana non pubblica: i risultati d'asta del MEF per i titoli italiani
 *    dell'anno, onvista per gli altri, la scheda di Borsa Italiana per la
 *    sola data di godimento quando manca;
 * 3. quanto scambia di solito ogni titolo, dallo storico di Euronext;
 * 4. l'Euribor 6 mesi della BCE, per i CCTeu.
 *
 * Non hanno lo stesso peso. Senza listini non c'è catalogo, e lo
 * scaricamento FALLISCE: resta quello di ieri, e il sito non si ricompila.
 * Senza una delle altre fonti il catalogo si scrive lo stesso, con quello che
 * si sa — i dati di emissione, l'Euribor e gli scambi di ieri restano — e
 * `rapporto.fontiMancanti` lo dice in pagina, con l'ultimo giorno in cui la
 * fonte ha risposto. Gli scambi di ieri restano solo se Euronext non dà
 * niente: un titolo che oggi non si legge, quando gli altri sì, resta «non
 * letto», perché il dato di un titolo non porta il suo giorno.
 *
 * Le fonti sono iniettate: in produzione scaricano (scripts/scarica.ts), nei
 * test rispondono con dati fissi.
 */
export interface Fonti {
  listini: () => Promise<EsitoParse & { pagine: number }>;
  euribor6m: () => Promise<TassoBce>;
  elencaDocumentiMef: () => Promise<DocumentoMef[]>;
  leggiDocumentiMef: (documenti: DocumentoMef[]) => Promise<EsitoDocumentoMef[]>;
  /** La scheda di Borsa Italiana di un titolo: per gli step-up e per la cedola unica. */
  schedaStepUp: (isin: string) => Promise<SchedaStepUp>;
  emissioneOnvista: (isin: string) => Promise<EmissioneOnvista>;
  dataGodimento: (isin: string) => Promise<string>;
  scambi: (
    isin: string[],
    oggi: string,
  ) => Promise<{ letti: Map<string, SintesiScambi>; falliti: { isin: string; motivo: string }[] }>;
}

export interface OpzioniScaricamento {
  /** Il giorno dei prezzi. */
  oggi: string;
  /** Istante di scrittura, ISO con l'ora. */
  generato: string;
  /**
   * Documenti del MEF letti in un giorno. Al primo giro sono tutti quelli
   * dell'anno (116 il 19/10/2026, una trentina di secondi); poi solo i nuovi,
   * una manciata a settimana.
   */
  maxDocumentiMef?: number;
  /**
   * Schede onvista lette in un giorno, al più, quattro alla volta (un decimo
   * di secondo l'una). Senza: tutte quelle che mancano.
   */
  maxOnvista?: number;
  /** Schede di Borsa Italiana per le date di godimento mancanti. */
  maxSchedeBi?: number;
}

export interface CambioEmissione {
  isin: string;
  prima: { prezzoEmissione: number | null; dataEmissione: string | null; fonte: string };
  dopo: { prezzoEmissione: number; dataEmissione: string; fonte: string };
}

/** Quello che è successo oggi, per chi lancia lo scaricamento: più ricco del file. */
export interface RapportoScaricamento {
  importati: number;
  /** Ripartizione per famiglia: zeri improvvisi dicono che il listino è cambiato. */
  perTipo: Record<TipoCatalogo, number>;
  pagine: number;
  scartate: { isin: string; motivo: string }[];
  euribor: TassoBce | { errore: string };
  mef: {
    /** Null se l'elenco dei documenti non si è potuto leggere: c'è `errore`. */
    documentiNuovi: number | null;
    letti: number;
    titoli: number;
    illeggibili: { url: string; motivo: string }[];
    nonScaricati: number;
    errore: string | null;
  };
  onvista: { chiesti: number; trovati: number; senzaDato: { isin: string; motivo: string }[] };
  borsaItaliana: { chieste: number; trovate: number };
  /** Valori salvati che una fonte ha corretto: si mostrano, non si nascondono. */
  cambiati: CambioEmissione[];
  /** Titoli del catalogo per cui il disaggio conta e manca. */
  senzaEmissione: string[];
  scambi: { letti: number; maiScambiati: number; falliti: { isin: string; motivo: string }[] } | { errore: string };
}

const MAX_DOCUMENTI_MEF = 150;
/**
 * Ogni giorno si chiedono a onvista tutti i titoli senza dati di emissione,
 * non una quarantina (deciso dall'autore il 21/10/2026): sono un centinaio,
 * meno di mezzo minuto, e quelli che onvista non ha si richiedono ogni giorno.
 */
const MAX_ONVISTA = Number.POSITIVE_INFINITY;
const MAX_SCHEDE_BI = 40;
const IN_PARALLELO = 4;

/**
 * Per quanto si tiene il dato di emissione di un ISIN che non è nel
 * catalogo. Un risultato d'asta arriva qualche giorno prima del titolo sul
 * MOT (asta, regolamento, quotazione): va tenuto finché il titolo compare.
 * Oltre, è un titolo scaduto o mai quotato.
 */
const GIORNI_EMISSIONE_FUORI_CATALOGO = 120;

/** Le fonti che possono mancare senza fermare lo scaricamento, come la pagina le nomina. */
export const FONTI_SECONDARIE = {
  bce: "BCE (Euribor 6 mesi)",
  mef: "MEF (risultati d'asta)",
  euronext: "Euronext (scambi)",
} as const;

/**
 * L'ultimo giorno in cui `fonte` ha risposto, visto da ieri: il giorno del
 * catalogo di ieri se ieri c'era, altrimenti quello che ieri già riportava.
 */
export function ultimaLettura(fonte: string, precedente: Catalogo | null): string | null {
  if (precedente == null) return null;
  const mancava = precedente.rapporto.fontiMancanti.find((f) => f.fonte === fonte);
  return mancava ? mancava.ultimaLettura : precedente.data;
}

export async function aggiornaCatalogo(
  precedente: Catalogo | null,
  fonti: Fonti,
  opzioni: OpzioniScaricamento,
): Promise<{ catalogo: Catalogo; rapporto: RapportoScaricamento }> {
  const { oggi } = opzioni;
  const fontiMancanti: Catalogo["rapporto"]["fontiMancanti"] = [];
  const manca = (fonte: string, errore: string) =>
    fontiMancanti.push({ fonte, errore, ultimaLettura: ultimaLettura(fonte, precedente) });

  // Listini, elenco del MEF ed Euribor sono indipendenti: insieme.
  const [listini, documentiMef, euribor] = await Promise.allSettled([
    fonti.listini(),
    fonti.elencaDocumentiMef(),
    fonti.euribor6m(),
  ]);
  if (listini.status === "rejected") {
    throw new Error(`listini del MOT non letti, catalogo invariato: ${messaggio(listini.reason)}`);
  }
  if (listini.value.righe.length === 0) {
    throw new Error("listini del MOT vuoti: la pagina è cambiata, catalogo invariato");
  }

  const stepUp = await conPianiStepUp(listini.value.righe, precedente, fonti, oggi);
  const cedoleUniche = await conCedoleUniche(stepUp.titoli, precedente, fonti);
  const titoli = cedoleUniche.titoli;
  const scartate = [...listini.value.scartate, ...stepUp.scartate, ...cedoleUniche.scartate];

  let euribor6m: Catalogo["euribor6m"] = precedente?.euribor6m ?? null;
  if (euribor.status === "fulfilled") {
    euribor6m = { percentuale: euribor.value.percentuale, periodo: euribor.value.periodo };
  } else {
    manca(FONTI_SECONDARIE.bce, messaggio(euribor.reason));
  }

  // Emissioni e scambi dopo i listini, perché i titoli da completare sono
  // quelli di oggi; fra loro sono indipendenti e girano insieme.
  const [emissioni, scambi] = await Promise.allSettled([
    aggiornaEmissioni(
      titoli,
      precedente,
      documentiMef.status === "fulfilled" ? documentiMef.value : { errore: messaggio(documentiMef.reason) },
      fonti,
      opzioni,
    ),
    fonti.scambi(
      titoli.map((t) => t.isin),
      oggi,
    ),
  ]);
  if (emissioni.status === "rejected") {
    // Un errore di programma, non di rete: le fonti falliscono una per una
    // dentro `aggiornaEmissioni`. Meglio fermarsi che scrivere un catalogo
    // senza i dati di ieri.
    throw emissioni.reason;
  }
  const e = emissioni.value;
  if (e.rapporto.mef.errore != null) manca(FONTI_SECONDARIE.mef, e.rapporto.mef.errore);

  let rapportoScambi: RapportoScaricamento["scambi"];
  let erroreScambi: string | null = null;
  if (scambi.status === "fulfilled") {
    for (const t of titoli) t.scambi = scambi.value.letti.get(t.isin) ?? null;
    rapportoScambi = {
      letti: scambi.value.letti.size,
      maiScambiati: [...scambi.value.letti.values()].filter((s) => s.attive === 0).length,
      falliti: scambi.value.falliti,
    };
    if (scambi.value.letti.size === 0) erroreScambi = "nessuno storico letto";
  } else {
    rapportoScambi = { errore: messaggio(scambi.reason) };
    erroreScambi = messaggio(scambi.reason);
  }
  if (erroreScambi != null) {
    // Euronext non ha dato niente: restano gli scambi di ieri, che a loro
    // volta possono venire da prima (il giorno lo dice `ultimaLettura`).
    const diIeri = new Map((precedente?.titoli ?? []).map((t) => [t.isin, t.scambi]));
    for (const t of titoli) t.scambi = diIeri.get(t.isin) ?? null;
    manca(FONTI_SECONDARIE.euronext, erroreScambi);
  }

  const catalogo: Catalogo = {
    versione: VERSIONE_CATALOGO,
    data: oggi,
    generato: opzioni.generato,
    euribor6m,
    titoli,
    emissioni: e.emissioni,
    documentiMef: e.documentiMef,
    rapporto: { scartate, fontiMancanti },
  };
  return {
    catalogo,
    rapporto: {
      importati: titoli.length,
      perTipo: Object.fromEntries(
        TIPI_CATALOGO.map((t) => [t, titoli.filter((r) => r.tipo === t).length]),
      ) as Record<TipoCatalogo, number>,
      pagine: listini.value.pagine,
      scartate,
      euribor: euribor.status === "fulfilled" ? euribor.value : { errore: messaggio(euribor.reason) },
      ...e.rapporto,
      scambi: rapportoScambi,
    },
  };
}

/**
 * La cedola unica su ogni titolo che ne paga una sola (lib/mercato/cedola-unica.ts);
 * chi resta senza è scartato col motivo. Quella definitiva di ieri non si
 * rilegge; il minimo del collocamento sì, ogni giorno.
 */
async function conCedoleUniche(
  titoli: TitoloCatalogo[],
  precedente: Catalogo | null,
  fonti: Fonti,
): Promise<{ titoli: TitoloCatalogo[]; scartate: { isin: string; motivo: string }[] }> {
  const precedenti = new Map<string, CedolaUnica>();
  for (const t of precedente?.titoli ?? []) {
    if (t.cedolaUnica) precedenti.set(t.isin, t.cedolaUnica);
  }
  const { cedole, scartate } = await risolviCedoleUniche(
    titoli.filter((t) => t.tipo === "cedolaUnica"),
    { precedenti, leggiScheda: fonti.schedaStepUp },
  );
  return {
    titoli: titoli.flatMap((t) => {
      if (t.tipo !== "cedolaUnica") return [t];
      const cedola = cedole.get(t.isin);
      return cedola ? [{ ...t, cedolaUnica: cedola }] : [];
    }),
    scartate,
  };
}

/**
 * Il piano delle cedole su ogni step-up del listino; chi resta senza è
 * scartato col motivo. I piani già letti stanno nel catalogo di ieri: un
 * piano non cambia, e rileggerlo vorrebbe dire una scheda di Borsa Italiana
 * in più per titolo, ogni giorno.
 */
async function conPianiStepUp(
  righe: EsitoParse["righe"],
  precedente: Catalogo | null,
  fonti: Fonti,
  oggi: string,
): Promise<{ titoli: TitoloCatalogo[]; scartate: { isin: string; motivo: string }[] }> {
  const precedenti = new Map<string, PianoStepUp>();
  for (const t of precedente?.titoli ?? []) {
    if (t.gradiniCedola && t.gradiniCedola.length > 0) {
      precedenti.set(t.isin, { frequenza: t.frequenzaCedola, gradini: t.gradiniCedola });
    }
  }
  const { piani, scartate } = await risolviPianiStepUp(
    righe
      .filter((r) => r.tipo === "stepUp")
      .map((r) => ({
        isin: r.isin,
        nome: r.nome,
        dataScadenza: r.dataScadenza,
        cedolaListino: r.cedolaListino ?? null,
      })),
    { oggi, precedenti, leggiScheda: fonti.schedaStepUp },
  );
  const titoli: TitoloCatalogo[] = [];
  for (const r of righe) {
    // La cedola del listino è servita alla verifica del piano: nel catalogo
    // non va.
    const base: TitoloCatalogo = {
      isin: r.isin,
      nome: r.nome,
      tipo: r.tipo,
      emittente: r.emittente,
      cedolaAnnua: r.cedolaAnnua,
      frequenzaCedola: r.frequenzaCedola,
      dataScadenza: r.dataScadenza,
      prezzo: r.prezzo,
      spread: r.spread ?? null,
      gradiniCedola: null,
      scambi: null,
    };
    if (r.tipo !== "stepUp") {
      titoli.push(base);
      continue;
    }
    const piano = piani.get(r.isin);
    if (!piano) continue;
    titoli.push({
      ...base,
      frequenzaCedola: piano.frequenza,
      gradiniCedola: piano.gradini,
      cedolaAnnua: cedolaAnnuaInCorso(piano, r.dataScadenza, oggi),
    });
  }
  return { titoli, scartate };
}

/**
 * Aggiorna prezzi e date di emissione:
 *
 * 1. MEF, per i titoli di Stato italiani: i risultati d'asta nuovi, col
 *    «Prezzo Fiscale» della prima tranche. È la fonte primaria e vince su
 *    tutte le altre;
 * 2. onvista (WM Datenservice), per i titoli che restano senza dati;
 * 3. la data di godimento dalla scheda di Borsa Italiana, dove c'è il
 *    prezzo ma non la data.
 *
 * Un valore nuovo sostituisce il vecchio; un vuoto non cancella mai un dato
 * noto. Il rapporto dice cosa è cambiato e quali titoli restano senza
 * disaggio.
 */
async function aggiornaEmissioni(
  titoli: TitoloCatalogo[],
  precedente: Catalogo | null,
  documentiMef: DocumentoMef[] | { errore: string },
  fonti: Fonti,
  opzioni: OpzioniScaricamento,
): Promise<{
  emissioni: Record<string, EmissioneSalvata>;
  documentiMef: Catalogo["documentiMef"];
  rapporto: Pick<RapportoScaricamento, "mef" | "onvista" | "borsaItaliana" | "cambiati" | "senzaEmissione">;
}> {
  const { oggi } = opzioni;
  const salvate = new Map<string, EmissioneSalvata>(Object.entries(precedente?.emissioni ?? {}));
  const cambiati: CambioEmissione[] = [];
  const scrivi = (isin: string, prezzoEmissione: number, dataEmissione: string, fonte: string) => {
    const prima = salvate.get(isin);
    if (cambiato(prima, { prezzoEmissione, dataEmissione })) {
      cambiati.push({
        isin,
        prima: { prezzoEmissione: prima!.prezzoEmissione, dataEmissione: prima!.dataEmissione, fonte: prima!.fonte },
        dopo: { prezzoEmissione, dataEmissione, fonte },
      });
    }
    salvate.set(isin, { prezzoEmissione, dataEmissione, fonte, dataAggiornamento: oggi });
  };

  // ── 1. MEF ─────────────────────────────────────────────────────────────
  const letti = new Map((precedente?.documentiMef ?? []).map((d) => [d.url, d.esito]));
  const mef: RapportoScaricamento["mef"] = {
    documentiNuovi: null,
    letti: 0,
    titoli: 0,
    illeggibili: [],
    nonScaricati: 0,
    errore: null,
  };
  if ("errore" in documentiMef) {
    mef.errore = documentiMef.errore;
  } else {
    // Gli illeggibili si riprovano: il motivo può essere un difetto del
    // lettore, corretto nel frattempo.
    const nuovi = documentiMef.filter((d) => letti.get(d.url) !== "letto");
    mef.documentiNuovi = nuovi.length;
    const esiti = await fonti.leggiDocumentiMef(nuovi.slice(0, opzioni.maxDocumentiMef ?? MAX_DOCUMENTI_MEF));
    const titoliMef = new Set<string>();
    for (const e of esiti) {
      if (e.tipo === "nonScaricato") {
        mef.nonScaricati++;
        continue;
      }
      letti.set(e.url, e.tipo === "letto" ? "letto" : e.motivo);
      if (e.tipo === "illeggibile") {
        mef.illeggibili.push({ url: e.url, motivo: e.motivo });
        continue;
      }
      mef.letti++;
      // I documenti arrivano dal più recente: per ogni titolo basta il primo,
      // il prezzo fiscale è lo stesso su tutte le tranche.
      if (titoliMef.has(e.risultato.isin)) continue;
      titoliMef.add(e.risultato.isin);
      scrivi(e.risultato.isin, e.risultato.prezzoFiscale, e.risultato.dataEmissione, FONTE_MEF);
    }
    mef.titoli = titoliMef.size;
  }

  // ── Quali titoli interessano ───────────────────────────────────────────
  // Quelli per cui il disaggio entra nei conti. Gli strip italiani no: il
  // loro scarto non ha un prezzo di emissione pubblicato.
  const interessanti = titoli
    .filter(
      (t) =>
        t.dataScadenza > oggi &&
        (t.tipo === "fisso" ||
          t.tipo === "bot" ||
          t.tipo === "ccteu" ||
          (t.tipo === "zeroCoupon" && t.emittente !== "IT")),
    )
    .map((t) => t.isin);

  // ── 2. onvista ─────────────────────────────────────────────────────────
  const daChiedere = daChiedereAOnvista({
    catalogo: interessanti,
    salvate,
    oggi,
    massimo: opzioni.maxOnvista ?? MAX_ONVISTA,
  });
  const onvista: RapportoScaricamento["onvista"] = { chiesti: daChiedere.length, trovati: 0, senzaDato: [] };
  const esitiOnvista = await aBlocchi(daChiedere, fonti.emissioneOnvista);
  for (const [i, e] of esitiOnvista.entries()) {
    const isin = daChiedere[i];
    if (e.status === "fulfilled") {
      onvista.trovati++;
      scrivi(isin, e.value.prezzoEmissione, e.value.dataEmissione, FONTE_ONVISTA);
      continue;
    }
    const motivo = messaggio(e.reason);
    onvista.senzaDato.push({ isin, motivo });
    // Si annota il tentativo senza toccare i valori: domani si riprova chi
    // non ha dati, dal tentativo più vecchio.
    const prima = salvate.get(isin);
    salvate.set(isin, {
      prezzoEmissione: prima?.prezzoEmissione ?? null,
      dataEmissione: prima?.dataEmissione ?? null,
      fonte: prima ? `${prima.fonte.split(" · ")[0]} · onvista: ${motivo}` : `onvista: ${motivo}`,
      dataAggiornamento: oggi,
    });
  }

  // ── 3. Data di godimento da Borsa Italiana ─────────────────────────────
  const senzaData = interessanti
    .filter((isin) => {
      const r = salvate.get(isin);
      return r?.prezzoEmissione != null && r.dataEmissione == null;
    })
    .slice(0, opzioni.maxSchedeBi ?? MAX_SCHEDE_BI);
  const esitiBi = await aBlocchi(senzaData, fonti.dataGodimento);
  let trovateBi = 0;
  for (const [i, e] of esitiBi.entries()) {
    if (e.status !== "fulfilled") continue;
    const isin = senzaData[i];
    const prima = salvate.get(isin)!;
    trovateBi++;
    salvate.set(isin, {
      ...prima,
      dataEmissione: e.value,
      fonte: `${prima.fonte.split(" · ")[0]} + ${FONTE_BORSA_ITALIANA}`,
      dataAggiornamento: oggi,
    });
  }

  // Si tiene quello che serve: i titoli di oggi e i dati recenti di titoli
  // non ancora quotati. Il resto è di titoli scaduti.
  const nelCatalogo = new Set(titoli.map((t) => t.isin));
  const limite = aggiungiGiorni(oggi, -GIORNI_EMISSIONE_FUORI_CATALOGO);
  const emissioni = Object.fromEntries(
    [...salvate.entries()]
      .filter(([isin, r]) => nelCatalogo.has(isin) || r.dataAggiornamento >= limite)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  // Dei documenti del MEF si tengono quelli ancora elencati: l'elenco è
  // dell'anno in corso, e un documento sparito non tornerà.
  const elencati = "errore" in documentiMef ? null : new Set(documentiMef.map((d) => d.url));
  return {
    emissioni,
    documentiMef: [...letti.entries()]
      .filter(([url]) => elencati == null || elencati.has(url))
      .map(([url, esito]) => ({ url, esito })),
    rapporto: {
      mef,
      onvista,
      borsaItaliana: { chieste: senzaData.length, trovate: trovateBi },
      cambiati,
      senzaEmissione: interessanti.filter((isin) => !completa(salvate.get(isin))),
    },
  };
}

async function aBlocchi<T, R>(voci: T[], fai: (v: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const esiti: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < voci.length; i += IN_PARALLELO) {
    esiti.push(...(await Promise.allSettled(voci.slice(i, i + IN_PARALLELO).map(fai))));
  }
  return esiti;
}

function messaggio(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
