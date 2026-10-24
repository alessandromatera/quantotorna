/**
 * Glossario statico: spiegazioni in linguaggio chiaro dei termini del sito,
 * mostrate al passaggio del mouse (o al tap su mobile). Chiave = slug
 * stabile usato dal componente <Termine>.
 */
export interface VoceGlossario {
  titolo: string;
  testo: string;
}

export const GLOSSARIO: Record<string, VoceGlossario> = {
  ytmNetto: {
    titolo: "Rendimento netto a scadenza (YTM)",
    testo:
      "Il rendimento annuo che incassi davvero tenendo il titolo fino alla scadenza, dopo aver tolto imposte e commissioni: cedole al 12,5%, imposta sul disaggio di emissione e sulla plusvalenza a rimborso. È calcolato alla data di regolamento (T+2), con lo storno dell'imposta sul rateo già nell'esborso.",
  },
  ytmNettoSenzaCg: {
    titolo: "Rendimento netto senza capital gain",
    testo:
      "Il rendimento netto senza l'imposta sulla plusvalenza a rimborso: è quello di chi ha minusvalenze da compensare, ed è il «netto» pubblicato da Borsa Italiana. Coincide col netto sui titoli comprati sopra la pari.",
  },
  ytmLordo: {
    titolo: "Rendimento lordo a scadenza",
    testo:
      "Come il rendimento netto, ma prima delle imposte. Utile per confrontare i titoli tra loro; quello che ti resta in tasca è il netto.",
  },
  volatilita: {
    titolo: "Volatilità (duration)",
    testo:
      "Quanto può muoversi il prezzo del titolo se i tassi cambiano: si misura con la duration modificata. Bassa (sotto 2) vuol dire che il prezzo quasi non si muove e il titolo si tiene per la cedola; sopra 10 un punto di tassi vale più di un decimo del capitale, e uscire prima della scadenza può costare caro. La fascia scelta vale per tutte le tabelle; CCTeu e indicizzati non hanno una duration calcolata e con una fascia attiva restano fuori.",
  },
  durationModificata: {
    titolo: "Duration modificata",
    testo:
      "Quanto è sensibile il prezzo del titolo alle variazioni dei tassi. Una duration di 5 significa che se i tassi salgono dell'1%, il prezzo scende di circa il 5% (e viceversa). Più è alta, più il titolo oscilla.",
  },
  shockPareggio: {
    titolo: "Margine prima della perdita",
    testo:
      "Di quanto possono salire i tassi prima che vendere a una certa data diventi una perdita. Le cedole incassate e la risalita del prezzo verso 100 formano un cuscinetto che si ingrossa col tempo: a un anno dall'acquisto è sottile, dopo cinque è molto più spesso. È la misura di quanto puoi permetterti di cambiare idea.",
  },
  rollDown: {
    titolo: "Roll-down",
    testo:
      "Un titolo comprato sotto la pari guadagna prezzo solo perché invecchia: ogni anno che passa è un anno più vicino al rimborso a 100. A tassi fermi il prezzo sale da solo, e chi vende prima della scadenza si porta via la parte già maturata.",
  },
  cedola: {
    titolo: "Cedola",
    testo:
      "L'interesse periodico che l'obbligazione ti paga (di solito ogni sei mesi). Su un BTP al 3% da 10.000 € nominali incassi 300 € l'anno, in due cedole da 150 €.",
  },
  rateo: {
    titolo: "Rateo",
    testo:
      "La parte di cedola già maturata ma non ancora pagata. Se compri un'obbligazione a metà periodo, paghi al venditore il rateo accumulato; ti rientra tutto alla cedola successiva, e l'imposta su quella parte la banca te la storna subito all'acquisto.",
  },
  zainetto: {
    titolo: "Zainetto fiscale",
    testo:
      "Le perdite (minusvalenze) accumulate con vendite passate, che puoi usare per NON pagare le tasse su guadagni futuri. Si consumano dal più vecchio e scadono dopo 4 anni: se non le usi, le perdi.",
  },
  minusvalenza: {
    titolo: "Minusvalenza",
    testo:
      "Una perdita realizzata vendendo (o a rimborso) sotto il prezzo di acquisto. Va nello zainetto fiscale e può compensare guadagni futuri, riducendo le imposte da pagare.",
  },
  plusvalenza: {
    titolo: "Plusvalenza",
    testo:
      "Un guadagno realizzato vendendo (o a rimborso) sopra il prezzo di acquisto. Sui titoli di Stato è tassato al 26% sul 48,08% del guadagno, cioè al 12,5%; ma se hai minusvalenze nello zainetto, ci si compensa e paghi meno.",
  },
  redditiDiversi: {
    titolo: "Redditi diversi (compensabili)",
    testo:
      "Le plusvalenze e le minusvalenze da vendita o rimborso di un titolo. Sono compensabili con lo zainetto fiscale: se hai perdite pregresse, le usi per abbattere le tasse su questi guadagni.",
  },
  redditiCapitale: {
    titolo: "Redditi di capitale (NON compensabili)",
    testo:
      "Cedole, rateo, disaggio e scarto di emissione. Sono tassati al 12,5% per intero e NON possono usare lo zainetto.",
  },
  plusRimborso: {
    titolo: "Plusvalenza a rimborso",
    testo:
      "Se compri un BTP sotto la pari (es. a 91) e lo tieni fino a scadenza, ti rimborsano 100: la differenza è un guadagno certo. È compensabile con lo zainetto, quindi utile per non farlo scadere inutilizzato.",
  },
  ccteu: {
    titolo: "CCTeu",
    testo:
      "Certificato di Credito del Tesoro a tasso variabile: la cedola segue l'Euribor a 6 mesi più uno spread. Rende di più quando i tassi salgono, di meno quando scendono.",
  },
  btpFisso: {
    titolo: "BTP a tasso fisso",
    testo:
      "Buono del Tesoro Poliennale con cedola fissa nota fino alla scadenza. Il rendimento è certo se lo tieni fino in fondo; il prezzo intanto sale e scende al variare dei tassi.",
  },
  btpItalia: {
    titolo: "BTP Italia",
    testo:
      "BTP indicizzato all'inflazione italiana (indice FOI): la rivalutazione del capitale ti viene pagata per cassa insieme a ogni cedola semestrale, e chi lo tiene dall'emissione alla scadenza riceve un premio fedeltà. Protegge dal caro-prezzi, ma proprio perché il flusso dipende dall'inflazione futura non ha un rendimento a scadenza calcolabile dal prezzo.",
  },
  btpStepUp: {
    titolo: "BTP step-up (Valore, Più, Futura)",
    testo:
      "BTP pensati per i risparmiatori, con cedole fissate all'emissione ma crescenti nel tempo: per esempio 2,60% i primi tre anni, poi 3,10%, poi 4%. Il rendimento a scadenza le conta tutte, gradino per gradino, quindi non va letto sulla cedola di oggi. Il premio fedeltà, e sul BTP Più il rimborso anticipato, spettano solo a chi ha sottoscritto all'emissione: chi compra sul mercato non li riceve, e il rendimento qui non li include.",
  },
  cedolaUnica: {
    titolo: "Cedola unica (BTP Valore Insieme)",
    testo:
      "BTP che paga una cedola sola, alla scadenza, insieme al capitale: il BTP Valore Insieme di ottobre 2026 la paga dopo cinque anni, in percentuale del nominale. Nel frattempo la cedola matura giorno per giorno nel rateo, contato in 30E/360: chi compra sul mercato lo paga a chi vende, e l'imposta del 12,5% su quella parte gliela rimborsano subito. Il rendimento si calcola solo quando Borsa Italiana pubblica la cedola definitiva: durante il collocamento c'è solo il minimo garantito.",
  },
  rating: {
    titolo: "Rating dell'emittente",
    testo:
      "Il giudizio di un'agenzia sulla capacità dello Stato di ripagare il debito, dalla AAA (la più solida) in giù. È dell'EMITTENTE, non del singolo titolo: tutti i BTP hanno il rating dell'Italia. Spiega perché due titoli di pari scadenza rendono diverso — il maggior rendimento è il premio che il mercato chiede per il rischio, non un affare. Qui è un valore inserito a mano e datato, non scaricato: un declassamento non si aggiorna da solo.",
  },
  titoloStatoEstero: {
    titolo: "Titoli di Stato esteri (white list)",
    testo:
      "Titoli di Stato di paesi in «white list» — Germania (Bund, Bobl, Schatz), Spagna (Bonos, Obligaciones), Austria, Belgio: in Italia sono tassati al 12,5% come i BTP. Attenzione: NON sono la stessa cosa dei titoli di agenzie pubbliche di quei paesi (per esempio KfW in Germania), che invece vanno al 26%. Rendono meno di un BTP di pari scadenza, e quella differenza è il premio che il mercato chiede per il rischio Italia.",
  },
  zeroCoupon: {
    titolo: "Zero coupon",
    testo:
      "Un titolo senza cedole: lo compri sotto 100 e a scadenza ti rimborsano 100, e il guadagno è tutto in quella differenza. Sul MOT sono gli strip di BTP e gli zero coupon di Stati esteri e organismi sovranazionali (BEI, MES). Per il fisco la parte fino al prezzo teorico è disaggio di emissione, al 12,5%; quella fra prezzo teorico e prezzo pagato è plusvalenza o minusvalenza. Sugli strip italiani, e dove mancano i dati di emissione, tutto il guadagno è trattato come scarto, fuori dallo zainetto.",
  },
  btpStrip: {
    titolo: "Strip di BTP",
    testo:
      "Un BTP a cui sono state staccate le cedole: si compra solo il rimborso finale, sotto la pari, e non incassi nulla fino a scadenza. Attenzione al fisco: il guadagno è scarto di emissione, cioè reddito di capitale tassato al 12,5% pieno, e NON si compensa con le minusvalenze dello zainetto. Sono anche poco scambiati: molti non hanno un prezzo.",
  },
  indicizzatoEstero: {
    titolo: "Titolo di Stato estero indicizzato",
    testo:
      "Come il BTP€i, ma di un altro Stato: Bund€i tedeschi, OAT€i francesi e Obligaciones€i spagnole seguono l'inflazione dell'area euro (HICP senza tabacchi), gli OATi francesi quella francese. La rivalutazione si accumula nel capitale e la incassi a scadenza; sul MOT è quotato al prezzo reale. Per il fisco italiano è al 12,5% come un BTP.",
  },
  btpIndicizzatoEuro: {
    titolo: "BTP€i",
    testo:
      "BTP indicizzato all'inflazione dell'area euro (HICP senza tabacchi). A differenza del BTP Italia la rivalutazione si accumula NEL capitale e la incassi a scadenza; la cedola è una percentuale fissa su quel capitale che cresce. Sul MOT è quotato al prezzo reale, cioè al netto della rivalutazione già maturata.",
  },
  rendimentoReale: {
    titolo: "Rendimento reale",
    testo:
      "Quanto cresce il tuo potere d'acquisto, non il tuo saldo. Un titolo che rende il 3% con inflazione al 2% ha un rendimento reale di circa l'1%: con il resto stai solo stando al passo dei prezzi. Sui BTP€i è il rendimento che il titolo ti garantisce qualunque cosa faccia l'inflazione.",
  },
  inflazionePareggio: {
    titolo: "Inflazione di pareggio",
    testo:
      "Il livello di inflazione al quale un BTP€i e un BTP a tasso fisso di pari scadenza rendono uguale. Se pensi che l'inflazione sarà più alta di così, conviene l'indicizzato; se più bassa, conviene il fisso. Non è una previsione: è quanto il mercato sta già scontando nei prezzi di oggi.",
  },
  isin: {
    titolo: "ISIN",
    testo:
      "Il codice internazionale a 12 caratteri che identifica univocamente un titolo; quelli dei titoli di Stato italiani cominciano con IT. Serve per cercarlo su Borsa Italiana o presso l'intermediario.",
  },
  nominale: {
    titolo: "Valore nominale",
    testo:
      "Per le obbligazioni, l'importo su cui si calcolano cedole e rimborso, in multipli di 1.000 €. È ciò che ti viene restituito a scadenza, indipendentemente dal prezzo pagato.",
  },
  commissioni: {
    titolo: "Commissioni",
    testo:
      "I costi pagati all'intermediario per l'operazione. Si sommano al costo fiscale in acquisto e si sottraggono dal corrispettivo in vendita, riducendo il guadagno tassabile.",
  },
  frequenzaCedola: {
    titolo: "Frequenza cedola",
    testo:
      "Quante volte l'anno viene pagata la cedola: 2 = semestrale (tipico dei BTP), 1 = annuale, 4 = trimestrale. La cedola di periodo è quella annua divisa per la frequenza.",
  },
  sovranazionale: {
    titolo: "Obbligazioni sovranazionali",
    testo:
      "Titoli emessi da enti come BEI, BIRS, BERS. Godono dell'aliquota agevolata del 12,5% come i titoli di Stato, pur essendo emittenti diversi.",
  },
  bot: {
    titolo: "BOT",
    testo:
      "Buono Ordinario del Tesoro: titolo di Stato a breve termine (fino a 12 mesi) senza cedola. Il guadagno è soprattutto lo 'scarto di emissione' (emesso sotto 100, rimborsato a 100), reddito di capitale al 12,5% tassato in anticipo: chi compra sul mercato paga l'imposta sul tratto che resta fino alla scadenza. La differenza fra il prezzo teorico del giorno e quello pagato è invece plusvalenza (o minusvalenza) e tocca lo zainetto; di solito vale pochi euro.",
  },
  sensibilitaTassi: {
    titolo: "Sensibilità ai tassi",
    testo:
      "Come cambia il prezzo del titolo se i tassi di mercato si muovono, da −2% a +2%. Tassi in salita → prezzo in discesa, e tanto più quanto più lunga è la duration.",
  },
  scambi: {
    titolo: "Scambi",
    testo:
      "Quanto scambia di solito il titolo sul MOT: la mediana degli euro scambiati per seduta negli ultimi tre mesi, e in quante sedute c'è stato almeno uno scambio. Dallo storico di Euronext (che possiede Borsa Italiana), riletto ogni giorno. Mediana e non media: la media la gonfiano pochi blocchi grossi, a te serve la giornata tipica. Più un titolo scambia, più il prezzo mostrato è recente e più è facile rivenderlo prima della scadenza a un prezzo vicino. «non letto» vuol dire che lo storico non si è potuto leggere, non che il titolo non scambia. Se un giorno Euronext non risponde per nessun titolo, restano gli scambi dell'ultima lettura riuscita, e l'avviso in cima alla pagina dice di quando.",
  },
  nettoAScadenza: {
    titolo: "Netto a scadenza",
    testo:
      "Quanto incassi da qui alla scadenza comprando oggi 10.000 nominali (o il nominale delle tue condizioni): cedole nette più rimborso netto. Sotto, il guadagno, cioè quegli incassi meno quanto costano i nominali con rateo, commissioni e crediti d'imposta, e quanto fa per anno. Sono le cifre di «Se lo compro», che si apre col clic sulla riga. Attenzione: premiano anche il tempo e il prezzo. A pari rendimento dieci anni danno più euro di due, e diecimila nominali costano 8.000 € su un titolo e 11.200 su un altro: fra titoli diversi dicono quanto ti torna, non quale rende di più. Per quello c'è lo YTM netto.",
  },
  rendimentoInEuro: {
    titolo: "Rendimento in euro",
    testo:
      "Lo stesso YTM netto espresso in denaro: quanto incassi da qui a scadenza (cedole nette più rimborso) oltre a quello che spendi oggi. Il valore annuo è quel guadagno diviso per gli anni che mancano.",
  },
  linkEsterno: {
    titolo: "Scheda esterna",
    testo:
      "Apre in una nuova scheda la pagina del titolo su Borsa Italiana, per consultare prezzi e dettagli aggiornati.",
  },
};
