import type { Metadata } from "next";
import { Mercato } from "@/components/mercato";
import { Dati, Dato, Testata } from "@/components/ui";
import { caricaCatalogo } from "@/lib/catalogo/file";
import { metricheCatalogo, titoliInElenco } from "@/lib/catalogo/metriche";
import { formatDataIT, formatMeseIT, formatPct } from "@/lib/client/format";
import { AUTORE, URL_AUTORE, URL_SITO } from "@/lib/sito";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * La pagina dei titoli. Gira alla compilazione: legge il catalogo del
 * giorno, ne calcola le metriche col motore e passa al browser le righe già
 * pronte. Quello che dipende da chi guarda — nominale, prezzo, commissioni,
 * zainetto — lo ricalcola il browser con le stesse funzioni.
 */
export default function Pagina() {
  const catalogo = caricaCatalogo();
  const metriche = metricheCatalogo(catalogo);
  const quanti = titoliInElenco(metriche);
  /*
   * Per i motori di ricerca: il sito, e i numeri del giorno come insieme di
   * dati (lo legge anche Google Dataset Search), con i due file da scaricare.
   * Nessuna licenza dichiarata: i prezzi sono di Borsa Italiana.
   */
  const datiStrutturati = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${URL_SITO}/#sito`,
        url: `${URL_SITO}/`,
        name: "quantotorna",
        inLanguage: "it",
      },
      {
        "@type": "Dataset",
        name: "Rendimenti netti dei titoli di Stato quotati sul MOT",
        description: `Rendimento netto secondo il fisco italiano, YTM lordo e cifra finale in euro di ${quanti} titoli di Stato italiani, esteri e sovranazionali quotati sul MOT di Borsa Italiana, ai prezzi di chiusura del ${formatDataIT(catalogo.data)}. Aggiornato ogni giorno feriale.`,
        url: `${URL_SITO}/`,
        inLanguage: "it",
        isAccessibleForFree: true,
        dateModified: catalogo.data,
        temporalCoverage: catalogo.data,
        creator: { "@type": "Person", name: AUTORE, url: URL_AUTORE },
        includedInDataCatalog: { "@id": `${URL_SITO}/#sito` },
        distribution: [
          {
            "@type": "DataDownload",
            encodingFormat: "text/markdown",
            contentUrl: `${URL_SITO}/rendimenti.md`,
          },
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `${URL_SITO}/dati/catalogo.json`,
          },
        ],
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        // Come nella guida di Next: «<» scritto in modo che non possa chiudere lo script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datiStrutturati).replace(/</g, "\\u003c") }}
      />
      <Testata
        titolo="Quanto torna davvero un titolo di Stato"
        sottotitolo={
          <>
            Rendimento netto secondo il fisco italiano e cifra finale in euro, tenendolo fino a
            scadenza, per BTP, BOT, CCTeu e titoli di Stato esteri e sovranazionali quotati sul
            MOT. I conti sono fatti alla data dei prezzi, con regolamento a due giorni lavorativi.
          </>
        }
      >
        {/* Solo dati, nessun numero calcolato: di che giorno sono i prezzi,
            quanti titoli, e i due riferimenti che valgono per tutta la
            pagina. */}
        <Dati>
          <Dato etichetta="Prezzi" valore={formatDataIT(catalogo.data)} nota="chiusura del MOT" />
          <Dato etichetta="Titoli" valore={quanti} nota="Italia, esteri e sovranazionali" />
          <Dato etichetta="Imposta" valore="12,5%" nota="titoli di Stato e white list" />
          <Dato
            etichetta="Euribor 6 mesi"
            valore={catalogo.euribor6m ? formatPct(catalogo.euribor6m.percentuale, 3) : "—"}
            nota={catalogo.euribor6m ? `media BCE, ${formatMeseIT(catalogo.euribor6m.periodo)}` : "oggi non letto"}
          />
        </Dati>
      </Testata>
      <Mercato metriche={metriche} euribor6m={catalogo.euribor6m} rapporto={catalogo.rapporto} />
    </>
  );
}
