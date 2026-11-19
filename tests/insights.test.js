import { describe, expect, it } from "vitest";
import { generateInsights } from "../src/services/insight-service.js";

describe("insights determinísticos", () => {
  it("produz textos com base nos dados fornecidos", () => {
    const data = {
      routes: [{ id: "1", routeCode: "R-1", vehicleName: "V1", shipments: 1, averageKm: 1, averageNf: 10000 }],
      quotesByRoute: {
        "1": [
          { carrierId: "official", carrierName: "Oficial", isOfficial: true, totalCents: 10000 },
          { carrierId: "backup", carrierName: "Backup", isOfficial: false, totalCents: 8000 },
        ],
      },
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(8);
    expect(insights.some((item) => item.text.includes("20,00"))).toBe(true);
    expect(insights.some((item) => item.text.includes("R-1"))).toBe(true);
  });
});
