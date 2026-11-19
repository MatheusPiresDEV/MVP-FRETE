import { describe, expect, it } from "vitest";
import { detectCarrierColumns, suggestColumn, validateImportRows } from "../src/services/import-service.js";

describe("mapeamento e validação de importação", () => {
  it("sugere colunas mesmo com acentos e detecta prefixos dinâmicos", () => {
    const headers = ["ID Rota", "Contagem de Shipment", "TOTAL [Transportadora X]", "KM [Transportadora X]"];
    expect(suggestColumn(headers, "routeCode")).toBe("ID Rota");
    expect(detectCarrierColumns(headers)).toEqual([{
      name: "Transportadora X",
      columns: { TOTAL: "TOTAL [Transportadora X]", KM: "KM [Transportadora X]" },
    }]);
  });
  it("valida valores brasileiros e detecta rotas repetidas", () => {
    const headers = ["ID Rota", "Shipments", "Média KM", "Custo Total Oficial"];
    const result = validateImportRows([
      ["CTG-01", "236", "12,5", "R$ 3.150,00"],
      ["CTG-01", "1", "3", "100"],
      ["CTG-02", "NOK", "1", "N/A"],
    ], headers, {
      routeCode: "ID Rota", shipments: "Shipments", averageKm: "Média KM", officialCost: "Custo Total Oficial",
    });
    expect(result[0].valid).toBe(true);
    expect(result[0].officialCents).toBe(315000);
    expect(result[1].errors).toContain("Rota duplicada no arquivo");
    expect(result[2].errors).toContain("Shipments inválido");
  });
});
