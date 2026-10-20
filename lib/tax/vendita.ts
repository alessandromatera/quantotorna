import type { Centesimi } from "../money";
import { vendiLifo, type EsitoVenditaLifo, type LottoCarico } from "./lifo";
import {
  registraMinusvalenzaEntrambe,
  tassaPlusvalenzaEntrambe,
  type NuovaMinusvalenza,
  type TassazionePlusvalenza,
} from "./plusvalenze";
import type { VoceZainetto } from "./zainetto";

export interface EsitoFiscaleVendita {
  lifo: EsitoVenditaLifo;
  /**
   * Presente se la vendita realizza una plusvalenza, nelle due varianti del
   * meccanismo del 48,08%.
   */
  plusvalenza?: {
    compensazionePiena: TassazionePlusvalenza;
    compensazioneRidotta: TassazionePlusvalenza;
  };
  /**
   * Presente se la vendita realizza una minusvalenza. Due varianti come per
   * le plusvalenze, e per lo stesso motivo: la riduzione al 48,08% vale in
   * entrata nello zainetto quanto in compensazione, e va scelta la stessa
   * lettura su entrambi i lati (vedi `registraMinusvalenza`).
   */
  nuovaMinusvalenza?: {
    compensazionePiena: NuovaMinusvalenza;
    compensazioneRidotta: NuovaMinusvalenza;
  };
}

/**
 * Esito fiscale completo di una vendita o di un rimborso (prezzo 100):
 * scarico LIFO dei lotti, poi tassazione della plusvalenza in entrambe le
 * varianti di compensazione, oppure la nuova voce di zainetto se in perdita.
 */
export function calcolaVendita(params: {
  lotti: LottoCarico[];
  quantita: number;
  prezzo: number;
  /** Centesimi. */
  commissioniVendita?: Centesimi;
  voci: VoceZainetto[];
  /** ISO. */
  data: string;
}): EsitoFiscaleVendita {
  const { lotti, quantita, prezzo, commissioniVendita, voci, data } = params;
  const lifo = vendiLifo({ lotti, quantita, prezzo, commissioniVendita });

  if (lifo.plusMinus > 0) {
    return {
      lifo,
      plusvalenza: tassaPlusvalenzaEntrambe({
        plusvalenza: lifo.plusMinus,
        voci,
        data,
      }),
    };
  }
  if (lifo.plusMinus < 0) {
    return {
      lifo,
      nuovaMinusvalenza: registraMinusvalenzaEntrambe({
        minusvalenza: -lifo.plusMinus,
        annoVendita: Number(data.slice(0, 4)),
      }),
    };
  }
  return { lifo };
}
