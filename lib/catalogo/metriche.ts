import { analisiDuration } from "../bond/durata";
import {
  capitalGainRimborso,
  isScartoAnticipato,
  rendimentoNetto,
  rendimentoSuCapitale,
  ytmLordo,
  ytmNetto,
  ytmNettoSenzaCapitalGain,
  type ParametriBond,
} from "../bond/ytm";
import type { CategoriaStrumento } from "../categorie";
import { inflazionePareggio } from "../costi/inflazione";
import { giorniTra } from "../date";
import type { Centesimi } from "../money";
import { soloRendimentiAccettabili } from "../mercato/ammissibili";
import { completa, type EmissioneSalvata } from "../mercato/emissioni";
import {
  parametriAcquistoCatalogo,
  type DatiEmissione,
} from "../mercato/parametri";
import type { Catalogo, TitoloCatalogo } from "./formato";

/**
 * Il catalogo con le metriche del motore, come le mostra la tabella: per un
 * acquisto di oggi — il giorno dei prezzi — di 10.000 nominali al prezzo di
 * chiusura, senza commissioni. Nominale, prezzo e commissioni diversi li
 * sceglie chi guarda, e il browser rifà gli stessi conti con le stesse
 * funzioni (lib/bond/acquisto.ts, lib/bond/whatif.ts).
 *
 * Tre elenchi separati, perché sono tre modelli diversi e mescolarli
 * metterebbe un rendimento nominale, uno reale e un «non calcolabile» nella
 * stessa colonna:
 *
 * - `flussiNoti`: tasso fisso, step-up, strip e BOT, i cui incassi sono
 *   certi già oggi. Strip e BOT stanno qui perché il motore li calcola bene;
 *   quello che cambia è la natura del guadagno, segnalata riga per riga da
 *   `plusCompensabile`;
 * - `variabili`: CCTeu, con la cedola ricostruita dall'Euribor di oggi e il
 *   rendimento nell'ipotesi dichiarata che resti lì;
 * - `indicizzati`: BTP€i e BTP Italia. Sui BTP€i il MOT quota il prezzo
 *   REALE e il nome porta la cedola REALE: gli stessi flussi danno un
 *   rendimento reale, affiancato al tasso fisso di scadenza più vicina per
 *   ricavarne l'inflazione di pareggio. Sui BTP Italia non c'è un rendimento
 *   a scadenza da calcolare, e la riga lo dice.
 *
 * Modulo puro: gira alla compilazione del sito e nei test.
 */

/** Il nominale su cui la tabella misura plusvalenze e rendimenti in euro. */
export const NOMINALE_RIFERIMENTO = 10_000;

/** Centesimi: i 10.000 euro su cui si misura il «netto a scadenza». */
export const CAPITALE_RIFERIMENTO = 1_000_000;

/**
 * Distanza massima fra le scadenze per accostare un BTP€i a un titolo a
 * tasso fisso. Il pareggio confronta due curve alla STESSA scadenza: oltre
 * un anno e mezzo di scarto il numero misurerebbe soprattutto la pendenza
 * della curva, non le aspettative di inflazione.
 */
export const SCARTO_MAX_GIORNI = 548;

/**
 * Orizzonte minimo per calcolare un pareggio. Sotto l'anno il rendimento di
 * un indicizzato è dominato dal ritardo con cui l'indice dei prezzi entra
 * nella rivalutazione e dal rateo, non dalle attese di inflazione: ne
 * escono pareggi vicini a zero o negativi che si leggerebbero come un
 * segnale forte e invece sono rumore.
 */
const ORIZZONTE_MIN_ANNI = 1;

/** Un titolo con i suoi dati di emissione: tutto quello che serve al motore. */
export interface TitoloValutato extends TitoloCatalogo {
  /** Null se mai cercati; valori null se cercati senza successo. */
  emissione: EmissioneSalvata | null;
}

/** Una riga a flussi noti con quello che la tabella mostra. */
export interface RigaFlussiNoti extends TitoloValutato {
  /** Categoria fiscale, risolta una volta sola (lib/mercato/parametri.ts). */
  categoria: CategoriaStrumento;
  /**
   * Un BOT con prezzo e data d'asta: scarto tassato in anticipo, e la parte
   * fra prezzo teorico e prezzo pagato è plusvalenza (lib/bond/ytm.ts).
   */
  scartoAnticipato: boolean;
  /** false sugli strip italiani e sui BOT senza dati d'asta: il differenziale è scarto. */
  plusCompensabile: boolean;
  ytmNettoPct: number | null;
  ytmLordoPct: number | null;
  /** Senza l'imposta sulla plusvalenza a rimborso: chi ha zainetto da consumare. */
  ytmNettoSenzaCgPct: number | null;
  durationModificata: number | null;
  durationModificataNetta: number | null;
  /**
   * Centesimi, CON SEGNO, su 10.000 nominali: differenziale certo fra prezzo
   * teorico e prezzo pagato. Sotto la pari è una plusvalenza che assorbe lo
   * zainetto; sopra la pari una minusvalenza certa che lo alimenta.
   */
  plusRimborso10k: Centesimi;
  /** Centesimi: imposta su quel differenziale, senza zainetto. */
  imposta10kSenzaZainetto: Centesimi;
  /** Centesimi guadagnati sui 10.000 nominali: totale, per anno, e su quanti anni. */
  rendimento10k: { totale: Centesimi; annuo: Centesimi; anni: number } | null;
  /** Centesimi: quanto si ritrova a scadenza chi spende oggi 10.000 €. */
  netto10kInvestiti: { incassi: Centesimi; guadagno: Centesimi; guadagnoAnnuo: Centesimi } | null;
}

export interface RigaVariabile extends TitoloValutato {
  categoria: CategoriaStrumento;
  anniResidui: number;
  /** Euribor 6m + spread; null senza l'uno o l'altro. */
  cedolaStimata: number | null;
  ytmNettoPct: number | null;
  ytmLordoPct: number | null;
  /** Perché manca il rendimento, se manca. */
  motivoNonCalcolabile: string | null;
}

export interface RigaIndicizzata extends TitoloValutato {
  categoria: CategoriaStrumento;
  anniResidui: number;
  ytmRealeLordoPct: number | null;
  confronto: {
    isin: string;
    nome: string;
    dataScadenza: string;
    ytmNominaleLordoPct: number;
    pareggioPct: number;
    scartoGiorni: number;
  } | null;
  motivoNonCalcolabile: string | null;
}

export interface MetricheCatalogo {
  /** Il giorno dei prezzi, a cui sono fatti i conti. */
  data: string;
  flussiNoti: RigaFlussiNoti[];
  variabili: RigaVariabile[];
  indicizzati: RigaIndicizzata[];
  /** Titoli tolti dall'elenco perché a scadenza rendono meno di quanto costano. */
  nascostiYtmNegativo: number;
  /** Titoli a tasso fisso in elenco senza dati di emissione: trattati come emessi alla pari. */
  senzaEmissione: number;
}

export function metricheCatalogo(catalogo: Catalogo): MetricheCatalogo {
  const oggi = catalogo.data;
  // Un titolo che scade il giorno dei prezzi o prima non si compra più.
  const vivi: TitoloValutato[] = catalogo.titoli
    .filter((t) => t.dataScadenza > oggi)
    .sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza) || a.isin.localeCompare(b.isin))
    .map((t) => ({ ...t, emissione: catalogo.emissioni[t.isin] ?? null }));

  const conFlussiNoti = vivi
    .filter((t) => t.tipo === "fisso" || t.tipo === "stepUp" || t.tipo === "zeroCoupon" || t.tipo === "bot")
    .map((t) => rigaFlussiNoti(t, oggi));

  /**
   * Chi rende meno di zero al netto non entra in tabella: a scadenza
   * restituisce meno di quanto costa oggi, imposte comprese (vedi
   * lib/mercato/ammissibili.ts). Quanti sono lo dice `nascostiYtmNegativo`.
   *
   * Lo scarto avviene PRIMA di scegliere i riferimenti per il pareggio: un
   * BTP€i non si confronta con un gemello che la pagina non mostra.
   */
  const flussiNoti = soloRendimentiAccettabili(conFlussiNoti);

  /**
   * Riferimenti per il pareggio: solo titoli con cedola e YTM lordo. Gli
   * strip restano fuori non per il fisco — il pareggio si misura sul lordo —
   * ma perché scambiano poco e il loro rendimento può essere fuori mercato.
   */
  const riferimenti = flussiNoti.filter(
    (t): t is RigaFlussiNoti & { ytmLordoPct: number } => t.tipo === "fisso" && t.ytmLordoPct != null,
  );

  const variabili = soloRendimentiAccettabili(
    vivi.filter((t) => t.tipo === "ccteu").map((t) => rigaVariabile(t, oggi, catalogo.euribor6m)),
  );

  const indicizzati = vivi
    .filter((t) => t.tipo === "indicizzatoEuro" || t.tipo === "italia")
    .map((t) => rigaIndicizzata(t, oggi, riferimenti));

  return {
    data: oggi,
    flussiNoti,
    variabili,
    indicizzati,
    nascostiYtmNegativo:
      conFlussiNoti.length - flussiNoti.length +
      (vivi.filter((t) => t.tipo === "ccteu").length - variabili.length),
    senzaEmissione: flussiNoti.filter((t) => t.tipo === "fisso" && !completa(t.emissione ?? undefined))
      .length,
  };
}

/** Prezzo e data di emissione nella forma che vuole il motore. */
export function datiEmissione(t: TitoloValutato): DatiEmissione | undefined {
  const e = t.emissione;
  if (!e) return undefined;
  return {
    ...(e.prezzoEmissione != null ? { prezzoEmissione: e.prezzoEmissione } : {}),
    ...(e.dataEmissione != null ? { dataEmissione: e.dataEmissione } : {}),
  };
}

/**
 * I parametri del motore per comprare il titolo il giorno `oggi`: lo stesso
 * punto d'ingresso per la tabella, la simulazione d'acquisto e «Se esco
 * prima», così i tre conti partono dagli stessi numeri.
 */
export function parametriTitolo(
  t: TitoloValutato,
  oggi: string,
  quantita = NOMINALE_RIFERIMENTO,
  prezzo = t.prezzo,
): ParametriBond {
  return parametriAcquistoCatalogo({ ...t, prezzo }, oggi, datiEmissione(t), quantita);
}

function rigaFlussiNoti(t: TitoloValutato, oggi: string): RigaFlussiNoti {
  const parametri = parametriTitolo(t, oggi);
  const duration = analisiDuration(parametri);
  const rendimento = rendimentoNetto(parametri);
  const scartoAnticipato = isScartoAnticipato(parametri);
  const capitalGain = capitalGainRimborso(parametri);
  return {
    ...t,
    categoria: parametri.categoria,
    scartoAnticipato,
    // Sui BOT con i dati d'asta è compensabile la parte fra prezzo teorico
    // e prezzo pagato: lo scarto resta fuori, ed è già nel prezzo teorico.
    // Sugli strip italiani e sui BOT senza dati tutto è scarto.
    plusCompensabile: parametri.categoria !== "bot" || scartoAnticipato,
    ytmNettoPct: pct(ytmNetto(parametri)),
    ytmLordoPct: pct(duration?.ytmLordo ?? null),
    ytmNettoSenzaCgPct: pct(ytmNettoSenzaCapitalGain(parametri)),
    durationModificata: duration ? arrotonda2(duration.durationModificata) : null,
    durationModificataNetta:
      duration?.durationModificataNetta != null ? arrotonda2(duration.durationModificataNetta) : null,
    plusRimborso10k: capitalGain.plusvalenza,
    imposta10kSenzaZainetto: capitalGain.imposta,
    rendimento10k: rendimento
      ? {
          totale: rendimento.guadagnoNetto,
          annuo: rendimento.guadagnoNettoAnnuo,
          anni: rendimento.anniResidui,
        }
      : null,
    netto10kInvestiti: rendimento ? rendimentoSuCapitale(rendimento, CAPITALE_RIFERIMENTO) : null,
  };
}

/**
 * Tasso variabile. La cedola è Euribor 6m + spread e il listino pubblica solo
 * lo spread (nel nome): con l'Euribor della BCE la cedola in corso si
 * ricostruisce, e da lì il rendimento a scadenza — NELL'IPOTESI che l'Euribor
 * resti dov'è per tutta la vita residua. È un'ipotesi falsa, e per questo la
 * pagina la scrive accanto: un CCTeu esiste per proteggere da tassi che si
 * muovono. Serve a metterlo su una scala confrontabile col tasso fisso, non a
 * prevederne il rendimento.
 */
function rigaVariabile(
  t: TitoloValutato,
  oggi: string,
  euribor: Catalogo["euribor6m"],
): RigaVariabile {
  const cedolaStimata =
    euribor != null && t.spread != null
      ? Math.round((euribor.percentuale + t.spread) * 1000) / 1000
      : null;
  // La cedola stimata entra PRIMA di calcolare il rateo: nel listino un
  // CCTeu ha cedola zero, e un rateo calcolato su zero sarebbe zero. Il
  // regolamento a T+2 c'è già (`parametriTitolo` passa da `perAcquisto`):
  // ripassarci sposterebbe i conti a T+4.
  const parametri =
    cedolaStimata != null && cedolaStimata > 0
      ? { ...parametriTitolo(t, oggi), cedolaAnnua: cedolaStimata }
      : null;
  return {
    ...t,
    categoria: "ccteu",
    anniResidui: anniResidui(oggi, t.dataScadenza),
    cedolaStimata,
    ytmNettoPct: parametri ? pct(ytmNetto(parametri)) : null,
    ytmLordoPct: parametri ? pct(ytmLordo(parametri)) : null,
    motivoNonCalcolabile:
      euribor == null
        ? "cedola agganciata all'Euribor 6m, che oggi non si è potuto leggere dalla BCE"
        : t.spread == null
          ? "spread sull'Euribor non riconosciuto dal nome del titolo: senza quello la cedola non si ricostruisce"
          : parametri == null
            ? "Euribor più spread non positivo: la cedola sarebbe zero"
            : null,
  };
}

function rigaIndicizzata(
  t: TitoloValutato,
  oggi: string,
  riferimenti: (RigaFlussiNoti & { ytmLordoPct: number })[],
): RigaIndicizzata {
  const comune = {
    ...t,
    categoria: (t.tipo === "italia" ? "btpItalia" : "btpFisso") as CategoriaStrumento,
    anniResidui: anniResidui(oggi, t.dataScadenza),
  };
  if (t.tipo === "italia") {
    return {
      ...comune,
      ytmRealeLordoPct: null,
      confronto: null,
      motivoNonCalcolabile:
        "la rivalutazione FOI è pagata per cassa a ogni cedola e a scadenza c'è il premio fedeltà: il rendimento dipende dall'inflazione futura, non è calcolabile dal prezzo",
    };
  }
  // BTP€i: prezzo e cedola sono reali, quindi il TIR degli stessi flussi È il
  // rendimento reale. Lordo di proposito: vedi `inflazionePareggio`.
  const ytmReale = pct(ytmLordo(parametriTitolo(t, oggi)));
  const troppoVicino = comune.anniResidui < ORIZZONTE_MIN_ANNI;
  // Il confronto resta DENTRO lo stesso emittente: un BTP€i contro un Bund
  // misurerebbe soprattutto lo spread di credito Italia-Germania, non le
  // attese di inflazione.
  const gemello = troppoVicino
    ? null
    : piuVicinoPerScadenza(
        riferimenti.filter((r) => r.emittente === t.emittente),
        t.dataScadenza,
      );
  return {
    ...comune,
    ytmRealeLordoPct: ytmReale,
    confronto:
      ytmReale != null && gemello
        ? {
            isin: gemello.isin,
            nome: gemello.nome,
            dataScadenza: gemello.dataScadenza,
            ytmNominaleLordoPct: gemello.ytmLordoPct,
            pareggioPct: arrotonda2(inflazionePareggio(gemello.ytmLordoPct, ytmReale)),
            scartoGiorni: Math.abs(giorniTra(t.dataScadenza, gemello.dataScadenza)),
          }
        : null,
    motivoNonCalcolabile:
      ytmReale == null
        ? "rendimento reale non calcolabile da questo prezzo"
        : troppoVicino
          ? "scade entro l'anno: su questo orizzonte il pareggio misura il ritardo dell'indicizzazione, non le attese di inflazione"
          : gemello
            ? null
            : `nessun titolo a tasso fisso dello stesso emittente in elenco entro ${SCARTO_MAX_GIORNI} giorni da questa scadenza: confrontarlo con un altro emittente misurerebbe lo spread di credito, non l'inflazione`,
  };
}

/** Il titolo di scadenza più vicina, se rientra nella tolleranza. */
function piuVicinoPerScadenza<T extends { dataScadenza: string }>(
  candidati: T[],
  scadenza: string,
): T | null {
  let migliore: T | null = null;
  let minimo = Infinity;
  for (const c of candidati) {
    const scarto = Math.abs(giorniTra(scadenza, c.dataScadenza));
    if (scarto < minimo) {
      minimo = scarto;
      migliore = c;
    }
  }
  return minimo <= SCARTO_MAX_GIORNI ? migliore : null;
}

function anniResidui(oggi: string, scadenza: string): number {
  return arrotonda2(giorniTra(oggi, scadenza) / 365);
}

function arrotonda2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Frazione → percentuale a due decimali. */
export function pct(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10000) / 100;
}
