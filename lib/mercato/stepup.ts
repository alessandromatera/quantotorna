import { cedolaInVigore, ultimaCedolaPrimaDi, type GradinoCedola } from "../bond/cedole";
import { aggiungiMesi } from "../date";

/**
 * Piano cedolare dei BTP step-up — Valore, Più, Futura — che il listino del
 * MOT non pubblica: ne riporta solo la cedola del periodo in corso. Letti
 * come tasso fisso uscivano con la cedola di oggi per sempre, cioè con un
 * rendimento sbagliato di mezzo punto e oltre (il BTP Più dava 1,97% netto
 * invece di 3,66%), e per questo erano scartati.
 *
 * Il piano viene, nell'ordine:
 *
 * 1. da `PIANI_NOTI`, per i titoli la cui scheda di Borsa Italiana non lo
 *    descrive: i quattro BTP Futura e il primo BTP Valore. Sono emissioni
 *    chiuse, il programma Futura è finito nel 2021: l'elenco non cresce;
 * 2. dal piano letto a un aggiornamento precedente;
 * 3. dalla scheda di Borsa Italiana, il cui campo «Descrizione Payout»
 *    scrive i gradini in una forma fissa (`pianoDaDescrizione`). È ciò che
 *    fa comparire da solo un BTP Valore nuovo, appena finito il collocamento.
 *
 * Qualunque sia la fonte, il piano deve dare la stessa cedola che il listino
 * pubblica per il periodo in corso (`verificaCedolaInCorso`), altrimenti il
 * titolo è scartato col motivo: un piano sbagliato produrrebbe rendimenti
 * plausibili e falsi.
 *
 * Il premio fedeltà e il rimborso anticipato del BTP Più restano fuori:
 * spettano solo a chi ha sottoscritto all'emissione, e chi compra sul
 * mercato non li riceve mai.
 */

export interface PianoStepUp {
  /** Cedole per anno. */
  frequenza: number;
  gradini: GradinoCedola[];
}

/**
 * Piani dei titoli la cui scheda non ha la «Descrizione Payout». Verificati
 * il 20/10/2026 cedola per cedola su un calcolo di riferimento e sulla
 * cedola in corso del listino MOT.
 */
export const PIANI_NOTI: Record<string, PianoStepUp & { fonte: string }> = {
  // BTP Valore giugno 2027, la prima emissione: l'unica semestrale.
  IT0005547408: {
    frequenza: 2,
    gradini: [
      { dal: "2023-06-13", cedolaAnnua: 3.25 },
      { dal: "2025-06-13", cedolaAnnua: 4 },
    ],
    fonte: "MEF, BTP Valore giugno 2023: 3,25% anni 1-2, 4% anni 3-4",
  },
  // BTP Futura luglio 2030, prima emissione.
  IT0005415291: {
    frequenza: 2,
    gradini: [
      { dal: "2020-07-14", cedolaAnnua: 1.15 },
      { dal: "2024-07-14", cedolaAnnua: 1.3 },
      { dal: "2027-07-14", cedolaAnnua: 1.45 },
    ],
    fonte: "MEF, BTP Futura luglio 2020: 1,15% anni 1-4, 1,30% anni 5-7, 1,45% anni 8-10",
  },
  // BTP Futura novembre 2028, seconda emissione: i minimi garantiti
  // confermati; la pagina di Borsa Italiana non riporta i tassi.
  IT0005425761: {
    frequenza: 2,
    gradini: [
      { dal: "2020-11-17", cedolaAnnua: 0.35 },
      { dal: "2023-11-17", cedolaAnnua: 0.6 },
      { dal: "2026-11-17", cedolaAnnua: 1 },
    ],
    fonte: "MEF, BTP Futura novembre 2020: 0,35% anni 1-3, 0,60% anni 4-6, 1% anni 7-8",
  },
  // BTP Futura aprile 2037, terza emissione.
  IT0005442097: {
    frequenza: 2,
    gradini: [
      { dal: "2021-04-27", cedolaAnnua: 0.75 },
      { dal: "2025-04-27", cedolaAnnua: 1.2 },
      { dal: "2029-04-27", cedolaAnnua: 1.65 },
      { dal: "2033-04-27", cedolaAnnua: 2 },
    ],
    fonte: "Borsa Italiana, BTP Futura terza emissione: 0,75%, 1,20%, 1,65%, 2% per quadrienni",
  },
  // BTP Futura novembre 2033, quarta emissione.
  IT0005466351: {
    frequenza: 2,
    gradini: [
      { dal: "2021-11-16", cedolaAnnua: 0.75 },
      { dal: "2025-11-16", cedolaAnnua: 1.35 },
      { dal: "2029-11-16", cedolaAnnua: 1.7 },
    ],
    fonte: "Borsa Italiana, BTP Futura quarta emissione: 0,75%, 1,35%, 1,70% per quadrienni",
  },
};

const PERIODICITA: Record<string, number> = {
  annuale: 1,
  semestrale: 2,
  trimestrale: 4,
};

/**
 * Piano dal testo della scheda di Borsa Italiana. Le emissioni dal BTP
 * Valore di ottobre 2023 in poi lo scrivono tutte allo stesso modo:
 *
 *   «… secondo una progressione crescente (3-2-2). Per i primi 3 anni verrà
 *   corrisposto un tasso pari al 2,60%, per i successivi 2 anni un tasso
 *   pari a 3,10% e per gli ultimi 2 anni un tasso pari al 4%.»
 *
 * Fra parentesi la durata dei gradini in anni, poi un «tasso pari a» per
 * gradino. Ogni incoerenza è un motivo, non un piano indovinato: gradini e
 * tassi in numero diverso, tassi che scendono, durate che non arrivano alla
 * scadenza. Durante il collocamento il testo dà i tassi MINIMI, che alla
 * chiusura possono solo salire: un piano così non si usa.
 */
export function pianoDaDescrizione(
  descrizione: string,
  periodicita: string | null,
  godimento: string,
  scadenza: string,
): PianoStepUp | { motivo: string } {
  if (/\bminim[io]\b/i.test(descrizione)) {
    return {
      motivo:
        "la scheda riporta i tassi minimi del collocamento: i definitivi, che possono solo salire, non sono ancora pubblicati",
    };
  }
  const frequenza = PERIODICITA[(periodicita ?? "").trim().toLowerCase()];
  if (!frequenza) {
    return { motivo: `periodicità della cedola non riconosciuta (${periodicita ?? "assente"})` };
  }
  const durate = descrizione
    .match(/\((\d+(?:\s*-\s*\d+)+)\)/)?.[1]
    .split("-")
    .map((n) => Number(n.trim()));
  const tassi = [...descrizione.matchAll(/tasso pari al?\s*(\d+(?:[.,]\d+)?)\s*%/gi)].map((m) =>
    Number(m[1].replace(",", ".")),
  );
  if (!durate || tassi.length !== durate.length) {
    return {
      motivo: `piano cedolare non riconosciuto nella scheda di Borsa Italiana («${descrizione.slice(0, 160)}»)`,
    };
  }
  if (tassi.some((t, i) => i > 0 && t < tassi[i - 1])) {
    return { motivo: `tassi del piano non crescenti (${tassi.join(" → ")}%)` };
  }
  const gradini: GradinoCedola[] = [];
  let anni = 0;
  for (const [i, durata] of durate.entries()) {
    gradini.push({ dal: aggiungiMesi(godimento, anni * 12), cedolaAnnua: tassi[i] });
    anni += durata;
  }
  if (aggiungiMesi(godimento, anni * 12) !== scadenza) {
    return {
      motivo: `i gradini (${durate.join("-")} anni dal ${godimento}) non arrivano alla scadenza del ${scadenza}`,
    };
  }
  return { frequenza, gradini };
}

/**
 * Il piano deve dare la cedola che il listino pubblica per il periodo in
 * corso. Si accetta anche quella del periodo prima o dopo: intorno a uno
 * stacco Borsa Italiana non aggiorna la colonna sempre lo stesso giorno, e
 * un cambio di gradino in quei giorni non è un piano sbagliato.
 *
 * Restituisce il motivo dello scarto, o null se il piano torna.
 */
export function verificaCedolaInCorso(
  piano: PianoStepUp,
  cedolaListino: number | null,
  scadenza: string,
  oggi: string,
): string | null {
  if (cedolaListino == null) {
    return "il listino non pubblica la cedola in corso: il piano non si può verificare";
  }
  const mesi = 12 / piano.frequenza;
  const inizio = ultimaCedolaPrimaDi({ dataScadenza: scadenza, frequenzaCedola: piano.frequenza }, oggi);
  const attese = [-mesi, 0, mesi].map(
    (spostamento) =>
      cedolaInVigore(0, piano.gradini, aggiungiMesi(inizio, spostamento)) / piano.frequenza,
  );
  if (attese.some((a) => Math.abs(a - cedolaListino) < 0.0005)) return null;
  const tasso = cedolaInVigore(0, piano.gradini, inizio);
  return `il listino dà una cedola di periodo del ${cedolaListino}%, il piano ${Math.round(attese[1] * 10000) / 10000}% (${tasso}% annuo): piano da ricontrollare`;
}

/** Cedola annua del periodo in corso, quella da mostrare. */
export function cedolaAnnuaInCorso(piano: PianoStepUp, scadenza: string, oggi: string): number {
  const inizio = ultimaCedolaPrimaDi({ dataScadenza: scadenza, frequenzaCedola: piano.frequenza }, oggi);
  return cedolaInVigore(0, piano.gradini, inizio);
}

/** Quello che la scheda di Borsa Italiana dice di uno step-up. */
export interface SchedaStepUp {
  godimento: string | null;
  periodicita: string | null;
  descrizione: string | null;
}

/** Una riga step-up del listino, prima di avere il piano. */
export interface RigaStepUp {
  isin: string;
  nome: string;
  dataScadenza: string;
  /** Cedola del periodo in corso come la scrive il listino. */
  cedolaListino: number | null;
}

/**
 * Il piano di ogni step-up del listino, dalle fonti nell'ordine detto in
 * testa. `leggiScheda` è iniettata: in produzione scarica la pagina di
 * Borsa Italiana, nei test restituisce un testo fisso. Le schede si
 * chiedono una alla volta, e solo per i titoli che non hanno già un piano:
 * Borsa Italiana risponde 429 a chi chiede troppo in fretta.
 */
export async function risolviPianiStepUp(
  righe: RigaStepUp[],
  opzioni: {
    oggi: string;
    precedenti: Map<string, PianoStepUp>;
    leggiScheda: (isin: string) => Promise<SchedaStepUp>;
  },
): Promise<{
  piani: Map<string, PianoStepUp>;
  scartate: { isin: string; motivo: string }[];
}> {
  const piani = new Map<string, PianoStepUp>();
  const scartate: { isin: string; motivo: string }[] = [];

  for (const r of righe) {
    const verifica = (p: PianoStepUp) =>
      verificaCedolaInCorso(p, r.cedolaListino, r.dataScadenza, opzioni.oggi);

    const noto = PIANI_NOTI[r.isin] ?? opzioni.precedenti.get(r.isin);
    if (noto) {
      const motivo = verifica(noto);
      if (motivo == null) {
        piani.set(r.isin, { frequenza: noto.frequenza, gradini: noto.gradini });
        continue;
      }
      // Un piano della tabella che non torna è un errore della tabella:
      // rileggere la scheda non lo correggerebbe, perché non lo descrive.
      if (PIANI_NOTI[r.isin]) {
        scartate.push({ isin: r.isin, motivo: `${motivo} (${r.nome}, lib/mercato/stepup.ts)` });
        continue;
      }
    }

    let scheda: SchedaStepUp;
    try {
      scheda = await opzioni.leggiScheda(r.isin);
    } catch (e) {
      scartate.push({
        isin: r.isin,
        motivo: `step-up senza piano cedolare: scheda di Borsa Italiana non letta (${e instanceof Error ? e.message : String(e)}) (${r.nome})`,
      });
      continue;
    }
    if (!scheda.descrizione || !scheda.godimento) {
      scartate.push({
        isin: r.isin,
        motivo: `step-up senza piano cedolare: la scheda di Borsa Italiana non lo descrive e non è in lib/mercato/stepup.ts (${r.nome})`,
      });
      continue;
    }
    const letto = pianoDaDescrizione(
      scheda.descrizione,
      scheda.periodicita,
      scheda.godimento,
      r.dataScadenza,
    );
    const motivo = "motivo" in letto ? letto.motivo : verifica(letto);
    if (motivo != null) {
      scartate.push({ isin: r.isin, motivo: `${motivo} (${r.nome})` });
      continue;
    }
    piani.set(r.isin, letto as PianoStepUp);
  }

  return { piani, scartate };
}
