import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IndirizzoProtetto } from "@/components/indirizzo-protetto";
import { Testata } from "@/components/ui";
import { AUTORE, OPEN_GRAPH_SITO } from "@/lib/sito";

const DESCRIZIONE = "Quali dati tratta quantotorna, perché e per quanto tempo, e come esercitare i tuoi diritti.";

export const metadata: Metadata = {
  title: "Privacy",
  description: DESCRIZIONE,
  alternates: { canonical: "/privacy/" },
  openGraph: { ...OPEN_GRAPH_SITO, url: "/privacy/", title: "Privacy — quantotorna", description: DESCRIZIONE },
};

/** L'indirizzo del titolare, in base64: nella pagina compilata c'è solo a parole. */
const INDIRIZZO = "bWVAYWxlc3NhbmRyb21hdGVyYS5jb20=";

function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-[var(--inchiostro)]">{titolo}</h2>
      {children}
    </section>
  );
}

const link = "text-[var(--accento)] underline underline-offset-2";

export default function Privacy() {
  return (
    <>
      <Testata titolo="Privacy" sottotitolo="Quali dati tratta questo sito, perché e per quanto tempo." />
      <div className="contenitore pt-8">
        <article className="max-w-3xl space-y-10 text-[0.9375rem] leading-relaxed text-[var(--inchiostro-2)] [&_strong]:text-[var(--inchiostro)]">
          <Sezione titolo="Chi tratta i dati">
            <p>
              Il sito è di {AUTORE}, che è il titolare del trattamento. Per qualunque domanda sui tuoi
              dati scrivi a{" "}
              <IndirizzoProtetto codificato={INDIRIZZO} aParole="me, chiocciola, alessandromatera punto com" />.
            </p>
          </Sezione>

          <Sezione titolo="Niente cookie, niente account">
            <p>
              Il sito non usa cookie e non ha account. Le condizioni che salvi in «Le tue condizioni»
              (nominale, commissioni, zainetto, prezzo, inflazione attesa) restano nello spazio locale
              del tuo browser e non vengono mai inviate: le cancelli cancellando i dati di
              quantotorna.it dalle impostazioni del browser.
            </p>
          </Sezione>

          <Sezione titolo="Chi ti manda le pagine">
            <p>
              Le pagine sono pubblicate su GitHub Pages, di GitHub, Inc. Come ogni servizio che
              pubblica un sito, per mandarti le pagine GitHub riceve il tuo indirizzo IP e i dati
              tecnici della richiesta, e li tratta secondo la sua{" "}
              <a
                href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                className={link}
              >
                informativa sulla privacy
              </a>
              . I caratteri e i dati della pagina arrivano dallo stesso sito, senza servizi di terze
              parti.
            </p>
          </Sezione>

          <Sezione titolo="Statistiche di visita">
            <p>
              Per sapere quante persone usano il sito e come, la pagina manda alcuni dati di visita a
              un server del titolare, ospitato da Hostinger. Si contano:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                le pagine viste, con l'ora, il tempo con la pagina in primo piano e da quale sito si
                arriva (solo il nome del sito), con gli eventuali parametri utm_ del link;
              </li>
              <li>gli indirizzi delle pagine che non esistono, senza i parametri;</li>
              <li>
                paese, lingua del browser, dimensione dello schermo e se è touch, browser e sistema
                operativo;
              </li>
              <li>
                quali titoli si aprono, se si guarda «Se esco prima», se si usa la ricerca, se si
                salvano le condizioni, se si passa ai CCTeu o agli indicizzati, e i clic sui dati
                aperti e sui link verso altri siti.
              </li>
            </ul>
            <p>
              Non escono mai le tue condizioni né quello che scrivi nella ricerca. L'indirizzo IP
              serve solo al momento della visita, per contare una persona una volta al giorno e per
              sapere da che paese arriva, e non si salva: per quel giorno resta un codice provvisorio,
              cancellato il giorno dopo, e poi solo i totali, che non dicono chi sei.
            </p>
            <p>
              Come per le pagine, il fornitore di hosting può registrare nei suoi log tecnici
              l'indirizzo IP delle richieste a quel server, compresa quella che scarica lo script
              delle statistiche: quei log non entrano nelle statistiche.
            </p>
            <p>
              Se il tuo browser invia il segnale Global Privacy Control o Do Not Track, lo script si
              ferma subito e non si conta niente.
            </p>
          </Sezione>

          <Sezione titolo="Perché, e su quale base">
            <p>
              Le statistiche servono a capire come si usa il sito per migliorarlo: è il legittimo
              interesse del titolare (articolo 6, paragrafo 1, lettera f del Regolamento UE
              2016/679), con dati ridotti al minimo, senza cookie e senza profilazione. Nessun dato è
              venduto o ceduto a terzi.
            </p>
          </Sezione>

          <Sezione titolo="I tuoi diritti">
            <p>
              Puoi chiedere accesso, rettifica, cancellazione e limitazione dei dati, e opporti al
              trattamento, scrivendo all'indirizzo qui sopra. Siccome si conservano solo totali, di
              solito non c'è niente che riguardi te in particolare. Puoi anche presentare reclamo al{" "}
              <a href="https://www.garanteprivacy.it" className={link}>
                Garante per la protezione dei dati personali
              </a>
              .
            </p>
            <p>Ultimo aggiornamento: 21 ottobre 2026.</p>
          </Sezione>
        </article>
      </div>
    </>
  );
}
