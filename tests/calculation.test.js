import { describe, expect, it } from "vitest";
import { calculateQuote, isValidQuotePrice } from "../src/services/calculation-service.js";

describe("cálculo de cotação", () => {
  it("multiplica shipments pelo custo de viagem", () => {
    const result = calculateQuote({ costPerTripCents: 315000 }, { shipments: 236 });
    expect(result.calculatedCents).toBe(74340000);
  });
  it("soma apenas os componentes explicitamente incluídos", () => {
    const result = calculateQuote({
      costPerTripCents: 10000, fixedCostCents: 5000, includeFixed: false,
      extraCosts: [{ amountCents: 400 }], includeExtras: true,
    }, { shipments: 2 });
    expect(result.calculatedCents).toBe(20400);
  });
  it("mantém o total informado separado do calculado", () => {
    const result = calculateQuote({ costPerTripCents: 10000, informedTotalCents: 18000 }, { shipments: 2 });
    expect(result.calculatedCents).toBe(20000);
    expect(result.effectiveCents).toBe(18000);
  });
  it("rejeita zero, indisponível e cotação vencida", () => {
    expect(isValidQuotePrice({ totalCents: 0 })).toBe(false);
    expect(isValidQuotePrice({ totalCents: 1000, available: false })).toBe(false);
    expect(isValidQuotePrice({ totalCents: 1000, validUntil: "2020-01-01" })).toBe(false);
  });
});
