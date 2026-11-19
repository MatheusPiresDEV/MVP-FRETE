import { describe, expect, it } from "vitest";
import { formatCentsToBRL, parseBrazilianNumber, parseCurrencyToCents } from "../src/utils/currency.js";
import { formatBasisPoints, parsePercentageToBasisPoints } from "../src/utils/percentage.js";

describe("conversão monetária sem float persistido", () => {
  it("interpreta moeda brasileira em centavos", () => {
    expect(parseCurrencyToCents("R$ 3.150,00")).toBe(315000);
    expect(formatCentsToBRL(315000)).toContain("3.150,00");
  });
  it("preserva indisponibilidade em vez de converter para zero", () => {
    expect(parseCurrencyToCents("N/A")).toBeNull();
    expect(parseBrazilianNumber("NOK")).toBeNull();
    expect(parseCurrencyToCents("0")).toBe(0);
  });
  it("converte percentual para pontos-base", () => {
    expect(parsePercentageToBasisPoints("0,05%")).toBe(5);
    expect(formatBasisPoints(5)).toBe("0,05%");
  });
});
