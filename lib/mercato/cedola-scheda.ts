/**
 * La cedola annua di un titolo il cui listino non la dà: né nel nome né nella
 * colonna. È il caso di «Oatei Fx Jul43 Eur» (OAT€i 0,95% luglio 2043,
 * FR001400QCA1, rilevato il 01/11/2026), che sul listino estero del MOT non
 * porta la cedola in nessuno dei due posti. La scheda di Borsa Italiana la
 * scrive nel campo «Tasso Cedola su base Annua» (quello «Periodale» è vuoto):
 * annua, come la colonna del listino estero, quindi entra nel motore senza
 * moltiplicazioni.
 *
 * Una scheda letta per ogni titolo così, ogni giorno. Se non si legge (rete)
 * resta la cedola di ieri, dal catalogo; senza, o se il campo manca, è vuoto,
 * non è un numero o è fuori dai limiti, il titolo è scartato col motivo e col
 * nome: mai una cedola indovinata.
 */

/** Il campo come lo scrive la scheda: il testo, e il numero se lo è. */
export interface LetturaCedola {
  testo: string | null;
  valore: number | null;
}

/** Stesso limite del listino (lib/prezzi/borsaitaliana.ts): oltre il 20% annuo si scarta. */
const CEDOLA_MASSIMA = 20;

export interface RigaCedolaDaScheda {
  isin: string;
  nome: string;
  dataScadenza: string;
}

export async function risolviCedoleDaScheda(
  righe: RigaCedolaDaScheda[],
  opzioni: {
    /** Cedola annua di ieri per ISIN, dai titoli del catalogo di ieri. */
    precedenti: Map<string, number>;
    leggiCedola: (isin: string) => Promise<LetturaCedola>;
  },
): Promise<{ cedole: Map<string, number>; scartate: { isin: string; motivo: string }[] }> {
  const cedole = new Map<string, number>();
  const scartate: { isin: string; motivo: string }[] = [];
  const scarta = (r: RigaCedolaDaScheda, motivo: string) =>
    scartate.push({ isin: r.isin, motivo: `${motivo} (${r.nome})` });
  for (const r of righe) {
    let lettura: LetturaCedola;
    try {
      lettura = await opzioni.leggiCedola(r.isin);
    } catch (e) {
      const ieri = opzioni.precedenti.get(r.isin);
      if (ieri != null) {
        cedole.set(r.isin, ieri);
        continue;
      }
      scarta(
        r,
        `cedola non riconosciuta: il listino non la dà e la scheda di Borsa Italiana non si è letta (${e instanceof Error ? e.message : String(e)})`,
      );
      continue;
    }
    if (lettura.testo == null) {
      scarta(r, "cedola non riconosciuta: il listino non la dà e la scheda di Borsa Italiana ha «Tasso Cedola su base Annua» assente o vuoto");
    } else if (lettura.valore == null) {
      scarta(r, `cedola non riconosciuta: «Tasso Cedola su base Annua» della scheda di Borsa Italiana non è un numero («${lettura.testo.slice(0, 40)}»)`);
    } else if (!(lettura.valore >= 0 && lettura.valore <= CEDOLA_MASSIMA)) {
      scarta(r, `cedola non riconosciuta: ${lettura.valore}% sulla scheda di Borsa Italiana è fuori dai limiti (0-${CEDOLA_MASSIMA}% annuo)`);
    } else {
      cedole.set(r.isin, lettura.valore);
    }
  }
  return { cedole, scartate };
}
