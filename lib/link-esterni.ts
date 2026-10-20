import type { TipoCatalogo } from "./categorie";

/**
 * Link alla scheda di Borsa Italiana di un titolo, per approfondire. Solo
 * href aperti dal browser di chi guarda: il sito non fa chiamate a questi
 * URL.
 *
 * La sezione dell'URL è quella del listino da cui il titolo arriva (vedi
 * `LISTINI` in lib/prezzi/borsaitaliana.ts), l'unica scheda che sappiamo
 * esistere: un ISIN chiesto sulla sezione sbagliata NON dà 404, dà un
 * rimbalzo alla pagina di ricerca. Per questo non si deduce dalla categoria
 * fiscale, che mette gli strip italiani coi BOT e i BTP€i coi BTP fissi.
 */
export interface LinkEsterno {
  url: string;
  fonte: string;
}

export function sezioneListino(titolo: { tipo: TipoCatalogo; emittente: string }): string {
  if (titolo.emittente !== "IT") return "euro-obbligazioni";
  if (titolo.tipo === "ccteu") return "cct";
  if (titolo.tipo === "bot") return "bot";
  // Tasso fisso, step-up, strip, BTP€i e BTP Italia stanno tutti nel
  // listino dei BTP.
  return "btp";
}

export function linkInformativo(titolo: {
  isin: string;
  tipo: TipoCatalogo;
  emittente: string;
}): LinkEsterno {
  return {
    url: `https://www.borsaitaliana.it/borsa/obbligazioni/mot/${sezioneListino(titolo)}/scheda/${titolo.isin}-MOTX.html?lang=it`,
    fonte: "Borsa Italiana",
  };
}
