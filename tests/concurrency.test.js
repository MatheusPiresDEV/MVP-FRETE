import { describe, expect, it } from "vitest";
import { assertRevision } from "../src/utils/revision.js";

describe("controle otimista de revisão", () => {
  it("permite gravação quando a revisão carregada é atual", () => {
    expect(() => assertRevision(3, 3)).not.toThrow();
  });
  it("bloqueia sobrescrita após atualização concorrente", () => {
    expect(() => assertRevision(2, 3)).toThrow("CONFLICTO_REVISAO");
  });
});
