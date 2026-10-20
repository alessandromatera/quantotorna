import { describe, expect, it } from "vitest";
import { parseSerieBce } from "./tassi-bce";

/** La forma di una risposta SDMX-JSON con una sola osservazione. */
const risposta = (valore: unknown, periodo: unknown) => ({
  dataSets: [{ series: { "0:0:0:0:0:0:0": { observations: { "0": [valore] } } } }],
  structure: { dimensions: { observation: [{ id: "TIME_PERIOD", values: [{ id: periodo }] }] } },
});

describe("parseSerieBce", () => {
  it("legge valore e periodo dell'ultima osservazione", () => {
    expect(parseSerieBce(risposta(2.123, "2026-09"), "Euribor 6 mesi")).toEqual({
      percentuale: 2.123,
      periodo: "2026-09",
      nome: "Euribor 6 mesi",
    });
  });

  it("una struttura cambiata è un errore, mai uno zero", () => {
    expect(() => parseSerieBce(risposta(null, "2026-09"), "Euribor")).toThrow(/formato inatteso/);
    expect(() => parseSerieBce(risposta(2.1, undefined), "Euribor")).toThrow(/formato inatteso/);
    expect(() => parseSerieBce({}, "Euribor")).toThrow(/formato inatteso/);
    expect(() => parseSerieBce(null, "Euribor")).toThrow(/formato inatteso/);
  });
});
