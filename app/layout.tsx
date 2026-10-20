import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AUTORE, URL_CODICE } from "@/lib/sito";
import "./globals.css";

export const metadata: Metadata = {
  title: "quantotorna — quanto rende davvero un titolo di Stato",
  description:
    "Rendimento netto secondo il fisco italiano e cifra finale in euro, tenendo fino a scadenza i titoli di Stato quotati sul MOT.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full">
        <a href="#contenuto" className="salta-contenuto">
          Vai al contenuto
        </a>
        <header className="border-b border-[var(--bordo)] bg-[var(--superficie)]">
          <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              quantotorna
            </Link>
            <nav aria-label="Sezioni" className="flex gap-4 text-sm text-[var(--inchiostro-2)]">
              <Link href="/" className="hover:underline">
                Titoli
              </Link>
              <Link href="/metodologia/" className="hover:underline">
                Metodologia
              </Link>
            </nav>
          </div>
        </header>
        <main id="contenuto" className="contenuto-pagina">
          {children}
        </main>
        <footer className="border-t border-[var(--bordo)] bg-[var(--superficie)]">
          <div className="mx-auto max-w-[1560px] space-y-2 px-4 py-6 text-xs text-[var(--inchiostro-muto)] lg:px-8">
            <p>
              Dati: l'ultimo prezzo di ogni titolo sul MOT da Borsa Italiana, scambi degli ultimi
              tre mesi da Euronext, prezzi e date d'asta dal MEF e da onvista, Euribor dalla BCE.
              Scaricati una volta al giorno dopo la chiusura.
            </p>
            <p>
              <strong>Non è consulenza finanziaria.</strong> I numeri vengono da un motore di
              calcolo con le semplificazioni dichiarate nella{" "}
              <Link href="/metodologia/" className="underline">
                metodologia
              </Link>
              ; prima di comprare controlla il conto del tuo intermediario.
            </p>
            <p>
              Dati e calcoli sono forniti «così come sono» (<em>as is</em>), senza alcuna garanzia
              di esattezza, completezza o aggiornamento. Non si assume alcuna responsabilità per
              errori od omissioni, né per l'uso che se ne fa o per le decisioni prese sulla base di
              queste pagine.
            </p>
            <p>
              Niente cookie, niente statistiche di visita, niente account: quello che scrivi resta
              nel tuo browser.{" "}
              <a href={URL_CODICE} className="underline">
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
