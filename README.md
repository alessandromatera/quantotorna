# quantotorna

Quanto torna davvero un titolo di Stato se lo tieni fino a scadenza: il
rendimento netto secondo il fisco italiano e la cifra finale in euro, per i
titoli quotati sul MOT di Borsa Italiana.

Il progetto è all'inizio: c'è il motore di calcolo con i suoi test e il
controllo che impedisce di pubblicare dati personali. La pagina arriverà
dopo.

```sh
npm ci
npm test
```

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
