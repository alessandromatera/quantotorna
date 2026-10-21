import { caricaCatalogo } from "@/lib/catalogo/file";
import { metricheCatalogo } from "@/lib/catalogo/metriche";
import { rendimentiInMarkdown } from "@/lib/catalogo/testo";

/**
 * /rendimenti.md: i numeri del giorno in tabelle Markdown, per chi legge il
 * sito senza eseguire JavaScript. Gli stessi della pagina compilata.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(rendimentiInMarkdown(metricheCatalogo(caricaCatalogo())), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
