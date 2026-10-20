import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Testata } from "@/components/ui";
import { URL_CODICE } from "@/lib/sito";

export const metadata: Metadata = {
  title: "Metodologia — quantotorna",
  description:
    "Come quantotorna calcola rendimento netto, imposte e cifra finale dei titoli di Stato: convenzioni, semplificazioni dichiarate, fonti e verifiche.",
};

/**
 * Le sezioni della pagina, nell'ordine: da qui vengono sia i titoli sia
 * l'indice a lato, così i due non possono dire cose diverse.
 */
const SEZIONI = {
  rendimento: "Il rendimento a scadenza",
  imposte: "Le imposte",
  famiglie: "Le famiglie di titoli",
  uscita: "Se esco prima",
  escluso: "Cosa non è compreso",
  fonti: "Dati e fonti",
  verifiche: "Le verifiche",
  avvertenze: "Avvertenze",
  codice: "Codice",
} as const;

function Sezione({ chiave, children }: { chiave: keyof typeof SEZIONI; children: ReactNode }) {
  return (
    <section id={chiave} className="scroll-mt-6 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-[var(--inchiostro)]">{SEZIONI[chiave]}</h2>
      {children}
    </section>
  );
}

function Elenco({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

/**
 * Come si fanno i conti, scritto per chi li vuole controllare. Ogni
 * semplificazione del motore è dichiarata qui oltre che nel codice: se le
 * due versioni divergono, ha ragione il codice e questa pagina va corretta.
 */
export default function Metodologia() {
  return (
    <>
      <Testata
        titolo="Metodologia"
        sottotitolo={
          <>
            Come si arriva ai numeri della tabella e delle simulazioni. I conti li fa un motore di
            funzioni pure, con i suoi test, e sono gli stessi alla compilazione del sito e nel tuo
            browser. Dove il motore semplifica, è scritto qui.
          </>
        }
      />
      <div className="contenitore grid gap-10 pt-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="In questa pagina" className="hidden lg:block">
          <div className="sticky top-6">
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
              In questa pagina
            </p>
            <ul className="space-y-1 border-l border-[var(--bordo)] text-sm">
              {Object.entries(SEZIONI).map(([chiave, titolo]) => (
                <li key={chiave}>
                  <a
                    href={`#${chiave}`}
                    className="-ml-px block border-l border-transparent py-0.5 pl-3 text-[var(--inchiostro-2)] hover:border-[var(--accento)] hover:text-[var(--accento)]"
                  >
                    {titolo}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <article className="space-y-10 text-[0.9375rem] leading-relaxed text-[var(--inchiostro-2)] [&_strong]:text-[var(--inchiostro)]">

        <Sezione chiave="rendimento">
          <p>
            Lo <strong>YTM</strong> è il tasso che rende il valore attuale dei flussi futuri — cedole
            e rimborso — uguale a quanto si spende oggi. Capitalizzazione annua composta, tempi in
            giorni effettivi su giorni effettivi (<strong>ACT/ACT</strong>), come Borsa Italiana.
          </p>
          <Elenco>
            <li>
              L'acquisto si valuta alla <strong>data di regolamento</strong>, due giorni
              lavorativi dopo il giorno dei prezzi. Si saltano i fine settimana ma non le festività
              del calendario TARGET: cinque volte l'anno il regolamento è sbagliato di un
              giorno, cioè di un giorno di rateo.
            </li>
            <li>
              Si spende il prezzo più il <strong>rateo</strong>, la cedola maturata dall'ultimo
              stacco. L'imposta del 12,5% su quel rateo la banca la rimborsa subito, e il
              motore la toglie dall'esborso.
            </li>
            <li>
              Lo <strong>YTM lordo</strong> è prima delle imposte, il <strong>netto</strong> dopo:
              cedole al 12,5%, imposta sul disaggio di emissione e sulla plusvalenza a rimborso. Lo
              «<strong>senza CG</strong>» toglie solo l'imposta sulla plusvalenza: è quello di
              chi ha minusvalenze da compensare.
            </li>
            <li>
              Come ogni YTM, presuppone che le cedole si reinvestano allo stesso tasso. La colonna
              «<strong>Netto a scadenza</strong>» no: somma cedole nette e rimborso netto così come
              arrivano, sulla somma spesa oggi.
            </li>
            <li>
              Nella tabella, di partenza: 10.000 nominali (e 10.000 € spesi per il netto a
              scadenza), prezzo di chiusura, nessuna commissione. Nominale e tariffa li cambi
              nelle tue condizioni, e la tabella rifà i conti nel tuo browser; il prezzo lo
              cambi nella simulazione sotto ogni titolo. Le commissioni d'acquisto entrano nel
              costo fiscale e riducono la plusvalenza; al rimborso non se ne pagano altre. Lo
              zainetto non entra nella tabella: si consuma una volta sola, non per ogni riga. I
              titoli che a scadenza restituiscono meno di quanto costano, imposte comprese e
              senza commissioni, non sono in elenco.
            </li>
          </Elenco>
        </Sezione>

        <Sezione chiave="imposte">
          <Elenco>
            <li>
              Titoli di Stato italiani, degli Stati della white list e degli organismi
              sovranazionali: <strong>12,5%</strong> su cedole, rateo, disaggio e scarto di
              emissione. Il sito non tratta altro: corporate, agenzie ed ETF restano fuori.
            </li>
            <li>
              <strong>Disaggio di emissione</strong>: se il titolo è stato emesso sotto 100, la
              differenza fino a 100 è reddito di capitale. Matura in modo lineare dai giorni
              dell'emissione alla scadenza; chi compra sul mercato riceve il credito
              sulla parte già maturata, e a scadenza paga l'imposta su tutta. Il prezzo di
              emissione è il «prezzo fiscale» del MEF, quello della prima tranche.
            </li>
            <li>
              <strong>Plusvalenza a rimborso</strong>: si misura dal <em>prezzo teorico</em> —
              emissione più disaggio maturato al giorno dell'acquisto — e non da 100, perché il
              disaggio è già tassato a parte. È reddito diverso: 26% sul 48,08%, cioè il 12,5%
              effettivo. Sopra la pari è una minusvalenza certa, che lo zainetto lo alimenta.
            </li>
            <li>
              <strong>BOT</strong>: lo scarto si tassa in anticipo, all'asta. Chi compra sul
              mercato rimborsa a chi vende l'imposta sul tratto che resta, e a scadenza non paga
              altro; la differenza fra prezzo teorico e prezzo pagato è plusvalenza o
              minusvalenza. Senza i dati d'asta il motore usa un modello semplificato: tutto il
              differenziale come scarto al 12,5%, fuori dallo zainetto, e la riga lo segnala.
            </li>
            <li>
              <strong>Strip</strong> di BTP: un solo incasso a scadenza, tutto scarto di emissione al
              12,5%, fuori dallo zainetto. Gli zero coupon esteri con prezzo e data di emissione
              noti si trattano come qualunque titolo emesso sotto la pari.
            </li>
            <li>
              <strong>Zainetto</strong>: le minusvalenze valgono fino al 31 dicembre del quarto anno
              dopo quello in cui sono nate e si consumano dalla più vecchia. Sulla compensazione con
              le plusvalenze da titoli di Stato la norma non è univoca: di partenza lo zainetto
              compensa la plusvalenza intera e il 48,08% si applica a quello che resta; nelle tue
              condizioni puoi scegliere l'altra lettura, che riduce prima e compensa dopo.
            </li>
            <li>
              Le cedole sono tassate una per una, arrotondando l'imposta al centesimo.
            </li>
          </Elenco>
        </Sezione>

        <Sezione chiave="famiglie">
          <Elenco>
            <li>
              <strong>Tasso fisso</strong> e <strong>BOT</strong>: flussi noti, il modello vale per
              intero.
            </li>
            <li>
              <strong>Step-up</strong> (BTP Valore, Più, Futura): ogni cedola al tasso del suo
              gradino, scelto dall'inizio del periodo cedolare. Il premio fedeltà non entra: spetta
              solo a chi ha sottoscritto all'emissione, non a chi compra sul mercato. Il piano
              delle cedole viene dalla scheda di Borsa Italiana o da una tabella nel codice, ed è
              controllato con la cedola che il listino pubblica; se non torna, il titolo resta fuori
              col motivo.
            </li>
            <li>
              <strong>CCTeu</strong>: la cedola è l'Euribor 6 mesi più lo spread scritto nel
              nome. Il rendimento suppone che l'Euribor resti per sempre quello di oggi (la media
              mensile della BCE): è un'ipotesi falsa, dichiarata accanto, che serve solo a
              metterli sulla stessa scala del tasso fisso. Niente duration né «Se esco prima»: il
              prezzo di un variabile non si muove coi tassi come quello di un fisso.
            </li>
            <li>
              <strong>BTP€i</strong>: prezzo e cedola sono reali, quindi gli stessi conti danno un
              rendimento <em>reale</em> lordo. Accanto c'è il BTP a tasso fisso dello stesso
              emittente con la scadenza più vicina, entro un anno e mezzo, e l'inflazione di
              pareggio fra i due; sotto l'anno di vita residua il pareggio non si calcola, perché
              misurerebbe il ritardo dell'indicizzazione e non le attese di inflazione. Nessun
              netto né importo in euro: dipendono dalla rivalutazione futura.
            </li>
            <li>
              <strong>BTP Italia</strong>: la rivalutazione è pagata a ogni cedola e c'è un premio
              fedeltà, quindi un rendimento a scadenza non esiste senza prevedere l'inflazione. Sono
              in elenco per essere riconosciuti, senza rendimento.
            </li>
            <li>
              <strong>BTP Valore Insieme</strong> (una sola cedola, a scadenza) non è ancora
              modellato e resta fuori, col motivo.
            </li>
          </Elenco>
        </Sezione>

        <Sezione chiave="uscita">
          <p>
            Il prezzo di vendita si ricalcola alla data di uscita scontando i flussi che restano allo
            YTM lordo di oggi più lo spostamento dei tassi che scegli: non è la duration moltiplicata
            per lo spostamento, quindi tiene dentro l'accorciarsi del titolo e la risalita verso
            100. Lo spostamento è parallelo e non distingue i tassi in generale dallo spread
            dell'Italia. Le cedole incassate non si reinvestono. Il conto fiscale è quello di una
            vendita vera: imposta su cedole, rateo e disaggio maturato, plusvalenza o minusvalenza
            sul prezzo di acquisto, il tuo zainetto, le commissioni della tua tariffa.
          </p>
        </Sezione>

        <Sezione chiave="escluso">
          <Elenco>
            <li>
              L'<strong>imposta di bollo</strong> sul deposito titoli: dipende da tutto quello che
              tieni nel deposito, non dal singolo titolo.
            </li>
            <li>
              Le <strong>commissioni</strong>, finché non scrivi le tue: dipendono
              dall'intermediario e dal nominale. Quelle che scrivi nelle tue condizioni valgono per
              la tabella e per le simulazioni.
            </li>
            <li>
              Il <strong>book</strong> di negoziazione: il prezzo è l'ultimo scambio, e su un
              titolo che scambia poco può essere vecchio di giorni. Per questo accanto c'è la
              colonna degli scambi.
            </li>
            <li>Il rischio di credito dell'emittente, se non come rating accanto al nome.</li>
          </Elenco>
        </Sezione>

        <Sezione chiave="fonti">
          <Elenco>
            <li>
              <strong>Borsa Italiana</strong>: i listini del MOT (BTP, CCT, BOT, titoli di Stato
              esteri e sovranazionali) con l'ultimo prezzo; la scheda del titolo per il piano degli
              step-up e, quando manca, la data di godimento.
            </li>
            <li>
              <strong>MEF</strong>, Dipartimento del Tesoro: i risultati d'asta dell'anno, col
              prezzo fiscale e la data di emissione dei titoli italiani.
            </li>
            <li>
              <strong>onvista</strong> (dati WM Datenservice): prezzo e data di emissione dei titoli
              esteri e di quelli italiani emessi negli anni precedenti, una quarantina al giorno.
              Finché un titolo non li ha, è trattato come emesso alla pari e la pagina lo dice.
            </li>
            <li>
              <strong>Euronext</strong>: lo storico degli ultimi tre mesi di ogni titolo, per la
              mediana degli scambi a seduta.
            </li>
            <li>
              <strong>BCE</strong>: l'Euribor 6 mesi, media mensile.
            </li>
            <li>
              <strong>Rating</strong>: S&P, scala del debito sovrano a lungo termine, rilevati a
              mano; la data è nel suggerimento accanto a ogni titolo.
            </li>
          </Elenco>
          <p>
            Il catalogo del giorno, con tutti questi dati e senza nessun numero calcolato, è
            pubblicato così com'è in{" "}
            <a href="/dati/catalogo.json" className="text-[var(--accento)] underline underline-offset-2">
              /dati/catalogo.json
            </a>
            : il formato è descritto nel codice, in <code>lib/catalogo/formato.ts</code>.
          </p>
          <p>
            Tutto si scarica una volta al giorno, dopo la chiusura. Se una pagina dei listini cambia
            forma lo scaricamento fallisce e il sito resta quello del giorno prima: mai un elenco a
            metà presentato come completo. Se manca una delle altre fonti il sito si aggiorna lo
            stesso, con i dati dell'ultimo giorno buono, e lo scrive in cima alla pagina.
          </p>
        </Sezione>

        <Sezione chiave="verifiche">
          <p>
            I flussi del motore sono stati confrontati uno per uno con un calcolo di riferimento
            indipendente:
          </p>
          <Elenco>
            <li>
              19 ottobre 2026: BTP a tasso fisso identici in 86 casi su 93, titoli esteri in 341 su
              364, BOT in 16 su 16. Le differenze residue vengono dalle date interne con cui matura
              il disaggio e dalle cedole arrotondate nel nome del titolo sul MOT.
            </li>
            <li>
              20 ottobre 2026: step-up identici in 11 casi su 11 per date, cedole, rateo e storno, e
              stesso rendimento lordo. Resta il mezzo centesimo dell'imposta sulle cedole (il
              riferimento tronca, il motore arrotonda) e la quota del 48,08% sulla plusvalenza.
            </li>
            <li>
              Esclusi dal confronto, col motivo: i BTP Valore ancora in collocamento, con i tassi
              minimi garantiti e non quelli definitivi, e il BTP Valore Insieme.
            </li>
          </Elenco>
        </Sezione>

        <Sezione chiave="avvertenze">
          <p>
            quantotorna non è consulenza finanziaria né una raccomandazione a comprare o vendere
            alcun titolo. Dati e calcoli sono forniti «così come sono» (<em>as is</em>), senza
            alcuna garanzia di esattezza, completezza o aggiornamento: le fonti possono sbagliare o
            cambiare, e il motore semplifica dove è scritto qui sopra. Non si assume alcuna
            responsabilità per errori od omissioni, né per l'uso che si fa di queste pagine o per le
            decisioni prese sulla loro base. Prima di comprare, controlla il conto del tuo
            intermediario.
          </p>
        </Sezione>

        <Sezione chiave="codice">
          <p>
            Il{" "}
            <a href={URL_CODICE} className="text-[var(--accento)] underline underline-offset-2">
              codice
            </a>{" "}
            è aperto, con licenza AGPL-3.0: motore, test, scaricamento e pagine. Chi lo usa per
            offrire un servizio deve rendere disponibili anche le sue modifiche.
          </p>
        </Sezione>
        </article>
      </div>
    </>
  );
}
