// İşlem motoru: LLM'in ürettiği işlem planını tabloya uygular.
// Görünüm = temel veri + işlem listesi. Veri hiçbir zaman yerinde değişmez.
import type { CellValue, Column, Row, Sheet, Workbook } from "./types";
import { columnsIn, evaluate, parse } from "./expr";
import { normalizeTr } from "./profile";

export type Operator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "in" | "between" | "empty" | "not_empty";
export interface Condition { column: string; operator: Operator; value: string; value2: string | null }
export type Agg = "sum" | "avg" | "count" | "min" | "max" | "rate";
export type Color = "red" | "green" | "yellow" | "blue";

export type Op =
  | { type: "filter"; conditions: Condition[] }
  | { type: "sort"; column: string; direction: "asc" | "desc" }
  | { type: "add_column"; name: string; formula: string }
  | { type: "highlight"; conditions: Condition[]; color: Color; column: string | null }
  | { type: "group"; by: string[]; metrics: { column: string; agg: Agg }[] }
  | { type: "lookup"; sheet: string; key: string; column: string }
  | { type: "limit"; count: number }
  | { type: "hide_columns"; columns: string[] }
  | { type: "remove_duplicates" }
  | { type: "replace"; column: string; find: string; replace: string }
  | { type: "chart"; chart: "bar" | "line" | "pie"; x: string; y: string; title: string };

export interface Highlight { color: Color; column: string | null }
export interface View {
  columns: Column[];
  rows: Row[];
  /** satır kimliği → vurgular */
  highlights: Map<string, Highlight[]>;
  chart: { chart: "bar" | "line" | "pie"; x: string; ys: string[]; title: string } | null;
  newColumns: Set<string>;
  grouped: boolean;
  errors: string[];
}

export const ID = "__id";

function coerce(v: string, col: Column | undefined): CellValue {
  if (!col) return v;
  if (col.type === "number") return parseFloat(v.replace(",", "."));
  if (col.type === "date") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return v;
}

const MONTH_ORDER = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function cmp(a: CellValue, b: CellValue): number {
  if (typeof a === "string" && typeof b === "string") {
    const ma = MONTH_ORDER.indexOf(a), mb = MONTH_ORDER.indexOf(b);
    if (ma >= 0 && mb >= 0) return ma - mb;
  }
  if (a === null || a === "") return b === null || b === "" ? 0 : 1;
  if (b === null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), "tr");
}

export function matches(row: Row, c: Condition, cols: Column[]): boolean {
  const col = cols.find((x) => x.name === c.column);
  const v = row[c.column];
  if (c.operator === "empty") return v === null || v === "";
  if (c.operator === "not_empty") return !(v === null || v === "");
  if (v === null || v === undefined) return false;
  if (c.operator === "contains") return normalizeTr(String(v)).includes(normalizeTr(c.value));
  if (c.operator === "in") {
    const set = c.value.split("|").map((s) => normalizeTr(s));
    return set.includes(normalizeTr(String(v)));
  }
  if (c.operator === "between") {
    const lo = coerce(c.value, col), hi = coerce(c.value2 ?? c.value, col);
    if (hi instanceof Date) hi.setHours(23, 59, 59);
    return cmp(v, lo) >= 0 && cmp(v, hi) <= 0;
  }
  // "Tarih = Kasım" gibi ay adıyla gelen tarih filtreleri
  if (v instanceof Date && (c.operator === "=" || c.operator === "!=")) {
    const m = MONTHS_TR.indexOf(normalizeTr(c.value));
    if (m >= 0) return (v.getMonth() === m) === (c.operator === "=");
  }
  // MONTH() ay adı üretir; model "Ay = 11" derse 11 → "Kasım"
  if (typeof v === "string" && MONTH_ORDER.includes(v) && /^\d{1,2}$/.test(c.value.trim())) {
    const name = MONTH_ORDER[Number(c.value) - 1];
    if (c.operator === "=") return v === name;
    if (c.operator === "!=") return v !== name;
  }
  const target = coerce(c.value, col);
  if (typeof v === "string" && typeof target === "string") {
    const eq = normalizeTr(v) === normalizeTr(target);
    if (c.operator === "=") return eq;
    if (c.operator === "!=") return !eq;
  }
  if (v instanceof Date && target instanceof Date && (c.operator === "=" || c.operator === "!=")) {
    const eq = v.toDateString() === target.toDateString();
    return c.operator === "=" ? eq : !eq;
  }
  const d = cmp(v, target);
  switch (c.operator) {
    case "=": return d === 0;
    case "!=": return d !== 0;
    case ">": return d > 0;
    case ">=": return d >= 0;
    case "<": return d < 0;
    case "<=": return d <= 0;
  }
  return false;
}

const MONTHS_TR = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"];
const YES = new Set(["evet", "var", "true", "1", "yes", "x"]);
const AGG_LABEL: Record<Agg, string> = { sum: "Toplam", avg: "Ortalama", count: "Sayı", min: "En Düşük", max: "En Yüksek", rate: "Oranı" };

export function metricName(m: { column: string; agg: Agg }) {
  const base = m.column.replace(/\s*\((₺|%|1-5)\)/, "");
  const unit = m.column.match(/\((₺|1-5)\)/)?.[0] ?? "";
  if (m.agg === "count") return "Satır Sayısı";
  if (m.agg === "rate") return `${base} Oranı (%)`;
  return `${AGG_LABEL[m.agg]} ${base}${unit ? " " + unit : ""}`;
}

export function withIds(sheet: Sheet): Row[] {
  return sheet.rows.map((r, i) => ({ ...r, [ID]: String(i) }));
}

export function applyOps(wb: Workbook, sheet: Sheet, baseRows: Row[], ops: Op[]): View {
  let columns = [...sheet.columns];
  let rows = baseRows;
  const hl: Op[] = [];
  const newColumns = new Set<string>();
  const errors: string[] = [];
  let chart = null as View["chart"];
  const charts: Extract<Op, { type: "chart" }>[] = [];
  let grouped = false;
  const has = (c: string) => columns.some((x) => x.name === c);
  const need = (cs: string[]) => {
    const miss = cs.filter((c) => !has(c));
    if (miss.length) throw new Error(`Sütun bulunamadı: ${miss.join(", ")}`);
  };

  for (const op of ops) {
    try {
      switch (op.type) {
        case "filter":
          need(op.conditions.map((c) => c.column));
          rows = rows.filter((r) => op.conditions.every((c) => matches(r, c, columns)));
          break;
        case "sort": {
          need([op.column]);
          const s = op.direction === "desc" ? -1 : 1;
          rows = [...rows].sort((a, b) => s * cmp(a[op.column], b[op.column]));
          break;
        }
        case "add_column": {
          const ast = parse(op.formula);
          need(columnsIn(ast));
          rows = rows.map((r) => {
            const v = evaluate(ast, r);
            return { ...r, [op.name]: typeof v === "number" && !Number.isFinite(v) ? null : v };
          });
          const sample = rows.find((r) => r[op.name] !== null)?.[op.name];
          const type = typeof sample === "number" ? "number" : sample instanceof Date ? "date" : "text";
          const kind = type !== "number" ? "plain" : /%|oran|marj|yüzde/i.test(op.name) ? "percent" : /₺|ciro|kâr|tutar|maliyet|fiyat/i.test(op.name) ? "currency" : "plain";
          columns = [...columns.filter((c) => c.name !== op.name), { name: op.name, type, kind }];
          newColumns.add(op.name);
          break;
        }
        case "highlight":
          need(op.conditions.map((c) => c.column));
          hl.push(op);
          break;
        case "group": {
          need([...op.by, ...op.metrics.filter((m) => m.agg !== "count").map((m) => m.column)]);
          const groups = new Map<string, Row[]>();
          for (const r of rows) {
            const k = op.by.map((b) => String(r[b] ?? "—")).join(" | ");
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k)!.push(r);
          }
          const metrics = op.metrics.filter((m, i) => op.metrics.findIndex((x) => metricName(x) === metricName(m)) === i);
          const metricCols: Column[] = metrics.map((m) => {
            const src = columns.find((c) => c.name === m.column);
            const kind = m.agg === "rate" ? "percent" : m.agg === "count" ? "plain" : src?.kind ?? "plain";
            return { name: metricName(m), type: "number", kind };
          });
          rows = [...groups.entries()].map(([k, rs]) => {
            const out: Row = { [ID]: `g:${k}` };
            op.by.forEach((b) => (out[b] = rs[0][b]));
            metrics.forEach((m, i) => {
              const vals = rs.map((r) => r[m.column]).filter((v): v is number => typeof v === "number");
              let v: number;
              switch (m.agg) {
                case "sum": v = vals.reduce((a, b) => a + b, 0); break;
                case "avg": v = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; break;
                case "count": v = rs.length; break;
                case "min": v = Math.min(...vals); break;
                case "max": v = Math.max(...vals); break;
                case "rate": v = (rs.filter((r) => YES.has(normalizeTr(String(r[m.column] ?? "")))).length / rs.length) * 100; break;
              }
              out[metricCols[i].name] = Math.round(v * 100) / 100;
            });
            return out;
          });
          columns = [...op.by.map((b) => columns.find((c) => c.name === b)!), ...metricCols];
          metricCols.forEach((c) => newColumns.add(c.name));
          grouped = true;
          break;
        }
        case "lookup": {
          need([op.key]);
          const other = wb.sheets.find((s) => normalizeTr(s.name) === normalizeTr(op.sheet));
          if (!other) throw new Error(`Sayfa bulunamadı: ${op.sheet}`);
          const src = other.columns.find((c) => c.name === op.column);
          if (!src) throw new Error(`"${op.sheet}" sayfasında sütun yok: ${op.column}`);
          // Hedef gibi özet değerler ham satırlara eklenirse her satırda tekrar eder ve oranlar anlamsızlaşır
          const keys = rows.map((r) => normalizeTr(String(r[op.key] ?? "")));
          if (new Set(keys).size < keys.length)
            throw new Error(`"${op.column}" eklemeden önce "${op.key}" bazında özet (group) gerekiyor`);
          const map = new Map<string, number | CellValue>();
          for (const r of other.rows) {
            const k = normalizeTr(String(r[op.key] ?? ""));
            const v = r[op.column];
            const prev = map.get(k);
            map.set(k, typeof v === "number" && typeof prev === "number" ? prev + v : prev ?? v);
          }
          rows = rows.map((r) => ({ ...r, [op.column]: map.get(normalizeTr(String(r[op.key] ?? ""))) ?? null }));
          columns = [...columns.filter((c) => c.name !== op.column), src];
          newColumns.add(op.column);
          break;
        }
        case "limit":
          rows = rows.slice(0, op.count);
          break;
        case "hide_columns":
          columns = columns.filter((c) => !op.columns.includes(c.name));
          break;
        case "remove_duplicates": {
          const seen = new Set<string>();
          rows = rows.filter((r) => {
            const k = JSON.stringify(sheet.columns.map((c) => r[c.name]));
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          break;
        }
        case "replace":
          need([op.column]);
          rows = rows.map((r) => (r[op.column] === op.find ? { ...r, [op.column]: op.replace } : r));
          break;
        case "chart":
          // Grafik her zaman son görünümü anlatır; sıradan bağımsız olarak döngüden sonra işlenir
          charts.push(op);
          break;
      }
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  for (const op of charts) {
    const miss = [op.x, op.y].filter((c) => !has(c));
    if (miss.length) { errors.push(`Grafik için sütun bulunamadı: ${miss.join(", ")}`); continue; }
    // Aynı x eksenli grafik istekleri tek grafikte seri olarak birleşir
    const prev: View["chart"] = chart;
    chart = prev && prev.x === op.x && op.chart !== "pie"
      ? { ...prev, ys: [...new Set([...prev.ys, op.y])] }
      : { chart: op.chart, x: op.x, ys: [op.y], title: op.title };
  }

  const highlights = new Map<string, Highlight[]>();
  for (const op of hl) {
    if (op.type !== "highlight") continue;
    if (!op.conditions.every((c) => has(c.column))) continue;
    for (const r of rows) {
      if (op.conditions.every((c) => matches(r, c, columns))) {
        const id = String(r[ID]);
        highlights.set(id, [...(highlights.get(id) ?? []), { color: op.color, column: op.column }]);
      }
    }
  }
  return { columns, rows, highlights, chart, newColumns, grouped, errors };
}

const OPS_TR: Record<string, string> = { "=": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤", contains: "içerir", in: "∈", between: "arası", empty: "boş", not_empty: "dolu" };
const COLOR_TR: Record<Color, string> = { red: "kırmızı", green: "yeşil", yellow: "sarı", blue: "mavi" };
const cond = (c: Condition) =>
  c.operator === "between" ? `${c.column} ${c.value}–${c.value2}` :
  c.operator === "empty" || c.operator === "not_empty" ? `${c.column} ${OPS_TR[c.operator]}` :
  `${c.column} ${OPS_TR[c.operator]} ${c.value.replace(/\|/g, ", ")}`;

/** İşlem çipi için kısa Türkçe etiket */
export function describeOp(op: Op): string {
  switch (op.type) {
    case "filter": return `Filtre: ${op.conditions.map(cond).join(" ve ")}`;
    case "sort": return `Sırala: ${op.column} ${op.direction === "desc" ? "↓" : "↑"}`;
    case "add_column": return `+ ${op.name}`;
    case "highlight": return `Renk: ${op.conditions.map(cond).join(" ve ")} → ${COLOR_TR[op.color]}`;
    case "group": return op.by.length ? `Özet: ${op.by.join(", ")} bazında` : "Özet: genel toplam";
    case "lookup": return `Ekle: ${op.column} (${op.sheet})`;
    case "limit": return `İlk ${op.count}`;
    case "hide_columns": return `Gizle: ${op.columns.join(", ")}`;
    case "remove_duplicates": return "Mükerrerleri sil";
    case "replace": return `Düzelt: "${op.find}" → "${op.replace}"`;
    case "chart": return `Grafik: ${op.title}`;
  }
}
