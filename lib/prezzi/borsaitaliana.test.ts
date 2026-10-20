import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAGINE_IN_PARALLELO,
  parseDataGodimento,
  parseListaBtp,
  parseSchedaStepUp,
  scaricaListaBtp,
} from "./borsaitaliana";

/**
 * Frammento con la struttura reale della lista MOT. I NOMI sono quelli veri
 * rilevati il 27/07/2026: il riconoscimento delle famiglie dipende solo da
 * come Borsa Italiana scrive il titolo, quindi inventarli renderebbe il test
 * inutile. In particolare "Btp Italia Mz28 Eur" non contiene la sequenza
 * "btpi" — è il caso che il vecchio filtro per sottostringa lasciava passare.
 */
const FRAMMENTO = `
<table>
<tr>
  <td class="u-hidden">
    <a href="/borsa/obbligazioni/mot/btp/scheda/IT0001086567-MOTX.html?lang=it">
      <strong>IT0001086567 - </strong>
    </a>
    <span>Btp-1nv26 7,25%</span> Ultimo: 101,275
  </td>
  <td class="u-hidden -xs"><span class="t-text">Btp-1nv26      7,25%</span></td>
  <td class="u-hidden -xs">101,275</td>
  <td class="u-hidden -xs">3,625</td>
  <td class="u-hidden -xs">01/11/2026</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005425233-MOTX.html?lang=it"><strong>IT0005425233 - </strong></a></td>
  <td><span>Btp-1ap31 0,9%</span></td>
  <td>91,2</td>
  <td>0,45</td>
  <td>01/04/2031</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0009999999-MOTX.html?lang=it"><strong>IT0009999999 - </strong></a></td>
  <td><span>Btp senza scambi 3%</span></td>
  <td></td>
  <td>1,5</td>
  <td>01/01/2030</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005560948-MOTX.html?lang=it"><strong>IT0005560948 - </strong></a></td>
  <td><span>Btp Fx 3.85% Jul34 Eur</span></td>
  <td>100,63</td>
  <td>1,925</td>
  <td>01/07/2034</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0004735152-MOTX.html?lang=it"><strong>IT0004735152 - </strong></a></td>
  <td><span>Btpi-15st26 3,1%</span></td>
  <td>100,056</td>
  <td>1,55</td>
  <td>15/09/2026</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005138828-MOTX.html?lang=it"><strong>IT0005138828 - </strong></a></td>
  <td><span>Btpi Tf 1,25% St32 Eur</span></td>
  <td>99,75</td>
  <td>0,625</td>
  <td>15/09/2032</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005532723-MOTX.html?lang=it"><strong>IT0005532723 - </strong></a></td>
  <td><span>Btp Italia Mz28 Eur</span></td>
  <td>101,30</td>
  <td>1,00</td>
  <td>14/03/2028</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005580045-MOTX.html?lang=it"><strong>IT0005580045 - </strong></a></td>
  <td><span>Btp Valore Sc Mz30 Eur</span></td>
  <td>102,1</td>
  <td>1,6</td>
  <td>05/03/2030</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005542359-MOTX.html?lang=it"><strong>IT0005542359 - </strong></a></td>
  <td><span>Btp Futura Ap37 Eur</span></td>
  <td>88,4</td>
  <td>0,9</td>
  <td>14/04/2037</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005634800-MOTX.html?lang=it"><strong>IT0005634800 - </strong></a></td>
  <td><span>Btp Piu' Sc Fb33 Eur</span></td>
  <td>95,13</td>
  <td>1,425</td>
  <td>25/02/2033</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0003268890-MOTX.html?lang=it"><strong>IT0003268890 - </strong></a></td>
  <td><span>Btpstripital Zc Feb28 Eur</span></td>
  <td>95,56</td>
  <td></td>
  <td>01/02/2028</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005240350-MOTX.html?lang=it"><strong>IT0005240350 - </strong></a></td>
  <td><span>Btpgreen 4%Ot31eur</span></td>
  <td>104,2</td>
  <td>2</td>
  <td>30/10/2031</td>
  <td></td>
</tr>
</table>`;

describe("parseListaBtp", () => {
  const esito = parseListaBtp(FRAMMENTO);
  const per = (isin: string) => esito.righe.find((r) => r.isin === isin);
  const scarto = (isin: string) => esito.scartate.find((s) => s.isin === isin);

  it("estrae ISIN, nome, prezzo, cedola annua e scadenza ISO", () => {
    expect(esito.righe[0]).toEqual({
      isin: "IT0001086567",
      nome: "Btp-1nv26 7,25%",
      cedolaAnnua: 7.25,
      dataScadenza: "2026-11-01",
      prezzo: 101.275,
      tipo: "fisso",
      emittente: "IT",
      frequenzaCedola: 2,
    });
    expect(per("IT0005425233")!.cedolaAnnua).toBe(0.9);
    expect(per("IT0005425233")!.dataScadenza).toBe("2031-04-01");
  });

  it("gestisce il punto decimale dei nomi anglosassoni (3.85% ≠ 385%)", () => {
    const jul34 = per("IT0005560948")!;
    expect(jul34.cedolaAnnua).toBe(3.85);
    expect(jul34.prezzo).toBe(100.63);
  });

  it("classifica come tasso fisso i BTP ordinari e i green", () => {
    expect(esito.righe.filter((r) => r.tipo === "fisso").map((r) => r.isin)).toEqual([
      "IT0001086567",
      "IT0005425233",
      "IT0005560948",
      "IT0005240350",
    ]);
  });

  it("riconosce i BTP€i in entrambe le forme del nome", () => {
    expect(per("IT0004735152")).toMatchObject({
      tipo: "indicizzatoEuro",
      cedolaAnnua: 3.1,
      prezzo: 100.056,
    });
    expect(per("IT0005138828")).toMatchObject({
      tipo: "indicizzatoEuro",
      cedolaAnnua: 1.25,
    });
  });

  /**
   * La regressione che conta: "Btp Italia" non contiene "btpi", quindi il
   * vecchio filtro non lo intercettava e finiva fra i candidati a tasso fisso
   * con cedola 1,00 × 2 = 2% — la sola cedola reale, senza rivalutazione.
   */
  it("riconosce i BTP Italia invece di valutarli come tasso fisso", () => {
    const italia = per("IT0005532723");
    expect(italia).toMatchObject({ tipo: "italia", cedolaAnnua: 2, prezzo: 101.3 });
    expect(esito.righe.some((r) => r.tipo === "fisso" && /italia/i.test(r.nome))).toBe(
      false,
    );
  });

  /**
   * Gli strip hanno un trattamento fiscale diverso, non un modello diverso:
   * i flussi sono noti (un solo incasso a scadenza) e il motore li calcola.
   * Restano in catalogo, con la cedola a zero che il listino non riporta.
   */
  it("tiene gli strip come zero coupon invece di scartarli", () => {
    expect(per("IT0003268890")).toMatchObject({
      tipo: "zeroCoupon",
      cedolaAnnua: 0,
      prezzo: 95.56,
    });
  });

  it("scarta solo ciò che non sa calcolare, indicando il motivo", () => {
    expect(scarto("IT0009999999")!.motivo).toBe("prezzo assente (non scambiato)");
    expect(esito.scartate.map((s) => s.isin)).not.toContain("IT0003268890");
  });

  /**
   * Gli step-up restano, senza cedola: la colonna del listino è quella del
   * periodo in corso (trimestrale sul BTP Più: 0,7125 sono il 2,85% annuo),
   * e leggerla come semestrale dava metà cedola. Resta da parte per
   * verificare il piano, che arriva da lib/mercato/stepup.ts.
   */
  it("tiene Valore, Futura e Più come step-up, con la cedola del listino da parte", () => {
    for (const isin of ["IT0005580045", "IT0005542359", "IT0005634800"]) {
      expect(per(isin)!.tipo).toBe("stepUp");
      expect(per(isin)!.cedolaAnnua).toBe(0);
    }
    expect(per("IT0005634800")!.cedolaListino).toBe(1.425);
    expect(per("IT0005580045")!.cedolaListino).toBe(1.6);
  });

  it("scarta il BTP Valore Insieme: una cedola sola a scadenza", () => {
    const insieme = parseListaBtp(`<table><tr>
      <td><a href="/borsa/obbligazioni/mot/btp/scheda/IT0005735227-MOTX.html?lang=it"><strong>IT0005735227 - </strong></a></td>
      <td><span>Btp Valore Insieme Oc Oct31 Eur</span></td>
      <td>100,00</td>
      <td></td>
      <td>27/10/2031</td>
      <td></td>
    </tr></table>`);
    expect(insieme.righe).toHaveLength(0);
    expect(insieme.scartate[0].motivo).toMatch(/Valore Insieme.*una sola cedola/);
  });

  it("HTML irriconoscibile → zero righe (l'aggiornamento fallirà in modo visibile)", () => {
    const vuoto = parseListaBtp("<html><body>struttura nuova</body></html>");
    expect(vuoto.righe).toHaveLength(0);
  });
});

/**
 * Listini cct e bot: stessa struttura di tabella della sezione btp, ma
 * omogenei — la famiglia la dà il listino, non il nome. Nomi veri del
 * 27/07/2026.
 */
const FRAMMENTO_CCT = `
<table>
<tr>
  <td><a href="/borsa/obbligazioni/mot/cct/scheda/IT0005451361-MOTX.html?lang=it"><strong>IT0005451361 - </strong></a></td>
  <td><span>Cct-Eu Tv Eur6m+0,65% Ap29 Eur</span></td>
  <td>101,28</td>
  <td></td>
  <td>15/04/2029</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/cct/scheda/IT0005554982-MOTX.html?lang=it"><strong>IT0005554982 - </strong></a></td>
  <td><span>Cct-Eu Tv Eur6m+1,15 Ot31 Eur</span></td>
  <td>103,36</td>
  <td></td>
  <td>15/10/2031</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/cct/scheda/IT0005594467-MOTX.html?lang=it"><strong>IT0005594467 - </strong></a></td>
  <td><span>Cct-Eu Fr Eur6m+1.05% Apr32 Eur</span></td>
  <td>102,89</td>
  <td></td>
  <td>15/04/2032</td>
  <td></td>
</tr>
</table>`;

const FRAMMENTO_BOT = `
<table>
<tr>
  <td><a href="/borsa/obbligazioni/mot/bot/scheda/IT0005666851-MOTX.html?lang=it"><strong>IT0005666851 - </strong></a></td>
  <td><span>Bot Zc Aug26 A Eur</span></td>
  <td>99,898</td>
  <td></td>
  <td>14/08/2026</td>
  <td></td>
</tr>
</table>`;

describe("parseListaBtp sui listini omogenei", () => {
  it("i CCTeu prendono la famiglia dal listino, non dal nome", () => {
    const { righe } = parseListaBtp(FRAMMENTO_CCT, "ccteu");
    expect(righe).toHaveLength(3);
    expect(righe.every((r) => r.tipo === "ccteu")).toBe(true);
  });

  /**
   * Il numero nel nome di un CCTeu è lo SPREAD sull'Euribor, non una cedola:
   * prenderlo per tale darebbe un rendimento a scadenza inventato.
   */
  it("sui CCTeu la cedola resta zero e il numero del nome finisce in spread", () => {
    const { righe } = parseListaBtp(FRAMMENTO_CCT, "ccteu");
    expect(righe.map((r) => r.cedolaAnnua)).toEqual([0, 0, 0]);
    // Con il %, senza il % e col punto decimale.
    expect(righe.map((r) => r.spread)).toEqual([0.65, 1.15, 1.05]);
  });

  it("i BOT sono zero coupon con prezzo e scadenza", () => {
    const { righe } = parseListaBtp(FRAMMENTO_BOT, "bot");
    expect(righe[0]).toEqual({
      isin: "IT0005666851",
      nome: "Bot Zc Aug26 A Eur",
      cedolaAnnua: 0,
      dataScadenza: "2026-08-14",
      prezzo: 99.898,
      tipo: "bot",
      emittente: "IT",
      frequenzaCedola: 2,
    });
  });
});

/**
 * Listino `euro-obbligazioni`: i titoli di Stato ESTERI. Tre differenze che
 * il parse deve rispettare, tutte capaci di sbagliare in silenzio — nomi
 * veri rilevati il 27/07/2026.
 */
const FRAMMENTO_ESTERO = `
<table>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/DE0001102614-MOTX.html?lang=it"><strong>DE0001102614 - </strong></a></td>
  <td><span>Bund Fx 2.5% Aug54 Eur</span></td>
  <td>88,15</td>
  <td>2,50</td>
  <td>15/08/2054</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/ES00000128P6-MOTX.html?lang=it"><strong>ES00000128P6 - </strong></a></td>
  <td><span>Obligaciones Tf 6% Ge29 Eur</span></td>
  <td>112,40</td>
  <td>6,00</td>
  <td>31/01/2029</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/DE0001030583-MOTX.html?lang=it"><strong>DE0001030583 - </strong></a></td>
  <td><span>Bundei 0,5% Ap30 Eur</span></td>
  <td>104,90</td>
  <td>0,50</td>
  <td>15/04/2030</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/XS0000000001-MOTX.html?lang=it"><strong>XS0000000001 - </strong></a></td>
  <td><span>Kfw Fx 2.75% Feb37 Eur</span></td>
  <td>97,20</td>
  <td>2,75</td>
  <td>15/02/2037</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/AU0000000002-MOTX.html?lang=it"><strong>AU0000000002 - </strong></a></td>
  <td><span>World Bank Tf 3% Ot26 Aud</span></td>
  <td>99,80</td>
  <td>3,00</td>
  <td>15/10/2026</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/DE0001135085-MOTX.html?lang=it"><strong>DE0001135085 - </strong></a></td>
  <td><span>Bund Lg28 Eur 4,75</span></td>
  <td>102,78</td>
  <td></td>
  <td>04/07/2028</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/FR001400QCA1-MOTX.html?lang=it"><strong>FR001400QCA1 - </strong></a></td>
  <td><span>Oatei Fx Jul43 Eur</span></td>
  <td>74,51</td>
  <td></td>
  <td>25/07/2043</td>
  <td></td>
</tr>
<tr>
  <td><a href="/borsa/obbligazioni/mot/euro-obbligazioni/scheda/XS3262549754-MOTX.html?lang=it"><strong>XS3262549754 - </strong></a></td>
  <td><span>Eni Spa Mc Perpetual Sub Call Eur</span></td>
  <td></td>
  <td>1,017</td>
  <td></td>
  <td></td>
</tr>
</table>`;

describe("parseListaBtp sul listino estero", () => {
  const esito = parseListaBtp(FRAMMENTO_ESTERO, "daNome", true);
  const per = (isin: string) => esito.righe.find((r) => r.isin === isin);
  const scarto = (isin: string) => esito.scartate.find((s) => s.isin === isin);

  /**
   * Il prefisso ISIN degli esteri non è "IT": un regex fissato sull'Italia
   * leggerebbe zero righe senza che nulla segnali l'errore.
   */
  it("legge gli ISIN non italiani", () => {
    expect(esito.righe.map((r) => r.isin).sort()).toEqual([
      "DE0001030583",
      "DE0001102614",
      "DE0001135085",
      "ES00000128P6",
    ]);
  });

  /** Rilevato il 20/10/2026: quindici titoli scartati per una cedola che c'era. */
  it("legge la cedola in fondo al nome, senza il «%», quando la colonna è vuota", () => {
    expect(per("DE0001135085")).toMatchObject({ cedolaAnnua: 4.75, emittente: "DE", tipo: "fisso" });
    // Senza numero da nessuna parte resta scartato: meglio fuori che inventato.
    expect(scarto("FR001400QCA1")!.motivo).toMatch(/cedola non riconosciuta/);
  });

  it("un perpetuo si scarta dicendo che non ha scadenza", () => {
    expect(scarto("XS3262549754")!.motivo).toMatch(/senza data di scadenza/);
  });

  /**
   * Qui la colonna cedola è già ANNUA, perché i sovrani esteri pagano una
   * volta l'anno: applicare il × 2 dei BTP raddoppierebbe ogni rendimento.
   */
  it("la cedola resta annua e la frequenza è 1", () => {
    expect(per("DE0001102614")).toMatchObject({
      cedolaAnnua: 2.5,
      frequenzaCedola: 1,
      emittente: "DE",
      tipo: "fisso",
    });
    expect(per("ES00000128P6")).toMatchObject({ cedolaAnnua: 6, emittente: "ES" });
  });

  it("riconosce gli indicizzati esteri dal suffisso «ei»", () => {
    expect(per("DE0001030583")).toMatchObject({
      tipo: "indicizzatoEuro",
      emittente: "DE",
    });
  });

  /** Le due esclusioni che proteggono dal mostrare numeri sbagliati. */
  it("scarta le agenzie nazionali e ciò che non è in euro", () => {
    // KfW è esclusa per scelta, non per ignoranza: il motivo lo dice.
    expect(scarto("XS0000000001")!.motivo).toMatch(/agenzia nazionale/);
    expect(scarto("AU0000000002")!.motivo).toMatch(/non è in euro/);
  });
});

/* --------------------------------------------------------------------------
 * Paginazione: quando fermarsi.
 * ----------------------------------------------------------------------- */

/** Una riga di listino con i campi minimi che il parse si aspetta. */
function rigaHtml(isin: string, nome: string, prezzo: string): string {
  return `
<tr>
  <td><a href="/borsa/obbligazioni/mot/btp/scheda/${isin}-MOTX.html"><strong>${isin}</strong></a></td>
  <td><span>${nome}</span></td>
  <td>${prezzo}</td>
  <td>1,5</td>
  <td>01/01/2030</td>
  <td></td>
</tr>`;
}

/**
 * Il nome dev'essere riconoscibile per la sezione che lo serve: sul listino
 * estero un nome sconosciuto viene scartato di proposito.
 */
function nomePerSezione(sezione: string): { nome: string; isin: (n: number) => string } {
  if (sezione === "cct")
    return { nome: "Cct-Eu Tv Eur6m+0,65% Ap29 Eur", isin: (n) => `IT000000CCT${n}` };
  if (sezione === "bot") return { nome: "Bot Zc Ge27 Eur", isin: (n) => `IT000000BOT${n}` };
  if (sezione === "euro-obbligazioni")
    return { nome: "Bund Tf 3% Ge30 Eur", isin: (n) => `DE000000BND${n}` };
  return { nome: "Btp Tf 3% Ge30 Eur", isin: (n) => `IT000000BTP${n}` };
}

describe("scaricaListaBtp: dove si ferma la paginazione", () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * LA REGRESSIONE PIÙ COSTOSA TROVATA SU QUESTO FILE. La vecchia condizione
   * si fermava alla prima pagina che non produceva righe ACCETTATE. Sul
   * listino estero, rilevato il 24/08/2026, la pagina 8 è fatta tutta di
   * titoli senza prezzo e di KfW: il download si fermava lì e le pagine 9-12
   * — cioè TUTTA la Spagna e i sovranazionali — non venivano mai lette. Il
   * catalogo non mostrava alcun errore: diceva semplicemente che la Spagna
   * non è quotata sul MOT.
   *
   * La condizione giusta è «nessun ISIN mai visto in questa pagina»: una
   * pagina di righe tutte scartate è comunque una pagina del listino.
   */
  it("non si ferma su una pagina di sole righe scartate", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      const sezione = url.match(/\/mot\/([^/]+)\//)![1];
      const pagina = Number(url.match(/page=(\d+)/)![1]);
      const { nome, isin } = nomePerSezione(sezione);
      const corpo =
        pagina === 1
          ? rigaHtml(isin(1), nome, "99,5")
          : // Pagina 2: righe VERE ma tutte senza prezzo, quindi tutte scartate.
            pagina === 2
            ? rigaHtml(isin(2), nome, "")
            : pagina === 3
              ? rigaHtml(isin(3), nome, "101,25")
              : "";
      return { ok: true, text: async () => `<table>${corpo}</table>` } as Response;
    });

    const esito = await scaricaListaBtp();
    const isin = esito.righe.map((r) => r.isin);
    // La riga della pagina 3 c'è: il download non si è fermato alla 2.
    expect(isin).toContain("IT000000BTP3");
    expect(isin).toContain("DE000000BND3");
    // Due righe buone per ciascuno dei quattro listini.
    expect(esito.righe).toHaveLength(8);
    // E la pagina 4, vuota, ha chiuso il ciclo: quattro pagine per listino.
    expect(esito.pagine).toBe(16);
  });

  /** Un sito che ripete sempre la stessa pagina non deve far girare a vuoto. */
  it("si ferma se una pagina non porta ISIN mai visti", async () => {
    let richieste = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      richieste++;
      const sezione = url.match(/\/mot\/([^/]+)\//)![1];
      const { nome, isin } = nomePerSezione(sezione);
      return {
        ok: true,
        text: async () => `<table>${rigaHtml(isin(1), nome, "99,5")}</table>`,
      } as Response;
    });

    const esito = await scaricaListaBtp();
    expect(esito.righe).toHaveLength(4);
    // Due pagine LETTE per listino: la prima porta la riga, la seconda la
    // ripete. Le richieste sono un blocco per listino, perché le pagine si
    // chiedono a gruppi: quelle oltre la seconda arrivano ma non si leggono.
    expect(esito.pagine).toBe(8);
    expect(richieste).toBe(4 * PAGINE_IN_PARALLELO);
  });

  /**
   * Chiedere le pagine a gruppi non deve cambiare l'ordine di lettura: se una
   * pagina di un blocco è oltre la fine, le successive dello stesso blocco
   * (che il sito potrebbe servire con righe vecchie) non entrano nel catalogo.
   */
  it("non legge le pagine del blocco dopo quella vuota", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      const sezione = url.match(/\/mot\/([^/]+)\//)![1];
      const pagina = Number(url.match(/page=(\d+)/)![1]);
      const { nome, isin } = nomePerSezione(sezione);
      const corpo = pagina === 2 ? "" : rigaHtml(isin(pagina), nome, "99,5");
      return { ok: true, text: async () => `<table>${corpo}</table>` } as Response;
    });

    const esito = await scaricaListaBtp();
    const isin = esito.righe.map((r) => r.isin);
    expect(isin).toContain("IT000000BTP1");
    expect(isin).not.toContain("IT000000BTP3");
    expect(esito.righe).toHaveLength(4);
  });
});

describe("scaricaListaBtp: troppe richieste", () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Il 19/10/2026 un secondo aggiornamento lanciato un minuto dopo il primo
   * prendeva un 429 e falliva tutto. Ora si aspetta e si riprova.
   */
  it("su un 429 aspetta e riprova invece di fallire", async () => {
    let respinte = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      const sezione = url.match(/\/mot\/([^/]+)\//)![1];
      const pagina = Number(url.match(/page=(\d+)/)![1]);
      if (sezione === "btp" && pagina === 1 && respinte === 0) {
        respinte++;
        // Retry-After in secondi: un centesimo, per non rallentare il test.
        return new Response("", { status: 429, headers: { "retry-after": "0.01" } });
      }
      const { nome, isin } = nomePerSezione(sezione);
      const corpo = pagina === 1 ? rigaHtml(isin(1), nome, "99,5") : "";
      return new Response(`<table>${corpo}</table>`, { status: 200 });
    });
    const esito = await scaricaListaBtp();
    expect(respinte).toBe(1);
    expect(esito.righe).toHaveLength(4);
  });
});

describe("indicizzati sul listino estero", () => {
  /**
   * La regressione: «finisce per ei» descrive bene Bundei e Obligacionesei,
   * ma prende anche «Bei» — la Banca Europea per gli Investimenti. Trentasei
   * titoli BEI finivano fra gli indicizzati, quotati a prezzo REALE e con un
   * rendimento reale che non esiste: numeri plausibili e tutti sbagliati.
   */
  it("riconosce gli indicizzati per nome, senza prendere la BEI", () => {
    const html = `<table>
      ${rigaHtml("DE0001030583", "Bundei 0,5% Ap30 Eur", "99,5")}
      ${rigaHtml("FR0000186413", "Oati Lug29 Eur 3,4", "101,2")}
      ${rigaHtml("XS0000000002", "Bei Fx 3% Nov28 Eur", "100,1")}
      ${rigaHtml("XS0000000003", "Bei Green Fx 3.125% May37 Eur", "98,7")}
    </table>`;
    const per = new Map(
      parseListaBtp(html, "daNome", true).righe.map((r) => [r.isin, r]),
    );
    expect(per.get("DE0001030583")!.tipo).toBe("indicizzatoEuro");
    expect(per.get("FR0000186413")!.tipo).toBe("indicizzatoEuro");
    expect(per.get("XS0000000002")!.tipo).toBe("fisso");
    expect(per.get("XS0000000003")!.tipo).toBe("fisso");
    expect(per.get("XS0000000002")!.emittente).toBe("sovra");
  });

  /** Gli strip francesi restano zero coupon, come quelli italiani. */
  it("gli strip esteri sono zero coupon", () => {
    const html = `<table>${rigaHtml("FR0010809608", "Oatstripfran Zc Apr50 Eur", "42,3")}</table>`;
    const [riga] = parseListaBtp(html, "daNome", true).righe;
    expect(riga.tipo).toBe("zeroCoupon");
    expect(riga.emittente).toBe("FR");
  });
});

describe("parseDataGodimento", () => {
  it("legge la data di godimento dalla tabella dei dati completi", () => {
    const html = `<tr><td><strong>Data Godimento</strong></td><td><span class="t-text -right">01/11/21</span></td></tr>`;
    expect(parseDataGodimento(html)).toBe("2021-11-01");
    expect(parseDataGodimento("<p>niente</p>")).toBeNull();
  });
});

describe("parseSchedaStepUp", () => {
  /** La struttura vera della scheda: il payout sta in uno span senza `-right`. */
  const scheda = (payout: string) => `
    ${voce("Data Godimento", "28/10/25")}
    ${voce("Scadenza", "28/10/32")}
    ${voce("Periodicit&agrave; cedola", "Trimestrale")}
    <tr>
      <td class="nowrap"><span class="t-text"><strong>Descrizione Payout</strong></span></td>
      <td>
        <span class="t-text">
            ${payout}
        </span>
      </td>
    </tr>
    ${voce("Lotto Minimo", "1.000")}`;

  it("legge godimento, periodicità e il testo del piano", () => {
    expect(
      parseSchedaStepUp(
        scheda("I Titoli hanno scadenza 7 anni e garantiscono tassi annui (3-2-2). Per i primi 3 anni un tasso pari al 2,60%."),
      ),
    ).toEqual({
      godimento: "2025-10-28",
      periodicita: "Trimestrale",
      descrizione:
        "I Titoli hanno scadenza 7 anni e garantiscono tassi annui (3-2-2). Per i primi 3 anni un tasso pari al 2,60%.",
    });
  });

  it("payout vuoto (BTP Futura): descrizione assente, non la cella dopo", () => {
    expect(parseSchedaStepUp(scheda("")).descrizione).toBeNull();
  });
});

/** Una riga etichetta/valore delle tabelle di scheda e dati completi. */
function voce(etichetta: string, valore: string): string {
  return `<tr>
    <td class="l-screen -xs-half"><span class="t-text"><strong>${etichetta}</strong></span></td>
    <td><span class="t-text -right">${valore}</span></td>
  </tr>`;
}
