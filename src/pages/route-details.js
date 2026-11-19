import { getEntity, loadDataset, setEntityDeleted, saveRouteBundle } from "../services/data-service.js";
import { compareRoute } from "../services/analysis-service.js";
import { calculateQuote } from "../services/calculation-service.js";
import { formatCentsToBRL } from "../utils/currency.js";
import { escapeHtml } from "../utils/normalization.js";
import { formatAuditDate } from "../utils/dates.js";
import { notify } from "../components/notification.js";
import { assessRouteQuality } from "../services/quality-service.js";

export async function routeDetailsPage({ id } = {}) {
  const page = document.createElement("main");
  page.className = "content";
  try {
    const dataset = await loadDataset();
    const route = await getEntity("routes", id);
    if (!route) throw new Error("Rota não encontrada.");
    const quotes = dataset.quotesByRoute[id] || [];
    const result = compareRoute(route, quotes);
    const quality = assessRouteQuality(route, quotes, dataset.routes, dataset.carriers);
    const savings = quality.status === "completo" ? result.savingsCents : 0;
    const competitiveness = quality.status === "completo" ? result.competitiveness : "Dados insuficientes";
    page.innerHTML = `
      ${dataset.demoMode ? `<p class="demo-banner"><strong>Modo demonstração:</strong> rota e cotações ilustrativas; somente leitura.</p>` : ""}
      <div class="page-heading"><div><p class="eyebrow">Detalhes da rota</p><h2>${escapeHtml(route.routeCode || id)}</h2></div>
      <div class="toolbar">${dataset.demoMode ? "" : route.deletedAt ? `<button class="button primary" id="restore-route">Restaurar</button>` : `<a class="button primary" href="#/rotas/${encodeURIComponent(id)}/editar">Editar rota</a><button class="button secondary" id="duplicate-route">Duplicar</button><button class="button danger" id="delete-route">Excluir</button>`}</div></div>
      <section class="metric-grid">
        <article class="metric-card"><span>Custo oficial</span><strong>${formatCentsToBRL(result.official?.totalCents)}</strong></article>
        <article class="metric-card"><span>Melhor backup</span><strong>${formatCentsToBRL(result.bestBackup?.totalCents)}</strong></article>
        <article class="metric-card"><span>Economia potencial</span><strong>${formatCentsToBRL(savings)}</strong></article>
        <article class="metric-card"><span>Competitividade</span><strong>${escapeHtml(competitiveness)}</strong></article>
      </section>
      <section class="panel"><h3>Dados da rota</h3><div class="detail-grid">${detail("Origem",route.origin)}${detail("Destino",route.destination)}${detail("Veículo",route.vehicleName)}${detail("Fluxo",route.flowTypeName)}${detail("Shipments",route.shipments)}${detail("Média KM",route.averageKm)}${detail("Média NF",formatCentsToBRL(route.averageNf))}${detail("Referência",route.referenceDate)}${detail("Status",route.status)}${detail("Qualidade",quality.status)}${detail("Observações",route.notes)}</div>
      <p class="audit-line">Adicionado por: ${escapeHtml(route.createdByName || "—")} em ${formatAuditDate(route.createdAt)}</p><p class="audit-line">Última alteração por: ${escapeHtml(route.updatedByName || route.createdByName || "—")} em ${formatAuditDate(route.updatedAt || route.createdAt)}</p><p class="audit-line"><a href="#/historico">Ver histórico completo</a></p></section>
      <section class="panel"><h3>Cotações e composição</h3><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Tipo</th><th>Disponibilidade</th><th>Calculado</th><th>Informado</th><th>Efetivo</th><th>Validade</th><th>Fórmula / componentes</th></tr></thead><tbody>
      ${quotes.length ? quotes.map((quote) => {
        const calc = calculateQuote(quote, route);
        return `<tr><td>${escapeHtml(quote.carrierName || "—")}</td><td>${quote.isOfficial ? "Oficial" : "Backup"}</td><td>${quote.available === false ? "Indisponível" : "Disponível"}</td><td>${formatCentsToBRL(calc.calculatedCents)}</td><td>${formatCentsToBRL(calc.informedCents)}</td><td>${formatCentsToBRL(calc.effectiveCents)}</td><td>${escapeHtml(quote.validUntil || "—")}</td><td>${escapeHtml(calc.formula)}<br><small>Incluídos: ${escapeHtml(calc.includedComponents.join(", "))}<br>Excluídos: ${escapeHtml(calc.excludedComponents.join(", "))}</small></td></tr>`;
      }).join("") : "<tr><td colspan='8'>Nenhuma cotação.</td></tr>"}</tbody></table></div></section>`;
    page.querySelector("#delete-route")?.addEventListener("click", async () => {
      if (!confirm("Excluir esta rota? É possível restaurá-la depois.")) return;
      try { await setEntityDeleted("routes", id, true, route); notify("Rota excluída.", "success"); window.location.hash = "#/rotas"; }
      catch (error) { notify(error.message, "error"); }
    });
    page.querySelector("#restore-route")?.addEventListener("click", async () => {
      try { await setEntityDeleted("routes", id, false, route); notify("Rota restaurada.", "success"); window.location.reload(); }
      catch (error) { notify(error.message, "error"); }
    });
    page.querySelector("#duplicate-route")?.addEventListener("click", async () => {
      try {
        const copy = { ...route, routeCode: `${route.routeCode || "Rota"} - cópia`, status: "dados incompletos" };
        delete copy.id; delete copy.revision; delete copy.createdAt; delete copy.createdByName; delete copy.createdByUid;
        const saved = await saveRouteBundle(null, 0, copy, quotes.map(({ id: quoteId, ...quote }) => ({ ...quote, isOfficial: quote.isOfficial })), []);
        notify("Rota duplicada.", "success");
        window.location.hash = `#/rotas/${encodeURIComponent(saved.id)}/editar`;
      } catch (error) { notify(error.message, "error"); }
    });
  } catch (error) {
    page.innerHTML = `<section class="panel"><h2>Erro ao carregar rota</h2><p>${escapeHtml(error.message)}</p><a href="#/rotas">Voltar</a></section>`;
  }
  return page;
}

function detail(label, value) {
  return `<div><span>${label}</span><strong>${escapeHtml(value ?? "—")}</strong></div>`;
}
