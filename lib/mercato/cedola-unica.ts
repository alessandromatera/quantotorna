import { aggiungiMesi } from "../date";
import type { SchedaStepUp } from "./stepup";

/**
 * La cedola dei titoli che ne pagano una sola, a scadenza, insieme al
 * capitale: il BTP Valore Insieme (ottobre 2026), 22,70% del nominale dopo
 * cinque anni. Il listino del MOT non la pubblica; la scheda di Borsa
 * Italiana la scrive nel campo «Descrizione Payout»:
 *
 *   «L'importo minimo della cedola è pari al 22,25% del valore nominale del
 *   prestito e verrà pagata in un'unica soluzione a scadenza»
 *
 * Durante il collocamento è il MINIMO garantito, che alla chiusura può solo
 * salire (il 23/10/2026 il MEF l'ha portata al 22,70%), e così la scheda lo
 * ha tenuto anche dopo. Un minimo non è la cedola: il titolo resta in una
 * scheda sua senza rendimento finché la scheda non scrive la cedola definitiva
 * (deciso dall'autore il 24/10/2026: si aspetta Borsa Italiana, niente
 * cedole scritte a mano nel codice). Dal 27/10/2026 la scheda scrive la
 * definitiva:
 *
 *   «L'importo della cedola definitiva è pari al 22,70% del valore nominale
 *   del prestito e verrà pagata in un'unica soluzione a scadenza»
 *
 * Si riconoscono queste due frasi; ogni altro testo scarta il titolo col
 * motivo, mai una cedola indovinata. Con la definitiva il titolo sta fra i
 * tassi fissi (lib/catalogo/metriche.ts).
 */
export interface CedolaUnica {
  /** Percentuale del nominale, pagata una volta sola a scadenza (22.7 = 22,70%). */
  percentuale: number;
  /** false durante il collocamento: `percentuale` è il minimo garantito. */
  definitiva: boolean;
  /** ISO: da quando matura, la data di godimento della scheda. */
  godimento: string;
}

/** La cedola unica dalla scheda di Borsa Italiana, o il motivo per cui non c'è. */
export function cedolaUnicaDaScheda(
  scheda: SchedaStepUp,
  scadenza: string,
): CedolaUnica | { motivo: string } {
  const testo = scheda.descrizione;
  if (!testo) return { motivo: "la scheda di Borsa Italiana non descrive la cedola" };
  const trovata = testo.match(
    /\bcedola(?:\s+definitiva)?\s+è\s+pari\s+al?\s*(\d+(?:,\d+)?)\s*%\s+del\s+valore\s+nominale\b[^.]*\bunica\s+soluzione\s+a\s+scadenza\b/i,
  );
  const percentuale = trovata ? Number(trovata[1].replace(",", ".")) : null;
  if (percentuale == null || !(percentuale > 0 && percentuale < 100)) {
    return {
      motivo: `cedola unica non riconosciuta nella scheda di Borsa Italiana («${testo.slice(0, 160)}»)`,
    };
  }
  const godimento = scheda.godimento;
  if (!godimento || godimento >= scadenza) {
    return { motivo: `data di godimento assente o non prima della scadenza (${godimento ?? "assente"})` };
  }
  if (mesiInteri(godimento, scadenza) == null) {
    return {
      motivo: `dal godimento del ${godimento} alla scadenza del ${scadenza} non ci sono mesi interi: il periodo della cedola non torna`,
    };
  }
  return { percentuale, definitiva: !/\bminim[ao]\b/i.test(testo), godimento };
}

/** Mesi fra due date, se sono interi (stesso giorno del mese, a meno dei mesi corti). */
function mesiInteri(da: string, a: string): number | null {
  const [a1, m1] = da.split("-").map(Number);
  const [a2, m2] = a.split("-").map(Number);
  const mesi = 12 * (a2 - a1) + (m2 - m1);
  return mesi > 0 && aggiungiMesi(da, mesi) === a ? mesi : null;
}

/**
 * La cedola unica nella forma del motore: un solo periodo cedolare, lungo
 * dal godimento alla scadenza. Su cinque anni la frequenza è 0,2 e la cedola
 * annua il 22,70 / 5 = 4,54%, quella che Borsa Italiana chiamerebbe «su base
 * annua»: cedola annua / frequenza ridà il 22,70% (lib/bond/cedole.ts).
 */
export function cedolaUnicaPerIlMotore(
  c: CedolaUnica,
  scadenza: string,
): { cedolaAnnua: number; frequenzaCedola: number } {
  const mesi = mesiInteri(c.godimento, scadenza);
  if (mesi == null) throw new Error(`cedola unica: periodo dal ${c.godimento} al ${scadenza} non in mesi interi`);
  return { cedolaAnnua: (c.percentuale * 12) / mesi, frequenzaCedola: 12 / mesi };
}

/** Una riga a cedola unica del listino, prima di avere la cedola. */
export interface RigaListinoCedolaUnica {
  isin: string;
  nome: string;
  dataScadenza: string;
}

/**
 * La cedola unica di ogni riga, dalle fonti: quella definitiva di ieri non
 * si rilegge, perché non cambia più; il minimo del collocamento si rilegge
 * ogni giorno, finché la scheda non dà la definitiva. Se la scheda oggi non
 * si legge resta quello di ieri; senza niente il titolo è scartato col
 * motivo, e così se la scheda scrive qualcosa che non si riconosce.
 * `leggiScheda` è iniettata, come per gli step-up.
 */
export async function risolviCedoleUniche(
  righe: RigaListinoCedolaUnica[],
  opzioni: {
    precedenti: Map<string, CedolaUnica>;
    leggiScheda: (isin: string) => Promise<SchedaStepUp>;
  },
): Promise<{ cedole: Map<string, CedolaUnica>; scartate: { isin: string; motivo: string }[] }> {
  const cedole = new Map<string, CedolaUnica>();
  const scartate: { isin: string; motivo: string }[] = [];
  for (const r of righe) {
    const ieri = opzioni.precedenti.get(r.isin);
    if (ieri?.definitiva) {
      cedole.set(r.isin, ieri);
      continue;
    }
    let scheda: SchedaStepUp;
    try {
      scheda = await opzioni.leggiScheda(r.isin);
    } catch (e) {
      if (ieri) {
        cedole.set(r.isin, ieri);
        continue;
      }
      scartate.push({
        isin: r.isin,
        motivo: `cedola unica: scheda di Borsa Italiana non letta (${e instanceof Error ? e.message : String(e)}) (${r.nome})`,
      });
      continue;
    }
    const letta = cedolaUnicaDaScheda(scheda, r.dataScadenza);
    if ("motivo" in letta) {
      scartate.push({ isin: r.isin, motivo: `${letta.motivo} (${r.nome})` });
      continue;
    }
    cedole.set(r.isin, letta);
  }
  return { cedole, scartate };
}

/**
 * Perché il rendimento non si calcola, o null se si calcola: col minimo del
 * collocamento il rendimento sarebbe quello di una cedola che non è la vera.
 */
export function motivoSenzaRendimento(c: CedolaUnica): string | null {
  if (c.definitiva) return null;
  return `Borsa Italiana non ha ancora pubblicato la cedola definitiva: la scheda dà il minimo del collocamento, ${c.percentuale.toFixed(2).replace(".", ",")}%, che alla chiusura può solo salire`;
}
