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
    <a class="brand" href="#/dashboard" aria-label="Fretes, ir para o Dashboard">
      <img
        class="brand-logo"
        src="data:image/webp;base64,UklGRpYHAABXRUJQVlA4IIoHAABQMgCdASrUAYcAPp1MoU0lpCOiIpDJqLATiWlu4XShDbNv65duH+W6Nv3LLvI//x/5d/Jj+A779q7/C7zGAD6Z/8f1Gpjquj5B6jH9z9B76j9DH1n7CP679YQXyM+hTAO839vw23ojNuEE+v/r0KYB3m/uHZn0KYAOvjnf8oSlObnm/uHZn0KUSl4Jl9z1ieGDgpVllq9ooXn2TP2y/azpo6gfWvkRD3lRr9w7M+hTAONCu99IGzYrsejTw/CnxU4gkKJm2pUNzgmVrsMb1+5EB3m/uHZn0KS+44c4d96nMw3PeYVywvHwtckYS3NxnCUEJEM1yTf/KPLe3PN/cOzN6JSOctXvKD4gQo4yKkqxzj6I8DZTqPQ3RZajasz6FMA7zf113B96sCy3WLbm+AapAanFm/PAHHvfqoA1V4MBz32G4Uqqb02rhgX3j2qvc6RLtU65X3MrKr0Ubc37+iY2KzPoUwDvN/Xc5c3w5uq2VSYSoolNaETVK1ZC43oyw3qRbL8qs1RTcOzPoUwDvN/cOzPoUwDvN/cOywAA/v9fQCDd/nFyUT5uol+/abuM5b07ft4i93upGj7vwMDrNbRWaECsGjcZJlkq/bJTtTk9scb2+Pyzts+6tJRTmDXdipG5lAS8VRd2+GgLBa753pOAQdPSX13uMN+COJobxgE+4UJcJxErzluMQqlYcTYj/zss5eX4yWCdVQ8H6GXWlTq8QHeOTbaWDjMGp//Ae8o8Tpn9F832soE37UPVGMvjPn+jxAfd3juGxX8voiqwXrKcyG2yow5bhbF4kbpFIhAAeVALEKPpitVRUIp1F9RjzZivRR95AZtdwfrwY77R5G2/SL7sggTC9H9PplhDvtRUeR04NE7oGxa7PDQ0Fe+DH5tMLWBQR9rtGsUoAa02OFGDATMCPdrd1PhkbbMPR22suHOMcNiY/I6bbhXcacas+TQQLI6nUhxPIZsfx6tVMRh1a1WQ4myGs5GgAia2fjPJ5dg2xdQTqgAp45ZNmi3totCp6K9miYCAd5YN8Om1MNfe50Q0VYpyHbGYaS2hZMla54s/5IQ7ovwD/zUAE210p3fOuSa09IbLs4gqBoR6wdmxN3UqchfMzjL0/TLlWGEOGqPJ787aWnHuxldoNp8zrRS8aTvSp/f6icTALaJ/ElVzZwoA7UCoymEDOiYglumepxslkN7lpqZkauusNPIjXKOwJypffHDKNuBHR2oieEs/IYLeVbPk0U7mBR8R58qFYpiKuxp9snAfD9UWM5o+xlo8mPFdjiTLpLmFj4eyQQX3XjMLU/GpLw/Hn8bbYgdU4zvOyq38THAqHBmvdOF4/mE4nBdjNmeKdTIzFOnWGVrhFUWo3kABDQzg2097FU8rJjHR5rAd9VowYMjqMHAhMO5byk0AX9pEvODklVP0wkCI9JQJUIkfrbE1ulLkN178ppVItV6LIUM9sPnm4nDENN/NV3QW3eJRzcVRWZ7x7+VDXBIZAYwYHdG1Yx4rFJAG5cEb/kNw/AygwuwhWeSSqEn4oie9pHZQ0rKiCwIZ9q+FBmezXXdSg0xkgJDulg0+t6NH5Pky63drup2ERGXPxbC5wyX7o0OmkuO0JfQzy+t7fb7DP/xv7q6nCQht3P03E2pe5slKdi8lrPm6VB5ckm1YyBfJ4iunT/2huccCH/Z8hUOLO2T/vRWuzgxcOFPCmJerS2fiH3yKVNs8Sd5SjAnujDp3yYbE7FBX+Npo59qlHrE4zROk6erwzFG2pn3pRGynUep/fizSw2hnB1OawEuXXks8KkoWffAqXrvW+zL5l8RwukaPOTXCheQe3NZnJCT5vibTnlpv/M4Wautl7cUhNDEjfsFBTgTWc6bMMpoKIJ8JpZmMwkv9aXAiNueR4dCSIVF82agv4KWYcqohFD5ixj43mpts22+sD9Xc/B7Ee2FitI8Dh5nNF0SfAbj/JKawh/OOZNJznN5Qo/k/cWr6R3Axf48btLhf3hNpnQHHCEoBPb4d4EeGsOm7q2YgDTPPzyJIvu+lV4UqR9yXTN5d/zQzkVnG84WtQ8fbunGwbTGj5BkKtX66iQNGWe0GYEL41i2jGBbDLcugb/hgxgwSzQKTUKsv5FCWq3iRU/+1ah79XcFjCaHKlVUBdmP+v1zT59vRDaeppXGCcAPlyaR0knnjSOMEHVHHvJvjP5oWyr9OojhYXATv8KBHv7YHeNyZuARZWyG0FZpU3AsyDsj7/i/58Q6qq3kaoXW90084A7Cr43gMtgL10qioGF6kK1Tz6L1PHWZJsi4rn7nbhNXv7ShHDMOGrJuycqVMb2Hcf71St56vpp1MDQbg39S9foYlmbwnpjdTbHwI+WuRWkAG3jJ1bjHzxV8t7QK3fH8zU5VaRzO6Hi5HQx+2Ts2khUVVtt86oqL+pb8R+/mTF1sO8YZ88wargjyZk7Ta6R5k2RfQhZTpzh24jpo0O5ONcikFab4EGlaq+Svj4wuc1fl4oL/0b7fGy5pFw/+aGcgd56fBOXkfqON4ejQ6JTNIofItAyC7RXOzEyrvAiiovJxqATG5AAAAAAAA"
        alt="Logo Fretes"
      />
      <strong>Fretes</strong>
    </a>

    <button
      class="nav-toggle"
      type="button"
      aria-expanded="false"
      aria-controls="primary-menu"
      aria-label="Abrir menu"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <nav
      id="primary-menu"
      class="nav-links"
      aria-label="Menu principal"
    >
      ${items
        .map(
          ([route, label]) =>
            `<a href="#/${route}" data-route="${route}">${label}</a>`
        )
        .join("")}
    </nav>
  `;

  const toggle = navigationBar.querySelector(".nav-toggle");
  const menu = navigationBar.querySelector("#primary-menu");

  const updateActiveLink = () => {
    const currentPath = (
      window.location.hash.slice(2) || "dashboard"
    ).replace(/\/$/, "");

    const activeRoute = items
      .map(([route]) => route)
      .filter(
        (route) =>
          currentPath === route ||
          currentPath.startsWith(`${route}/`)
      )
      .sort((a, b) => b.length - a.length)[0];

    menu.querySelectorAll("a").forEach((link) => {
      const active = link.dataset.route === activeRoute;

      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";

    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "Fechar menu" : "Abrir menu"
    );

    menu.classList.toggle("open", open);
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      updateActiveLink();
    }
  });

  window.addEventListener("hashchange", updateActiveLink);

  updateActiveLink();

  return navigationBar;
}