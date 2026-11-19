import { compareRoute, rankCarriers } from "./analysis-service.js";
import { assessRouteQuality } from "./quality-service.js";

export function generateInsights(dataset) {
  const comparisons = dataset.routes.map((route) => {
    const result = compareRoute(route, dataset.quotesByRoute[route.id] || [], new Date(), dataset.thresholds);
    const quality = assessRouteQuality(route, dataset.quotesByRoute[route.id] || [], dataset.routes, dataset.carriers || []);
    const eligible = quality.status === "completo" && Boolean(result.official && result.bestBackup);
    return { ...result, quality, savingsCents: eligible ? result.savingsCents : 0 };
  });
  const valid = comparisons.filter((item) => item.official && item.bestBackup && item.quality.status === "completo");
  const wins = valid.filter((item) => item.competitiveness === "Sim" || item.competitiveness === "Empate").length;
  const savings = comparisons.reduce((sum, item) => sum + item.savingsCents, 0);
  const ranked = rankCarriers(comparisons);
  const opportunities = comparisons.filter((item) => item.savingsCents > 0).sort((a, b) => b.savingsCents - a.savingsCents);
  const noBackups = dataset.routes.filter((route) => !(dataset.quotesByRoute[route.id] || []).some((quote) => !quote.isOfficial));
  const insufficient = comparisons.filter((item) => !item.official || !item.bestOverall || !item.bestBackup || item.quality.status !== "completo");
  const biggestDeviation = valid.slice().sort((a, b) => Math.abs(b.deltaCents || 0) - Math.abs(a.deltaCents || 0))[0];
  const vehicleTotals = new Map();
  for (const item of opportunities) {
    const vehicle = item.route.vehicleName || "Não informado";
    vehicleTotals.set(vehicle, (vehicleTotals.get(vehicle) || 0) + item.savingsCents);
  }
  const topVehicle = [...vehicleTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  return [
    { type: "competitividade", text: valid.length ? `A oficial é competitiva ou empata em ${Math.round(wins / valid.length * 100)}% das rotas com dados válidos (${wins}/${valid.length}).` : "Não há rotas com cotações válidas para avaliar competitividade." },
    { type: "economia", text: `Economia potencial consolidada: ${formatCurrency(savings)}.` },
    { type: "transportadora", text: ranked[0] ? `${ranked[0].name} lidera com ${ranked[0].wins} vitórias em ${ranked[0].comparisons} comparações${ranked[0].reducedSample ? " (amostra reduzida)" : ""}.` : "Ainda não há comparações válidas para o ranking." },
    { type: "renegociacao", text: opportunities.length ? `${opportunities.length} rota(s) têm oportunidade; maior caso: ${opportunities[0].route.routeCode || opportunities[0].route.id} (${formatCurrency(opportunities[0].savingsCents)}).` : "Nenhuma oportunidade de economia foi identificada." },
    { type: "backup", text: opportunities[0]?.bestBackup ? `Melhor alternativa: ${opportunities[0].bestBackup.carrierName} na rota ${opportunities[0].route.routeCode || opportunities[0].route.id}.` : "Não há backup com preço válido abaixo da oficial." },
    { type: "desvio", text: biggestDeviation ? `Maior desvio oficial: ${biggestDeviation.route.routeCode || biggestDeviation.route.id} (${formatCurrency(Math.abs(biggestDeviation.deltaCents || 0))}).` : "Não há dados para medir desvio da oficial." },
    { type: "veiculo", text: topVehicle ? `Maior oportunidade por veículo: ${topVehicle[0]} (${formatCurrency(topVehicle[1])}).` : "Não há oportunidade por veículo." },
    { type: "qualidade", text: `${noBackups.length} rota(s) sem backup e ${insufficient.length} comparação(ões) com dados insuficientes.` },
  ];
}

function formatCurrency(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
