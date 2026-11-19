export function setLoading(active, message = "Carregando...") {
  let layer = document.querySelector("#loading");
  if (!active) {
    layer?.remove();
    return;
  }
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "loading";
    layer.className = "loading";
    document.body.appendChild(layer);
  }
  layer.textContent = message;
}
