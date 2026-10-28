/**
 * Scaricamento giornaliero: scrive dati/catalogo.json, da cui si compila il
 * sito.
 *
 *   npm run scarica                     il giro di ogni giorno
 *   npm run scarica -- --onvista 40     al più 40 schede onvista (senza: tutte quelle che mancano)
 *   npm run scarica -- --da-zero        ignora il catalogo di ieri
 *
 * Va lanciato dopo la chiusura del MOT (17:30): prima, l'«ultimo» di Borsa
 * Italiana è un prezzo della seduta in corso. La logica è in
 * lib/catalogo/scaricamento.ts; qui ci sono solo le fonti vere, la lettura
 * del catalogo di ieri e la scrittura di quello di oggi.
 *
 * Se i listini non si leggono esce con 1 e non tocca il file: il sito resta
 * quello di ieri. Il file nuovo si scrive accanto e poi si sostituisce, così
 * un'interruzione a metà non lascia mai un catalogo troncato.
 *
 * Le righe lasciate fuori per un motivo che ieri non c'era finiscono nel
 * riepilogo del giro su GitHub, e il loro numero fra gli output dello step
 * (`scartate_nuove`): il workflow, dopo aver pubblicato, lo segnala.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PERCORSO_CATALOGO, caricaCatalogo } from "../lib/catalogo/file";
import { leggiCatalogo } from "../lib/catalogo/formato";
import { motivoSuUnaRiga, riepilogoScartateNuove, scartateNuove } from "../lib/catalogo/scartate";
import { aggiornaCatalogo, type RapportoScaricamento } from "../lib/catalogo/scaricamento";
import { giornoDeiPrezzi, oggiISO } from "../lib/date";
import { dataGodimentoMot, scaricaListaBtp, schedaStepUpMot } from "../lib/prezzi/borsaitaliana";
import { scaricaStoricoScambi } from "../lib/prezzi/euronext";
import { elencaDocumentiMef, leggiDocumentiMef } from "../lib/prezzi/mef";
import { emissioneOnvista } from "../lib/prezzi/onvista";
import { euribor6m } from "../lib/prezzi/tassi-bce";

function opzione(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  return i < 0 ? null : (process.argv[i + 1] ?? null);
}

async function main() {
  const daZero = process.argv.includes("--da-zero");
  const onvista = opzione("--onvista");
  const maxOnvista = onvista == null ? undefined : Number(onvista);
  if (maxOnvista != null && !(Number.isInteger(maxOnvista) && maxOnvista >= 0)) {
    throw new Error(`--onvista vuole un numero intero, non «${onvista}»`);
  }
  // Il catalogo di ieri è la memoria: dati di emissione, piani degli step-up,
  // documenti del MEF già letti. Se non si legge ci si ferma, invece di
  // ripartire da zero senza dirlo: lo si chiede con --da-zero.
  const precedente = !daZero && existsSync(PERCORSO_CATALOGO) ? caricaCatalogo() : null;

  const inizio = Date.now();
  const { catalogo, rapporto } = await aggiornaCatalogo(
    precedente,
    {
      listini: scaricaListaBtp,
      euribor6m,
      elencaDocumentiMef,
      leggiDocumentiMef,
      schedaStepUp: schedaStepUpMot,
      emissioneOnvista,
      dataGodimento: dataGodimentoMot,
      scambi: scaricaStoricoScambi,
    },
    { oggi: giornoDeiPrezzi(oggiISO()), generato: new Date().toISOString(), maxOnvista },
  );

  // Lo stesso controllo che farà la compilazione: un file che la pagina non
  // saprebbe leggere non si scrive.
  const testo = `${JSON.stringify(catalogo, null, 1)}\n`;
  leggiCatalogo(JSON.parse(testo));
  mkdirSync(dirname(PERCORSO_CATALOGO), { recursive: true });
  const provvisorio = `${PERCORSO_CATALOGO}.nuovo`;
  writeFileSync(provvisorio, testo);
  renameSync(provvisorio, PERCORSO_CATALOGO);

  stampa(rapporto, catalogo.data, Date.now() - inizio);
  for (const f of catalogo.rapporto.fontiMancanti) {
    console.log(
      `ATTENZIONE: ${f.fonte} non ha risposto (${f.errore}); ultima lettura riuscita: ${f.ultimaLettura ?? "non nota"}.`,
    );
  }
  if (precedente) {
    segnalaScartateNuove(scartateNuove(precedente.rapporto.scartate, catalogo.rapporto.scartate));
  } else {
    console.log("Senza il catalogo di ieri gli scartati non si confrontano.");
  }
}

/**
 * Le scartate nuove nel log e, su GitHub Actions, nel riepilogo del giro e
 * fra gli output dello step. Fuori da GitHub le due variabili non ci sono.
 * Il catalogo è già scritto: un errore qui si dice nel log ma non ferma il
 * giro, perché il sito si aggiorna comunque.
 */
function segnalaScartateNuove(nuove: { isin: string; motivo: string }[]) {
  for (const s of nuove) console.log(`NUOVO SCARTATO ${s.isin}: ${motivoSuUnaRiga(s.motivo)}`);
  try {
    const riepilogo = process.env.GITHUB_STEP_SUMMARY;
    if (riepilogo && nuove.length > 0) appendFileSync(riepilogo, riepilogoScartateNuove(nuove));
    const output = process.env.GITHUB_OUTPUT;
    if (output) appendFileSync(output, `scartate_nuove=${nuove.length}\n`);
  } catch (e) {
    console.log(`ATTENZIONE: scartati nuovi non segnalati a GitHub (${e instanceof Error ? e.message : String(e)}).`);
  }
}

function stampa(r: RapportoScaricamento, data: string, ms: number) {
  const righe: string[] = [];
  righe.push(`Catalogo del ${data}: ${r.importati} titoli da ${r.pagine} pagine (${Math.round(ms / 1000)} s).`);
  righe.push(
    `  per famiglia: ${Object.entries(r.perTipo)
      .map(([t, n]) => `${t} ${n}`)
      .join(", ")}`,
  );
  if (r.scartate.length > 0) {
    righe.push(`  scartati ${r.scartate.length}:`);
    for (const s of r.scartate.slice(0, 20)) righe.push(`    ${s.isin}: ${s.motivo}`);
    if (r.scartate.length > 20) righe.push(`    … e altri ${r.scartate.length - 20}`);
  }
  righe.push(
    "errore" in r.euribor
      ? `Euribor 6m: non letto (${r.euribor.errore}), resta quello di ieri.`
      : `Euribor 6m: ${r.euribor.percentuale}% (${r.euribor.periodo}).`,
  );
  const { mef, onvista, borsaItaliana } = r;
  righe.push(
    mef.errore != null
      ? `MEF: non raggiungibile (${mef.errore}).`
      : `MEF: ${mef.documentiNuovi} documenti nuovi, ${mef.letti} letti, ${mef.titoli} titoli` +
          (mef.nonScaricati > 0 ? `, ${mef.nonScaricati} non scaricati` : "") +
          (mef.illeggibili.length > 0 ? `, ${mef.illeggibili.length} illeggibili` : "") +
          ".",
  );
  for (const d of mef.illeggibili.slice(0, 5)) righe.push(`    ${decodeURIComponent(d.url.split("/").pop() ?? "")}: ${d.motivo}`);
  righe.push(`onvista: ${onvista.trovati} trovati su ${onvista.chiesti} chiesti.`);
  if (borsaItaliana.chieste > 0) {
    righe.push(`Date di godimento da Borsa Italiana: ${borsaItaliana.trovate} su ${borsaItaliana.chieste}.`);
  }
  for (const c of r.cambiati) {
    righe.push(
      `  corretto ${c.isin}: ${c.prima.prezzoEmissione} → ${c.dopo.prezzoEmissione}` +
        (c.prima.dataEmissione !== c.dopo.dataEmissione ? ` (data ${c.prima.dataEmissione} → ${c.dopo.dataEmissione})` : "") +
        ` [${c.dopo.fonte}]`,
    );
  }
  righe.push(`Restano senza dati di emissione ${r.senzaEmissione.length} titoli.`);
  righe.push(
    "errore" in r.scambi
      ? `Scambi: non letti (${r.scambi.errore}).`
      : `Scambi: ${r.scambi.letti} titoli letti, ${r.scambi.maiScambiati} mai scambiati, ${r.scambi.falliti.length} non letti.`,
  );
  console.log(righe.join("\n"));
}

main().catch((e) => {
  console.error(`Scaricamento fallito: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
