import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../config/firebase-config.js";

let authUser = null;

export function getAuthUser() {
  return authUser;
}

export function diagnoseAuthError(error) {
  const code = error?.code || "";
  const message = String(error?.message || "");
  if (!auth?.app?.options?.projectId) return "Configuração ausente.";
  if (code === "auth/configuration-not-found" || message.includes("CONFIGURATION_NOT_FOUND")) {
    return "Firebase Authentication não está configurado neste projeto. Ative o Firebase Authentication e o provedor Anônimo no Console Firebase.";
  }
  if (code === "auth/operation-not-allowed") return "Autenticação anônima desativada.";
  if (code === "auth/unauthorized-domain" || message.includes("domain")) return "Domínio não autorizado.";
  if (code === "auth/network-request-failed" || message.includes("network")) return "Falha de internet.";
  if (code === "auth/permission-denied" || code === "permission-denied") return "Acesso negado.";
  if (code.startsWith("auth/") || code === "auth/api-key-not-valid") return "Problema no Firebase.";
  return "Problema no Firebase.";
}

export function initializeAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      authUser = user;
      resolve(user);
    });
  }).then(async (user) => {
    if (user) return user;
    try {
      const credential = await signInAnonymously(auth);
      authUser = credential.user;
      return credential.user;
    } catch (error) {
      throw new Error(diagnoseAuthError(error));
    }
  });
}
