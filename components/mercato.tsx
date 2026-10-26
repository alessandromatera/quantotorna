"use client";

import { PannelloCondizioni, riassuntoCondizioni, useCondizioni } from "@/components/condizioni";
import { CurvaRendimenti, type PuntoCurva } from "@/components/grafici";
import { LinkStrumento } from "@/components/link-strumento";
import { MenuFiltro, NotaMenu, OpzioneFiltro } from "@/components/menu-filtro";
import { AvantiIndietro, ElencoPagine, SceltaDivisione } from "@/components/pagine-tabella";
import { SimulaAcquisto } from "@/components/simula-acquisto";
import { Termine } from "@/components/termine";
import {
  Avviso,
  Badge,
  Cella,
  Chevron,
  Riga,
  Segmentato,
  Sotto,
  Tabella,
  Vuoto,
  classeInput,
  type Colonna,
} from "@/components/ui";
import { CalcolatoreUscita, type ContestoFiscale } from "@/components/whatif";
import type { Catalogo } from "@/lib/catalogo/formato";
import { raggruppaScartate } from "@/lib/catalogo/scartate";
import {
  NOMINALE_RIFERIMENTO,
  parametriTitolo,
  righeConCondizioni,
  type MetricheCatalogo,
  type RigaCedolaUnica,
  type RigaFlussiNoti,
} from "@/lib/catalogo/metriche";
import { TIPI_CATALOGO, type TipoCatalogo } from "@/lib/categorie";
import { zainettoVivo, type Condizioni } from "@/lib/client/condizioni";
import { senzaCommissioni, type TariffaMercato } from "@/lib/costi/commissioni";
import {
  formatDataIT,
  formatEuro,
  formatEuroSegno,
  formatMeseIT,
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
import {
  RIGHE_PER_PAGINA,
  indicePagina,
  pagineDiRighe,
  paginePerAnno,
  sceltaDi,
  type Divisione,
  type SceltaPagina,
} from "@/lib/mercato/pagine";
import { leggiPareggio } from "@/lib/mercato/pareggio";
import { SOGLIE_SCAMBI, formatControvalore, formatFrequenza } from "@/lib/mercato/scambi";
import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";

/** Colori di Italia ed estero nella curva: gli stessi slot in tutto il sito. */
const COLORE_ITALIA = "var(--serie-1)";
const COLORE_ESTERO = "var(--serie-5)";

/** Le schede del listino: i modelli di titolo, che non si confrontano fra loro. */
type Scheda = "fissi" | "variabili" | "indicizzati" | "cedoleUniche";

/** Cosa mostra il dettaglio aperto sotto una riga. */
type Vista = "acquisto" | "uscita";

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
        <Sotto>non letto</Sotto>
      </Cella>
    );
  }
  return (
    <Cella numerica>
      {t.scambi.attive === 0 ? "nessuno" : formatControvalore(t.scambi.mediana)}
      <Sotto>{formatFrequenza(t.scambi)}</Sotto>
    </Cella>
  );
}

/** Data di scadenza e quanto manca: la stessa cella nelle tre tabelle. */
function CellaScadenza({ data, anni }: { data: string; anni: number | null }) {
  return (
    <Cella>
      <span className="cifre-tabellari">{formatDataIT(data)}</span>
      {anni != null && <Sotto>tra {formatNumero(anni, 1)} anni</Sotto>}
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
    <tr className="border-b border-[var(--bordo)] bg-[var(--superficie-2)]">
      <td colSpan={colonne} className="py-1.5! pr-4 pl-4">
        {/* Ferma a sinistra: sul telefono la tabella scorre, l'anno no. */}
        <span className="sticky left-4 inline-flex flex-wrap items-baseline gap-x-3">
          <span className="cifre-tabellari text-sm font-semibold">Scadenza {anno}</span>
          <span className="text-xs text-[var(--inchiostro-muto)]">
            {titoli.length} {titoli.length === 1 ? "titolo" : "titoli"}
            {rendimenti.length > 0 && ` · YTM netto fino al ${formatPct(Math.max(...rendimenti))}`}
          </span>
        </span>
      </td>
    </tr>
  );
}

/** Intestazione della colonna «Scambi», uguale nelle tre tabelle. */
const COLONNA_SCAMBI: Colonna = {
  chiave: "scambi",
  intestazione: (
    <>
      <Termine chiave="scambi">Scambi</Termine>
      <span className="block whitespace-normal font-normal normal-case tracking-normal">mediana a seduta, 3 mesi</span>
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
    <span className="block whitespace-normal font-normal normal-case tracking-normal">
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
      evidenza: true,
    },
    // Lo stesso rendimento in euro, sui nominali come il resto della riga: è
    // il conto di «Se lo compro», e a differenza dello YTM premia anche il
    // tempo.
    {
      chiave: "netto",
      ordina: "netto a scadenza",
      intestazione: (
        <>
          <Termine chiave="nettoAScadenza">Netto a scadenza</Termine>
          {su}
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
    evidenza: true,
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
    evidenza: true,
  },
  COLONNA_SCAMBI,
];

/**
 * Le colonne dei fissi, senza ordinamento (la scheda ha un titolo o due) e
 * con la cedola che si paga una volta sola.
 */
function colonneCedolaUnica(nominale: number): Colonna[] {
  return colonne(nominale).map(({ ordina: _ordina, ...c }) =>
    c.chiave === "cedola"
      ? {
          ...c,
          intestazione: (
            <>
              <Termine chiave="cedolaUnica">Cedola unica</Termine>
              <span className="block whitespace-normal font-normal normal-case tracking-normal">
                a scadenza, su {formatNumero(nominale)} nom.
              </span>
            </>
          ),
        }
      : c,
  );
}

/** Casella di un anno di scadenza, dentro il menu «Scadenza». */
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
      className="h-8 w-20 rounded-md border border-[var(--bordo)] bg-[var(--superficie)] px-2 text-base outline-none focus:border-[var(--accento)] sm:text-sm"
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
      <Sotto>
        {t.cedolaAnnua === 0
          ? "zero coupon"
          : `${CADENZA[t.frequenzaCedola] ?? `${t.frequenzaCedola} l'anno`} · ${formatEuro(
              Math.round((nominale * t.cedolaAnnua) / t.frequenzaCedola),
            )}`}
      </Sotto>
      {prossimi.length > 0 && (
        <Sotto>
          poi {prossimi.map((g) => `${formatPct(g.cedolaAnnua)} dal ${formatDataIT(g.dal)}`).join(", ")}
        </Sotto>
      )}
    </Cella>
  );
}

/**
 * La cedola unica in percentuale del nominale e in euro sul nominale della
 * tabella. Col minimo del collocamento si scrive che è il minimo.
 */
function CellaCedolaUnica({ titolo: t, nominale }: { titolo: RigaCedolaUnica; nominale: number }) {
  const c = t.cedolaUnica;
  return (
    <Cella numerica>
      {c.definitiva ? formatPct(c.percentuale) : `minimo ${formatPct(c.percentuale)}`}
      <Sotto>
        {c.definitiva
          ? `una sola, il ${formatDataIT(t.dataScadenza)} · ${formatEuro(Math.round(nominale * c.percentuale))}`
          : "definitiva non ancora pubblicata"}
      </Sotto>
    </Cella>
  );
}

/**
 * Le celle dei conti di un titolo a flussi noti, dalla plusvalenza a
 * rimborso alla duration: le stesse nella tabella dei fissi e in quella
 * della cedola unica.
 */
function CelleConti({ titolo: t }: { titolo: RigaFlussiNoti }) {
  return (
    <>
      {/* Nessun colore su questa cella: un differenziale negativo
          non è un titolo peggiore, è cedola alta pagata in
          anticipo, e lo YTM netto lo ha già assorbito. */}
      <Cella numerica>
        {t.plusRimborso === 0 ? "—" : formatEuroSegno(t.plusRimborso)}
        {t.plusRimborso !== 0 &&
          (!t.plusCompensabile ? (
            <Sotto>fuori dallo zainetto</Sotto>
          ) : (
            t.plusRimborso < 0 && <Sotto>minus: alimenta lo zainetto</Sotto>
          ))}
      </Cella>
      <Cella numerica evidenza>
        <span className="text-[0.9375rem] font-semibold">
          {t.ytmNettoPct == null ? "—" : formatPct(t.ytmNettoPct)}
        </span>
        {t.ytmLordoPct != null && (
          <Sotto className="whitespace-nowrap">lordo {formatPct(t.ytmLordoPct)}</Sotto>
        )}
        {t.ytmLordoPct != null &&
          t.ytmNettoSenzaCgPct != null &&
          t.ytmNettoSenzaCgPct !== t.ytmNettoPct && (
            <Sotto className="whitespace-nowrap">
              <Termine chiave="ytmNettoSenzaCg">senza CG</Termine>{" "}
              {formatPct(t.ytmNettoSenzaCgPct)}
            </Sotto>
          )}
      </Cella>
      <Cella numerica>
        {t.rendimentoNominale == null ? (
          "—"
        ) : (
          <>
            {formatEuro(t.rendimentoNominale.incassi)}
            <span className="block text-xs font-medium text-[var(--delta-buono)]">
              {formatEuroSegno(t.rendimentoNominale.guadagno)}
            </span>
            {/* Sotto l'anno l'annualizzazione di un guadagno di
                pochi giorni sarebbe fuorviante: solo il totale. */}
            {t.rendimentoNominale.anni >= 1 && (
              <Sotto>{formatEuroSegno(t.rendimentoNominale.annuo)}/anno</Sotto>
            )}
          </>
        )}
      </Cella>
      <Cella numerica>
        {t.durationModificata == null ? "—" : formatPrezzo(t.durationModificata)}
      </Cella>
    </>
  );
}

/**
 * La prima cella di ogni riga: il nome (link alla scheda di Borsa
 * Italiana), poi ISIN, emittente col rating e famiglia. Con `conNota` anche
 * la riga che spiega cosa comporta il titolo a scadenza; nella tabella dei
 * fissi la nota sta nel dettaglio che si apre col clic, perché ripetuta su
 * seicento righe le renderebbe alte cinque volte.
 */
function CellaTitolo({
  titolo: t,
  aperta,
  conNota = false,
}: {
  titolo: {
    tipo: TipoCatalogo;
    emittente: Emittente;
    prezzo: number;
    isin: string;
    nome: string;
    plusCompensabile?: boolean;
  };
  /** Riga che si apre: la freccia a sinistra dice se è aperta. */
  aperta?: boolean;
  conNota?: boolean;
}) {
  const d = descriviTitolo(t);
  const e = DESCRIZIONI[t.emittente];
  return (
    <Cella ferma className="min-w-[12rem] sm:min-w-[17rem]">
      <div className="flex items-start gap-1.5">
        {aperta != null && (
          <Chevron
            className={`mt-0.5 -ml-1 ${aperta ? "rotate-90 text-[var(--accento)]" : "text-[var(--inchiostro-muto)]"}`}
          />
        )}
        <div className="min-w-0">
          <LinkStrumento isin={t.isin} tipo={t.tipo} emittente={t.emittente} className="font-semibold">
            {t.nome}
          </LinkStrumento>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
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
          </span>
          <span className="mt-1 block font-mono text-xs text-[var(--inchiostro-muto)]">{t.isin}</span>
          {conNota && (
            <span className="mt-1 block max-w-sm text-xs leading-snug text-[var(--inchiostro-muto)]">
              {d.nota}
            </span>
          )}
        </div>
      </div>
    </Cella>
  );
}

/** Le righe dei listini lasciate fuori: i motivi ricorrenti contati, gli altri elencati. */
function Scartate({ scartate }: { scartate: Catalogo["rapporto"]["scartate"] }) {
  const { gruppi, altre } = useMemo(() => raggruppaScartate(scartate), [scartate]);
  return (
    <details className="text-xs text-[var(--inchiostro-muto)]">
      <summary className="flex cursor-pointer items-center gap-1.5 hover:text-[var(--inchiostro)]">
        <Chevron className="ruota-aperto" />
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
                <span className="font-mono">{s.isin}</span>: {s.motivo}
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

/**
 * Il dettaglio sotto una riga dei fissi: cosa comporta il titolo, poi le due
 * domande che la tabella non risolve — quanto spendo e quanto torna col mio
 * nominale e le mie commissioni, e cosa resta uscendo prima.
 */
function Dettaglio({
  titolo: t,
  vista,
  onVista,
  onChiudi,
  oggi,
  condizioni,
  contesto,
}: {
  titolo: RigaFlussiNoti;
  vista: Vista;
  onVista: (v: Vista) => void;
  onChiudi: () => void;
  oggi: string;
  condizioni: Condizioni;
  contesto: ContestoFiscale;
}) {
  const d = descriviTitolo(t);
  return (
    <div className="dettaglio-riga px-4 pt-2 pb-5">
      <div className="flex items-end justify-between gap-3 border-b border-[var(--bordo)]">
        <Segmentato
          contenitore
          etichetta={`Simulazioni su ${t.nome}`}
          voci={[
            { valore: "acquisto", nome: "Se lo compro" },
            { valore: "uscita", nome: "Se esco prima" },
          ]}
          valore={vista}
          onCambia={onVista}
        />
        <button
          type="button"
          onClick={onChiudi}
          className="mb-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--inchiostro-muto)] hover:bg-[var(--griglia)] hover:text-[var(--inchiostro)]"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
          Chiudi
        </button>
      </div>
      <p className="mt-3 mb-4 text-sm text-[var(--inchiostro-2)]">
        <strong className="text-[var(--inchiostro)]">{d.famiglia}.</strong> {d.nota}
      </p>
      {vista === "acquisto" ? (
        <SimulaAcquisto
          titolo={t}
          oggi={oggi}
          nominaleDiPartenza={condizioni.nominale}
          tariffa={condizioni.tariffa}
          ytmTabella={t.ytmNettoPct}
        />
      ) : (
        <Uscita
          titolo={t}
          oggi={oggi}
          nominale={condizioni.nominale}
          contesto={contesto}
          tariffa={condizioni.tariffa}
        />
      )}
    </div>
  );
}

/** Spiegazione in testa a una scheda: cosa contiene e come si legge. */
function Introduzione({ children, azioni }: { children: ReactNode; azioni?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-[var(--bordo)] px-4 py-3">
      <p className="text-sm text-[var(--inchiostro-2)]">{children}</p>
      {azioni}
    </div>
  );
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
  const [condizioniAperte, setCondizioniAperte] = useState(false);
  const [scheda, setScheda] = useState<Scheda>("fissi");
  const [ordinamento, setOrdinamento] = useState<Ordinamento>(ORDINAMENTO_PREDEFINITO);
  /**
   * Per anno di scadenza: la domanda della scaletta, il migliore di ogni
   * anno. Oppure pagine di righe, o l'elenco intero da scorrere.
   */
  const [divisione, setDivisione] = useState<Divisione>("anni");
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_VUOTI);
  /** Il titolo col dettaglio aperto (clic sulla riga): uno per volta. */
  const [aperta, setAperta] = useState<{ isin: string; vista: Vista } | null>(null);
  const cambiaAperta = (isin: string) =>
    setAperta((a) => (a?.isin === isin ? null : { isin, vista: "acquisto" }));
  const nominale = condizioni.nominale;
  /**
   * Le righe col nominale e la tariffa salvati da chi guarda. Con quelli di
   * riferimento sono le righe della pagina compilata, così come sono; con
   * altri si rifanno qui (un paio di decimi di secondo su seicento titoli),
   * una volta per salvataggio. Lo zainetto non entra: vedi `CondizioniTabella`.
   */
  const { percentuale, minimo, massimo, fisso } = condizioni.tariffa;
  const righe = useMemo(() => {
    const tariffa = { percentuale, minimo, massimo, fisso };
    if (nominale === NOMINALE_RIFERIMENTO && senzaCommissioni(tariffa)) return metriche;
    return { ...metriche, ...righeConCondizioni(metriche, euribor6m, { nominale, tariffa }) };
  }, [metriche, euribor6m, nominale, percentuale, minimo, massimo, fisso]);

  /**
   * Tutte le righe con i campi su cui i filtri lavorano, una volta sola: i
   * tre elenchi hanno metriche diverse, ma «che famiglia è», «quando scade»,
   * «tocca lo zainetto» e «ha un rendimento» valgono per tutti.
   */
  const indicizzabili = useMemo(
    () => ({
      titoli: righe.flussiNoti.map((r) => ({
        ...r,
        toccaZainetto: r.plusCompensabile,
        rendimentoPct: r.ytmNettoPct,
        scambiMediana: r.scambi?.mediana ?? null,
      })),
      // La volatilità è la duration: dove la tabella non la mostra (CCTeu,
      // indicizzati) il titolo non entra in nessuna fascia.
      variabili: righe.variabili.map((r) => ({
        ...r,
        toccaZainetto: descriviTitolo(r).toccaZainetto,
        rendimentoPct: r.ytmNettoPct,
        durationModificata: null,
        scambiMediana: r.scambi?.mediana ?? null,
      })),
      indicizzati: righe.indicizzati.map((r) => ({
        ...r,
        toccaZainetto: descriviTitolo(r).toccaZainetto,
        rendimentoPct: r.ytmRealeLordoPct,
        durationModificata: null,
        scambiMediana: r.scambi?.mediana ?? null,
      })),
      cedoleUniche: righe.cedoleUniche.map((r) => ({
        ...r,
        toccaZainetto: descriviTitolo(r).toccaZainetto,
        rendimentoPct: r.ytmNettoPct,
        durationModificata: r.metriche?.durationModificata ?? null,
        scambiMediana: r.scambi?.mediana ?? null,
      })),
    }),
    [righe],
  );

  const tutte = useMemo(
    () => [
      ...indicizzabili.titoli,
      ...indicizzabili.variabili,
      ...indicizzabili.indicizzati,
      ...indicizzabili.cedoleUniche,
    ],
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
   * quelli già selezionati (togliere sotto i piedi la voce appena scelta
   * sarebbe un modo strano di rispondere). La tabella ne conosce più di
   * trenta, perché il giorno in cui il MOT ne quota uno nuovo la riga non
   * venga scartata, ma voci spente a decine non sarebbero un filtro.
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
  /**
   * La tabella a pagine (vedi lib/mercato/pagine.ts): un anno di scadenza per
   * pagina, cinquanta righe senza anni, o tutte in una pagina sola, che non ha
   * barra degli anni né avanti e indietro. Le pagine si rifanno dai titoli
   * filtrati: un filtro che lascia pochi titoli in un anno lo accorpa ai vicini.
   */
  const pagine = useMemo(
    () =>
      divisione === "anni"
        ? paginePerAnno(raggruppaPerAnno(titoli, ordinamento))
        : pagineDiRighe(titoli, divisione === "righe" ? RIGHE_PER_PAGINA : Infinity),
    [titoli, ordinamento, divisione],
  );
  const [sceltaPagina, setSceltaPagina] = useState<SceltaPagina | null>(null);
  const paginaCorrente = indicePagina(pagine, sceltaPagina, titoli);
  const gruppi = pagine[paginaCorrente]?.gruppi ?? [];
  /** Sopra le pagine: chi cambia pagina dal fondo riparte dalla prima riga. */
  const inizioPagine = useRef<HTMLDivElement>(null);
  function cambiaPagina(indice: number) {
    setSceltaPagina(sceltaDi(pagine, indice, titoli));
    setAperta(null);
    const inizio = inizioPagine.current;
    if (inizio && inizio.getBoundingClientRect().top < 0) inizio.scrollIntoView({ block: "start" });
  }
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
  const cedoleUniche = useMemo(() => filtra(indicizzabili.cedoleUniche, filtri), [indicizzabili, filtri]);
  const mostrate = titoli.length + variabili.length + indicizzati.length + cedoleUniche.length;

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
    <div className="contenitore space-y-4 pt-6">
      {(rapporto.fontiMancanti.length > 0 ||
        metriche.senzaEmissione > 0 ||
        scambiAssenti.nonLetti > 0) && (
        <div className="space-y-2">
          {rapporto.fontiMancanti.map((f) => (
            <Avviso key={f.fonte} tono="avviso">
              <strong>{f.fonte}</strong> oggi non ha risposto ({f.errore}).{" "}
              {f.ultimaLettura != null ? (
                <>
                  I suoi dati sono quelli dell'ultima lettura riuscita, del{" "}
                  <strong>{formatDataIT(f.ultimaLettura)}</strong>.
                </>
              ) : (
                "Non si sa di quando sia l'ultima lettura riuscita: i suoi dati possono mancare."
              )}
            </Avviso>
          ))}
          {metriche.senzaEmissione > 0 && (
            <Avviso tono="info">
              {metriche.senzaEmissione} titoli a tasso fisso sono senza prezzo o data di
              emissione e sono trattati come emessi alla pari: il disaggio non entra nel
              loro rendimento netto, che può risultare di qualche punto base più alto del
              vero. I dati mancanti si cercano di nuovo ogni giorno, tutti.
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

      <section
        aria-label="Listino"
        className="rounded-lg border border-[var(--bordo)] bg-[var(--superficie)]"
      >
        {/* La barra dei filtri. Valgono per tutte e tre le schede: il
            conteggio accanto a ogni scheda dice quanti titoli restano lì. */}
        <div className="relative flex flex-wrap items-center gap-2 border-b border-[var(--bordo)] px-4 py-3">
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Cerca per nome o ISIN</span>
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--inchiostro-muto)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              type="search"
              value={filtri.testo}
              onChange={(e) => setFiltri((f) => ({ ...f, testo: e.target.value }))}
              placeholder="Cerca per nome o ISIN"
              className={`${classeInput} pl-8`}
            />
          </label>

          <MenuFiltro etichetta="Famiglia" attivi={filtri.famiglie.length}>
            {TIPI_CATALOGO.map((t) => (
              <OpzioneFiltro
                key={t}
                etichetta={descriviTitolo({ tipo: t, prezzo: 100 }).famiglia}
                attivo={filtri.famiglie.includes(t)}
                conteggio={conteggi.famiglia.get(t) ?? 0}
                onCambia={() => cambiaFamiglia(t)}
              />
            ))}
          </MenuFiltro>

          {/* Scadenza: le fasce e gli anni precisi sono due modi di dire la
              stessa cosa, quindi stanno nello stesso menu. */}
          <MenuFiltro etichetta="Scadenza" attivi={filtri.annoMin != null || filtri.annoMax != null ? 1 : 0}>
            {ORIZZONTI.map((o) => {
              const e = estremiOrizzonte(o, annoCorrente);
              return (
                <OpzioneFiltro
                  key={o.chiave}
                  unica
                  etichetta={o.nome}
                  attivo={orizzonte === o.chiave}
                  conteggio={filtra(tutte, { ...FILTRI_VUOTI, annoMin: e.annoMin, annoMax: e.annoMax }).length}
                  onCambia={() => cambiaOrizzonte(o.chiave)}
                />
              );
            })}
            <div className="mt-1.5 border-t border-[var(--griglia)] pt-1.5">
              <NotaMenu>Oppure dagli anni di scadenza</NotaMenu>
              <div className="flex items-center gap-2 px-2.5 pb-1.5">
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
            </div>
          </MenuFiltro>

          <MenuFiltro etichetta="Emittente" attivi={filtri.emittenti.length} larghezza="sm:w-[28rem]">
            <div className="grid sm:grid-cols-2">
              {emittentiPresenti.map((e) => (
                <OpzioneFiltro
                  key={e}
                  etichetta={DESCRIZIONI[e].breve}
                  attivo={filtri.emittenti.includes(e)}
                  conteggio={conteggi.emittente.get(e) ?? 0}
                  onCambia={() => cambiaEmittente(e)}
                />
              ))}
            </div>
          </MenuFiltro>

          {/* La volatilità è la duration modificata, cioè quanto il prezzo si
              muove per un punto di tassi: «quanto posso farmi male se devo
              uscire prima». */}
          <MenuFiltro etichetta="Volatilità" attivi={filtri.volatilita != null ? 1 : 0}>
            <NotaMenu>
              <Termine chiave="volatilita">Duration modificata</Termine>: di quanto si muove il
              prezzo se i tassi si spostano di un punto.
            </NotaMenu>
            {FASCE_VOLATILITA.map((v) => (
              <OpzioneFiltro
                key={v.chiave}
                unica
                etichetta={v.nome}
                attivo={filtri.volatilita === v.chiave}
                conteggio={filtra(tutte, { ...FILTRI_VUOTI, volatilita: v.chiave }).length}
                onCambia={() =>
                  setFiltri((f) => ({ ...f, volatilita: f.volatilita === v.chiave ? null : v.chiave }))
                }
              />
            ))}
          </MenuFiltro>

          {/* Quanto deve scambiare almeno: solo soglie minime, perché nessuno
              cerca i titoli che non si riescono a rivendere. */}
          <MenuFiltro etichetta="Scambi" attivi={filtri.scambi != null ? 1 : 0}>
            <NotaMenu>
              <Termine chiave="scambi">Scambi</Termine>: mediana a seduta, ultimi 3 mesi.
            </NotaMenu>
            {SOGLIE_SCAMBI.map((soglia) => (
              <OpzioneFiltro
                key={soglia.chiave}
                unica
                etichetta={soglia.nome}
                attivo={filtri.scambi === soglia.chiave}
                conteggio={filtra(tutte, { ...FILTRI_VUOTI, scambi: soglia.chiave }).length}
                onCambia={() =>
                  setFiltri((f) => ({ ...f, scambi: f.scambi === soglia.chiave ? null : soglia.chiave }))
                }
              />
            ))}
            {(scambiAssenti.mai > 0 || scambiAssenti.nonLetti > 0) && (
              <NotaMenu>
                Restano fuori comunque
                {scambiAssenti.mai > 0 && ` ${scambiAssenti.mai} titoli mai scambiati`}
                {scambiAssenti.mai > 0 && scambiAssenti.nonLetti > 0 && " e"}
                {scambiAssenti.nonLetti > 0 && ` ${scambiAssenti.nonLetti} non letti`}.
              </NotaMenu>
            )}
          </MenuFiltro>

          <MenuFiltro
            etichetta="Altro"
            attivi={(filtri.soloCompensabili ? 1 : 0) + (filtri.soloConRendimento ? 1 : 0)}
          >
            <OpzioneFiltro
              etichetta="Solo compensabili con lo zainetto"
              attivo={filtri.soloCompensabili}
              onCambia={() => setFiltri((f) => ({ ...f, soloCompensabili: !f.soloCompensabili }))}
            />
            <OpzioneFiltro
              etichetta="Solo con rendimento calcolato"
              attivo={filtri.soloConRendimento}
              onCambia={() => setFiltri((f) => ({ ...f, soloConRendimento: !f.soloConRendimento }))}
            />
            <NotaMenu>
              Compensabili: titoli la cui plusvalenza a rimborso assorbe le minusvalenze dello{" "}
              <Termine chiave="zainetto">zainetto</Termine>.
            </NotaMenu>
          </MenuFiltro>

          <p className="text-sm text-[var(--inchiostro-muto)] sm:ml-auto" aria-live="polite">
            <strong className="cifre-tabellari font-semibold text-[var(--inchiostro)]">{mostrate}</strong>
            {mostrate === tutte.length ? " titoli" : ` di ${tutte.length} titoli`}
            {filtriAttivi(filtri) && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setFiltri(FILTRI_VUOTI)}
                  className="font-medium text-[var(--accento)] hover:underline"
                >
                  Azzera filtri
                </button>
              </>
            )}
          </p>
        </div>

        {/* Le schede, e a destra le condizioni della tabella e delle
            simulazioni: chi le ha cambiate le vede scritte senza aprire niente. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-[var(--bordo)] px-4 pt-3">
          <Segmentato
            contenitore
            etichetta="Famiglie di titoli"
            valore={scheda}
            onCambia={(s) => {
              setScheda(s);
              setAperta(null);
            }}
            voci={[
              { valore: "fissi", nome: "Tasso fisso, step-up, strip e BOT", conteggio: titoli.length },
              { valore: "variabili", nome: "Tasso variabile (CCTeu)", conteggio: variabili.length },
              { valore: "indicizzati", nome: "Indicizzati all'inflazione", conteggio: indicizzati.length },
              // Solo se il catalogo ne ha: una scheda sempre vuota non direbbe niente.
              ...(righe.cedoleUniche.length > 0
                ? [
                    {
                      valore: "cedoleUniche" as const,
                      nome: "Cedola unica (BTP Valore Insieme)",
                      conteggio: cedoleUniche.length,
                    },
                  ]
                : []),
            ]}
          />
          <button
            type="button"
            aria-expanded={condizioniAperte}
            onClick={() => setCondizioniAperte((v) => !v)}
            className="-mx-2 mb-2 flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-[var(--superficie-2)] sm:mx-0 sm:w-auto"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[var(--inchiostro-muto)]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
              <path d="M3 6h9M15 6h2M3 14h2M8 14h9" />
              <circle cx="13.5" cy="6" r="1.75" />
              <circle cx="6.5" cy="14" r="1.75" />
            </svg>
            <span className="whitespace-nowrap font-medium">Le tue condizioni</span>
            <span className="min-w-0 flex-1 truncate text-[var(--inchiostro-muto)]">
              {riassuntoCondizioni(condizioni, oggi)}
            </span>
            <Chevron className={`text-[var(--inchiostro-muto)] ${condizioniAperte ? "-rotate-90" : "rotate-90"}`} />
          </button>
        </div>

        {condizioniAperte && (
          <div className="border-b border-[var(--bordo)] bg-[var(--superficie-2)] px-4 py-5">
            <PannelloCondizioni condizioni={condizioni} onSalva={setCondizioni} oggi={oggi} />
          </div>
        )}

        {scheda === "fissi" && (
          <div role="tabpanel" aria-label="Tasso fisso, step-up, strip e BOT">
            <Introduzione
              azioni={<SceltaDivisione divisione={divisione} onScegli={setDivisione} />}
            >
              Titoli i cui incassi sono certi già oggi, con le metriche su{" "}
              {formatNumero(nominale)} € nominali. Un clic sulla riga apre il conto d'acquisto col
              tuo nominale, il tuo prezzo e le tue commissioni, e «Se esco prima»: cosa resta in
              mano vendendo prima della scadenza.{" "}
              {/* L'ordine si sceglie dalle intestazioni; qui lo si dice a
                  parole, perché sul telefono le intestazioni scorrono fuori
                  dallo schermo. */}
              <span className="text-[var(--inchiostro-muto)]">
                Ordine{divisione === "anni" ? " dentro ogni anno" : ""}: {descriviOrdinamento(ordinamento)}; a
                pari merito {descriviOrdinamento(spareggio(ordinamento.chiave))}.
                {metriche.nascostiYtmNegativo > 0 && (
                  <>
                    {" "}
                    Non sono in elenco {metriche.nascostiYtmNegativo} titoli che a scadenza
                    restituiscono meno di quanto costano oggi, imposte comprese e senza
                    commissioni.
                  </>
                )}
              </span>
            </Introduzione>

            <details open className="group border-b border-[var(--bordo)]">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-[var(--superficie-2)]">
                <Chevron className="ruota-aperto text-[var(--inchiostro-muto)]" />
                <span>
                  Curva dei rendimenti netti{" "}
                  <span className="font-normal text-[var(--inchiostro-muto)]">
                    · {curva.length} titoli dei filtri attivi
                  </span>
                </span>
              </summary>
              <div className="px-4 pb-4">
                <p className="mb-3 text-xs text-[var(--inchiostro-muto)]">
                  Ogni punto è un titolo: quanto rende netto a scadenza (verticale) e fra quanti
                  anni rimborsa (orizzontale). Si vede in un colpo dove allungare la scadenza viene
                  pagato, e quanto stanno distanti Italia ed estero a parità di scadenza, che è lo
                  spread di credito.
                </p>
                <CurvaRendimenti punti={curva} coloreItalia={COLORE_ITALIA} coloreEstero={COLORE_ESTERO} />
              </div>
            </details>

            {/* Sopra la tabella e chiuso: sotto, quando la tabella scorreva in
                un riquadro suo, restava sempre in fondo allo schermo a togliere
                righe. */}
            <details className="group border-b border-[var(--bordo)]">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-[var(--superficie-2)]">
                <Chevron className="ruota-aperto text-[var(--inchiostro-muto)]" />
                <span>Come si leggono le colonne</span>
              </summary>
              <p className="px-4 pb-4 text-xs leading-relaxed text-[var(--inchiostro-muto)]">
                YTM netto: imposte al 12,5% effettivo e prezzo di chiusura,{" "}
                {senzaCommissioni(condizioni.tariffa)
                  ? "commissioni escluse"
                  : "con le commissioni della tua tariffa"}
                . «Netto a scadenza» è lo stesso rendimento in euro: cedole nette e rimborso
                netto dei {formatNumero(nominale)} nominali, e sotto quanto guadagni sul loro
                costo, come in «Se lo compro». Premia anche il tempo e il prezzo, quindi fra
                titoli diversi dice quanto ti torna, non quale rende di più. «Plus a rimborso» <strong>non è un extra da
                sommare</strong> allo YTM netto: ci è già dentro. È il differenziale certo fra
                prezzo e rimborso — misurato dal prezzo teorico, perché il disaggio di emissione
                è tassato a parte — e serve a decidere sullo zainetto. Positivo comprando sotto
                la pari: plusvalenza che assorbe lo zainetto sui titoli con cedola e sui BOT coi
                dati d'asta, mentre sugli <Termine chiave="btpStrip">strip</Termine> è tutto
                scarto di emissione e ne resta fuori (segnalato riga per riga). Negativo sopra la
                pari: una minusvalenza certa che lo zainetto lo alimenta. Il{" "}
                <Termine chiave="rating">rating</Termine> è dell'emittente e non del singolo
                titolo, rilevato a mano ({RATING_FONTE}; il più vecchio il{" "}
                <strong>{formatDataIT(RATING_RILEVATI)}</strong>): un declassamento non si
                aggiorna da solo.
              </p>
            </details>

            <div ref={inizioPagine}>
              <ElencoPagine pagine={pagine} indice={paginaCorrente} onScegli={cambiaPagina} />
            </div>
            <Tabella
              colonne={colonneFlussi}
              ordinamento={ordinamento}
              onOrdina={(chiave) => setOrdinamento((o) => cambiaOrdinamento(o, chiave as ChiaveOrdinamento))}
              vuoto={titoli.length === 0 ? "Nessun titolo con questi filtri." : undefined}
            >
              {gruppi.map((g) => (
                <Fragment key={g.anno ?? "tutti"}>
                  {g.anno != null && (
                    <IntestazioneAnno anno={g.anno} titoli={g.titoli} colonne={colonneFlussi.length} />
                  )}
                  {g.titoli.map((t) => (
                    <Fragment key={t.isin}>
                      <Riga
                        onClick={() => cambiaAperta(t.isin)}
                        espansa={aperta?.isin === t.isin}
                        etichetta={`${aperta?.isin === t.isin ? "Chiudi" : "Apri"} le simulazioni di ${t.nome}`}
                      >
                        <CellaTitolo titolo={t} aperta={aperta?.isin === t.isin} />
                        <CellaScadenza data={t.dataScadenza} anni={t.rendimentoNominale?.anni ?? null} />
                        <CellaCedola titolo={t} nominale={nominale} oggi={oggi} />
                        <Cella numerica>{formatPrezzo(t.prezzo)}</Cella>
                        <CelleConti titolo={t} />
                        <CellaScambi titolo={t} />
                      </Riga>
                      {aperta?.isin === t.isin && (
                        <tr className="border-b border-[var(--bordo)]">
                          <td
                            colSpan={colonneFlussi.length}
                            className="border-l-2 border-[var(--accento-pieno)] bg-[var(--superficie-2)] p-0!"
                          >
                            <Dettaglio
                              titolo={t}
                              vista={aperta.vista}
                              onVista={(vista) => setAperta({ isin: t.isin, vista })}
                              onChiudi={() => setAperta(null)}
                              oggi={oggi}
                              condizioni={condizioni}
                              contesto={contesto}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </Tabella>
            <AvantiIndietro pagine={pagine} indice={paginaCorrente} onScegli={cambiaPagina} />
          </div>
        )}

        {scheda === "variabili" && (
          <div role="tabpanel" aria-label="Tasso variabile (CCTeu)">
            <Introduzione>
              La cedola segue l'Euribor a 6 mesi più uno spread: sale se salgono i tassi, e per
              questo il prezzo oscilla molto meno di un tasso fisso di pari scadenza.
            </Introduzione>
            <Tabella
              colonne={COLONNE_VARIABILI}
              vuoto={variabili.length === 0 ? "Nessun titolo con questi filtri." : undefined}
              nota={
                <>
                  Lo spread è quanto il titolo paga sopra l'Euribor, ed è l'unico dato di
                  rendimento che il listino pubblica. Cedola e YTM sono calcolati con
                  l'Euribor 6 mesi{" "}
                  {euribor6m ? (
                    <>
                      al <strong>{formatPct(euribor6m.percentuale, 3)}</strong> (media mensile BCE,{" "}
                      {formatMeseIT(euribor6m.periodo)})
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
                  <CellaTitolo titolo={t} conNota />
                  <CellaScadenza data={t.dataScadenza} anni={t.anniResidui} />
                  <Cella numerica forte>
                    {t.spread == null ? "—" : `+${formatPct(t.spread)}`}
                  </Cella>
                  <Cella numerica>{t.cedolaStimata == null ? "—" : formatPct(t.cedolaStimata, 3)}</Cella>
                  <Cella numerica>{formatPrezzo(t.prezzo)}</Cella>
                  {t.ytmNettoPct == null ? (
                    <Cella evidenza className="text-xs text-[var(--inchiostro-muto)]">
                      {t.motivoNonCalcolabile}
                    </Cella>
                  ) : (
                    <Cella numerica evidenza>
                      <span className="text-[0.9375rem] font-semibold">{formatPct(t.ytmNettoPct)}</span>
                      {t.ytmLordoPct != null && <Sotto>lordo {formatPct(t.ytmLordoPct)}</Sotto>}
                    </Cella>
                  )}
                  <CellaScambi titolo={t} />
                </Riga>
              ))}
            </Tabella>
          </div>
        )}

        {scheda === "cedoleUniche" && (
          <div role="tabpanel" aria-label="Cedola unica (BTP Valore Insieme)">
            <Introduzione>
              Una cedola sola, pagata a scadenza insieme al capitale. Intanto matura giorno per giorno
              nel rateo, contato in 30E/360: chi compra lo paga a chi vende, e l'imposta del 12,5% su
              quella parte gliela rimborsano subito. Il rendimento si calcola quando Borsa Italiana
              pubblica la cedola definitiva: durante il collocamento c'è solo il minimo garantito, che
              alla chiusura può solo salire.
            </Introduzione>
            <Tabella
              colonne={colonneCedolaUnica(nominale)}
              vuoto={cedoleUniche.length === 0 ? "Nessun titolo con questi filtri." : undefined}
            >
              {cedoleUniche.map((r) => {
                const conti = r.metriche;
                if (conti == null) {
                  return (
                    <Riga key={r.isin}>
                      <CellaTitolo titolo={r} conNota />
                      <CellaScadenza data={r.dataScadenza} anni={r.anniResidui} />
                      <CellaCedolaUnica titolo={r} nominale={nominale} />
                      <Cella numerica>{formatPrezzo(r.prezzo)}</Cella>
                      <Cella numerica>—</Cella>
                      <Cella evidenza className="text-xs text-[var(--inchiostro-muto)]">
                        {r.motivoNonCalcolabile}
                      </Cella>
                      <Cella numerica>—</Cella>
                      <Cella numerica>—</Cella>
                      <CellaScambi titolo={r} />
                    </Riga>
                  );
                }
                const espansa = aperta?.isin === r.isin;
                return (
                  <Fragment key={r.isin}>
                    <Riga
                      onClick={() => cambiaAperta(r.isin)}
                      espansa={espansa}
                      etichetta={`${espansa ? "Chiudi" : "Apri"} le simulazioni di ${r.nome}`}
                    >
                      <CellaTitolo titolo={conti} aperta={espansa} />
                      <CellaScadenza data={r.dataScadenza} anni={conti.rendimentoNominale?.anni ?? null} />
                      <CellaCedolaUnica titolo={r} nominale={nominale} />
                      <Cella numerica>{formatPrezzo(r.prezzo)}</Cella>
                      <CelleConti titolo={conti} />
                      <CellaScambi titolo={r} />
                    </Riga>
                    {espansa && aperta && (
                      <tr className="border-b border-[var(--bordo)]">
                        <td
                          colSpan={colonneFlussi.length}
                          className="border-l-2 border-[var(--accento-pieno)] bg-[var(--superficie-2)] p-0!"
                        >
                          <Dettaglio
                            titolo={conti}
                            vista={aperta.vista}
                            onVista={(vista) => setAperta({ isin: r.isin, vista })}
                            onChiudi={() => setAperta(null)}
                            oggi={oggi}
                            condizioni={condizioni}
                            contesto={contesto}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </Tabella>
          </div>
        )}

        {scheda === "indicizzati" && (
          <div role="tabpanel" aria-label="Indicizzati all'inflazione">
            <Introduzione>
              Titoli in cui il capitale si rivaluta con il costo della vita. Sono un modello diverso
              dal tasso fisso, per questo stanno in una scheda a parte: prezzo e cedola di un BTP€i
              sono già <em>reali</em>, cioè al netto della rivalutazione, e non vanno confrontati
              direttamente con quelli del tasso fisso.
            </Introduzione>
            <Tabella
              colonne={COLONNE_INDICIZZATI}
              vuoto={indicizzati.length === 0 ? "Nessun titolo con questi filtri." : undefined}
              nota={
                <>
                  Rendimenti <strong>lordi</strong> da entrambe le parti: il netto di un indicizzato
                  dipende dalla rivalutazione del capitale, tassata al 12,5% ma non nota in anticipo,
                  e mostrarlo sarebbe un numero sbagliato in una direzione sola. L'inflazione di
                  pareggio è confrontata con il <strong>{formatPct(condizioni.inflazioneAttesa)}</strong>{" "}
                  che ti aspetti (si cambia in «Le tue condizioni»): attenzione, i BTP€i seguono
                  l'HICP <em>dell'area euro</em> senza tabacchi (gli OATi quella francese), vicino ma
                  non uguale all'inflazione italiana. Nessun importo in euro: servirebbe il coefficiente di
                  indicizzazione del MEF, che il sito non scarica.
                </>
              }
            >
              {indicizzati.map((t) => {
                const lettura =
                  t.confronto && leggiPareggio(t.confronto.pareggioPct, condizioni.inflazioneAttesa);
                return (
                  <Riga key={t.isin}>
                    <CellaTitolo titolo={t} conNota />
                    <CellaScadenza data={t.dataScadenza} anni={t.anniResidui} />
                    <Cella numerica>
                      {formatPct(t.cedolaAnnua)}
                      <Sotto>+ rivalutazione</Sotto>
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
                        <Cella numerica evidenza>
                          <span className="text-[0.9375rem] font-semibold">{formatPct(t.ytmRealeLordoPct)}</span>
                        </Cella>
                        <Cella>
                          {t.confronto ? (
                            <>
                              <span className="text-xs">{t.confronto.nome}</span>
                              <Sotto>
                                {formatPct(t.confronto.ytmNominaleLordoPct)} nominale
                                {t.confronto.scartoGiorni > 60 &&
                                  ` · scade ${formatNumero(Math.round(t.confronto.scartoGiorni / 30))} mesi ${
                                    t.confronto.dataScadenza > t.dataScadenza ? "dopo" : "prima"
                                  }`}
                              </Sotto>
                            </>
                          ) : (
                            <Sotto>{t.motivoNonCalcolabile}</Sotto>
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
          </div>
        )}
      </section>

      {rapporto.scartate.length > 0 && <Scartate scartate={rapporto.scartate} />}
      {tutte.length === 0 && <Vuoto>Il catalogo di oggi è vuoto.</Vuoto>}
    </div>
  );
}
