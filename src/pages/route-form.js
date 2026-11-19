import { loadDataset, getEntity, saveRouteBundle, saveEntity } from "../services/data-service.js";
import { calculateQuote } from "../services/calculation-service.js";
import { parseCurrencyToCents, formatCentsToBRL } from "../utils/currency.js";
import { parsePercentageToBasisPoints } from "../utils/percentage.js";
import { normalizeName, escapeHtml } from "../utils/normalization.js";
import { notify } from "../components/notification.js";
import { modal } from "../components/modal.js";

const routeFields = [
  ["routeCode", "Código da rota"], ["description", "Descrição"], ["origin", "Origem"],
  ["destination", "Destino"], ["vehicleName", "Veículo"], ["flowTypeName", "Tipo de fluxo"],
  ["shipments", "Contagem de shipments", "number"], ["averageKm", "Média KM", "number"],
  ["averageNf", "Média NF (R$)", "text"], ["referenceDate", "Data de referência", "date"],
  ["status", "Status"], ["routeNotes", "Observações", "textarea"],
];

export async function routeFormPage({ id } = {}) {
  const routeId = id || null;
  const page = document.createElement("main");
  page.className = "content";
  let dataset;
  let currentRoute = null;
  let currentQuotes = [];
  try {
    dataset = await loadDataset();
    if (routeId) {
      currentRoute = await getEntity("routes", routeId);
      if (!currentRoute || currentRoute.deletedAt) throw new Error("Rota não encontrada ou excluída.");
      currentQuotes = dataset.quotesByRoute[routeId] || [];
    }
  } catch (error) {
    page.innerHTML = `<section class="panel"><h2>Não foi possível abrir o formulário</h2><p>${escapeHtml(error.message)}</p></section>`;
    return page;
  }
  if (dataset.demoMode) {
    page.innerHTML = `<section class="panel"><p class="eyebrow">Somente leitura</p><h2>Modo demonstração</h2><p>Os registros mostrados são ilustrativos e não podem ser alterados. Importe uma planilha ou cadastre dados reais no Firestore para habilitar gravações.</p><a class="button secondary" href="#/rotas">Voltar às rotas</a></section>`;
    return page;
  }
  page.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Cadastro de rota</p><h2>${routeId ? "Editar rota" : "Nova rota"}</h2></div><a href="#/rotas" class="button secondary">Voltar às rotas</a></div>
    <form id="route-form">
      <section class="panel"><h3>Dados da rota</h3><div class="form-grid">
        ${routeFields.map(([name, label, type = "text"]) => {
          const valueKey = name === "routeNotes" ? "notes" : name;
          const stored = currentRoute?.[valueKey] ?? (name === "status" ? "ativo" : "");
          const value = name === "averageNf" && Number.isSafeInteger(stored) ? stored / 100 : stored;
          return `<label class="form-field">${label}${type === "textarea"
            ? `<textarea name="${name}" rows="3">${escapeHtml(value || "")}</textarea>`
            : `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${name === "averageKm" || name === "shipments" ? 'step="any"' : ""}>`}</label>`;
        }).join("")}
      </div></section>
      <section class="panel quotes-panel"><div class="section-heading"><div><h3>Cotações</h3><p>Valores de moeda inseridos em reais; os dados são gravados em centavos.</p></div><button type="button" id="add-quote" class="button secondary">Adicionar backup</button></div>
        <div id="quotes-editor"></div>
      </section>
      <div class="form-footer"><p class="form-error" id="form-error" aria-live="polite"></p><button class="button primary" type="submit">Salvar rota e cotações</button></div>
    </form>`;
  const editor = page.querySelector("#quotes-editor");
  function updateQuotePreviews() {
    const form = page.querySelector("#route-form");
    const shipmentsValue = form.querySelector("[name=shipments]").value;
    const kmValue = form.querySelector("[name=averageKm]").value;
    const route = {
      shipments: shipmentsValue === "" ? null : Number(shipmentsValue),
      averageKm: kmValue === "" ? null : Number(kmValue),
    };
    for (const quoteCard of editor.querySelectorAll(".quote-card")) {
      const calculation = calculateQuote(readQuoteCard(quoteCard), route);
      quoteCard.querySelector("[data-total-preview]").textContent =
        `Calculado: ${formatCentsToBRL(calculation.calculatedCents)} · Informado: ${formatCentsToBRL(calculation.informedCents)} · Efetivo: ${formatCentsToBRL(calculation.effectiveCents)} · Incluídos: ${calculation.includedComponents.join(", ")} · Excluídos: ${calculation.excludedComponents.join(", ")}`;
    }
  }
  const initial = currentQuotes.length ? currentQuotes : [{ isOfficial: true, available: true }];
  initial.forEach((quote) => editor.append(createQuoteEditor(quote, dataset.carriers)));
  page.querySelector("#route-form").addEventListener("input", updateQuotePreviews);
  editor.addEventListener("input", updateQuotePreviews);
  editor.addEventListener("change", updateQuotePreviews);
  updateQuotePreviews();
  page.querySelector("#add-quote").addEventListener("click", () => {
    editor.append(createQuoteEditor({ isOfficial: false, available: true }, dataset.carriers));
    updateQuotePreviews();
  });
  editor.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-quote]");
    if (remove) remove.closest(".quote-card").remove();
    const duplicate = event.target.closest("[data-duplicate-quote]");
    if (duplicate) {
      const card = duplicate.closest(".quote-card");
      const values = readQuoteCard(card);
      values.id = undefined;
      values.isOfficial = false;
      editor.append(createQuoteEditor(values, dataset.carriers));
    }
  });
  page.querySelector("#route-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = page.querySelector("[type=submit]");
    submit.disabled = true;
    const errorRoot = page.querySelector("#form-error");
    errorRoot.textContent = "";
    try {
      const form = event.currentTarget;
      const fields = Object.fromEntries(new FormData(form).entries());
      const route = {
        routeCode: fields.routeCode.trim(), description: fields.description.trim(),
        origin: fields.origin.trim(), destination: fields.destination.trim(),
        vehicleName: fields.vehicleName.trim(), flowTypeName: fields.flowTypeName.trim(),
        shipments: fields.shipments === "" ? null : Number(fields.shipments),
        averageKm: fields.averageKm === "" ? null : Number(fields.averageKm),
        averageNf: fields.averageNf === "" ? null : parseCurrencyToCents(fields.averageNf),
        referenceDate: fields.referenceDate || null,         status: fields.status.trim() || "ativo",
        notes: fields.routeNotes.trim(),
      };
      if (!Number.isFinite(route.shipments)) route.shipments = null;
      if (!Number.isFinite(route.averageKm)) route.averageKm = null;
      route.vehicleId = await ensureCatalogEntity(dataset.vehicles, "vehicles", route.vehicleName);
      route.flowTypeId = await ensureCatalogEntity(dataset.flowTypes, "flowTypes", route.flowTypeName);
      const quotes = [];
      for (const card of editor.querySelectorAll(".quote-card")) {
        const quote = readQuoteCard(card);
        if (!quote.carrierName) throw new Error("Informe a transportadora de cada cotação.");
        quote.carrierId = await ensureCatalogEntity(dataset.carriers, "carriers", quote.carrierName);
        const cost = calculateQuote(quote, route);
        quote.calculatedCents = cost.calculatedCents;
        quote.totalCents = quote.informedTotalCents ?? cost.calculatedCents;
        if (!Number.isSafeInteger(quote.totalCents)) quote.totalCents = null;
        quotes.push(quote);
      }
      if (quotes.filter((quote) => quote.isOfficial).length > 1) throw new Error("Só pode haver uma transportadora oficial na rota.");
      const saved = await saveRouteBundle(routeId, currentRoute?.revision || 0, route, quotes, currentQuotes);
      notify("Rota salva no Firestore.", "success");
      window.location.hash = `#/rotas/${encodeURIComponent(saved.id)}`;
    } catch (error) {
      if (error.message === "CONFLICTO_REVISAO") {
        try { await showRevisionConflict(routeId, page, editor); }
        catch (conflictError) { errorRoot.textContent = `Conflito detectado. Não foi possível carregar a versão atual: ${conflictError.message}`; }
      } else errorRoot.textContent = error.message;
      submit.disabled = false;
    }
  });
  return page;
}

function createQuoteEditor(quote, carriers) {
  const card = document.createElement("article");
  card.className = "quote-card";
  const extraText = (quote.extraCosts || []).map((item) => `${item.label}:${item.amountCents / 100}`).join(", ");
  card.dataset.quoteId = quote.id || "";
  card.innerHTML = `
    <div class="quote-title"><strong>${quote.isOfficial ? "Transportadora oficial" : "Cotação backup"}</strong>
      <div><button type="button" class="button small" data-duplicate-quote>Duplicar</button><button type="button" class="button small danger-text" data-remove-quote>Remover</button></div></div>
    <label class="form-field">Transportadora<input name="carrierName" list="carrier-options" value="${escapeHtml(quote.carrierName || "")}" required></label>
    <datalist id="carrier-options">${carriers.map((carrier) => `<option value="${escapeHtml(carrier.name)}">`).join("")}</datalist>
    <div class="form-grid compact">
      <label class="form-field">Papel<select name="isOfficial"><option value="false" ${quote.isOfficial ? "" : "selected"}>Backup</option><option value="true" ${quote.isOfficial ? "selected" : ""}>Oficial</option></select></label>
      <label class="form-field">Disponibilidade<select name="available"><option value="true" ${quote.available === false ? "" : "selected"}>Disponível</option><option value="false" ${quote.available === false ? "selected" : ""}>Indisponível</option></select></label>
      <label class="form-field">Custo por viagem (R$)<input name="costPerTrip" inputmode="decimal" value="${formatInputCents(quote.costPerTripCents)}"></label>
      <label class="form-field">Custo fixo (R$)<input name="fixedCost" inputmode="decimal" value="${formatInputCents(quote.fixedCostCents)}"></label>
      <label class="form-field">Custo por KM (R$)<input name="costPerKm" inputmode="decimal" value="${formatInputCents(quote.costPerKmCents)}"></label>
      <label class="form-field">Seguro (%)<input name="insuranceRate" inputmode="decimal" value="${quote.insuranceBps == null ? "" : String(quote.insuranceBps / 100).replace(".", ",")}"></label>
      <label class="form-field">Valor segurado (R$)<input name="insuredValue" inputmode="decimal" value="${formatInputCents(quote.insuredValueCents)}"></label>
      <label class="form-field">Total informado (R$)<input name="informedTotal" inputmode="decimal" value="${formatInputCents(quote.informedTotalCents)}"></label>
      <label class="form-field">Validade<input name="validUntil" type="date" value="${escapeHtml(quote.validUntil || "")}"></label>
      <label class="form-field">Data da cotação<input name="quoteDate" type="date" value="${escapeHtml(quote.quoteDate || "")}"></label>
    </div>
    <label class="form-field">Custos extras (descrição:valor separados por vírgula)<input name="extraCosts" value="${escapeHtml(extraText)}" placeholder="Pedágio:120, Taxa:80"></label>
    <div class="check-grid">
      ${[["includeTravel","Incluir custo por viagem",quote.includeTravel !== false],["includeFixed","Incluir custo fixo",quote.includeFixed === true],["includeDistance","Incluir custo por KM",quote.includeDistance === true],["includeInsurance","Incluir seguro calculado",quote.includeInsurance === true],["includeExtras","Incluir extras",quote.includeExtras === true],["includeDiscounts","Incluir descontos",quote.includeDiscounts === true]].map(([key,label,checked]) => `<label><input type="checkbox" name="${key}" ${checked ? "checked" : ""}> ${label}</label>`).join("")}
    </div>
    <label class="form-field">Descontos (R$)<input name="discounts" inputmode="decimal" value="${formatInputCents(quote.discountsCents)}"></label>
    <label class="form-field">Observações<textarea name="notes" rows="2">${escapeHtml(quote.notes || "")}</textarea></label>`;
  card.insertAdjacentHTML("beforeend", `<p class="quote-calculation" data-total-preview>Calculando composição…</p>`);
  return card;
}

function readQuoteCard(card) {
  const data = Object.fromEntries([...card.querySelectorAll("[name]")].map((element) => [
    element.name, element.type === "checkbox" ? element.checked : element.value,
  ]));
  const extraCosts = data.extraCosts.split(",").filter(Boolean).map((text) => {
    const [label, amount] = text.split(":");
    return { label: (label || "").trim(), amountCents: parseCurrencyToCents(amount) || 0 };
  });
  return {
    ...(card.dataset.quoteId ? { id: card.dataset.quoteId } : {}),
    carrierName: data.carrierName.trim(), isOfficial: data.isOfficial === "true",
    available: data.available === "true", costPerTripCents: parseCurrencyToCents(data.costPerTrip),
    fixedCostCents: parseCurrencyToCents(data.fixedCost), costPerKmCents: parseCurrencyToCents(data.costPerKm),
    insuranceBps: parsePercentageToBasisPoints(data.insuranceRate), insuredValueCents: parseCurrencyToCents(data.insuredValue),
    informedTotalCents: parseCurrencyToCents(data.informedTotal), validUntil: data.validUntil || null,
    quoteDate: data.quoteDate || null, extraCosts, discountsCents: parseCurrencyToCents(data.discounts) || 0,
    includeTravel: data.includeTravel, includeFixed: data.includeFixed, includeDistance: data.includeDistance,
    includeInsurance: data.includeInsurance, includeExtras: data.includeExtras, includeDiscounts: data.includeDiscounts,
    notes: data.notes.trim(),
  };
}

function formatInputCents(value) {
  return Number.isSafeInteger(value) ? String(value / 100).replace(".", ",") : "";
}

async function ensureCatalogEntity(items, collection, name) {
  if (!name) return "";
  const key = normalizeName(name);
  const exact = items.find((item) => (item.normalizedName || normalizeName(item.name)) === key);
  if (exact) return exact.id;
  const similar = items.find((item) => {
    const existing = item.normalizedName || normalizeName(item.name);
    return existing.includes(key) || key.includes(existing);
  });
  if (similar && window.confirm(`“${similar.name}” parece corresponder a “${name}”. Usar cadastro existente?`)) return similar.id;
  const prompt = similar
    ? `Criar “${name}” como novo cadastro, apesar da possível correspondência?`
    : `Cadastrar “${name}” em ${collection === "vehicles" ? "Veículos" : collection === "flowTypes" ? "Tipos de fluxo" : "Transportadoras"}?`;
  if (!window.confirm(prompt)) throw new Error("Cadastro da referência cancelado; a rota não foi salva.");
  const id = await saveEntity(collection, null, { name, normalizedName: key, active: true, notes: "" }, collection === "carriers" ? "CREATE_CARRIER" : "CREATE");
  items.push({ id, name, normalizedName: key, active: true });
  return id;
}

async function showRevisionConflict(routeId, page, editor) {
  const [latest, dataset] = await Promise.all([getEntity("routes", routeId), loadDataset()]);
  const latestQuotes = dataset.quotesByRoute[routeId] || [];
  const local = {
    route: Object.fromEntries(new FormData(page.querySelector("#route-form")).entries()),
    quotes: [...editor.querySelectorAll(".quote-card")].map(readQuoteCard),
  };
  const differences = Object.keys(local.route).filter((key) => String(local.route[key] ?? "") !== String(latest?.[key] ?? ""))
    .map((key) => ({ campo: key, local: local.route[key], atual: latest?.[key] ?? "" }));
  const clipboardPayload = { rota: differences, cotacoesLocais: local.quotes, cotacoesAtuais: latestQuotes };
  modal("Conflito de edição", `
    <p>Outra pessoa salvou uma versão mais recente. Nenhuma alteração local foi gravada.</p>
    <div class="conflict-grid"><section><h3>Versão local</h3><pre>${escapeHtml(JSON.stringify(local, null, 2))}</pre></section><section><h3>Versão atual</h3><pre>${escapeHtml(JSON.stringify({ rota: latest, cotacoes: latestQuotes }, null, 2))}</pre></section></div>`, [
      { label: "Fechar", onClick: () => true },
      { label: "Copiar diferenças", onClick: async () => {
        await navigator.clipboard.writeText(JSON.stringify(clipboardPayload, null, 2));
        notify("Diferenças copiadas.", "success");
        return true;
      } },
      { label: "Recarregar versão atual", kind: "primary", onClick: () => { window.location.reload(); return true; } },
    ]);
  return dialog;
}
