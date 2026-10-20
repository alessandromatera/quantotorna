import type { CategoriaStrumento } from "./categorie";

/**
 * Link alla scheda di Borsa Italiana di un titolo, per approfondire. Solo
 * href aperti dal browser di chi guarda: il sito non fa chiamate a questi
 * URL. La sezione dell'URL dipende dalla categoria, e non sono
 * intercambiabili: un ISIN chiesto sulla sezione sbagliata NON dà 404, dà un
 * rimbalzo alla pagina di ricerca.
 */
export interface LinkEsterno {
  url: string;
  fonte: string;
}

const SEZIONE_MOT: Record<CategoriaStrumento, string> = {
  btpFisso: "btp",
  ccteu: "cct",
  btpItalia: "btp-italia",
  bot: "bot",
  titoloStatoEstero: "euro-obbligazioni",
  sovranazionale: "obbligazioni-euro",
};

export function linkInformativo(titolo: {
  isin: string;
  categoria: CategoriaStrumento;
}): LinkEsterno {
  const { isin, categoria } = titolo;
  return {
    url: `https://www.borsaitaliana.it/borsa/obbligazioni/mot/${SEZIONE_MOT[categoria]}/scheda/${isin}-MOTX.html?lang=it`,
    fonte: "Borsa Italiana",
  };
}
