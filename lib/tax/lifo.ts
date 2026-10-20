import { arrotondaCentesimi, type Centesimi } from "../money";

/** Lotto di carico: una quantità comprata a un prezzo, in un giorno. */
export interface LottoCarico {
  id?: number;
  /** Nominale. */
  quantita: number;
  /** Base 100. */
  prezzoCarico: number;
  /** Centesimi. Commissioni pagate all'acquisto del lotto. */
  commissioni: Centesimi;
  /** Rateo pagato all'acquisto: segue pro quota la quantità venduta, come le commissioni. */
  rateoPagato?: Centesimi;
  dataAcquisto: string;
}

/**
 * Controvalore in centesimi di un nominale a un prezzo in base 100:
 * nominale × prezzo/100 euro, cioè nominale × prezzo centesimi.
 */
export function controvaloreCents(quantita: number, prezzo: number): Centesimi {
  return arrotondaCentesimi(quantita * prezzo);
}

export interface ConsumoLotto {
  lotto: LottoCarico;
  quantitaVenduta: number;
  /** Centesimi: controvalore di carico + quota commissioni del lotto. */
  costoAttribuito: Centesimi;
  rateoAttribuito: Centesimi;
}

export interface EsitoVenditaLifo {
  /** Centesimi: quantita × prezzo − commissioni di vendita. */
  corrispettivo: Centesimi;
  /** Centesimi: somma dei costi attribuiti ai lotti consumati. */
  costoFiscale: Centesimi;
  /** Centesimi, con segno: corrispettivo − costoFiscale. */
  plusMinus: Centesimi;
  consumi: ConsumoLotto[];
  /** Lotti rimasti dopo la vendita, con quantità e commissioni residue. */
  lottiResidui: LottoCarico[];
}

/**
 * Vendita (o rimborso, con prezzo 100) secondo il criterio LIFO: si
 * consumano prima i lotti acquistati più di recente. In caso di consumo
 * parziale di un lotto, le commissioni di acquisto sono attribuite
 * pro-quota (arrotondate ai centesimi) e il residuo resta sul lotto, così
 * la somma non supera mai le commissioni pagate.
 */
export function vendiLifo(params: {
  lotti: LottoCarico[];
  quantita: number;
  prezzo: number;
  /** Centesimi. */
  commissioniVendita?: Centesimi;
}): EsitoVenditaLifo {
  const { lotti, quantita, prezzo, commissioniVendita = 0 } = params;

  const totale = lotti.reduce((s, l) => s + l.quantita, 0);
  if (quantita > totale) {
    throw new Error(
      `Quantità da vendere (${quantita}) superiore al posseduto (${totale})`,
    );
  }

  // LIFO: più recente prima; a parità di data, l'inserimento più recente.
  const ordinati = lotti
    .map((l) => ({ ...l }))
    .sort(
      (a, b) =>
        b.dataAcquisto.localeCompare(a.dataAcquisto) || (b.id ?? 0) - (a.id ?? 0),
    );

  const consumi: ConsumoLotto[] = [];
  let daVendere = quantita;

  for (const lotto of ordinati) {
    if (daVendere === 0) break;
    const quantitaVenduta = Math.min(lotto.quantita, daVendere);
    const interoLotto = quantitaVenduta === lotto.quantita;
    const quotaCommissioni = interoLotto
      ? lotto.commissioni
      : arrotondaCentesimi((lotto.commissioni * quantitaVenduta) / lotto.quantita);
    const rateoAttribuito = interoLotto
      ? (lotto.rateoPagato ?? 0)
      : arrotondaCentesimi(((lotto.rateoPagato ?? 0) * quantitaVenduta) / lotto.quantita);
    consumi.push({
      lotto,
      quantitaVenduta,
      rateoAttribuito,
      costoAttribuito:
        controvaloreCents(quantitaVenduta, lotto.prezzoCarico) + quotaCommissioni,
    });
    lotto.quantita -= quantitaVenduta;
    lotto.commissioni -= quotaCommissioni;
    if (lotto.rateoPagato != null) lotto.rateoPagato -= rateoAttribuito;
    daVendere -= quantitaVenduta;
  }

  const corrispettivo = controvaloreCents(quantita, prezzo) - commissioniVendita;
  const costoFiscale = consumi.reduce((s, c) => s + c.costoAttribuito, 0);

  return {
    corrispettivo,
    costoFiscale,
    plusMinus: corrispettivo - costoFiscale,
    consumi,
    lottiResidui: ordinati.filter((l) => l.quantita > 0),
  };
}
