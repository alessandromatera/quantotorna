import { anniTraActAct } from "../date";
import { rateoMaturato } from "./cedole";
import {
  esborsoNetto,
  flussiLordi,
  flussiNetti,
  tir,
  controvaloreTelQuel,
  type Flusso,
  type ParametriBond,
} from "./ytm";

/**
 * Un titolo già rimborsato non ha né duration né sensibilità: i flussi sono
 * tutti nel passato e verrebbero scontati con esponenti negativi, producendo
 * numeri che sembrano metriche e non lo sono. Stessa guardia che `ytmLordo` e
 * `ytmNetto` hanno sempre avuto; qui mancava.
 */
function scaduto(p: ParametriBond): boolean {
  return anniTraActAct(p.dataRiferimento, p.dataScadenza) <= 0;
}

/**
 * Duration e sensibilità ai tassi, sui flussi LORDI (convenzione di mercato)
 * con capitalizzazione annua composta e tempi ACT/ACT. La duration NETTA —
 * stessi conti sui flussi netti e allo YTM netto — si affianca alla lorda;
 * differisce di poco e nella
 * direzione che ci si aspetta: le cedole nette pesano meno, il rimborso di
 * più, il baricentro si sposta in avanti.
 */

export interface AnalisiDuration {
  ytmLordo: number;
  durationMacaulay: number;
  durationModificata: number;
  /** Sui flussi netti; null se lo YTM netto non esiste. */
  durationModificataNetta: number | null;
}

function macaulay(flussi: Flusso[], y: number, dataRiferimento: string): number {
  let sommaPesata = 0;
  let sommaPv = 0;
  for (const f of flussi) {
    const t = anniTraActAct(dataRiferimento, f.data);
    const pv = f.importo / (1 + y) ** t;
    sommaPesata += t * pv;
    sommaPv += pv;
  }
  return sommaPesata / sommaPv;
}

export function analisiDuration(p: ParametriBond): AnalisiDuration | null {
  if (scaduto(p)) return null;
  const flussi = flussiLordi(p);
  const y = tir(flussi, controvaloreTelQuel(p), p.dataRiferimento);
  if (y == null) return null;
  const lorda = macaulay(flussi, y, p.dataRiferimento);

  const netti = flussiNetti(p);
  const yNetto = tir(netti, esborsoNetto(p), p.dataRiferimento);
  return {
    ytmLordo: y,
    durationMacaulay: lorda,
    durationModificata: lorda / (1 + y),
    durationModificataNetta:
      yNetto == null ? null : macaulay(netti, yNetto, p.dataRiferimento) / (1 + yNetto),
  };
}

export interface PuntoSensibilita {
  /** Variazione dei tassi in punti percentuali (es. −2, −1, +0.5). */
  shock: number;
  /** Prezzo clean risultante, base 100. */
  prezzo: number;
  /** Variazione percentuale rispetto al prezzo attuale. */
  variazionePct: number;
}

/**
 * Riprezzamento completo per ogni shock parallelo dei tassi (niente
 * approssimazione lineare con la duration: si sconta ogni flusso al nuovo
 * tasso e si sottrae il rateo per tornare al prezzo clean).
 */
export function sensibilitaTassi(
  p: ParametriBond,
  shocks: number[] = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2],
): PuntoSensibilita[] | null {
  if (scaduto(p)) return null;
  const flussi = flussiLordi(p);
  const y = tir(flussi, controvaloreTelQuel(p), p.dataRiferimento);
  if (y == null) return null;
  const rateo = rateoMaturato({
    quantita: p.quantita,
    cedolaAnnua: p.cedolaAnnua,
    frequenzaCedola: p.frequenzaCedola,
    dataScadenza: p.dataScadenza,
    riferimento: p.dataRiferimento,
    gradini: p.gradiniCedola,
  });

  return shocks.map((shock) => {
    const tasso = y + shock / 100;
    const pv = flussi.reduce(
      (somma, f) =>
        somma + f.importo / (1 + tasso) ** anniTraActAct(p.dataRiferimento, f.data),
      0,
    );
    const prezzo = (pv - rateo) / p.quantita; // centesimi/nominale → base 100
    return {
      shock,
      prezzo: Math.round(prezzo * 1000) / 1000,
      variazionePct: Math.round((prezzo / p.prezzo - 1) * 10000) / 100,
    };
  });
}
