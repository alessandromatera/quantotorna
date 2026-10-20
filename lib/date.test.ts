import { describe, expect, it } from "vitest";
import {
  aggiungiGiorni,
  aggiungiMesi,
  anniTra,
  anniTraActAct,
  dataRegolamento,
  formatDataIT,
  giorniTra,
} from "./date";

describe("aritmetica sulle date ISO", () => {
  it("aggiungiGiorni attraversa mesi e anni", () => {
    expect(aggiungiGiorni("2026-01-31", 180)).toBe("2026-07-30");
    expect(aggiungiGiorni("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("aggiungiMesi mantiene il giorno e clampa i fine mese", () => {
    expect(aggiungiMesi("2031-04-01", -6)).toBe("2030-10-01");
    expect(aggiungiMesi("2026-01-31", 1)).toBe("2026-02-28");
    expect(aggiungiMesi("2024-01-31", 1)).toBe("2024-02-29"); // bisestile
  });

  it("giorniTra e anniTra (ACT/365)", () => {
    expect(giorniTra("2026-04-01", "2026-10-01")).toBe(183);
    expect(giorniTra("2026-07-23", "2027-07-23")).toBe(365);
    expect(anniTra("2026-07-23", "2027-07-23")).toBe(1);
  });

  it("formatDataIT", () => {
    expect(formatDataIT("2026-07-23")).toBe("23/07/2026");
  });
});

describe("anniTraActAct", () => {
  it("un anno esatto vale 1 anche se bisestile", () => {
    expect(anniTraActAct("2026-07-23", "2027-07-23")).toBe(1);
    expect(anniTraActAct("2028-01-01", "2029-01-01")).toBe(1);
  });

  it("un tratto a cavallo di un bisestile pesa 366 sui giorni del 2028", () => {
    // 2027-07-01 → 2028-07-01: 184 giorni su 365 nel 2027, 182 su 366 nel 2028.
    expect(anniTraActAct("2027-07-01", "2028-07-01")).toBeCloseTo(
      184 / 365 + 182 / 366,
      12,
    );
  });

  it("è antisimmetrica e su un anno non bisestile coincide con ACT/365", () => {
    expect(anniTraActAct("2027-03-01", "2026-03-01")).toBe(
      -anniTraActAct("2026-03-01", "2027-03-01"),
    );
    expect(anniTraActAct("2026-03-01", "2026-09-01")).toBe(anniTra("2026-03-01", "2026-09-01"));
  });
});

describe("dataRegolamento", () => {
  it("T+2 lavorativi: da lunedì a mercoledì, da giovedì a lunedì", () => {
    expect(dataRegolamento("2026-09-14")).toBe("2026-09-16"); // lunedì → mercoledì
    expect(dataRegolamento("2026-09-17")).toBe("2026-09-21"); // giovedì → lunedì
    expect(dataRegolamento("2026-09-11")).toBe("2026-09-15"); // venerdì → martedì
  });

  it("nel fine settimana si parte dal primo lavorativo utile", () => {
    expect(dataRegolamento("2026-09-12")).toBe("2026-09-15"); // sabato → martedì
    expect(dataRegolamento("2026-09-13")).toBe("2026-09-15"); // domenica → martedì
  });
});
