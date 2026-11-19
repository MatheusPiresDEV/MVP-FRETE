import { parseBrazilianNumber } from "./currency.js";

export function parsePercentageToBasisPoints(value) {
  const percentage = parseBrazilianNumber(String(value ?? "").replace("%", ""));
  return percentage === null ? null : Math.round(percentage * 100);
}

export function formatBasisPoints(basisPoints) {
  if (!Number.isInteger(basisPoints)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(basisPoints / 100)}%`;
}
