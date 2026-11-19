import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { exportWithMetadata } from "../services/export-service.js";
import { formatAuditDate } from "../utils/dates.js";
import { escapeHtml } from "../utils/normalization.js";
import { notify } from "../components/notification.js";

export async function historyPage() {
  const page = document.createElement("main");
  page.className = "content";
  page.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Rastreabilidade</p><h2>Histórico de alterações</h2></div><button id="history-export" class="button secondary">Exportar XLSX</button></div>
    <section class="panel"><div class="filter-row">
      <input id="history-user" placeholder="Usuário"><input id="history-route" placeholder="Rota ou documento">
      <input id="history-carrier" placeholder="Transportadora"><select id="history-action"><option value="">Todas as ações</option>
      ${["CREATE","UPDATE","DELETE","RESTORE","IMPORT","SET_OFFICIAL","ADD_BACKUP","REMOVE_BACKUP","CREATE_CARRIER","CHANGE_USER"].map((item) => `<option>${item}</option>`).join("")}</select>
      <label>De <input id="history-from" type="date"></label><label>Até <input id="history-to" type="date"></label>
    </div><div class="table-wrap"><table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Rota</th><th>Transportadora</th><th>Documento</th><th>Alterações</th></tr></thead><tbody id="history-rows"><tr><td colspan="8">Carregando…</td></tr></tbody></table></div></section>`;
  const body = page.querySelector("#history-rows");
  let logs = [];
  let carrierNames = new Map();
  let filteredLogs = [];
  try {
    const [snapshot, carrierSnapshot] = await Promise.all([
      getDocs(query(collection(db, "auditLogs"), limit(1000))),
      getDocs(query(collection(db, "carriers"), limit(1000))),
    ]);
    logs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => timestamp(b) - timestamp(a));
    carrierNames = new Map(carrierSnapshot.docs.map((item) => [item.id, item.data().name]));
    render();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="8" class="error-cell">${escapeHtml(error.message)}</td></tr>`;
  }
  function render() {
    const user = page.querySelector("#history-user").value.toLocaleLowerCase();
    const route = page.querySelector("#history-route").value.toLocaleLowerCase();
    const carrier = page.querySelector("#history-carrier").value.toLocaleLowerCase();
    const action = page.querySelector("#history-action").value;
    const from = page.querySelector("#history-from").value;
    const to = page.querySelector("#history-to").value;
    filteredLogs = logs.filter((log) => {
      const date = new Date(timestamp(log));
      const dateOnly = Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
      return (!user || String(log.usuario || "").toLowerCase().includes(user))
        && (!route || `${log.routeCode || ""} ${log.routeId || ""} ${log.documentId || ""}`.toLowerCase().includes(route))
        && (!carrier || `${log.carrierId || ""} ${carrierNames.get(log.carrierId) || ""}`.toLowerCase().includes(carrier))
        && (!action || log.action === action) && (!from || dateOnly >= from) && (!to || dateOnly <= to);
    });
    body.innerHTML = filteredLogs.length ? filteredLogs.map((log) => `<tr><td>${formatAuditDate(log.timestamp)}</td><td>${escapeHtml(log.usuario || "—")}</td><td><span class="badge">${escapeHtml(log.action || "—")}</span></td><td>${escapeHtml(log.entity || "—")}</td><td>${escapeHtml(log.routeCode || log.routeId || "—")}</td><td>${escapeHtml(carrierNames.get(log.carrierId) || log.carrierId || "—")}</td><td>${escapeHtml(log.documentId || "—")}</td><td>${escapeHtml((log.changedFields || []).join(", ") || Object.keys(log.newValue || {}).slice(0, 5).join(", ") || "—")}</td></tr>`).join("") : "<tr><td colspan='8'>Nenhum registro corresponde aos filtros.</td></tr>";
  }
  page.querySelectorAll(".filter-row input, .filter-row select").forEach((input) => input.addEventListener("input", render));
  page.querySelector("#history-export").addEventListener("click", () => {
    try {
      exportWithMetadata("historico-fretes", "Histórico", filteredLogs.map((log) => ({
        Data: formatAuditDate(log.timestamp), Usuário: log.usuario, Ação: log.action,
        Entidade: log.entity, Documento: log.documentId, Rota: log.routeCode || log.routeId,
        Transportadora: log.carrierId, Campos: (log.changedFields || []).join(", "),
        Anterior: JSON.stringify(log.oldValue || {}), Novo: JSON.stringify(log.newValue || {}),
      })));
    } catch (error) { notify(error.message, "error"); }
  });
  return page;
}

function timestamp(log) {
  const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
