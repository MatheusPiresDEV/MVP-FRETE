import { loadDataset, useDemoDataMode, useRealDataMode } from "../services/data-service.js";
import { enrichDataset } from "../services/route-view-service.js";
import { formatCentsToBRL } from "../utils/currency.js";
import { escapeHtml } from "../utils/normalization.js";
import { exportWithMetadata } from "../services/export-service.js";
import { rankCarriers } from "../services/analysis-service.js";
import { notify } from "../components/notification.js";

const metricDescriptions = {
  "Rotas": "Quantidade de rotas ativas no conjunto de dados.",
  "Transportadoras": "Empresas cadastradas e disponíveis para comparação.",
  "Veículos": "Tipos de veículos cadastrados.",
  "Cotações": "Preços ativos vinculados às rotas.",
  "Custo oficial": "Soma do preço efetivo da transportadora oficial em cada rota.",
  "Menor custo consolidado": "Soma do menor preço efetivo encontrado em cada rota.",
  "Economia potencial": "Soma de max(0, custo oficial − menor preço), somente em rotas com dados completos.",
  "Rotas com oportunidade": "Rotas completas em que o menor preço é inferior ao oficial.",
  "Rotas sem backup": "Rotas sem nenhuma cotação de transportadora alternativa.",
  "Dados insuficientes": "Rotas sem cotação oficial, backup ou preço válido para comparação.",
};

export async function dashboardPage() {
  const page = document.createElement("main");
  page.className = "content";
  page.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Visão geral</p><h2>Dashboard</h2></div><button id="dashboard-export" class="button secondary">Exportar dashboard</button></div><div id="dashboard-demo-note"></div><p id="dashboard-status">Carregando dados do Firestore…</p><section class="metric-grid" id="dashboard-metrics"></section><section class="panel dashboard-guide"><h3>Como interpretar os indicadores</h3><div class="guide-grid" id="dashboard-guide"></div></section><section class="chart-grid" id="dashboard-charts"></section><section class="panel"><h3>Qualidade de dados por rota</h3><p class="section-help">Verifica campos necessários, cotações e possíveis inconsistências antes de considerar uma economia confiável.</p><div class="table-wrap"><table><thead><tr><th>Rota</th><th>Status</th><th>Problemas</th></tr></thead><tbody id="dashboard-quality"></tbody></table></div></section>`;
  let data;
  try {
    data = enrichDataset(await loadDataset());
    const comparisons = data.comparisons;
    const valid = comparisons.filter((item) => item.official);
    const officialTotal = valid.reduce((sum, item) => sum + item.official.totalCents, 0);
    const minimumTotal = valid.reduce((sum, item) => sum + (item.bestOverall?.totalCents || 0), 0);
    const savings = comparisons.reduce((sum, item) => sum + item.savingsCents, 0);
    const quotesCount = Object.values(data.quotesByRoute).reduce((sum, quotes) => sum + quotes.length, 0);
    const noBackup = data.routes.filter((route) => !(data.quotesByRoute[route.id] || []).some((quote) => !quote.isOfficial)).length;
    const insufficient = comparisons.filter((item) => !item.bestOverall || !item.official || !item.bestBackup).length;
    const opportunityCount = comparisons.filter((item) => item.savingsCents > 0).length;
    const metrics = [
      ["Rotas", data.routes.length], ["Transportadoras", data.carriers.length], ["Veículos", data.vehicles.length],
      ["Cotações", quotesCount], ["Custo oficial", formatCentsToBRL(officialTotal)],
      ["Menor custo consolidado", formatCentsToBRL(minimumTotal)], ["Economia potencial", formatCentsToBRL(savings)],
      ["Rotas com oportunidade", opportunityCount], ["Rotas sem backup", noBackup], ["Dados insuficientes", insufficient],
    ];
    if (data.demoMode) {
      page.querySelector("#dashboard-demo-note").innerHTML = `<div class="demo-banner"><div><strong>Modo demonstração:</strong> valores e rotas ilustrativos, calculados localmente e não gravados no Firestore.${data.hasRealData ? " Seus dados reais continuam preservados no Firestore." : ""}</div><button id="use-real-data" type="button" class="button secondary">Usar dados do Firestore</button></div>`;
    } else if (data.demoAvailable) {
      page.querySelector("#dashboard-demo-note").innerHTML = `<div class="demo-banner"><div><strong>${data.hasRealData ? "Dados reais do Firestore" : "Firestore vazio"}:</strong> ${data.hasRealData ? "a exibição está usando seus registros persistidos." : "nada será gravado até você cadastrar ou importar dados."}</div><button id="use-demo-data" type="button" class="button secondary">Ver demonstração</button></div>`;
    }
    page.querySelector("#dashboard-metrics").innerHTML = metrics.map(([label, value]) => `<article class="metric-card" title="${escapeHtml(metricDescriptions[label])}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(metricDescriptions[label])}</small></article>`).join("");
    page.querySelector("#dashboard-guide").innerHTML = `<div><strong>Preço efetivo</strong><p>Usa o total informado; se não houver total, calcula os componentes selecionados da cotação.</p></div><div><strong>Economia por rota</strong><p>Maior entre zero e o custo oficial menos o menor custo válido. Rotas incompletas não geram economia potencial.</p></div><div><strong>Competitividade</strong><p>Oficial mais barata: competitiva; alternativa mais barata: oportunidade; diferença de até R$ 0,01: empate.</p></div><div><strong>Qualidade</strong><p>Confere oficial, backup, shipments, KM, NF, valores, validade e duplicidades.</p></div>`;
    page.querySelector("#dashboard-status").textContent = `Dados atualizados: ${new Date().toLocaleString("pt-BR")} · ${valid.length} comparação(ões) com cotação oficial${data.demoMode ? " · demonstração" : ""}.`;
    renderCharts(page.querySelector("#dashboard-charts"), data);
    page.querySelector("#dashboard-quality").innerHTML = comparisons.map((item) => `<tr><td>${escapeHtml(item.route.routeCode || item.route.id)}</td><td><span class="badge ${escapeHtml(item.quality.status)}">${escapeHtml(item.quality.status)}</span></td><td>${escapeHtml(item.quality.issues.join(", ") || "Nenhuma")}</td></tr>`).join("") || "<tr><td colspan='3'>Sem rotas para avaliar.</td></tr>";
  } catch (error) {
    page.querySelector("#dashboard-status").className = "error-text";
    page.querySelector("#dashboard-status").textContent = `Não foi possível carregar o dashboard: ${error.message}`;
  }
  page.querySelector("#dashboard-export").addEventListener("click", () => {
    if (!data) return notify("Não há dados carregados para exportar.", "error");
    try {
      exportWithMetadata("dashboard-fretes", "Dashboard", data.comparisons.map((item) => ({
        "Rota": item.route.routeCode || item.route.id,
        "Oficial (centavos)": item.official?.totalCents ?? null,
        "Menor custo (centavos)": item.bestOverall?.totalCents ?? null,
        "Economia (centavos)": item.savingsCents,
        "Competitividade": item.competitiveness,
        "Qualidade": item.quality.status,
        "Problemas": item.quality.issues.join("; "),
      })));
    } catch (error) { notify(error.message, "error"); }
  });
  page.querySelector("#use-real-data")?.addEventListener("click", () => {
    if (!window.confirm("Sair da demonstração e exibir os registros do Firestore?")) return;
    useRealDataMode();
    window.location.reload();
  });
  page.querySelector("#use-demo-data")?.addEventListener("click", () => {
    useDemoDataMode();
    window.location.reload();
  });
  return page;
}

function renderCharts(root, data) {
  const results = data.comparisons;
  const comparable = results.filter((item) => item.official && item.bestBackup);
  const opportunities = comparable.filter((item) => item.savingsCents > 0).sort((a, b) => b.savingsCents - a.savingsCents).slice(0, 10);
  const ranking = rankCarriers(results);
  const byVehicle = sumBy(results.filter((item) => item.savingsCents > 0), (item) => item.route.vehicleName || "Sem veículo");
  const byFlow = sumBy(results.filter((item) => item.savingsCents > 0), (item) => item.route.flowTypeName || "Sem fluxo");
  const evolution = [...sumBy(results.filter((item) => item.route.referenceDate && item.savingsCents > 0), (item) => item.route.referenceDate)].sort(([a], [b]) => a.localeCompare(b));
  const quality = countBy(results, (item) => item.quality.status);
  const labels = (items) => items.map((item) => item.route.routeCode || item.route.id);
  const money = (values) => values.map((value) => value / 100);
  const chartSpecs = [
    { title: "Top 10 oportunidades", description: "Rotas completas ordenadas pela maior diferença entre o preço oficial e a alternativa mais barata.", available: opportunities.length > 0, traces: [{ x: money(opportunities.map((item) => item.savingsCents)), y: labels(opportunities), type: "bar", orientation: "h", marker: { color: "#2878bd" } }], layout: { xaxis: { title: "Economia (R$)" } } },
    { title: "Economia por rota", description: "Economia potencial calculada individualmente por rota.", available: comparable.length > 0, traces: [{ x: labels(comparable), y: money(comparable.map((item) => item.savingsCents)), type: "bar", marker: { color: "#3d9b70" } }], layout: { xaxis: { tickangle: -30 } } },
    {
      title: "Oficial vs. melhor backup", description: "Compara o preço efetivo da nomeação com o menor preço entre as alternativas.", available: comparable.length > 0, traces: [
        { x: labels(comparable), y: money(comparable.map((item) => item.official.totalCents)), name: "Oficial", type: "bar" },
        { x: labels(comparable), y: money(comparable.map((item) => item.bestBackup.totalCents)), name: "Melhor backup", type: "bar" },
      ], layout: { barmode: "group", xaxis: { tickangle: -30 } }
    },
    { title: "Ranking de transportadoras", description: "Vitórias em comparações válidas; empate conta separadamente e não como vitória.", available: ranking.length > 0, traces: [{ x: ranking.map((item) => item.wins), y: ranking.map((item) => item.name), type: "bar", orientation: "h", marker: { color: "#2878bd" } }] },
    { title: "Taxa de vitórias", description: "Vitórias divididas pelo total de comparações válidas da transportadora.", available: ranking.length > 0, traces: [{ x: ranking.map((item) => item.name), y: ranking.map((item) => item.winRate), type: "bar", marker: { color: "#45a37a" } }], layout: { yaxis: { title: "%" } } },
    { title: "Economia por veículo", description: "Soma da economia potencial agrupada por tipo de veículo.", available: byVehicle.size > 0, traces: [{ x: [...byVehicle.keys()], y: money([...byVehicle.values()]), type: "bar" }] },
    { title: "Economia por fluxo", description: "Soma da economia potencial agrupada por tipo de fluxo.", available: byFlow.size > 0, traces: [{ x: [...byFlow.keys()], y: money([...byFlow.values()]), type: "bar" }] },
    { title: "Evolução temporal", description: "Economia potencial das rotas agrupada pela data de referência.", available: evolution.length > 0, traces: [{ x: evolution.map(([date]) => date), y: money(evolution.map(([, total]) => total)), type: "scatter", mode: "lines+markers" }] },
    { title: "Qualidade dos dados", description: "Quantidade de rotas por situação de qualidade.", available: quality.size > 0, traces: [{ labels: [...quality.keys()], values: [...quality.values()], type: "pie", hole: .45 }] },
  ];
  const charts = chartSpecs.filter((spec) => spec.available);
  if (!charts.length) {
    root.innerHTML = `<div class="panel empty-chart-state"><h3>Gráficos indisponíveis</h3><p>Cadastre rotas e cotações válidas para formar comparações. Gráficos sem dados não são exibidos.</p></div>`;
    return;
  }
  root.innerHTML = charts.map((spec, index) => `<article class="panel chart-card"><h3>${escapeHtml(spec.title)}</h3><p class="section-help">${escapeHtml(spec.description)}</p><div id="chart-${index}" class="plot"></div></article>`).join("");
  if (!window.Plotly) {
    root.querySelectorAll(".plot").forEach((plot) => { plot.textContent = "Plotly não carregou. Verifique a conexão."; });
    return;
  }
  charts.forEach((spec, index) => {
    window.Plotly.newPlot(root.querySelector(`#chart-${index}`), spec.traces, {
      margin: { t: 10, r: 12, b: 55, l: 58 }, autosize: true, paper_bgcolor: "transparent", plot_bgcolor: "transparent",
      font: { family: "Segoe UI, Arial", color: "#344054" }, ...spec.layout,
    }, { responsive: true, displayModeBar: false });
  });
}

function sumBy(items, key) {
  const values = new Map();
  for (const item of items) values.set(key(item), (values.get(key(item)) || 0) + (item.savingsCents || 0));
  return values;
}

function countBy(items, key) {
  const values = new Map();
  for (const item of items) values.set(key(item), (values.get(key(item)) || 0) + 1);
  return values;
}
