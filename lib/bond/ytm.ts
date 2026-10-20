import type { CategoriaStrumento } from "../categorie";
import { anniTraActAct, dataRegolamento, giorniTra } from "../date";
import { arrotondaCentesimi, type Centesimi } from "../money";
import {
  ALIQUOTA_AGEVOLATA,
  ALIQUOTA_ORDINARIA,
  QUOTA_IMPONIBILE_TITOLI_STATO,
} from "../tax/aliquote";
import { controvaloreCents } from "../tax/lifo";
import {
  cedoleLordeTra,
  rateoMaturato,
  type GradinoCedola,
} from "./cedole";

/**
 * Rendimento a scadenza di un titolo di Stato, con le convenzioni di Borsa
 * Italiana — così i numeri si possono controllare senza dover spiegare le
 * differenze.
 *
 * Ipotesi documentate:
 * - attualizzazione ACT/ACT, capitalizzazione annua composta;
 * - per i CCTeu le cedole future sono assunte costanti pari all'ultima nota;
 * - sugli step-up (BTP Valore, Più, Futura) ogni cedola è quella del suo
 *   gradino (`gradiniCedola`); il premio fedeltà NON entra, perché spetta
 *   solo a chi ha sottoscritto all'emissione e tiene il titolo fino alla
 *   scadenza: chi compra sul mercato non lo riceve mai, come non può
 *   esercitare il rimborso anticipato del BTP Più;
 * - un ACQUISTO (`acquisto: true`, vedi `perAcquisto`) si valuta alla data
 *   di REGOLAMENTO: l'esborso è il tel quel più le commissioni, MENO lo storno
 *   dell'imposta sul rateo e il credito sul disaggio già maturato, che il
 *   sostituto d'imposta accredita subito (DLgs 239/96, regime del «conto
 *   unico» dei titoli di Stato). Le cedole successive sono tassate per
 *   intero;
 * - il DISAGGIO di emissione (rimborso sopra il prezzo di emissione) è
 *   reddito di capitale: a rimborso viene addebitata l'imposta sull'intero
 *   disaggio, e chi compra sul secondario riceve all'acquisto il credito
 *   sulla parte maturata prima di lui. Senza prezzo e data di emissione il
 *   titolo è trattato come emesso alla pari;
 * - sui BOT lo SCARTO di emissione è tassato in anticipo, all'asta: chi
 *   compra sul secondario rimborsa a chi vende l'imposta sul tratto che
 *   resta fino alla scadenza, e a scadenza non paga più nulla. La differenza
 *   fra il prezzo teorico e il prezzo pagato è invece reddito DIVERSO, come
 *   su un BTP: plusvalenza compensabile o minusvalenza che va nello zainetto
 *   (art. 68 c. 7 TUIR). Senza prezzo e data di emissione resta il modello
 *   semplificato: l'intero differenziale da carico a 100 come scarto,
 *   tassato al 12,5% a scadenza e fuori dallo zainetto — vedi
 *   `isScartoAnticipato`;
 * - la plusvalenza a rimborso è misurata sul PREZZO TEORICO alla data di
 *   carico (emissione più disaggio maturato fino a lì), non su 100: il
 *   disaggio è già tassato come reddito di capitale e non può esserlo due
 *   volte (art. 68 c. 7 TUIR). Sul prezzo di CARICO — quella che pagherai
 *   davvero — senza considerare lo zainetto: la compensazione dipende dallo
 *   zainetto di chi compra, e si misura in euro, non nel tasso (vedi
 *   `ytmNettoSenzaCapitalGain`);
 * - un rimborso sotto il carico non genera crediti nello YTM;
 * - su un titolo GIÀ posseduto (`acquisto` assente) l'esborso è il valore
 *   tel quel di oggi e i crediti di allora sono già stati incassati: le
 *   cedole future sono tassate per intero.
 */
export interface ParametriBond {
  categoria: CategoriaStrumento;
  /** Nominale. */
  quantita: number;
  /** Prezzo corrente clean, base 100. */
  prezzo: number;
  /** Prezzo di carico fiscale, base 100. */
  prezzoCarico: number;
  /** Percentuale annua. Su uno step-up, quella del periodo in corso. */
  cedolaAnnua: number;
  frequenzaCedola: number;
  /**
   * Piano di uno step-up: con questo ogni cedola, e il rateo, vanno al tasso
   * del proprio periodo e `cedolaAnnua` non entra nei conti.
   */
  gradiniCedola?: GradinoCedola[];
  dataScadenza: string;
  /** ISO: data a cui valutare (per un acquisto, la data di regolamento). */
  dataRiferimento: string;
  /** Centesimi: commissioni di un eventuale acquisto (solo YTM netto). */
  commissioni?: Centesimi;
  /**
   * Centesimi: rateo lordo effettivamente pagato, quando è noto (per esempio
   * se l'intermediario lo conta su un'altra data valuta). Sostituisce quello
   * calcolato ACT/ACT alla data di riferimento, e con lui lo storno
   * dell'imposta.
   */
  rateo?: Centesimi;
  /**
   * Centesimi: commissioni già pagate sul carico — riducono la plusvalenza
   * imponibile al rimborso (fanno parte del costo fiscale).
   */
  commissioniCarico?: Centesimi;
  /**
   * Prezzo di emissione, base 100, e data di godimento. Insieme decidono il
   * disaggio (vedi sopra); sopra la pari non c'è disaggio.
   * Uno solo dei due non basta: il disaggio si ripartisce nel tempo e senza
   * la data non si sa da quando.
   */
  prezzoEmissione?: number;
  dataEmissione?: string;
  /**
   * ISO: data di carico. Decide quanto disaggio era già maturato quando si
   * è comprato, e quindi il prezzo teorico da cui si misura la plusvalenza.
   * Default: la data di riferimento.
   */
  dataCarico?: string;
  /**
   * L'operazione è un acquisto che si regola alla data di riferimento:
   * rateo, storno dell'imposta e credito sul disaggio entrano nell'esborso.
   * Lo imposta `perAcquisto`, che sistema anche la data di regolamento.
   */
  acquisto?: boolean;
}

/** Quanto basta del titolo per calcolare il disaggio di emissione. */
export type DatiDisaggio = Pick<
  ParametriBond,
  "categoria" | "quantita" | "dataScadenza" | "prezzoEmissione" | "dataEmissione"
>;

export interface Flusso {
  data: string;
  importo: Centesimi;
}

/**
 * Gli stessi parametri per un ACQUISTO eseguito alla data di riferimento:
 * si sposta la valutazione alla data di regolamento (T+2), il carico
 * diventa il prezzo di oggi e l'esborso include rateo e crediti fiscali di
 * regolamento. Serve ovunque si valuti un acquisto. Per un titolo già
 * posseduto, valutato oggi, NON si usa: lì il carico è quello di allora.
 */
export function perAcquisto(p: ParametriBond): ParametriBond {
  const regolamento = dataRegolamento(p.dataRiferimento);
  return {
    ...p,
    acquisto: true,
    dataRiferimento: regolamento,
    dataCarico: regolamento,
  };
}

function emissioneNota(p: DatiDisaggio): boolean {
  return (
    p.prezzoEmissione != null && p.dataEmissione != null && p.dataEmissione < p.dataScadenza
  );
}

/**
 * Un BOT di cui si conoscono prezzo e data di emissione: lo scarto si tassa
 * in anticipo e la parte fra prezzo teorico e prezzo pagato è plusvalenza.
 * Gli strip, che il motore tratta come BOT, non hanno un prezzo di emissione
 * che abbia senso (nascono dalla separazione di un BTP): restano al modello
 * semplificato, e così ogni BOT di cui mancano i dati.
 */
export function isScartoAnticipato(p: DatiDisaggio): boolean {
  return p.categoria === "bot" && emissioneNota(p);
}

/** Disaggio (o scarto, sui BOT) di emissione in punti base 100: rimborso − emissione, mai negativo. */
function disaggioPunti(p: DatiDisaggio): number {
  if (!emissioneNota(p)) return 0;
  return Math.max(0, 100 - p.prezzoEmissione!);
}

/** Quota del disaggio maturata fra emissione e `data`, lineare sui giorni. */
function quotaDisaggioMaturata(p: DatiDisaggio, data: string): number {
  const totale = giorniTra(p.dataEmissione!, p.dataScadenza);
  const trascorsi = giorniTra(p.dataEmissione!, data);
  return Math.min(1, Math.max(0, trascorsi / totale));
}

/**
 * Prezzo teorico alla data, base 100: emissione più disaggio maturato. È il
 * «costo» da cui il fisco misura la plusvalenza, perché il tratto di
 * disaggio è già reddito di capitale. Senza disaggio è 100.
 */
export function prezzoTeorico(p: DatiDisaggio, data: string): number {
  const disaggio = disaggioPunti(p);
  if (disaggio === 0) return 100;
  return 100 - disaggio + disaggio * quotaDisaggioMaturata(p, data);
}

/**
 * Centesimi di disaggio maturato fra due date sulla quantità del titolo: è
 * il reddito di capitale che chi vende paga (e chi compra si vede
 * accreditare) sul tratto di possesso.
 */
export function scartoMaturato(p: DatiDisaggio, da: string, a: string): Centesimi {
  return arrotondaCentesimi(
    (p.quantita * (prezzoTeorico(p, a) - prezzoTeorico(p, da))) / 100,
  );
}

/** Imposta sul differenziale di rimborso. */
function impostaRimborso(p: DatiDisaggio, plusvalenza: Centesimi): Centesimi {
  if (plusvalenza <= 0) return 0;
  if (p.categoria === "bot" && !isScartoAnticipato(p)) {
    // Modello semplificato, senza dati di emissione: tutto il differenziale
    // come scarto, reddito di capitale al 12,5% pieno.
    return arrotondaCentesimi(plusvalenza * ALIQUOTA_AGEVOLATA);
  }
  // Reddito diverso: 26% sul 48,08% della plusvalenza.
  return arrotondaCentesimi(
    arrotondaCentesimi(plusvalenza * QUOTA_IMPONIBILE_TITOLI_STATO) *
      ALIQUOTA_ORDINARIA,
  );
}

/** Plusvalenza CON SEGNO e imposta a rimborso, sul carico e sul prezzo teorico. */
export interface CapitalGainRimborso {
  /** Centesimi con segno: prezzo teorico al carico − carico − commissioni. */
  plusvalenza: Centesimi;
  /** Centesimi: imposta dovuta, zero in minusvalenza. */
  imposta: Centesimi;
}

export function capitalGainRimborso(p: ParametriBond): CapitalGainRimborso {
  const teorico = prezzoTeorico(p, p.dataCarico ?? p.dataRiferimento);
  const plusvalenza =
    controvaloreCents(p.quantita, teorico) -
    controvaloreCents(p.quantita, p.prezzoCarico) -
    commissioniNelCosto(p);
  return { plusvalenza, imposta: impostaRimborso(p, plusvalenza) };
}

/**
 * Centesimi: le commissioni che fanno parte del costo fiscale (art. 68
 * TUIR: il costo è aumentato degli oneri inerenti). Su un acquisto il carico
 * è quello di oggi, e le sue commissioni ci entrano come quelle di un carico
 * di allora: lo stesso costo che `simulaUscita` dà al lotto.
 */
function commissioniNelCosto(p: ParametriBond): Centesimi {
  return p.commissioniCarico ?? (p.acquisto ? (p.commissioni ?? 0) : 0);
}

/**
 * Centesimi: imposta sul disaggio maturato dall'emissione alla data — a
 * rimborso è l'intero disaggio, a una vendita anticipata la quota maturata
 * fino a quel giorno, che il sostituto d'imposta addebita a chi vende
 * (e accredita a chi compra: vedi `creditoDisaggio`).
 */
export function addebitoDisaggio(p: DatiDisaggio, data = p.dataScadenza): Centesimi {
  const disaggio = disaggioPunti(p);
  if (disaggio === 0) return 0;
  return arrotondaCentesimi(
    controvaloreCents(p.quantita, disaggio) *
      quotaDisaggioMaturata(p, data) *
      ALIQUOTA_AGEVOLATA,
  );
}

/**
 * Centesimi: imposta sulla parte di scarto di un BOT che matura DOPO la data,
 * fino alla scadenza. È quella che chi compra a quella data rimborsa a chi
 * vende: all'asta l'imposta sull'intero scarto è stata trattenuta in anticipo.
 */
function impostaScartoResiduo(p: DatiDisaggio, data: string): Centesimi {
  const disaggio = disaggioPunti(p);
  if (disaggio === 0) return 0;
  return arrotondaCentesimi(
    controvaloreCents(p.quantita, disaggio) *
      (1 - quotaDisaggioMaturata(p, data)) *
      ALIQUOTA_AGEVOLATA,
  );
}

/**
 * Centesimi, CON SEGNO: l'imposta sul disaggio che si regola quando il titolo
 * esce dal portafoglio alla data, venduto o rimborsato. Positivo è un
 * addebito, negativo un accredito.
 *
 * - Titoli con cedola: chi esce paga l'imposta su tutto il disaggio maturato
 *   dall'emissione (a rimborso, l'intero); la parte maturata prima del suo
 *   acquisto gli era stata accreditata allora.
 * - BOT con lo scarto tassato in anticipo: chi esce si vede restituire
 *   l'imposta sul tratto che resta, pagata da chi compra; a rimborso zero.
 *
 * Nei due casi, sommato al conto dell'acquisto, resta l'imposta sul solo
 * tratto di possesso: cambia quando la si paga, non quanto.
 */
export function impostaDisaggioCessione(p: DatiDisaggio, data = p.dataScadenza): Centesimi {
  // `|| 0`: a scadenza il residuo è zero, e un −0 non deve uscire di qui.
  return isScartoAnticipato(p) ? -impostaScartoResiduo(p, data) || 0 : addebitoDisaggio(p, data);
}

/**
 * Centesimi: credito sul disaggio maturato PRIMA della data di riferimento,
 * accreditato a chi compra a quella data. Zero su un titolo già posseduto e
 * sui BOT, dove all'acquisto si paga invece `impostaScartoAcquisto`.
 */
export function creditoDisaggio(p: ParametriBond): Centesimi {
  if (!p.acquisto || isScartoAnticipato(p)) return 0;
  return addebitoDisaggio(p, p.dataRiferimento);
}

/**
 * Centesimi: imposta sullo scarto residuo di un BOT, addebitata a chi lo
 * compra sul secondario. Zero su ogni altro titolo e su un BOT già posseduto.
 */
export function impostaScartoAcquisto(p: ParametriBond): Centesimi {
  if (!p.acquisto || !isScartoAnticipato(p)) return 0;
  return impostaScartoResiduo(p, p.dataRiferimento);
}

/** Centesimi: rateo alla data di riferimento (o quello noto, se c'è). */
export function rateoAllaData(p: ParametriBond): Centesimi {
  if (p.rateo != null) return p.rateo;
  return rateoMaturato({ ...cedolare(p), riferimento: p.dataRiferimento });
}

/** Centesimi: imposta sul rateo (reddito di capitale). */
export function impostaSuRateo(rateo: Centesimi): Centesimi {
  return arrotondaCentesimi(Math.max(0, rateo) * ALIQUOTA_AGEVOLATA);
}

/**
 * Centesimi: imposta sul rateo pagato, stornata subito a chi compra. Zero su
 * un titolo già posseduto: lì il rateo del tel quel è quello che si
 * INCASSEREBBE vendendo, non un costo.
 */
export function stornoImpostaRateo(p: ParametriBond): Centesimi {
  if (!p.acquisto) return 0;
  return impostaSuRateo(rateoAllaData(p));
}

/**
 * Le partite fiscali che il sostituto d'imposta regola a chi compra
 * un'obbligazione il giorno `data`, pagando `rateo` lordo (DLgs 239/96): lo
 * storno dell'imposta sul rateo e il credito sul disaggio maturato prima,
 * oppure — su un BOT — l'imposta sullo scarto che resta da maturare.
 * `totale` somma i soli crediti; `impostaScarto` è un addebito a parte.
 */
export function creditiAcquisto(
  titolo: DatiDisaggio,
  rateo: Centesimi,
  data: string,
): {
  stornoRateo: Centesimi;
  creditoDisaggio: Centesimi;
  impostaScarto: Centesimi;
  totale: Centesimi;
} {
  const stornoRateo = impostaSuRateo(rateo);
  const anticipato = isScartoAnticipato(titolo);
  const creditoDisaggio = anticipato ? 0 : addebitoDisaggio(titolo, data);
  const impostaScarto = anticipato ? impostaScartoResiduo(titolo, data) : 0;
  return { stornoRateo, creditoDisaggio, impostaScarto, totale: stornoRateo + creditoDisaggio };
}

/** Il piano cedolare del titolo, nella forma che vuole lib/bond/cedole.ts. */
function cedolare(p: ParametriBond) {
  return {
    quantita: p.quantita,
    cedolaAnnua: p.cedolaAnnua,
    frequenzaCedola: p.frequenzaCedola,
    dataScadenza: p.dataScadenza,
    gradini: p.gradiniCedola,
  };
}

export interface Cedola {
  data: string;
  lorda: Centesimi;
  imposta: Centesimi;
  netta: Centesimi;
}

/**
 * Centesimi: le cedole future, esclusa la data di riferimento, ognuna lorda,
 * con la sua imposta del 12,5% e netta.
 * Il motore le tassa tutte per intero, anche la prima dopo un acquisto: il
 * rateo pagato è già stornato all'acquisto. Sono uguali fra loro tranne che
 * sugli step-up.
 */
export function cedoleFuture(p: ParametriBond): Cedola[] {
  return cedoleLordeTra(cedolare(p), p.dataRiferimento, p.dataScadenza).map((c) => {
    const imposta = arrotondaCentesimi(c.importo * ALIQUOTA_AGEVOLATA);
    return { data: c.data, lorda: c.importo, imposta, netta: c.importo - imposta };
  });
}

/**
 * Cedole e rimborso nello stesso elenco di flussi: l'ultima cedola cade il
 * giorno del rimborso e si somma a lui.
 */
function conRimborso(cedole: Flusso[], scadenza: string, rimborso: Centesimi): Flusso[] {
  const flussi = cedole.map((c) => ({ ...c }));
  const ultimo = flussi[flussi.length - 1];
  if (ultimo && ultimo.data === scadenza) {
    ultimo.importo += rimborso;
  } else {
    flussi.push({ data: scadenza, importo: rimborso });
  }
  return flussi;
}

/** Flussi futuri lordi (cedole + rimborso), esclusa la data di riferimento. */
export function flussiLordi(p: ParametriBond): Flusso[] {
  return conRimborso(
    cedoleFuture(p).map((c) => ({ data: c.data, importo: c.lorda })),
    p.dataScadenza,
    controvaloreCents(p.quantita, 100),
  );
}

/**
 * Flussi futuri al netto delle imposte su cedole, disaggio e plusvalenza da
 * rimborso. `senzaCapitalGain` toglie solo l'imposta sulla plusvalenza: è il
 * rendimento di chi ha zainetto da assorbire (e quello che Borsa Italiana
 * chiama netto).
 */
export function flussiNetti(
  p: ParametriBond,
  opzioni: { senzaCapitalGain?: boolean } = {},
): Flusso[] {
  const impostaFinale =
    impostaDisaggioCessione(p) + (opzioni.senzaCapitalGain ? 0 : capitalGainRimborso(p).imposta);
  // Ultima data: alla cedola si somma il rimborso, con le sue imposte.
  return conRimborso(
    cedoleFuture(p).map((c) => ({ data: c.data, importo: c.netta })),
    p.dataScadenza,
    controvaloreCents(p.quantita, 100) - impostaFinale,
  );
}

/** Controvalore tel-quel (clean + rateo) in centesimi, senza commissioni. */
export function controvaloreTelQuel(p: ParametriBond): Centesimi {
  return controvaloreCents(p.quantita, p.prezzo) + rateoAllaData(p);
}

/**
 * Centesimi: quanto si sborsa davvero alla data di riferimento. Per un
 * acquisto è il «controvalore di regolamento» — tel quel più commissioni, meno storno sul rateo e credito sul disaggio,
 * più l'imposta sullo scarto residuo se è un BOT; per un titolo posseduto è
 * il tel quel di oggi più eventuali commissioni.
 */
export function esborsoNetto(p: ParametriBond): Centesimi {
  return (
    controvaloreTelQuel(p) +
    (p.commissioni ?? 0) -
    stornoImpostaRateo(p) -
    creditoDisaggio(p) +
    impostaScartoAcquisto(p)
  );
}

/**
 * Tasso interno di rendimento (composto annuo) che eguaglia il valore
 * attuale dei flussi all'esborso. Bisezione: robusta, nessun rischio di
 * divergenza. Restituisce null se non esiste soluzione nel range.
 */
export function tir(
  flussi: Flusso[],
  esborso: Centesimi,
  dataRiferimento: string,
): number | null {
  if (esborso <= 0 || flussi.length === 0) return null;
  const sconti = flussi.map(f => ({ importo: f.importo, anni: anniTraActAct(dataRiferimento, f.data) }));
  const valoreAttuale = (r: number) =>
    sconti.reduce(
      (somma, f) => somma + f.importo / (1 + r) ** f.anni,
      0,
    );
  let basso = -0.9;
  let alto = 10;
  if (valoreAttuale(basso) - esborso < 0 || valoreAttuale(alto) - esborso > 0) {
    return null;
  }
  for (let i = 0; i < 200; i++) {
    if (alto - basso < 1e-12) break;
    const medio = (basso + alto) / 2;
    if (valoreAttuale(medio) - esborso > 0) {
      basso = medio;
    } else {
      alto = medio;
    }
  }
  return (basso + alto) / 2;
}

/**
 * Un titolo già scaduto non ha un rendimento a scadenza: i flussi sarebbero
 * tutti nel passato e `tir` li sconterebbe con esponenti negativi,
 * restituendo un numero che sembra un tasso e non lo è. Stessa guardia che
 * ha già `rendimentoNetto`.
 */
function scaduto(p: ParametriBond): boolean {
  return anniTraActAct(p.dataRiferimento, p.dataScadenza) <= 0;
}

/** YTM lordo di mercato (niente imposte né commissioni). */
export function ytmLordo(p: ParametriBond): number | null {
  if (scaduto(p)) return null;
  return tir(flussiLordi(p), controvaloreTelQuel(p), p.dataRiferimento);
}

/** YTM netto: flussi al netto delle imposte, esborso di regolamento. */
export function ytmNetto(p: ParametriBond): number | null {
  if (scaduto(p)) return null;
  return tir(flussiNetti(p), esborsoNetto(p), p.dataRiferimento);
}

/**
 * YTM netto SENZA l'imposta sulla plusvalenza di rimborso: quello di chi ha
 * minusvalenze da compensare. Coincide con
 * `ytmNetto` sui titoli sopra il carico. Resta fuori dalle tabelle dove il
 * rendimento deve essere di mercato: il beneficio dello zainetto si misura
 * in euro, non nel tasso.
 */
export function ytmNettoSenzaCapitalGain(p: ParametriBond): number | null {
  if (scaduto(p)) return null;
  return tir(
    flussiNetti(p, { senzaCapitalGain: true }),
    esborsoNetto(p),
    p.dataRiferimento,
  );
}

/** Lo YTM netto tradotto in euro: quanto rende davvero la posizione. */
export interface RendimentoNetto {
  /** Centesimi: cedole nette + rimborso netto da qui a scadenza. */
  incassiNetti: Centesimi;
  /** Centesimi: esborso di regolamento (o valore tel quel oggi). */
  esborso: Centesimi;
  /** Centesimi: incassi − esborso, il guadagno netto complessivo. */
  guadagnoNetto: Centesimi;
  /** Centesimi: guadagno netto diviso per gli anni residui (media lineare). */
  guadagnoNettoAnnuo: Centesimi;
  /** Anni residui, ACT/ACT. */
  anniResidui: number;
}

/**
 * Traduzione in euro dello YTM netto, sulla quantità indicata: cosa incassi
 * da qui a scadenza rispetto a quanto vale (o costa) la posizione oggi.
 *
 * È la stessa base di calcolo dello YTM netto — stessi flussi, stesso
 * esborso — quindi i due numeri non possono divergere. La cifra annua è una
 * media lineare sugli anni residui, non una capitalizzazione composta:
 * serve a dare l'ordine di grandezza del flusso, il tasso resta lo YTM.
 */
export function rendimentoNetto(p: ParametriBond): RendimentoNetto | null {
  const anniResidui = anniTraActAct(p.dataRiferimento, p.dataScadenza);
  if (anniResidui <= 0) return null;
  const esborso = esborsoNetto(p);
  if (esborso <= 0) return null;
  const incassiNetti = flussiNetti(p).reduce((somma, f) => somma + f.importo, 0);
  const guadagnoNetto = incassiNetti - esborso;
  return {
    incassiNetti,
    esborso,
    guadagnoNetto,
    guadagnoNettoAnnuo: arrotondaCentesimi(guadagnoNetto / anniResidui),
    anniResidui: Math.round(anniResidui * 100) / 100,
  };
}

/**
 * Lo stesso rendimento su un capitale dato invece che sul nominale: quanto
 * si ritrova a scadenza chi spende oggi `capitale` (rateo e crediti
 * d'imposta compresi). Diecimila nominali costano ottomila euro su un titolo
 * e undicimila su un altro: per decidere dove mettere una somma, gli euro
 * vanno confrontati sulla stessa somma. È una proporzione esatta, perché
 * flussi ed esborso crescono insieme con la quantità.
 */
export function rendimentoSuCapitale(
  r: RendimentoNetto,
  capitale: Centesimi,
): { incassi: Centesimi; guadagno: Centesimi; guadagnoAnnuo: Centesimi } {
  const incassi = Math.round((r.incassiNetti * capitale) / r.esborso);
  const guadagno = incassi - capitale;
  return { incassi, guadagno, guadagnoAnnuo: arrotondaCentesimi(guadagno / r.anniResidui) };
}
