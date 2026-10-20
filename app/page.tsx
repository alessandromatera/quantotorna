import { Mercato } from "@/components/mercato";
import { Intestazione } from "@/components/ui";
import { caricaCatalogo } from "@/lib/catalogo/file";
import { metricheCatalogo } from "@/lib/catalogo/metriche";
import { formatDataIT } from "@/lib/client/format";

/**
 * La pagina dei titoli. Gira alla compilazione: legge il catalogo del
 * giorno, ne calcola le metriche col motore e passa al browser le righe già
 * pronte. Quello che dipende da chi guarda — nominale, prezzo, commissioni,
 * zainetto — lo ricalcola il browser con le stesse funzioni.
 */
export default function Pagina() {
  const catalogo = caricaCatalogo();
  const metriche = metricheCatalogo(catalogo);
  return (
    <div className="space-y-4">
      <Intestazione
        titolo="Quanto torna davvero un titolo di Stato"
        descrizione={
          <>
            Rendimento netto secondo il fisco italiano e cifra finale in euro, tenendolo fino a
            scadenza, per BTP, BOT, CCTeu e titoli di Stato esteri e sovranazionali quotati sul
            MOT. Prezzi di chiusura del <strong>{formatDataIT(catalogo.data)}</strong>; i conti
            sono fatti a quella data, con regolamento a due giorni lavorativi.
          </>
        }
      />
      <Mercato metriche={metriche} euribor6m={catalogo.euribor6m} rapporto={catalogo.rapporto} />
    </div>
  );
}
