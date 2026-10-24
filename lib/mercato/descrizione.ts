import type { TipoCatalogo } from "../categorie";

/**
 * Che titolo è, e cosa comporta comprarlo — in una riga, accanto ai suoi
 * numeri.
 *
 * Serve a dire quello che le colonne NON dicono. Due cose in particolare:
 *
 * 1. La natura del differenziale a rimborso. La colonna «Plus a rimborso» è
 *    muta sui titoli sopra la pari, e lì c'è un'informazione utile: a
 *    scadenza rimborsano 100, quindi generano una minusvalenza CERTA che
 *    alimenta lo zainetto invece di consumarlo. È l'altra faccia della
 *    plusvalenza dei titoli sotto la pari.
 * 2. Se quel differenziale tocca davvero lo zainetto. Sugli strip italiani
 *    no: è scarto di emissione, reddito di capitale, e resta fuori qualunque
 *    cosa ci sia nello zainetto. Sui BOT dipende dai dati d'asta (vedi
 *    `plusCompensabile`).
 *
 * Modulo puro, senza dipendenze dalla UI.
 */

export interface DescrizioneTitolo {
  /** Nome corto della famiglia, per il badge. */
  famiglia: string;
  /** Chiave del glossario, per l'approfondimento al passaggio del mouse. */
  termine: string;
  /** Una frase piana su cosa comporta. Non ripete il nome della famiglia. */
  nota: string;
  /**
   * true = il differenziale a rimborso entra nello zainetto, in un verso o
   * nell'altro (lo consuma se è una plusvalenza, lo alimenta se è una
   * minusvalenza). false = ne resta fuori del tutto.
   */
  toccaZainetto: boolean;
}

/**
 * Banda entro cui il prezzo si considera «alla pari»: su 10.000 nominali un
 * quarto di punto sono 25 €, sotto i quali parlare di guadagno o perdita
 * certa a scadenza sarebbe una precisione che il prezzo non ha (è l'ultimo
 * scambio, col ritardo del sito).
 */
const BANDA_PARI = 0.25;

export function descriviTitolo(t: {
  tipo: TipoCatalogo;
  prezzo: number;
  /**
   * Solo per BOT e zero coupon, dove dipende dai dati d'asta: true se la
   * parte fra prezzo teorico e prezzo pagato è plusvalenza (BOT con prezzo e
   * data di emissione, zero coupon esteri con il disaggio), false se tutto
   * il differenziale è scarto. È `plusCompensabile` di lib/catalogo/metriche.ts.
   * Senza, vale il modello semplificato: fuori dallo zainetto.
   */
  plusCompensabile?: boolean;
  /**
   * Per zero coupon e indicizzati: «Strip» e «BTP€i» sono nomi dei titoli
   * italiani, e gli esteri si chiamano col loro. Senza, l'etichetta li dice
   * entrambi (i chip dei filtri).
   */
  emittente?: string;
  /** Il nome del listino: dice quale inflazione segue un indicizzato francese. */
  nome?: string;
}): DescrizioneTitolo {
  switch (t.tipo) {
    case "fisso":
      return {
        famiglia: "Tasso fisso",
        termine: "btpFisso",
        nota: notaDifferenziale(t.prezzo),
        toccaZainetto: true,
      };
    case "stepUp":
      return {
        famiglia: "Step-up",
        termine: "btpStepUp",
        nota: `Cedola crescente a gradini, già contata tutta nel rendimento; il premio fedeltà non spetta a chi compra sul mercato. ${notaDifferenziale(t.prezzo)}`,
        toccaZainetto: true,
      };
    case "zeroCoupon": {
      const nome =
        t.emittente == null
          ? { famiglia: "Strip e zero coupon", termine: "zeroCoupon" }
          : t.emittente === "IT"
            ? { famiglia: "Strip", termine: "btpStrip" }
            : { famiglia: "Zero coupon", termine: "zeroCoupon" };
      if (t.plusCompensabile) {
        return {
          ...nome,
          nota: "Nessuna cedola: un solo incasso a scadenza. Il disaggio di emissione è tassato al 12,5%; la differenza fra prezzo teorico e prezzo pagato è plusvalenza o minusvalenza, e tocca lo zainetto.",
          toccaZainetto: true,
        };
      }
      return {
        ...nome,
        nota:
          t.emittente != null && t.emittente !== "IT"
            ? "Nessuna cedola: un solo incasso a scadenza. Senza prezzo e data di emissione il guadagno è trattato tutto come scarto di emissione: 12,5% pieno, fuori dallo zainetto."
            : "Nessuna cedola: un solo incasso a scadenza. Il guadagno è scarto di emissione, tassato al 12,5% pieno e fuori dallo zainetto.",
        toccaZainetto: false,
      };
    }
    case "bot":
      return t.plusCompensabile
        ? {
            famiglia: "BOT",
            termine: "bot",
            nota: "Scadenza breve e nessuna cedola: compri sotto 100 e ti rimborsano 100. Lo scarto di emissione è tassato al 12,5% in anticipo; la differenza fra prezzo teorico e prezzo pagato, di solito pochi euro, è plusvalenza o minusvalenza e tocca lo zainetto.",
            toccaZainetto: true,
          }
        : {
            famiglia: "BOT",
            termine: "bot",
            nota: "Scadenza breve e nessuna cedola: compri sotto 100 e ti rimborsano 100. Senza i dati d'asta il guadagno è trattato tutto come scarto di emissione: 12,5% pieno, fuori dallo zainetto.",
            toccaZainetto: false,
          };
    case "ccteu":
      return {
        famiglia: "CCTeu",
        termine: "ccteu",
        nota: "Cedola variabile, agganciata all'Euribor a 6 mesi: sale se salgono i tassi. Il rendimento a scadenza suppone che l'Euribor resti quello di oggi.",
        toccaZainetto: true,
      };
    case "indicizzatoEuro": {
      // Gli OATi seguono i prezzi francesi; gli OAT€i, i Bund€i, le
      // Obligaciones€i e i BTP€i l'HICP dell'area euro, sempre senza tabacchi.
      const francese = /^oati\b/i.test(t.nome?.trim() ?? "");
      return {
        ...(t.emittente == null
          ? { famiglia: "BTP€i ed esteri", termine: "indicizzatoEstero" }
          : t.emittente === "IT"
            ? { famiglia: "BTP€i", termine: "btpIndicizzatoEuro" }
            : { famiglia: "Indicizzato", termine: "indicizzatoEstero" }),
        nota: `Il capitale si rivaluta con l'inflazione ${francese ? "francese" : "dell'area euro"} e la rivalutazione la incassi a scadenza; prezzo e cedola qui accanto sono già al netto di quella maturata.`,
        toccaZainetto: true,
      };
    }
    case "cedolaUnica":
      return {
        famiglia: "Cedola unica",
        termine: "cedolaUnica",
        nota: "Una cedola sola, pagata a scadenza insieme al capitale: intanto matura nel rateo, che chi compra paga e chi vende incassa, tassato al 12,5%.",
        toccaZainetto: true,
      };
    case "italia":
      return {
        famiglia: "BTP Italia",
        termine: "btpItalia",
        nota: "La rivalutazione segue l'inflazione italiana e ti viene pagata insieme a ogni cedola, non a scadenza; chi lo tiene dall'emissione riceve anche un premio fedeltà.",
        toccaZainetto: true,
      };
  }
}

/** Cosa succede a scadenza, dato dove sta il prezzo rispetto al rimborso. */
function notaDifferenziale(prezzo: number): string {
  if (prezzo < 100 - BANDA_PARI) {
    return "Sotto la pari: a scadenza rimborsa 100, quindi la plusvalenza è certa e può assorbire lo zainetto.";
  }
  if (prezzo > 100 + BANDA_PARI) {
    return "Sopra la pari: a scadenza rimborsa 100, quindi una parte del prezzo torna come minusvalenza certa, che alimenta lo zainetto invece di consumarlo.";
  }
  return "Prezzo in linea con il rimborso: a scadenza non c'è differenziale, il rendimento sta tutto nelle cedole.";
}
