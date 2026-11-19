export function parseBrazilianNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim().replace(/[\u00a0\u202f\s]/g, "");
  if (!text || /^(nok|n\/?a|indispon[ií]vel|-|—)$/i.test(text)) return null;
  const normalized = text.replace(/[R$%]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCurrencyToCents(value) {
  const amount = parseBrazilianNumber(value);
  return amount === null ? null : Math.round(amount * 100);
}

export function formatCentsToBRL(cents) {
  if (!Number.isSafeInteger(cents)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
