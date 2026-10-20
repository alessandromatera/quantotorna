/**
 * Euribor a 6 mesi dalla BCE: l'unico modo di dare un rendimento ai CCTeu.
 * Il listino MOT pubblica lo spread nel nome ("Eur6m+0,65%") ma non la
 * cedola in corso; con l'Euribor la cedola si ricostruisce, e da lì il
 * rendimento a scadenza — sotto l'ipotesi dichiarata che l'Euribor resti
 * dov'è, che è falsa ma esplicita, ed è comunque meglio di una riga vuota.
 *
 * API pubblica e senza chiave, in formato SDMX-JSON: si chiede una serie
 * statistica uguale per tutti.
 *
 * LIMITE DICHIARATO: la BCE pubblica l'Euribor come media MENSILE, non
 * giornaliera (le serie `D.` non esistono per questa chiave). Il dato è
 * quindi vecchio fino a un mese, e va letto per quello che è — un livello,
 * non la fixing di stamattina.
 */

const BASE = "https://data-api.ecb.europa.eu/service/data";
const TIMEOUT_MS = 15_000;
const SERIE_EURIBOR_6M = "FM/M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA";
const NOME_EURIBOR_6M = "Euribor 6 mesi (media mensile)";

export interface TassoBce {
  /** Percentuale annua (es. 2.25). */
  percentuale: number;
  /** Periodo di riferimento: "YYYY-MM" per le serie mensili. */
  periodo: string;
  nome: string;
}

/**
 * L'ultima osservazione di una risposta SDMX-JSON. Se la struttura cambia si
 * vuole un errore esplicito, non un `undefined` che diventa zero da qualche
 * parte a valle.
 */
export function parseSerieBce(corpo: unknown, nome: string): TassoBce {
  const c = corpo as {
    dataSets?: { series?: Record<string, { observations?: Record<string, unknown[]> }> }[];
    structure?: { dimensions?: { observation?: { id?: string; values?: { id?: string }[] }[] } };
  } | null;
  const serie = c?.dataSets?.[0]?.series;
  const osservazioni = serie ? Object.values(serie)[0]?.observations : undefined;
  const prima = osservazioni ? Object.values(osservazioni)[0] : undefined;
  const percentuale = Array.isArray(prima) ? prima[0] : undefined;
  const tempo = c?.structure?.dimensions?.observation?.find((d) => d.id === "TIME_PERIOD");
  const periodo = tempo?.values?.[0]?.id;
  if (typeof percentuale !== "number" || typeof periodo !== "string") {
    throw new Error(
      `risposta della BCE in un formato inatteso per ${nome}: struttura della serie cambiata`,
    );
  }
  return { percentuale, periodo, nome };
}

export async function euribor6m(): Promise<TassoBce> {
  const risposta = await fetch(`${BASE}/${SERIE_EURIBOR_6M}?format=jsondata&lastNObservations=1`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!risposta.ok) {
    throw new Error(`la BCE ha risposto ${risposta.status} per ${NOME_EURIBOR_6M}`);
  }
  return parseSerieBce(await risposta.json(), NOME_EURIBOR_6M);
}
