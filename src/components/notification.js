export function notify(message, type = "info") {
  const root = document.querySelector("#notifications") || document.body;
  const item = document.createElement("div");
  item.className = `notification ${type}`;
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 5000);
}
