import type { TipoCatalogo } from "../categorie";
import type { Emittente } from "./emittenti";
import { SOGLIE_SCAMBI, superaSoglia } from "./scambi";

/**
 * Filtri del catalogo. Con tre listini scaricati le righe passano il
 * centinaio e mezzo, e scorrerle tutte per trovare la scadenza giusta non è
 * più praticabile.
 *
 * Ogni criterio è OPZIONALE e si combina in AND con gli altri. Il valore
 * "neutro" (lista vuota, null, false, stringa vuota) significa sempre «non
 * filtrare»: così `FILTRI_VUOTI` mostra tutto e la UI non ha stati speciali
 * da gestire.
 *
 * Modulo puro, senza dipendenze dalla UI.
 */

/**
 * Fasce di VOLATILITÀ, misurata dalla duration modificata: quanto il prezzo
 * si muove per un punto di tassi. «Bassa» è il titolo che si tiene per la
 * cedola senza sorprese di prezzo; «altissima» è il trentennale, dove un
 * punto di tassi vale un quinto del capitale. Gli estremi sono inclusi in
 * basso ed esclusi in alto; `a` null = senza tetto.
 */
export interface FasciaVolatilita {
  chiave: string;
  nome: string;
  da: number;
  a: number | null;
}

export const FASCE_VOLATILITA: FasciaVolatilita[] = [
  { chiave: "bassa", nome: "bassa (dur. < 2)", da: 0, a: 2 },
  { chiave: "media", nome: "media (2–5)", da: 2, a: 5 },
  { chiave: "alta", nome: "alta (5–10)", da: 5, a: 10 },
  { chiave: "altissima", nome: "più volatili (≥ 10)", da: 10, a: null },
];

export interface Filtri {
  /** Famiglie ammesse. Vuoto = tutte. */
  famiglie: TipoCatalogo[];
  /** Emittenti ammessi. Vuoto = tutti. */
  emittenti: Emittente[];
  /** Anno di scadenza minimo/massimo, inclusi. */
  annoMin: number | null;
  annoMax: number | null;
  /** Chiave di `FASCE_VOLATILITA`; null = tutte. */
  volatilita: string | null;
  /** Chiave di `SOGLIE_SCAMBI`: quanto deve scambiare almeno; null = tutti. */
  scambi: string | null;
  /** Solo titoli il cui differenziale a rimborso entra nello zainetto. */
  soloCompensabili: boolean;
  /** Solo titoli per cui il motore ha davvero prodotto un rendimento. */
  soloConRendimento: boolean;
  /** Sottostringa cercata in nome e ISIN, senza distinzione di maiuscole. */
  testo: string;
}

export const FILTRI_VUOTI: Filtri = {
  famiglie: [],
  emittenti: [],
  annoMin: null,
  annoMax: null,
  volatilita: null,
  scambi: null,
  soloCompensabili: false,
  soloConRendimento: false,
  testo: "",
};

export interface Filtrabile {
  isin: string;
  nome: string;
  tipo: TipoCatalogo;
  emittente: Emittente;
  dataScadenza: string;
  /** true se il differenziale a rimborso tocca lo zainetto. */
  toccaZainetto: boolean;
  /** Il rendimento mostrato per questa riga, null se non calcolabile. */
  rendimentoPct: number | null;
  /**
   * Duration modificata, null dove il motore non la calcola (CCTeu,
   * indicizzati): con una fascia di volatilità attiva quei titoli restano
   * fuori, perché non si sa dove metterli.
   */
  durationModificata: number | null;
  /**
   * Mediana degli euro scambiati per seduta negli ultimi tre mesi; null se
   * non letta. Con una soglia attiva i titoli senza dato restano fuori, come
   * sopra.
   */
  scambiMediana: number | null;
}

/** true se la duration cade nella fascia. */
export function inFascia(durata: number | null, fascia: FasciaVolatilita): boolean {
  if (durata == null) return false;
  return durata >= fascia.da && (fascia.a == null || durata < fascia.a);
}

export function filtra<T extends Filtrabile>(titoli: T[], f: Filtri): T[] {
  const cercato = f.testo.trim().toLowerCase();
  const fascia = FASCE_VOLATILITA.find((v) => v.chiave === f.volatilita) ?? null;
  const soglia = SOGLIE_SCAMBI.find((s) => s.chiave === f.scambi) ?? null;
  return titoli.filter((t) => {
    if (f.famiglie.length > 0 && !f.famiglie.includes(t.tipo)) return false;
    if (f.emittenti.length > 0 && !f.emittenti.includes(t.emittente)) return false;
    const anno = Number(t.dataScadenza.slice(0, 4));
    if (f.annoMin != null && anno < f.annoMin) return false;
    if (f.annoMax != null && anno > f.annoMax) return false;
    if (fascia && !inFascia(t.durationModificata, fascia)) return false;
    if (soglia && !superaSoglia(t.scambiMediana, soglia)) return false;
    if (f.soloCompensabili && !t.toccaZainetto) return false;
    if (f.soloConRendimento && t.rendimentoPct == null) return false;
    if (
      cercato !== "" &&
      !t.nome.toLowerCase().includes(cercato) &&
      !t.isin.toLowerCase().includes(cercato)
    ) {
      return false;
    }
    return true;
  });
}

/** true se almeno un criterio è attivo: serve a mostrare «azzera i filtri». */
export function filtriAttivi(f: Filtri): boolean {
  return (
    f.famiglie.length > 0 ||
    f.emittenti.length > 0 ||
    f.annoMin != null ||
    f.annoMax != null ||
    f.volatilita != null ||
    f.scambi != null ||
    f.soloCompensabili ||
    f.soloConRendimento ||
    f.testo.trim() !== ""
  );
}

/**
 * Intervallo di anni presente nei titoli, per proporre estremi sensati
 * invece di campi vuoti. Null se non c'è nulla da mostrare.
 */
export function intervalloAnni(
  titoli: { dataScadenza: string }[],
): { min: number; max: number } | null {
  if (titoli.length === 0) return null;
  const anni = titoli.map((t) => Number(t.dataScadenza.slice(0, 4)));
  return { min: Math.min(...anni), max: Math.max(...anni) };
}

/**
 * Scorciatoie per ORIZZONTE, cioè «fra quanti anni rimborsa» invece di «in
 * che anno».
 *
 * I due campi da/a restano — servono per il caso preciso («voglio proprio il
 * 2031») — ma da soli sono scomodi: il catalogo arriva fino al 2120, quindi
 * bisogna sapere in anticipo che anno digitare, e il ragionamento naturale è
 * per distanza, non per data.
 *
 * Le fasce: entro 2 anni il breve; 2–5 e 5–10 il medio termine; oltre 10 la
 * coda lunga, dove stanno anche i titoli secolari che sballano la vista.
 */
export interface Orizzonte {
  chiave: string;
  nome: string;
  /** Anni da oggi, estremi inclusi. `a` null = senza limite superiore. */
  da: number;
  a: number | null;
}

export const ORIZZONTI: Orizzonte[] = [
  { chiave: "breve", nome: "entro 2 anni", da: 0, a: 2 },
  { chiave: "medio", nome: "2–5 anni", da: 2, a: 5 },
  { chiave: "lungo", nome: "5–10 anni", da: 5, a: 10 },
  { chiave: "moltoLungo", nome: "oltre 10 anni", da: 10, a: null },
];

/**
 * Gli estremi in ANNI DI CALENDARIO di un orizzonte, dato l'anno corrente.
 * L'anno corrente si passa invece di leggerlo qui dentro: il modulo resta
 * puro e il test non dipende da quando lo si esegue.
 */
export function estremiOrizzonte(
  o: Orizzonte,
  annoCorrente: number,
): { annoMin: number; annoMax: number | null } {
  return {
    annoMin: annoCorrente + o.da,
    annoMax: o.a == null ? null : annoCorrente + o.a,
  };
}

/** L'orizzonte attualmente selezionato, se i due campi coincidono con uno. */
export function orizzonteAttivo(f: Filtri, annoCorrente: number): string | null {
  for (const o of ORIZZONTI) {
    const e = estremiOrizzonte(o, annoCorrente);
    if (f.annoMin === e.annoMin && f.annoMax === e.annoMax) return o.chiave;
  }
  return null;
}
