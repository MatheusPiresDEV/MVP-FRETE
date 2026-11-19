export function calculateQuote(quote, route) {
  const shipments = Number.isFinite(route.shipments) ? route.shipments : null;
  const travel = Number.isSafeInteger(quote.costPerTripCents) && shipments !== null
    ? quote.costPerTripCents * shipments : null;
  const fixed = Number.isSafeInteger(quote.fixedCostCents) ? quote.fixedCostCents : 0;
  const distance = Number.isSafeInteger(quote.costPerKmCents) && Number.isFinite(route.averageKm)
    ? Math.round(quote.costPerKmCents * route.averageKm) : 0;
  const insured = Number.isSafeInteger(quote.insuredValueCents) ? quote.insuredValueCents : 0;
  const insurance = Number.isSafeInteger(quote.insuranceBps) && Number.isSafeInteger(quote.insuredValueCents)
    ? Math.round(quote.insuredValueCents * quote.insuranceBps / 10000) : 0;
  const extras = (quote.extraCosts || []).reduce((sum, item) => sum + (Number.isSafeInteger(item.amountCents) ? item.amountCents : 0), 0);
  const discounts = Number.isSafeInteger(quote.discountsCents) ? quote.discountsCents : 0;
  const parts = {
    travel: quote.includeTravel !== false ? travel : 0,
    fixed: quote.includeFixed === true ? fixed : 0,
    distance: quote.includeDistance === true ? distance : 0,
    insurance: quote.includeInsurance === true ? insurance : 0,
    insuredValue: insured,
    extras: quote.includeExtras === true ? extras : 0,
    discounts: quote.includeDiscounts === true ? discounts : 0,
  };
  const componentOptions = [
    ["travel", quote.includeTravel !== false],
    ["fixed", quote.includeFixed === true],
    ["distance", quote.includeDistance === true],
    ["insurance", quote.includeInsurance === true],
    ["extras", quote.includeExtras === true],
    ["discounts", quote.includeDiscounts === true],
  ];
  const hasRequired = parts.travel !== null;
  const calculatedCents = hasRequired
    ? parts.travel + parts.fixed + parts.distance + parts.insurance + parts.extras - parts.discounts
    : null;
  const informedCents = Number.isSafeInteger(quote.informedTotalCents) ? quote.informedTotalCents : null;
  return {
    calculatedCents,
    informedCents,
    effectiveCents: informedCents ?? calculatedCents,
    parts,
    includedComponents: componentOptions.filter(([, included]) => included).map(([name]) => name),
    excludedComponents: componentOptions.filter(([, included]) => !included).map(([name]) => name),
    formula: "viagens + itens selecionados − descontos selecionados",
  };
}

export function isValidQuotePrice(quote, referenceDate = new Date()) {
  const total = Number.isSafeInteger(quote.effectiveCents) ? quote.effectiveCents : quote.totalCents;
  if (!Number.isSafeInteger(total) || total <= 0 || quote.available === false) return false;
  if (quote.validUntil) {
    const expiry = new Date(`${quote.validUntil}T23:59:59`);
    if (!Number.isNaN(expiry.getTime()) && expiry < referenceDate) return false;
  }
  return true;
}
