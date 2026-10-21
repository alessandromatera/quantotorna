import { caricaCatalogo } from "@/lib/catalogo/file";
import { metricheCatalogo } from "@/lib/catalogo/metriche";
import { llmsTxt } from "@/lib/catalogo/testo";

/**
 * /llms.txt: l'indice del sito per i modelli linguistici (llmstxt.org).
 * Si scrive alla compilazione, col conteggio e la data del catalogo.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(metricheCatalogo(caricaCatalogo())), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
