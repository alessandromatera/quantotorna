# quantotorna

**[quantotorna.it](https://quantotorna.it)** — quanto torna davvero un
titolo di Stato se lo tieni fino a scadenza: il rendimento netto secondo il
fisco italiano e la cifra finale in euro, per i titoli quotati sul MOT di
Borsa Italiana.

## Come funziona il sito

Il rendimento che si legge di solito su un BTP è lordo, oppure netto solo a
metà. quantotorna lo rifà con le regole del fisco italiano, titolo per
titolo, e dice anche quanti euro si ritrovano a scadenza.

- **La tabella**: tutti i titoli di Stato del MOT — BTP a tasso fisso e
  step-up, BOT, strip, CCTeu, BTP€i e BTP Italia, titoli esteri della white
  list e sovranazionali — con il rendimento netto e lordo a scadenza dove
  si può calcolare (reale, sugli indicizzati), la plusvalenza a rimborso,
  quanto si ritrova a scadenza ogni 10.000 € spesi, la duration e quanto il
  titolo scambia davvero. Si filtra per famiglia, scadenza, emittente,
  volatilità e scambi, e si ordina da ogni colonna.
- **Le imposte**: 12,5% su cedole, rateo e disaggio di emissione;
  plusvalenze e minusvalenze al 26% sul 48,08% della base, compensabili con
  lo zainetto; lo storno dell'imposta sul rateo pagato all'acquisto; la
  plusvalenza misurata dal prezzo teorico e non da 100. Ogni
  semplificazione è scritta nella [metodologia](https://quantotorna.it/metodologia/).
- **Un clic su un titolo** apre due conti: «Se lo compro», il conto del
  regolamento col tuo nominale, il tuo prezzo e le tue commissioni; e «Se
  esco prima», cosa resta in mano vendendo prima della scadenza, con i tassi
  che salgono o scendono e il tuo zainetto fiscale.
- **Le tue condizioni**: nominale e commissioni del tuo intermediario
  valgono per la tabella e per i conti sotto ogni titolo; lo zainetto per
  «Se esco prima». Si salvano nel tuo browser e non escono di lì.
- **I dati**: prezzi di chiusura del MOT, scambi da Euronext, dati d'asta
  dal MEF, Euribor dalla BCE, scaricati ogni giorno feriale dopo la chiusura
  di Borsa; il sito si rigenera da solo. Si possono scaricare il catalogo
  del giorno ([`/dati/catalogo.json`](https://quantotorna.it/dati/catalogo.json))
  e le tabelle in Markdown ([`/rendimenti.md`](https://quantotorna.it/rendimenti.md));
  per i modelli linguistici c'è [`/llms.txt`](https://quantotorna.it/llms.txt).

Non è consulenza finanziaria: i numeri sono forniti così come sono, e prima
di comprare va controllato il conto del proprio intermediario.

## Come è fatto

Sito statico (Next.js in esportazione statica) su GitHub Pages, rigenerato
ogni sera da GitHub Actions (`.github/workflows/sito.yml`): i conti della
tabella si fanno alla compilazione, su 10.000 nominali e senza commissioni;
quelli che dipendono da chi guarda — nominale e commissioni per la tabella,
in più prezzo e zainetto per le simulazioni — nel suo browser, con le
stesse funzioni. Il motore (`lib/`) è fatto di funzioni pure con i loro
test. Non c'è un server, né cookie, né statistiche di visita.

```sh
npm ci
npm test
npm run scarica   # scarica i dati del giorno in dati/catalogo.json (un minuto)
npm run build     # compila il sito in out/
npm run anteprima # compila e serve out/ su http://localhost:3100
npm run dev       # oppure: il sito in sviluppo, sulla stessa porta
```

Per provarlo da un telefono o da un altro computer di casa:
`npm run anteprima -- --rete`, che stampa l'indirizzo da aprire. Il server di
sviluppo non va bene per questo: Next blocca i suoi file a chi non arriva da
localhost, e la pagina si vede ma non risponde ai clic.

Lo scaricamento va lanciato dopo la chiusura del MOT (17:30): prima, l'ultimo
prezzo è quello della seduta in corso. Il primo giro trova i dati di
emissione solo per i titoli italiani dell'anno; gli altri si leggono da
onvista, quaranta al giorno (`npm run scarica -- --onvista 700` li prende
tutti in una volta).

Come si fanno i conti, con le semplificazioni dichiarate e le verifiche:
`app/metodologia/page.tsx`, la pagina «Metodologia» del sito.

## Per chi contribuisce

Ogni numero viene dal motore in `lib/`, con i suoi test: una modifica ai
conti porta con sé il test che la verifica, e `npm test` e `npm run
typecheck` devono passare. Ogni semplificazione fiscale va dichiarata nel
codice e nella pagina «Metodologia».

- Codice, commenti e messaggi di commit in italiano.
- Niente segreti nel codice, nei test o nei commit (token, chiavi,
  password): gli esempi sono inventati.
- I dati si scaricano una volta al giorno, con la fonte citata in pagina, e
  niente book di negoziazione. Se una pagina delle fonti cambia, lo
  scaricamento fallisce in modo visibile: mai dati parziali presentati come
  completi.

## Licenza

[GNU AGPL-3.0](LICENSE). Chi usa questo codice per offrire un servizio deve
rendere disponibili anche le proprie modifiche.

Autore: Alessandro Matera.
