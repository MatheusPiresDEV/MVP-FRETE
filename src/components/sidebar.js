const items = [
  ["dashboard", "Dashboard"],
  ["rotas", "Rotas"],
  ["rotas/nova", "Nova rota"],
  ["importar", "Importar"],
  ["insights", "Insights"],
  ["transportadoras", "Transportadoras"],
  ["veiculos", "Veículos"],
  ["historico", "Histórico"],
  ["configuracoes", "Configurações"],
  ["sobre", "Sobre"],
];

export function renderSidebar() {
  const navigationBar = document.createElement("div");
  navigationBar.className = "top-nav";
  navigationBar.innerHTML = `
    <a class="brand" href="#/dashboard" aria-label="Fretes, ir para o Dashboard"><span>PI</span><strong>Fretes</strong></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Abrir menu">
      <span></span><span></span><span></span>
    </button>
    <nav id="primary-menu" class="nav-links" aria-label="Menu principal">
      ${items.map(([route, label]) => `<a href="#/${route}" data-route="${route}">${label}</a>`).join("")}
    </nav>`;

  const toggle = navigationBar.querySelector(".nav-toggle");
  const menu = navigationBar.querySelector("#primary-menu");
  const updateActiveLink = () => {
    const currentPath = (window.location.hash.slice(2) || "dashboard").replace(/\/$/, "");
    const activeRoute = items
      .map(([route]) => route)
      .filter((route) => currentPath === route || currentPath.startsWith(`${route}/`))
      .sort((a, b) => b.length - a.length)[0];
    menu.querySelectorAll("a").forEach((link) => {
      const active = link.dataset.route === activeRoute;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.classList.toggle("open", open);
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) updateActiveLink();
  });
  window.addEventListener("hashchange", updateActiveLink);
  updateActiveLink();
  return navigationBar;
}
