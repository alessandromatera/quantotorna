"use client";

import { RendimentiAcquisto } from "@/components/rendimenti-acquisto";
import { Termine } from "@/components/termine";
import { Campo, classeCampo } from "@/components/ui";
import { simulaAcquisto, type Simulazione } from "@/lib/bond/acquisto";
import { parametriTitolo, type TitoloValutato } from "@/lib/catalogo/metriche";
import type { TariffaMercato } from "@/lib/costi/commissioni";
import {
  formatDataIT,
  formatEuro,
  formatNumero,
  formatPct,
  formatPrezzoMot,
  numeroInInput,
  parseNumeroIT,
  parseQuantitaIT,
} from "@/lib/client/format";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * «Se lo compro»: il conto del regolamento e tutti i rendimenti di un
 * acquisto, col nominale, il prezzo e la tariffa di chi guarda. Si apre con
 * un clic sulla riga. Il prezzo di partenza è la chiusura del MOT; chi ha
 * davanti la lettera del suo intermediario scrive quella.
 *
 * Tutto nel browser, con le stesse funzioni della tabella: a nominale di
 * riferimento, prezzo di chiusura e tariffa nulla i numeri coincidono.
 */
export function SimulaAcquisto({
  titolo,
  oggi,
  nominaleDiPartenza,
  tariffa,
  ytmTabella,
}: {
  titolo: TitoloValutato;
  /** Il giorno dei prezzi: l'acquisto si fa lì e si regola a T+2. */
  oggi: string;
  nominaleDiPartenza: number;
  tariffa: TariffaMercato;
  /** Lo YTM netto della riga, per dire di quanto si sposta. */
  ytmTabella: number | null;
}) {
  const [testoNominale, setTestoNominale] = useState(formatNumero(nominaleDiPartenza));
  const [testoPrezzo, setTestoPrezzo] = useState(numeroInInput(titolo.prezzo));
  // Il nominale delle condizioni arriva dal browser dopo la prima resa.
  useEffect(() => setTestoNominale(formatNumero(nominaleDiPartenza)), [nominaleDiPartenza]);
  const nominale = parseQuantitaIT(testoNominale);
  const prezzo = parseNumeroIT(testoPrezzo);
  const nominaleValido = nominale != null && nominale > 0 && nominale <= 100_000_000;
  const prezzoValido = prezzo != null && prezzo > 0 && prezzo < 1000;

  const s = useMemo(
    () =>
      nominaleValido && prezzoValido
        ? simulaAcquisto(parametriTitolo(titolo, oggi, nominale, prezzo), tariffa)
        : null,
    [titolo, oggi, nominale, prezzo, nominaleValido, prezzoValido, tariffa],
  );

  return (
    // Tre colonne come si leggono: cosa scrivi, quanto spendi, quanto torna.
    // Sul telefono una sotto l'altra, nello stesso ordine.
    <section className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(11rem,auto)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
          Cosa compri
        </h4>
        <div className="flex flex-wrap gap-3 lg:flex-col">
          <Campo etichetta="Nominale">
            <input
              type="text"
              inputMode="decimal"
              value={testoNominale}
              aria-invalid={!nominaleValido}
              onChange={(e) => setTestoNominale(e.target.value)}
              className={`${classeCampo} w-36`}
            />
          </Campo>
          <Campo etichetta="Prezzo" suggerimento={`chiusura del ${formatDataIT(oggi)}: ${formatPrezzoMot(titolo.prezzo)}`}>
            <input
              type="text"
              inputMode="decimal"
              value={testoPrezzo}
              aria-invalid={!prezzoValido}
              onChange={(e) => setTestoPrezzo(e.target.value)}
              className={`${classeCampo} w-36`}
            />
          </Campo>
        </div>
      </div>
      {!nominaleValido || !prezzoValido ? (
        <p className="text-sm text-[var(--stato-critico)] lg:col-span-2">
          Scrivi un nominale (es. «10.000») e un prezzo in base 100 (es. «98,45»).
        </p>
      ) : s == null ? (
        <p className="text-sm text-[var(--inchiostro-muto)] lg:col-span-2">
          Il titolo scade prima del regolamento: non c'è un rendimento da calcolare.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
              Quanto spendi
            </h4>
            <Conto s={s} />
          </div>
          <div className="space-y-2">
            <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
              Quanto torna
            </h4>
            <RendimentiAcquisto s={s} mostraCosto={false} />
            {ytmTabella != null && s.ytmNettoPct != null && s.ytmNettoPct !== ytmTabella && (
              <p className="text-xs text-[var(--inchiostro-muto)]">
                Nella tabella: {formatPct(ytmTabella)} netto, su 10.000 nominali alla chiusura
                e senza commissioni.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Il conto del regolamento, riga per riga: quello che si vedrebbe sull'estratto. */
function Conto({ s }: { s: Simulazione }) {
  const righe: { voce: ReactNode; importo: number; segno: "" | "+" | "−"; forte?: boolean }[] = [
    {
      voce: `Controvalore (${formatNumero(s.nominale)} a ${formatPrezzoMot(s.prezzo)})`,
      importo: s.controvalore,
      segno: "",
    },
    {
      voce: (
        <>
          <Termine chiave="rateo">Rateo</Termine> lordo al regolamento del{" "}
          {formatDataIT(s.dataRegolamento)}
        </>
      ),
      importo: s.rateo,
      segno: "+",
    },
    { voce: "Commissioni (le tue condizioni)", importo: s.commissioni, segno: "+" },
    { voce: "Addebito sul conto", importo: s.addebito, segno: "", forte: true },
  ];
  if (s.stornoRateo > 0) {
    righe.push({ voce: "Imposta sul rateo, rimborsata", importo: s.stornoRateo, segno: "−" });
  }
  if (s.creditoDisaggio > 0) {
    righe.push({ voce: "Credito sul disaggio già maturato", importo: s.creditoDisaggio, segno: "−" });
  }
  if (s.impostaScarto > 0) {
    righe.push({ voce: "Imposta sullo scarto residuo (BOT)", importo: s.impostaScarto, segno: "+" });
  }
  if (s.costoNetto !== s.addebito) {
    righe.push({ voce: "Costo netto", importo: s.costoNetto, segno: "", forte: true });
  }
  return (
    <table className="cifre-tabellari w-full text-sm">
      <tbody>
        {righe.map((r, i) => (
          <tr key={i} className={r.forte ? "border-t border-[var(--bordo)] font-semibold" : ""}>
            <td className="py-1 pr-3 align-top">{r.voce}</td>
            <td className="w-4 py-1 text-right align-top text-[var(--inchiostro-muto)]">{r.segno}</td>
            <td className="whitespace-nowrap py-1 text-right align-top">{formatEuro(r.importo)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
