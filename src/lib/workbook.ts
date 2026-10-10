import * as XLSX from "xlsx";
import type { CellValue, Column, ColumnType, Row, Sheet, Workbook } from "./types";

function inferType(values: CellValue[]): ColumnType {
  const filled = values.filter((v) => v !== null && v !== "");
  if (filled.length === 0) return "text";
  if (filled.every((v) => v instanceof Date)) return "date";
  if (filled.every((v) => typeof v === "number")) return "number";
  return "text";
}

function inferKind(name: string, type: ColumnType): Column["kind"] {
  if (type !== "number") return "plain";
  if (/₺|tl\b|ciro|tutar|fiyat|maliyet|kâr|kar\b|gelir|hedef/i.test(name)) return "currency";
  if (/%|oran|yüzde|marj/i.test(name)) return "percent";
  return "plain";
}

export async function readWorkbook(file: File): Promise<Workbook> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets: Sheet[] = wb.SheetNames.map((name) => {
    const raw = XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { defval: null, raw: true });
    const names = raw.length ? Object.keys(raw[0]) : [];
    const columns: Column[] = names.map((n) => {
      const type = inferType(raw.slice(0, 500).map((r) => r[n]));
      return { name: n, type, kind: inferKind(n, type) };
    });
    return { name, columns, rows: raw };
  });
  return { fileName: file.name, sheets };
}
