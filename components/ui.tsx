import type { ReactNode } from "react";
import { IntestazioneOrdinabile } from "@/components/termine";

/**
 * Primitive dell'interfaccia. Sono l'unico posto in cui vivono spaziature,
 * bordi e stati: se una pagina ha bisogno di una tabella, di un filtro o di
 * un'intestazione, li prende da qui invece di riscriverli con classi proprie.
 *
 * Il tono è quello di uno strumento di lavoro: angoli appena smussati,
 * bordi sottili, un solo colore d'accento, i numeri in primo piano.
 */

/**
 * Testata di pagina: una fascia bianca a tutta larghezza col titolo, una
 * riga di spiegazione e, sotto, i dati di riferimento della pagina.
 */
export function Testata({
  titolo,
  sottotitolo,
  children,
}: {
  titolo: string;
  sottotitolo?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--bordo)] bg-[var(--superficie)]">
      <div className="contenitore py-7 lg:py-9">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
          {titolo}
        </h1>
        {sottotitolo && (
          <div className="mt-2 max-w-3xl text-base leading-relaxed text-[var(--inchiostro-2)]">
            {sottotitolo}
          </div>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

/** Riga di dati di riferimento sotto il titolo: etichetta piccola, valore, nota. */
export function Dati({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--bordo)] sm:flex sm:flex-wrap">
      {children}
    </dl>
  );
}

export function Dato({
  etichetta,
  valore,
  nota,
}: {
  etichetta: ReactNode;
  valore: ReactNode;
  nota?: ReactNode;
}) {
  return (
    <div className="-mb-px -mr-px border-r border-b border-[var(--bordo)] px-4 py-3 sm:min-w-[11rem] sm:flex-1 sm:border-b-0 sm:last:border-r-0">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
        {etichetta}
      </dt>
      <dd className="cifre-tabellari mt-1 text-lg font-semibold">{valore}</dd>
      {nota && <dd className="text-xs text-[var(--inchiostro-muto)]">{nota}</dd>}
    </div>
  );
}

/** Freccia di un riquadro che si apre: ruota quando il riquadro è aperto. */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 transition-transform ${className}`} aria-hidden>
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Riquadro bianco con titolo e spiegazione facoltativi. */
export function Card({
  titolo,
  descrizione,
  azioni,
  children,
  className = "",
}: {
  titolo?: ReactNode;
  descrizione?: ReactNode;
  azioni?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-[var(--bordo)] bg-[var(--superficie)] p-4 sm:p-5 ${className}`}>
      {(titolo || azioni) && (
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          {titolo && <h2 className="text-base font-semibold">{titolo}</h2>}
          {azioni && <div className="flex flex-wrap gap-2">{azioni}</div>}
        </div>
      )}
      {descrizione && (
        <p className="mb-4 max-w-4xl text-sm text-[var(--inchiostro-muto)]">{descrizione}</p>
      )}
      {children}
    </section>
  );
}

/** Numero secondario dentro una card (griglia di misure, non una card intera). */
export function Misura({
  etichetta,
  valore,
  dettaglio,
}: {
  etichetta: ReactNode;
  valore: ReactNode;
  dettaglio?: ReactNode;
}) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
        {etichetta}
      </div>
      <div className="cifre-tabellari mt-1 text-lg font-semibold">{valore}</div>
      {dettaglio && (
        <div className="mt-0.5 text-xs text-[var(--inchiostro-2)]">{dettaglio}</div>
      )}
    </div>
  );
}

type Tono = "critico" | "avviso" | "ok" | "info";

/**
 * Icone disegnate e non emoji: le emoji cambiano faccia da un sistema
 * all'altro, e su un avviso serio una faccina colorata stona.
 */
const ICONE: Record<Tono, ReactNode> = {
  critico: <path d="M10 6v5M10 14h.01M7 2.5h6L17.5 7v6L13 17.5H7L2.5 13V7z" />,
  avviso: <path d="M10 7.5v4M10 14.5h.01M8.7 3.3 2.2 14.5A1.5 1.5 0 0 0 3.5 16.7h13a1.5 1.5 0 0 0 1.3-2.2L11.3 3.3a1.5 1.5 0 0 0-2.6 0z" />,
  ok: <path d="M6.5 10.2 9 12.7l4.5-5M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z" />,
  info: <path d="M10 9v4.5M10 6.5h.01M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z" />,
};

const TONI: Record<Tono, { colore: string; tratto: string }> = {
  critico: { colore: "var(--stato-critico)", tratto: "var(--stato-critico)" },
  // Il giallo come tratto sul bianco non si vede: icona in inchiostro.
  avviso: { colore: "var(--stato-avviso)", tratto: "var(--inchiostro)" },
  ok: { colore: "var(--stato-ok)", tratto: "var(--stato-ok)" },
  info: { colore: "var(--accento)", tratto: "var(--accento)" },
};

/**
 * Avviso di stato: sempre icona + testo, mai solo colore.
 * `info` è per le spiegazioni (prima usavano `ok`, che promette un esito
 * positivo che non c'è); `ok` resta per gli esiti riusciti.
 */
export function Avviso({ tono, children }: { tono: Tono; children: ReactNode }) {
  const { colore, tratto } = TONI[tono];
  return (
    <div
      role={tono === "critico" || tono === "avviso" ? "alert" : "status"}
      className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm text-[var(--inchiostro-2)]"
      style={{
        borderColor: `color-mix(in srgb, ${colore} 35%, var(--bordo))`,
        background: `color-mix(in srgb, ${colore} 6%, var(--superficie))`,
      }}
    >
      <svg
        viewBox="0 0 20 20"
        className="mt-px h-[18px] w-[18px] shrink-0"
        fill="none"
        stroke={tratto}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {ICONE[tono]}
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Stato vuoto: stessa voce in tutto il sito, con l'azione suggerita in coda. */
export function Vuoto({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--inchiostro-muto)]">{children}</p>;
}

export function Bottone({
  children,
  tipo = "primario",
  ...props
}: {
  children: ReactNode;
  tipo?: "primario" | "secondario" | "pericolo";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const stile =
    tipo === "primario"
      ? "border border-[var(--accento-pieno)] bg-[var(--accento-pieno)] text-white hover:opacity-90"
      : tipo === "pericolo"
        ? "border border-[var(--stato-critico)] text-[var(--stato-critico)] hover:bg-[var(--stato-critico)] hover:text-white"
        : "border border-[var(--bordo)] bg-[var(--superficie)] text-[var(--inchiostro)] hover:border-[var(--bordo-forte)] hover:bg-[var(--superficie-2)]";
  return (
    <button
      {...props}
      className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50 ${stile} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Campo({
  etichetta,
  suggerimento,
  children,
}: {
  etichetta: string;
  suggerimento?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-[var(--inchiostro-2)]">
        {etichetta}
      </span>
      {children}
      {suggerimento && (
        <span className="mt-1 block text-xs text-[var(--inchiostro-muto)]">
          {suggerimento}
        </span>
      )}
    </label>
  );
}

/**
 * Bordo, fondo e fuoco di un campo, senza larghezza: la sceglie chi lo usa.
 * Con `w-full` dentro, una larghezza aggiunta dopo perdeva o vinceva secondo
 * l'ordine delle regole nel CSS, non secondo quello delle classi.
 *
 * Sul telefono il testo è a 16 px: sotto, Safari ingrandisce la pagina a
 * ogni tocco su un campo.
 */
export const classeCampo =
  "h-9 rounded-md border border-[var(--bordo)] bg-[var(--superficie)] px-3 text-base outline-none transition-shadow focus:border-[var(--accento)] focus:ring-3 focus:ring-[var(--accento-tenue)] sm:text-sm";

export const classeInput = `w-full ${classeCampo}`;

/**
 * Gruppo di scelte mutuamente esclusive, con un solo aspetto in tutto il
 * sito. Con `contenitore` sono le schede di una pagina (sottolineate), senza
 * sono un selettore a pulsanti uniti.
 */
export function Segmentato<T extends string>({
  voci,
  valore,
  onCambia,
  etichetta,
  contenitore = false,
}: {
  voci: { valore: T; nome: ReactNode; punto?: string; conteggio?: number }[];
  valore: T | null;
  onCambia: (v: T) => void;
  etichetta: string;
  /** Schede di una pagina: sottolineate, con il conteggio accanto. */
  contenitore?: boolean;
}) {
  if (contenitore) {
    return (
      <div role="tablist" aria-label={etichetta} className="-mb-px flex gap-5 overflow-x-auto">
        {voci.map((v) => {
          const attiva = v.valore === valore;
          return (
            <button
              key={v.valore}
              role="tab"
              aria-selected={attiva}
              onClick={() => onCambia(v.valore)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pt-1 pb-2.5 text-sm font-medium transition-colors ${
                attiva
                  ? "border-[var(--accento-pieno)] text-[var(--inchiostro)]"
                  : "border-transparent text-[var(--inchiostro-muto)] hover:text-[var(--inchiostro)]"
              }`}
            >
              {v.nome}
              {v.conteggio != null && (
                <span
                  className={`cifre-tabellari rounded px-1.5 text-xs ${
                    attiva
                      ? "bg-[var(--accento-tenue)] text-[var(--accento)]"
                      : "bg-[var(--griglia)] text-[var(--inchiostro-muto)]"
                  }`}
                >
                  {v.conteggio}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div
      role="tablist"
      aria-label={etichetta}
      className="inline-flex flex-wrap overflow-hidden rounded-md border border-[var(--bordo)] bg-[var(--superficie)]"
    >
      {voci.map((v) => {
        const attiva = v.valore === valore;
        return (
          <button
            key={v.valore}
            role="tab"
            aria-selected={attiva}
            onClick={() => onCambia(v.valore)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-r border-[var(--bordo)] px-3 py-1.5 text-sm transition-colors last:border-r-0 ${
              attiva
                ? "bg-[var(--accento-pieno)] font-medium text-white"
                : "text-[var(--inchiostro-2)] hover:bg-[var(--superficie-2)]"
            }`}
          >
            {v.punto && (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: attiva ? "currentColor" : v.punto }}
                aria-hidden
              />
            )}
            {v.nome}
          </button>
        );
      })}
    </div>
  );
}

/** Etichetta compatta accanto a un titolo (categoria, stato, nota). */
export function Badge({
  children,
  colore,
  tono = "neutro",
}: {
  children: ReactNode;
  /** Pallino colorato a sinistra (identità di categoria). */
  colore?: string;
  tono?: "neutro" | "avviso";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-[0.75rem] leading-[1.15rem] ${
        tono === "avviso"
          ? "border-[color-mix(in_srgb,var(--stato-avviso)_55%,var(--bordo))] bg-[color-mix(in_srgb,var(--stato-avviso)_14%,var(--superficie))] text-[var(--inchiostro)]"
          : "border-[var(--bordo)] bg-[var(--superficie-2)] text-[var(--inchiostro-2)]"
      }`}
    >
      {colore && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: colore }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export interface Colonna {
  chiave: string;
  intestazione: ReactNode;
  /** Allineata a destra, con cifre tabellari. */
  numerica?: boolean;
  /**
   * Il nome della colonna a parole, se la tabella si può ordinare su di lei:
   * è l'etichetta del bottone di ordinamento per chi non vede la freccia.
   */
  ordina?: string;
  /** La colonna da guardare per prima: ha un fondo suo, dall'intestazione all'ultima riga. */
  evidenza?: boolean;
}

/** Freccia d'ordinamento: piena sulla colonna attiva, accennata sulle altre. */
function FrecciaOrdine({ verso }: { verso: "asc" | "desc" | null }) {
  return (
    <svg viewBox="0 0 12 16" className="h-3.5 w-3" aria-hidden>
      <path d="M6 2.5 9 6.5H3z" fill="currentColor" opacity={verso === "asc" ? 1 : verso ? 0.2 : 0.45} />
      <path d="M6 13.5 3 9.5h6z" fill="currentColor" opacity={verso === "desc" ? 1 : verso ? 0.2 : 0.45} />
    </svg>
  );
}

/**
 * Tabella del sito: scorre in orizzontale sui telefoni, intestazioni e bordi
 * identici ovunque. Le celle si scrivono con <Cella>, che applica da sola
 * l'allineamento numerico. Va a filo del riquadro che la contiene: i
 * margini laterali li danno la prima e l'ultima cella.
 */
export function Tabella({
  colonne,
  vuoto,
  nota,
  intera = false,
  ordinamento,
  onOrdina,
  children,
}: {
  colonne: Colonna[];
  /** Messaggio da mostrare al posto delle righe quando non ce ne sono. */
  vuoto?: ReactNode;
  nota?: ReactNode;
  /**
   * Niente scorrimento interno: la tabella si allunga con la pagina. Per gli
   * elenchi brevi da leggere per intero; i listini lunghi tengono lo
   * scorrimento con l'intestazione ferma.
   */
  intera?: boolean;
  /** La colonna su cui la tabella è ordinata, e in che verso. */
  ordinamento?: { chiave: string; verso: "asc" | "desc" };
  /**
   * Clic sull'intestazione di una colonna ordinabile, o sulla sua freccia,
   * che è il bottone per la tastiera. Se la parola è un termine del
   * glossario, col mouse la spiegazione si apre al passaggio e il clic
   * ordina; col dito il tocco sulla parola apre la spiegazione e il resto
   * dell'intestazione ordina (vedi `IntestazioneOrdinabile`).
   */
  onOrdina?: (chiave: string) => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className={`tabella-scroll overflow-x-auto ${intera ? "tabella-intera" : ""}`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[2]">
            <tr className="text-left text-[0.6875rem] uppercase tracking-wider text-[var(--inchiostro-muto)]">
              {colonne.map((c) => {
                const ordinabile = c.ordina != null && onOrdina != null;
                const attiva = ordinabile && ordinamento?.chiave === c.chiave;
                return (
                  <th
                    key={c.chiave}
                    scope="col"
                    aria-sort={
                      attiva
                        ? ordinamento!.verso === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    onClick={ordinabile ? () => onOrdina!(c.chiave) : undefined}
                    className={`border-b border-[var(--bordo)] bg-[var(--superficie-2)] px-3 py-2.5 align-bottom font-semibold first:pl-4 last:pr-4 ${
                      c.numerica ? "text-right" : ""
                    } ${ordinabile ? "cursor-pointer select-none hover:text-[var(--inchiostro)]" : ""} ${
                      attiva ? "text-[var(--inchiostro)]" : ""
                    } ${
                      c.evidenza ? "colonna-evidenza text-[var(--inchiostro)]" : ""
                    }`}
                  >
                    <span className={`inline-flex items-start gap-1 ${c.numerica ? "flex-row-reverse text-right" : ""}`}>
                      {ordinabile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            // Senza, il clic risalirebbe all'intestazione e ordinerebbe due volte.
                            e.stopPropagation();
                            onOrdina!(c.chiave);
                          }}
                          aria-label={`Ordina per ${c.ordina}${
                            attiva ? (ordinamento!.verso === "asc" ? ", ora crescente" : ", ora decrescente") : ""
                          }`}
                          className={`mt-px rounded p-0.5 hover:bg-[var(--griglia)] ${
                            attiva ? "text-[var(--accento)]" : ""
                          }`}
                        >
                          <FrecciaOrdine verso={attiva ? ordinamento!.verso : null} />
                        </button>
                      )}
                      <span>
                        {ordinabile ? (
                          <IntestazioneOrdinabile>{c.intestazione}</IntestazioneOrdinabile>
                        ) : (
                          c.intestazione
                        )}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {vuoto ? (
              <tr>
                <td
                  colSpan={colonne.length}
                  className="px-4 py-6 text-sm text-[var(--inchiostro-muto)]"
                >
                  {vuoto}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      {nota && (
        <div className="border-t border-[var(--bordo)] px-4 py-3 text-xs leading-relaxed text-[var(--inchiostro-muto)]">
          {nota}
        </div>
      )}
    </div>
  );
}

/**
 * Riga di tabella. Con `onClick` diventa cliccabile per intero — non solo su
 * un elemento dentro una cella: una riga che mostra la manina ovunque ma
 * risponde soltanto su una parola è un bottone che mente.
 *
 * Cliccabile significa anche raggiungibile da tastiera: la riga prende il
 * fuoco, Invio e Spazio attivano, e `aria-expanded` dice agli screen reader
 * se il dettaglio è aperto.
 *
 * Un link o un bottone DENTRO la riga resta suo: il clic che lo raggiunge
 * non apre anche il dettaglio, e Invio premuto su di lui non viene fermato
 * dalla riga (che altrimenti, col suo `preventDefault`, gli impedirebbe di
 * scattare).
 */
export function Riga({
  children,
  className = "",
  onClick,
  espansa,
  etichetta,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** Stato del dettaglio che la riga apre, per `aria-expanded`. */
  espansa?: boolean;
  /** Cosa fa il clic, per chi non vede la riga. */
  etichetta?: string;
}) {
  const interattiva = onClick != null;
  return (
    <tr
      className={`border-b border-[var(--griglia)] ${
        interattiva
          ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accento)]"
          : ""
      } ${className}`}
      onClick={
        interattiva
          ? (e) => {
              const interno = (e.target as HTMLElement).closest(
                "a, button, input, select, textarea, summary, label",
              );
              if (interno && e.currentTarget.contains(interno)) return;
              onClick!();
            }
          : undefined
      }
      onKeyDown={
        interattiva
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
      tabIndex={interattiva ? 0 : undefined}
      role={interattiva ? "button" : undefined}
      aria-expanded={interattiva ? espansa : undefined}
      aria-label={interattiva ? etichetta : undefined}
    >
      {children}
    </tr>
  );
}

export function Cella({
  children,
  numerica = false,
  forte = false,
  evidenza = false,
  ferma = false,
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  numerica?: boolean;
  forte?: boolean;
  /** Nella colonna evidenziata (vedi `Colonna.evidenza`). */
  evidenza?: boolean;
  /** Resta ferma a sinistra quando la tabella scorre, sul telefono: il nome del titolo. */
  ferma?: boolean;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 align-top first:pl-4 last:pr-4 ${numerica ? "cifre-tabellari text-right" : ""} ${
        forte ? "font-semibold" : ""
      } ${evidenza ? "colonna-evidenza" : ""} ${ferma ? "cella-ferma" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

/** Riga secondaria dentro una cella: più piccola, attenuata. */
export function Sotto({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`block text-xs font-normal text-[var(--inchiostro-muto)] ${className}`}>
      {children}
    </span>
  );
}
