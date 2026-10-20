"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * La tabella si allunga con la pagina, che scorre da sola: niente riquadro
 * con uno scorrimento suo dentro quello della pagina.
 *
 * L'intestazione però deve restare ferma in cima allo schermo, e la sua non
 * può: il riquadro scorre di lato sul telefono (`overflow-x: auto`), e un
 * `sticky` dentro un riquadro così resta fermo solo rispetto a lui, non alla
 * pagina. Allora sopra la tabella c'è una copia dell'intestazione, fuori dal
 * riquadro e quindi ferma davvero, con le colonne larghe quanto quelle vere
 * e lo scorrimento laterale tenuto in pari. A riposo copre esattamente
 * l'intestazione vera, che resta nella tabella per chi usa un lettore di
 * schermo o la tastiera.
 *
 * Finché il browser non ha misurato le colonne la copia non c'è, e si vede
 * l'intestazione vera: la pagina compilata è già giusta da sola.
 */
export function ScorrimentoTabella({
  intestazione,
  colonne,
  children,
}: {
  /** La riga d'intestazione: la stessa che sta nella tabella. */
  intestazione: ReactNode;
  /** Le chiavi delle colonne: quando cambiano si rimisura da capo. */
  colonne: string;
  /** La tabella intera, con la sua intestazione. */
  children: ReactNode;
}) {
  const corpo = useRef<HTMLDivElement>(null);
  const testa = useRef<HTMLDivElement>(null);
  const [misure, setMisure] = useState<Misure | null>(null);

  useLayoutEffect(() => {
    const tabella = corpo.current?.querySelector<HTMLElement>(":scope > table");
    const riga = tabella?.querySelector<HTMLElement>(":scope > thead > tr");
    if (!tabella || !riga) return;
    const celle = [...riga.children] as HTMLElement[];
    const misura = () => {
      const nuove: Misure = {
        colonne: celle.map((c) => c.getBoundingClientRect().width),
        larghezza: tabella.getBoundingClientRect().width,
        altezza: riga.getBoundingClientRect().height,
      };
      setMisure((vecchie) => (vecchie && uguali(vecchie, nuove) ? vecchie : nuove));
    };
    const osservatore = new ResizeObserver(misura);
    celle.forEach((c) => osservatore.observe(c, { box: "border-box" }));
    osservatore.observe(tabella);
    misura();
    return () => osservatore.disconnect();
  }, [colonne]);

  // La copia si mostra già spostata di lato quanto la tabella.
  useLayoutEffect(() => {
    if (testa.current && corpo.current) testa.current.scrollLeft = corpo.current.scrollLeft;
  }, [misure]);

  // Nella copia si clicca col mouse e si tocca col dito; la tastiera passa
  // dall'intestazione vera, quindi qui niente fermate del tabulatore.
  useEffect(() => {
    testa.current?.querySelectorAll("button").forEach((b) => (b.tabIndex = -1));
  });

  return (
    <div className="tabella-ferma">
      {misure && (
        <div ref={testa} aria-hidden className="tabella-testa sticky top-0 z-[4] overflow-hidden">
          <table className="text-sm" style={{ tableLayout: "fixed", width: misure.larghezza }}>
            <colgroup>
              {misure.colonne.map((larghezza, i) => (
                <col key={i} style={{ width: larghezza }} />
              ))}
            </colgroup>
            <thead>{intestazione}</thead>
          </table>
        </div>
      )}
      <div
        ref={corpo}
        onScroll={() => {
          if (testa.current && corpo.current) testa.current.scrollLeft = corpo.current.scrollLeft;
        }}
        className="tabella-scroll overflow-x-auto"
        // L'intestazione vera passa sotto la copia, invece di ripetersi sotto di lei.
        style={misure ? { marginTop: -misure.altezza } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

interface Misure {
  colonne: number[];
  larghezza: number;
  altezza: number;
}

function uguali(a: Misure, b: Misure): boolean {
  return (
    a.larghezza === b.larghezza &&
    a.altezza === b.altezza &&
    a.colonne.length === b.colonne.length &&
    a.colonne.every((l, i) => l === b.colonne[i])
  );
}
