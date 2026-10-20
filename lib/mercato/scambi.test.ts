import { describe, expect, it } from "vitest";
import {
  SOGLIE_SCAMBI,
  arrotondaControvalore,
  formatContratti,
  formatControvalore,
  formatFrequenza,
  sintetizzaScambi,
  superaSoglia,
} from "./scambi";

describe("superaSoglia", () => {
  const [qualche, , alti] = SOGLIE_SCAMBI;

  it("l'estremo è incluso", () => {
    expect(superaSoglia(50_000, qualche)).toBe(true);
    expect(superaSoglia(49_999, qualche)).toBe(false);
    expect(superaSoglia(1_000_000, alti)).toBe(true);
  });

  /** Zero è un dato (mediana a zero), null no: entrambi restano fuori. */
  it("senza scambi o senza dato non passa", () => {
    expect(superaSoglia(0, qualche)).toBe(false);
    expect(superaSoglia(null, qualche)).toBe(false);
  });

  it("le soglie crescono", () => {
    const minimi = SOGLIE_SCAMBI.map((s) => s.minimo);
    expect([...minimi].sort((a, b) => a - b)).toEqual(minimi);
  });
});

describe("formatControvalore", () => {
  it("scrive l'ordine di grandezza, non le cifre", () => {
    expect(formatControvalore(5_303_018.2)).toBe("5,3 mln €");
    expect(formatControvalore(57_830_185)).toBe("57,8 mln €");
    expect(formatControvalore(1_000_000)).toBe("1 mln €");
    expect(formatControvalore(163_151.2)).toBe("163 mila €");
    expect(formatControvalore(8_443)).toBe("8,4 mila €");
    expect(formatControvalore(850)).toBe("850 €");
  });
});

describe("formatContratti", () => {
  it("singolare e plurale", () => {
    expect(formatContratti(1)).toBe("1 contratto");
    expect(formatContratti(133)).toBe("133 contratti");
    expect(formatContratti(1_250)).toBe("1.250 contratti");
  });
});

describe("sintetizzaScambi", () => {
  it("mediana su un numero dispari e pari di sedute", () => {
    expect(sintetizzaScambi([0, 10, 1_000_000])).toEqual({ mediana: 10, sedute: 3, attive: 2 });
    expect(sintetizzaScambi([0, 10, 30, 1_000_000])).toEqual({ mediana: 20, sedute: 4, attive: 3 });
  });

  /**
   * È il motivo per cui si usa la mediana: un blocco grosso sposta la media
   * di un ordine di grandezza e la mediana per niente.
   */
  it("un blocco grosso non sposta la mediana", () => {
    const tipiche = Array.from({ length: 64 }, () => 40_000);
    expect(sintetizzaScambi([...tipiche, 5_000_000])!.mediana).toBe(40_000);
  });

  it("le sedute senza scambi contano", () => {
    // Irlanda 1,35% Mz31: 8 sedute con scambi su 65, mediana zero.
    const s = sintetizzaScambi([...Array(57).fill(0), ...Array(8).fill(1_500)])!;
    expect(s).toEqual({ mediana: 0, sedute: 65, attive: 8 });
    expect(formatFrequenza(s)).toBe("scambiato in 8 sedute su 65");
  });

  it("senza sedute non c'è sintesi", () => {
    expect(sintetizzaScambi([])).toBeNull();
  });
});

describe("formatFrequenza", () => {
  it("mai, una, molte", () => {
    expect(formatFrequenza({ mediana: 0, sedute: 65, attive: 0 })).toBe("mai scambiato in 65 sedute");
    expect(formatFrequenza({ mediana: 0, sedute: 65, attive: 1 })).toBe("scambiato in 1 seduta su 65");
    expect(formatFrequenza({ mediana: 42_248, sedute: 65, attive: 62 })).toBe(
      "scambiato in 62 sedute su 65",
    );
  });
});

describe("arrotondaControvalore", () => {
  /** È la precisione di `formatControvalore`: l'ordinamento non deve vedere differenze che a schermo non ci sono. */
  it("arrotonda come si scrive", () => {
    expect(arrotondaControvalore(5_303_018.2)).toBe(5_300_000);
    expect(arrotondaControvalore(163_151.2)).toBe(163_000);
    expect(arrotondaControvalore(162_700)).toBe(163_000);
    expect(arrotondaControvalore(8_443)).toBe(8_400);
    expect(arrotondaControvalore(436)).toBe(436);
  });

  it("al confine fra due scale si scrive con la scala nuova", () => {
    // 999.960 arrotondato alle migliaia è un milione: va scritto «1 mln €», non «1000 mila €».
    expect(formatControvalore(999_960)).toBe("1 mln €");
    expect(formatControvalore(9_960)).toBe("10 mila €");
  });
});
