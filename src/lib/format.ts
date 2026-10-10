import type { CellValue, Column } from "./types";

const num = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function formatCell(v: CellValue, col?: Column): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return dateFmt.format(v);
  if (typeof v === "number") {
    if (col?.kind === "currency") return `${money.format(v)} ₺`;
    if (col?.kind === "percent") return `%${num.format(v)}`;
    return num.format(v);
  }
  return String(v);
}

export function formatCompact(v: number, kind?: Column["kind"]): string {
  const s = compact.format(v);
  return kind === "currency" ? `${s} ₺` : kind === "percent" ? `%${s}` : s;
}

export function formatNumber(v: number): string {
  return num.format(v);
}
