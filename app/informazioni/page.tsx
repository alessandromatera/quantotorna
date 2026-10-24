import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Testata } from "@/components/ui";
import { formatDataIT } from "@/lib/date";
import { NOVITA } from "@/lib/novita";
import { AUTORE, OPEN_GRAPH_SITO, URL_CODICE } from "@/lib/sito";

const DESCRIZIONE =
  "Cos'è quantotorna, chi lo fa, da dove vengono i dati, le avvertenze (non è consulenza finanziaria) e cosa è cambiato.";

export const metadata: Metadata = {
  title: "Informazioni",
  description: DESCRIZIONE,
  alternates: { canonical: "/informazioni/" },
  openGraph: {
    ...OPEN_GRAPH_SITO,
    url: "/informazioni/",
    title: "Informazioni — quantotorna",
    description: DESCRIZIONE,
  },
};

function Sezione({ id, titolo, children }: { id: string; titolo: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-[var(--inchiostro)]">{titolo}</h2>
      {children}
    </section>
  );
}

const link = "text-[var(--accento)] underline underline-offset-2";

/**
 * Quello che prima stava nel piè di pagina: il sito, chi lo fa, i dati e le
 * avvertenze. Il piè di pagina tiene solo i link e una riga di avvertenza
 * che porta a #avvertenze. In fondo le novità, da lib/novita.ts: le stesse
 * di CHANGELOG.md.
 */
export default function Informazioni() {
  return (
    <>
      <Testata titolo="Informazioni" sottotitolo="Cos'è quantotorna, chi lo fa, da dove vengono i dati, cosa non è e cosa è cambiato." />
      <div className="contenitore pt-8">
        <article className="max-w-3xl space-y-10 text-[0.9375rem] leading-relaxed text-[var(--inchiostro-2)] [&_strong]:text-[var(--inchiostro)]">
          <Sezione id="sito" titolo="Cos'è">
            <p>
              Quanto torna davvero un titolo di Stato tenuto fino a scadenza: rendimento netto secondo
              il fisco italiano e cifra finale in euro, per i titoli di Stato quotati sul MOT di Borsa
              Italiana. BTP a tasso fisso e step-up, BTP Valore Insieme, BOT, strip, CCTeu, BTP€i e
              BTP Italia, titoli esteri della white list e sovranazionali.
            </p>
          </Sezione>

          <Sezione id="autore" titolo="Chi lo fa">
            <p>
              Il sito è di {AUTORE}, senza pubblicità. Il{" "}
              <a href={URL_CODICE} className={link}>
                codice
              </a>{" "}
              è aperto, con licenza AGPL-3.0: motore, test, scaricamento e pagine.
            </p>
          </Sezione>

          <Sezione id="dati" titolo="I dati">
            <p>
              L'ultimo prezzo di ogni titolo sul MOT da Borsa Italiana, scambi degli ultimi tre mesi da
              Euronext, prezzi e date d'asta dal MEF e da onvista, Euribor dalla BCE. Scaricati una
              volta al giorno dopo la chiusura. Il catalogo del giorno si scarica così com'è in{" "}
              <a href="/dati/catalogo.json" className={link}>
                /dati/catalogo.json
              </a>
              , le tabelle in Markdown in{" "}
              <a href="/rendimenti.md" className={link}>
                /rendimenti.md
              </a>
              .
            </p>
            <p>
              Come si fanno i conti, con le semplificazioni dichiarate e le fonti nel dettaglio:{" "}
              <Link href="/metodologia/" className={link}>
                metodologia
              </Link>
              .
            </p>
          </Sezione>

          <Sezione id="privacy" titolo="Niente cookie, niente account">
            <p>
              Quello che scrivi in «Le tue condizioni» resta nel tuo browser. Quali dati tratta il sito,
              perché e per quanto tempo:{" "}
              <Link href="/privacy/" className={link}>
                privacy
              </Link>
              .
            </p>
          </Sezione>

          <Sezione id="avvertenze" titolo="Avvertenze">
            <p>
              <strong>Non è consulenza finanziaria</strong> né una raccomandazione a comprare o vendere
              alcun titolo. I numeri vengono da un motore di calcolo con le semplificazioni dichiarate
              nella metodologia; prima di comprare controlla il conto del tuo intermediario.
            </p>
            <p>
              Dati e calcoli sono forniti «così come sono» (<em>as is</em>), senza alcuna garanzia di
              esattezza, completezza o aggiornamento: le fonti possono sbagliare o cambiare. Non si
              assume alcuna responsabilità per errori od omissioni, né per l'uso che si fa di queste
              pagine o per le decisioni prese sulla loro base.
            </p>
          </Sezione>

          <Sezione id="novita" titolo="Novità">
            <p>Cosa è cambiato nel sito, dal più recente.</p>
            {NOVITA.map((n) => (
              <div key={n.data} className="space-y-1.5">
                <h3 className="font-semibold text-[var(--inchiostro)]">
                  <time dateTime={n.data}>{formatDataIT(n.data)}</time>
                </h3>
                <ul className="list-disc space-y-1.5 pl-5">
                  {n.voci.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            ))}
          </Sezione>
        </article>
      </div>
    </>
  );
}
