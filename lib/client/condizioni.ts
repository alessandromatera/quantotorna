import { leggiTariffa, TARIFFA_NULLA, type TariffaMercato } from "../costi/commissioni";
import { INFLAZIONE_PREDEFINITA } from "../costi/inflazione";
import { scadenzaMinusvalenza, type VoceZainetto } from "../tax/zainetto";

/**
 * Le scelte di chi guarda: su quanto nominale fare la tabella e le
 * simulazioni, quanto si paga di commissioni, che minusvalenze ha da
 * compensare, che inflazione si aspetta.
 * Restano nel suo browser (localStorage) e non escono mai dalla pagina.
 *
 * Modulo puro: la lettura è qui e testata, il salvataggio sta nel componente.
 */
export interface Condizioni {
  /** Nominale della tabella e delle simulazioni d'acquisto e di uscita. */
  nominale: number;
  tariffa: TariffaMercato;
  /** Minusvalenze ancora da compensare, anno per anno. */
  zainetto: VoceZainetto[];
  /** Quale lettura del 48,08% applicare (vedi lib/tax/plusvalenze.ts). */
  compensazioneTitoliStatoRidotta: boolean;
  /** Percentuale annua, per leggere l'inflazione di pareggio dei BTP€i. */
  inflazioneAttesa: number;
}

export const CONDIZIONI_PREDEFINITE: Condizioni = {
  nominale: 10_000,
  tariffa: TARIFFA_NULLA,
  zainetto: [],
  compensazioneTitoliStatoRidotta: false,
  inflazioneAttesa: INFLAZIONE_PREDEFINITA,
};

/** La chiave nel localStorage. Cambia solo se cambia il significato dei campi. */
export const CHIAVE_CONDIZIONI = "quantotorna.condizioni.v1";

const NOMINALE_MAX = 100_000_000;

/**
 * Il JSON salvato → condizioni, campo per campo: ciò che manca o non torna
 * prende il valore di partenza. Un salvataggio corrotto, scritto a mano o di
 * una versione vecchia non deve rompere la pagina.
 */
export function leggiCondizioni(json: string | null): Condizioni {
  if (!json) return CONDIZIONI_PREDEFINITE;
  let grezzo: Record<string, unknown>;
  try {
    const letto = JSON.parse(json) as unknown;
    if (letto == null || typeof letto !== "object" || Array.isArray(letto)) {
      return CONDIZIONI_PREDEFINITE;
    }
    grezzo = letto as Record<string, unknown>;
  } catch {
    return CONDIZIONI_PREDEFINITE;
  }
  const nominale = grezzo.nominale;
  const inflazione = grezzo.inflazioneAttesa;
  return {
    nominale:
      typeof nominale === "number" && Number.isFinite(nominale) && nominale > 0 && nominale <= NOMINALE_MAX
        ? nominale
        : CONDIZIONI_PREDEFINITE.nominale,
    tariffa: leggiTariffa(grezzo.tariffa == null ? null : JSON.stringify(grezzo.tariffa)),
    zainetto: Array.isArray(grezzo.zainetto) ? vociValide(grezzo.zainetto) : [],
    compensazioneTitoliStatoRidotta: grezzo.compensazioneTitoliStatoRidotta === true,
    inflazioneAttesa:
      typeof inflazione === "number" && Number.isFinite(inflazione) && inflazione > -5 && inflazione < 20
        ? inflazione
        : CONDIZIONI_PREDEFINITE.inflazioneAttesa,
  };
}

/**
 * Le voci dello zainetto che hanno senso: anno intero, importo positivo in
 * centesimi. La scadenza si ricalcola sempre dall'anno: è la regola dei
 * quattro anni, non un dato che chi guarda debba scrivere.
 */
function vociValide(voci: unknown[]): VoceZainetto[] {
  const valide: VoceZainetto[] = [];
  for (const v of voci) {
    if (v == null || typeof v !== "object") continue;
    const { annoCompetenza, importoResiduo } = v as Record<string, unknown>;
    if (
      typeof annoCompetenza !== "number" ||
      !Number.isInteger(annoCompetenza) ||
      annoCompetenza < 2000 ||
      annoCompetenza > 2100
    ) {
      continue;
    }
    if (typeof importoResiduo !== "number" || !Number.isSafeInteger(importoResiduo) || importoResiduo <= 0) {
      continue;
    }
    valide.push(vocePerAnno(annoCompetenza, importoResiduo));
  }
  return valide.sort((a, b) => a.annoCompetenza - b.annoCompetenza);
}

/** Una voce dello zainetto dall'anno in cui è nata la minusvalenza. */
export function vocePerAnno(annoCompetenza: number, importoResiduo: number): VoceZainetto {
  return { annoCompetenza, importoResiduo, dataScadenza: scadenzaMinusvalenza(annoCompetenza) };
}

/** Le voci ancora utilizzabili il giorno `data`: le altre sono scadute. */
export function zainettoVivo(zainetto: VoceZainetto[], data: string): VoceZainetto[] {
  return zainetto.filter((v) => v.dataScadenza >= data && v.importoResiduo > 0);
}
