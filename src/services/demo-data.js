const carriers = [
  { id: "demo-carrier-01", name: "Rota Sul Logística", normalizedName: "rota sul logistica", active: true },
  { id: "demo-carrier-02", name: "Expresso Central", normalizedName: "expresso central", active: true },
  { id: "demo-carrier-03", name: "Veloz Transportes", normalizedName: "veloz transportes", active: true },
  { id: "demo-carrier-04", name: "Cargas Brasil", normalizedName: "cargas brasil", active: true },
];

const vehicles = [
  { id: "demo-vehicle-01", name: "Truck", normalizedName: "truck", active: true },
  { id: "demo-vehicle-02", name: "Carreta", normalizedName: "carreta", active: true },
  { id: "demo-vehicle-03", name: "VUC", normalizedName: "vuc", active: true },
  { id: "demo-vehicle-04", name: "Toco", normalizedName: "toco", active: true },
];

const flowTypes = [
  { id: "demo-flow-01", name: "Fracionado", normalizedName: "fracionado", active: true },
  { id: "demo-flow-02", name: "Lotação", normalizedName: "lotacao", active: true },
  { id: "demo-flow-03", name: "Transferência", normalizedName: "transferencia", active: true },
];

const routeDefinitions = [
  ["demo-route-01", "SP-CPS-001", "São Paulo", "Campinas", "Truck", "Fracionado", 236, 96, 315000, "2026-07-14", [0, 780000, 1, 655000, 2, 720000]],
  ["demo-route-02", "SP-RJ-002", "São Paulo", "Rio de Janeiro", "Carreta", "Lotação", 148, 432, 482000, "2026-08-03", [1, 1250000, 0, 1190000, 2, 1100000]],
  ["demo-route-03", "MG-BH-003", "Contagem", "Belo Horizonte", "VUC", "Fracionado", 94, 58, 187000, "2026-08-21", [2, 560000, 3, 570000]],
  ["demo-route-04", "PR-CWB-004", "Curitiba", "Londrina", "Toco", "Transferência", 112, 386, 267000, "2026-09-10", [0, 2300000, 1, 2070000, 3, 2150000]],
  ["demo-route-05", "SC-FLN-005", "Joinville", "Florianópolis", "Truck", "Fracionado", 188, 176, 358000, "2026-09-28", [3, 930000, 0, 790000, 2, 835000]],
  ["demo-route-06", "BA-SSA-006", "Feira de Santana", "Salvador", "Carreta", "Lotação", 128, 112, 526000, "2026-10-12", [1, 1680000, 2, 1450000, 3, 1500000]],
];

const routes = [];
const quotesByRoute = {};

for (const [id, routeCode, origin, destination, vehicleName, flowTypeName, shipments, averageKm, averageNf, referenceDate, quoteData] of routeDefinitions) {
  const route = {
    id, routeCode, origin, destination, vehicleName, flowTypeName, shipments,
    averageKm, averageNf, referenceDate, status: "Demonstração",
    notes: "Registro ilustrativo; não pertence ao Firestore.",
  };
  const quotes = [];
  for (let index = 0; index < quoteData.length; index += 2) {
    const carrierIndex = quoteData[index];
    const totalCents = quoteData[index + 1];
    quotes.push({
      id: `${id}-quote-${index / 2 + 1}`,
      carrierId: carriers[carrierIndex].id,
      carrierName: carriers[carrierIndex].name,
      isOfficial: index === 0,
      available: true,
      totalCents,
      informedTotalCents: totalCents,
      includeTravel: false,
      includeFixed: true,
      fixedCostCents: totalCents - averageKm * 100,
      includeDistance: true,
      costPerKmCents: 100,
      quoteDate: referenceDate,
    });
  }
  routes.push(route);
  quotesByRoute[id] = quotes;
}

export function createDemoDataset() {
  return {
    routes: routes.map((route) => ({ ...route })),
    quotesByRoute: Object.fromEntries(Object.entries(quotesByRoute).map(([id, quotes]) => [id, quotes.map((quote) => ({ ...quote }))])),
    carriers: carriers.map((item) => ({ ...item })),
    vehicles: vehicles.map((item) => ({ ...item })),
    flowTypes: flowTypes.map((item) => ({ ...item })),
    thresholds: { criticalCents: 10000000, highCents: 5000000, mediumCents: 1000000 },
    demoMode: true, demoAvailable: true,
  };
}

export function getDemoRoute(id) {
  const route = routes.find((item) => item.id === id);
  return route ? { ...route } : null;
}
