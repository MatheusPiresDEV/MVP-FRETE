import { describe, expect, it } from "vitest";
import { createAuditRecord } from "../src/utils/audit-record.js";

describe("estrutura da auditoria", () => {
  it("registra ator, ação, entidade, documento e revisão", () => {
    const entry = createAuditRecord({
      uid: "uid-1", usuario: "Ana", action: "UPDATE", entity: "routes",
      documentId: "r-1", previousRevision: 2, nextRevision: 3,
    });
    expect(entry).toMatchObject({
      uid: "uid-1", usuario: "Ana", action: "UPDATE", entity: "routes",
      documentId: "r-1", previousRevision: 2, nextRevision: 3,
    });
    expect(entry.timestamp).toBeInstanceOf(Date);
  });
  it("rejeita eventos sem ator ou ação", () => {
    expect(() => createAuditRecord({ entity: "routes" })).toThrow("Dados essenciais");
  });
});
