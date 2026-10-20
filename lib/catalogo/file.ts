import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { leggiCatalogo, type Catalogo } from "./formato";

/**
 * Il catalogo dal disco, per la compilazione del sito e per lo scaricamento
 * del giorno dopo. Solo lato Node: la pagina riceve le metriche già pronte.
 */
export const PERCORSO_CATALOGO = join(process.cwd(), "dati", "catalogo.json");

export function caricaCatalogo(percorso = PERCORSO_CATALOGO): Catalogo {
  if (!existsSync(percorso)) {
    throw new Error(
      `manca ${percorso}: lo scrive lo scaricamento giornaliero (npm run scarica)`,
    );
  }
  return leggiCatalogo(JSON.parse(readFileSync(percorso, "utf8")));
}
