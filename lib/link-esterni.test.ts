import { describe, expect, it } from "vitest";
import { linkInformativo, sezioneListino } from "./link-esterni";

describe("linkInformativo", () => {
  it("BTP → scheda Borsa Italiana sezione btp", () => {
    const l = linkInformativo({ isin: "IT0000000001", tipo: "fisso", emittente: "IT" });
    expect(l.fonte).toBe("Borsa Italiana");
    expect(l.url).toContain("/mot/btp/scheda/IT0000000001-MOTX.html");
  });

  it("la sezione è quella del listino di provenienza", () => {
    expect(sezioneListino({ tipo: "ccteu", emittente: "IT" })).toBe("cct");
    expect(sezioneListino({ tipo: "bot", emittente: "IT" })).toBe("bot");
    // Strip, BTP€i e BTP Italia arrivano dal listino dei BTP.
    expect(sezioneListino({ tipo: "zeroCoupon", emittente: "IT" })).toBe("btp");
    expect(sezioneListino({ tipo: "indicizzatoEuro", emittente: "IT" })).toBe("btp");
    expect(sezioneListino({ tipo: "italia", emittente: "IT" })).toBe("btp");
    expect(sezioneListino({ tipo: "fisso", emittente: "DE" })).toBe("euro-obbligazioni");
    expect(sezioneListino({ tipo: "zeroCoupon", emittente: "sovra" })).toBe("euro-obbligazioni");
  });
});
