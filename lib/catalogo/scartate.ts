/**
 * Le righe dei listini lasciate fuori, raggruppate per la pagina. Sono più di
 * mille, e quasi tutte per tre motivi che non hanno bisogno di un elenco:
 * titoli in un'altra valuta, mai scambiati, di emittenti che non sono Stati
 * della white list. Quelle si contano; le altre — un titolo che il motore non
 * sa ancora leggere, un'agenzia lasciata fuori apposta — si elencano col
 * loro motivo, perché sono le domande che chi guarda si fa davvero («perché
 * quel BTP non c'è?»).
 *
 * I gruppi si riconoscono dal testo del motivo (lib/prezzi/borsaitaliana.ts):
 * se quel testo cambia, la riga finisce fra quelle elencate, non sparisce.
 */

export interface GruppoScartate {
  etichetta: string;
  quante: number;
}

const GRUPPI: { etichetta: string; motivo: RegExp }[] = [
  { etichetta: "in un'altra valuta: il rendimento dipenderebbe dal cambio", motivo: /^non è in euro/ },
  { etichetta: "senza prezzo: nessuno scambio sul MOT", motivo: /^prezzo assente/ },
  {
    etichetta: "di emittenti che non sono, o non si riconoscono con certezza come, Stati della white list o sovranazionali",
    motivo: /^emittente non riconosciuto/,
  },
];

export function raggruppaScartate(scartate: { isin: string; motivo: string }[]): {
  gruppi: GruppoScartate[];
  altre: { isin: string; motivo: string }[];
} {
  const conteggi = GRUPPI.map(() => 0);
  const altre: { isin: string; motivo: string }[] = [];
  for (const s of scartate) {
    const i = GRUPPI.findIndex((g) => g.motivo.test(s.motivo));
    if (i < 0) altre.push(s);
    else conteggi[i]++;
  }
  return {
    gruppi: GRUPPI.map((g, i) => ({ etichetta: g.etichetta, quante: conteggi[i] })).filter((g) => g.quante > 0),
    altre,
  };
}

/**
 * Le righe lasciate fuori oggi per un motivo che la pagina elenca (non i
 * tre ricorrenti) e che ieri non c'erano: un titolo nuovo che il motore non
 * sa leggere, una scheda di Borsa Italiana scritta in un altro modo. Il 27/10/2026
 * il BTP Valore Insieme è sparito così, e nessuno l'ha visto fino al giorno
 * dopo: il giro le segnala all'autore (.github/workflows/sito.yml). Conta la
 * coppia ISIN e motivo, quindi anche un titolo già fuori che cambia motivo.
 */
export function scartateNuove(
  ieri: { isin: string; motivo: string }[],
  oggi: { isin: string; motivo: string }[],
): { isin: string; motivo: string }[] {
  const viste = new Set(ieri.map((s) => `${s.isin} ${s.motivo}`));
  return raggruppaScartate(oggi).altre.filter((s) => !viste.has(`${s.isin} ${s.motivo}`));
}

/**
 * Un motivo su una riga sola, senza caratteri di controllo: contiene testo
 * delle schede di Borsa Italiana, e nel log di GitHub Actions una riga che
 * comincia con «::» è un comando.
 */
export function motivoSuUnaRiga(motivo: string): string {
  return motivo.replace(/[\s\x00-\x1f\x7f]+/g, " ").trim();
}

/** Le scartate nuove in Markdown, per il riepilogo del giro su GitHub. */
export function riepilogoScartateNuove(nuove: { isin: string; motivo: string }[]): string {
  const quante = nuove.length === 1 ? "1 titolo lasciato" : `${nuove.length} titoli lasciati`;
  return [
    `### ${quante} fuori per un motivo che ieri non c'era`,
    "",
    ...nuove.map((s) => `- \`${s.isin}\`: ${motivoSuUnaRiga(s.motivo)}`),
    "",
  ].join("\n");
}
