import { commissione, type TariffaMercato } from "../costi/commissioni";
import type { Centesimi } from "../money";
import { controvaloreCents } from "../tax/lifo";
import {
  cedoleFuture,
  esborsoNetto,
  flussiNetti,
  rateoAllaData,
  type ParametriBond,
} from "./ytm";

/**
 * Che cosa succede in una data del calendario: l'acquisto, una cedola, il
 * rimborso, oppure (l'ultima data) cedola e rimborso insieme.
 */
export type TipoFlusso = "acquisto" | "cedola" | "cedolaRimborso" | "rimborso";

export interface RigaFlusso {
  data: string;
  tipo: TipoFlusso;
  /** Centesimi con segno: negativo esce dal conto, positivo entra. */
  lordo: Centesimi;
  /**
   * Centesimi con segno: negativo è imposta pagata, positivo è imposta
   * rimborsata (storno sul rateo e credito sul disaggio all'acquisto).
   * `netto − lordo`, così le tre colonne tornano sempre.
   */
  imposte: Centesimi;
  /** Centesimi con segno: ciò che davvero esce o entra nella data. */
  netto: Centesimi;
  /** Centesimi con segno: la somma dei netti fino a questa riga, costo compreso. */
  cumulato: Centesimi;
}

export interface PianoFlussi {
  /** Una riga per data: l'acquisto, poi cedole e rimborso fino a scadenza. */
  righe: RigaFlusso[];
  /** Commissioni d'acquisto della tariffa, già dentro il costo. */
  commissioni: Centesimi;
  /** Il costo netto di «Se lo compro». */
  costo: Centesimi;
  /** Cedole nette più rimborso netto: gli incassi dello YTM netto. */
  incassiNetti: Centesimi;
  /** Incassi − costo: il «Guadagno netto» di «Se lo compro». */
  guadagnoNetto: Centesimi;
  /** La prima data in cui il cumulato non è più negativo; null se non succede. */
  rientro: string | null;
}

/**
 * Il calendario dei soldi di chi compra oggi e tiene fino a scadenza:
 * l'acquisto al regolamento, le cedole, il rimborso a 100.
 *
 * `base` è il titolo comprato, già regolato (`parametriTitolo`), con nominale
 * e prezzo scelti; le commissioni si calcolano dalla tariffa come in
 * `simulaAcquisto`. Gli importi netti delle date sono quelli di `flussiNetti`,
 * gli stessi dello YTM netto: qui si aggiungono solo l'acquisto, il lordo e
 * il cumulato. Semplificazioni del motore: la prima cedola è tassata per
 * intero (lo storno sul rateo è nel costo) e le cedole non si reinvestono.
 * A scadenza non c'è commissione di vendita.
 *
 * Null se il titolo scade prima del regolamento o il costo non è positivo,
 * come `simulaAcquisto`.
 */
export function pianoFlussi(base: ParametriBond, tariffa: TariffaMercato): PianoFlussi | null {
  if (base.dataRiferimento >= base.dataScadenza) return null;
  const controvalore = controvaloreCents(base.quantita, base.prezzo);
  const commissioni = commissione({ tariffa, controvalore });
  const p: ParametriBond = { ...base, commissioni };
  const costo = esborsoNetto(p);
  if (costo <= 0) return null;

  const addebito = controvalore + rateoAllaData(p) + commissioni;
  const acquistoNetto = -costo;
  const righe: RigaFlusso[] = [
    {
      data: p.dataRiferimento,
      tipo: "acquisto",
      lordo: -addebito,
      imposte: acquistoNetto + addebito,
      netto: acquistoNetto,
      cumulato: acquistoNetto,
    },
  ];

  const lordeCedole = new Map(cedoleFuture(p).map((c) => [c.data, c.lorda]));
  const rimborsoLordo = controvaloreCents(p.quantita, 100);
  let cumulato = acquistoNetto;
  let incassiNetti = 0;
  for (const f of flussiNetti(p)) {
    const cedola = lordeCedole.get(f.data) ?? 0;
    const eScadenza = f.data === p.dataScadenza;
    const lordo = cedola + (eScadenza ? rimborsoLordo : 0);
    cumulato += f.importo;
    incassiNetti += f.importo;
    righe.push({
      data: f.data,
      tipo: eScadenza ? (cedola > 0 ? "cedolaRimborso" : "rimborso") : "cedola",
      lordo,
      imposte: f.importo - lordo,
      netto: f.importo,
      cumulato,
    });
  }
  return {
    righe,
    commissioni,
    costo,
    incassiNetti,
    guadagnoNetto: incassiNetti - costo,
    rientro: righe.find((r) => r.cumulato >= 0)?.data ?? null,
  };
}
