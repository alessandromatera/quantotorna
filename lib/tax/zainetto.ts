import type { Centesimi } from "../money";

export interface VoceZainetto {
  id?: number;
  annoCompetenza: number;
  importoResiduo: Centesimi;
  /** ISO. 31/12 del quarto anno successivo a quello di competenza. */
  dataScadenza: string;
}

/** Le minusvalenze si estinguono alla fine del quarto anno successivo. */
export function scadenzaMinusvalenza(annoCompetenza: number): string {
  return `${annoCompetenza + 4}-12-31`;
}

/** Una voce è utilizzabile fino al 31/12 del quarto anno successivo incluso. */
export function voceUtilizzabile(voce: VoceZainetto, dataOperazione: string): boolean {
  return voce.importoResiduo > 0 && voce.dataScadenza >= dataOperazione &&
    voce.annoCompetenza <= Number(dataOperazione.slice(0, 4));
}

export interface EsitoCompensazione {
  /** Quanto zainetto è stato consumato. */
  assorbito: Centesimi;
  /** Parte dell'importo compensabile rimasta scoperta (da tassare). */
  nonCompensato: Centesimi;
  dettaglio: { annoCompetenza: number; usato: Centesimi }[];
  /** Copia delle voci con i residui aggiornati (le voci in input non vengono mutate). */
  vociAggiornate: VoceZainetto[];
}

/**
 * Consuma lo zainetto contro un importo compensabile, dalla voce più
 * vecchia. Le voci estinte alla data dell'operazione non vengono toccate.
 */
export function compensa(
  voci: VoceZainetto[],
  importoCompensabile: Centesimi,
  dataOperazione: string,
): EsitoCompensazione {
  const vociAggiornate = voci.map((v) => ({ ...v }));
  const dettaglio: { annoCompetenza: number; usato: Centesimi }[] = [];
  let daCompensare = Math.max(0, importoCompensabile);

  const ordinate = [...vociAggiornate].sort(
    (a, b) => a.annoCompetenza - b.annoCompetenza,
  );
  for (const voce of ordinate) {
    if (daCompensare === 0) break;
    if (!voceUtilizzabile(voce, dataOperazione)) continue;
    const usato = Math.min(voce.importoResiduo, daCompensare);
    voce.importoResiduo -= usato;
    daCompensare -= usato;
    dettaglio.push({ annoCompetenza: voce.annoCompetenza, usato });
  }

  return {
    assorbito: Math.max(0, importoCompensabile) - daCompensare,
    nonCompensato: daCompensare,
    dettaglio,
    vociAggiornate,
  };
}
