import { describe, expect, it } from "vitest";
import {
  DESCRIZIONI,
  EMITTENTI,
  RATING_RILEVATI,
  distanzaRating,
  emittentiConRating,
  frequenzaCedola,
  isSovranazionale,
  isValutaEstera,
  motivoNonRiconosciuto,
  riconosciEmittente,
} from "./emittenti";

/**
 * Nomi e ISIN sono quelli VERI del listino `euro-obbligazioni`, rilevati il
 * 24/08/2026. Il riconoscimento vuole due chiavi concordi — marcatore nel
 * nome e prefisso ISIN — quindi i casi vanno provati con entrambe.
 */
describe("riconosciEmittente", () => {
  it("riconosce le tre famiglie tedesche e quella indicizzata", () => {
    const tedeschi: [string, string][] = [
      ["Bund Fx 2.5% Aug54 Eur", "DE0001102614"],
      ["Bobl Green Fx 2.1% Apr29 Eur", "DE0001030732"],
      ["Schatz Fx 2.7% Sep26 Eur", "DE0001104909"],
      ["Bundei 0,5% Ap30 Eur", "DE0001030569"],
    ];
    for (const [nome, isin] of tedeschi) {
      expect(riconosciEmittente(nome, isin)).toBe("DE");
    }
  });

  /**
   * Il listino abbrevia i mesi sia con due lettere ("Mz28") sia con tre
   * ("Gen31", "Lug34"). Un controllo tarato sulle sole due lettere scartava
   * quattro Bund veri senza che nulla lo segnalasse.
   */
  it("accetta le abbreviazioni di mese lunghe tre lettere", () => {
    expect(riconosciEmittente("Bund Gen31 Eur 5,5", "DE0001135101")).toBe("DE");
    expect(riconosciEmittente("Bund Lug34 Eur 4,75", "DE0001135275")).toBe("DE");
  });

  it("riconosce Spagna, Austria, Belgio e i sovranazionali", () => {
    expect(riconosciEmittente("Obligaciones Tf 6% Ge29 Eur", "ES0000012A97")).toBe("ES");
    expect(riconosciEmittente("Bonos Tf 0% Ge28 Eur", "ES0000012K46")).toBe("ES");
    expect(riconosciEmittente("Austria Tf 6.25% Lg27 Eur", "AT0000383864")).toBe("AT");
    expect(riconosciEmittente("Republautric Fx 3.45% Oct30 Eur", "AT0000A2VB47")).toBe("AT");
    expect(riconosciEmittente("Belgium Tf 5,50% Mz28 Eur", "BE0000291972")).toBe("BE");
    // I sovranazionali emettono sotto codici nazionali diversi: per loro
    // l'ISIN non è una chiave, e il nome basta.
    expect(riconosciEmittente("Eib Nv26 Zc Eur", "DE000A1GNAH1")).toBe("sovra");
    expect(riconosciEmittente("Eib Nv26 Zc Eur")).toBe("sovra");
    // La Banca Mondiale È la BIRS, che era già nell'elenco: prima restava
    // fuori solo perché il nome è di due parole.
    expect(riconosciEmittente("World Bank Tf 3% Ot26 Eur", "XS1234567890")).toBe("sovra");
  });

  /**
   * La regressione che conta di più su questo listino: KfW è tedesca,
   * pubblica e garantita, ma è un'AGENZIA — i suoi titoli sono al 26%.
   * Riconoscerla come Germania significherebbe mostrare metà dell'imposta.
   */
  it("NON riconosce le agenzie nazionali né gli emittenti sconosciuti", () => {
    expect(riconosciEmittente("Kfw Fx 2.75% Feb37 Eur", "DE000A30V9M4")).toBe(null);
    expect(riconosciEmittente("Cdp Fx 3.25% Jun31 Eur", "IT0005432000")).toBe(null);
    expect(riconosciEmittente("Eni Sdg Linked Tf 4,3% Fb28 Eur", "IT0005419848")).toBe(null);
    expect(riconosciEmittente("Emittente Mai Visto 3% Ge30 Eur", "XS9999999999")).toBe(null);
  });

  /**
   * La trappola che nasce quando la tabella si allarga a tutti gli Stati: il
   * primo token di «Portugal Telecom» è identico a quello che avrebbe un
   * titolo di Stato portoghese, e l'ISIN non aiuta perché sono entrambi PT.
   * A distinguerli è il token seguente: sui sovrani è sempre il tipo di
   * flusso, la cedola o la scadenza, mai un pezzo di ragione sociale.
   */
  it("non scambia un corporate per lo Stato di cui porta il nome", () => {
    expect(riconosciEmittente("Portugal Tf 2,25% Ap34 Eur", "PTOTEUOE0027")).toBe("PT");
    expect(riconosciEmittente("Portugal Telecom Tf 5% Nv25 Eur", "PTPTCYOM0008")).toBe(null);
    expect(riconosciEmittente("Ireland Tf 1,35% Mz31 Eur", "IE00BDHDPQ37")).toBe("IE");
    expect(riconosciEmittente("Ireland Bank Holding Tf 3% Ge30 Eur", "IE00BF0L3536")).toBe(
      null,
    );
  });

  /** Il nome giusto con l'ISIN di un altro paese non passa. */
  it("pretende un prefisso ISIN compatibile con l'emittente", () => {
    expect(riconosciEmittente("Oat Tf 3% Mg34 Eur", "DE0001102614")).toBe(null);
    expect(riconosciEmittente("Oat Tf 3% Mg34 Eur", "FR0000571085")).toBe("FR");
    // Senza ISIN uno Stato non si riconosce: il nome da solo non è una prova.
    expect(riconosciEmittente("Bund Fx 2.5% Aug54 Eur")).toBe(null);
  });

  /**
   * Molti sovrani emettono in euro sotto ISIN XS invece che sotto il codice
   * del proprio paese: Romania, Polonia, Lituania, Bulgaria, Ungheria,
   * Lettonia, Cipro, Croazia, Estonia. Un controllo fissato sul solo codice
   * nazionale ne scartava 130 in silenzio.
   */
  it("accetta gli ISIN internazionali con cui i sovrani emettono in euro", () => {
    expect(riconosciEmittente("Romania Tf 3,875% Ot35 Eur", "XS1313004928")).toBe("RO");
    expect(riconosciEmittente("Lithuania Fx 2.125% Oct26 Eur", "XS1130139667")).toBe("LT");
    expect(riconosciEmittente("Bulgaria Fx 2.625% Mar27 Eur", "XS1208855889")).toBe("BG");
    expect(riconosciEmittente("Latvia Fx 1.375% May36 Eur", "XS1409726731")).toBe("LV");
  });

  /** I nomi veri degli altri sovrani dell'area euro, rilevati il 24/08/2026. */
  it("riconosce Francia, Grecia, Paesi Bassi, Portogallo, Irlanda e Finlandia", () => {
    expect(riconosciEmittente("Oat Oct32 Eur 5,75", "FR0000187635")).toBe("FR");
    expect(riconosciEmittente("Oatei Lug32 Eur 3,15", "FR0000188799")).toBe("FR");
    expect(riconosciEmittente("Oati Lug29 Eur 3,4", "FR0000186413")).toBe("FR");
    expect(riconosciEmittente("Ggb Tf 3,875% Gn28 Eur", "GR0114033583")).toBe("GR");
    expect(riconosciEmittente("Netherlands Tf 2,5% Lg33 Eur", "NL0015000B84")).toBe("NL");
    expect(riconosciEmittente("Nederland Green Fx 3.25% Jan44 Eur", "NL0015001RG8")).toBe("NL");
    expect(riconosciEmittente("Portugal Tf 2,25% Ap34 Eur", "PTOTEUOE0027")).toBe("PT");
    expect(riconosciEmittente("Ireland Tf 1,35% Mz31 Eur", "IE00BDHDPQ37")).toBe("IE");
    expect(riconosciEmittente("Finland Tf 0,5% St27 Eur", "FI4000369017")).toBe("FI");
  });

  /**
   * I Tesori infilano fra il proprio nome e il tipo di flusso il nome del
   * PROGRAMMA di emissione, e sono parecchie parole: pretendere il tipo di
   * flusso al secondo posto scartava 57 titoli dell'Unione Europea su 66.
   */
  it("salta le etichette di programma fra emittente e tipo di flusso", () => {
    expect(riconosciEmittente("Eu Sure Bond Tf 0% Ot30 Eur", "EU000A283859")).toBe("UE");
    expect(riconosciEmittente("Eu Next Gen Green Bond Tf 0,4% Fb37 Eur", "EU000A3K4C42")).toBe("UE");
    expect(riconosciEmittente("Eu Mfa Ukr Next Gen Fx 4% Apr44 Eur", "EU000A3K4EL9")).toBe("UE");
    expect(riconosciEmittente("European Union Ap28 Eur 2,875", "EU000A1G6TV9")).toBe("UE");
    expect(riconosciEmittente("World Bank Sustain Fx 2.9% Feb34 Eur", "XS2765024414")).toBe("sovra");
    expect(riconosciEmittente("Esm Tf 1,75% Ot45 Eur", "EU000A1U9902")).toBe("MES");
    // Il tipo di flusso a volte è attaccato alla cedola.
    expect(riconosciEmittente("Eu Next Gen Green Bond Tf2,625% Fb48 Eur", "EU000A3K4DM9")).toBe("UE");
  });

  /**
   * Le etichette di programma sono un vocabolario CHIUSO: una parola da
   * ragione sociale non è saltabile, ed è l'unica cosa che tiene fuori un
   * corporate omonimo del suo Stato.
   */
  it("non salta parole che non siano etichette di programma", () => {
    expect(riconosciEmittente("Portugal Telecom Tf 5% Nv25 Eur", "PTPTCYOM0008")).toBe(null);
    expect(riconosciEmittente("Ireland Holding Finance Tf 3% Ge30 Eur", "IE00BF0L3536")).toBe(null);
  });
});

describe("motivoNonRiconosciuto", () => {
  /**
   * Alcuni emittenti sul MOT ci sono e in catalogo no, per scelta: la
   * risposta a «perché» non può essere «non riconosciuto», che suona come un
   * difetto del parse.
   */
  it("spiega gli esclusi per scelta invece di dirli sconosciuti", () => {
    expect(motivoNonRiconosciuto("Kfw Tf 0,375% Ap30 Eur", "DE000A11QTF7")).toContain(
      "agenzia nazionale",
    );
    expect(motivoNonRiconosciuto("Efsf Mz32 Eur 3,875", "EU000A1G0AJ7")).toContain(
      "non è univoco",
    );
    // Eurobbligazioni della Repubblica Italiana: fuori per la cadenza cedolare.
    expect(motivoNonRiconosciuto("Italy Tf 2,875% Ot29 Eur", "XS0000000001")).toContain(
      "cadenza semestrale",
    );
  });

  it("distingue il nome fuori forma dall'emittente ignoto", () => {
    expect(motivoNonRiconosciuto("Gs Intl Mc Nv27 Eur", "XS1241085353")).toContain(
      "emittente non riconosciuto",
    );
    expect(
      motivoNonRiconosciuto("Slovenia Sdglink Fx 3.125% Jul35 Eur", "SI0002105052"),
    ).toContain("non c'è il tipo di flusso");
  });
});

describe("la tabella degli emittenti", () => {
  it("copre i 27 dell'Unione più SEE, Regno Unito e Svizzera", () => {
    const ue = [
      "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
      "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
      "SE", "SI", "SK",
    ];
    for (const paese of [...ue, "IS", "LI", "NO", "GB", "CH"]) {
      expect(EMITTENTI).toContain(paese);
    }
  });

  /**
   * Gli organismi internazionali hanno l'aliquota agevolata degli Stati ma
   * non sono Stati: in anagrafica vanno in `sovranazionale`, non in
   * `titoloStatoEstero`.
   */
  it("distingue gli organismi internazionali dagli Stati", () => {
    for (const e of ["UE", "MES", "sovra"] as const) expect(isSovranazionale(e)).toBe(true);
    for (const e of ["IT", "DE", "FR", "RO"] as const) expect(isSovranazionale(e)).toBe(false);
  });

  it("ogni emittente ha nome, etichetta breve e frequenza cedolare", () => {
    for (const e of EMITTENTI) {
      expect(DESCRIZIONI[e].nome).not.toBe("");
      expect(DESCRIZIONI[e].breve).not.toBe("");
      expect(DESCRIZIONI[e].frequenzaCedola).toBeGreaterThan(0);
    }
  });

  /** Nomi e sigle distinti: sono loro a portare l'identità nei badge. */
  it("nomi ed etichette brevi non si ripetono", () => {
    const nomi = EMITTENTI.map((e) => DESCRIZIONI[e].nome);
    const brevi = EMITTENTI.map((e) => DESCRIZIONI[e].breve);
    expect(new Set(nomi).size).toBe(nomi.length);
    expect(new Set(brevi).size).toBe(brevi.length);
  });

  /**
   * Chi ha il rating è chi il MOT quota davvero: sono le righe che finiscono
   * accanto a un rendimento, dove la solidità serve a spiegarlo. Sugli altri
   * il campo resta null invece di ospitare un valore scritto a memoria.
   */
  it("ha il rating, con la sua data, esattamente sugli emittenti sul MOT", () => {
    for (const e of EMITTENTI) {
      const d = DESCRIZIONI[e];
      expect(d.rating != null).toBe(d.suMot);
      // Un rating senza data non dice a chi legge quanto fidarsi: o ci sono
      // tutti e due o non c'è nessuno dei due.
      expect(d.ratingRilevato != null).toBe(d.rating != null);
      if (d.rating != null) {
        expect(d.rating).toMatch(/^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?)$/);
        expect(d.ratingRilevato).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

describe("isValutaEstera", () => {
  it("intercetta le divise con cui si chiudono i nomi", () => {
    expect(isValutaEstera("World Bank Tf 3% Ot26 Aud")).toBe(true);
    expect(isValutaEstera("Iadb Fx 3.4% May28 Cad")).toBe(true);
    expect(isValutaEstera("Poland Fx 0.835% Jun29 Chf")).toBe(true);
    expect(isValutaEstera("Bund Fx 2.5% Aug54 Eur")).toBe(false);
  });

  it("non si fa ingannare da una divisa dentro un'altra parola", () => {
    // "Ge29" contiene "e", "Cad" no: qui conta che il confine di parola regga.
    expect(isValutaEstera("Obligaciones Tf 6% Ge29 Eur")).toBe(false);
    expect(isValutaEstera("Austria Tf 0,85% Gn2120 Eur")).toBe(false);
  });
});

describe("frequenzaCedola", () => {
  /**
   * I BTP pagano semestrale, i sovrani esteri annuale: è la differenza che
   * rende sbagliato applicare al listino estero il «× 2» della colonna
   * cedola usato su quello italiano.
   */
  it("l'Italia paga semestrale, gli altri annuale", () => {
    expect(frequenzaCedola("IT")).toBe(2);
    for (const e of EMITTENTI.filter((x) => x !== "IT")) {
      expect(frequenzaCedola(e)).toBe(1);
    }
  });

  /**
   * Regressione da cui questo test nasce: rifattorizzando la tabella degli
   * emittenti l'Italia si è ritrovata a 1 come tutti gli altri. Nessun test
   * falliva a parte questo, e l'effetto sarebbe stato dimezzare la cedola di
   * OGNI BTP — rendimenti plausibili e tutti sbagliati.
   */
  it("l'Italia è l'unica eccezione, e resta tale", () => {
    const semestrali = EMITTENTI.filter((e) => frequenzaCedola(e) === 2);
    expect(semestrali).toEqual(["IT"]);
  });
});

describe("rating", () => {
  /**
   * I rating sono una costante del codice, non un dato scaricato: la data
   * dev'esserci ed essere mostrabile, perché è l'unica cosa che dice a chi
   * legge quanto fidarsi del valore.
   */
  it("la data di rilevazione è una data ISO valida", () => {
    expect(RATING_RILEVATI).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(RATING_RILEVATI))).toBe(false);
  });

  it("misura la distanza sulla scala, col segno giusto", () => {
    // La Germania è più solida dell'Italia, non viceversa.
    const d = distanzaRating("DE", "IT")!;
    expect(d).toBeGreaterThan(0);
    expect(distanzaRating("IT", "DE")).toBe(-d);
    expect(distanzaRating("DE", "DE")).toBe(0);
  });

  /** Senza rating non c'è distanza: meglio niente che un confronto inventato. */
  it("è null quando a un emittente il rating non è stato rilevato", () => {
    // Rep. Ceca e Danimarca non sono sul MOT: nessun rating, nessuna distanza.
    expect(distanzaRating("DE", "CZ")).toBe(null);
    expect(distanzaRating("CZ", "DK")).toBe(null);
  });

  it("l'ordine di solidità è quello atteso fra gli emittenti in catalogo", () => {
    const perSolidita = emittentiConRating();
    // In cima ci sono i tripla A, in fondo la parte bassa dell'investment
    // grade: è la scala che spiega perché a parità di scadenza i rendimenti
    // non coincidono.
    expect(perSolidita[0]).toBe("DE");
    expect(DESCRIZIONI[perSolidita[perSolidita.length - 1]].rating).toBe("BBB-");
    expect(distanzaRating("DE", "IT")).toBeGreaterThan(0);
    expect(distanzaRating("DE", "AT")).toBeGreaterThan(0);
    expect(distanzaRating("AT", "ES")).toBeGreaterThan(0);
    // L'Italia resta meno solida di Francia e Germania, più di Grecia e
    // Romania: è l'ordine che il catalogo mostra riga per riga.
    expect(distanzaRating("FR", "IT")).toBeGreaterThan(0);
    expect(distanzaRating("IT", "GR")).toBeGreaterThan(0);
  });
});
