"use client";

import { GLOSSARIO } from "@/lib/glossario";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * Termine con spiegazione al passaggio del mouse (desktop) e al tap (mobile).
 * Nessuna AI: testo statico dal glossario.
 *
 * Il riquadro è renderizzato in un PORTAL su document.body con posizione
 * `fixed`: così non viene mai ritagliato dai contenitori con overflow (le
 * tabelle), che prima lo mostravano come un "popup bianco" tagliato.
 */

/**
 * Dentro l'intestazione di una colonna ordinabile il clic col mouse ordina:
 * la spiegazione l'ha già aperta il passaggio del mouse. Col dito, che non
 * passa sopra, il tocco sulla parola resta suo e apre la spiegazione.
 */
const InIntestazioneOrdinabile = createContext(false);

export function IntestazioneOrdinabile({ children }: { children: React.ReactNode }) {
  return <InIntestazioneOrdinabile.Provider value>{children}</InIntestazioneOrdinabile.Provider>;
}

export function Termine({
  chiave,
  children,
}: {
  chiave: keyof typeof GLOSSARIO | string;
  children?: React.ReactNode;
}) {
  const voce = GLOSSARIO[chiave];
  const [aperto, setAperto] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; larghezza: number } | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const riquadro = useRef<HTMLDivElement>(null);
  const id = useId();
  const inIntestazione = useContext(InIntestazioneOrdinabile);
  const puntatore = useRef("");

  // Calcola la posizione fixed a partire dal rettangolo del trigger,
  // scegliendo sopra/sotto e restando dentro il viewport.
  const posiziona = useCallback(() => {
    const t = trigger.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const larghezza = Math.min(300, vw - 24);
    const left = Math.max(12, Math.min(r.left, vw - larghezza - 12));
    const altezzaStimata = riquadro.current?.offsetHeight ?? 130;
    const spazioSotto = vh - r.bottom;
    const sopra = spazioSotto < altezzaStimata + 16 && r.top > spazioSotto;
    const top = sopra
      ? Math.max(12, r.top - altezzaStimata - 8)
      : Math.min(r.bottom + 8, vh - altezzaStimata - 12);
    setPos({ left, top, larghezza });
  }, []);

  useLayoutEffect(() => {
    if (aperto) posiziona();
  }, [aperto, posiziona]);

  useEffect(() => {
    if (!aperto) return;
    // Riposiziona su scroll/resize; chiudi con Esc o click fuori.
    const ricalcola = () => posiziona();
    function fuori(e: PointerEvent) {
      const bersaglio = e.target as Node;
      if (
        trigger.current?.contains(bersaglio) ||
        riquadro.current?.contains(bersaglio)
      )
        return;
      setAperto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAperto(false);
    }
    window.addEventListener("scroll", ricalcola, true);
    window.addEventListener("resize", ricalcola);
    document.addEventListener("pointerdown", fuori);
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("scroll", ricalcola, true);
      window.removeEventListener("resize", ricalcola);
      document.removeEventListener("pointerdown", fuori);
      document.removeEventListener("keydown", esc);
    };
  }, [aperto, posiziona]);

  if (!voce) return <>{children ?? chiave}</>;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-describedby={aperto ? id : undefined}
        aria-expanded={aperto}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setAperto(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setAperto(false);
        }}
        onFocus={() => setAperto(true)}
        onBlur={() => setAperto(false)}
        onPointerDown={(e) => {
          puntatore.current = e.pointerType;
        }}
        onClick={(e) => {
          // Da tastiera `detail` è 0: Invio apre la spiegazione anche qui.
          if (inIntestazione && puntatore.current === "mouse" && e.detail > 0) return;
          e.stopPropagation();
          setAperto((v) => !v);
        }}
        className="cursor-help border-0 bg-transparent p-0 text-left underline decoration-dotted decoration-[var(--inchiostro-muto)] underline-offset-2 [color:inherit] [font:inherit]"
      >
        {children ?? voce.titolo}
      </button>
      {aperto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={riquadro}
            role="tooltip"
            id={id}
            className="pointer-events-none fixed z-50 rounded-lg border border-[var(--bordo)] bg-[var(--superficie)] p-3 text-left text-xs font-normal leading-relaxed text-[var(--inchiostro-2)]"
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              width: pos?.larghezza ?? 300,
              visibility: pos ? "visible" : "hidden",
              boxShadow: "0 6px 24px rgba(0,0,0,0.22)",
            }}
          >
            <span className="mb-1 block font-semibold text-[var(--inchiostro)]">
              {voce.titolo}
            </span>
            {voce.testo}
          </div>,
          document.body,
        )}
    </>
  );
}
