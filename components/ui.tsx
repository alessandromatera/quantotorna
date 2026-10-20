import type { ReactNode } from "react";

/**
 * Primitive dell'interfaccia. Sono l'unico posto in cui vivono spaziature,
 * bordi e stati: se una pagina ha bisogno di una tabella, di un filtro o di
 * un'intestazione, li prende da qui invece di riscriverli con classi proprie.
 */

/** Intestazione di pagina: titolo, spiegazione di una riga, azioni a destra. */
export function Intestazione({
  titolo,
  descrizione,
  azioni,
}: {
  titolo: string;
  descrizione?: ReactNode;
  azioni?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{titolo}</h1>
        {descrizione && (
          <p className="mt-1 text-sm text-[var(--inchiostro-2)]">{descrizione}</p>
        )}
      </div>
      {azioni && <div className="flex shrink-0 flex-wrap gap-2">{azioni}</div>}
    </header>
  );
}

export function Card({
  titolo,
  descrizione,
  azioni,
  children,
  className = "",
  espandibile = false,
}: {
  titolo?: ReactNode;
  descrizione?: ReactNode;
  azioni?: ReactNode;
  children: ReactNode;
  className?: string;
  espandibile?: boolean;
}) {
  if (espandibile && titolo) return (
    <details className={`rounded-2xl border border-[var(--bordo)] bg-[var(--superficie)] p-4 sm:p-5 ${className}`}>
      <summary className="cursor-pointer text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--serie-1)]">{titolo}<span className="ml-2 text-xs font-normal text-[var(--inchiostro-muto)]">Dettagli</span></summary>
      <div className="mt-4">
        {descrizione && <p className="mb-3 text-xs text-[var(--inchiostro-muto)]">{descrizione}</p>}
        {azioni && <div className="mb-3 flex flex-wrap gap-2">{azioni}</div>}
        {children}
      </div>
    </details>
  );
  return (
    <section
      className={`rounded-2xl border border-[var(--bordo)] bg-[var(--superficie)] p-4 sm:p-5 ${className}`}
    >
      {(titolo || azioni) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          {titolo && (
            <h2 className="text-base font-semibold tracking-tight text-[var(--inchiostro)]">
              {titolo}
            </h2>
          )}
          {azioni && <div className="flex flex-wrap gap-2">{azioni}</div>}
        </div>
      )}
      {descrizione && (
        <p className="mb-3 text-xs text-[var(--inchiostro-muto)]">{descrizione}</p>
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
      <div className="text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
        {etichetta}
      </div>
      <div className="cifre-tabellari mt-0.5 font-semibold">{valore}</div>
      {dettaglio && (
        <div className="mt-0.5 text-xs text-[var(--inchiostro-2)]">{dettaglio}</div>
      )}
    </div>
  );
}

type Tono = "critico" | "avviso" | "ok" | "info";

const TONI: Record<Tono, { icona: string; colore: string }> = {
  critico: { icona: "⛔", colore: "var(--stato-critico)" },
  avviso: { icona: "⚠️", colore: "var(--stato-avviso)" },
  ok: { icona: "✅", colore: "var(--stato-ok)" },
  info: { icona: "ℹ️", colore: "var(--serie-1)" },
};

/**
 * Avviso di stato: sempre icona + testo, mai solo colore.
 * `info` è per le spiegazioni (prima usavano `ok`, che promette un esito
 * positivo che non c'è); `ok` resta per gli esiti riusciti.
 */
export function Avviso({ tono, children }: { tono: Tono; children: ReactNode }) {
  const { icona, colore } = TONI[tono];
  return (
    <div
      role={tono === "critico" || tono === "avviso" ? "alert" : "status"}
      className="flex items-start gap-2 rounded-xl border bg-[var(--superficie)] p-3 text-sm"
      style={{ borderColor: colore }}
    >
      <span aria-hidden>{icona}</span>
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
      ? "bg-[var(--serie-1)] text-white hover:opacity-90"
      : tipo === "pericolo"
        ? "border border-[var(--stato-critico)] text-[var(--stato-critico)] hover:bg-[var(--stato-critico)] hover:text-white"
        : "border border-[var(--bordo)] text-[var(--inchiostro-2)] hover:bg-[var(--griglia)]";
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${stile} ${props.className ?? ""}`}
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
      <span className="mb-1 block font-medium text-[var(--inchiostro-2)]">
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
 */
export const classeCampo =
  "rounded-lg border border-[var(--bordo)] bg-[var(--sfondo)] px-3 py-2 text-sm outline-none focus:border-[var(--serie-1)]";

export const classeInput = `w-full ${classeCampo}`;

/**
 * Gruppo di scelte mutuamente esclusive (filtri, ordinamenti, schede), con
 * un solo aspetto in tutto il sito.
 */
export function Segmentato<T extends string>({
  voci,
  valore,
  onCambia,
  etichetta,
  contenitore = false,
}: {
  voci: { valore: T; nome: ReactNode; punto?: string }[];
  valore: T | null;
  onCambia: (v: T) => void;
  etichetta: string;
  /** Racchiude le voci in un riquadro: usato per le schede di una pagina. */
  contenitore?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={etichetta}
      className={
        contenitore
          ? "flex gap-1 overflow-x-auto rounded-xl border border-[var(--bordo)] bg-[var(--superficie)] p-1"
          : "flex flex-wrap items-center gap-2"
      }
    >
      {voci.map((v) => {
        const attiva = v.valore === valore;
        return (
          <button
            key={v.valore}
            role="tab"
            aria-selected={attiva}
            onClick={() => onCambia(v.valore)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
              attiva
                ? "bg-[var(--serie-1)] font-medium text-white"
                : "border border-[var(--bordo)] text-[var(--inchiostro-2)] hover:bg-[var(--griglia)]"
            } ${contenitore && !attiva ? "border-transparent" : ""}`}
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

/**
 * Filtro a più scelte con il proprio conteggio. Disattivato quando non ha
 * righe: un criterio che non selezionerebbe niente è un pulsante che non fa
 * niente, e vederlo spento dice più che vederlo sparire.
 */
export function Chip({
  etichetta,
  attivo,
  conteggio,
  onCambia,
}: {
  etichetta: ReactNode;
  attivo: boolean;
  conteggio: number;
  onCambia: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={attivo}
      disabled={conteggio === 0}
      onClick={onCambia}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        attivo
          ? "bg-[var(--serie-1)] text-white"
          : "bg-[var(--griglia)] text-[var(--inchiostro-2)] hover:bg-[var(--bordo)]"
      }`}
    >
      {etichetta} <span className="cifre-tabellari opacity-70">{conteggio}</span>
    </button>
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
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${
        tono === "avviso"
          ? "bg-[var(--stato-avviso)]/20 text-[var(--inchiostro-2)]"
          : "bg-[var(--griglia)] text-[var(--inchiostro-2)]"
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
}

/**
 * Tabella del sito: scorre in orizzontale sui telefoni, intestazioni e bordi
 * identici ovunque. Le celle si scrivono con <Cella>, che applica da sola
 * l'allineamento numerico.
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
   * Clic sulla freccia di una colonna ordinabile. La freccia è un bottone a
   * parte e non l'intera intestazione: la parola dell'intestazione è spesso
   * un termine del glossario, e un clic lì deve aprire la spiegazione, non
   * rimescolare la tabella.
   */
  onOrdina?: (chiave: string) => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className={`tabella-scroll overflow-x-auto ${intera ? "tabella-intera" : ""}`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-[var(--superficie)]">
            <tr className="border-b border-[var(--griglia)] text-left text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
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
                    className={`py-2 pr-3 font-medium ${c.numerica ? "text-right" : ""} ${
                      attiva ? "text-[var(--inchiostro)]" : ""
                    }`}
                  >
                    {ordinabile && (
                      <button
                        type="button"
                        onClick={() => onOrdina!(c.chiave)}
                        aria-label={`Ordina per ${c.ordina}${
                          attiva ? (ordinamento!.verso === "asc" ? ", ora crescente" : ", ora decrescente") : ""
                        }`}
                        className={`mr-1 rounded px-1 align-baseline hover:bg-[var(--griglia)] ${
                          attiva ? "" : "opacity-40 hover:opacity-100"
                        }`}
                      >
                        {attiva ? (ordinamento!.verso === "asc" ? "↑" : "↓") : "↕"}
                      </button>
                    )}
                    {c.intestazione}
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
                  className="py-3 text-sm text-[var(--inchiostro-muto)]"
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
        <p className="mt-2 text-xs text-[var(--inchiostro-muto)]">{nota}</p>
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
          ? "cursor-pointer hover:bg-[var(--griglia)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--serie-1)]"
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
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  numerica?: boolean;
  forte?: boolean;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`py-2 pr-3 ${numerica ? "cifre-tabellari text-right" : ""} ${
        forte ? "font-semibold" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
