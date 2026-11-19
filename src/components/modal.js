export function modal(title, contentHtml, actions = []) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true">
      <header class="modal-header"><h2>${title}</h2><button class="icon-button" data-close aria-label="Fechar">×</button></header>
      <div class="modal-body">${contentHtml}<p class="modal-error" aria-live="polite"></p></div>
      <footer class="modal-actions"></footer>
    </section>`;
  const footer = overlay.querySelector(".modal-actions");
  actions.forEach(({ label, kind = "secondary", onClick }) => {
    const button = document.createElement("button");
    button.className = `button ${kind}`;
    button.textContent = label;
    button.addEventListener("click", async () => {
      try {
        if (await onClick?.()) close();
      } catch (error) {
        overlay.querySelector(".modal-error").textContent = error.message;
      }
    });
    footer.appendChild(button);
  });

  function close() {
    overlay.remove();
  }
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.body.appendChild(overlay);
  return { close };
}
