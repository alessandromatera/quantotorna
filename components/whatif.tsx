"use client";

import {
  grigliaScenari,
  shockDiPareggio,
  simulaUscita,
  type EsitoUscita,
  type Pareggio as PareggioMotore,
} from "@/lib/bond/whatif";
import type { ParametriBond } from "@/lib/bond/ytm";
import { commissione, type TariffaMercato } from "@/lib/costi/commissioni";
import { aggiungiMesi } from "@/lib/date";
import { controvaloreCents } from "@/lib/tax/lifo";
import type { VoceZainetto } from "@/lib/tax/zainetto";
import {
  formatDataIT,
  formatEuro,
  formatEuroSegno,
  formatNumero,
  formatPct,
  formatPctSegno,
  formatPrezzo,
} from "@/lib/client/format";
import { Misura, Segmentato } from "@/components/ui";
import { Termine } from "@/components/termine";
import { useMemo, useState } from "react";

/**
 * «E se uscissi prima?»: il calcolatore accanto a un singolo titolo.
 *
 * Le colonne della tabella rispondono alla domanda di chi tiene il titolo
 * fino in fondo. Questo risponde all'altra, che su una scadenza lunga è
 * quella vera: se lo compro oggi, cosa ho in mano uscendo al momento X con i
 * tassi spostati di Y. Il motore è in `lib/bond/whatif.ts`, tutto puro e
 * tutto qui nel browser: nessuna chiamata a un server, lo slider ricalcola
 * mentre si muove.
 */

/** Orizzonti offerti. `null` = tenere fino al rimborso. */
const ORIZZONTI: { valore: string; anni: number | null; nome: string }[] = [
  { valore: "1", anni: 1, nome: "1 anno" },
  { valore: "2", anni: 2, nome: "2 anni" },
  { valore: "3", anni: 3, nome: "3 anni" },
  { valore: "5", anni: 5, nome: "5 anni" },
  { valore: "10", anni: 10, nome: "10 anni" },
  { valore: "scadenza", anni: null, nome: "A scadenza" },
];

/**
 * Ancoraggi storici dello slider. Uno slider nudo non dice se un punto
 * percentuale è tanto o poco: questi sono movimenti che il tratto lungo ha
 * fatto davvero, e servono a dare la scala. Gli spostamenti sono indicativi,
 * arrotondati al mezzo punto.
 */
const PRESET: { nome: string; shock: number; titolo: string }[] = [
  { nome: "Crollo tassi", shock: -2, titolo: "Come il 2014-2019: discesa lunga, circa −2 punti" },
  { nome: "Fermi", shock: 0, titolo: "Curva invariata: restano solo cedole e roll-down" },
  { nome: "Come il 2022", shock: 2.5, titolo: "Risalita del 2022: circa +2,5 punti in dodici mesi" },
  { nome: "Crisi spread", shock: 3, titolo: "Come il 2011: circa +3 punti sul solo rischio Italia" },
];

const SHOCK_GRIGLIA = [-2, -1, 0, 1, 2];
const ORIZZONTI_GRIGLIA = [1, 3, 5, 10];

export interface ContestoFiscale {
  zainetto: VoceZainetto[];
  compensazioneTitoliStatoRidotta: boolean;
}

export function CalcolatoreUscita({
  bond,
  contesto,
  tariffa,
}: {
  /**
   * Il titolo comprato oggi, già regolato a T+2 (`perAcquisto`): con lo
   * storno dell'imposta sul rateo e il credito sul disaggio nell'esborso.
   */
  bond: ParametriBond;
  contesto?: ContestoFiscale;
  /** Tariffa scelta da chi guarda: le commissioni seguono ogni scenario. */
  tariffa?: TariffaMercato;
}) {
  const [orizzonte, setOrizzonte] = useState("3");
  const [shock, setShock] = useState(0);

  const base = useMemo(
    () => ({
      bond: {
        ...bond,
        commissioni: tariffa
          ? commissione({ tariffa, controvalore: controvaloreCents(bond.quantita, bond.prezzo) })
          : 0,
      },
      zainetto: contesto?.zainetto ?? [],
      compensazioneTitoliStatoRidotta: contesto?.compensazioneTitoliStatoRidotta ?? false,
      tariffa,
    }),
    [bond, contesto, tariffa],
  );

  const anni = ORIZZONTI.find((o) => o.valore === orizzonte)?.anni ?? null;
  // Passa da `aggiungiMesi`, come la griglia: da un 29 febbraio la
  // sostituzione secca dell'anno darebbe un giorno che non esiste.
  const dataUscita =
    anni == null ? bond.dataScadenza : aggiungiMesi(bond.dataRiferimento, anni * 12);

  const esito = useMemo(
    () => simulaUscita({ ...base, dataUscita, shockPct: shock }),
    [base, dataUscita, shock],
  );
  const pareggio = useMemo(
    () => shockDiPareggio({ ...base, dataUscita, shockPct: 0 }),
    [base, dataUscita],
  );
  const griglia = useMemo(
    () => grigliaScenari(base, ORIZZONTI_GRIGLIA, SHOCK_GRIGLIA),
    [base],
  );

  if (!esito) {
    return (
      <p className="text-sm text-[var(--inchiostro-muto)]">
        Titolo scaduto o prezzo non utilizzabile: non c'è un'uscita da simulare.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
          Esco fra
        </span>
        <Segmentato
          voci={ORIZZONTI.map((o) => ({ valore: o.valore, nome: o.nome }))}
          valore={orizzonte}
          onCambia={setOrizzonte}
          etichetta="Orizzonte di uscita"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="shock-tassi" className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
            E i tassi nel frattempo
          </label>
          <span className="cifre-tabellari text-sm font-semibold">
            {formatPctSegno(shock, 2)}{" "}
            <span className="font-normal text-[var(--inchiostro-muto)]">
              ({formatSegnoBp(shock * 100)})
            </span>
          </span>
        </div>
        <input
          id="shock-tassi"
          type="range"
          min={-3}
          max={5}
          step={0.25}
          value={shock}
          onChange={(e) => setShock(Number(e.target.value))}
          className="w-full accent-[var(--accento-pieno)]"
        />
        <div className="flex flex-wrap gap-2">
          {PRESET.map((p) => (
            <button
              key={p.nome}
              type="button"
              title={p.titolo}
              aria-pressed={shock === p.shock}
              onClick={() => setShock(p.shock)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                shock === p.shock
                  ? "border-[var(--accento-pieno)] bg-[var(--accento-pieno)] text-white"
                  : "border-[var(--bordo)] bg-[var(--superficie)] text-[var(--inchiostro-2)] hover:border-[var(--bordo-forte)]"
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <Pareggio esito={esito} pareggio={pareggio} />

      <Scomposizione esito={esito} bond={bond} />

      <GrigliaScenari griglia={griglia} />

      <p className="text-xs text-[var(--inchiostro-muto)]">
        Il prezzo di uscita è ricalcolato scontando i flussi che restano a
        quella data — non è la duration moltiplicata per lo shock, quindi
        tiene dentro sia l'accorciarsi del titolo sia la risalita verso la
        pari. Lo spostamento dei tassi è <strong>parallelo</strong> e non
        distingue il rialzo generale dall'allargamento dello spread Italia.
        Le cedole restano liquide: non sono reinvestite — ed è la ragione
        principale per cui «a scadenza» qui rende meno dello YTM netto in
        tabella, che invece le dà per reinvestite al tasso dello YTM stesso.
        Commissioni di acquisto e vendita sono quelle della tariffa scelta in
        «Le tue condizioni».
      </p>
    </div>
  );
}

/**
 * L'unica risposta secca alla domanda «posso uscire quando voglio»: quanto
 * può muoversi il mercato prima che quell'uscita sia una perdita.
 */
function Pareggio({
  esito,
  pareggio,
}: {
  esito: EsitoUscita;
  pareggio: PareggioMotore | null;
}) {
  if (esito.aScadenza) {
    return (
      <div className="rounded-md border border-[var(--bordo)] bg-[var(--superficie)] p-3 text-sm">
        <strong>Tenuto fino al rimborso non c'è rischio prezzo:</strong> si
        incassa 100 comunque, e i tassi lungo la strada non cambiano il
        risultato. È l'unica data in cui il titolo smette di dipendere dal
        mercato.
      </div>
    );
  }

  /* Detto qui perché è dove si legge il numero: la soglia è misurata su
     quanto costa comprarlo oggi, commissioni e crediti d'imposta compresi. */
  const riferimento = "rispetto a quanto si spende comprandolo oggi";

  if (pareggio == null) {
    return null;
  }

  if (pareggio.tipo === "sempreInGuadagno") {
    return (
      <div
        className="rounded-md border border-l-4 border-[var(--bordo)] bg-[var(--superficie)] p-3 text-sm"
        style={{ borderLeftColor: "var(--delta-buono)" }}
      >
        <strong>Nessun rialzo plausibile porta in perdita.</strong> A questa
        distanza dal rimborso il prezzo non ha più lo spazio per scendere
        abbastanza: anche con i tassi su di parecchi punti, uscire il{" "}
        {formatDataIT(esito.dataUscita)} resta un guadagno {riferimento}.
      </div>
    );
  }

  if (pareggio.tipo === "sempreInPerdita") {
    return (
      <div
        className="rounded-md border border-l-4 border-[var(--bordo)] bg-[var(--superficie)] p-3 text-sm"
        style={{ borderLeftColor: "var(--stato-critico)" }}
      >
        <strong>In perdita in ogni scenario.</strong> Su questo orizzonte
        nemmeno un crollo dei tassi copre i costi dell'andata e ritorno:
        l'uscita è perdente comunque vada il mercato.
      </div>
    );
  }

  const bp = pareggio.bp;
  const tono =
    bp < 50
      ? "var(--stato-critico)"
      : bp < 150
        ? "var(--stato-avviso)"
        : "var(--delta-buono)";
  return (
    <div
      className="rounded-md border border-l-4 border-[var(--bordo)] bg-[var(--superficie)] p-3"
      style={{ borderLeftColor: tono }}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--inchiostro-muto)]">
        <Termine chiave="shockPareggio">Margine prima della perdita</Termine>
      </div>
      <div className="cifre-tabellari mt-1 text-2xl font-semibold" style={{ color: tono }}>
        {formatSegnoBp(bp)}
      </div>
      <p className="mt-1 text-sm text-[var(--inchiostro-2)]">
        Uscendo il {formatDataIT(esito.dataUscita)} si va in perdita se da qui
        ad allora i tassi salgono di più di {formatPct(bp / 100)}. Sotto quella
        soglia cedole e risalita del prezzo coprono il calo — {riferimento}.
      </p>
    </div>
  );
}

/** Da dove viene il risultato: il conto in chiaro, non solo il totale. */
function Scomposizione({
  esito,
  bond,
}: {
  esito: EsitoUscita;
  bond: ParametriBond;
}) {
  const colore =
    esito.guadagnoNetto > 0
      ? "var(--delta-buono)"
      : esito.guadagnoNetto < 0
        ? "var(--stato-critico)"
        : "var(--inchiostro-2)";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Misura
          etichetta="Investo oggi"
          valore={formatEuro(esito.esborso)}
          dettaglio={`${formatNumero(bond.quantita)} nom. a ${formatPrezzo(bond.prezzo)}`}
        />
        <Misura
          etichetta="Prezzo di uscita"
          valore={formatPrezzo(esito.prezzoUscita)}
          dettaglio={
            <span
              style={{
                color:
                  esito.variazionePrezzoPct >= 0
                    ? "var(--delta-buono)"
                    : "var(--stato-critico)",
              }}
            >
              {formatPctSegno(esito.variazionePrezzoPct, 1)} sul prezzo
            </span>
          }
        />
        <Misura
          etichetta="Incasso netto"
          valore={formatEuro(esito.incassoNetto)}
          dettaglio={`il ${formatDataIT(esito.dataUscita)}`}
        />
        <Misura
          etichetta="Rendimento netto"
          valore={
            <span style={{ color: colore }}>
              {esito.rendimentoAnnuoPct == null
                ? formatEuroSegno(esito.guadagnoNetto)
                : `${formatPctSegno(esito.rendimentoAnnuoPct)}`}
            </span>
          }
          dettaglio={
            esito.rendimentoAnnuoPct == null
              ? "orizzonte troppo breve per annualizzare"
              : `${formatEuroSegno(esito.guadagnoNetto)} in ${formatNumero(esito.anni, 1)} anni`
          }
        />
      </div>

      <dl className="cifre-tabellari space-y-1 border-t border-[var(--griglia)] pt-3 text-sm">
        <Voce etichetta="Cedole incassate (lorde)" valore={formatEuro(esito.cedoleLorde)} />
        {esito.rateoVendita > 0 && (
          <Voce etichetta="Rateo incassato alla vendita" valore={formatEuro(esito.rateoVendita)} />
        )}
        <Voce
          etichetta="Imposta su cedole e rateo"
          valore={`− ${formatEuro(esito.impostaRedditiCapitale)}`}
        />
        <Voce
          etichetta="Plus/minus sul prezzo di acquisto"
          valore={formatEuroSegno(esito.plusMinus)}
        />
        {esito.commissioniVendita > 0 && (
          <Voce
            etichetta="Commissioni di vendita"
            valore={`− ${formatEuro(esito.commissioniVendita)}`}
          />
        )}
        {esito.impostaPlusvalenza > 0 && (
          <Voce
            etichetta="Imposta sulla plusvalenza"
            valore={`− ${formatEuro(esito.impostaPlusvalenza)}`}
          />
        )}
        {esito.minusvalenzeAssorbite > 0 && (
          <Voce
            etichetta={<Termine chiave="zainetto">Zainetto consumato</Termine>}
            valore={formatEuro(esito.minusvalenzeAssorbite)}
          />
        )}
      </dl>

      {/* Una perdita su un BTP non è solo una perdita: è capienza fiscale che
          vale finché non scade, e va detto nello stesso posto in cui si vede
          il rosso — altrimenti la si scopre troppo tardi per usarla. */}
      {esito.minusvalenzaGenerata && (
        <p className="rounded-md bg-[var(--griglia)] p-2 text-xs text-[var(--inchiostro-2)]">
          Uscendo in perdita si crea{" "}
          <strong>{formatEuro(esito.minusvalenzaGenerata.importo)}</strong> di
          minusvalenza compensabile, utilizzabile fino al{" "}
          {formatDataIT(esito.minusvalenzaGenerata.dataScadenza)}.
        </p>
      )}
    </div>
  );
}

function Voce({ etichetta, valore }: { etichetta: React.ReactNode; valore: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-sans text-[var(--inchiostro-2)]">{etichetta}</dt>
      <dd>{valore}</dd>
    </div>
  );
}

/**
 * La griglia orizzonti × shock. Lo slider risponde a una domanda per volta;
 * questa fa vedere la forma dell'insieme — e cioè che lo stesso shock passa
 * da disastro a inezia solo cambiando quanto si resta dentro.
 */
function GrigliaScenari({
  griglia,
}: {
  griglia: ReturnType<typeof grigliaScenari>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--inchiostro-muto)]">
          Rendimento netto annuo per orizzonte e movimento dei tassi
        </caption>
        <thead>
          <tr className="border-b border-[var(--griglia)] text-xs uppercase tracking-wide text-[var(--inchiostro-muto)]">
            <th scope="col" className="py-1 pr-3 text-left font-medium">
              Esco fra
            </th>
            {SHOCK_GRIGLIA.map((s) => (
              <th key={s} scope="col" className="py-1 pr-3 text-right font-medium">
                {formatPctSegno(s, 0)}
              </th>
            ))}
            <th scope="col" className="py-1 text-right font-medium">
              Pareggio
            </th>
          </tr>
        </thead>
        <tbody>
          {griglia.map((riga) => (
            <tr key={riga.anni} className="border-b border-[var(--griglia)]">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                {riga.anni} {riga.anni === 1 ? "anno" : "anni"}
              </th>
              {riga.esiti.map((e) => (
                <td
                  key={e.ytmUscitaPct}
                  className="cifre-tabellari py-1.5 pr-3 text-right"
                  style={{
                    color:
                      e.rendimentoAnnuoPct == null
                        ? "var(--inchiostro-muto)"
                        : e.rendimentoAnnuoPct > 0
                          ? "var(--delta-buono)"
                          : "var(--stato-critico)",
                  }}
                >
                  {e.rendimentoAnnuoPct == null
                    ? "—"
                    : formatPctSegno(e.rendimentoAnnuoPct, 1)}
                </td>
              ))}
              <td className="cifre-tabellari py-1.5 text-right text-[var(--inchiostro-2)]">
                {riga.pareggio == null ? (
                  "—"
                ) : riga.pareggio.tipo === "soglia" ? (
                  formatSegnoBp(riga.pareggio.bp)
                ) : riga.pareggio.tipo === "sempreInGuadagno" ? (
                  <span
                    title="Nessun rialzo plausibile porta in perdita"
                    style={{ color: "var(--delta-buono)" }}
                  >
                    al riparo
                  </span>
                ) : (
                  <span
                    title="In perdita in ogni scenario"
                    style={{ color: "var(--stato-critico)" }}
                  >
                    mai in pari
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Punti base col segno: l'unità in cui si ragiona sui movimenti di tasso. */
function formatSegnoBp(bp: number): string {
  const arrotondato = Math.round(bp);
  return `${arrotondato > 0 ? "+" : ""}${formatNumero(arrotondato)} bp`;
}
