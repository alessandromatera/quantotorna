import { arrotondaCentesimi, type Centesimi } from "../money";

/**
 * Commissioni di negoziazione sul MOT.
 *
 * Ogni intermediario ha la sua tariffa, e cambia nel tempo e per profilo:
 * la sceglie chi guarda, e resta nel suo browser. Il motore conosce solo la
 * forma che quasi tutte hanno:
 *
 *   commissione = clamp(controvalore × percentuale, minimo, massimo) + fisso
 *
 * che copre sia le tariffe proporzionali sia quelle fisse per eseguito.
 */
export interface TariffaMercato {
  /** Percentuale sul controvalore (0.15 = 0,15%). */
  percentuale: number;
  /** Centesimi: minimo applicato alla parte proporzionale. */
  minimo: Centesimi;
  /** Centesimi: massimo applicato alla parte proporzionale (0 = nessuno). */
  massimo: Centesimi;
  /** Centesimi: quota fissa per eseguito. */
  fisso: Centesimi;
}

/** Nessuna commissione: il punto di partenza finché chi guarda non sceglie. */
export const TARIFFA_NULLA: TariffaMercato = {
  percentuale: 0,
  minimo: 0,
  massimo: 0,
  fisso: 0,
};

/** La tariffa non fa pagare niente, in nessuna sua voce. */
export function senzaCommissioni(t: TariffaMercato): boolean {
  return t.percentuale === 0 && t.minimo === 0 && t.massimo === 0 && t.fisso === 0;
}

/** Commissione di un singolo eseguito. */
export function commissione(params: {
  tariffa: TariffaMercato;
  /** Centesimi: controvalore dell'operazione. */
  controvalore: Centesimi;
}): Centesimi {
  const { tariffa, controvalore } = params;
  const lordo = arrotondaCentesimi((Math.abs(controvalore) * tariffa.percentuale) / 100);
  let proporzionale = lordo;
  if (tariffa.percentuale > 0) {
    proporzionale = Math.max(tariffa.minimo, lordo);
    if (tariffa.massimo > 0) proporzionale = Math.min(tariffa.massimo, proporzionale);
  }
  return proporzionale + tariffa.fisso;
}

/**
 * Tariffa salvata nel browser (JSON) → struttura tipata, con il valore di
 * partenza per ogni campo mancante o non valido. Un JSON corrotto o di una
 * versione vecchia non deve rompere la pagina: si torna alla tariffa nulla.
 */
export function leggiTariffa(json: string | null): TariffaMercato {
  if (!json) return TARIFFA_NULLA;
  try {
    const grezzo = JSON.parse(json) as Partial<TariffaMercato> | null;
    if (grezzo == null || typeof grezzo !== "object") return TARIFFA_NULLA;
    const numero = (v: unknown, d: number) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d;
    return {
      percentuale: numero(grezzo.percentuale, TARIFFA_NULLA.percentuale),
      minimo: numero(grezzo.minimo, TARIFFA_NULLA.minimo),
      massimo: numero(grezzo.massimo, TARIFFA_NULLA.massimo),
      fisso: numero(grezzo.fisso, TARIFFA_NULLA.fisso),
    };
  } catch {
    return TARIFFA_NULLA;
  }
}
