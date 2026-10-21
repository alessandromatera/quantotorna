import { describe, expect, it } from "vitest";
import type { Catalogo, TitoloCatalogo } from "./formato";
import { metricheCatalogo } from "./metriche";
import { llmsTxt, rendimentiInMarkdown } from "./testo";

/** Titoli inventati: ISIN, nomi e prezzi non sono di mercato. */
function titolo(campi: Partial<TitoloCatalogo> & Pick<TitoloCatalogo, "isin">): TitoloCatalogo {
  return {
    nome: `Titolo ${campi.isin}`,
    tipo: "fisso",
    emittente: "IT",
    cedolaAnnua: 3,
    frequenzaCedola: 2,
    dataScadenza: "2031-03-01",
    prezzo: 98,
    spread: null,
    gradiniCedola: null,
    scambi: null,
    ...campi,
  };
}

const catalogo: Catalogo = {
  versione: 1,
  data: "2026-10-20",
  generato: "2026-10-20T18:00:00Z",
  euribor6m: null,
  titoli: [
    titolo({ isin: "IT0000000011", nome: "Btp Tf 3% Mz31 | prova" }),
    titolo({ isin: "IT0000000029", tipo: "ccteu", cedolaAnnua: 0, spread: 1.1, prezzo: 101 }),
  ],
  emissioni: {},
  documentiMef: [],
  rapporto: { scartate: [], fontiMancanti: [] },
};
const m = metricheCatalogo(catalogo);

describe("rendimentiInMarkdown", () => {
  const testo = rendimentiInMarkdown(m);

  it("dice di che giorno sono i numeri e su che condizioni", () => {
    expect(testo).toMatch(/^# Rendimenti netti dei titoli di Stato sul MOT — 20\/10\/2026/);
    expect(testo).toContain("Su 10.000 nominali e senza commissioni");
  });

  it("una riga per titolo, coi numeri della pagina", () => {
    const riga = testo.split("\n").find((r) => r.includes("IT0000000011"))!;
    expect(riga).toContain(`${m.flussiNoti[0].ytmNettoPct!.toFixed(2).replace(".", ",")}%`);
    // La barra verticale nel nome non spezza la tabella.
    expect(riga).toContain("Btp Tf 3% Mz31 \\| prova");
    expect(riga.split(" | ")).toHaveLength(8);
  });

  it("dove manca un numero dice perché", () => {
    const riga = testo.split("\n").find((r) => r.includes("IT0000000029"))!;
    expect(riga).toMatch(/— \(.*Euribor/);
  });
});

describe("llmsTxt", () => {
  const testo = llmsTxt(m);

  it("segue la forma di llmstxt.org: titolo, riassunto, sezioni di link", () => {
    expect(testo).toMatch(/^# quantotorna\n\n> /);
    expect(testo).toContain("## Pagine");
    expect(testo).toContain("(https://quantotorna.it/rendimenti.md)");
    expect(testo).toContain("(https://quantotorna.it/dati/catalogo.json)");
  });

  it("conta i titoli e dice la data dei prezzi", () => {
    expect(testo).toContain("2 titoli, prezzi di chiusura del 20/10/2026");
  });
});
