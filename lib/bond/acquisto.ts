import { commissione, type TariffaMercato } from "../costi/commissioni";
import type { Centesimi } from "../money";
import { controvaloreCents } from "../tax/lifo";
import { primaCedolaCorta } from "./cedole";
import {
  capitalGainRimborso,
  cedolare,
  cedoleFuture,
  creditoDisaggio,
  esborsoNetto,
  impostaDisaggioCessione,
  impostaScartoAcquisto,
  rateoAllaData,
  rendimentoNetto,
  stornoImpostaRateo,
  ytmLordo,
  ytmNetto,
  ytmNettoSenzaCapitalGain,
  type Cedola,
  type ParametriBond,
} from "./ytm";

/**
 * Un acquisto simulato, con il conto che si vedrebbe al regolamento e TUTTI
 * i suoi rendimenti, calcolati dal motore sullo stesso costo: YTM netto
 * (commissioni comprese), lordo, netto senza l'imposta sulla plusvalenza; in
 * euro le cedole nette, il rimborso netto e il guadagno.
 *
 * Nominale, prezzo e tariffa li sceglie chi guarda: gira nel browser, e
 * niente di quello che si scrive esce dalla pagina.
 */
export interface Simulazione {
  nominale: number;
  prezzo: number;
  dataRegolamento: string;
  dataScadenza: string;
  /** Centesimi, come tutti gli importi qui sotto. */
  controvalore: Centesimi;
  rateo: Centesimi;
  commissioni: Centesimi;
  stornoRateo: Centesimi;
  creditoDisaggio: Centesimi;
  impostaScarto: Centesimi;
  /** Quanto esce dal conto al regolamento, prima dei crediti d'imposta. */
  addebito: Centesimi;
  /** L'addebito con i crediti d'imposta scalati: la base dello YTM netto. */
  costoNetto: Centesimi;
  /** Percentuali a due decimali; null dove il motore non converge. */
  ytmNettoPct: number | null;
  ytmLordoPct: number | null;
  ytmNettoSenzaCgPct: number | null;
  cedole: {
    numero: number;
    /** La prossima: su uno step-up le successive crescono (vedi `gruppi`). */
    lordaPeriodo: Centesimi;
    nettaPeriodo: Centesimi;
    totaleNetto: Centesimi;
    perAnno: number;
    /**
     * La prossima è la prima del titolo, ed è corta: matura dal godimento.
     * È il primo gruppo, da sola.
     */
    primaCorta: boolean;
    /**
     * Cedole consecutive uguali: più di un gruppo sugli step-up e dopo una
     * prima cedola corta.
     */
    gruppi: { numero: number; lorda: Centesimi; netta: Centesimi; dal: string }[];
  };
  rimborso: {
    lordo: Centesimi;
    plusvalenza: Centesimi;
    impostaPlusvalenza: Centesimi;
    impostaDisaggio: Centesimi;
    netto: Centesimi;
  };
  rendimento: {
    incassiNetti: Centesimi;
    guadagnoNetto: Centesimi;
    guadagnoNettoAnnuo: Centesimi;
    anniResidui: number;
  } | null;
}

/**
 * `base` è il titolo comprato, già regolato (`perAcquisto`, o
 * `parametriTitolo` per una riga del catalogo) con il nominale e il prezzo
 * scelti. Null se scade prima del regolamento: non c'è niente da calcolare.
 */
export function simulaAcquisto(base: ParametriBond, tariffa: TariffaMercato): Simulazione | null {
  if (base.dataRiferimento >= base.dataScadenza) return null;
  const controvalore = controvaloreCents(base.quantita, base.prezzo);
  const p: ParametriBond = { ...base, commissioni: commissione({ tariffa, controvalore }) };
  const rateo = rateoAllaData(p);
  const rendimento = rendimentoNetto(p);
  // Gli incassi da qui a scadenza, divisi fra cedole e rimborso: la loro
  // somma è `rendimento.incassiNetti`, cioè gli stessi flussi dello YTM.
  const cedole = cedoleFuture(p);
  const plus = capitalGainRimborso(p);
  const impostaDisaggio = impostaDisaggioCessione(p);
  const rimborsoLordo = controvaloreCents(p.quantita, 100);
  return {
    nominale: p.quantita,
    prezzo: p.prezzo,
    dataRegolamento: p.dataRiferimento,
    dataScadenza: p.dataScadenza,
    controvalore,
    rateo,
    commissioni: p.commissioni ?? 0,
    stornoRateo: stornoImpostaRateo(p),
    creditoDisaggio: creditoDisaggio(p),
    impostaScarto: impostaScartoAcquisto(p),
    addebito: controvalore + rateo + (p.commissioni ?? 0),
    costoNetto: esborsoNetto(p),
    ytmNettoPct: pct(ytmNetto(p)),
    ytmLordoPct: pct(ytmLordo(p)),
    ytmNettoSenzaCgPct: pct(ytmNettoSenzaCapitalGain(p)),
    cedole: {
      numero: cedole.length,
      lordaPeriodo: cedole[0]?.lorda ?? 0,
      nettaPeriodo: cedole[0]?.netta ?? 0,
      totaleNetto: cedole.reduce((somma, c) => somma + c.netta, 0),
      perAnno: p.frequenzaCedola,
      primaCorta: cedole.length > 0 && cedole[0].data === primaCedolaCorta(cedolare(p)),
      gruppi: gruppiDiCedole(cedole),
    },
    rimborso: {
      lordo: rimborsoLordo,
      plusvalenza: plus.plusvalenza,
      impostaPlusvalenza: plus.imposta,
      impostaDisaggio,
      netto: rimborsoLordo - plus.imposta - impostaDisaggio,
    },
    rendimento: rendimento && {
      incassiNetti: rendimento.incassiNetti,
      guadagnoNetto: rendimento.guadagnoNetto,
      guadagnoNettoAnnuo: rendimento.guadagnoNettoAnnuo,
      anniResidui: rendimento.anniResidui,
    },
  };
}

function gruppiDiCedole(cedole: Cedola[]): Simulazione["cedole"]["gruppi"] {
  const gruppi: Simulazione["cedole"]["gruppi"] = [];
  for (const c of cedole) {
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.lorda === c.lorda) ultimo.numero++;
    else gruppi.push({ numero: 1, lorda: c.lorda, netta: c.netta, dal: c.data });
  }
  return gruppi;
}

function pct(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10000) / 100;
}
