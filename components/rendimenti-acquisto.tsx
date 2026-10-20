"use client";

import { Termine } from "@/components/termine";
import type { Simulazione } from "@/lib/bond/acquisto";
import { formatDataIT, formatEuro, formatEuroSegno, formatNumero, formatPct } from "@/lib/client/format";

const CADENZA: Record<number, string> = {
  1: "una l'anno",
  2: "semestrali",
  4: "trimestrali",
};

/**
 * Tutti i rendimenti di un acquisto, calcolati dal motore sullo stesso
 * costo: i tre YTM — netto, lordo, netto se lo zainetto assorbe la
 * plusvalenza — e gli stessi soldi in euro, divisi fra cedole e rimborso
 * perché si veda da dove viene il guadagno. Le cedole più il rimborso fanno
 * gli incassi netti al centesimo: sono i flussi dello YTM, non una stima a
 * parte.
 */
export function RendimentiAcquisto({
  s,
  mostraCosto = true,
}: {
  s: Simulazione;
  /** Il costo netto in testa; dove sopra c'è già il conto del regolamento, no. */
  mostraCosto?: boolean;
}) {
  const { cedole, rimborso, rendimento } = s;
  const righe: { voce: React.ReactNode; importo: number; forte?: boolean; segno?: boolean }[] = [];
  if (mostraCosto) {
    righe.push({
      voce: (
        <>
          Costo netto al regolamento del {formatDataIT(s.dataRegolamento)}
          <span className="block text-[var(--inchiostro-muto)]">
            addebito {formatEuro(s.addebito)}
            {s.addebito !== s.costoNetto &&
              (s.costoNetto < s.addebito
                ? `, meno ${formatEuro(s.addebito - s.costoNetto)} di crediti d'imposta`
                : `, più ${formatEuro(s.costoNetto - s.addebito)} d'imposta sullo scarto`)}
          </span>
        </>
      ),
      importo: s.costoNetto,
    });
  }
  const cadenza = CADENZA[cedole.perAnno] ?? `${cedole.perAnno} l'anno`;
  if (cedole.gruppi.length > 1) {
    // Step-up: dire «N cedole da X» con la prima sarebbe falso per tutte le
    // altre. Ogni gradino con quante cedole paga e da quando.
    righe.push({
      voce: (
        <>
          {cedole.numero} cedole nette, crescenti
          <span className="block text-[var(--inchiostro-muto)]">
            {cedole.gruppi
              .map(
                (g) =>
                  `${g.numero} da ${formatEuro(g.netta)} dal ${formatDataIT(g.dal)}`,
              )
              .join(", ")}
            , {cadenza}
          </span>
        </>
      ),
      importo: cedole.totaleNetto,
    });
  } else if (cedole.numero > 0) {
    righe.push({
      voce: (
        <>
          {cedole.numero} {cedole.numero === 1 ? "cedola netta" : "cedole nette"} da{" "}
          {formatEuro(cedole.nettaPeriodo)}
          <span className="block text-[var(--inchiostro-muto)]">
            {formatEuro(cedole.lordaPeriodo)} lorde, {cadenza}
          </span>
        </>
      ),
      importo: cedole.totaleNetto,
    });
  }
  const impostaRimborso = rimborso.impostaPlusvalenza + rimborso.impostaDisaggio;
  righe.push({
    voce: (
      <>
        Rimborso netto a scadenza
        <span className="block text-[var(--inchiostro-muto)]">
          {formatNumero(s.nominale)} nominali
          {rimborso.impostaPlusvalenza > 0 &&
            `, meno ${formatEuro(rimborso.impostaPlusvalenza)} d'imposta sulla plusvalenza di ${formatEuro(rimborso.plusvalenza)}`}
          {rimborso.impostaDisaggio > 0 &&
            `, meno ${formatEuro(rimborso.impostaDisaggio)} d'imposta sul disaggio`}
          {impostaRimborso === 0 && rimborso.plusvalenza < 0 &&
            ` (sopra la pari: ${formatEuro(-rimborso.plusvalenza)} di minusvalenza per lo zainetto)`}
        </span>
      </>
    ),
    importo: rimborso.netto,
  });
  if (rendimento) {
    righe.push({ voce: "Incassi netti da qui alla scadenza", importo: rendimento.incassiNetti, forte: true });
    righe.push({
      voce: (
        <>
          Guadagno netto
          {rendimento.anniResidui >= 1 && (
            <span className="block text-[var(--inchiostro-muto)]">
              {formatEuroSegno(rendimento.guadagnoNettoAnnuo)} l'anno per{" "}
              {formatNumero(rendimento.anniResidui, 1)} anni
            </span>
          )}
        </>
      ),
      importo: rendimento.guadagnoNetto,
      forte: true,
      segno: true,
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
        <dt>
          <Termine chiave="ytmNetto">YTM netto</Termine>
          <span className="block text-xs text-[var(--inchiostro-muto)]">imposte e commissioni comprese</span>
        </dt>
        <dd className="cifre-tabellari text-right text-lg font-semibold">
          {s.ytmNettoPct == null ? "—" : formatPct(s.ytmNettoPct)}
        </dd>
        <dt>
          <Termine chiave="ytmLordo">YTM lordo</Termine>
          <span className="block text-xs text-[var(--inchiostro-muto)]">di mercato: prima di imposte e commissioni</span>
        </dt>
        <dd className="cifre-tabellari text-right">{s.ytmLordoPct == null ? "—" : formatPct(s.ytmLordoPct)}</dd>
        {s.ytmNettoSenzaCgPct != null && s.ytmNettoSenzaCgPct !== s.ytmNettoPct && (
          <>
            <dt>
              <Termine chiave="ytmNettoSenzaCg">YTM netto con lo zainetto</Termine>
              <span className="block text-xs text-[var(--inchiostro-muto)]">
                se minusvalenze da compensare assorbono la plusvalenza a rimborso
              </span>
            </dt>
            <dd className="cifre-tabellari text-right">{formatPct(s.ytmNettoSenzaCgPct)}</dd>
          </>
        )}
      </dl>
      <table className="cifre-tabellari w-full text-sm">
        <tbody>
          {righe.map((r, i) => (
            <tr key={i} className={r.forte ? "border-t border-[var(--bordo)] font-semibold" : ""}>
              <td className="py-1 pr-3 align-top">{r.voce}</td>
              <td
                className={`whitespace-nowrap py-1 text-right align-top ${r.segno ? "text-base" : ""}`}
                style={r.segno ? { color: r.importo >= 0 ? "var(--delta-buono)" : "var(--stato-critico)" } : undefined}
              >
                {r.segno ? formatEuroSegno(r.importo) : formatEuro(r.importo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--inchiostro-muto)]">
        Fino al {formatDataIT(s.dataScadenza)}, tenendo il titolo fino al rimborso.
      </p>
    </div>
  );
}
