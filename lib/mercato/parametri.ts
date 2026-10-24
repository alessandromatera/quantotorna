import type { GradinoCedola } from "../bond/cedole";
import { perAcquisto, type ParametriBond } from "../bond/ytm";
import type { TipoCatalogo } from "../categorie";
import { cedolaUnicaPerIlMotore, type CedolaUnica } from "./cedola-unica";

/**
 * Prezzo e data di emissione di un titolo, quando si conoscono: decidono il
 * disaggio (vedi lib/bond/ytm.ts). Senza, il titolo è trattato come emesso
 * alla pari.
 */
export interface DatiEmissione {
  prezzoEmissione?: number;
  dataEmissione?: string;
}

/** Quanto basta di una riga del catalogo per valutarne l'acquisto. */
export interface RigaCatalogoValutabile {
  tipo: TipoCatalogo;
  emittente: string;
  prezzo: number;
  cedolaAnnua: number;
  frequenzaCedola: number;
  dataScadenza: string;
  /** Solo sugli step-up: il piano delle cedole. */
  gradiniCedola?: GradinoCedola[] | null;
  /** Solo sulla cedola unica (BTP Valore Insieme). */
  cedolaUnica?: CedolaUnica;
}

/**
 * I parametri del motore per l'ACQUISTO di oggi di un titolo del catalogo,
 * regolato a T+2 (`perAcquisto`): storno dell'imposta sul rateo, credito sul
 * disaggio già maturato o imposta sullo scarto residuo dentro l'esborso —
 * come lo vede chi compra davvero.
 * Senza, i titoli a poche settimane dalla scadenza uscivano con uno YTM netto
 * negativo che nella realtà non esiste.
 *
 * Unico punto in cui la famiglia di catalogo diventa una categoria fiscale,
 * e in cui un CCTeu prende la sua convenzione ACT/360: scaricamento
 * giornaliero, tabella e simulazioni devono vedere gli stessi numeri.
 * La data di emissione è anche il godimento da cui matura la prima cedola.
 * Una cedola unica diventa un solo periodo cedolare dal godimento alla
 * scadenza, col rateo in 30E/360; finché è il minimo del collocamento non
 * c'è niente da calcolare, e chiederlo è un errore.
 */
export function parametriAcquistoCatalogo(
  r: RigaCatalogoValutabile,
  oggi: string,
  emissione: DatiEmissione | undefined,
  quantita: number,
): ParametriBond {
  // Uno zero coupon estero con prezzo e data di emissione noti (BEI, strip
  // francesi) ha un disaggio come qualunque titolo emesso sotto la pari:
  // credito all'acquisto, addebito a scadenza. Lo scarto tassato in anticipo
  // è solo dei BOT.
  if (r.tipo === "cedolaUnica" && !r.cedolaUnica?.definitiva) {
    throw new Error("cedola unica non definitiva: il rendimento non si calcola sul minimo del collocamento");
  }
  const unica = r.tipo === "cedolaUnica" ? r.cedolaUnica! : null;
  const zeroCouponConEmissione =
    r.tipo === "zeroCoupon" &&
    r.emittente !== "IT" &&
    emissione?.prezzoEmissione != null &&
    emissione.dataEmissione != null;
  return perAcquisto({
    // `bot` non è un'etichetta ma il modo in cui il motore fiscale tratta lo
    // scarto: sui BOT veri con i dati di emissione, scarto tassato in
    // anticipo e plusvalenza sul prezzo teorico; sugli strip italiani e su
    // ogni titolo senza dati, il modello semplificato (12,5% pieno sul
    // differenziale, fuori dallo zainetto). Vedi `isScartoAnticipato`.
    categoria:
      r.tipo === "bot" || (r.tipo === "zeroCoupon" && !zeroCouponConEmissione)
        ? "bot"
        : r.emittente !== "IT"
          ? // Stati white list e sovranazionali: 12,5% come i titoli italiani.
            "titoloStatoEstero"
          : "btpFisso",
    quantita,
    prezzo: r.prezzo,
    prezzoCarico: r.prezzo,
    cedolaAnnua: r.cedolaAnnua,
    frequenzaCedola: r.frequenzaCedola,
    ...(r.gradiniCedola ? { gradiniCedola: r.gradiniCedola } : {}),
    // Il Tesoro conta cedole e rateo dei CCTeu sui giorni effettivi / 360.
    ...(r.tipo === "ccteu" ? { convenzioneCedola: "act360" as const } : {}),
    ...(unica
      ? { ...cedolaUnicaPerIlMotore(unica, r.dataScadenza), convenzioneCedola: "30E360" as const }
      : {}),
    dataScadenza: r.dataScadenza,
    dataRiferimento: oggi,
    // Gli strip italiani nascono dalla separazione di un BTP: un «prezzo di
    // emissione» trovato per loro non sarebbe quello che decide l'imposta,
    // e senza cedole un godimento non serve.
    ...(r.tipo === "zeroCoupon" && r.emittente === "IT" ? {} : emissione),
    // Il periodo della cedola unica parte dal godimento della scheda.
    ...(unica ? { dataEmissione: unica.godimento } : {}),
  });
}
