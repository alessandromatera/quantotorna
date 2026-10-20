import type { GradinoCedola } from "../bond/cedole";
import { TIPI_CATALOGO, type TipoCatalogo } from "../categorie";
import { isDataISO } from "../date";
import type { EmissioneSalvata } from "../mercato/emissioni";
import { EMITTENTI, type Emittente } from "../mercato/emittenti";
import type { SintesiScambi } from "../mercato/scambi";

/**
 * Il file che lo scaricamento giornaliero scrive e da cui il sito si
 * compila: `dati/catalogo.json`.
 *
 * Contiene solo DATI, nessun numero calcolato: rendimenti, imposte e
 * duration li ricava il motore alla compilazione (lib/catalogo/metriche.ts)
 * e di nuovo nel browser, con le scelte di chi guarda. Così un errore nel
 * motore si corregge ricompilando, senza riscaricare niente.
 *
 * È anche la memoria dello scaricamento da un giorno all'altro: i dati di
 * emissione e i piani degli step-up non cambiano, e rileggerli ogni giorno
 * vorrebbe dire centinaia di richieste in più (vedi `emissioni` e
 * `documentiMef`).
 *
 * Convenzioni di lib/categorie.ts: date ISO, prezzi in base 100, cedole in
 * percentuale annua.
 */

/** Cambia quando cambia la forma: un file di un'altra versione si rifiuta. */
export const VERSIONE_CATALOGO = 1;

export interface TitoloCatalogo {
  isin: string;
  /** Il nome come lo scrive il listino del MOT. */
  nome: string;
  tipo: TipoCatalogo;
  emittente: Emittente;
  /**
   * Percentuale annua: nominale sui `fisso`, REALE sugli indicizzati, zero
   * su chi non ha cedole e sui CCTeu (per loro vale `spread`). Su uno
   * step-up, quella del periodo in corso.
   */
  cedolaAnnua: number;
  frequenzaCedola: number;
  dataScadenza: string;
  /** Prezzo di chiusura, base 100. REALE sugli indicizzati. */
  prezzo: number;
  /** Solo CCTeu: punti sopra l'Euribor 6m, letti dal nome. */
  spread: number | null;
  /** Solo step-up: il piano delle cedole (lib/mercato/stepup.ts). */
  gradiniCedola: GradinoCedola[] | null;
  /** Scambi degli ultimi tre mesi (Euronext); null = storico non letto. */
  scambi: SintesiScambi | null;
}

export interface Catalogo {
  versione: typeof VERSIONE_CATALOGO;
  /** Giorno dei prezzi di chiusura: la data a cui si fanno tutti i conti. */
  data: string;
  /** Quando il file è stato scritto, ISO con l'ora (UTC). */
  generato: string;
  /** Media mensile della BCE; null se non si è mai potuta leggere. */
  euribor6m: { percentuale: number; periodo: string } | null;
  titoli: TitoloCatalogo[];
  /**
   * Prezzo e data di emissione per ISIN, con la fonte, o il tentativo andato
   * a vuoto (valori null, fonte col motivo). Un ISIN assente non è mai stato
   * cercato. Sta fuori dai titoli perché un risultato d'asta arriva di solito
   * prima che il titolo compaia sul MOT, e dentro i titoli andrebbe perso.
   */
  emissioni: Record<string, EmissioneSalvata>;
  /**
   * Risultati d'asta del MEF già letti, con l'esito: domani si leggono solo
   * i nuovi. Alla pagina non servono.
   */
  documentiMef: { url: string; esito: string }[];
  rapporto: {
    /** Righe dei listini lasciate fuori, col motivo. */
    scartate: { isin: string; motivo: string }[];
    /**
     * Fonti che oggi non hanno risposto: i loro dati sono quelli dell'ultimo
     * giorno buono, o mancano. La pagina le nomina.
     */
    fontiMancanti: { fonte: string; errore: string }[];
  };
}

/**
 * Il file letto, controllato campo per campo. Qualunque cosa fuori forma
 * ferma la compilazione con il percorso del campo: un sito costruito su un
 * catalogo a metà mostrerebbe numeri sbagliati come se fossero giusti.
 */
export function leggiCatalogo(grezzo: unknown): Catalogo {
  const c = oggetto(grezzo, "catalogo");
  if (c.versione !== VERSIONE_CATALOGO) {
    throw new Error(
      `catalogo: versione ${String(c.versione)}, attesa ${VERSIONE_CATALOGO}`,
    );
  }
  const data = dataISO(c.data, "data");
  const titoli = lista(c.titoli, "titoli").map((t, i) => leggiTitolo(t, `titoli[${i}]`));
  const visti = new Set<string>();
  for (const t of titoli) {
    if (visti.has(t.isin)) throw new Error(`titoli: ${t.isin} compare due volte`);
    visti.add(t.isin);
  }
  if (titoli.length === 0) throw new Error("titoli: nessun titolo");
  const rapporto = oggetto(c.rapporto, "rapporto");
  return {
    versione: VERSIONE_CATALOGO,
    data,
    generato: testo(c.generato, "generato"),
    euribor6m:
      c.euribor6m == null
        ? null
        : (() => {
            const e = oggetto(c.euribor6m, "euribor6m");
            return {
              percentuale: numero(e.percentuale, "euribor6m.percentuale"),
              periodo: testo(e.periodo, "euribor6m.periodo"),
            };
          })(),
    titoli,
    emissioni: Object.fromEntries(
      Object.entries(oggetto(c.emissioni, "emissioni")).map(([isin, e]) => {
        if (!ISIN.test(isin)) throw new Error(`emissioni: «${isin}» non è un ISIN`);
        return [isin, leggiEmissione(e, `emissioni.${isin}`)];
      }),
    ),
    documentiMef: lista(c.documentiMef, "documentiMef").map((d, i) => {
      const o = oggetto(d, `documentiMef[${i}]`);
      return {
        url: testo(o.url, `documentiMef[${i}].url`),
        esito: testo(o.esito, `documentiMef[${i}].esito`),
      };
    }),
    rapporto: {
      scartate: lista(rapporto.scartate, "rapporto.scartate").map((s, i) => {
        const o = oggetto(s, `rapporto.scartate[${i}]`);
        return {
          isin: testo(o.isin, `rapporto.scartate[${i}].isin`),
          motivo: testo(o.motivo, `rapporto.scartate[${i}].motivo`),
        };
      }),
      fontiMancanti: lista(rapporto.fontiMancanti, "rapporto.fontiMancanti").map((f, i) => {
        const o = oggetto(f, `rapporto.fontiMancanti[${i}]`);
        return {
          fonte: testo(o.fonte, `rapporto.fontiMancanti[${i}].fonte`),
          errore: testo(o.errore, `rapporto.fontiMancanti[${i}].errore`),
        };
      }),
    },
  };
}

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function leggiTitolo(grezzo: unknown, dove: string): TitoloCatalogo {
  const t = oggetto(grezzo, dove);
  const isin = testo(t.isin, `${dove}.isin`);
  if (!ISIN.test(isin)) throw new Error(`${dove}.isin: «${isin}» non è un ISIN`);
  const tipo = t.tipo as TipoCatalogo;
  if (!TIPI_CATALOGO.includes(tipo)) throw new Error(`${dove}.tipo: «${String(t.tipo)}» sconosciuto`);
  const emittente = t.emittente as Emittente;
  if (!EMITTENTI.includes(emittente)) {
    throw new Error(`${dove}.emittente: «${String(t.emittente)}» sconosciuto`);
  }
  const prezzo = numero(t.prezzo, `${dove}.prezzo`);
  if (!(prezzo > 0 && prezzo < 1000)) throw new Error(`${dove}.prezzo: ${prezzo} fuori scala`);
  const frequenzaCedola = numero(t.frequenzaCedola, `${dove}.frequenzaCedola`);
  if (![1, 2, 4, 12].includes(frequenzaCedola)) {
    throw new Error(`${dove}.frequenzaCedola: ${frequenzaCedola} non è una cadenza`);
  }
  return {
    isin,
    nome: testo(t.nome, `${dove}.nome`),
    tipo,
    emittente,
    cedolaAnnua: numero(t.cedolaAnnua, `${dove}.cedolaAnnua`),
    frequenzaCedola,
    dataScadenza: dataISO(t.dataScadenza, `${dove}.dataScadenza`),
    prezzo,
    spread: t.spread == null ? null : numero(t.spread, `${dove}.spread`),
    gradiniCedola:
      t.gradiniCedola == null
        ? null
        : lista(t.gradiniCedola, `${dove}.gradiniCedola`).map((g, i) => {
            const o = oggetto(g, `${dove}.gradiniCedola[${i}]`);
            return {
              dal: dataISO(o.dal, `${dove}.gradiniCedola[${i}].dal`),
              cedolaAnnua: numero(o.cedolaAnnua, `${dove}.gradiniCedola[${i}].cedolaAnnua`),
            };
          }),
    scambi:
      t.scambi == null
        ? null
        : (() => {
            const s = oggetto(t.scambi, `${dove}.scambi`);
            return {
              mediana: numero(s.mediana, `${dove}.scambi.mediana`),
              sedute: numero(s.sedute, `${dove}.scambi.sedute`),
              attive: numero(s.attive, `${dove}.scambi.attive`),
            };
          })(),
  };
}

function leggiEmissione(grezzo: unknown, dove: string): EmissioneSalvata {
  const e = oggetto(grezzo, dove);
  return {
    prezzoEmissione:
      e.prezzoEmissione == null ? null : numero(e.prezzoEmissione, `${dove}.prezzoEmissione`),
    dataEmissione:
      e.dataEmissione == null ? null : dataISO(e.dataEmissione, `${dove}.dataEmissione`),
    fonte: testo(e.fonte, `${dove}.fonte`),
    dataAggiornamento: dataISO(e.dataAggiornamento, `${dove}.dataAggiornamento`),
  };
}

function oggetto(v: unknown, dove: string): Record<string, unknown> {
  if (v == null || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${dove}: atteso un oggetto`);
  }
  return v as Record<string, unknown>;
}

function lista(v: unknown, dove: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${dove}: attesa una lista`);
  return v;
}

function testo(v: unknown, dove: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${dove}: atteso un testo`);
  return v;
}

function numero(v: unknown, dove: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${dove}: atteso un numero`);
  return v;
}

function dataISO(v: unknown, dove: string): string {
  if (!isDataISO(v)) throw new Error(`${dove}: attesa una data ISO`);
  return v;
}
