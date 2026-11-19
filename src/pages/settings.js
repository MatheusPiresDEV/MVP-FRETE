import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { saveEntity } from "../services/data-service.js";
import { parseCurrencyToCents } from "../utils/currency.js";
import { formatCentsToBRL } from "../utils/currency.js";
import { escapeHtml } from "../utils/normalization.js";
import { notify } from "../components/notification.js";

const DOC_ID = "opportunityThresholds";
const DEFAULTS = { criticalCents: 10000000, highCents: 5000000, mediumCents: 1000000 };

export async function settingsPage() {
  const page = document.createElement("main");
  page.className = "content";
  let settings = { ...DEFAULTS };
  let revision = null;
  let loadingError = "";
  try {
    const snapshot = await getDoc(doc(db, "appConfig", DOC_ID));
    if (snapshot.exists()) {
      settings = snapshot.data();
      revision = settings.revision || 0;
    }
  } catch (error) { loadingError = error.message; }
  page.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Sistema</p><h2>Configurações compartilhadas</h2></div></div>
    <section class="panel"><h3>Faixas de oportunidade</h3><p>Os limites são compartilhados pelo Firestore e aplicados à classificação das rotas.</p>
    ${loadingError ? `<p class="error-text">Falha ao carregar: ${escapeHtml(loadingError)}</p>` : ""}
    <form id="settings-form" class="form-grid">
      <label class="form-field">Crítica acima de (R$)<input name="critical" value="${settings.criticalCents / 100}"></label>
      <label class="form-field">Alta acima de (R$)<input name="high" value="${settings.highCents / 100}"></label>
      <label class="form-field">Média acima de (R$)<input name="medium" value="${settings.mediumCents / 100}"></label>
      <p class="form-hint">Atual: crítica ${formatCentsToBRL(settings.criticalCents)}, alta ${formatCentsToBRL(settings.highCents)}, média ${formatCentsToBRL(settings.mediumCents)}.</p>
      <button class="button primary" type="submit">Salvar configurações</button><p class="form-error" id="settings-error"></p>
    </form></section>
    <section class="panel"><h3>Conexão</h3><p>Projeto Firebase: analisefretes</p><p>Autenticação anônima e Firestore são necessários para ler e gravar dados compartilhados.</p></section>`;
  page.querySelector("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const next = {
      criticalCents: parseCurrencyToCents(values.critical),
      highCents: parseCurrencyToCents(values.high),
      mediumCents: parseCurrencyToCents(values.medium),
    };
    const error = page.querySelector("#settings-error");
    if (Object.values(next).some((item) => !Number.isSafeInteger(item) || item < 0)
      || !(next.criticalCents > next.highCents && next.highCents > next.mediumCents)) {
      error.textContent = "Informe valores válidos em ordem decrescente: crítica > alta > média.";
      return;
    }
    try {
      await saveEntity("appConfig", DOC_ID, next, revision === null ? "CREATE" : "UPDATE", revision);
      notify("Configurações salvas no Firestore.", "success");
      window.location.reload();
    } catch (saveError) { error.textContent = saveError.message; }
  });
  return page;
}
