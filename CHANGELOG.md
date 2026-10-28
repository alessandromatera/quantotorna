# Novità

Cosa è cambiato in quantotorna, dal più recente. Lo stesso elenco sta sul
sito, nella pagina Informazioni. Questo file si genera da `lib/novita.ts`
con `npm run changelog`: si modifica lì, e un test controlla che coincidano.

## 28/10/2026

- BTP Valore Insieme di nuovo in elenco, con la cedola definitiva del 22,70%: rendimento, «Se lo compro» e «Se esco prima». Sta fra i tassi fissi, accanto ai titoli di scadenza vicina; la scheda a parte resta solo per i titoli a cedola unica ancora in collocamento.
- Rating degli Stati riletti: dodici su ventiquattro erano cambiati, fra cui Francia (A+), Belgio (AA-), Irlanda (AA+), Portogallo (A+), Grecia (BBB), Croazia e Cipro (A). S&P non valuta più l'Estonia, che resta senza rating. D'ora in poi si ricontrollano dopo ogni revisione che S&P pubblica.

## 26/10/2026

- La tabella dei tassi fissi si può scorrere tutta di seguito, senza pagine: «Elenco intero», accanto a «Per anno» e «50 per pagina».

## 24/10/2026

- CCTeu: cedola e rateo si contano come li conta il Tesoro, sui giorni effettivi del semestre diviso 360. Le cedole non sono più tutte uguali e il rendimento a scadenza sale di circa 5 punti base.
- Titoli appena emessi con la prima cedola corta: rateo e prima cedola maturano dalla data di godimento, non dalla data teorica precedente. Cambiano rateo, addebito e prima cedola in «Se lo compro», e il rateo di vendita in «Se esco prima» prima della prima cedola; il rendimento resta lo stesso.
- BTP Valore Insieme in una scheda sua: una cedola sola, pagata a scadenza, col rateo in 30E/360. Il rendimento, «Se lo compro» e «Se esco prima» arrivano quando Borsa Italiana pubblica la cedola definitiva; fino ad allora la riga dice il minimo del collocamento.

## 21/10/2026

- Il netto a scadenza della tabella è su 10.000 nominali, o sul nominale delle tue condizioni: lo stesso acquisto di «Se lo compro», commissioni comprese.
- Il guadagno annuo della tabella divide il guadagno per gli anni esatti, non arrotondati al centesimo.
- La tabella dei tassi fissi è divisa in pagine per anno di scadenza.
- In «Se esco prima» il rendimento annuo è il tasso interno dei flussi, come lo YTM: a scadenza, coi tassi fermi, coincide con la tabella. Il risultato del conto è rosso se si perde e verde se si guadagna.
- Se Euronext non risponde restano gli scambi del giorno prima, e la pagina dice qual è l'ultima lettura riuscita.
- I dati di emissione mancanti si cercano ogni giorno per tutti i titoli, non un po' alla volta.
- Nuove pagine Informazioni e Privacy; le tabelle del giorno anche in Markdown, in /rendimenti.md.

## 20/10/2026

- Il sito è online: rendimento netto e cifra finale in euro dei titoli di Stato quotati sul MOT, con i dati rinnovati ogni sera dei giorni feriali e il catalogo del giorno in /dati/catalogo.json.
- Sotto ogni titolo a tasso fisso «Se lo compro» e «Se esco prima», col nominale, il prezzo e le commissioni di chi guarda; la tabella segue nominale e tariffa salvati in «Le tue condizioni».
- Le commissioni d'acquisto entrano nel costo fiscale anche a rimborso, come in «Se esco prima», e il rimborso non paga una commissione di vendita.
