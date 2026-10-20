import { arrotondaCentesimi, type Centesimi } from "../money";
import { ALIQUOTA_ORDINARIA, QUOTA_IMPONIBILE_TITOLI_STATO } from "./aliquote";
import {
  compensa,
  scadenzaMinusvalenza,
  type VoceZainetto,
} from "./zainetto";

export interface TassazionePlusvalenza {
  plusvalenza: Centesimi;
  /** Zainetto consumato da questa plusvalenza. */
  minusvalenzeAssorbite: Centesimi;
  /** Base su cui si applica il 26% dopo riduzione e compensazione. */
  imponibile: Centesimi;
  imposta: Centesimi;
  /** imposta / plusvalenza. */
  aliquotaEffettiva: number;
  dettaglioAssorbimento: { annoCompetenza: number; usato: Centesimi }[];
  zainettoDopo: VoceZainetto[];
}

/**
 * Tassa una plusvalenza REALIZZATA (vendita o rimborso) su un titolo di
 * Stato o assimilato: reddito diverso, compensabile con lo zainetto, base
 * imponibile al 48,08%. Il momento in cui avviene la compensazione dipende
 * da `compensazioneTitoliStatoRidotta`:
 *   false (default) → lo zainetto compensa il 100% della plusvalenza,
 *                     il 48,08% si applica solo alla parte scoperta;
 *   true            → il 48,08% si applica prima, lo zainetto compensa
 *                     la base già ridotta.
 * La normativa non è univoca: la pagina mostra entrambe le varianti.
 */
export function tassaPlusvalenza(params: {
  /** Centesimi, > 0. Per le minusvalenze usare registraMinusvalenza. */
  plusvalenza: Centesimi;
  voci: VoceZainetto[];
  /** ISO. Data dell'operazione: decide quali voci sono ancora utilizzabili. */
  data: string;
  compensazioneTitoliStatoRidotta: boolean;
}): TassazionePlusvalenza {
  const { plusvalenza, voci, data, compensazioneTitoliStatoRidotta } = params;
  if (plusvalenza < 0) {
    throw new Error("tassaPlusvalenza richiede un importo positivo");
  }

  let imponibile: Centesimi;
  let esito;
  if (compensazioneTitoliStatoRidotta) {
    // Prima la riduzione al 48,08%, poi la compensazione sulla base ridotta.
    const baseRidotta = arrotondaCentesimi(
      plusvalenza * QUOTA_IMPONIBILE_TITOLI_STATO,
    );
    esito = compensa(voci, baseRidotta, data);
    imponibile = esito.nonCompensato;
  } else {
    // Compensazione sul 100%, riduzione al 48,08% solo sulla parte scoperta.
    esito = compensa(voci, plusvalenza, data);
    imponibile = arrotondaCentesimi(
      esito.nonCompensato * QUOTA_IMPONIBILE_TITOLI_STATO,
    );
  }

  const imposta = arrotondaCentesimi(imponibile * ALIQUOTA_ORDINARIA);
  return {
    plusvalenza,
    minusvalenzeAssorbite: esito.assorbito,
    imponibile,
    imposta,
    aliquotaEffettiva: plusvalenza === 0 ? 0 : imposta / plusvalenza,
    dettaglioAssorbimento: esito.dettaglio,
    zainettoDopo: esito.vociAggiornate,
  };
}

/** Le due varianti affiancate. Senza zainetto coincidono. */
export function tassaPlusvalenzaEntrambe(params: {
  plusvalenza: Centesimi;
  voci: VoceZainetto[];
  data: string;
}): {
  compensazionePiena: TassazionePlusvalenza;
  compensazioneRidotta: TassazionePlusvalenza;
} {
  return {
    compensazionePiena: tassaPlusvalenza({
      ...params,
      compensazioneTitoliStatoRidotta: false,
    }),
    compensazioneRidotta: tassaPlusvalenza({
      ...params,
      compensazioneTitoliStatoRidotta: true,
    }),
  };
}

export interface NuovaMinusvalenza {
  annoCompetenza: number;
  /** Centesimi. Quanto entra nello zainetto. */
  importo: Centesimi;
  dataScadenza: string;
}

/**
 * Minusvalenza realizzata → nuova voce dello zainetto.
 *
 * LA RIDUZIONE AL 48,08% VALE SU ENTRAMBI I LATI, O SU NESSUNO.
 *
 * Il DM 13/12/2011 riduce al 48,08% la base imponibile dei redditi diversi
 * da titoli di Stato. Se quella riduzione la si applica alle plusvalenze,
 * va applicata anche alle minusvalenze che entrano nello zainetto; se la si
 * applica solo a un lato, lo zainetto non torna. Per questo il flag è lo
 * STESSO che governa `tassaPlusvalenza`:
 *
 *   true  → minus ridotta al 48,08% in entrata, plus ridotta prima della
 *           compensazione. Lettura simmetrica del DM.
 *   false → minus al 100% in entrata, plus compensata al 100% e ridotta
 *           solo sulla parte scoperta. Lettura di chi compensa a valore
 *           pieno; simmetrica anch'essa, sull'altro valore.
 *
 * La combinazione mista (minus ridotta, plus compensata al 100%) tasserebbe
 * una perdita e un guadagno di pari importo — 64,90 € su 1.000 € contro
 * 1.000 € — e non corrisponde a nessuna delle due letture.
 */
export function registraMinusvalenza(params: {
  /** Centesimi, valore assoluto della perdita. */
  minusvalenza: Centesimi;
  annoVendita: number;
  compensazioneTitoliStatoRidotta: boolean;
}): NuovaMinusvalenza {
  const { minusvalenza, annoVendita, compensazioneTitoliStatoRidotta } = params;
  if (minusvalenza < 0) {
    throw new Error("registraMinusvalenza richiede il valore assoluto della perdita");
  }
  const importo = compensazioneTitoliStatoRidotta
    ? arrotondaCentesimi(minusvalenza * QUOTA_IMPONIBILE_TITOLI_STATO)
    : minusvalenza;
  return {
    annoCompetenza: annoVendita,
    importo,
    dataScadenza: scadenzaMinusvalenza(annoVendita),
  };
}

/** Le due varianti affiancate, come `tassaPlusvalenzaEntrambe`. */
export function registraMinusvalenzaEntrambe(params: {
  minusvalenza: Centesimi;
  annoVendita: number;
}): {
  compensazionePiena: NuovaMinusvalenza;
  compensazioneRidotta: NuovaMinusvalenza;
} {
  return {
    compensazionePiena: registraMinusvalenza({
      ...params,
      compensazioneTitoliStatoRidotta: false,
    }),
    compensazioneRidotta: registraMinusvalenza({
      ...params,
      compensazioneTitoliStatoRidotta: true,
    }),
  };
}
