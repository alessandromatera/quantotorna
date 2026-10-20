import { describe, expect, it } from "vitest";
import { leggiSchedaOnvista } from "./onvista";

/** La pagina con il JSON incorporato, nella forma rilevata il 19/10/2026 (Polonia 2034). */
function pagina(isin: string, base: Record<string, unknown>): string {
  const dati = { props: { pageProps: { data: { snapshot: { instrument: { isin }, bondsBaseData: base } } } } };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(dati)}</script></html>`;
}
const POLONIA = {
  priceEmission: 99.251,
  isoCurrencyPriceEmission: "EUR",
  datetimeEmission: "2024-01-11T12:00:00.000+00:00",
  datetimeStartCalculationInterest: "2024-01-11T12:00:00.000+00:00",
};

describe("leggiSchedaOnvista", () => {
  it("legge prezzo e data di emissione", () => {
    expect(leggiSchedaOnvista(pagina("XS2746102479", POLONIA), "XS2746102479")).toEqual({
      prezzoEmissione: 99.251,
      dataEmissione: "2024-01-11",
    });
  });

  it("la pagina di un altro titolo (o della ricerca) non vale", () => {
    expect(leggiSchedaOnvista(pagina("XS0000000000", POLONIA), "XS2746102479")).toEqual({ motivo: "titolo non presente su onvista" });
    expect(leggiSchedaOnvista("<html>finder</html>", "XS2746102479")).toMatchObject({ motivo: expect.stringContaining("struttura") });
  });

  it("senza prezzo, o con un prezzo in un'altra valuta, nessun dato", () => {
    expect(leggiSchedaOnvista(pagina("FR0014016G71", { ...POLONIA, priceEmission: null }), "FR0014016G71")).toEqual({ motivo: "prezzo di emissione non pubblicato" });
    expect(leggiSchedaOnvista(pagina("XS2746102479", { ...POLONIA, isoCurrencyPriceEmission: "USD" }), "XS2746102479")).toEqual({ motivo: "prezzo di emissione in USD" });
  });

  it("un BTP emesso in lire ha lo stesso prezzo percentuale", () => {
    const btp = { ...POLONIA, priceEmission: 99.45, isoCurrencyPriceEmission: "ITL", datetimeEmission: "1996-11-01T12:00:00.000+00:00" };
    expect(leggiSchedaOnvista(pagina("IT0001086567", btp), "IT0001086567")).toEqual({ prezzoEmissione: 99.45, dataEmissione: "1996-11-01" });
  });

  it("senza data di emissione usa l'inizio della maturazione degli interessi", () => {
    const esito = leggiSchedaOnvista(pagina("XS2746102479", { ...POLONIA, datetimeEmission: null }), "XS2746102479");
    expect(esito).toEqual({ prezzoEmissione: 99.251, dataEmissione: "2024-01-11" });
  });
});
