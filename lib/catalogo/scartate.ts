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
