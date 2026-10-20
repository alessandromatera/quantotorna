import { aggiungiMesi, giorniTra } from "../date";
import { arrotondaCentesimi, type Centesimi } from "../money";

/**
 * Piano cedolare ricostruito all'indietro dalla data di scadenza, a passi di
 * 12/frequenza mesi. Ogni data è calcolata direttamente dalla scadenza (non
 * per sottrazioni successive) per evitare derive sui fine mese.
 */
export interface PianoCedolare {
  dataScadenza: string;
  /** Cedole per anno (2 = semestrale). */
  frequenzaCedola: number;
}

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
  return aggiungiMesi(piano.dataScadenza, -(12 / piano.frequenzaCedola) * k);
}

/** Date di stacco nell'intervallo [da, a], in ordine crescente. */
export function dateCedoleTra(piano: PianoCedolare, da: string, a: string): string[] {
  return periodiTra(piano, da, a).map((p) => p.fine);
}

/**
 * Periodi cedolari che si chiudono nell'intervallo [da, a], in ordine
 * crescente: `fine` è la data di stacco, `inizio` quella precedente.
 */
function periodiTra(
  piano: PianoCedolare,
  da: string,
  a: string,
): { inizio: string; fine: string }[] {
  const periodi: { inizio: string; fine: string }[] = [];
  for (let k = 0; ; k++) {
    const d = dataCedola(piano, k);
    if (d < da) break;
    if (d <= a) periodi.push({ inizio: dataCedola(piano, k + 1), fine: d });
  }
  return periodi.reverse();
}

/**
 * Cedole lorde staccate in (da, a], ciascuna con il suo importo: su un
 * titolo step-up il periodo decide il gradino, su tutti gli altri sono
 * uguali.
 */
export function cedoleLordeTra(
  t: Cedolare,
  da: string,
  a: string,
): { data: string; importo: Centesimi }[] {
  if (!haCedole(t)) return [];
  return periodiTra(t, da, a)
    .filter((p) => p.fine > da)
    .map((p) => ({
      data: p.fine,
      importo: importoCedolaPeriodo(
        t.quantita,
        cedolaInVigore(t.cedolaAnnua, t.gradini, p.inizio),
        t.frequenzaCedola,
      ),
    }));
}

/** Ultima data di stacco minore o uguale alla data di riferimento. */
export function ultimaCedolaPrimaDi(piano: PianoCedolare, riferimento: string): string {
  for (let k = 0; ; k++) {
    const d = dataCedola(piano, k);
    if (d <= riferimento) return d;
  }
}

/** Prima data di stacco strettamente successiva alla data di riferimento. */
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
 * Rateo lordo maturato alla data di riferimento, convenzione ACT/ACT sul
 * periodo cedolare (quella dei titoli di Stato italiani).
 */
export function rateoMaturato(params: {
  quantita: number;
  cedolaAnnua: number;
  frequenzaCedola: number;
  dataScadenza: string;
  riferimento: string;
  /** Piano di uno step-up: il rateo matura al tasso del periodo in corso. */
  gradini?: GradinoCedola[];
}): Centesimi {
  const { quantita, cedolaAnnua, frequenzaCedola, dataScadenza, riferimento, gradini } = params;
  if (!haCedole({ cedolaAnnua, gradini })) return 0;
  // Oltre la scadenza non matura più niente, e soprattutto il piano cedolare
  // degenera: `ultimaCedolaPrimaDi` e `prossimaCedolaDopo` tornano entrambe la
  // data di scadenza, quindi il denominatore sarebbe zero e il rateo
  // `Infinity`. Fin qui il difetto era coperto per caso — `tir` rifiuta un
  // esborso infinito e tutto finiva a null — non per costruzione.
  if (riferimento >= dataScadenza) return 0;
  const piano = { dataScadenza, frequenzaCedola };
  const inizio = ultimaCedolaPrimaDi(piano, riferimento);
  const fine = prossimaCedolaDopo(piano, riferimento);
  const cedola = importoCedolaPeriodo(
    quantita,
    cedolaInVigore(cedolaAnnua, gradini, inizio),
    frequenzaCedola,
  );
  return arrotondaCentesimi(
    (cedola * giorniTra(inizio, riferimento)) / giorniTra(inizio, fine),
  );
}
