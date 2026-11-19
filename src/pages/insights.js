import { loadDataset } from "../services/data-service.js";
import { generateInsights } from "../services/insight-service.js";
import { rankCarriers } from "../services/analysis-service.js";
import { formatCentsToBRL } from "../utils/currency.js";
import { escapeHtml } from "../utils/normalization.js";
import { exportWithMetadata } from "../services/export-service.js";
import { notify } from "../components/notification.js";
import { enrichDataset } from "../services/route-view-service.js";

export async function insightsPage() {
  const page = document.createElement("main");
  page.className = "content";
  page.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Análise determinística</p><h2>Insights e ranking</h2></div><button id="insights-export" class="button secondary">Exportar XLSX</button></div><section class="insight-grid" id="insight-list"><p>Carregando dados do Firestore…</p></section><section class="panel"><h3>Ranking de transportadoras</h3><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Comparações</th><th>Vitórias</th><th>Empates</th><th>Derrotas</th><th>Vitórias %</th><th>Custo médio</th><th>Economia backup</th><th>Oficial</th><th>Melhor backup</th><th>Por veículo</th><th>Amostra</th></tr></thead><tbody id="ranking-rows"></tbody></table></div></section>`;
  let insights = [];
  let ranking = [];
  try {
    const dataset = await loadDataset();
    const enriched = enrichDataset(dataset);
    const comparisons = enriched.comparisons;
    insights = generateInsights(dataset);
    ranking = rankCarriers(comparisons);
    page.querySelector("#insight-list").innerHTML = `${dataset.demoMode ? `<p class="demo-banner"><strong>Modo demonstração:</strong> análises calculadas com registros ilustrativos.</p>` : ""}${insights.map((insight) => `<article class="panel insight-card ${escapeHtml(insight.type)}"><span>${escapeHtml(insight.type)}</span><p>${escapeHtml(insight.text)}</p></article>`).join("")}`;
    page.querySelector("#ranking-rows").innerHTML = ranking.length ? ranking.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.comparisons}</td><td>${item.wins}</td><td>${item.ties}</td><td>${item.losses}</td><td>${item.winRate.toFixed(1)}%</td><td>${formatCentsToBRL(item.averageCostCents)}</td><td>${formatCentsToBRL(item.savingsCents)}</td><td>${item.officialCount}</td><td>${item.backupWins}</td><td>${escapeHtml(Object.entries(item.byVehicle).map(([name, stats]) => `${name}: ${stats.wins}V/${stats.ties}E/${stats.losses}D`).join("; "))}</td><td>${item.reducedSample ? "Reduzida (<5)" : "Adequada"}</td></tr>`).join("") : "<tr><td colspan='12'>Sem dados suficientes para ranking.</td></tr>";
    page.querySelector("#insights-export").addEventListener("click", () => {
      try {
        const rows = [
          ...insights.map((item) => ({ Categoria: item.type, Insight: item.text })),
          ...ranking.map((item) => ({ Categoria: "ranking", Empresa: item.name, Comparações: item.comparisons, Vitórias: item.wins, Empates: item.ties, Derrotas: item.losses, "Vitórias %": item.winRate, "Custo médio (centavos)": item.averageCostCents, "Economia (centavos)": item.savingsCents, "Vezes oficial": item.officialCount, "Melhor backup": item.backupWins, "Por veículo": JSON.stringify(item.byVehicle) })),
        ];
        exportWithMetadata("insights-ranking", "Insights", rows);
      } catch (error) { notify(error.message, "error"); }
    });
  } catch (error) {
    page.querySelector("#insight-list").innerHTML = `<p class="error-text">Não foi possível gerar insights: ${escapeHtml(error.message)}</p>`;
  }
  return page;
}
