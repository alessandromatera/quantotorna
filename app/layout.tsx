import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import Script from "next/script";
import { Navigazione } from "@/components/navigazione";
import { AUTORE, OPEN_GRAPH_SITO, URL_CODICE, URL_SITO } from "@/lib/sito";
import "./globals.css";

/*
 * I caratteri vengono da node_modules e finiscono in out/ con il resto del
 * sito: la compilazione serale non dipende da Google Fonts, e per i caratteri
 * il browser di chi guarda non chiama nessun altro indirizzo.
 */
const sans = localFont({
  src: [
    { path: "../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2", style: "normal" },
    { path: "../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-italic.woff2", style: "italic" },
  ],
  variable: "--font-plex-sans",
  weight: "100 700",
  display: "swap",
});

const mono = localFont({
  src: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  variable: "--font-plex-mono",
  weight: "400",
  display: "swap",
});

/*
 * Per i motori di ricerca e le anteprime: il titolo comincia con quello che
 * si cerca, gli indirizzi sono quelli del dominio, e l'immagine la disegna
 * app/anteprima.png/route.tsx.
 */
const TITOLO = "Rendimento netto di BTP, BOT e titoli di Stato — quantotorna";
const DESCRIZIONE =
  "Rendimento netto secondo il fisco italiano e cifra finale in euro per BTP, BOT, CCTeu e titoli di Stato esteri quotati sul MOT, tenuti fino a scadenza. Aggiornato ogni giorno.";

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITO),
  title: { default: TITOLO, template: "%s — quantotorna" },
  description: DESCRIZIONE,
  applicationName: "quantotorna",
  authors: [{ name: AUTORE }],
  openGraph: { ...OPEN_GRAPH_SITO, url: "/", title: TITOLO, description: DESCRIZIONE },
  twitter: { card: "summary_large_image", images: OPEN_GRAPH_SITO.images },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c1a2e" },
    { media: "(prefers-color-scheme: dark)", color: "#080d15" },
  ],
};

/**
 * Il segno del sito: una freccia che fa il giro e torna al punto di
 * partenza, come il capitale che torna a scadenza.
 */
function Segno() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden>
      <rect width="28" height="28" rx="6" fill="var(--accento-pieno)" />
      <path d="M19.5 14a5.5 5.5 0 1 1-1.6-3.9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18.6 6.9v3.6H15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Marchio() {
  return (
    <span className="text-[1.0625rem] font-semibold tracking-tight">
      quanto<span className="font-normal opacity-75">torna</span>
    </span>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`h-full antialiased ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-full flex-col">
        <a href="#contenuto" className="salta-contenuto">
          Vai al contenuto
        </a>
        <header className="bg-[var(--marchio)] text-[var(--marchio-inchiostro)]">
          <div className="contenitore flex h-14 items-stretch justify-between gap-4">
            {/* Sul telefono il nome lo leggono solo gli screen reader: con tre voci di menu non c'è posto. */}
            <Link href="/" className="flex items-center gap-2.5">
              <Segno />
              <span className="sr-only sm:not-sr-only">
                <Marchio />
              </span>
            </Link>
            <Navigazione />
          </div>
        </header>
        <main id="contenuto" className="flex-1">
          {children}
        </main>
        <footer className="mt-12 border-t border-[var(--bordo)] bg-[var(--superficie)] text-xs text-[var(--inchiostro-muto)]">
          {/* Il resto (sito, dati, avvertenze per intero) sta in app/informazioni, nel menu in alto. */}
          <div className="contenitore flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[var(--inchiostro)]">
              <Segno />
              <Marchio />
            </div>
            <nav aria-label="Altre pagine" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--inchiostro-2)]">
              <Link href="/metodologia/" className="hover:text-[var(--accento)]">
                Metodologia
              </Link>
              <Link href="/privacy/" className="hover:text-[var(--accento)]">
                Privacy
              </Link>
              <a href={URL_CODICE} className="hover:text-[var(--accento)]">
                Codice
              </a>
            </nav>
          </div>
          <div className="border-t border-[var(--griglia)]">
            <p className="contenitore py-4">
              <strong className="text-[var(--inchiostro-2)]">Non è consulenza finanziaria</strong>: dati
              e calcoli sono forniti «così come sono», senza garanzie (
              <Link href="/informazioni/#avvertenze" className="text-[var(--accento)] underline underline-offset-2">
                avvertenze
              </Link>
              ).{" "}
              <a href={URL_CODICE} className="text-[var(--accento)] underline underline-offset-2">
                Codice aperto
              </a>{" "}
              con licenza AGPL-3.0, di {AUTORE}.
            </p>
          </div>
        </footer>
        <Script src="https://statistiche.quantotorna.it/q.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
