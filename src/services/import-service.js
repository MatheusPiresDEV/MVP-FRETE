import { parseCurrencyToCents, parseBrazilianNumber } from "../utils/currency.js";
import { parsePercentageToBasisPoints } from "../utils/percentage.js";
import { normalizeName } from "../utils/normalization.js";

export async function sha256File(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function detectCarrierColumns(headers) {
  const groups = new Map();
  for (const header of headers) {
    const match = String(header).trim().match(/^(KM|FIXO|SEGURO|TOTAL)\s*\[([^\]]+)\]\s*$/i);
    if (!match) continue;
    const key = normalizeName(match[2]);
    const group = groups.get(key) || { name: match[2].trim(), columns: {} };
    group.columns[match[1].toUpperCase()] = header;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function suggestColumn(headers, field) {
  const aliases = {
    routeCode: ["id rota", "codigo rota", "código rota", "rota"],
    vehicleName: ["veiculo", "veículo", "tipo veiculo"],
    shipments: ["contagem shipment", "contagem de shipment", "shipments", "qtd shipment", "quantidade shipment"],
    averageKm: ["media km", "média km", "km medio"],
    averageNf: ["media nf", "média nf", "valor nf"],
    flowTypeName: ["tipo fluxo", "fluxo"],
    origin: ["origem"],
    destination: ["destino"],
    referenceDate: ["data referencia", "data de referencia", "data"],
    officialCarrier: ["transpo oficial", "transportadora oficial", "nomeacao", "nomeação"],
    officialCost: ["custo total oficial", "total oficial", "custo oficial"],
    officialTripCost: ["custo km viagem", "custo por viagem", "custo viagem"],
    officialFixedCost: ["custo fixo"],
    officialCostPerKm: ["custo por km", "custo km oficial"],
    officialInsuranceRate: ["aliquota seguro", "alíquota seguro", "seguro oficial"],
    backupCarrier: ["empresa backup", "backup"],
    backupCost: ["menor custo total backup", "menor custo backup", "custo backup"],
  };
  const normalized = headers.map((header) => normalizeName(header));
  const options = (aliases[field] || []).map(normalizeName);
  const index = normalized.findIndex((header) => options.includes(header));
  return index < 0 ? "" : headers[index];
}

export function validateImportRows(rows, headers, mapping, existingCodes = []) {
  const known = new Set(existingCodes.map(normalizeName));
  const seen = new Set();
  return rows.map((row, index) => {
    const value = (field) => mapping[field] ? row[headers.indexOf(mapping[field])] ?? "" : "";
    const routeCode = String(value("routeCode")).trim();
    const shipmentsRaw = value("shipments");
    const averageKmRaw = value("averageKm");
    const averageNfRaw = value("averageNf");
    const officialCostRaw = value("officialCost");
    const officialTripRaw = value("officialTripCost");
    const officialFixedRaw = value("officialFixedCost");
    const officialKmRaw = value("officialCostPerKm");
    const insuranceRaw = value("officialInsuranceRate");
    const backupCostRaw = value("backupCost");
    const shipments = parseBrazilianNumber(shipmentsRaw);
    const averageKm = parseBrazilianNumber(averageKmRaw);
    const averageNfCents = parseCurrencyToCents(averageNfRaw);
    const officialCents = parseCurrencyToCents(officialCostRaw);
    const officialTripCents = parseCurrencyToCents(officialTripRaw);
    const officialFixedCents = parseCurrencyToCents(officialFixedRaw);
    const officialKmCents = parseCurrencyToCents(officialKmRaw);
    const insuranceBps = parsePercentageToBasisPoints(insuranceRaw);
    const backupCents = parseCurrencyToCents(backupCostRaw);
    const errors = [];
    if (!routeCode) errors.push("Código da rota ausente");
    const key = normalizeName(routeCode);
    if (key && seen.has(key)) errors.push("Rota duplicada no arquivo");
    if (key && known.has(key)) errors.push("Rota já existe no Firestore");
    if (shipmentsRaw !== "" && shipments === null) errors.push("Shipments inválido");
    if (averageKmRaw !== "" && averageKm === null) errors.push("KM inválido");
    if (averageNfRaw !== "" && averageNfCents === null) errors.push("NF inválida");
    if (officialCostRaw !== "" && (officialCents === null || officialCents <= 0)) errors.push("Custo oficial inválido");
    if (officialTripRaw !== "" && (officialTripCents === null || officialTripCents < 0)) errors.push("Custo por viagem inválido");
    if (officialFixedRaw !== "" && (officialFixedCents === null || officialFixedCents < 0)) errors.push("Custo fixo inválido");
    if (officialKmRaw !== "" && (officialKmCents === null || officialKmCents < 0)) errors.push("Custo por KM inválido");
    if (insuranceRaw !== "" && (insuranceBps === null || insuranceBps < 0)) errors.push("Percentual de seguro inválido");
    if (backupCostRaw !== "" && (backupCents === null || backupCents <= 0)) errors.push("Custo backup inválido");
    if (key) seen.add(key);
    return {
      index, routeCode, vehicleName: String(value("vehicleName")).trim(),
      flowTypeName: String(value("flowTypeName")).trim(), origin: String(value("origin")).trim(),
      destination: String(value("destination")).trim(),
      shipments: shipments === null ? null : Math.trunc(shipments), averageKm,
      averageNf: averageNfCents, referenceDate: parseDate(value("referenceDate")),
      officialCarrier: String(value("officialCarrier")).trim(),
      officialCents, officialTripCents, officialFixedCents, officialKmCents, insuranceBps,
      backupCarrier: String(value("backupCarrier")).trim(), backupCents,
      raw: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""])),
      errors, valid: errors.length === 0,
    };
  });
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const brazilian = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2].padStart(2, "0")}-${brazilian[1].padStart(2, "0")}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}
