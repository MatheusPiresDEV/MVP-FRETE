import { getCurrentUserName } from "../utils/user.js";
import { escapeHtml } from "../utils/normalization.js";

export function renderHeader(online = navigator.onLine) {
  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `
    <div>
      <h1>Portal de Inteligência de Fretes | Fase de testes</h1>
      <span class="connection ${online ? "online" : "offline"}">${online ? "Conectado" : "Sem conexão"}</span>
    </div>
    <div class="header-actions">
      <span class="version">v0.2.0</span>
      <span class="current-user">Usuário: ${escapeHtml(getCurrentUserName() || "não informado")}</span>
      <button id="refresh-data" class="button secondary" type="button">Atualizar dados</button>
      <button id="switch-user" class="button secondary" type="button">Trocar usuário</button>
    </div>`;
  return header;
}
