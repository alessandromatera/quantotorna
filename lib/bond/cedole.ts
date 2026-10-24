import { aggiungiMesi, giorni30E360, giorniTra } from "../date";
import { arrotondaCentesimi, type Centesimi } from "../money";

/**
 * Piano cedolare ricostruito all'indietro dalla data di scadenza, a passi di
 * 12/frequenza mesi. Ogni data è calcolata direttamente dalla scadenza (non
 * per sottrazioni successive) per evitare derive sui fine mese. Una cedola
 * sola a scadenza è un periodo lungo quanto il titolo: sui cinque anni del
 * BTP Valore Insieme la frequenza è 0,2 e il passo 60 mesi.
 *
 * Il piano si ferma al godimento, quando è noto: nessuna cedola cade prima,
 * né il giorno stesso. Se il godimento cade fra due date del calendario,
 * la prima cedola è CORTA: matura dal godimento alla data successiva (vedi
 * `cedoleLordeTra` e `rateoMaturato`).
 *
 * Semplificazione dichiarata: la prima cedola LUNGA, che salta la prima data
 * del calendario e paga alla seconda, non si riconosce. Servirebbe la data
 * della prima cedola, che le fonti non danno; il motore la tratta come una
 * cedola corta seguita da una piena. Il totale è lo stesso, cambia solo
 * quando arriva la quota del periodo in più, e il rateo fra le due date.
 */
export interface PianoCedolare {
  dataScadenza: string;
  /** Cedole per anno (2 = semestrale; 0,2 = una ogni cinque anni). */
  frequenzaCedola: number;
  /**
   * ISO: data di godimento, da cui matura la prima cedola. Conta solo se è
   * prima della scadenza; senza, il piano va indietro senza limite, come se
   * il titolo esistesse da sempre.
   */
  godimento?: string;
}

/**
 * Come si contano i giorni di una cedola e del rateo.
 *
 * - `actAct`: ACT/ACT ICMA, quella dei BTP e dei titoli a tasso fisso. Ogni
 *   cedola piena è cedola annua / frequenza; la cedola corta e il rateo sono
 *   la quota di giorni sul periodo teorico intero;
 * - `act360`: quella dei CCTeu. Ogni cedola è nominale × tasso × giorni
 *   effettivi del periodo / 360, e il rateo nominale × tasso × giorni
 *   dall'ultima cedola / 360: le cedole semestrali cambiano coi giorni del
 *   semestre, da 181 a 184;
 * - `30E360`: quella del BTP Valore Insieme. Come `actAct`, ma i giorni si
 *   contano 30E/360 (`giorni30E360`): la cedola unica è piena, e il rateo è
 *   la quota dei giorni 30E/360 sui 1.800 dei cinque anni.
 */
export type ConvenzioneCedola = "actAct" | "act360" | "30E360";

/**
 * Un gradino di un titolo step-up (BTP Valore, Più, Futura): dalla data di
 * stacco `dal` in poi la cedola annua è `cedolaAnnua`. I gradini sono in
 * ordine di data e il primo parte dal godimento.
 *
 * Il gradino si sceglie dall'INIZIO del periodo cedolare, non dalla data di
 * pagamento: la cedola pagata il 27/10/2029 matura fra il 27/04 e il
 * 27/10/2029, e se il gradino nuovo parte il 27/04/2029 è già quella al
 * tasso nuovo. È così che la paga il Tesoro (verificato flusso per flusso
 * sul BTP Futura 2037, il 20/10/2026).
 */
export interface GradinoCedola {
  dal: string;
  cedolaAnnua: number;
}

/**
 * Quello che serve per sapere quanto paga ogni cedola: il piano delle date
 * più la cedola, costante o a gradini. Con i gradini `cedolaAnnua` è solo
 * quella in corso, buona da mostrare ma non per i conti.
 */
export interface Cedolare extends PianoCedolare {
  quantita: number;
  cedolaAnnua: number;
  gradini?: GradinoCedola[];
  /** Default `actAct`. */
  convenzione?: ConvenzioneCedola;
}

/** Cedola annua del periodo che inizia il giorno `inizio`. */
export function cedolaInVigore(
  cedolaAnnua: number,
  gradini: GradinoCedola[] | undefined,
  inizio: string,
): number {
  if (!gradini || gradini.length === 0) return cedolaAnnua;
  let tasso = gradini[0].cedolaAnnua;
  for (const g of gradini) {
    if (g.dal <= inizio) tasso = g.cedolaAnnua;
  }
  return tasso;
}

/** Il titolo paga cedole? Su uno step-up la cedola costante non conta. */
export function haCedole(t: { cedolaAnnua: number; gradini?: GradinoCedola[] }): boolean {
  return t.cedolaAnnua > 0 || (t.gradini?.length ?? 0) > 0;
}

function dataCedola(piano: PianoCedolare, k: number): string {
  // Arrotondato perché con una frequenza frazionaria (0,2) la divisione può
  // non dare un intero esatto, e `aggiungiMesi` vuole mesi interi.
  return aggiungiMesi(piano.dataScadenza, -Math.round(12 / piano.frequenzaCedola) * k);
}

/** I giorni fra due date nella convenzione del titolo, per le quote ACT/ACT e 30E/360. */
function giorni(convenzione: ConvenzioneCedola | undefined, a: string, b: string): number {
  return convenzione === "30E360" ? giorni30E360(a, b) : giorniTra(a, b);
}

/** Il godimento, se conta: noto e prima della scadenza. */
function godimentoNelCalendario(piano: PianoCedolare): string | null {
  const g = piano.godimento;
  return g != null && g < piano.dataScadenza ? g : null;
}

/**
 * Un periodo cedolare. `inizio` è da quando matura: la data di stacco
 * precedente, o il godimento sulla prima cedola corta. `inizioTeorico` è
 * sempre la data precedente del calendario: con `fine` fa il periodo intero
 * su cui ACT/ACT conta i giorni.
 */
interface Periodo {
  inizio: string;
  inizioTeorico: string;
  fine: string;
}

function periodo(inizioTeorico: string, fine: string, godimento: string | null): Periodo {
  const inizio = godimento != null && godimento > inizioTeorico ? godimento : inizioTeorico;
  return { inizio, inizioTeorico, fine };
}

/** Date di stacco nell'intervallo [da, a], in ordine crescente. */
export function dateCedoleTra(piano: PianoCedolare, da: string, a: string): string[] {
  return periodiTra(piano, da, a).map((p) => p.fine);
}

/**
 * Periodi cedolari che si chiudono nell'intervallo [da, a], in ordine
 * crescente: `fine` è la data di stacco. Si ferma al godimento.
 */
function periodiTra(piano: PianoCedolare, da: string, a: string): Periodo[] {
  const godimento = godimentoNelCalendario(piano);
  const periodi: Periodo[] = [];
  for (let k = 0; ; k++) {
    const d = dataCedola(piano, k);
    if (d < da || (godimento != null && d <= godimento)) break;
    if (d <= a) periodi.push(periodo(dataCedola(piano, k + 1), d, godimento));
  }
  return periodi.reverse();
}

/**
 * Centesimi: la cedola lorda di un periodo, al tasso del gradino in vigore
 * all'inizio (vedi `GradinoCedola`).
 */
function importoDelPeriodo(t: Cedolare, p: Periodo): Centesimi {
  const tasso = cedolaInVigore(t.cedolaAnnua, t.gradini, p.inizio);
  if (t.convenzione === "act360") {
    return arrotondaCentesimi((t.quantita * tasso * giorniTra(p.inizio, p.fine)) / 360);
  }
  const piena = importoCedolaPeriodo(t.quantita, tasso, t.frequenzaCedola);
  if (p.inizio === p.inizioTeorico) return piena;
  // Cedola corta, ACT/ACT ICMA (o 30E/360): la quota dei giorni dal
  // godimento sul periodo teorico intero.
  return arrotondaCentesimi(
    (piena * giorni(t.convenzione, p.inizio, p.fine)) /
      giorni(t.convenzione, p.inizioTeorico, p.fine),
  );
}

/**
 * La data della prima cedola, se è corta: il godimento cade fra due date del
 * calendario. Null se il godimento non c'è o è una data del calendario.
 */
export function primaCedolaCorta(piano: PianoCedolare): string | null {
  const godimento = godimentoNelCalendario(piano);
  if (godimento == null) return null;
  const prima = prossimaCedolaDopo(piano, godimento);
  return ultimaCedolaPrimaDi(piano, godimento) < godimento ? prima : null;
}

/**
 * Cedole lorde staccate in (da, a], ciascuna con il suo importo: su un
 * titolo step-up il periodo decide il gradino, in ACT/360 contano i giorni
 * del periodo, e la prima cedola dopo il godimento può essere corta. Su
 * tutti gli altri sono uguali.
 */
export function cedoleLordeTra(
  t: Cedolare,
  da: string,
  a: string,
): { data: string; importo: Centesimi }[] {
  if (!haCedole(t)) return [];
  return periodiTra(t, da, a)
    .filter((p) => p.fine > da)
    .map((p) => ({ data: p.fine, importo: importoDelPeriodo(t, p) }));
}

/**
 * Ultima data di stacco minore o uguale alla data di riferimento, sul
 * calendario: non guarda il godimento.
 */
export function ultimaCedolaPrimaDi(piano: PianoCedolare, riferimento: string): string {
  for (let k = 0; ; k++) {
    const d = dataCedola(piano, k);
    if (d <= riferimento) return d;
  }
}

/**
 * Prima data di stacco strettamente successiva alla data di riferimento,
 * sul calendario: non guarda il godimento.
 */
export function prossimaCedolaDopo(piano: PianoCedolare, riferimento: string): string {
  let precedente = dataCedola(piano, 0);
  for (let k = 1; ; k++) {
    const d = dataCedola(piano, k);
    if (d <= riferimento) return precedente;
    precedente = d;
  }
}

/** Importo lordo in centesimi di una cedola di periodo. */
export function importoCedolaPeriodo(
  quantita: number,
  cedolaAnnua: number,
  frequenzaCedola: number,
): Centesimi {
  // nominale × cedola%/frequenza, in centesimi: quantita × cedolaAnnua / frequenza
  return arrotondaCentesimi((quantita * cedolaAnnua) / frequenzaCedola);
}

/**
 * Rateo lordo maturato alla data di riferimento, nella convenzione del
 * titolo: ACT/ACT sul periodo cedolare (quella dei titoli di Stato
 * italiani), ACT/360 sui CCTeu, 30E/360 sul BTP Valore Insieme. Nel primo
 * periodo matura dal godimento,
 * e prima del godimento è zero. Su uno step-up matura al tasso del periodo
 * in corso.
 */
export function rateoMaturato(params: Cedolare & { riferimento: string }): Centesimi {
  const { riferimento } = params;
  if (!haCedole(params)) return 0;
  // Oltre la scadenza non matura più niente, e soprattutto il piano cedolare
  // degenera: `ultimaCedolaPrimaDi` e `prossimaCedolaDopo` tornano entrambe la
  // data di scadenza, quindi il denominatore sarebbe zero e il rateo
  // `Infinity`. Fin qui il difetto era coperto per caso — `tir` rifiuta un
  // esborso infinito e tutto finiva a null — non per costruzione.
  if (riferimento >= params.dataScadenza) return 0;
  const godimento = godimentoNelCalendario(params);
  if (godimento != null && riferimento <= godimento) return 0;
  const p = periodo(
    ultimaCedolaPrimaDi(params, riferimento),
    prossimaCedolaDopo(params, riferimento),
    godimento,
  );
  const tasso = cedolaInVigore(params.cedolaAnnua, params.gradini, p.inizio);
  if (params.convenzione === "act360") {
    return arrotondaCentesimi((params.quantita * tasso * giorniTra(p.inizio, riferimento)) / 360);
  }
  const cedola = importoCedolaPeriodo(params.quantita, tasso, params.frequenzaCedola);
  return arrotondaCentesimi(
    (cedola * giorni(params.convenzione, p.inizio, riferimento)) /
      giorni(params.convenzione, p.inizioTeorico, p.fine),
  );
}
