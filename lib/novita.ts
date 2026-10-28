import { formatDataIT } from "./date";

/**
 * Cosa è cambiato nel sito, dal più recente: quello che vede chi lo usa —
 * conti, pagine, dati — non il lavoro dietro. È l'unica fonte: la pagina
 * Informazioni la mostra e `CHANGELOG.md`, nella repo, la riporta uguale:
 * lo scrive `npm run changelog` (`changelogMarkdown`), e un test controlla
 * che coincidano.
 */
export interface Novita {
  /** ISO: il giorno in cui la modifica è uscita sul sito. */
  data: string;
  voci: string[];
}

export const NOVITA: Novita[] = [
  {
    data: "2026-10-28",
    voci: [
      "BTP Valore Insieme di nuovo in elenco, con la cedola definitiva del 22,70%: rendimento, «Se lo compro» e «Se esco prima». Sta fra i tassi fissi, accanto ai titoli di scadenza vicina; la scheda a parte resta solo per i titoli a cedola unica ancora in collocamento.",
    ],
  },
  {
    data: "2026-10-26",
    voci: [
      "La tabella dei tassi fissi si può scorrere tutta di seguito, senza pagine: «Elenco intero», accanto a «Per anno» e «50 per pagina».",
    ],
  },
  {
    data: "2026-10-24",
    voci: [
      "CCTeu: cedola e rateo si contano come li conta il Tesoro, sui giorni effettivi del semestre diviso 360. Le cedole non sono più tutte uguali e il rendimento a scadenza sale di circa 5 punti base.",
      "Titoli appena emessi con la prima cedola corta: rateo e prima cedola maturano dalla data di godimento, non dalla data teorica precedente. Cambiano rateo, addebito e prima cedola in «Se lo compro», e il rateo di vendita in «Se esco prima» prima della prima cedola; il rendimento resta lo stesso.",
      "BTP Valore Insieme in una scheda sua: una cedola sola, pagata a scadenza, col rateo in 30E/360. Il rendimento, «Se lo compro» e «Se esco prima» arrivano quando Borsa Italiana pubblica la cedola definitiva; fino ad allora la riga dice il minimo del collocamento.",
    ],
  },
  {
    data: "2026-10-21",
    voci: [
      "Il netto a scadenza della tabella è su 10.000 nominali, o sul nominale delle tue condizioni: lo stesso acquisto di «Se lo compro», commissioni comprese.",
      "Il guadagno annuo della tabella divide il guadagno per gli anni esatti, non arrotondati al centesimo.",
      "La tabella dei tassi fissi è divisa in pagine per anno di scadenza.",
      "In «Se esco prima» il rendimento annuo è il tasso interno dei flussi, come lo YTM: a scadenza, coi tassi fermi, coincide con la tabella. Il risultato del conto è rosso se si perde e verde se si guadagna.",
      "Se Euronext non risponde restano gli scambi del giorno prima, e la pagina dice qual è l'ultima lettura riuscita.",
      "I dati di emissione mancanti si cercano ogni giorno per tutti i titoli, non un po' alla volta.",
      "Nuove pagine Informazioni e Privacy; le tabelle del giorno anche in Markdown, in /rendimenti.md.",
    ],
  },
  {
    data: "2026-10-20",
    voci: [
      "Il sito è online: rendimento netto e cifra finale in euro dei titoli di Stato quotati sul MOT, con i dati rinnovati ogni sera dei giorni feriali e il catalogo del giorno in /dati/catalogo.json.",
      "Sotto ogni titolo a tasso fisso «Se lo compro» e «Se esco prima», col nominale, il prezzo e le commissioni di chi guarda; la tabella segue nominale e tariffa salvati in «Le tue condizioni».",
      "Le commissioni d'acquisto entrano nel costo fiscale anche a rimborso, come in «Se esco prima», e il rimborso non paga una commissione di vendita.",
    ],
  },
];

/** Il testo di `CHANGELOG.md`, voce per voce come in pagina. */
export function changelogMarkdown(novita: Novita[] = NOVITA): string {
  const intestazione = [
    "# Novità",
    "",
    "Cosa è cambiato in quantotorna, dal più recente. Lo stesso elenco sta sul",
    "sito, nella pagina Informazioni. Questo file si genera da `lib/novita.ts`",
    "con `npm run changelog`: si modifica lì, e un test controlla che coincidano.",
  ];
  const giorni = novita.flatMap((n) => ["", `## ${formatDataIT(n.data)}`, "", ...n.voci.map((v) => `- ${v}`)]);
  return [...intestazione, ...giorni, ""].join("\n");
}
