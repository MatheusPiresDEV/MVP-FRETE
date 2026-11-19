import { describe, expect, it } from "vitest";
import { normalizeUserName } from "../src/utils/user.js";

describe("normalização do usuário de auditoria", () => {
  it("remove espaços extras", () => {
    expect(normalizeUserName("  Maria   Silva  ")).toBe("Maria Silva");
  });

  it("retorna string vazia para valor ausente", () => {
    expect(normalizeUserName()).toBe("");
  });
});
