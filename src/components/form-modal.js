import { modal } from "./modal.js";

export function showFormModal({ title, fields, values = {}, onSave }) {
  const fieldHtml = fields.map((field) => {
    const value = values[field.name] ?? "";
    const type = field.type || "text";
    return `<label class="form-field">${field.label}<input name="${field.name}" type="${type}" value="${String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" ${field.required ? "required" : ""} ${field.step ? `step="${field.step}"` : ""}></label>`;
  }).join("");
  let modalRef;
  modalRef = modal(title, `<form class="entity-form">${fieldHtml}<p class="form-error" aria-live="polite"></p></form>`, [
    { label: "Cancelar", onClick: () => true },
    { label: "Salvar", kind: "primary", onClick: async () => {
      const form = modalRef.form;
      if (!form.reportValidity()) return false;
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        await onSave(values);
        return true;
      } catch (error) {
        form.querySelector(".form-error").textContent = error.message;
        return false;
      }
    } },
  ]);
  modalRef.form = document.querySelector(".modal .entity-form");
  return modalRef;
}
