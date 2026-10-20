import { describe, expect, it } from "vitest";
import { linkInformativo } from "./link-esterni";

describe("linkInformativo", () => {
  it("BTP → scheda Borsa Italiana sezione btp", () => {
    const l = linkInformativo({ isin: "IT0000000001", categoria: "btpFisso" });
    expect(l.fonte).toBe("Borsa Italiana");
    expect(l.url).toContain("/mot/btp/scheda/IT0000000001-MOTX.html");
  });

  it("ogni categoria ha la sua sezione", () => {
    const sezione = (categoria: Parameters<typeof linkInformativo>[0]["categoria"]) =>
      linkInformativo({ isin: "IT0000000001", categoria }).url.split("/mot/")[1].split("/")[0];
    expect(sezione("ccteu")).toBe("cct");
    expect(sezione("btpItalia")).toBe("btp-italia");
    expect(sezione("bot")).toBe("bot");
    expect(sezione("titoloStatoEstero")).toBe("euro-obbligazioni");
    expect(sezione("sovranazionale")).toBe("obbligazioni-euro");
  });
});
