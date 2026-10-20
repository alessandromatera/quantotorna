/**
 * Aliquota sui redditi di capitale (cedole, rateo, disaggio e scarto di
 * emissione) dei titoli di Stato italiani, della white list e dei
 * sovranazionali. Sono gli unici titoli che quantotorna tratta (vedi
 * lib/categorie.ts), quindi è l'unica aliquota sui redditi di capitale.
 */
export const ALIQUOTA_AGEVOLATA = 0.125;

/** Aliquota dei redditi diversi, su cui si applica la riduzione qui sotto. */
export const ALIQUOTA_ORDINARIA = 0.26;

/**
 * DM 13/12/2011: per i redditi diversi da titoli di Stato e assimilati la
 * base imponibile è ridotta al 48,08%, così che il 26% nominale produca un
 * prelievo effettivo del 12,5% (in realtà 12,5008%: 0,26 × 0,4808).
 */
export const QUOTA_IMPONIBILE_TITOLI_STATO = 0.4808;
