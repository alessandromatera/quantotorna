import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Niente entità HTML (&apos;, &amp;…) nei testi delle pagine. Il
 * compilatore di Next (SWC) toglie lo spazio iniziale a un testo JSX che va
 * a capo e contiene un'entità: «<strong>lordi</strong> da entrambe…» usciva
 * «lordida entrambe». In JSX l'apostrofo semplice è valido, e basta quello.
 */
function sorgenti(cartella: string): string[] {
  return readdirSync(cartella).flatMap((nome) => {
    const percorso = join(cartella, nome);
    if (statSync(percorso).isDirectory()) return sorgenti(percorso);
    return percorso.endsWith(".tsx") ? [percorso] : [];
  });
}

describe("testi delle pagine", () => {
  it("non contengono entità HTML", () => {
    const conEntita = ["app", "components"]
      .flatMap(sorgenti)
      .filter((f) => /&(?:[a-z]+|#\d+);/i.test(readFileSync(f, "utf8")));
    expect(conEntita).toEqual([]);
  });
});
