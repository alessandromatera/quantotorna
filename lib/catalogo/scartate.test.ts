import { describe, expect, it } from "vitest";
import { NON_TRATTATI } from "../mercato/emittenti";
import { motivoSuUnaRiga, raggruppaScartate, riepilogoScartateNuove, scartateNuove } from "./scartate";

describe("raggruppaScartate", () => {
  it("conta i motivi ricorrenti ed elenca gli altri", () => {
    const { gruppi, altre } = raggruppaScartate([
      { isin: "XS0000000019", motivo: "non è in euro (Inventato 2030 Usd): il rendimento dipenderebbe dal cambio a scadenza" },
      { isin: "XS0000000027", motivo: "non è in euro (Inventato 2031 Gbp): il rendimento dipenderebbe dal cambio a scadenza" },
      { isin: "IT0000000011", motivo: "prezzo assente (non scambiato)" },
      { isin: "IT0000000029", motivo: "BTP Valore Insieme: una sola cedola pagata a scadenza" },
    ]);
    expect(gruppi.map((g) => g.quante)).toEqual([2, 1]);
    expect(altre.map((s) => s.isin)).toEqual(["IT0000000029"]);
  });

  it("un motivo con un testo nuovo si elenca, non sparisce", () => {
    const { gruppi, altre } = raggruppaScartate([{ isin: "IT0000000037", motivo: "motivo mai visto" }]);
    expect(gruppi).toEqual([]);
    expect(altre).toHaveLength(1);
  });
});

describe("scartateNuove", () => {
  const ieri = [
    { isin: "IT0000000011", motivo: "prezzo assente (non scambiato)" },
    { isin: "XS0000000035", motivo: "eurobbligazione inventata: lasciata fuori apposta" },
    { isin: "IT0000000045", motivo: "cedola unica non riconosciuta («testo di ieri»)" },
  ];

  it("segnala solo i motivi che la pagina elenca, e solo se ieri non c'erano", () => {
    const oggi = [
      ...ieri,
      // Ricorrenti: si contano in pagina, non si segnalano.
      { isin: "IT0000000052", motivo: "prezzo assente (non scambiato)" },
      { isin: "XS0000000043", motivo: "non è in euro (Inventato 2030 Usd): il rendimento dipenderebbe dal cambio a scadenza" },
      { isin: "XS0000000050", motivo: "emittente non riconosciuto (Inventata Spa)" },
      // Nuovo titolo con un motivo da leggere.
      { isin: "IT0000000060", motivo: "piano step-up non riconosciuto nella scheda" },
    ];
    expect(scartateNuove(ieri, oggi)).toEqual([{ isin: "IT0000000060", motivo: "piano step-up non riconosciuto nella scheda" }]);
  });

  it("un titolo già scartato che cambia motivo è una novità", () => {
    const oggi = [{ isin: "IT0000000045", motivo: "cedola unica non riconosciuta («testo di oggi»)" }];
    expect(scartateNuove(ieri, oggi)).toEqual(oggi);
  });

  describe("le esclusioni volute non sono novità", () => {
    const voluto = (chiave: string, nome: string) => `${nome}: ${NON_TRATTATI[chiave]}`;

    it("un KfW che ieri era senza prezzo e oggi ha scambiato non è nuovo", () => {
      const prima = [{ isin: "DE0000000012", motivo: "prezzo assente (non scambiato)" }];
      const oggi = [{ isin: "DE0000000012", motivo: voluto("kfw", "Kfw Fx 2.875% Dec29 Eur") }];
      expect(scartateNuove(prima, oggi)).toEqual([]);
    });

    it("lo stesso per un EFSF e per un'eurobbligazione Italy", () => {
      const prima = [
        { isin: "EU0000000010", motivo: "prezzo assente (non scambiato)" },
        { isin: "XS0000000068", motivo: "prezzo assente (non scambiato)" },
      ];
      const oggi = [
        { isin: "EU0000000010", motivo: voluto("efsf", "Efsf Fx 1% Gen30 Eur") },
        { isin: "XS0000000068", motivo: voluto("italy", "Italy Fx 5% Gen35 Eur") },
      ];
      expect(scartateNuove(prima, oggi)).toEqual([]);
    });

    it("un titolo nuovo con «cedola non riconosciuta» resta una novità", () => {
      const oggi = [{ isin: "IT0000000078", motivo: "cedola non riconosciuta («testo inventato»)" }];
      expect(scartateNuove(ieri, oggi)).toEqual(oggi);
    });

    it("un titolo che ieri era KfW e oggi ha un motivo non voluto resta una novità", () => {
      const prima = [{ isin: "DE0000000012", motivo: voluto("kfw", "Kfw Fx 2.875% Dec29 Eur") }];
      const oggi = [{ isin: "DE0000000012", motivo: "senza data di scadenza (Kfw Perp)" }];
      expect(scartateNuove(prima, oggi)).toEqual(oggi);
    });
  });

  it("niente di nuovo, niente da segnalare", () => {
    expect(scartateNuove(ieri, ieri)).toEqual([]);
  });
});

describe("riepilogoScartateNuove", () => {
  it("un elenco Markdown, un titolo per riga anche se il motivo va a capo", () => {
    const testo = riepilogoScartateNuove([
      { isin: "IT0000000060", motivo: "piano non riconosciuto\r\n(«testo\u2028della scheda»)" },
    ]);
    expect(testo).toContain("### 1 titolo lasciato fuori per un motivo che ieri non c'era");
    expect(testo.trimEnd().split("\n").at(-1)).toBe("- `IT0000000060`: piano non riconosciuto («testo della scheda»)");
    expect(riepilogoScartateNuove([...Array(2)].map(() => ({ isin: "IT0000000060", motivo: "x" })))).toContain(
      "### 2 titoli lasciati fuori",
    );
  });

  it("nessun motivo può cominciare una riga di comando nel log di GitHub", () => {
    expect(motivoSuUnaRiga("testo\r::error::finto\n::set-output name=x::y")).toBe("testo ::error::finto ::set-output name=x::y");
    expect(motivoSuUnaRiga("\u0000\u001b[31mrosso\u007f")).toBe("[31mrosso");
  });
});
