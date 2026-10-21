import type { MetadataRoute } from "next";
import { caricaCatalogo } from "@/lib/catalogo/file";
import { URL_SITO } from "@/lib/sito";

/** Le pagine del sito. I titoli cambiano ogni giorno con i prezzi, la metodologia quando cambia il motore. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${URL_SITO}/`,
      lastModified: caricaCatalogo().data,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${URL_SITO}/metodologia/`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
