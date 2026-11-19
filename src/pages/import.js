import { loadDataset, createImportBatch, hasImportHash, useRealDataMode } from "../services/data-service.js";
import { detectCarrierColumns, sha256File, suggestColumn, validateImportRows } from "../services/import-service.js";
import { escapeHtml, normalizeName } from "../utils/normalization.js";
import { notify } from "../components/notification.js";
import { calculateQuote } from "../services/calculation-service.js";

const MAP_FIELDS = [
  ["routeCode", "Código da rota", true], ["vehicleName", "Veículo"], ["shipments", "Shipments"],
  ["averageKm", "Média KM"], ["averageNf", "Média NF"], ["flowTypeName", "Tipo de fluxo"],
  ["origin", "Origem"], ["destination", "Destino"], ["referenceDate", "Data de referência"],
  ["officialCarrier", "Transportadora oficial"], ["officialCost", "Custo oficial"],
  ["officialTripCost", "Custo por viagem oficial"], ["officialFixedCost", "Custo fixo oficial"],
  ["officialCostPerKm", "Custo por KM oficial"], ["officialInsuranceRate", "Alíquota de seguro oficial"],
  ["backupCarrier", "Empresa backup"], ["backupCost", "Custo backup"],
];

export async function importPage() {
  const page = document.createElement("main");
  page.className = "content";
  page.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Importação guiada</p><h2>Importar planilha</h2></div></div>
    <section class="panel import-panel">
      <div class="import-intro"><h3>Traga os dados das rotas para o Firestore</h3><p>Compatível com Excel (.xlsx/.xls) e CSV. O arquivo é conferido no navegador; você escolhe a aba, o cabeçalho e o significado das colunas antes da gravação.</p><button id="download-import-template" type="button" class="button secondary">Baixar modelo de planilha</button></div>
      <div id="import-demo-note"></div>
      <div class="import-step"><b>1</b><div class="step-content"><h3>Escolha um arquivo</h3><div class="file-drop-zone" id="file-drop-zone"><p>Arraste a planilha até aqui ou selecione-a no dispositivo.</p><label class="button secondary">Selecionar arquivo<input id="import-file" type="file" accept=".xlsx,.xls,.csv"></label><span id="file-info" aria-live="polite"></span></div></div></div>
      <div class="import-step"><b>2</b><div class="step-content"><h3>Escolha a aba e o cabeçalho</h3><p class="section-help">A detecção inicial é automática; confira a linha com os nomes das colunas.</p><div class="form-grid compact"><label class="form-field">Aba da planilha<select id="sheet-select" disabled></select></label><label class="form-field">Linha do cabeçalho<select id="header-select" disabled></select></label></div></div></div>
      <div class="import-step"><b>3</b><div class="step-content"><h3>Mapeie as colunas</h3><p class="section-help">Associe cada campo do sistema à coluna equivalente. Código da rota é obrigatório; campos não mapeados permanecem vazios.</p><div id="mapping-grid" class="form-grid"></div></div></div>
      <div class="panel subpanel"><h3>Transportadoras por colunas dinâmicas</h3><p class="section-help">Colunas como <code>TOTAL [Nome]</code>, <code>KM [Nome]</code> e <code>FIXO [Nome]</code> são agrupadas por empresa. Desmarque as que não devem ser importadas.</p><div id="carrier-groups">Selecione uma planilha para detectar.</div></div>
      <div class="import-step"><b>4</b><div class="step-content"><h3>Revise e corrija a prévia</h3><p id="validation-summary" aria-live="polite">Selecione um arquivo para começar.</p><div class="table-wrap"><table><thead id="preview-head"></thead><tbody id="preview-body"></tbody></table></div><p class="section-help">A prévia mostra até 100 linhas. Código, shipments, KM, NF e custos exibidos podem ser corrigidos antes de importar.</p></div></div>
      <div class="form-footer"><button id="import-confirm" class="button primary" disabled>Importar registros válidos</button></div>
    </section>`;
  const fileInput = page.querySelector("#import-file");
  const sheetSelect = page.querySelector("#sheet-select");
  const headerSelect = page.querySelector("#header-select");
  const mapRoot = page.querySelector("#mapping-grid");
  const dropZone = page.querySelector("#file-drop-zone");
  page.querySelector("#download-import-template").addEventListener("click", () => {
    try {
      if (!window.XLSX) throw new Error("SheetJS não carregou. Verifique a conexão.");
      const worksheet = window.XLSX.utils.aoa_to_sheet([
        ["ID Rota", "Veículo", "Contagem de Shipment", "Média KM", "Média NF", "Tipo fluxo", "Origem", "Destino", "Data de Referência", "Transportadora oficial", "Custo Total Oficial", "Empresa backup", "Custo backup"],
        ["EXEMPLO-APAGAR", "Truck", 12, 45, 1200, "Fracionado", "São Paulo", "Campinas", "15/01/2026", "Oficial Exemplo", 4500, "Backup Exemplo", 4000],
      ]);
      const workbookTemplate = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbookTemplate, worksheet, "Rotas");
      window.XLSX.writeFile(workbookTemplate, "modelo-importacao-fretes.xlsx");
      notify("Modelo de planilha baixado.", "success");
    } catch (error) { notify(error.message, "error"); }
  });
  let workbook;
  let file;
  let fileHash = "";
  let duplicateFile = false;
  let activeSheet;
  let headerRow = 0;
  let headers = [];
  let rows = [];
  let validated = [];
  let dataset;
  try { dataset = await loadDataset(); }
  catch (error) {
    page.querySelector("#validation-summary").textContent = `Firestore indisponível: ${error.message}`;
  }
  if (dataset?.demoMode) {
    page.querySelector("#import-demo-note").innerHTML = `<div class="demo-banner"><div><strong>Modo demonstração:</strong> a importação está bloqueada para proteger o Firestore. Os dados ilustrativos não são persistidos.</div><button id="use-real-data" type="button" class="button secondary">Começar com meus dados reais</button></div>`;
    page.querySelector("#use-real-data").addEventListener("click", () => {
      if (!window.confirm("Ocultar a demonstração e habilitar a importação para o Firestore?")) return;
      useRealDataMode();
      window.location.reload();
    });
  }

  fileInput.addEventListener("change", () => processFile(fileInput.files?.[0]));
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", (event) => {
    if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    processFile(event.dataTransfer.files?.[0]);
  });

  async function processFile(selectedFile) {
    file = selectedFile;
    if (!file) return;
    fileHash = "";
    duplicateFile = false;
    workbook = null;
    rows = [];
    headers = [];
    validated = [];
    sheetSelect.innerHTML = "";
    sheetSelect.disabled = true;
    headerSelect.innerHTML = "";
    headerSelect.disabled = true;
    mapRoot.innerHTML = "";
    page.querySelector("#preview-head").innerHTML = "";
    page.querySelector("#preview-body").innerHTML = "";
    page.querySelector("#file-info").textContent = `${file.name} · lendo arquivo…`;
    page.querySelector("#validation-summary").textContent = "Validando arquivo…";
    page.querySelector("#import-confirm").disabled = true;
    try {
      if (!window.XLSX) throw new Error("SheetJS não carregou. Verifique a conexão.");
      fileHash = await sha256File(file);
      duplicateFile = await hasImportHash(fileHash);
      const { read } = window.XLSX;
      const bytes = await file.arrayBuffer();
      workbook = read(bytes, { type: "array", cellDates: true });
      page.querySelector("#file-info").textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · SHA-256 ${fileHash.slice(0, 16)}…${duplicateFile ? " · ARQUIVO JÁ IMPORTADO" : ""}`;
      sheetSelect.innerHTML = workbook.SheetNames.map((name) => `<option>${escapeHtml(name)}</option>`).join("");
      sheetSelect.disabled = false;
      sheetSelect.dispatchEvent(new Event("change"));
    } catch (error) {
      page.querySelector("#validation-summary").textContent = `Arquivo não pôde ser lido: ${error.message}`;
      page.querySelector("#file-info").textContent = file.name;
      notify(error.message, "error");
    }
  }
  sheetSelect.addEventListener("change", () => {
    activeSheet = sheetSelect.value;
    const raw = window.XLSX.utils.sheet_to_json(workbook.Sheets[activeSheet], { header: 1, defval: "", raw: false });
    const candidates = raw.slice(0, Math.min(100, raw.length));
    headerSelect.innerHTML = candidates.map((line, index) => `<option value="${index}">Linha ${index + 1}: ${escapeHtml(line.slice(0, 4).join(" | "))}</option>`).join("");
    headerSelect.disabled = false;
    headerRow = detectHeader(raw);
    headerSelect.value = String(headerRow);
    headerSelect.dispatchEvent(new Event("change"));
  });
  headerSelect.addEventListener("change", () => {
    if (!workbook || !activeSheet) return;
    headerRow = Number(headerSelect.value);
    const raw = window.XLSX.utils.sheet_to_json(workbook.Sheets[activeSheet], { header: 1, range: headerRow, defval: "", raw: false });
    const rawHeaders = raw.shift() || [];
    if (!rawHeaders.some(isReadableCell)) {
      headers = [];
      rows = [];
      validated = [];
      mapRoot.innerHTML = "";
      page.querySelector("#carrier-groups").textContent = "Cabeçalhos não detectados.";
      page.querySelector("#preview-head").innerHTML = "";
      page.querySelector("#preview-body").innerHTML = "";
      page.querySelector("#validation-summary").textContent = "A linha escolhida não contém nomes de coluna legíveis. Selecione outra linha de cabeçalho.";
      page.querySelector("#import-confirm").disabled = true;
      return;
    }
    headers = rawHeaders.map((value, index) => String(value).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim() || `Coluna ${index + 1}`);
    rows = raw.filter((line) => line.some((cell) => String(cell).trim())).map((line) => headers.map((_, index) => line[index] ?? ""));
    const suggested = Object.fromEntries(MAP_FIELDS.map(([key]) => [key, suggestColumn(headers, key)]));
    mapRoot.innerHTML = MAP_FIELDS.map(([key, label, required]) => `<label class="form-field">${label}${required ? " *" : ""}<select data-map="${key}"><option value="">Não mapear</option>${headers.map((header) => `<option value="${escapeHtml(header)}" ${suggested[key] === header ? "selected" : ""}>${escapeHtml(header)}</option>`).join("")}</select></label>`).join("");
    page.querySelector("#carrier-groups").innerHTML = detectedMarkup();
    page.querySelector("#preview-head").innerHTML = "<tr><th>Linha</th><th>Código</th><th>Shipments</th><th>KM</th><th>NF (R$)</th><th>Transportadora oficial</th><th>Custo oficial (R$)</th><th>Backup</th><th>Custo backup (R$)</th><th>Validação</th></tr>";
    refreshPreview();
  });
  mapRoot.addEventListener("change", refreshPreview);
  page.querySelector("#preview-body").addEventListener("change", (event) => {
    const input = event.target.closest("[data-edit-row]");
    if (!input) return;
    const rowIndex = Number(input.dataset.editRow);
    validated[rowIndex][input.dataset.field] = input.value;
    validated.forEach((item) => revalidateRow(item, dataset?.routes || [], validated));
    validateCurrent();
  });
  page.querySelector("#import-confirm").addEventListener("click", async () => {
    if (dataset?.demoMode) return notify("A importação está bloqueada no modo demonstração.", "error");
    const valid = validated.filter((item) => item.valid);
    const duplicate = validated.filter((item) => item.errors.some((error) => error.includes("duplicada") || error.includes("já existe")));
    const candidates = valid;
    if (!candidates.length) return notify("Não há registros válidos e novos para importar.", "error");
    if (!confirm(`Confirmar importação de ${candidates.length} rota(s)? Duplicadas: ${duplicate.length}.`)) return;
    if (duplicateFile) return notify("Este arquivo já consta no histórico de importações (hash SHA-256).", "error");
    const groups = detectCarrierColumns(headers).filter((group) => page.querySelector(`[data-carrier-group="${CSS.escape(group.name)}"]`)?.checked !== false);
    const items = candidates.map((item) => {
      const route = {
        routeCode: item.routeCode, vehicleName: item.vehicleName, flowTypeName: item.flowTypeName,
        shipments: item.shipments, averageKm: item.averageKm, averageNf: item.averageNf,
        origin: item.origin, destination: item.destination, referenceDate: item.referenceDate,
        status: "importado", notes: `Importado de ${file.name}`,
      };
      const quotes = [];
      if (item.officialCarrier && (item.officialCents || item.officialTripCents || item.officialFixedCents || item.officialKmCents)) {
        const officialQuote = {
          carrierName: item.officialCarrier, isOfficial: true, available: true,
          costPerTripCents: item.officialTripCents, fixedCostCents: item.officialFixedCents,
          costPerKmCents: item.officialKmCents, insuranceBps: item.insuranceBps,
          includeFixed: item.officialFixedCents != null, includeDistance: item.officialKmCents != null,
          ...(item.officialCents ? { informedTotalCents: item.officialCents } : {}),
        };
        const calculated = calculateQuote(officialQuote, route);
        officialQuote.calculatedCents = calculated.calculatedCents;
        officialQuote.totalCents = officialQuote.informedTotalCents ?? calculated.calculatedCents;
        quotes.push(officialQuote);
      }
      if (item.backupCarrier && item.backupCents) quotes.push({ carrierName: item.backupCarrier, isOfficial: false, available: true, totalCents: item.backupCents, informedTotalCents: item.backupCents });
      for (const group of groups) {
        const totalColumn = group.columns.TOTAL;
        const cents = totalColumn ? parseMappedMoney(item, totalColumn) : null;
        const official = normalizeName(item.officialCarrier) === normalizeName(group.name);
        const quote = {
          carrierName: group.name, isOfficial: official, available: true,
          costPerKmCents: parseMappedMoney(item, group.columns.KM),
          fixedCostCents: parseMappedMoney(item, group.columns.FIXO),
          insuranceBps: parseMappedPercent(item, group.columns.SEGURO),
          includeDistance: Boolean(group.columns.KM), includeFixed: Boolean(group.columns.FIXO),
          ...(cents !== null && cents > 0 ? { totalCents: cents, informedTotalCents: cents } : {}),
        };
        if (quote.totalCents || quote.costPerKmCents || quote.fixedCostCents) {
          if (!Number.isSafeInteger(quote.totalCents)) {
            const calculated = calculateQuote(quote, route);
            quote.calculatedCents = calculated.calculatedCents;
            quote.totalCents = calculated.calculatedCents;
          }
          const existingQuote = quotes.find((item) =>
            item.isOfficial === quote.isOfficial && normalizeName(item.carrierName) === normalizeName(quote.carrierName));
          if (existingQuote) {
            existingQuote.costPerKmCents = quote.costPerKmCents ?? existingQuote.costPerKmCents;
            existingQuote.fixedCostCents = quote.fixedCostCents ?? existingQuote.fixedCostCents;
            existingQuote.insuranceBps = quote.insuranceBps ?? existingQuote.insuranceBps;
            existingQuote.includeDistance ||= quote.includeDistance;
            existingQuote.includeFixed ||= quote.includeFixed;
            if (!Number.isSafeInteger(existingQuote.informedTotalCents) && Number.isSafeInteger(quote.informedTotalCents)) {
              existingQuote.informedTotalCents = quote.informedTotalCents;
              existingQuote.totalCents = quote.informedTotalCents;
            }
          } else quotes.push(quote);
        }
      }
      return { route, quotes };
    });
    const allCarriers = [...new Set(items.flatMap((item) => item.quotes.map((quote) => quote.carrierName)))];
    const existingVehicles = new Set(dataset.vehicles.map((item) => item.normalizedName || normalizeName(item.name)));
    const existingFlows = new Set(dataset.flowTypes.map((item) => item.normalizedName || normalizeName(item.name)));
    const vehicles = [...new Set(items.map((item) => item.route.vehicleName).filter(Boolean))]
      .filter((name) => !existingVehicles.has(normalizeName(name)));
    const flowTypes = [...new Set(items.map((item) => item.route.flowTypeName).filter(Boolean))]
      .filter((name) => !existingFlows.has(normalizeName(name)));
    if ((vehicles.length || flowTypes.length) && !confirm(`Criar no Firestore ${vehicles.length} veículo(s) e ${flowTypes.length} tipo(s) de fluxo novos?`)) return;
    try {
      const result = await createImportBatch({
        routes: items, carriers: allCarriers, vehicles, flowTypes,
        importRecord: {
          name: file.name, size: file.size, hash: fileHash, sheet: activeSheet,
          headerRow: headerRow + 1, rows: rows.length, valid: valid.length,
          invalid: validated.length - valid.length, duplicates: duplicate.length, ignored: duplicate.length,
        },
      });
      notify(`${result.created} rota(s), ${result.carriersCreated} transportadora(s) e ${result.catalogsCreated} veículo(s)/fluxo(s) novos gravados.`, "success");
      window.location.hash = "#/rotas";
    } catch (error) { notify(`Falha na importação: ${error.message}`, "error"); }
  });

  function detectedMarkup() {
    const groups = detectCarrierColumns(headers);
    return groups.length ? `<div class="detected-carriers">${groups.map((group) => `<label><input type="checkbox" checked data-carrier-group="${escapeHtml(group.name)}"> ${escapeHtml(group.name)} <small>${escapeHtml(Object.keys(group.columns).join(", "))}</small></label>`).join("")}</div>` : "Nenhuma coluna dinâmica TOTAL [Nome] detectada.";
  }
  function refreshPreview() {
    const mapping = Object.fromEntries([...mapRoot.querySelectorAll("[data-map]")].map((select) => [select.dataset.map, select.value]));
    validated = validateImportRows(rows, headers, mapping, dataset?.routes.map((route) => route.routeCode) || []);
    validateCurrent();
  }
  function validateCurrent() {
    const body = page.querySelector("#preview-body");
    body.innerHTML = validated.slice(0, 100).map((item, index) => `<tr><td>${headerRow + 2 + index}</td>
      <td><input data-edit-row="${index}" data-field="routeCode" value="${escapeHtml(item.routeCode)}"></td>
      <td><input data-edit-row="${index}" data-field="shipments" value="${escapeHtml(item.shipments ?? "")}"></td>
      <td><input data-edit-row="${index}" data-field="averageKm" value="${escapeHtml(item.averageKm ?? "")}"></td>
      <td><input data-edit-row="${index}" data-field="averageNf" value="${escapeHtml(item.averageNf == null ? "" : item.averageNf / 100)}"></td>
      <td><input data-edit-row="${index}" data-field="officialCarrier" value="${escapeHtml(item.officialCarrier)}"></td>
      <td><input data-edit-row="${index}" data-field="officialCost" value="${escapeHtml(item.officialCents == null ? "" : item.officialCents / 100)}"></td>
      <td><input data-edit-row="${index}" data-field="backupCarrier" value="${escapeHtml(item.backupCarrier)}"></td>
      <td><input data-edit-row="${index}" data-field="backupCost" value="${escapeHtml(item.backupCents == null ? "" : item.backupCents / 100)}"></td>
      <td class="${item.errors.length ? "error-text" : "success-text"}">${escapeHtml(item.errors.join(", ") || "Válida")}</td></tr>`).join("");
    const validCount = validated.filter((item) => item.valid).length;
    page.querySelector("#validation-summary").textContent = `${validCount} válidas · ${validated.length - validCount} inválidas · ${rows.length} linhas analisadas${rows.length > 100 ? " · prévia limitada às primeiras 100" : ""}.`;
    page.querySelector("#import-confirm").disabled = validCount === 0 || !fileHash || !dataset || duplicateFile || dataset.demoMode === true;
  }
  return page;
}

function detectHeader(rows) {
  let bestIndex = 0;
  let bestScore = -1;
  rows.slice(0, 20).forEach((row, index) => {
    const score = row.reduce((sum, cell) => sum + (/rota|shipment|ve[ií]culo|custo|origem|destino|km|nf/i.test(String(cell)) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestIndex = index; }
  });
  return bestIndex;
}

function parseMappedMoney(item, column) {
  if (!column) return null;
  const value = item.raw?.[column];
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function parseMappedPercent(item, column) {
  if (!column || !item.raw?.[column]) return null;
  const value = Number(String(item.raw[column]).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function isReadableCell(value) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim() !== "";
}

function revalidateRow(item, existingRoutes, allRows) {
  item.averageNf = toCents(item.averageNf);
  item.officialCents = toCents(item.officialCents);
  item.backupCents = toCents(item.backupCents);
  item.shipments = item.shipments === "" || item.shipments == null ? null : Number(item.shipments);
  item.averageKm = item.averageKm === "" || item.averageKm == null ? null : Number(item.averageKm);
  item.errors = [];
  if (!String(item.routeCode || "").trim()) item.errors.push("Código da rota ausente");
  if (existingRoutes.some((route) => normalizeName(route.routeCode) === normalizeName(item.routeCode))) {
    item.errors.push("Rota já existe no Firestore");
  }
  if (allRows.some((other) => other !== item && other.index < item.index && normalizeName(other.routeCode) === normalizeName(item.routeCode))) item.errors.push("Rota duplicada no arquivo");
  if (item.shipments != null && !Number.isFinite(item.shipments)) item.errors.push("Shipments inválido");
  if (item.averageKm != null && !Number.isFinite(item.averageKm)) item.errors.push("KM inválido");
  if (item.averageNf != null && !Number.isSafeInteger(item.averageNf)) item.errors.push("NF inválida");
  if (item.officialCents != null && (!Number.isSafeInteger(item.officialCents) || item.officialCents <= 0)) item.errors.push("Custo oficial inválido");
  if (item.backupCents != null && (!Number.isSafeInteger(item.backupCents) || item.backupCents <= 0)) item.errors.push("Custo backup inválido");
  item.valid = item.errors.length === 0;
}

function toCents(value) {
  if (typeof value !== "string") return value;
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}
