import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { loadDataset, saveEntity } from "../services/data-service.js";
import { normalizeName, escapeHtml } from "../utils/normalization.js";
import { notify } from "../components/notification.js";
import { showFormModal } from "../components/form-modal.js";

export async function catalogPage(collectionName, title) {
  const page = document.createElement("main");
  page.className = "content";
  page.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Cadastros dinâmicos</p><h2>${title}</h2></div><button id="new-item" class="button primary">Cadastrar</button></div>
    <section class="panel"><div class="filter-row"><input id="catalog-search" placeholder="Buscar"><select id="catalog-status"><option value="">Ativos e inativos</option><option value="true">Ativos</option><option value="false">Inativos</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Código</th><th>Status</th><th>Atualizado por</th><th>Ações</th></tr></thead><tbody id="catalog-rows"><tr><td colspan="5">Carregando…</td></tr></tbody></table></div></section>`;
  const body = page.querySelector("#catalog-rows");
  let dataset;
  const read = async () => {
    dataset = await loadDataset();
    if (dataset.demoMode) {
      if (collectionName === "carriers") return dataset.carriers;
      if (collectionName === "vehicles") return dataset.vehicles;
      return dataset.flowTypes;
    }
    const snapshot = await getDocs(query(collection(db, collectionName), limit(1000)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  };
  let items = [];
  async function refresh() {
    try {
      items = await read();
      page.querySelector("#new-item").disabled = dataset.demoMode === true;
      if (dataset.demoMode) {
        page.querySelector(".page-heading").insertAdjacentHTML("afterend", `<p class="demo-banner"><strong>Modo demonstração:</strong> cadastros ilustrativos e somente para leitura.</p>`);
      }
      render();
    } catch (error) {
      body.innerHTML = `<tr><td colspan="5" class="error-cell">${escapeHtml(error.message)}</td></tr>`;
    }
  }
  function render() {
    const search = normalizeName(page.querySelector("#catalog-search").value);
    const active = page.querySelector("#catalog-status").value;
    const filtered = items.filter((item) => normalizeName(item.name).includes(search)
      && (active === "" || String(item.active !== false) === active));
    body.innerHTML = filtered.length ? filtered.map((item) => `
      <tr><td>${escapeHtml(item.name || "")}</td><td>${escapeHtml(item.code || "—")}</td>
      <td><span class="badge ${item.active === false ? "inativo" : "completo"}">${item.active === false ? "Inativo" : "Ativo"}</span></td>
      <td>${escapeHtml(item.updatedByName || item.createdByName || "—")}</td>
      <td class="actions">${dataset.demoMode ? "Demonstração" : `<button type="button" data-edit="${escapeHtml(item.id)}">Editar</button><button type="button" data-toggle="${escapeHtml(item.id)}">${item.active === false ? "Reativar" : "Inativar"}</button>`}</td></tr>`).join("")
      : "<tr><td colspan='5'>Nenhum registro cadastrado no Firestore.</td></tr>";
  }
  function form(item = {}) {
    showFormModal({
      title: item.id ? `Editar ${title.toLowerCase()}` : `Cadastrar ${title.toLowerCase()}`,
      fields: [
        { name: "name", label: "Nome", required: true },
        { name: "code", label: "Código (opcional)" },
        { name: "notes", label: "Observações" },
      ],
      values: item,
      onSave: async (values) => {
        const normalizedName = normalizeName(values.name);
        const duplicate = items.find((other) => other.id !== item.id
          && (other.normalizedName || normalizeName(other.name)) === normalizedName);
        if (duplicate) throw new Error(`Já existe um cadastro correspondente: ${duplicate.name}.`);
        await saveEntity(collectionName, item.id || null, {
          name: values.name.trim().replace(/\s+/g, " "), normalizedName,
          code: values.code.trim(), notes: values.notes.trim(), active: item.active !== false,
        }, item.id ? "UPDATE" : collectionName === "carriers" ? "CREATE_CARRIER" : "CREATE", item.revision ?? 0);
        notify("Cadastro salvo no Firestore.", "success");
        await refresh();
      },
    });
  }
  page.querySelector("#new-item").addEventListener("click", () => form());
  page.querySelector("#catalog-search").addEventListener("input", render);
  page.querySelector("#catalog-status").addEventListener("change", render);
  body.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit]");
    const toggle = event.target.closest("[data-toggle]");
    if (edit) form(items.find((item) => item.id === edit.dataset.edit));
    if (toggle) {
      const item = items.find((value) => value.id === toggle.dataset.toggle);
      try {
        await saveEntity(collectionName, item.id, { active: item.active === false, name: item.name, normalizedName: item.normalizedName || normalizeName(item.name), code: item.code || "", notes: item.notes || "" }, "UPDATE", item.revision ?? 0);
        await refresh();
        notify(item.active === false ? "Cadastro reativado." : "Cadastro inativado.", "success");
      } catch (error) { notify(error.message, "error"); }
    }
  });
  await refresh();
  return page;
}

export async function vehiclesPage() {
  const page = await catalogPage("vehicles", "Veículos");
  const flow = await catalogPage("flowTypes", "Tipos de fluxo");
  const wrapper = document.createElement("div");
  wrapper.append(page, flow);
  return wrapper;
}
