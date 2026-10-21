import { commissione, type TariffaMercato } from "../costi/commissioni";
import { aggiungiMesi, anniTraActAct, giorniTra } from "../date";
import { arrotondaCentesimi, type Centesimi } from "../money";
import { ALIQUOTA_AGEVOLATA } from "../tax/aliquote";
import { controvaloreCents, type LottoCarico } from "../tax/lifo";
import { calcolaVendita } from "../tax/vendita";
import type { VoceZainetto } from "../tax/zainetto";
import { cedoleLordeTra, rateoMaturato } from "./cedole";
import {
  controvaloreTelQuel,
  esborsoNetto,
  impostaDisaggioCessione,
  flussiLordi,
  prezzoTeorico,
  tir,
  type Flusso,
  type ParametriBond,
} from "./ytm";

/**
 * «E se uscissi prima?» — simulazione di una vendita anticipata.
 *
 * Lo YTM risponde a una sola domanda: quanto rende se lo tengo fino in
 * fondo. Su una scadenza lunga quella domanda è quasi sempre la sbagliata,
 * perché il rendimento realizzato a orizzonti brevi lo decide il PREZZO, non
 * la cedola. Questo modulo risponde all'altra: se esco il giorno X con i
 * tassi a quel punto, quanto ho in mano.
 *
 * Due scelte che rendono il risultato diverso da «duration × shock»:
 *
 * - riprezzamento PIENO alla data di uscita, con i flussi che nel frattempo
 *   sono stati incassati e quelli residui scontati al nuovo tasso. Alla data
 *   di uscita il titolo è più corto, quindi meno sensibile, e a curva ferma
 *   il prezzo è risalito verso la pari: il roll-down entra nel conto da solo.
 *   L'approssimazione lineare con la duration ignora entrambe le cose e su
 *   un trentennale sbaglia di parecchi punti;
 * - conto fiscale completo, con lo stesso motore delle vendite vere (LIFO,
 *   zainetto, meccanismo del 48,08%). Una minusvalenza su un BTP non è solo
 *   una perdita: è capienza fiscale che vale finché non scade.
 *
 * Ipotesi dichiarate:
 * - lo shock è PARALLELO: al titolo si applica il suo YTM di oggi più lo
 *   spostamento indicato. È una semplificazione — la curva non si muove
 *   parallela — ma su un singolo titolo ciò che conta è il punto di curva
 *   del titolo stesso, e per quello l'errore è contenuto;
 * - gli euro sono quelli che si incassano davvero senza fare altro: le
 *   cedole restano liquide, non si reinvestono. Il rendimento annuo invece è
 *   il tasso interno dei flussi, la stessa misura dello YTM: ogni cedola
 *   conta nel giorno in cui arriva. Così a scadenza, coi tassi fermi,
 *   coincide con lo YTM netto della tabella. Annualizzare il solo incasso
 *   finale, come se le cedole arrivassero tutte all'uscita, dava sul BTP
 *   2033 il 3,42% contro il 3,67% della tabella, e si leggeva come un
 *   errore;
 * - stesse convenzioni fiscali di ytm.ts: su un acquisto l'imposta sul rateo
 *   è stornata subito nell'esborso; il
 *   disaggio di emissione maturato fino all'uscita è reddito di capitale
 *   addebitato a chi vende, e per questo non entra nel capital gain, che si
 *   misura sul prezzo teorico.
 */

export interface ParametriUscita {
  /**
   * Il titolo comprato oggi al prezzo corrente (`dataRiferimento` = oggi, o
   * il regolamento se passa da `perAcquisto`): si compra adesso e si esce
   * dopo.
   */
  bond: ParametriBond;
  /** ISO: quando si esce. Oltre la scadenza vale il rimborso. */
  dataUscita: string;
  /** Spostamento parallelo dei tassi in punti percentuali (+1 = +100 bp). */
  shockPct: number;
  /** Zainetto di chi guarda, se l'ha inserito. Vuoto = nessuna compensazione. */
  zainetto?: VoceZainetto[];
  /** Quale delle due letture del 48,08% applicare (vedi plusvalenze.ts). */
  compensazioneTitoliStatoRidotta?: boolean;
  /** Centesimi: commissioni della vendita simulata. Ignorato se c'è `tariffa`. */
  commissioniVendita?: Centesimi;
  /**
   * Tariffa dell'intermediario. Se presente, la commissione di vendita è
   * calcolata sul controvalore DI QUELLO SCENARIO invece che su un importo
   * fisso: con un minimo e un massimo per eseguito, uscire da un titolo
   * crollato non costa quanto uscire da uno in guadagno.
   */
  tariffa?: TariffaMercato;
}

export interface EsitoUscita {
  /** ISO: data effettiva dell'uscita (troncata alla scadenza). */
  dataUscita: string;
  /** Anni fra oggi e l'uscita, ACT/ACT. */
  anni: number;
  /** true se l'uscita coincide con il rimborso: niente rischio prezzo. */
  aScadenza: boolean;
  /** YTM lordo di oggi, il punto di partenza dello shock. */
  ytmInizialePct: number;
  /** YTM applicato alla data di uscita. */
  ytmUscitaPct: number;
  /** Prezzo clean di rivendita, base 100. */
  prezzoUscita: number;
  /** Variazione percentuale del prezzo clean rispetto a oggi. */
  variazionePrezzoPct: number;
  /**
   * Centesimi: esborso di regolamento dell'acquisto, il «costo netto» di «Se
   * lo compro»: rateo pagato al netto dello storno, commissioni, crediti e
   * addebiti sul disaggio.
   */
  esborso: Centesimi;
  /** Centesimi: nominale al prezzo di uscita, clean (al rimborso, a 100). */
  controvaloreUscita: Centesimi;
  /** Centesimi: rateo incassato dal compratore alla vendita. */
  rateoVendita: Centesimi;
  /** Centesimi: commissioni pagate per uscire. */
  commissioniVendita: Centesimi;
  /** Centesimi: cedole lorde staccate fra oggi e l'uscita. */
  cedoleLorde: Centesimi;
  /** Centesimi: imposta sulle cedole e sul rateo di vendita. */
  impostaCedoleRateo: Centesimi;
  /**
   * Centesimi, CON SEGNO: imposta sul disaggio regolata all'uscita (vedi
   * `impostaDisaggioCessione`). Negativa su un BOT venduto prima del
   * rimborso: è l'imposta sullo scarto residuo che torna a chi vende.
   */
  impostaDisaggio: Centesimi;
  /** Centesimi con segno: plus/minus fiscale realizzata dalla vendita. */
  plusMinus: Centesimi;
  /** Centesimi: imposta sulla plusvalenza, già al netto della compensazione. */
  impostaPlusvalenza: Centesimi;
  /** Centesimi: zainetto consumato dalla plusvalenza. */
  minusvalenzeAssorbite: Centesimi;
  /** La capienza fiscale creata uscendo in perdita, se c'è. */
  minusvalenzaGenerata: {
    importo: Centesimi;
    annoCompetenza: number;
    dataScadenza: string;
  } | null;
  /**
   * Centesimi: tutto quello che si ha in mano il giorno dell'uscita. È il
   * conto delle voci qui sopra: controvalore + rateo − commissioni + cedole
   * − imposta su cedole e rateo − imposta sul disaggio − imposta sulla
   * plusvalenza.
   */
  incassoNetto: Centesimi;
  /** Centesimi con segno: incassoNetto − esborso. */
  guadagnoNetto: Centesimi;
  /**
   * Rendimento netto annuo: il tasso interno dei flussi netti (cedole nei
   * loro giorni, tutto il resto all'uscita) sull'esborso, come lo YTM. null
   * sotto il mese: su pochi giorni l'annualizzazione trasforma il rumore in
   * un tasso a tre cifre.
   */
  rendimentoAnnuoPct: number | null;
}

/** Prezzo clean, base 100, che il titolo avrebbe a `data` rendendo `tasso`. */
function prezzoCleanA(p: ParametriBond, data: string, tasso: number): number {
  const futuro: ParametriBond = { ...p, dataRiferimento: data };
  const flussi = flussiLordi(futuro);
  const valoreAttuale = flussi.reduce(
    (somma, f) => somma + f.importo / (1 + tasso) ** anniTraActAct(data, f.data),
    0,
  );
  const rateo = rateoMaturato({
    quantita: p.quantita,
    cedolaAnnua: p.cedolaAnnua,
    frequenzaCedola: p.frequenzaCedola,
    dataScadenza: p.dataScadenza,
    riferimento: data,
    gradini: p.gradiniCedola,
  });
  // centesimi sul nominale → base 100
  return (valoreAttuale - rateo) / p.quantita;
}

/** Cedole lorde staccate in (oggi, uscita]. */
function cedoleIncassate(p: ParametriBond, dataUscita: string): Centesimi {
  return cedoleLordeTra(
    {
      quantita: p.quantita,
      cedolaAnnua: p.cedolaAnnua,
      frequenzaCedola: p.frequenzaCedola,
      dataScadenza: p.dataScadenza,
      gradini: p.gradiniCedola,
    },
    p.dataRiferimento,
    dataUscita,
  ).reduce((somma, c) => somma + c.importo, 0);
}

/** Il lotto che si compra oggi. */
function lottoSimulato(p: ParametriBond): LottoCarico {
  return {
    quantita: p.quantita,
    prezzoCarico: p.prezzo,
    commissioni: p.commissioni ?? 0,
    dataAcquisto: p.dataRiferimento,
  };
}

/**
 * Un'uscita anticipata, dal prezzo di rivendita al netto in tasca.
 * null se il titolo è già scaduto o se lo YTM di partenza non esiste.
 */
export function simulaUscita(par: ParametriUscita): EsitoUscita | null {
  const { bond, shockPct } = par;
  if (anniTraActAct(bond.dataRiferimento, bond.dataScadenza) <= 0) return null;

  const ytm0 = tir(
    flussiLordi(bond),
    controvaloreTelQuel(bond),
    bond.dataRiferimento,
  );
  if (ytm0 == null) return null;

  // Oltre la scadenza non si «esce»: si viene rimborsati alla pari.
  const aScadenza = par.dataUscita >= bond.dataScadenza;
  const dataUscita = aScadenza ? bond.dataScadenza : par.dataUscita;
  const anni = anniTraActAct(bond.dataRiferimento, dataUscita);
  if (anni <= 0) return null;

  const tasso = ytm0 + shockPct / 100;
  const prezzoUscita = aScadenza ? 100 : prezzoCleanA(bond, dataUscita, tasso);

  const cedoleLorde = cedoleIncassate(bond, dataUscita);
  const rateoVendita = aScadenza
    ? 0
    : rateoMaturato({
        quantita: bond.quantita,
        cedolaAnnua: bond.cedolaAnnua,
        frequenzaCedola: bond.frequenzaCedola,
        dataScadenza: bond.dataScadenza,
        riferimento: dataUscita,
        gradini: bond.gradiniCedola,
      });
  // Cedole e rateo di vendita sono tassati per intero: lo storno dell'imposta
  // sul rateo pagato è già nell'esborso dell'acquisto.
  const redditiCapitale = cedoleLorde + rateoVendita;
  // Il disaggio maturato dall'emissione all'uscita è reddito di capitale
  // addebitato a chi vende (il credito ricevuto comprando è nell'esborso).
  // Su un BOT è il contrario: chi
  // vende si vede restituire l'imposta sullo scarto che resta, e il numero è
  // negativo.
  const impostaDisaggio = impostaDisaggioCessione(bond, dataUscita);
  const impostaCedoleRateo = arrotondaCentesimi(
    Math.max(0, redditiCapitale) * ALIQUOTA_AGEVOLATA,
  );

  /**
   * Prezzo di scarico AI FINI DEL CAPITAL GAIN: il prezzo di uscita meno il
   * disaggio maturato nel periodo di possesso, che è già tassato qui sopra
   * e per legge non entra nella plusvalenza. A scadenza diventa il prezzo
   * teorico alla data di carico, lo stesso di `capitalGainRimborso`.
   */
  const dataCarico = bond.dataCarico ?? bond.dataRiferimento;
  const prezzoScarico =
    prezzoUscita - (prezzoTeorico(bond, dataUscita) - prezzoTeorico(bond, dataCarico));

  // Il rimborso non è una compravendita sul MOT: niente commissione, come
  // nel conto di `simulaAcquisto`.
  const commissioniVendita = aScadenza
    ? 0
    : par.tariffa
      ? commissione({
          tariffa: par.tariffa,
          controvalore: controvaloreCents(bond.quantita, prezzoUscita),
        })
      : (par.commissioniVendita ?? 0);

  const vendita = calcolaVendita({
    lotti: [lottoSimulato(bond)],
    quantita: bond.quantita,
    prezzo: prezzoScarico,
    commissioniVendita,
    voci: par.zainetto ?? [],
    data: dataUscita,
  });
  // In cassa entra il prezzo di uscita vero, non quello fiscale.
  const controvaloreUscita = controvaloreCents(bond.quantita, prezzoUscita);
  const ridotta = par.compensazioneTitoliStatoRidotta ?? false;
  const tassazione = vendita.plusvalenza
    ? ridotta
      ? vendita.plusvalenza.compensazioneRidotta
      : vendita.plusvalenza.compensazionePiena
    : null;
  const nuovaMinus = vendita.nuovaMinusvalenza
    ? ridotta
      ? vendita.nuovaMinusvalenza.compensazioneRidotta
      : vendita.nuovaMinusvalenza.compensazionePiena
    : null;

  const esborso = esborsoNetto(bond);
  const incassoNetto =
    controvaloreUscita +
    rateoVendita -
    commissioniVendita +
    cedoleLorde -
    impostaCedoleRateo -
    impostaDisaggio -
    (tassazione?.imposta ?? 0);
  const guadagnoNetto = incassoNetto - esborso;
  const rendimentoAnnuo =
    giorniTra(bond.dataRiferimento, dataUscita) < GIORNI_MIN_ANNUALIZZAZIONE
      ? null
      : tir(flussiNettiUscita(bond, dataUscita, incassoNetto), esborso, bond.dataRiferimento);

  return {
    dataUscita,
    anni: Math.round(anni * 100) / 100,
    aScadenza,
    ytmInizialePct: Math.round(ytm0 * 10000) / 100,
    ytmUscitaPct: Math.round(tasso * 10000) / 100,
    prezzoUscita: Math.round(prezzoUscita * 1000) / 1000,
    variazionePrezzoPct: Math.round((prezzoUscita / bond.prezzo - 1) * 10000) / 100,
    esborso,
    controvaloreUscita,
    rateoVendita,
    commissioniVendita,
    cedoleLorde,
    impostaCedoleRateo,
    impostaDisaggio,
    plusMinus: vendita.lifo.plusMinus,
    impostaPlusvalenza: tassazione?.imposta ?? 0,
    minusvalenzeAssorbite: tassazione?.minusvalenzeAssorbite ?? 0,
    minusvalenzaGenerata: nuovaMinus
      ? {
          importo: nuovaMinus.importo,
          annoCompetenza: nuovaMinus.annoCompetenza,
          dataScadenza: nuovaMinus.dataScadenza,
        }
      : null,
    incassoNetto,
    guadagnoNetto,
    rendimentoAnnuoPct: rendimentoAnnuo == null ? null : Math.round(rendimentoAnnuo * 10000) / 100,
  };
}

/**
 * I flussi netti di un'uscita, nei loro giorni: ogni cedola staccata prima
 * dell'uscita al netto del suo 12,5%, e all'uscita tutto il resto
 * dell'incasso netto (vendita o rimborso, rateo, la cedola di quel giorno,
 * meno le altre imposte). La somma è sempre `incassoNetto`: cambia solo
 * quando arriva ogni euro.
 */
function flussiNettiUscita(
  bond: ParametriBond,
  dataUscita: string,
  incassoNetto: Centesimi,
): Flusso[] {
  const cedole = cedoleLordeTra(
    {
      quantita: bond.quantita,
      cedolaAnnua: bond.cedolaAnnua,
      frequenzaCedola: bond.frequenzaCedola,
      dataScadenza: bond.dataScadenza,
      gradini: bond.gradiniCedola,
    },
    bond.dataRiferimento,
    dataUscita,
  )
    .filter((c) => c.data < dataUscita)
    .map((c) => ({
      data: c.data,
      importo: c.importo - arrotondaCentesimi(c.importo * ALIQUOTA_AGEVOLATA),
    }));
  const giaIncassato = cedole.reduce((somma, c) => somma + c.importo, 0);
  return [...cedole, { data: dataUscita, importo: incassoNetto - giaIncassato }];
}

/** Sotto il mese l'annualizzazione dice più sul calendario che sul titolo. */
const GIORNI_MIN_ANNUALIZZAZIONE = 30;

/** Estremi della ricerca del pareggio, in punti percentuali. */
const SHOCK_MIN = -5;
const SHOCK_MAX = 15;

/**
 * L'esito della ricerca del pareggio. Tre casi e non «un numero oppure
 * null», perché fuori dall'intervallo esplorato ci sono due situazioni
 * OPPOSTE e collassarle in un trattino butterebbe via proprio la notizia
 * migliore: su una scadenza corta il pareggio manca perché non si riesce a
 * perdere, e dirlo vale più di qualunque soglia.
 */
export type Pareggio =
  /** Sopra questi punti base di rialzo, uscire a quella data è una perdita. */
  | { tipo: "soglia"; bp: number }
  /** Nessun rialzo plausibile porta in perdita: il titolo è già al riparo. */
  | { tipo: "sempreInGuadagno" }
  /** Nemmeno un crollo dei tassi salva l'uscita: si perde comunque. */
  | { tipo: "sempreInPerdita" };

/**
 * Di quanto possono salire i tassi prima che uscire a quella data sia una
 * perdita. È IL numero della domanda «posso uscire quando voglio»: la cedola
 * incassata e il roll-down maturato formano un cuscinetto che cresce col
 * tempo, e questo dice quanto è spesso oggi.
 *
 * Il guadagno netto è monotono decrescente nello shock (più tassi = prezzo
 * più basso, tutto il resto invariato), quindi la bisezione converge sempre.
 */
export function shockDiPareggio(par: ParametriUscita): Pareggio | null {
  const con = (shockPct: number) => simulaUscita({ ...par, shockPct });
  const estremoBasso = con(SHOCK_MIN);
  const estremoAlto = con(SHOCK_MAX);
  if (!estremoBasso || !estremoAlto) return null;
  if (estremoBasso.guadagnoNetto <= 0) return { tipo: "sempreInPerdita" };
  if (estremoAlto.guadagnoNetto > 0) return { tipo: "sempreInGuadagno" };

  let basso = SHOCK_MIN;
  let alto = SHOCK_MAX;
  for (let i = 0; i < 60; i++) {
    const medio = (basso + alto) / 2;
    const esito = con(medio);
    if (esito && esito.guadagnoNetto > 0) {
      basso = medio;
    } else {
      alto = medio;
    }
  }
  // In punti base, che è l'unità in cui si ragiona sui movimenti di tasso.
  return { tipo: "soglia", bp: Math.round(((basso + alto) / 2) * 100) };
}

/** Una colonna della griglia di scenari: stesso orizzonte, shock diversi. */
export interface ScenarioOrizzonte {
  /** Anni interi dall'oggi. */
  anni: number;
  dataUscita: string;
  pareggio: Pareggio | null;
  esiti: EsitoUscita[];
}

/**
 * La griglia orizzonti × shock che sta dietro alla tabella «Se esco prima».
 * Vive qui e non nella pagina: il motore calcola, la pagina mostra.
 */
export function grigliaScenari(
  par: Omit<ParametriUscita, "dataUscita" | "shockPct">,
  orizzonti: number[],
  shocks: number[],
): ScenarioOrizzonte[] {
  return orizzonti.map((anni) => {
    const dataUscita = aggiungiAnni(par.bond.dataRiferimento, anni);
    return {
      anni,
      dataUscita,
      pareggio: shockDiPareggio({ ...par, dataUscita, shockPct: 0 }),
      esiti: shocks
        .map((shockPct) => simulaUscita({ ...par, dataUscita, shockPct }))
        .filter((e): e is EsitoUscita => e != null),
    };
  });
}

/**
 * Somma anni a una data ISO. Passa da `aggiungiMesi` invece di riscrivere i
 * primi quattro caratteri: partendo da un 29 febbraio la sostituzione secca
 * produceva un giorno che non esiste ("2027-02-29"), e da lì `giorniTra`
 * restituiva NaN. `aggiungiMesi` gestisce già i mesi corti fermandosi
 * all'ultimo giorno valido.
 */
function aggiungiAnni(iso: string, anni: number): string {
  return aggiungiMesi(iso, anni * 12);
}
