export function createAuditRecord(event, timestamp = new Date()) {
  if (!event.uid || !event.usuario || !event.action || !event.entity) {
    throw new Error("Dados essenciais de auditoria ausentes.");
  }
  return {
    uid: event.uid,
    usuario: event.usuario,
    timestamp,
    action: event.action,
    entity: event.entity,
    documentId: event.documentId || "",
    routeId: event.routeId || "",
    routeCode: event.routeCode || "",
    carrierId: event.carrierId || "",
    changedFields: event.changedFields || [],
    oldValue: event.oldValue ?? null,
    newValue: event.newValue ?? null,
    origin: event.origin || "interface",
    fileName: event.fileName || "",
    hash: event.hash || "",
    previousRevision: event.previousRevision ?? null,
    nextRevision: event.nextRevision ?? null,
  };
}
