import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { createAuditRecord } from "../utils/audit-record.js";

export async function writeAuditLog({
  uid,
  usuario,
  action,
  entity,
  documentId = "",
  routeId = "",
  routeCode = "",
  carrierId = "",
  changedFields = [],
  oldValue = null,
  newValue = null,
  origin = "interface",
  fileName = "",
  hash = "",
  previousRevision = null,
  nextRevision = null,
}) {
  if (!navigator.onLine) throw new Error("Sem conexão. Gravações estão bloqueadas.");
  await addDoc(collection(db, "auditLogs"), createAuditRecord({
    uid, usuario, action, entity, documentId, routeId, routeCode, carrierId,
    changedFields, oldValue, newValue, origin, fileName, hash,
    previousRevision, nextRevision,
  }, serverTimestamp()));
}
