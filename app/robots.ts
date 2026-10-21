import type { MetadataRoute } from "next";
import { URL_SITO } from "@/lib/sito";

/**
 * Tutto il sito è pubblico e si può leggere da chiunque: motori di ricerca
 * e modelli linguistici. Non c'è niente da tenere fuori.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${URL_SITO}/sitemap.xml`,
  };
}
