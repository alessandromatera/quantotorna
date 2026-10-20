import { describe, expect, it } from "vitest";
import { dataItaliana, documentiDellaPagina, leggiRisultato, pagineRisultati } from "./mef";

/** Righe come le estrae `righePdf` dal risultato dell'asta BTP 10 anni del 29-30/09/2026. */
const ASTA_BTP = [
  "Ministero dell'Economia e delle Finanze",
  "Risultati Asta: BTP 10 ANNI",
  "Data: 29 settembre 2026 - 30 settembre 2026",
  "Codice ISIN IT0005729931",
  "Tranche 3° - 4°",
  "Cedola 4,00%",
  "Data Emissione 01 settembre 2026",
  "Data Scadenza 01 ottobre 2036",
  "Prezzo di Aggiudicazione 95,76",
  "Prezzo Nettisti 95,759552",
  "Prezzo Fiscale 99,560",
];

describe("leggiRisultato", () => {
  it("prende il prezzo fiscale, non quello dell'asta del giorno", () => {
    expect(leggiRisultato(ASTA_BTP)).toEqual({
      isin: "IT0005729931",
      prezzoFiscale: 99.56,
      dataEmissione: "2026-09-01",
      dataScadenza: "2036-10-01",
    });
  });

  it("riapertura di un BOT: prezzo medio d'asta 99,127, prezzo fiscale della prima tranche 97,904", () => {
    const righe = [
      "Codice ISIN IT0005689887",
      "Data Emissione 14 gennaio 2026",
      "Data Scadenza 14 gennaio 2027",
      "Prezzo Medio Ponderato 99,127",
      "Prezzo Fiscale 97,904",
    ];
    expect(leggiRisultato(righe)).toMatchObject({ isin: "IT0005689887", prezzoFiscale: 97.904, dataEmissione: "2026-01-14" });
  });

  it("l'ISIN delle riaperture porta il richiamo a una nota", () => {
    const righe = ["Codice ISIN IT0005402117(*)", "Data Emissione 18 febbraio 2020", "Prezzo Fiscale 99,513"];
    expect(leggiRisultato(righe)).toMatchObject({ isin: "IT0005402117", prezzoFiscale: 99.513 });
  });

  it("senza uno dei tre dati dice cosa manca", () => {
    expect(leggiRisultato(ASTA_BTP.filter((r) => !r.startsWith("Codice"))) ).toEqual({ motivo: "codice ISIN non trovato" });
    expect(leggiRisultato(ASTA_BTP.filter((r) => !r.startsWith("Prezzo Fiscale")))).toMatchObject({ motivo: expect.stringContaining("prezzo fiscale") });
    expect(leggiRisultato(ASTA_BTP.filter((r) => !r.startsWith("Data Emissione")))).toEqual({ motivo: "data di emissione non riconosciuta" });
  });
});

describe("dataItaliana", () => {
  it("legge le date dei documenti del MEF", () => {
    expect(dataItaliana("01 settembre 2026")).toBe("2026-09-01");
    expect(dataItaliana("1 ottobre 2036")).toBe("2036-10-01");
    expect(dataItaliana("31/12/2026")).toBeNull();
    expect(dataItaliana("01 settembr 2026")).toBeNull();
  });
});

describe("pagine e documenti del sito", () => {
  it("trova le pagine per tipo di titolo nell'indice", () => {
    const html = `<a href="/it/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/risultati_aste_btp_10_anni/index.html">BTP 10</a>
      <a href="/it/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/risultati_aste_btp_green/">Green</a>
      <a href="/it/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/achivio_dati_storici/">Archivio</a>`;
    expect(pagineRisultati(html)).toEqual([
      "https://www.dt.mef.gov.it/it/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/risultati_aste_btp_10_anni/index.html",
      "https://www.dt.mef.gov.it/it/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/risultati_aste_btp_green/",
    ]);
  });

  it("tiene i risultati, scarta comunicati e dettagli, data dal nome del file", () => {
    const base = "/export/sites/sitodt/modules/documenti_it/debito_pubblico/risultati_aste/risultati_aste_btp_10_anni/";
    const html = [
      "BTP-10-Anni-Risultati-Asta-29-30.09.2026.pdf",
      "BTP-15-Anni-Risultati-collocamento-sindacato-03.02.2026.pdf",
      "Comunicato-Risultati-collocamento-sindacato-nuovo-BTP-10-anni-e-BTPi-20-anni-15.04.2026..pdf",
      "Dettagli-sindacato-nuovo-BTP-10-anni-e-BTPi-20-anni-15.04.2026.pdf",
    ].map((f) => `<a href="${base}${f}">pdf</a>`).join("\n");
    expect(documentiDellaPagina(html)).toEqual([
      { url: `https://www.dt.mef.gov.it${base}BTP-10-Anni-Risultati-Asta-29-30.09.2026.pdf`, data: "2026-09-30" },
      { url: `https://www.dt.mef.gov.it${base}BTP-15-Anni-Risultati-collocamento-sindacato-03.02.2026.pdf`, data: "2026-02-03" },
    ]);
  });
});
