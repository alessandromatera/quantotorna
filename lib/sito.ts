/**
 * Chi fa il sito e dove sta il codice. L'AGPL chiede di offrire il codice a
 * chi usa il servizio: il link sta in ogni pagina, nel piè di pagina.
 */
export const AUTORE = "Alessandro Matera";

/** La repo pubblica del codice. */
export const URL_CODICE = "https://github.com/alessandromatera/quantotorna";

/** Il dominio del sito: indirizzo canonico per i motori di ricerca, le anteprime e llms.txt. */
export const URL_SITO = "https://quantotorna.it";

/**
 * Le voci Open Graph uguali per ogni pagina, immagine compresa
 * (app/anteprima.png): una pagina che ne dà di sue le sostituisce tutte.
 */
export const OPEN_GRAPH_SITO = {
  type: "website",
  locale: "it_IT",
  siteName: "quantotorna",
  images: [
    {
      url: "/anteprima.png",
      width: 1200,
      height: 630,
      alt: "quantotorna: quanto rende davvero un titolo di Stato",
    },
  ],
};
