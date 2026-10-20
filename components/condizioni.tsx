"use client";

import { Termine } from "@/components/termine";
import { senzaCommissioni } from "@/lib/costi/commissioni";
import { Bottone, Campo, classeCampo, classeInput } from "@/components/ui";
import {
  CHIAVE_CONDIZIONI,
  CONDIZIONI_PREDEFINITE,
  leggiCondizioni,
  vocePerAnno,
  zainettoVivo,
  type Condizioni,
} from "@/lib/client/condizioni";
import {
  euroInInput,
  formatDataIT,
  formatEuro,
  formatNumero,
  numeroInInput,
  parseEuroInCentesimi,
  parseNumeroIT,
  parseQuantitaIT,
} from "@/lib/client/format";
import { useCallback, useEffect, useState } from "react";

/**
 * Le condizioni di chi guarda, lette dal suo browser. La prima resa è con
 * quelle di partenza — la stessa della pagina compilata, così l'idratazione
 * non trova differenze — e quelle salvate arrivano subito dopo.
 *
 * Il localStorage può mancare (navigazione privata, dati bloccati): in quel
 * caso le scelte valgono finché la pagina resta aperta, e nient'altro si
 * rompe.
 */
export function useCondizioni(): [Condizioni, (c: Condizioni) => void] {
  const [condizioni, setCondizioni] = useState<Condizioni>(CONDIZIONI_PREDEFINITE);
  useEffect(() => {
    try {
      setCondizioni(leggiCondizioni(window.localStorage.getItem(CHIAVE_CONDIZIONI)));
    } catch {
      // Niente localStorage: restano quelle di partenza.
    }
  }, []);
  const cambia = useCallback((c: Condizioni) => {
    setCondizioni(c);
    try {
      window.localStorage.setItem(CHIAVE_CONDIZIONI, JSON.stringify(c));
    } catch {
      // Come sopra: la scelta vale per questa visita.
    }
  }, []);
  return [condizioni, cambia];
}

/**
 * Campo di testo che tiene quello che si scrive e lo passa su solo quando è
 * un numero valido: un campo controllato sul numero cancellerebbe la virgola
 * mentre la si digita.
 */
function CampoNumero({
  valore,
  inTesto,
  daTesto,
  onCambia,
  etichetta,
  suggerimento,
  unita,
}: {
  valore: number;
  inTesto: (v: number) => string;
  daTesto: (t: string) => number | null;
  onCambia: (v: number) => void;
  etichetta: string;
  suggerimento?: React.ReactNode;
  unita?: string;
}) {
  const [testo, setTesto] = useState(() => inTesto(valore));
  const [valido, setValido] = useState(true);
  // Le condizioni salvate arrivano dopo la prima resa: il campo le segue
  // finché chi guarda non ci sta scrivendo dentro.
  const [attivo, setAttivo] = useState(false);
  useEffect(() => {
    if (!attivo) setTesto(inTesto(valore));
  }, [valore, attivo, inTesto]);
  return (
    <Campo etichetta={etichetta} suggerimento={suggerimento}>
      <span className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={testo}
          aria-invalid={!valido}
          onFocus={() => setAttivo(true)}
          onBlur={() => {
            setAttivo(false);
            setTesto(inTesto(valore));
            setValido(true);
          }}
          onChange={(e) => {
            setTesto(e.target.value);
            const n = daTesto(e.target.value);
            setValido(n != null);
            if (n != null) onCambia(n);
          }}
          className={`${classeInput} ${valido ? "" : "border-[var(--stato-critico)]"}`}
        />
        {unita && (
          <span className="whitespace-nowrap text-sm text-[var(--inchiostro-muto)]">{unita}</span>
        )}
      </span>
    </Campo>
  );
}

/** Il nominale come lo si scrive: «10.000». Fuori dal componente, per restare lo stesso. */
const formatNumeroIntero = (v: number) => formatNumero(v);

const euro = {
  inTesto: euroInInput,
  daTesto: (t: string) => {
    const c = parseEuroInCentesimi(t);
    return c != null && c >= 0 ? c : null;
  },
};
const percentuale = {
  inTesto: numeroInInput,
  daTesto: (t: string) => {
    const n = parseNumeroIT(t);
    return n != null && n >= 0 && n < 100 ? n : null;
  },
};

/**
 * Le condizioni in una riga, per il bottone che apre il pannello: con che
 * nominale e commissioni si fanno la tabella e le simulazioni, e con che
 * zainetto «Se esco prima», senza doverlo aprire.
 */
export function riassuntoCondizioni(condizioni: Condizioni, oggi: string): string {
  const residuo = zainettoVivo(condizioni.zainetto, oggi).reduce((t, v) => t + v.importoResiduo, 0);
  return [
    `${formatNumero(condizioni.nominale)} € nominali`,
    senzaCommissioni(condizioni.tariffa) ? "senza commissioni" : "con le tue commissioni",
    residuo > 0 ? `zainetto di ${formatEuro(residuo)}` : "zainetto vuoto",
  ].join(" · ");
}

/** Titoletto di una delle tre parti del pannello. */
function Parte({ titolo, spiegazione, children }: { titolo: React.ReactNode; spiegazione: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-semibold">{titolo}</h3>
      <p className="mt-1 mb-3 text-xs text-[var(--inchiostro-muto)]">{spiegazione}</p>
      {children}
    </section>
  );
}

/**
 * Il pannello lavora su una bozza e la applica solo con «Salva»: a ogni
 * salvataggio la tabella rifà i conti di seicento titoli, e farlo a ogni
 * tasto premuto rendeva lenta la scrittura.
 */
export function PannelloCondizioni({
  condizioni: salvate,
  onSalva,
  oggi,
}: {
  condizioni: Condizioni;
  onSalva: (c: Condizioni) => void;
  /** Il giorno dei prezzi: decide quali voci dello zainetto sono ancora vive. */
  oggi: string;
}) {
  const [condizioni, cambia] = useState(salvate);
  // Quando cambiano quelle salvate (lette dal browser, o appena salvate) la
  // bozza riparte da loro.
  const [ultimeSalvate, setUltimeSalvate] = useState(salvate);
  if (salvate !== ultimeSalvate) {
    setUltimeSalvate(salvate);
    cambia(salvate);
  }
  const daSalvare = JSON.stringify(condizioni) !== JSON.stringify(salvate);
  const { tariffa, zainetto } = condizioni;
  const annoCorrente = Number(oggi.slice(0, 4));
  const [nuovoAnno, setNuovoAnno] = useState(String(annoCorrente));
  const [nuovoImporto, setNuovoImporto] = useState("");
  const cambiaTariffa = (campi: Partial<typeof tariffa>) =>
    cambia({ ...condizioni, tariffa: { ...tariffa, ...campi } });

  function aggiungiVoce() {
    const anno = Number(nuovoAnno);
    const importo = parseEuroInCentesimi(nuovoImporto);
    if (!Number.isInteger(anno) || importo == null || importo <= 0) return;
    // Una voce per anno: due dello stesso anno si sommano.
    const altre = zainetto.filter((v) => v.annoCompetenza !== anno);
    const stesso = zainetto.find((v) => v.annoCompetenza === anno)?.importoResiduo ?? 0;
    cambia({
      ...condizioni,
      zainetto: [...altre, vocePerAnno(anno, stesso + importo)].sort(
        (a, b) => a.annoCompetenza - b.annoCompetenza,
      ),
    });
    setNuovoImporto("");
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSalva(condizioni);
      }}
    >
      <p className="text-sm text-[var(--inchiostro-2)]">
        Nominale e commissioni valgono per la tabella e per le simulazioni sotto ogni titolo; lo
        zainetto solo per «Se esco prima». Si applicano quando salvi. Quello che scrivi qui resta in
        questo browser: il sito non ha un server a cui mandarlo.
      </p>
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <Parte
          titolo="Tabella e simulazioni"
          spiegazione="Il nominale della tabella e delle simulazioni. Il «netto a scadenza» lo usa come somma spesa: 5.000 nominali, ogni 5.000 € spesi."
        >
          <div className="space-y-3">
            <CampoNumero
              etichetta="Nominale"
              valore={condizioni.nominale}
              inTesto={formatNumeroIntero}
              daTesto={(t) => {
                const n = parseQuantitaIT(t);
                return n != null && n > 0 && n <= 100_000_000 ? n : null;
              }}
              onCambia={(nominale) => cambia({ ...condizioni, nominale })}
              unita="€ nom."
            />
            <CampoNumero
              etichetta="Inflazione che ti aspetti"
              valore={condizioni.inflazioneAttesa}
              {...percentuale}
              onCambia={(inflazioneAttesa) => cambia({ ...condizioni, inflazioneAttesa })}
              unita="% l'anno"
              suggerimento="Per leggere l'inflazione di pareggio dei BTP€i."
            />
          </div>
        </Parte>

        <Parte
          titolo={
            <>
              <Termine chiave="commissioni">Commissioni</Termine> del tuo intermediario sul MOT
            </>
          }
          spiegazione="Percentuale sul controvalore, tra un minimo e un massimo, più un fisso per ogni eseguito. Lascia zero dove la tua tariffa non prevede la voce."
        >
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero
              etichetta="Percentuale"
              valore={tariffa.percentuale}
              {...percentuale}
              onCambia={(v) => cambiaTariffa({ percentuale: v })}
              unita="%"
            />
            <CampoNumero
              etichetta="Fisso per eseguito"
              valore={tariffa.fisso}
              {...euro}
              onCambia={(v) => cambiaTariffa({ fisso: v })}
              unita="€"
            />
            <CampoNumero
              etichetta="Minimo"
              valore={tariffa.minimo}
              {...euro}
              onCambia={(v) => cambiaTariffa({ minimo: v })}
              unita="€"
            />
            <CampoNumero
              etichetta="Massimo"
              valore={tariffa.massimo}
              {...euro}
              onCambia={(v) => cambiaTariffa({ massimo: v })}
              unita="€"
              suggerimento="Zero = nessun massimo."
            />
          </div>
        </Parte>

        <Parte
          titolo={
            <>
              Il tuo <Termine chiave="zainetto">zainetto fiscale</Termine>
            </>
          }
          spiegazione="Le minusvalenze ancora da compensare, per anno in cui sono nate: valgono fino al 31 dicembre del quarto anno dopo. Le usa «Se esco prima» per tassare l'eventuale plusvalenza; la tabella no, perché lo zainetto si consuma una volta sola e non per ogni riga."
        >
          {zainetto.length > 0 && (
            <ul className="mb-3 divide-y divide-[var(--griglia)] rounded-md border border-[var(--bordo)] text-sm">
              {zainetto.map((v) => (
                <li key={v.annoCompetenza} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <span className="cifre-tabellari font-medium">
                    {v.annoCompetenza}: {euroInInput(v.importoResiduo)} €
                  </span>
                  <span
                    className={`flex-1 text-xs ${v.dataScadenza < oggi ? "text-[var(--stato-critico)]" : "text-[var(--inchiostro-muto)]"}`}
                  >
                    {v.dataScadenza < oggi ? "scaduta il" : "utilizzabile fino al"}{" "}
                    {formatDataIT(v.dataScadenza)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      cambia({
                        ...condizioni,
                        zainetto: zainetto.filter((x) => x.annoCompetenza !== v.annoCompetenza),
                      })
                    }
                    className="text-xs font-medium text-[var(--accento)] hover:underline"
                  >
                    Togli
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Campo etichetta="Anno">
              <input
                type="number"
                inputMode="numeric"
                min={annoCorrente - 4}
                max={annoCorrente}
                value={nuovoAnno}
                onChange={(e) => setNuovoAnno(e.target.value)}
                onKeyDown={(e) => {
                  // Invio qui aggiunge la voce, non salva il pannello.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    aggiungiVoce();
                  }
                }}
                className={`${classeCampo} w-24`}
              />
            </Campo>
            <Campo etichetta="Minusvalenza">
              <span className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={nuovoImporto}
                  onChange={(e) => setNuovoImporto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      aggiungiVoce();
                    }
                  }}
                  className={`${classeCampo} w-32`}
                />
                <span className="text-sm text-[var(--inchiostro-muto)]">€</span>
              </span>
            </Campo>
            <Bottone type="button" tipo="secondario" onClick={aggiungiVoce}>
              Aggiungi
            </Bottone>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={condizioni.compensazioneTitoliStatoRidotta}
              onChange={(e) =>
                cambia({ ...condizioni, compensazioneTitoliStatoRidotta: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 accent-[var(--accento-pieno)]"
            />
            <span>
              Riduci la plusvalenza al 48,08% <em>prima</em> di compensarla
              <span className="block text-xs text-[var(--inchiostro-muto)]">
                La norma non è univoca: di partenza lo zainetto compensa la plusvalenza
                intera e il 48,08% si applica alla parte che resta scoperta. Con questa
                scelta si compensa la base già ridotta, e lo zainetto dura di più.
              </span>
            </span>
          </label>
        </Parte>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--griglia)] pt-4">
        <Bottone type="submit" disabled={!daSalvare}>
          {daSalvare ? "Salva" : "Salvate"}
        </Bottone>
        {daSalvare && (
          <Bottone type="button" tipo="secondario" onClick={() => cambia(salvate)}>
            Annulla le modifiche
          </Bottone>
        )}
        <Bottone
          type="button"
          tipo="secondario"
          className="sm:ml-auto"
          onClick={() => cambia(CONDIZIONI_PREDEFINITE)}
        >
          Torna alle condizioni di partenza
        </Bottone>
      </div>
    </form>
  );
}
