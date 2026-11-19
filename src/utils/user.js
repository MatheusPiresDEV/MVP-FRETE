const KEY = "portal-fretes-audit-user";

export function normalizeUserName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function getCurrentUserName() {
  return normalizeUserName(localStorage.getItem(KEY));
}

export function saveCurrentUserName(value) {
  const name = normalizeUserName(value);
  if (name.length < 3 || name.length > 100) {
    throw new Error("O nome deve ter entre 3 e 100 caracteres.");
  }
  localStorage.setItem(KEY, name);
  return name;
}

export async function askForUserName() {
  const current = getCurrentUserName();
  if (current) return current;

  const value = window.prompt("Informe seu nome para registrar esta alteração.");
  if (value === null) throw new Error("Operação cancelada.");
  return saveCurrentUserName(value);
}
