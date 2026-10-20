/** Utilità sulle date ISO (YYYY-MM-DD). Tutta l'aritmetica è in UTC. */

/** Date reali, senza accettare la normalizzazione di 31 febbraio in marzo. */
export function isDataISO(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith("0000")) return false;
  const data = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === v;
}

/**
 * La data di OGGI come la legge chi guarda lo schermo.
 *
 * Non `toISOString()`: quello dà l'istante in UTC, e fra mezzanotte e le due
 * (l'una in inverno) in Italia è ancora il giorno prima. Due ore al giorno i
 * conti partirebbero da ieri: regolamento, rateo e vita residua sbagliati di
 * un giorno.
 *
 * Il locale svedese si usa perché formatta già in `YYYY-MM-DD`: è la
 * scorciatoia standard per avere l'ISO nel fuso locale senza comporre i pezzi
 * a mano. Il resto di questo modulo resta in UTC, ed è giusto: lì si fa
 * aritmetica su date senza ora, che dev'essere deterministica.
 */
export function oggiISO(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export function aggiungiGiorni(iso: string, giorni: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/**
 * Somma mesi mantenendo il giorno del mese; se il mese di arrivo è più
 * corto, si ferma all'ultimo giorno (31/01 + 1 mese → 28/02).
 */
export function aggiungiMesi(iso: string, mesi: number): string {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  const totale = anno * 12 + (mese - 1) + mesi;
  const nuovoAnno = Math.floor(totale / 12);
  const nuovoMese = ((totale % 12) + 12) % 12;
  const ultimoGiorno = new Date(Date.UTC(nuovoAnno, nuovoMese + 1, 0)).getUTCDate();
  const nuovoGiorno = Math.min(giorno, ultimoGiorno);
  return `${nuovoAnno}-${String(nuovoMese + 1).padStart(2, "0")}-${String(
    nuovoGiorno,
  ).padStart(2, "0")}`;
}

/** Giorni da `a` a `b` (positivo se b è dopo a). */
export function giorniTra(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

/** Anni tra due date, convenzione ACT/365. */
export function anniTra(a: string, b: string): number {
  return giorniTra(a, b) / 365;
}

function bisestile(anno: number): boolean {
  return anno % 400 === 0 || (anno % 4 === 0 && anno % 100 !== 0);
}

/**
 * Anni tra due date, convenzione ACT/ACT (ISDA): ogni tratto è diviso per la
 * lunghezza vera del SUO anno, 365 o 366. È la convenzione con cui Borsa
 * Italiana attualizza i flussi dei titoli di Stato, e quella che il motore
 * obbligazionario usa per YTM e duration.
 * Con ACT/365 un anno bisestile «valeva» 1,0027 anni e sui BTP lunghi lo YTM
 * usciva di un terzo di punto base più basso: poco, ma abbastanza da far
 * divergere il secondo decimale da quello che si legge sui siti di
 * riferimento, e la duration ancora di più.
 */
export function anniTraActAct(a: string, b: string): number {
  if (a > b) return -anniTraActAct(b, a);
  let anni = 0;
  let inizio = a;
  while (inizio < b) {
    const anno = Number(inizio.slice(0, 4));
    const capodanno = `${anno + 1}-01-01`;
    const fine = capodanno < b ? capodanno : b;
    anni += giorniTra(inizio, fine) / (bisestile(anno) ? 366 : 365);
    inizio = fine;
  }
  return anni;
}

/** Giorno della settimana in UTC: 0 = domenica, 6 = sabato. */
function giornoSettimana(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/**
 * Data di regolamento di un'operazione sul MOT eseguita nel giorno dato:
 * il secondo giorno lavorativo successivo (T+2). È la data a cui si pagano
 * prezzo e rateo, quindi quella a cui vanno riferiti rateo e rendimento di
 * un acquisto — Borsa Italiana fa così, e
 * valutare «a oggi» dava due giorni di rateo in meno e due di vita in più.
 *
 * Contano solo i fine settimana: le
 * chiusure TARGET (1/1, Pasquetta, 1/5, Natale, S. Stefano) sposterebbero
 * il regolamento di un giorno cinque volte l'anno, un'imprecisione da un
 * giorno di rateo che non vale un calendario festivo da mantenere.
 */
export function dataRegolamento(iso: string): string {
  let data = iso;
  for (let lavorativi = 0; lavorativi < 2; ) {
    data = aggiungiGiorni(data, 1);
    const giorno = giornoSettimana(data);
    if (giorno !== 0 && giorno !== 6) lavorativi++;
  }
  return data;
}

/**
 * Il giorno a cui appartengono gli ultimi prezzi del MOT letti il giorno
 * dato, dopo la chiusura: lo stesso giorno, o il venerdì se è fine
 * settimana. Le festività di Borsa non si contano: in quei giorni il prezzo
 * è quello della seduta prima, con la data di oggi — un giorno di rateo,
 * come per `dataRegolamento`.
 */
export function giornoDeiPrezzi(iso: string): string {
  const giorno = giornoSettimana(iso);
  if (giorno === 6) return aggiungiGiorni(iso, -1);
  if (giorno === 0) return aggiungiGiorni(iso, -2);
  return iso;
}

/** Data ISO → formato italiano gg/mm/aaaa (solo per la UI). */
export function formatDataIT(iso: string): string {
  const [anno, mese, giorno] = iso.split("-");
  return `${giorno}/${mese}/${anno}`;
}
