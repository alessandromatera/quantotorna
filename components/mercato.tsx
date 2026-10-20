"use client";

import { CardCondizioni, useCondizioni } from "@/components/condizioni";
import { CurvaRendimenti, type PuntoCurva } from "@/components/grafici";
import { LinkStrumento } from "@/components/link-strumento";
import { SimulaAcquisto } from "@/components/simula-acquisto";
import { Termine } from "@/components/termine";
import {
  Avviso,
  Badge,
  Bottone,
  Card,
  Cella,
  Chip,
  Riga,
  Tabella,
  Vuoto,
  classeInput,
  type Colonna,
} from "@/components/ui";
import { CalcolatoreUscita, type ContestoFiscale } from "@/components/whatif";
import type { Catalogo } from "@/lib/catalogo/formato";
import { raggruppaScartate } from "@/lib/catalogo/scartate";
import {
  parametriTitolo,
  type MetricheCatalogo,
  type RigaFlussiNoti,
} from "@/lib/catalogo/metriche";
import { TIPI_CATALOGO, type TipoCatalogo } from "@/lib/categorie";
import { zainettoVivo } from "@/lib/client/condizioni";
import type { TariffaMercato } from "@/lib/costi/commissioni";
import {
  formatDataIT,
  formatEuro,
  formatEuroSegno,
  formatNumero,
  formatPct,
  formatPrezzo,
  giorniTra,
} from "@/lib/client/format";
import { descriviTitolo } from "@/lib/mercato/descrizione";
import {
  DESCRIZIONI,
  EMITTENTI,
  RATING_FONTE,
  RATING_RILEVATI,
  type Emittente,
} from "@/lib/mercato/emittenti";
import {
  FASCE_VOLATILITA,
  FILTRI_VUOTI,
  ORIZZONTI,
  estremiOrizzonte,
  filtra,
  filtriAttivi,
  intervalloAnni,
  orizzonteAttivo,
  type Filtri,
} from "@/lib/mercato/filtri";
import {
  ORDINAMENTO_PREDEFINITO,
  cambiaOrdinamento,
  descriviOrdinamento,
  ordinaCandidati,
  raggruppaPerAnno,
  spareggio,
  type ChiaveOrdinamento,
  type Ordinamento,
} from "@/lib/mercato/ordinamento";
import { leggiPareggio } from "@/lib/mercato/pareggio";
import { SOGLIE_SCAMBI, formatControvalore, formatFrequenza } from "@/lib/mercato/scambi";
import { Fragment, useMemo, useState } from "react";

/** Colori di Italia ed estero nella curva: gli stessi slot in tutto il sito. */
const COLORE_ITALIA = "var(--serie-1)";
const COLORE_ESTERO = "var(--serie-5)";

/**
 * Colonna «Scambi», uguale nelle tre tabelle: la seduta tipica e quante
 * sedute hanno avuto scambi. «Mai scambiato» e «non letto» sono due cose
 * diverse e si scrivono diverse: il primo è un titolo che in tre mesi nessuno
 * ha toccato, il secondo uno storico che non si è potuto leggere.
 */
function CellaScambi({ titolo: t }: { titolo: { scambi: Catalogo["titoli"][number]["scambi"] } }) {
  if (t.scambi == null) {
    return (
      <Cella numerica>
        <span className="text-xs text-[var(--inchiostro-muto)]">non letto</span>
      </Cella>
    );
  }
  return (
    <Cella numerica>
      {t.scambi.attive === 0 ? "nessuno" : formatControvalore(t.scambi.mediana)}
      <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
        {formatFrequenza(t.scambi)}
      </span>
    </Cella>
  );
}

/**
 * Riga d'intestazione di un anno di scadenza, con quanti titoli contiene e
 * il miglior YTM netto: si legge la scaletta anno per anno senza scorrere
 * dentro ogni gruppo.
 */
function IntestazioneAnno({
  anno,
  titoli,
  colonne,
}: {
  anno: number;
  titoli: { ytmNettoPct: number | null }[];
  colonne: number;
}) {
  const rendimenti = titoli.map((t) => t.ytmNettoPct).filter((y): y is number => y != null);
  return (
    <tr className="border-b border-[var(--griglia)] bg-[var(--sfondo)]">
      <td
        colSpan={colonne}
        className="py-1.5 pr-3 text-xs font-semibold uppercase tracking-wide text-[var(--inchiostro-2)]"
      >
        {anno}
        <span className="ml-2 font-normal normal-case tracking-normal text-[var(--inchiostro-muto)]">
          {titoli.length} {titoli.length === 1 ? "titolo" : "titoli"}
          {rendimenti.length > 0 && ` · YTM netto fino al ${formatPct(Math.max(...rendimenti))}`}
        </span>
      </td>
    </tr>
  );
}

/** ▾/▴ accanto al nome: la riga si apre. */
function Freccia({ aperta }: { aperta: boolean }) {
  return (
    <span className="ml-1 text-xs text-[var(--inchiostro-muto)]" aria-hidden>
      {aperta ? "▴" : "▾"}
    </span>
  );
}

/** Intestazione della colonna «Scambi», uguale nelle tre tabelle. */
const COLONNA_SCAMBI: Colonna = {
  chiave: "scambi",
  intestazione: (
    <>
      <Termine chiave="scambi">Scambi</Termine>
      <span className="block font-normal normal-case tracking-normal">mediana a seduta, 3 mesi</span>
    </>
  ),
  numerica: true,
};

/**
 * Le colonne che parlano di euro dicono su quanto: leggendo «+312 €/anno»
 * senza il nominale accanto non si saprebbe su che capitale.
 */
function colonne(nominale: number): Colonna[] {
  const su = (
    <span className="block font-normal normal-case tracking-normal">
      su {formatNumero(nominale)} nom.
    </span>
  );
  return [
    { chiave: "titolo", intestazione: "Titolo" },
    { chiave: "scadenza", intestazione: "Scadenza", ordina: "scadenza" },
    {
      chiave: "cedola",
      ordina: "cedola",
      intestazione: (
        <>
          <Termine chiave="cedola">Cedola</Termine>
          {su}
        </>
      ),
      numerica: true,
    },
    { chiave: "prezzo", intestazione: "Prezzo", numerica: true, ordina: "prezzo" },
    // «Plus a rimborso» sta qui, subito dopo il prezzo, perché è il prezzo
    // riscritto in euro e non porta informazione nuova sul rendimento. In
    // fondo alla riga si leggerebbe come un extra da sommare allo YTM netto,
    // mentre ci è già dentro: serve a decidere sullo zainetto.
    {
      chiave: "plus",
      ordina: "plus a rimborso",
      intestazione: (
        <>
          <Termine chiave="plusRimborso">Plus a rimborso</Termine>
          {su}
        </>
      ),
      numerica: true,
    },
    // Lo YTM netto arriva dopo i suoi ingredienti (cedola, prezzo, scarto
    // rispetto alla pari): è la sintesi, e la riga si legge come una frase.
    {
      chiave: "ytm",
      ordina: "YTM netto",
      intestazione: <Termine chiave="ytmNetto">YTM netto</Termine>,
      numerica: true,
    },
    // Lo stesso rendimento in euro, ma su 10.000 € spesi e non sui nominali:
    // è la cifra da confrontare quando si decide dove mettere una somma, e a
    // differenza dello YTM premia anche il tempo.
    {
      chiave: "netto",
      ordina: "netto a scadenza",
      intestazione: (
        <>
          <Termine chiave="nettoAScadenza">Netto a scadenza</Termine>
          <span className="block font-normal normal-case tracking-normal">ogni 10.000 € spesi</span>
        </>
      ),
      numerica: true,
    },
    // L'unica colonna che non parla di rendimento ma di rischio: cosa succede
    // se NON si tiene il titolo fino a scadenza.
    {
      chiave: "duration",
      ordina: "duration",
      intestazione: <Termine chiave="durationModificata">Dur. mod.</Termine>,
      numerica: true,
    },
    // Accanto alla duration perché risponde alla stessa domanda dal lato del
    // mercato: quanto è facile trovare chi compra a un prezzo vicino.
    { ...COLONNA_SCAMBI, ordina: "scambi" },
    { chiave: "azioni", intestazione: "" },
  ];
}

const COLONNE_INDICIZZATI: Colonna[] = [
  { chiave: "titolo", intestazione: "Titolo" },
  { chiave: "scadenza", intestazione: "Scadenza" },
  { chiave: "cedola", intestazione: "Cedola reale", numerica: true },
  { chiave: "prezzo", intestazione: "Prezzo reale", numerica: true },
  {
    chiave: "reale",
    intestazione: <Termine chiave="rendimentoReale">Rend. reale lordo</Termine>,
    numerica: true,
  },
  { chiave: "confronto", intestazione: "BTP fisso confrontabile" },
  {
    chiave: "pareggio",
    intestazione: <Termine chiave="inflazionePareggio">Inflazione di pareggio</Termine>,
    numerica: true,
  },
  COLONNA_SCAMBI,
];

const COLONNE_VARIABILI: Colonna[] = [
  { chiave: "titolo", intestazione: "Titolo" },
  { chiave: "scadenza", intestazione: "Scadenza" },
  { chiave: "spread", intestazione: "Spread su Euribor 6m", numerica: true },
  { chiave: "cedola", intestazione: "Cedola stimata", numerica: true },
  { chiave: "prezzo", intestazione: "Prezzo", numerica: true },
  {
    chiave: "ytm",
    intestazione: <Termine chiave="ytmNetto">YTM netto</Termine>,
    numerica: true,
  },
  COLONNA_SCAMBI,
];

/**
 * Casella di un anno di scadenza. Compatta e in linea con i chip della
 * fascia, perché è la stessa domanda posta in modo più preciso: l'etichetta
 * per gli screen reader sta in `aria-label`.
 */
function AnnoScadenza({
  etichetta,
  valore,
  intervallo,
  segnaposto,
  onCambia,
}: {
  etichetta: string;
  valore: number | null;
  intervallo: { min: number; max: number } | null;
  segnaposto?: number;
  onCambia: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={etichetta}
      value={valore ?? ""}
      min={intervallo?.min}
      max={intervallo?.max}
      placeholder={segnaposto == null ? "" : String(segnaposto)}
      onChange={(e) => onCambia(e.target.value === "" ? null : Number(e.target.value))}
      className="w-[4.5rem] rounded-lg border border-[var(--bordo)] bg-[var(--sfondo)] px-2 py-1 text-xs outline-none focus:border-[var(--serie-1)]"
    />
  );
}

const CADENZA: Record<number, string> = {
  1: "annuale",
  2: "semestrale",
  4: "trimestrale",
};

/**
 * Cedola annua e quanto vale ogni stacco sul nominale della tabella. Sugli
 * step-up la cedola è quella di oggi e sotto ci sono i gradini che mancano:
 * il rendimento li conta già, e chi legge solo la cedola di oggi capirebbe
 * male.
 */
function CellaCedola({
  titolo: t,
  nominale,
  oggi,
}: {
  titolo: RigaFlussiNoti;
  nominale: number;
  oggi: string;
}) {
  const prossimi = (t.gradiniCedola ?? []).filter((g) => g.dal > oggi);
  return (
    <Cella numerica>
      {formatPct(t.cedolaAnnua)}
      <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
        {t.cedolaAnnua === 0
          ? "zero coupon"
          : `${CADENZA[t.frequenzaCedola] ?? `${t.frequenzaCedola} l'anno`} · ${formatEuro(
              Math.round((nominale * t.cedolaAnnua) / t.frequenzaCedola),
            )}`}
      </span>
      {prossimi.length > 0 && (
        <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
          poi {prossimi.map((g) => `${formatPct(g.cedolaAnnua)} dal ${formatDataIT(g.dal)}`).join(", ")}
        </span>
      )}
    </Cella>
  );
}

/** Badge dell'emittente e della famiglia, ISIN, e la riga che spiega cosa comporta. */
function Identita({
  tipo,
  emittente,
  prezzo,
  isin,
  plusCompensabile,
}: {
  tipo: TipoCatalogo;
  emittente: Emittente;
  prezzo: number;
  isin: string;
  plusCompensabile?: boolean;
}) {
  const d = descriviTitolo({ tipo, prezzo, plusCompensabile });
  const e = DESCRIZIONI[emittente];
  return (
    <>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--inchiostro-muto)]">
        {/* Emittente e rating prima della famiglia, e SEMPRE, anche
            sull'Italia: su un listino che mescola Italia e Germania è la
            prima cosa da sapere, perché spiega perché due titoli di pari
            scadenza rendono diverso. La data di rilevazione del rating sta
            nel `title`: è un dato per riga, perché i rating non sono stati
            rilevati tutti lo stesso giorno. */}
        <Badge>
          <span
            title={
              e.ratingRilevato
                ? `Rating ${RATING_FONTE}, rilevato a mano il ${formatDataIT(e.ratingRilevato)}. Va riverificato sul sito dell'agenzia.`
                : undefined
            }
          >
            <Termine chiave="rating">
              {e.breve}{" "}
              {/* Dove il rating manca si scrive che manca: un posto vuoto lo
                  farebbe sembrare un dettaglio. */}
              {e.rating ?? "rating n.d."}
            </Termine>
          </span>
        </Badge>
        <Badge tono={d.toccaZainetto ? "neutro" : "avviso"}>
          <Termine chiave={d.termine}>{d.famiglia}</Termine>
        </Badge>
        {isin}
      </span>
      <span className="mt-0.5 block max-w-md text-xs leading-snug text-[var(--inchiostro-muto)]">
        {d.nota}
      </span>
    </>
  );
}

/** Le righe dei listini lasciate fuori: i motivi ricorrenti contati, gli altri elencati. */
function Scartate({ scartate }: { scartate: Catalogo["rapporto"]["scartate"] }) {
  const { gruppi, altre } = useMemo(() => raggruppaScartate(scartate), [scartate]);
  return (
    <details className="text-xs text-[var(--inchiostro-muto)]">
      <summary className="cursor-pointer">
        {formatNumero(scartate.length)} righe dei listini lasciate fuori, col motivo
      </summary>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        {gruppi.map((g) => (
          <li key={g.etichetta}>
            {formatNumero(g.quante)} {g.etichetta}
          </li>
        ))}
      </ul>
      {altre.length > 0 && (
        <>
          <p className="mt-2">Le altre, una per una:</p>
          <ul className="mt-1 space-y-0.5">
            {altre.map((s, i) => (
              <li key={`${s.isin}-${i}`}>
                <span className="cifre-tabellari">{s.isin}</span>: {s.motivo}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}

/**
 * «Se esco prima» sotto una riga. I parametri si fissano qui una volta sola:
 * la griglia di scenari è il conto più pesante della pagina, e rifarlo a ogni
 * tasto premuto nei filtri sarebbe lavoro buttato.
 */
function Uscita({
  titolo,
  oggi,
  nominale,
  contesto,
  tariffa,
}: {
  titolo: RigaFlussiNoti;
  oggi: string;
  nominale: number;
  contesto: ContestoFiscale;
  tariffa: TariffaMercato;
}) {
  const bond = useMemo(() => parametriTitolo(titolo, oggi, nominale), [titolo, oggi, nominale]);
  return <CalcolatoreUscita bond={bond} contesto={contesto} tariffa={tariffa} />;
}

export function Mercato({
  metriche,
  euribor6m,
  rapporto,
}: {
  metriche: MetricheCatalogo;
  euribor6m: Catalogo["euribor6m"];
  rapporto: Catalogo["rapporto"];
}) {
  const oggi = metriche.data;
  const [condizioni, setCondizioni] = useCondizioni();
  const [ordinamento, setOrdinamento] = useState<Ordinamento>(ORDINAMENTO_PREDEFINITO);
  /** Un gruppo per anno di scadenza: la domanda della scaletta, il migliore di ogni anno. */
  const [perAnno, setPerAnno] = useState(true);
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_VUOTI);
  /** ISIN con la simulazione d'acquisto aperta (clic sulla riga): uno per volta. */
  const [acquisto, setAcquisto] = useState<string | null>(null);
  /** ISIN con il calcolatore di uscita aperto: uno per volta, sotto la riga. */
  const [uscita, setUscita] = useState<string | null>(null);
  const cambiaAcquisto = (isin: string) => setAcquisto((c) => (c === isin ? null : isin));
  const nominale = 10_000;

  /**
   * Tutte le righe con i campi su cui i filtri lavorano, una volta sola: i
   * tre elenchi hanno metriche diverse, ma «che famiglia è», «quando scade»,
   * «tocca lo zainetto» e «ha un rendimento» valgono per tutti.
   */
  const indicizzabili = useMemo(
    () => ({
      titoli: metriche.flussiNoti.map((r) => ({
        ...r,
        toccaZainetto: r.plusCompensabile,
        rendimentoPct: r.ytmNettoPct,
        scambiMediana: r.scambi?.mediana ?? null,
      })),
      // La volatilità è la duration: dove la tabella non la mostra (CCTeu,
      // indicizzati) il titolo non entra in nessuna fascia.
      variabili: metriche.variabili.map((r) => ({
        ...r,
        toccaZainetto: descriviTitolo(r).toccaZainetto,
        rendimentoPct: r.ytmNettoPct,
        durationModificata: null,
        scambiMediana: r.scambi?.mediana ?? null,
      })),
      indicizzati: metriche.indicizzati.map((r) => ({
        ...r,
        toccaZainetto: descriviTitolo(r).toccaZainetto,
        rendimentoPct: r.ytmRealeLordoPct,
        durationModificata: null,
        scambiMediana: r.scambi?.mediana ?? null,
      })),
    }),
    [metriche],
  );

  const tutte = useMemo(
    () => [...indicizzabili.titoli, ...indicizzabili.variabili, ...indicizzabili.indicizzati],
    [indicizzabili],
  );
  const conteggi = useMemo(() => {
    const famiglia = new Map<TipoCatalogo, number>();
    const emittente = new Map<Emittente, number>();
    for (const t of tutte) {
      famiglia.set(t.tipo, (famiglia.get(t.tipo) ?? 0) + 1);
      emittente.set(t.emittente, (emittente.get(t.emittente) ?? 0) + 1);
    }
    return { famiglia, emittente };
  }, [tutte]);
  /**
   * Gli emittenti da mostrare come filtro: quelli presenti nel catalogo, più
   * quelli già selezionati (togliere sotto i piedi il chip appena premuto
   * sarebbe un modo strano di rispondere).
   */
  const emittentiPresenti = useMemo(
    () => EMITTENTI.filter((e) => (conteggi.emittente.get(e) ?? 0) > 0 || filtri.emittenti.includes(e)),
    [conteggi, filtri.emittenti],
  );
  const anni = useMemo(() => intervalloAnni(tutte), [tutte]);
  /** Accanto alle soglie: chi ne resta fuori comunque, e perché. */
  const scambiAssenti = useMemo(
    () => ({
      mai: tutte.filter((t) => t.scambi?.attive === 0).length,
      nonLetti: tutte.filter((t) => t.scambi == null).length,
    }),
    [tutte],
  );
  /**
   * L'anno delle scorciatoie viene dalla data dei prezzi, non dall'orologio:
   * così le fasce sono coerenti con i numeri che si stanno guardando.
   */
  const annoCorrente = Number(oggi.slice(0, 4));
  const orizzonte = orizzonteAttivo(filtri, annoCorrente);

  /** Cliccare la fascia già attiva la toglie: è un interruttore, non una scelta obbligata. */
  function cambiaOrizzonte(chiave: string) {
    const o = ORIZZONTI.find((x) => x.chiave === chiave);
    if (!o) return;
    if (orizzonte === chiave) {
      setFiltri((f) => ({ ...f, annoMin: null, annoMax: null }));
      return;
    }
    setFiltri((f) => ({ ...f, ...estremiOrizzonte(o, annoCorrente) }));
  }

  const titoli = useMemo(
    () => ordinaCandidati(filtra(indicizzabili.titoli, filtri), ordinamento),
    [indicizzabili, filtri, ordinamento],
  );
  const gruppi = useMemo(
    () => (perAnno ? raggruppaPerAnno(titoli, ordinamento) : [{ anno: null as number | null, titoli }]),
    [titoli, ordinamento, perAnno],
  );
  /**
   * I punti della curva: gli stessi titoli della tabella, quelli con un
   * rendimento. Non è un secondo elenco — se un filtro toglie righe alla
   * tabella, le toglie anche al grafico.
   */
  const curva = useMemo<PuntoCurva[]>(
    () =>
      titoli
        .filter((t) => t.ytmNettoPct != null)
        .map((t) => ({
          isin: t.isin,
          nome: t.nome,
          anni: Math.max(0, giorniTra(oggi, t.dataScadenza) / 365),
          ytm: t.ytmNettoPct!,
          emittente: DESCRIZIONI[t.emittente].breve,
          italiano: t.emittente === "IT",
        })),
    [titoli, oggi],
  );
  const variabili = useMemo(() => filtra(indicizzabili.variabili, filtri), [indicizzabili, filtri]);
  const indicizzati = useMemo(() => filtra(indicizzabili.indicizzati, filtri), [indicizzabili, filtri]);
  const mostrate = titoli.length + variabili.length + indicizzati.length;

  /** Il contesto fiscale di «Se esco prima»: lo zainetto ancora vivo e la lettura del 48,08%. */
  const contesto = useMemo(
    () => ({
      zainetto: zainettoVivo(condizioni.zainetto, oggi),
      compensazioneTitoliStatoRidotta: condizioni.compensazioneTitoliStatoRidotta,
    }),
    [condizioni.zainetto, condizioni.compensazioneTitoliStatoRidotta, oggi],
  );

  function cambiaFamiglia(t: TipoCatalogo) {
    setFiltri((f) => ({
      ...f,
      famiglie: f.famiglie.includes(t) ? f.famiglie.filter((x) => x !== t) : [...f.famiglie, t],
    }));
  }

  function cambiaEmittente(e: Emittente) {
    setFiltri((f) => ({
      ...f,
      emittenti: f.emittenti.includes(e) ? f.emittenti.filter((x) => x !== e) : [...f.emittenti, e],
    }));
  }

  const colonneFlussi = colonne(nominale);

  return (
    <div className="space-y-4">
      {(rapporto.fontiMancanti.length > 0 ||
        metriche.senzaEmissione > 0 ||
        scambiAssenti.nonLetti > 0) && (
        <div className="space-y-2">
          {rapporto.fontiMancanti.map((f) => (
            <Avviso key={f.fonte} tono="avviso">
              <strong>{f.fonte}</strong> oggi non ha risposto ({f.errore}): i suoi dati sono
              quelli dell'ultimo giorno in cui si sono potuti leggere, o mancano.
            </Avviso>
          ))}
          {metriche.senzaEmissione > 0 && (
            <Avviso tono="info">
              {metriche.senzaEmissione} titoli a tasso fisso sono senza prezzo o data di
              emissione e sono trattati come emessi alla pari: il disaggio non entra nel
              loro rendimento netto, che può risultare di qualche punto base più alto del
              vero. I dati mancanti si cercano un po' alla volta, ogni giorno.
            </Avviso>
          )}
          {scambiAssenti.nonLetti > 0 && (
            <Avviso tono="info">
              Per {scambiAssenti.nonLetti} titoli lo storico degli scambi oggi non si è potuto
              leggere: la colonna dice «non letto», che non vuol dire «mai scambiato».
            </Avviso>
          )}
        </div>
      )}

      <CardCondizioni condizioni={condizioni} onCambia={setCondizioni} oggi={oggi} />

      <Card titolo="Filtri">
        {/* La ricerca libera sta in cima e da sola: è l'unico filtro che non
            riguarda una proprietà del titolo ma il suo nome. */}
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
              Cerca
            </span>
            <input
              type="search"
              value={filtri.testo}
              onChange={(e) => setFiltri((f) => ({ ...f, testo: e.target.value }))}
              placeholder="nome o ISIN"
              className={`${classeInput} max-w-xs`}
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
              Famiglia
            </span>
            {TIPI_CATALOGO.map((t) => (
              <Chip
                key={t}
                etichetta={descriviTitolo({ tipo: t, prezzo: 100 }).famiglia}
                attivo={filtri.famiglie.includes(t)}
                conteggio={conteggi.famiglia.get(t) ?? 0}
                onCambia={() => cambiaFamiglia(t)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
              Emittente
            </span>
            {/* Solo gli emittenti che il catalogo contiene davvero: la tabella
                ne conosce più di trenta, perché il giorno in cui il MOT ne
                quota uno nuovo la riga non venga scartata, ma caselle spente
                a decine non sarebbero un filtro. */}
            {emittentiPresenti.map((e) => (
              <Chip
                key={e}
                etichetta={DESCRIZIONI[e].breve}
                attivo={filtri.emittenti.includes(e)}
                conteggio={conteggi.emittente.get(e) ?? 0}
                onCambia={() => cambiaEmittente(e)}
              />
            ))}
          </div>

          {/* Scadenza: le fasce e gli anni precisi sono due modi di dire la
              stessa cosa, quindi stanno insieme. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            <span className="mr-1 text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
              Scadenza
            </span>
            {ORIZZONTI.map((o) => {
              const e = estremiOrizzonte(o, annoCorrente);
              return (
                <Chip
                  key={o.chiave}
                  etichetta={o.nome}
                  attivo={orizzonte === o.chiave}
                  conteggio={filtra(tutte, { ...FILTRI_VUOTI, annoMin: e.annoMin, annoMax: e.annoMax }).length}
                  onCambia={() => cambiaOrizzonte(o.chiave)}
                />
              );
            })}
            <span className="mx-2 h-5 w-px shrink-0 bg-[var(--griglia)]" aria-hidden />
            <span className="text-xs text-[var(--inchiostro-muto)]">o dagli anni</span>
            <AnnoScadenza
              etichetta="Anno di scadenza minimo"
              valore={filtri.annoMin}
              intervallo={anni}
              segnaposto={anni?.min}
              onCambia={(v) => setFiltri((f) => ({ ...f, annoMin: v }))}
            />
            <span className="text-xs text-[var(--inchiostro-muto)]">–</span>
            <AnnoScadenza
              etichetta="Anno di scadenza massimo"
              valore={filtri.annoMax}
              intervallo={anni}
              segnaposto={anni?.max}
              onCambia={(v) => setFiltri((f) => ({ ...f, annoMax: v }))}
            />
          </div>

          {/* La volatilità è la duration modificata, cioè quanto il prezzo si
              muove per un punto di tassi: «quanto posso farmi male se devo
              uscire prima». */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            <span className="mr-1 text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
              <Termine chiave="volatilita">Volatilità</Termine>
            </span>
            {FASCE_VOLATILITA.map((v) => (
              <Chip
                key={v.chiave}
                etichetta={v.nome}
                attivo={filtri.volatilita === v.chiave}
                conteggio={filtra(tutte, { ...FILTRI_VUOTI, volatilita: v.chiave }).length}
                onCambia={() =>
                  setFiltri((f) => ({ ...f, volatilita: f.volatilita === v.chiave ? null : v.chiave }))
                }
              />
            ))}
          </div>

          {/* Quanto deve scambiare almeno: solo soglie minime, perché nessuno
              cerca i titoli che non si riescono a rivendere. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            <span className="mr-1 text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
              <Termine chiave="scambi">Scambi</Termine>
            </span>
            {SOGLIE_SCAMBI.map((soglia) => (
              <Chip
                key={soglia.chiave}
                etichetta={soglia.nome}
                attivo={filtri.scambi === soglia.chiave}
                conteggio={filtra(tutte, { ...FILTRI_VUOTI, scambi: soglia.chiave }).length}
                onCambia={() =>
                  setFiltri((f) => ({ ...f, scambi: f.scambi === soglia.chiave ? null : soglia.chiave }))
                }
              />
            ))}
            <span className="text-xs text-[var(--inchiostro-muto)]">
              di mediana a seduta, ultimi 3 mesi
              {scambiAssenti.mai > 0 && ` · ${scambiAssenti.mai} titoli mai scambiati`}
              {scambiAssenti.nonLetti > 0 && ` · ${scambiAssenti.nonLetti} non letti`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filtri.soloCompensabili}
                onChange={(e) => setFiltri((f) => ({ ...f, soloCompensabili: e.target.checked }))}
                className="h-4 w-4 accent-[var(--serie-1)]"
              />
              <span>
                Solo <Termine chiave="zainetto">compensabili con lo zainetto</Termine>
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filtri.soloConRendimento}
                onChange={(e) => setFiltri((f) => ({ ...f, soloConRendimento: e.target.checked }))}
                className="h-4 w-4 accent-[var(--serie-1)]"
              />
              <span>Solo con rendimento calcolato</span>
            </label>
          </div>

          <p className="text-xs text-[var(--inchiostro-muto)]">
            {mostrate === tutte.length
              ? `${tutte.length} titoli in elenco.`
              : `${mostrate} titoli su ${tutte.length}.`}{" "}
            {filtriAttivi(filtri) && (
              <button type="button" onClick={() => setFiltri(FILTRI_VUOTI)} className="font-medium underline">
                Azzera i filtri
              </button>
            )}
          </p>
        </div>
      </Card>

      <Card
        titolo="Curva dei rendimenti"
        descrizione="Ogni punto è un titolo dei filtri attivi: quanto rende netto a scadenza (verticale) e fra quanti anni rimborsa (orizzontale). Si vede in un colpo dove allungare la scadenza viene pagato, e quanto stanno distanti Italia ed estero a parità di scadenza, che è lo spread di credito."
      >
        <CurvaRendimenti punti={curva} coloreItalia={COLORE_ITALIA} coloreEstero={COLORE_ESTERO} />
      </Card>

      <Card
        titolo={`Tasso fisso, step-up, strip e BOT (metriche per ${formatNumero(nominale)} € nominali)`}
        descrizione="Titoli i cui incassi sono certi già oggi. Ogni riga dice di che tipo è e cosa comporta a scadenza. Un clic sulla riga apre la simulazione d'acquisto col tuo nominale, il tuo prezzo e le tue commissioni; «Se esco prima» dice cosa resta in mano vendendo prima della scadenza."
      >
        {/* L'ordine si sceglie dalle frecce delle intestazioni; qui lo si dice
            a parole, perché sul telefono le intestazioni scorrono fuori dallo
            schermo. */}
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={perAnno}
              onChange={(e) => setPerAnno(e.target.checked)}
              className="h-4 w-4 accent-[var(--serie-1)]"
            />
            <span>Raggruppa per anno di scadenza</span>
          </label>
          <span className="text-xs text-[var(--inchiostro-muto)]">
            Ordine{perAnno ? " dentro ogni anno" : ""}:{" "}
            <strong className="text-[var(--inchiostro-2)]">{descriviOrdinamento(ordinamento)}</strong>; a
            pari merito {descriviOrdinamento(spareggio(ordinamento.chiave))}. Si cambia con le frecce ↕
            nelle intestazioni; un secondo clic inverte.
          </span>
        </div>

        <Tabella
          colonne={colonneFlussi}
          ordinamento={ordinamento}
          onOrdina={(chiave) => setOrdinamento((o) => cambiaOrdinamento(o, chiave as ChiaveOrdinamento))}
          vuoto={titoli.length === 0 ? "Nessun titolo con questi filtri." : undefined}
          nota={
            <>
              YTM netto: imposte al 12,5% effettivo e prezzo di chiusura, commissioni escluse.
              «Netto a scadenza» è lo stesso rendimento in euro, su 10.000 € spesi oggi invece che
              sui nominali: premia anche il tempo, quindi fra scadenze diverse dice quanto ci si
              ritrova, non quanto rende. «Plus a rimborso» <strong>non è un extra da sommare</strong>{" "}
              allo YTM netto: ci è già dentro. È il differenziale certo fra prezzo e rimborso —
              misurato dal prezzo teorico, perché il disaggio di emissione è tassato a parte — e
              serve a decidere sullo zainetto. Positivo comprando sotto la pari: plusvalenza che
              assorbe lo zainetto sui titoli con cedola e sui BOT coi dati d'asta, mentre sugli{" "}
              <Termine chiave="btpStrip">strip</Termine> è tutto scarto di emissione e ne resta fuori
              (segnalato riga per riga). Negativo sopra la pari: una minusvalenza certa che lo
              zainetto lo alimenta. Il <Termine chiave="rating">rating</Termine> è
              dell'emittente e non del singolo titolo, rilevato a mano ({RATING_FONTE}; il più
              vecchio il <strong>{formatDataIT(RATING_RILEVATI)}</strong>): un declassamento non si
              aggiorna da solo.
            </>
          }
        >
          {gruppi.map((g) => (
            <Fragment key={g.anno ?? "tutti"}>
              {g.anno != null && (
                <IntestazioneAnno anno={g.anno} titoli={g.titoli} colonne={colonneFlussi.length} />
              )}
              {g.titoli.map((t) => (
                <Fragment key={t.isin}>
                  <Riga
                    onClick={() => cambiaAcquisto(t.isin)}
                    espansa={acquisto === t.isin}
                    etichetta={`${acquisto === t.isin ? "Chiudi" : "Apri"} la simulazione d'acquisto di ${t.nome}`}
                  >
                    <Cella className="min-w-[13rem]">
                      <LinkStrumento isin={t.isin} tipo={t.tipo} emittente={t.emittente} className="font-medium">
                        {t.nome}
                      </LinkStrumento>
                      <Freccia aperta={acquisto === t.isin} />
                      <Identita
                        tipo={t.tipo}
                        emittente={t.emittente}
                        prezzo={t.prezzo}
                        isin={t.isin}
                        plusCompensabile={t.plusCompensabile}
                      />
                    </Cella>
                    <Cella>
                      <span className="cifre-tabellari">{formatDataIT(t.dataScadenza)}</span>
                      {t.rendimento10k && (
                        <span className="block text-xs text-[var(--inchiostro-muto)]">
                          tra {formatNumero(t.rendimento10k.anni, 1)} anni
                        </span>
                      )}
                    </Cella>
                    <CellaCedola titolo={t} nominale={nominale} oggi={oggi} />
                    <Cella numerica>{formatPrezzo(t.prezzo)}</Cella>
                    {/* Nessun colore su questa cella: un differenziale negativo
                        non è un titolo peggiore, è cedola alta pagata in
                        anticipo, e lo YTM netto lo ha già assorbito. */}
                    <Cella numerica>
                      {t.plusRimborso10k === 0 ? "—" : formatEuroSegno(t.plusRimborso10k)}
                      {t.plusRimborso10k !== 0 &&
                        (!t.plusCompensabile ? (
                          <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
                            fuori dallo zainetto
                          </span>
                        ) : (
                          t.plusRimborso10k < 0 && (
                            <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
                              minus: alimenta lo zainetto
                            </span>
                          )
                        ))}
                    </Cella>
                    <Cella numerica forte>
                      {t.ytmNettoPct == null ? "—" : formatPct(t.ytmNettoPct)}
                      {t.ytmLordoPct != null && (
                        <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
                          lordo {formatPct(t.ytmLordoPct)}
                          {t.ytmNettoSenzaCgPct != null && t.ytmNettoSenzaCgPct !== t.ytmNettoPct && (
                            <>
                              {" "}
                              · <Termine chiave="ytmNettoSenzaCg">senza CG</Termine>{" "}
                              {formatPct(t.ytmNettoSenzaCgPct)}
                            </>
                          )}
                        </span>
                      )}
                    </Cella>
                    <Cella numerica>
                      {t.netto10kInvestiti == null ? (
                        "—"
                      ) : (
                        <>
                          {formatEuro(t.netto10kInvestiti.incassi)}
                          <span className="block text-xs font-normal text-[var(--delta-buono)]">
                            {formatEuroSegno(t.netto10kInvestiti.guadagno)}
                          </span>
                          {/* Sotto l'anno l'annualizzazione di un guadagno di
                              pochi giorni sarebbe fuorviante: solo il totale. */}
                          {t.rendimento10k && t.rendimento10k.anni >= 1 && (
                            <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
                              {formatEuroSegno(t.netto10kInvestiti.guadagnoAnnuo)}/anno
                            </span>
                          )}
                        </>
                      )}
                    </Cella>
                    <Cella numerica>
                      {t.durationModificata == null ? "—" : formatPrezzo(t.durationModificata)}
                    </Cella>
                    <CellaScambi titolo={t} />
                    <Cella className="text-right">
                      {/* Le colonne dicono quanto rende tenendolo fino in fondo.
                          Questo apre l'altra domanda — cosa resta in mano
                          uscendo prima — che su una scadenza lunga è quella
                          che decide davvero. */}
                      <Bottone
                        tipo="secondario"
                        aria-expanded={uscita === t.isin}
                        onClick={() => setUscita((c) => (c === t.isin ? null : t.isin))}
                      >
                        {uscita === t.isin ? "Chiudi" : "Se esco prima"}
                      </Bottone>
                    </Cella>
                  </Riga>
                  {acquisto === t.isin && (
                    <tr className="border-b border-[var(--griglia)]">
                      <td colSpan={colonneFlussi.length} className="pb-4 pr-3">
                        <SimulaAcquisto
                          titolo={t}
                          oggi={oggi}
                          nominaleDiPartenza={condizioni.nominale}
                          tariffa={condizioni.tariffa}
                          ytmTabella={t.ytmNettoPct}
                        />
                      </td>
                    </tr>
                  )}
                  {uscita === t.isin && (
                    <tr className="border-b border-[var(--griglia)]">
                      <td colSpan={colonneFlussi.length} className="pb-4 pr-3">
                        <Uscita
                          titolo={t}
                          oggi={oggi}
                          nominale={condizioni.nominale}
                          contesto={contesto}
                          tariffa={condizioni.tariffa}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </Tabella>
        {metriche.nascostiYtmNegativo > 0 && (
          <p className="mt-2 text-xs text-[var(--inchiostro-muto)]">
            Non sono in elenco {metriche.nascostiYtmNegativo} titoli che a scadenza restituiscono
            meno di quanto costano oggi, imposte comprese.
          </p>
        )}
      </Card>

      {variabili.length > 0 && (
        <Card
          titolo="Tasso variabile (CCTeu)"
          descrizione="La cedola segue l'Euribor a 6 mesi più uno spread: sale se salgono i tassi, e per questo il prezzo oscilla molto meno di un tasso fisso di pari scadenza."
        >
          <Tabella
            colonne={COLONNE_VARIABILI}
            nota={
              <>
                Lo spread è quanto il titolo paga sopra l'Euribor, ed è l'unico dato di
                rendimento che il listino pubblica. Cedola e YTM sono calcolati con
                l'Euribor 6 mesi{" "}
                {euribor6m ? (
                  <>
                    al <strong>{formatPct(euribor6m.percentuale, 3)}</strong> (media mensile BCE,{" "}
                    {euribor6m.periodo})
                  </>
                ) : (
                  "della BCE, che oggi manca"
                )}{" "}
                <strong>fermo per tutta la vita del titolo</strong>: è l'ipotesi che li
                rende confrontabili col tasso fisso, non una previsione. Un CCTeu serve proprio
                quando i tassi si muovono. Fiscalmente sono titoli di Stato al 12,5%, con
                plusvalenza a rimborso compensabile.
              </>
            }
          >
            {variabili.map((t) => (
              <Riga key={t.isin}>
                <Cella className="min-w-[13rem]">
                  <LinkStrumento isin={t.isin} tipo={t.tipo} emittente={t.emittente} className="font-medium">
                    {t.nome}
                  </LinkStrumento>
                  <Identita tipo={t.tipo} emittente={t.emittente} prezzo={t.prezzo} isin={t.isin} />
                </Cella>
                <Cella>
                  <span className="cifre-tabellari">{formatDataIT(t.dataScadenza)}</span>
                  <span className="block text-xs text-[var(--inchiostro-muto)]">
                    tra {formatNumero(t.anniResidui, 1)} anni
                  </span>
                </Cella>
                <Cella numerica forte>
                  {t.spread == null ? "—" : `+${formatPct(t.spread)}`}
                </Cella>
                <Cella numerica>{t.cedolaStimata == null ? "—" : formatPct(t.cedolaStimata, 3)}</Cella>
                <Cella numerica>{formatPrezzo(t.prezzo)}</Cella>
                {t.ytmNettoPct == null ? (
                  <Cella className="text-xs text-[var(--inchiostro-muto)]">{t.motivoNonCalcolabile}</Cella>
                ) : (
                  <Cella numerica forte>
                    {formatPct(t.ytmNettoPct)}
                    {t.ytmLordoPct != null && (
                      <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
                        lordo {formatPct(t.ytmLordoPct)}
                      </span>
                    )}
                  </Cella>
                )}
                <CellaScambi titolo={t} />
              </Riga>
            ))}
          </Tabella>
        </Card>
      )}

      {indicizzati.length > 0 && (
        <Card
          titolo="Indicizzati all'inflazione"
          descrizione={
            <>
              Titoli in cui il capitale si rivaluta con il costo della vita. Sono un modello diverso
              dal tasso fisso, per questo stanno in una tabella a parte: prezzo e cedola di un BTP€i
              sono già <em>reali</em>, cioè al netto della rivalutazione, e non vanno confrontati
              direttamente con quelli qui sopra.
            </>
          }
        >
          <Tabella
            colonne={COLONNE_INDICIZZATI}
            nota={
              <>
                Rendimenti <strong>lordi</strong> da entrambe le parti: il netto di un indicizzato
                dipende dalla rivalutazione del capitale, tassata al 12,5% ma non nota in anticipo,
                e mostrarlo sarebbe un numero sbagliato in una direzione sola. L'inflazione di
                pareggio è confrontata con il <strong>{formatPct(condizioni.inflazioneAttesa)}</strong>{" "}
                che ti aspetti (si cambia in «Le tue condizioni»): attenzione, i BTP€i seguono
                l'HICP <em>dell'area euro</em> senza tabacchi, vicino ma non uguale
                all'inflazione italiana. Nessun importo in euro: servirebbe il coefficiente di
                indicizzazione del MEF, che il sito non scarica.
              </>
            }
          >
            {indicizzati.map((t) => {
              const lettura =
                t.confronto && leggiPareggio(t.confronto.pareggioPct, condizioni.inflazioneAttesa);
              return (
                <Riga key={t.isin}>
                  <Cella className="min-w-[13rem]">
                    <LinkStrumento isin={t.isin} tipo={t.tipo} emittente={t.emittente} className="font-medium">
                      {t.nome}
                    </LinkStrumento>
                    <Identita tipo={t.tipo} emittente={t.emittente} prezzo={t.prezzo} isin={t.isin} />
                  </Cella>
                  <Cella>
                    <span className="cifre-tabellari">{formatDataIT(t.dataScadenza)}</span>
                    <span className="block text-xs text-[var(--inchiostro-muto)]">
                      tra {formatNumero(t.anniResidui, 1)} anni
                    </span>
                  </Cella>
                  <Cella numerica>
                    {formatPct(t.cedolaAnnua)}
                    <span className="block text-xs font-normal text-[var(--inchiostro-muto)]">
                      + rivalutazione
                    </span>
                  </Cella>
                  <Cella numerica>{formatPrezzo(t.prezzo)}</Cella>
                  {t.ytmRealeLordoPct == null ? (
                    // Niente rendimento: il motivo occupa le tre colonne che
                    // sarebbero vuote, invece di tre trattini muti.
                    <Cella colSpan={3} className="text-xs text-[var(--inchiostro-muto)]">
                      {t.motivoNonCalcolabile}
                    </Cella>
                  ) : (
                    <>
                      <Cella numerica forte>
                        {formatPct(t.ytmRealeLordoPct)}
                      </Cella>
                      <Cella>
                        {t.confronto ? (
                          <>
                            <span className="text-xs">{t.confronto.nome}</span>
                            <span className="block text-xs text-[var(--inchiostro-muto)]">
                              {formatPct(t.confronto.ytmNominaleLordoPct)} nominale
                              {t.confronto.scartoGiorni > 60 &&
                                ` · scade ${formatNumero(Math.round(t.confronto.scartoGiorni / 30))} mesi ${
                                  t.confronto.dataScadenza > t.dataScadenza ? "dopo" : "prima"
                                }`}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-[var(--inchiostro-muto)]">
                            {t.motivoNonCalcolabile}
                          </span>
                        )}
                      </Cella>
                      <Cella numerica forte>
                        {t.confronto && lettura ? (
                          <>
                            {formatPct(t.confronto.pareggioPct)}
                            <span
                              className="block text-xs font-normal"
                              style={{
                                color:
                                  lettura.verdetto === "pari"
                                    ? "var(--inchiostro-muto)"
                                    : "var(--inchiostro-2)",
                              }}
                            >
                              {lettura.verdetto === "pari"
                                ? "si equivalgono"
                                : lettura.verdetto === "fisso"
                                  ? "meglio il fisso"
                                  : "meglio l'indicizzato"}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </Cella>
                    </>
                  )}
                  <CellaScambi titolo={t} />
                </Riga>
              );
            })}
          </Tabella>
        </Card>
      )}

      {rapporto.scartate.length > 0 && <Scartate scartate={rapporto.scartate} />}
      {tutte.length === 0 && <Vuoto>Il catalogo di oggi è vuoto.</Vuoto>}
    </div>
  );
}
