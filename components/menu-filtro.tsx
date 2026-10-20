"use client";

import { Chevron } from "@/components/ui";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Un filtro della barra sopra la tabella: un bottone che dice quante scelte
 * sono accese e apre l'elenco sotto di sé. Si chiude con Esc, con un clic
 * fuori o col bottone stesso; le scelte valgono subito, senza «Applica».
 *
 * Sul telefono l'elenco è largo quanto la barra (che deve essere
 * `relative`): un menu ancorato a un bottone sul bordo destro uscirebbe
 * dallo schermo.
 */
export function MenuFiltro({
  etichetta,
  attivi,
  larghezza = "sm:w-72",
  children,
}: {
  etichetta: ReactNode;
  /** Quante scelte sono accese: compare nel bottone, che cambia colore. */
  attivi: number;
  /** Larghezza dell'elenco da `sm` in su. */
  larghezza?: string;
  children: ReactNode;
}) {
  const [aperto, setAperto] = useState(false);
  const radice = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aperto) return;
    function fuori(e: PointerEvent) {
      if (!radice.current?.contains(e.target as Node)) setAperto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAperto(false);
    }
    document.addEventListener("pointerdown", fuori);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuori);
      document.removeEventListener("keydown", esc);
    };
  }, [aperto]);

  return (
    <div ref={radice} className="sm:relative">
      <button
        type="button"
        aria-expanded={aperto}
        aria-controls={id}
        onClick={() => setAperto((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
          attivi > 0
            ? "border-[var(--accento)] bg-[var(--accento-tenue)] text-[var(--accento)]"
            : "border-[var(--bordo)] bg-[var(--superficie)] text-[var(--inchiostro)] hover:border-[var(--bordo-forte)]"
        }`}
      >
        {etichetta}
        {attivi > 0 && (
          <span className="cifre-tabellari rounded-sm bg-[var(--accento-pieno)] px-1.5 text-xs leading-5 text-white">
            {attivi}
          </span>
        )}
        <Chevron className={`-mr-1 text-[var(--inchiostro-muto)] ${aperto ? "-rotate-90" : "rotate-90"}`} />
      </button>
      {aperto && (
        <div
          id={id}
          className={`absolute inset-x-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-[var(--bordo)] bg-[var(--superficie)] p-1.5 shadow-[var(--ombra-menu)] sm:inset-x-auto sm:left-0 ${larghezza}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Una scelta dentro un menu: casella (più scelte insieme) o pallino (una
 * sola, e un secondo clic la toglie), il nome, e quanti titoli seleziona.
 * Spenta quando non ne seleziona nessuno: vederla spenta dice più che non
 * vederla.
 */
export function OpzioneFiltro({
  etichetta,
  conteggio,
  attivo,
  onCambia,
  unica = false,
}: {
  etichetta: ReactNode;
  conteggio?: number;
  attivo: boolean;
  onCambia: () => void;
  /** Scelta esclusiva fra le voci del suo menu. */
  unica?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={attivo}
      disabled={conteggio === 0}
      onClick={onCambia}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-[var(--inchiostro)] hover:bg-[var(--superficie-2)] disabled:opacity-40"
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
          unica ? "rounded-full" : "rounded-[3px]"
        } ${
          attivo
            ? "border-[var(--accento-pieno)] bg-[var(--accento-pieno)] text-white"
            : "border-[var(--bordo-forte)] bg-[var(--superficie)]"
        }`}
      >
        {attivo &&
          (unica ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          ) : (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2.5 6.2 2.3 2.3 4.7-5" />
            </svg>
          ))}
      </span>
      <span className="min-w-0 flex-1">{etichetta}</span>
      {conteggio != null && (
        <span className="cifre-tabellari text-xs text-[var(--inchiostro-muto)]">{conteggio}</span>
      )}
    </button>
  );
}

/** Titoletto e spiegazione dentro un menu, sopra o fra le scelte. */
export function NotaMenu({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pt-1.5 pb-1 text-xs text-[var(--inchiostro-muto)]">{children}</p>;
}
