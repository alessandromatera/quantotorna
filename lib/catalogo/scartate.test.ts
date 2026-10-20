import { describe, expect, it } from "vitest";
import { raggruppaScartate } from "./scartate";

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
