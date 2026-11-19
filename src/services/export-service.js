function workbookApi() {
  if (!window.XLSX) throw new Error("A biblioteca SheetJS não foi carregada. Verifique a conexão e recarregue.");
  return window.XLSX;
}

export function exportRows(fileName, sheetName, rows) {
  if (!rows.length) throw new Error("Não há dados para exportar.");
  const XLSX = workbookApi();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

export function exportWithMetadata(fileName, sheetName, rows, filters = {}) {
  const exportedAt = new Date().toLocaleString("pt-BR");
  exportRows(fileName, sheetName, [
    { "Exportado em": exportedAt, "Filtros": Object.entries(filters).map(([key, value]) => `${key}: ${value}`).join(" | ") },
    ...rows,
  ]);
}
