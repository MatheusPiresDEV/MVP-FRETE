import { isValidQuotePrice } from "./calculation-service.js";

export function compareRoute(route, quotes = [], now = new Date(), thresholds) {
  const valid = quotes.filter((quote) => isValidQuotePrice(quote, now));
  const official = valid.filter((quote) => quote.isOfficial).sort((a, b) => (b.validFrom || "").localeCompare(a.validFrom || ""))[0] || null;
  const alternatives = valid.filter((quote) => !quote.isOfficial).sort((a, b) => a.totalCents - b.totalCents);
  const bestBackup = alternatives[0] || null;
  const bestOverall = valid.slice().sort((a, b) => a.totalCents - b.totalCents)[0] || null;
  if (!official || !bestOverall || !bestBackup) {
    return { routeId: route.id, route, quotes: valid, official, bestBackup, bestOverall, deltaCents: null, deltaPercent: null, savingsCents: 0, competitiveness: "Dados insuficientes", priority: "dados insuficientes" };
  }
  const deltaCents = official.totalCents - (bestBackup?.totalCents ?? official.totalCents);
  const deltaPercent = official.totalCents > 0 ? deltaCents / official.totalCents * 100 : null;
  const savingsCents = Math.max(0, official.totalCents - bestOverall.totalCents);
  const competitiveness = Math.abs(deltaCents) <= 1 ? "Empate" : deltaCents > 1 ? "Não" : "Sim";
  return {
    routeId: route.id, route, quotes: valid, official, bestBackup, bestOverall, deltaCents, deltaPercent,
    savingsCents, competitiveness, priority: classifyOpportunity(savingsCents, thresholds),
  };
}

export function classifyOpportunity(cents, thresholds = {}) {
  if (!Number.isSafeInteger(cents)) return "dados insuficientes";
  if (cents <= 0) return "sem oportunidade";
  if (cents > (thresholds.criticalCents ?? 10000000)) return "crítica";
  if (cents > (thresholds.highCents ?? 5000000)) return "alta";
  if (cents > (thresholds.mediumCents ?? 1000000)) return "média";
  return "baixa";
}

export function rankCarriers(comparisons) {
  const scores = new Map();
  for (const result of comparisons) {
    if (result.quality && result.quality.status !== "completo") continue;
    const quotes = (result.quotes || []).filter((quote) => quote.available !== false && Number.isSafeInteger(quote.totalCents) && quote.totalCents > 0);
    const official = result.official || quotes.find((quote) => quote.isOfficial);
    const backups = quotes.filter((quote) => !quote.isOfficial);
    if (!official || !backups.length) continue;
    const candidateByCarrier = new Map();
    for (const quote of quotes) {
      if (!quote.carrierId) continue;
      const current = candidateByCarrier.get(quote.carrierId);
      if (!current || quote.totalCents < current.totalCents) candidateByCarrier.set(quote.carrierId, quote);
    }
    const bestPrice = Math.min(...[...candidateByCarrier.values()].map((quote) => quote.totalCents));
    const winners = [...candidateByCarrier.values()].filter((quote) => quote.totalCents - bestPrice <= 1);
    const isTie = winners.length > 1;
    const winnerIds = new Set(winners.map((quote) => quote.carrierId));
    for (const quote of candidateByCarrier.values()) {
      const item = scores.get(quote.carrierId) || {
        carrierId: quote.carrierId, name: quote.carrierName || "Transportadora",
        comparisons: 0, wins: 0, ties: 0, losses: 0, totalCostCents: 0,
        quoteCount: 0, officialCount: 0, backupWins: 0, savingsCents: 0, byVehicle: {},
      };
      item.comparisons += 1;
      item.totalCostCents += quote.totalCents;
      item.quoteCount += 1;
      if (quote.isOfficial) item.officialCount += 1;
      if (winnerIds.has(quote.carrierId) && isTie) item.ties += 1;
      else if (winnerIds.has(quote.carrierId)) item.wins += 1;
      else item.losses += 1;
      if (winnerIds.has(quote.carrierId) && !quote.isOfficial) item.backupWins += 1;
      if (!quote.isOfficial && quote.totalCents < official.totalCents) {
        item.savingsCents += official.totalCents - quote.totalCents;
      }
      const vehicle = result.route?.vehicleName || "Não informado";
      const vehicleScore = item.byVehicle[vehicle] || { comparisons: 0, wins: 0, ties: 0, losses: 0 };
      vehicleScore.comparisons += 1;
      if (winnerIds.has(quote.carrierId) && isTie) vehicleScore.ties += 1;
      else if (winnerIds.has(quote.carrierId)) vehicleScore.wins += 1;
      else vehicleScore.losses += 1;
      item.byVehicle[vehicle] = vehicleScore;
      scores.set(quote.carrierId, item);
    }
  }
  return [...scores.values()].map((item) => ({
    ...item,
    winRate: item.comparisons ? item.wins / item.comparisons * 100 : 0,
    averageCostCents: Math.round(item.totalCostCents / item.quoteCount),
    reducedSample: item.comparisons < 5,
  })).sort((a, b) => b.wins - a.wins || a.averageCostCents - b.averageCostCents);
}
