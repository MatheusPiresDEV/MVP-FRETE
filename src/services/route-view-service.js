import { compareRoute } from "./analysis-service.js";
import { assessRouteQuality } from "./quality-service.js";

export function enrichDataset(dataset) {
  const comparisons = dataset.routes.map((route) => {
    const result = compareRoute(route, dataset.quotesByRoute[route.id] || [], new Date(), dataset.thresholds);
    const quality = assessRouteQuality(route, dataset.quotesByRoute[route.id] || [], dataset.routes, dataset.carriers);
    const eligible = quality.status === "completo" && Boolean(result.official && result.bestBackup);
    return {
      ...result,
      quality,
      eligibleForNegotiation: eligible,
      savingsCents: eligible ? result.savingsCents : 0,
      priority: eligible ? result.priority : "dados insuficientes",
    };
  });
  return { ...dataset, comparisons };
}
