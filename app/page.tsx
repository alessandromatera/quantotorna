import { Mercato } from "@/components/mercato";
import { Dati, Dato, Testata } from "@/components/ui";
import { caricaCatalogo } from "@/lib/catalogo/file";
import { metricheCatalogo } from "@/lib/catalogo/metriche";
import { formatDataIT, formatMeseIT, formatPct } from "@/lib/client/format";

/**
 * La pagina dei titoli. Gira alla compilazione: legge il catalogo del
 * giorno, ne calcola le metriche col motore e passa al browser le righe già
 * pronte. Quello che dipende da chi guarda — nominale, prezzo, commissioni,
 * zainetto — lo ricalcola il browser con le stesse funzioni.
 */
export default function Pagina() {
  const catalogo = caricaCatalogo();
  const metriche = metricheCatalogo(catalogo);
  const quanti = metriche.flussiNoti.length + metriche.variabili.length + metriche.indicizzati.length;
  return (
    <>
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
