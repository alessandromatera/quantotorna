import { afterEach, describe, expect, it, vi } from "vitest";
import { parseStoricoEuronext, scaricaStoricoScambi, storicoScambi } from "./euronext";

/** Il CSV come lo scarica il sito, rilevato il 20/10/2026 (BOM in testa compreso). */
function csv(isin: string, righe: string[], intestazione = true): string {
  return [
    '﻿"Historical Data"',
    '"From 2026-07-21 to 2026-10-20"',
    isin,
    intestazione
      ? 'Date;Open;High;Low;Last;Close;"Number of Shares";"Number of Trades";Turnover;vwap'
      : 'Date;Open;High;Low;Last;Close;"Number of Shares";"Number of Trades";Turnover',
    ...righe,
  ].join("\n");
}

/** BTP 4,2% Mz34: la riga del 19/10 coincide con il listino ufficiale di Borsa Italiana. */
const BTP = [
  "19/10/2026;99.85;99.88;99.31;99.44;99.42;5326000;133;5303018;99.5685",
  "16/10/2026;100.12;100.12;99.74;100.05;100.05;4899000;102;4893484;99.8874",
];

describe("parseStoricoEuronext", () => {
  it("legge quantità, contratti e controvalore di ogni seduta", () => {
    expect(parseStoricoEuronext(csv("IT0005560948", BTP), "IT0005560948")).toEqual([
      { data: "2026-10-19", quantita: 5_326_000, contratti: 133, controvalore: 5_303_018 },
      { data: "2026-10-16", quantita: 4_899_000, contratti: 102, controvalore: 4_893_484 },
    ]);
  });

  /** Irlanda 1,35% Mz31: le sedute senza scambi ci sono, a zero. */
  it("le sedute senza scambi valgono zero", () => {
    const righe = ["19/10/2026;0.00;0.00;0.00;0.00;92.44;0;0;0;0.0000"];
    expect(parseStoricoEuronext(csv("IE00BFZRQ242", righe), "IE00BFZRQ242")).toEqual([
      { data: "2026-10-19", quantita: 0, contratti: 0, controvalore: 0 },
    ]);
  });

  /** Un ISIN che Euronext non conosce: intestazione (senza vwap) e nessuna riga. */
  it("nessuna riga è un errore, non un titolo fermo", () => {
    expect(parseStoricoEuronext(csv("XS0000000009", [], false), "XS0000000009")).toMatchObject({
      motivo: expect.stringContaining("nessuna seduta"),
    });
  });

  it("il file di un altro titolo, o un file cambiato, non vale", () => {
    expect(parseStoricoEuronext(csv("IT0005560948", BTP), "IT0000000001")).toMatchObject({
      motivo: expect.stringContaining("ISIN"),
    });
    const cambiato = csv("IT0005560948", BTP).replace("Turnover", "Volume EUR");
    expect(parseStoricoEuronext(cambiato, "IT0005560948")).toMatchObject({
      motivo: expect.stringContaining("struttura"),
    });
  });
});

describe("storicoScambi", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Una seduta di oggi, a mercato aperto, sarebbe una giornata a metà. */
  it("tiene solo le sedute chiuse prima di oggi e chiede tre mesi", async () => {
    let chiesto = "";
    vi.stubGlobal("fetch", async (url: string) => {
      chiesto = url;
      const oggi = "20/10/2026;99.40;99.50;99.30;99.40;99.40;100000;3;99400;99.4";
      return new Response(csv("IT0005560948", [oggi, ...BTP]), { status: 200 });
    });
    const sedute = await storicoScambi("IT0005560948", "2026-10-20");
    expect(sedute.map((s) => s.data)).toEqual(["2026-10-19", "2026-10-16"]);
    expect(chiesto).toContain("startdate=2026-07-21&enddate=2026-10-20");
  });
});

describe("scaricaStoricoScambi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("riassume ogni titolo e tiene i falliti col motivo", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      const isin = url.match(/\/([A-Z0-9]{12})-MOTX/)![1];
      if (isin === "XS0000000009") return new Response(csv(isin, [], false), { status: 200 });
      return new Response(csv(isin, BTP), { status: 200 });
    });
    const { letti, falliti } = await scaricaStoricoScambi(
      ["IT0005560948", "XS0000000009"],
      "2026-10-20",
    );
    expect(letti.get("IT0005560948")).toEqual({ mediana: 5_098_251, sedute: 2, attive: 2 });
    expect(falliti).toHaveLength(1);
    expect(falliti[0].isin).toBe("XS0000000009");
  });

  /** Un file cambiato non deve diventare quattrocento richieste inutili. */
  it("si arrende se i primi titoli sono tutti illeggibili", async () => {
    let richieste = 0;
    vi.stubGlobal("fetch", async () => {
      richieste++;
      return new Response("<html>manutenzione</html>", { status: 200 });
    });
    const isin = Array.from({ length: 100 }, (_, i) => `IT${String(i).padStart(10, "0")}`);
    const { letti, falliti } = await scaricaStoricoScambi(isin, "2026-10-20");
    expect(letti.size).toBe(0);
    expect(richieste).toBeLessThan(30);
    expect(falliti).toHaveLength(100);
  });
});
