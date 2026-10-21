"use client";

import type { PaginaTabella } from "@/lib/mercato/pagine";

function nome(p: PaginaTabella<unknown>): string {
  return p.anni.length > 0 ? `Scadenza ${p.etichetta}` : `Righe ${p.etichetta}`;
}

/**
 * In cima alla tabella: tutte le pagine, per saltare a un anno. Bottoni
 * normali e non schede (`role="tab"`): le schede della pagina sono le tre
 * famiglie di titoli, e chi le legge non deve confonderle con gli anni.
 */
export function ElencoPagine({
  pagine,
  indice,
  onScegli,
}: {
  pagine: PaginaTabella<unknown>[];
  indice: number;
  onScegli: (indice: number) => void;
}) {
  if (pagine.length < 2) return null;
  const perAnno = pagine[0].anni.length > 0;
  return (
    // Sul telefono una riga sola che scorre di lato; da 640 px va a capo.
    <nav
      aria-label={perAnno ? "Anni di scadenza" : "Pagine della tabella"}
      className="flex items-center gap-1 overflow-x-auto border-b border-[var(--bordo)] px-4 py-2 sm:flex-wrap"
    >
      <span className="mr-1 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
        {perAnno ? "Scadenza" : "Righe"}
      </span>
      {pagine.map((p, i) => {
        const attiva = i === indice;
        return (
          <button
            key={p.etichetta}
            type="button"
            aria-pressed={attiva}
            aria-label={perAnno ? `${nome(p)}, ${p.righe} ${p.righe === 1 ? "titolo" : "titoli"}` : nome(p)}
            onClick={() => onScegli(i)}
            className={`cifre-tabellari flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-md px-2 py-1 text-sm transition-colors ${
              attiva
                ? "bg-[var(--accento-pieno)] font-medium text-white"
                : "text-[var(--inchiostro-2)] hover:bg-[var(--superficie-2)]"
            }`}
          >
            {p.etichetta}
            {perAnno && (
              <span className={`text-xs ${attiva ? "text-white/80" : "text-[var(--inchiostro-muto)]"}`}>
                {p.righe}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** In fondo alla tabella: la pagina prima e quella dopo, per chi arriva all'ultima riga. */
export function AvantiIndietro({
  pagine,
  indice,
  onScegli,
}: {
  pagine: PaginaTabella<unknown>[];
  indice: number;
  onScegli: (indice: number) => void;
}) {
  if (pagine.length < 2) return null;
  const prima = pagine[indice - 1];
  const dopo = pagine[indice + 1];
  const bottone = "rounded-md px-2 py-1 font-medium text-[var(--accento)] hover:bg-[var(--superficie-2)]";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--bordo)] px-4 py-3 text-sm">
      {prima ? (
        <button type="button" onClick={() => onScegli(indice - 1)} className={bottone}>
          ← {nome(prima)}
        </button>
      ) : (
        <span />
      )}
      <span className="cifre-tabellari text-[var(--inchiostro-muto)]">
        {indice + 1} di {pagine.length}
      </span>
      {dopo ? (
        <button type="button" onClick={() => onScegli(indice + 1)} className={bottone}>
          {nome(dopo)} →
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
