# quantotorna

Quanto torna davvero un titolo di Stato se lo tieni fino a scadenza: il
rendimento netto secondo il fisco italiano e la cifra finale in euro, per i
titoli quotati sul MOT di Borsa Italiana.

Sito statico (Next.js in esportazione statica): i conti della tabella si
fanno alla compilazione, quelli che dipendono da chi guarda — nominale,
prezzo, commissioni, zainetto — nel suo browser, con le stesse funzioni. Non
c'è un server, né cookie, né statistiche di visita.

```sh
npm ci
npm test
npm run scarica   # scarica i dati del giorno in dati/catalogo.json (un minuto)
npm run build     # compila il sito in out/
npm run dev       # oppure: il sito in sviluppo su http://localhost:3100
```

Lo scaricamento va lanciato dopo la chiusura del MOT (17:30): prima, l'ultimo
prezzo è quello della seduta in corso. Il primo giro trova i dati di
emissione solo per i titoli italiani dell'anno; gli altri si leggono da
onvista, quaranta al giorno (`npm run scarica -- --onvista 700` li prende
tutti in una volta).

Come si fanno i conti, con le semplificazioni dichiarate e le verifiche:
`app/metodologia/page.tsx`, la pagina «Metodologia» del sito.

## Per chi contribuisce

Prima di tutto attiva gli hook:

```sh
git config core.hooksPath scripts/hooks
```

- a ogni commit, `scripts/controllo-privacy.mjs` cerca nei file in stage le
  voci di una lista di dati personali tenuta fuori dalla repo, in
  `~/.config/quantotorna/`;
- a ogni push, lo stesso controllo sui commit che escono, poi l'agente
  `guardiano-privacy` (`.claude/agents/`), che legge le modifiche e ferma
  tutto se trova qualcosa che dice cosa possiede o fa chi scrive.

Gli ISIN e i dati di mercato sono pubblici e passano; quantità, importi,
conti, email private e percorsi locali no.

## Licenza

[GNU AGPL-3.0](LICENSE). Chi usa questo codice per offrire un servizio deve
rendere disponibili anche le proprie modifiche.

Autore: Alessandro Matera.
