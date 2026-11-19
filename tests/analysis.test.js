import { describe, expect, it } from "vitest";
import { compareRoute, rankCarriers } from "../src/services/analysis-service.js";

const route = { id: "route-1", shipments: 1 };
const quote = (carrierId, totalCents, isOfficial = false, extra = {}) => ({
  carrierId, carrierName: carrierId, totalCents, isOfficial, ...extra,
});

describe("comparação e ranking", () => {
  it("identifica oficial competitiva, backup mais barato e economia", () => {
    const result = compareRoute(route, [quote("oficial", 10000, true), quote("b1", 9000), quote("b2", 8000)]);
    expect(result.bestBackup.carrierId).toBe("b2");
    expect(result.bestOverall.carrierId).toBe("b2");
    expect(result.savingsCents).toBe(2000);
    expect(result.competitiveness).toBe("Não");
  });
  it("considera empate com diferença de um centavo", () => {
    const result = compareRoute(route, [quote("oficial", 10000, true), quote("backup", 10001)]);
    expect(result.competitiveness).toBe("Empate");
  });
  it("retorna dados insuficientes sem backup ou com cotação expirada", () => {
    expect(compareRoute(route, [quote("oficial", 10000, true)]).competitiveness).toBe("Dados insuficientes");
    expect(compareRoute(route, [quote("oficial", 10000, true), quote("b", 9000, false, { validUntil: "2020-01-01" })]).competitiveness).toBe("Dados insuficientes");
  });
  it("calcula vitórias, derrotas e taxa de vitória por comparação", () => {
    const results = [
      compareRoute({ id: "r1" }, [quote("A", 8000, true), quote("B", 9000)]),
      compareRoute({ id: "r2" }, [quote("B", 7000, true), quote("A", 9000)]),
    ];
    const ranking = rankCarriers(results);
    expect(ranking.find((item) => item.carrierId === "A").comparisons).toBe(2);
    expect(ranking.find((item) => item.carrierId === "A").wins).toBe(1);
    expect(ranking.find((item) => item.carrierId === "A").losses).toBe(1);
  });
});
