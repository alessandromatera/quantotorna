"use client";

import { Termine } from "@/components/termine";
import { TabellaConto } from "@/components/ui";
import { pianoFlussi, type RigaFlusso, type TipoFlusso } from "@/lib/bond/flussi";
import { parametriTitolo, type TitoloValutato } from "@/lib/catalogo/metriche";
import type { TariffaMercato } from "@/lib/costi/commissioni";
import {
  formatDataIT,
  formatEuro,
  formatEuroSegno,
  formatNumero,
  formatPrezzoMot,
} from "@/lib/client/format";
import { useMemo } from "react";

const VOCE: Record<TipoFlusso, string> = {
  acquisto: "Acquisto",
  cedola: "Cedola",
  cedolaRimborso: "Cedola e rimborso a 100",
  rimborso: "Rimborso a 100",
};

/**
 * «Flussi di cassa»: il calendario dei soldi di chi compra oggi al prezzo di
 * chiusura e tiene fino a scadenza, col nominale e la tariffa delle sue
 * condizioni. Una riga per data; il totale è il guadagno netto di «Se lo
 * compro». Tutto viene da `pianoFlussi`: qui si impagina soltanto.
 */
export function FlussiCassa({
  titolo,
  oggi,
  nominale,
  tariffa,
}: {
  titolo: TitoloValutato;
  /** Il giorno dei prezzi: l'acquisto si fa lì e si regola a T+2. */
  oggi: string;
  nominale: number;
  tariffa: TariffaMercato;
}) {
  const piano = useMemo(
    () => pianoFlussi(parametriTitolo(titolo, oggi, nominale), tariffa),
    [titolo, oggi, nominale, tariffa],
  );

  if (piano == null) {
    return (
      <p className="text-sm text-[var(--inchiostro-muto)]">
        Il titolo scade prima del regolamento: non c'è un calendario da mostrare.
      </p>
    );
  }
  const commissioni =
    piano.commissioni > 0
      ? `commissioni di ${formatEuro(piano.commissioni)}`
      : "senza commissioni";
  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--inchiostro-2)]">
        Su {formatNumero(nominale)} € nominali comprati al prezzo di chiusura del{" "}
        {formatDataIT(oggi)} ({formatPrezzoMot(titolo.prezzo)}), {commissioni}, e tenuti fino a
        scadenza. Le <Termine chiave="cedola">cedole</Termine> restano sul conto: non si
        reinvestono. Il conto dell'acquisto riga per riga sta in «Se lo compro».
      </p>
      <div className="overflow-x-auto">
        <table className="cifre-tabellari w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Flussi di cassa del titolo, una riga per data</caption>
          <thead>
            <tr className="border-b border-[var(--bordo)] text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
              <th scope="col" className="py-1 pr-3 text-left font-medium">Data</th>
              <th scope="col" className="py-1 pr-3 text-left font-medium">Voce</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">Lordo</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">Imposte</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">Netto</th>
              <th scope="col" className="py-1 text-right font-medium">Cumulato</th>
            </tr>
          </thead>
          <tbody>
            {piano.righe.map((r) => (
              <Riga key={`${r.data}-${r.tipo}`} r={r} rientro={r.data === piano.rientro} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="max-w-md">
        <TabellaConto
          righe={[
            { voce: "Incassi netti (cedole e rimborso)", importo: piano.incassiNetti, segno: "" },
            { voce: "Costo netto dell'acquisto", importo: piano.costo, segno: "−" },
            { voce: "Guadagno netto", importo: piano.guadagnoNetto, segno: "", forte: true },
          ]}
        />
      </div>
      <p className="text-xs text-[var(--inchiostro-muto)]">
        {piano.rientro
          ? `Si rientra del costo il ${formatDataIT(piano.rientro)}. `
          : "Il costo non rientra nemmeno a scadenza. "}
        Imposte negative sono pagate, positive rimborsate all'acquisto. La prima cedola è tassata
        per intero: l'imposta sul <Termine chiave="rateo">rateo</Termine> pagato è già stornata nel
        costo. A scadenza non c'è commissione di vendita.
      </p>
    </section>
  );
}

/**
 * Gli importi in uscita (flussi e imposte pagate) in rosso, lo stesso delle
 * perdite di «Se esco prima».
 */
function coloreUscita(importo: number) {
  return importo < 0 ? { color: "var(--stato-critico)" } : undefined;
}

function Riga({ r, rientro }: { r: RigaFlusso; rientro: boolean }) {
  return (
    <tr className={`border-b border-[var(--griglia)] ${r.tipo === "acquisto" ? "font-medium" : ""}`}>
      <td className="whitespace-nowrap py-1 pr-3 align-top">{formatDataIT(r.data)}</td>
      <td className="py-1 pr-3 align-top font-sans">
        {VOCE[r.tipo]}
        {rientro && (
          <div className="text-xs font-normal text-[var(--inchiostro-muto)]">Qui si rientra</div>
        )}
      </td>
      <td className="whitespace-nowrap py-1 pr-3 text-right align-top" style={coloreUscita(r.lordo)}>
        {formatEuroSegno(r.lordo)}
      </td>
      <td className="whitespace-nowrap py-1 pr-3 text-right align-top" style={coloreUscita(r.imposte)}>
        {formatEuroSegno(r.imposte)}
      </td>
      <td className="whitespace-nowrap py-1 pr-3 text-right align-top" style={coloreUscita(r.netto)}>
        {formatEuroSegno(r.netto)}
      </td>
      <td
        className="whitespace-nowrap py-1 text-right align-top"
        style={r.cumulato < 0 ? { color: "var(--inchiostro-muto)" } : undefined}
      >
        {formatEuroSegno(r.cumulato)}
      </td>
    </tr>
  );
}
