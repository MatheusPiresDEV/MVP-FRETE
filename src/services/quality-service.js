import { calculateQuote } from "./calculation-service.js";
import { normalizeName } from "../utils/normalization.js";

export function assessRouteQuality(route, quotes, allRoutes = [], carriers = []) {
  const issues = [];
  const official = quotes.filter((quote) => quote.isOfficial);
  const backups = quotes.filter((quote) => !quote.isOfficial);
  if (!official.length) issues.push("Sem transportadora oficial");
  if (!backups.length) issues.push("Sem backup");
  if (!Number.isFinite(route.shipments)) issues.push("Contagem de shipments ausente");
  if (!Number.isFinite(route.averageKm)) issues.push("Média KM ausente");
  if (!Number.isFinite(route.averageNf)) issues.push("Média NF ausente");
  if (official.length > 1) issues.push("Mais de uma cotação oficial");
  if (quotes.some((quote) => quote.totalCents === 0 || quote.informedTotalCents === 0)) issues.push("Cotação com valor zero");
  if (quotes.some((quote) => quote.totalCents != null && (!Number.isSafeInteger(quote.totalCents) || quote.totalCents < 0)
    || quote.informedTotalCents != null && (!Number.isSafeInteger(quote.informedTotalCents) || quote.informedTotalCents < 0))) issues.push("Valor inválido");
  if (allRoutes.some((item) => item.id !== route.id && item.routeCode && normalizeName(item.routeCode) === normalizeName(route.routeCode))) issues.push("Rota duplicada");
  const carrierNames = new Set();
  if (carriers.some((carrier) => {
    const name = carrier.normalizedName || normalizeName(carrier.name);
    if (carrierNames.has(name)) return true;
    carrierNames.add(name);
    return false;
  })) {
    issues.push("Transportadora duplicada");
  }
  if (quotes.some((quote) => quote.validUntil && new Date(`${quote.validUntil}T23:59:59`) < new Date())) issues.push("Cotação vencida");
  if (quotes.some((quote) => quote.insuranceBps != null && (!Number.isSafeInteger(quote.insuranceBps) || quote.insuranceBps < 0))) issues.push("Percentual de seguro inválido");
  for (const quote of quotes) {
    const calculation = calculateQuote(quote, route);
    if (!Number.isSafeInteger(quote.totalCents) && !Number.isSafeInteger(quote.informedTotalCents)
      && !Number.isSafeInteger(calculation.calculatedCents)) {
      issues.push("Custo ausente");
      break;
    }
    if (calculation.calculatedCents === 0 && !issues.includes("Cotação com valor zero")) {
      issues.push("Cotação com valor zero");
      break;
    }
    if (!Number.isSafeInteger(quote.totalCents) || !Number.isSafeInteger(quote.informedTotalCents)) continue;
    const calculated = calculation.calculatedCents;
    if (Number.isSafeInteger(calculated) && Math.abs(calculated - quote.informedTotalCents) > 1) {
      issues.push("Total informado diferente do calculado");
      break;
    }
  }
  const status = issues.length === 0 ? "completo" : issues.some((issue) => issue.includes("inválido") || issue.includes("duplicada")) ? "inválido" : issues.length >= 3 ? "incompleto" : "atenção";
  return { status, issues };
}
