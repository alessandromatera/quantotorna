"use client";

import { formatPct } from "@/lib/client/format";
import type { ReactNode } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Vuoto } from "./ui";

/**
 * I grafici del sito.
 *
 * Regole seguite, le stesse della palette:
 * - gli slot categorici validati sono OTTO e una nona tinta non si genera:
 *   qui se ne usano al massimo tre per grafico, e sono sempre gli stessi
 *   slot per la stessa entità (l'Italia è il blu dei BTP in tutto il sito,
 *   non «la prima serie del grafico»);
 * - un solo asse dei valori per grafico: mai due scale y a confronto;
 * - la legenda c'è sempre da due serie in su, e l'identità non è mai
 *   affidata al solo colore — nel tooltip c'è il nome per esteso;
 * - griglia e assi recessivi, testo con i colori dell'inchiostro e non con
 *   quelli delle serie;
 * - tre tinte della palette stanno sotto il 3:1 di contrasto sul fondo
 *   chiaro: la regola vuole che ci sia un ripiego leggibile, ed è la tabella
 *   che sta sotto ogni grafico in queste pagine.
 */

const GRIGLIA = "var(--griglia)";
const ASSE = "var(--asse)";
const INCHIOSTRO_MUTO = "var(--inchiostro-muto)";

const STILE_TOOLTIP = {
  background: "var(--superficie)",
  border: "1px solid var(--bordo)",
  borderRadius: 8,
  color: "var(--inchiostro)",
  fontSize: 12,
} as const;

const ASSE_TICK = { fill: INCHIOSTRO_MUTO, fontSize: 11 };

/** Legenda: pallino colorato + nome in inchiostro, mai testo colorato. */
function Legenda({ voci }: { voci: { nome: string; colore: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--inchiostro-2)]">
      {voci.map((v) => (
        <li key={v.nome} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: v.colore }}
            aria-hidden
          />
          {v.nome}
        </li>
      ))}
    </ul>
  );
}

function Riquadro({
  altezza = 260,
  children,
}: {
  altezza?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ height: altezza }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Curva dei rendimenti: YTM netto contro anni alla scadenza.
 * ----------------------------------------------------------------------- */

export interface PuntoCurva {
  isin: string;
  nome: string;
  /** Anni alla scadenza. */
  anni: number;
  /** YTM netto in percentuale. */
  ytm: number;
  /** Etichetta breve dell'emittente, per il tooltip. */
  emittente: string;
  /** true se è un titolo italiano: decide la serie, non il colore ad hoc. */
  italiano: boolean;
}

/** Tacche dell'asse delle scadenze, in anni. */
const TACCHE_ANNI = [0, 1, 2, 5, 10, 20, 30, 50, 100];

/**
 * DUE serie e non una per emittente, ed è una scelta misurata: su un grafico
 * a punti la palette regge tre slot, e sul listino gli emittenti sono cinque.
 * La spaccatura utile è comunque quella fra Italia e Stati esteri — è lo
 * spread di credito a spiegare perché a parità di scadenza i BTP rendono di
 * più — mentre l'emittente esatto lo dice il tooltip.
 *
 * I colori sono quelli che le stesse categorie hanno in tutto il sito: il
 * blu dei BTP e il rosa dei titoli di Stato esteri. Il colore segue
 * l'entità, non la posizione nel grafico, quindi filtrare non ridipinge
 * niente.
 */
export function CurvaRendimenti({
  punti,
  coloreItalia,
  coloreEstero,
}: {
  punti: PuntoCurva[];
  coloreItalia: string;
  coloreEstero: string;
}) {
  if (punti.length === 0) {
    return <Vuoto>Nessun titolo con rendimento calcolato fra quelli filtrati.</Vuoto>;
  }
  const italiani = punti.filter((p) => p.italiano);
  const esteri = punti.filter((p) => !p.italiano);
  const serie = [
    { nome: "Italia", colore: coloreItalia, dati: italiani },
    { nome: "Stati esteri e sovranazionali", colore: coloreEstero, dati: esteri },
  ].filter((s) => s.dati.length > 0);
  // Asse delle scadenze in radice quadrata: sul MOT ci sono titoli a cento
  // anni, e su una scala lineare tutto quello che scade entro i trenta —
  // quasi l'intero listino — finirebbe schiacciato nel primo quarto.
  const massimo = Math.max(...punti.map((p) => p.anni));
  const tacche = TACCHE_ANNI.filter((t) => t <= massimo * 1.05);

  return (
    <div>
      <Riquadro>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRIGLIA} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="anni"
            name="Anni alla scadenza"
            scale="sqrt"
            domain={[0, "dataMax"]}
            ticks={tacche}
            tick={ASSE_TICK}
            stroke={ASSE}
            tickFormatter={(v: number) => `${Math.round(v)}a`}
          />
          <YAxis
            type="number"
            dataKey="ytm"
            name="YTM netto"
            tick={ASSE_TICK}
            stroke={ASSE}
            width={48}
            tickFormatter={(v: number) => formatPct(v, 1)}
          />
          <ZAxis range={[70, 70]} />
          <Tooltip
            cursor={{ stroke: ASSE, strokeDasharray: "3 3" }}
            contentStyle={STILE_TOOLTIP}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as PuntoCurva | undefined;
              if (!p) return null;
              return (
                <div style={STILE_TOOLTIP} className="px-2 py-1.5">
                  <div className="font-medium">{p.nome}</div>
                  <div className="text-[var(--inchiostro-2)]">
                    {p.emittente} · {p.anni.toFixed(1).replace(".", ",")} anni ·{" "}
                    {formatPct(p.ytm)} netto
                  </div>
                </div>
              );
            }}
          />
          {/* Gli esteri sono più del doppio: disegnati dopo coprirebbero
              l'Italia, che è il riferimento. La legenda resta nell'ordine. */}
          {[...serie].reverse().map((s) => (
            <Scatter
              key={s.nome}
              name={s.nome}
              data={s.dati}
              fill={s.colore}
              // Anello del colore del fondo: due punti sovrapposti restano
              // due punti invece di diventare una macchia.
              stroke="var(--superficie)"
              strokeWidth={2}
              // Seicento punti che entrano volando a ogni filtro sono solo
              // un ritardo prima di poter leggere il grafico.
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </Riquadro>
      {serie.length > 1 && <Legenda voci={serie} />}
    </div>
  );
}
