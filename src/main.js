import { initializeAuth, getAuthUser } from "./firebase/auth.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderHeader } from "./components/header.js";
import { notify } from "./components/notification.js";
import { setLoading } from "./components/loading.js";
import { getCurrentUserName, saveCurrentUserName } from "./utils/user.js";
import { writeAuditLog } from "./firebase/audit.js";
import { registerRoute, startRouter } from "./router.js";
import { dashboardPage } from "./pages/dashboard.js";
import { routesPage } from "./pages/routes.js";
import { routeFormPage } from "./pages/route-form.js";
import { routeDetailsPage } from "./pages/route-details.js";
import { catalogPage, vehiclesPage } from "./pages/catalog.js";
import { importPage } from "./pages/import.js";
import { insightsPage } from "./pages/insights.js";
import { historyPage } from "./pages/history.js";
import { settingsPage } from "./pages/settings.js";
import { aboutPage } from "./pages/about.js";

const app = document.querySelector("#app");

registerRoute("dashboard", () => dashboardPage());
registerRoute("rotas", () => routesPage());
registerRoute("rotas/nova", () => routeFormPage());
registerRoute("rotas/:id/editar", (params) => routeFormPage(params));
registerRoute("rotas/:id", (params) => routeDetailsPage(params));
registerRoute("importar", () => importPage());
registerRoute("insights", () => insightsPage());
registerRoute("transportadoras", () => catalogPage("carriers", "Transportadoras"));
registerRoute("veiculos", () => vehiclesPage());
registerRoute("historico", () => historyPage());
registerRoute("configuracoes", () => settingsPage());
registerRoute("sobre", () => aboutPage());

async function boot() {
  setLoading(true, "Conectando ao Firebase...");
  try {
    await initializeAuth();
    setLoading(false);
  } catch (error) {
    setLoading(false);
    app.innerHTML = `<main class="auth-error"><h1>Não foi possível iniciar a autenticação</h1><p>${error.message}</p></main>`;
    return;
  }

  app.innerHTML = "";
  app.append(renderSidebar());
  const shell = document.createElement("div");
  shell.className = "app-shell";
  shell.append(renderHeader());
  const routerRoot = document.createElement("div");
  routerRoot.id = "router-root";
  shell.append(routerRoot);
  app.append(shell);
  app.insertAdjacentHTML("beforeend", "<div id='notifications'></div>");
  startRouter(routerRoot);

  document.querySelector("#refresh-data").addEventListener("click", () => {
    window.location.reload();
  });
  document.querySelector("#switch-user").addEventListener("click", async () => {
    const value = window.prompt("Informe o nome do usuário atual.", getCurrentUserName());
    if (value === null) return;
    try {
      const name = saveCurrentUserName(value);
      const user = getAuthUser();
      await writeAuditLog({
        uid: user?.uid,
        usuario: name,
        action: "CHANGE_USER",
        entity: "user",
        origin: "interface",
      });
      document.querySelector(".current-user").textContent = `Usuário: ${name}`;
      notify("Usuário de auditoria alterado.", "success");
    } catch (error) {
      notify(error.message, "error");
    }
  });

  window.addEventListener("offline", () => {
    document.querySelector(".connection")?.classList.remove("online");
    document.querySelector(".connection")?.classList.add("offline");
    if (document.querySelector(".connection")) document.querySelector(".connection").textContent = "Sem conexão";
    notify("Sem conexão. Gravações estão bloqueadas.", "error");
  });
  window.addEventListener("online", () => {
    document.querySelector(".connection")?.classList.remove("offline");
    document.querySelector(".connection")?.classList.add("online");
    if (document.querySelector(".connection")) document.querySelector(".connection").textContent = "Conectado";
    notify("Conexão restaurada.", "success");
  });
}

boot();
