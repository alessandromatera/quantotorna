import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { Navigazione } from "@/components/navigazione";
import { AUTORE, OPEN_GRAPH_SITO, URL_CODICE, URL_SITO } from "@/lib/sito";
import "./globals.css";

/*
 * I caratteri vengono da node_modules e finiscono in out/ con il resto del
 * sito: la compilazione serale non dipende da Google Fonts, e il browser di
 * chi guarda non chiama nessun altro indirizzo.
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
            <Link href="/" className="flex items-center gap-2.5">
              <Segno />
              <Marchio />
            </Link>
            <Navigazione />
          </div>
        </header>
        <main id="contenuto" className="flex-1">
          {children}
        </main>
        <footer className="mt-12 border-t border-[var(--bordo)] bg-[var(--superficie)] text-xs text-[var(--inchiostro-muto)]">
          <div className="contenitore grid gap-8 py-10 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[var(--inchiostro)]">
                <Segno />
                <Marchio />
              </div>
              <p>
                Quanto torna davvero un titolo di Stato tenuto fino a scadenza: rendimento netto
                secondo il fisco italiano e cifra finale in euro.
              </p>
              <p>
                Niente cookie, niente statistiche di visita, niente account: quello che scrivi resta
                nel tuo browser.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--inchiostro)]">
                Dati
              </h2>
              <p>
                L'ultimo prezzo di ogni titolo sul MOT da Borsa Italiana, scambi degli ultimi tre
                mesi da Euronext, prezzi e date d'asta dal MEF e da onvista, Euribor dalla BCE.
                Scaricati una volta al giorno dopo la chiusura.
              </p>
              <p>
                Come si fanno i conti, con le semplificazioni dichiarate:{" "}
                <Link href="/metodologia/" className="text-[var(--accento)] underline underline-offset-2">
                  metodologia
                </Link>
                .
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--inchiostro)]">
                Avvertenze
              </h2>
              <p>
                <strong className="text-[var(--inchiostro-2)]">Non è consulenza finanziaria.</strong>{" "}
                I numeri vengono da un motore di calcolo con le semplificazioni dichiarate nella
                metodologia; prima di comprare controlla il conto del tuo intermediario.
              </p>
              <p>
                Dati e calcoli sono forniti «così come sono» (<em>as is</em>), senza alcuna garanzia
                di esattezza, completezza o aggiornamento. Non si assume alcuna responsabilità per
                errori od omissioni, né per l'uso che se ne fa o per le decisioni prese sulla base di
                queste pagine.
              </p>
            </div>
          </div>
          <div className="border-t border-[var(--griglia)]">
            <p className="contenitore py-4">
              <a href={URL_CODICE} className="text-[var(--accento)] underline underline-offset-2">
                Codice aperto
              </a>{" "}
              con licenza AGPL-3.0, di {AUTORE}.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
