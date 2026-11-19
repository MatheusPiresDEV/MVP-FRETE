import { loadDataset, readDeletedRoutes, setEntityDeleted } from "../services/data-service.js";
import { enrichDataset } from "../services/route-view-service.js";
import { formatCentsToBRL } from "../utils/currency.js";
import { escapeHtml } from "../utils/normalization.js";
import { notify } from "../components/notification.js";
import { exportWithMetadata } from "../services/export-service.js";

export async function routesPage() {
  const page = document.createElement("main");
  page.className = "content";
  page.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Operação</p><h2>Rotas</h2></div>
      <div class="toolbar"><button class="button secondary" id="show-deleted">Excluídas</button><button class="button secondary" id="export-routes">Exportar XLSX</button><a class="button primary" id="new-route-link" href="#/rotas/nova">Nova rota</a></div>
    </div>
    <div id="route-demo-note"></div>
    <section class="panel"><div class="filter-row"><input id="route-filter" placeholder="Filtrar código, origem, destino ou veículo"><select id="quality-filter"><option value="">Todas as qualidades</option><option>completo</option><option>atenção</option><option>incompleto</option><option>inválido</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>Rota</th><th>Origem → Destino</th><th>Veículo</th><th>Oficial</th><th>Melhor alternativa</th><th>Economia</th><th>Qualidade</th><th>Ações</th></tr></thead><tbody id="route-rows"><tr><td colspan="8">Carregando dados do Firestore…</td></tr></tbody></table></div></section>`;
  const rowsRoot = page.querySelector("#route-rows");
  let rows = [];
  let displayedRows = [];
  let deletedRows = [];
  let showingDeleted = false;
  let demoMode = false;
  try {
    const dataset = enrichDataset(await loadDataset());
    demoMode = dataset.demoMode === true;
    if (demoMode) {
      page.querySelector("#route-demo-note").innerHTML = `<p class="demo-banner"><strong>Modo demonstração:</strong> rotas e cotações ilustrativas; nenhuma alteração será gravada.</p>`;
      page.querySelector("#show-deleted").hidden = true;
      page.querySelector("#new-route-link").setAttribute("aria-disabled", "true");
      page.querySelector("#new-route-link").classList.add("disabled-link");
    }
    rows = dataset.comparisons;
    deletedRows = await readDeletedRoutes();
    renderRows();
  } catch (error) {
    rowsRoot.innerHTML = `<tr><td colspan="8" class="error-cell">${escapeHtml(error.message)}</td></tr>`;
  }
  function renderRows() {
    const filter = page.querySelector("#route-filter").value.toLocaleLowerCase();
    const quality = page.querySelector("#quality-filter").value;
    const filtered = showingDeleted
      ? deletedRows.filter((route) => [route.routeCode, route.origin, route.destination, route.vehicleName].join(" ").toLocaleLowerCase().includes(filter))
      : rows.filter((item) => {
      const route = item.route;
      const text = [route.routeCode, route.origin, route.destination, route.vehicleName].join(" ").toLocaleLowerCase();
      return text.includes(filter) && (!quality || item.quality.status === quality);
    });
    rowsRoot.innerHTML = filtered.length ? filtered.map((item) => showingDeleted ? `
      <tr><td><a href="#/rotas/${encodeURIComponent(item.id)}">${escapeHtml(item.routeCode || item.id)}</a></td>
      <td>${escapeHtml(item.origin || "—")} → ${escapeHtml(item.destination || "—")}</td><td>${escapeHtml(item.vehicleName || "—")}</td>
      <td colspan="3">Excluída em ${item.deletedAt?.toDate ? item.deletedAt.toDate().toLocaleString("pt-BR") : "data indisponível"}</td><td>—</td>
      <td><button type="button" data-restore="${escapeHtml(item.id)}">Restaurar</button></td></tr>` : `
      <tr>
        <td><a href="#/rotas/${encodeURIComponent(item.route.id)}">${escapeHtml(item.route.routeCode || item.route.id)}</a></td>
        <td>${escapeHtml(item.route.origin || "—")} → ${escapeHtml(item.route.destination || "—")}</td>
        <td>${escapeHtml(item.route.vehicleName || "—")}</td>
        <td>${escapeHtml(item.official?.carrierName || "Sem oficial")}<br>${formatCentsToBRL(item.official?.totalCents)}</td>
        <td>${escapeHtml(item.bestBackup?.carrierName || "—")}<br>${formatCentsToBRL(item.bestBackup?.totalCents)}</td>
        <td>${formatCentsToBRL(item.savingsCents)}</td><td><span class="badge ${item.quality.status}">${escapeHtml(item.quality.status)}</span></td>
        <td class="actions">${demoMode ? `<a href="#/rotas/${encodeURIComponent(item.route.id)}">Ver detalhes</a>` : `<a href="#/rotas/${encodeURIComponent(item.route.id)}/editar">Editar</a><button type="button" data-delete="${escapeHtml(item.route.id)}">Excluir</button>`}</td>
      </tr>`).join("") : `<tr><td colspan='8'>Nenhuma rota ${showingDeleted ? "excluída" : "encontrada"} no Firestore.</td></tr>`;
    displayedRows = filtered;
  }
  page.querySelector("#show-deleted").addEventListener("click", (event) => {
    showingDeleted = !showingDeleted;
    event.currentTarget.textContent = showingDeleted ? "Voltar às ativas" : "Excluídas";
    page.querySelector("#quality-filter").disabled = showingDeleted;
    renderRows();
  });
  page.querySelector("#route-filter").addEventListener("input", renderRows);
  page.querySelector("#quality-filter").addEventListener("change", renderRows);
  page.querySelector("#export-routes").addEventListener("click", () => {
    try {
      const filter = page.querySelector("#route-filter").value;
      exportWithMetadata("rotas", "Rotas", displayedRows.map((item) => showingDeleted ? ({
        "ID": item.id, "Código": item.routeCode, "Origem": item.origin, "Destino": item.destination,
        "Veículo": item.vehicleName, "Status": "Excluída",
      }) : ({
        "ID": item.route.id, "Código": item.route.routeCode, "Origem": item.route.origin,
        "Destino": item.route.destination, "Veículo": item.route.vehicleName,
        "Transportadora oficial": item.official?.carrierName, "Custo oficial (centavos)": item.official?.totalCents,
        "Melhor backup": item.bestBackup?.carrierName, "Melhor backup (centavos)": item.bestBackup?.totalCents,
        "Economia (centavos)": item.savingsCents, "Qualidade": item.quality.status, "Problemas": item.quality.issues.join("; "),
      })), { filtro: filter, qualidade: page.querySelector("#quality-filter").value });
    } catch (error) { notify(error.message, "error"); }
  });
  rowsRoot.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    if (!window.confirm("Excluir esta rota? Ela poderá ser restaurada pelo histórico de excluídos.")) return;
    try {
      await setEntityDeleted("routes", button.dataset.delete, true);
      notify("Rota excluída.", "success");
      window.location.reload();
    } catch (error) { notify(error.message, "error"); }
  });
  rowsRoot.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-restore]");
    if (!button) return;
    try {
      await setEntityDeleted("routes", button.dataset.restore, false);
      notify("Rota restaurada.", "success");
      window.location.reload();
    } catch (error) { notify(error.message, "error"); }
  });
  return page;
}
