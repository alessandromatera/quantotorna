import { caricaCatalogo } from "@/lib/catalogo/file";

/**
 * Il catalogo del giorno pubblicato col sito, in /dati/catalogo.json: dati
 * aperti per chi vuole rifare i conti, e la memoria dello scaricamento di
 * domani, che lo riscarica da qui (dati di emissione, piani degli step-up,
 * documenti del MEF già letti). Il formato è in lib/catalogo/formato.ts.
 *
 * Si scrive alla compilazione, come le pagine: già controllato da
 * `leggiCatalogo`, quindi chi lo riscarica trova la stessa forma.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(caricaCatalogo());
}
