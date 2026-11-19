const routes = {};

export function registerRoute(pattern, loader) {
  routes[pattern] = loader;
}

function matchRoute(path) {
  const exact = routes[path];
  if (exact) return { loader: exact, params: {} };
  for (const [pattern, loader] of Object.entries(routes)) {
    const names = [...pattern.matchAll(/:([a-zA-Z]+)/g)].map((match) => match[1]);
    const regex = new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, "([^/]+)")}$`);
    const match = path.match(regex);
    if (match) {
      const params = Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
      return { loader, params };
    }
  }
  return null;
}

export function startRouter(root) {
  async function render() {
    const path = (window.location.hash.slice(2) || "dashboard").replace(/\/$/, "");
    const match = matchRoute(path);
    if (!match) {
      root.innerHTML = "<main class='content'><h2>Página não encontrada</h2></main>";
      window.history.replaceState(null, "", "#/dashboard");
      return;
    }
    root.innerHTML = "";
    const page = await match.loader(match.params);
    root.appendChild(page);
  }
  window.addEventListener("hashchange", render);
  render();
  return render;
}
