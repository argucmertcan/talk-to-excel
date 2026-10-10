import type { CellValue, Column, Row, Sheet, Workbook } from "./types";

export interface Kpi {
  label: string;
  value: number;
  kind: Column["kind"];
  hint?: string;
}

export interface QualityIssue {
  kind: "duplicate" | "spelling" | "empty";
  message: string;
  column?: string;
  count: number;
}

export interface Finding {
  id: string;
  score: number; // önem sıralaması için
  fact: string; // LLM'e giden, sayılarla dolu tek cümle
}

export interface Profile {
  sheet: string;
  rowCount: number;
  dateRange?: [string, string];
  kpis: Kpi[];
  quality: QualityIssue[];
  findings: Finding[];
  schema: { name: string; type: string; kind: string; samples: string[] }[];
}

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n);
const money = (n: number) =>
  Math.abs(n) >= 1e6 ? `${fmt(n / 1e6)} milyon ₺` : `${fmt(Math.round(n))} ₺`;

export function normalizeTr(s: string) {
  return s
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();
}

export function mainSheet(wb: Workbook): Sheet {
  return wb.sheets.reduce((a, b) => (b.rows.length > a.rows.length ? b : a));
}

function sum(rows: Row[], col: string) {
  let s = 0;
  for (const r of rows) if (typeof r[col] === "number") s += r[col] as number;
  return s;
}

function groupBy(rows: Row[], key: (r: Row) => string | null) {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

const isEmpty = (v: CellValue) => v === null || v === "";
const YES = new Set(["evet", "var", "true", "1", "yes", "x"]);

/** Ciro, kâr ve tarih sütunlarını adlarından tahmin eder */
export function keyColumns(sheet: Sheet) {
  const money_cols = sheet.columns.filter((c) => c.kind === "currency");
  const revenueCol =
    money_cols.find((c) => /ciro|gelir|satış tutarı|tutar/i.test(c.name)) ??
    money_cols.find((c) => !/fiyat|maliyet/i.test(c.name)) ??
    money_cols[0];
  const profitCol = money_cols.find((c) => /kâr|kar\b|profit/i.test(c.name));
  const dateCol = sheet.columns.find((c) => c.type === "date");
  return { revenueCol, profitCol, dateCol };
}

/** Aylık toplam (rapor grafiği için) */
export function monthlySeries(sheet: Sheet) {
  const { revenueCol, profitCol, dateCol } = keyColumns(sheet);
  if (!revenueCol || !dateCol) return [];
  const out = Array.from({ length: 12 }, (_, m) => ({ ay: MONTHS[m], ciro: 0, kar: 0, n: 0 }));
  for (const r of sheet.rows) {
    const d = r[dateCol.name];
    if (!(d instanceof Date)) continue;
    const o = out[d.getMonth()];
    o.ciro += (r[revenueCol.name] as number) || 0;
    if (profitCol) o.kar += (r[profitCol.name] as number) || 0;
    o.n++;
  }
  return out.filter((o) => o.n > 0);
}

/** Bir boyuta göre toplam ciro (rapor grafiği için) */
export function breakdown(sheet: Sheet, dim: string) {
  const { revenueCol } = keyColumns(sheet);
  if (!revenueCol) return [];
  const m = new Map<string, number>();
  for (const r of sheet.rows) {
    const k = String(r[dim] ?? "—");
    m.set(k, (m.get(k) ?? 0) + ((r[revenueCol.name] as number) || 0));
  }
  return [...m.entries()].map(([ad, ciro]) => ({ ad, ciro })).sort((a, b) => b.ciro - a.ciro);
}

export function profileWorkbook(wb: Workbook): Profile {
  const sheet = mainSheet(wb);
  const { rows, columns } = sheet;
  const { revenueCol, profitCol, dateCol } = keyColumns(sheet);
  const textCols = columns.filter((c) => c.type === "text");
  const dims = textCols.filter((c) => {
    const u = new Set(rows.map((r) => r[c.name])).size;
    return u >= 2 && u <= 30;
  });
  // Birebir eşleşen boyutlardan (Ürün Kodu ↔ Ürün) sadece okunaklı olanı tut
  for (let i = dims.length - 1; i >= 0; i--) {
    for (let j = 0; j < dims.length; j++) {
      if (i === j) continue;
      const a = dims[i].name, b = dims[j].name;
      const ua = new Set(rows.map((r) => r[a])).size;
      const pairs = new Set(rows.map((r) => `${r[a]}|${r[b]}`)).size;
      if (ua === new Set(rows.map((r) => r[b])).size && pairs === ua) {
        const len = (n: string) => rows.slice(0, 100).reduce((s, r) => s + String(r[n] ?? "").length, 0);
        if (len(a) < len(b)) { dims.splice(i, 1); break; }
      }
    }
  }
  const flags = dims.filter((c) => {
    const vals = new Set(rows.map((r) => normalizeTr(String(r[c.name] ?? ""))));
    return vals.size === 2 && [...vals].some((v) => YES.has(v));
  });

  // ---------- KPI ----------
  const kpis: Kpi[] = [{ label: "Satır", value: rows.length, kind: "plain" }];
  if (revenueCol) kpis.push({ label: `Toplam ${revenueCol.name.replace(/\s*\(.*\)/, "")}`, value: sum(rows, revenueCol.name), kind: "currency" });
  if (profitCol) kpis.push({ label: `Toplam ${profitCol.name.replace(/\s*\(.*\)/, "")}`, value: sum(rows, profitCol.name), kind: "currency" });
  if (revenueCol && profitCol)
    kpis.push({ label: "Kâr Marjı", value: (sum(rows, profitCol.name) / sum(rows, revenueCol.name)) * 100, kind: "percent" });

  let dateRange: Profile["dateRange"];
  if (dateCol) {
    const ts = rows.map((r) => r[dateCol.name]).filter((v): v is Date => v instanceof Date).map((d) => d.getTime());
    const df = new Intl.DateTimeFormat("tr-TR");
    dateRange = [df.format(Math.min(...ts)), df.format(Math.max(...ts))];
  }

  // ---------- Veri kalitesi ----------
  const quality: QualityIssue[] = [];
  const seen = new Set<string>();
  let dup = 0;
  for (const r of rows) {
    const k = JSON.stringify(columns.map((c) => r[c.name]));
    if (seen.has(k)) dup++;
    else seen.add(k);
  }
  if (dup) quality.push({ kind: "duplicate", count: dup, message: `${dup} mükerrer (birebir aynı) satır` });
  for (const c of textCols) {
    const variants = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const v = r[c.name];
      if (typeof v !== "string") continue;
      const n = normalizeTr(v);
      if (!variants.has(n)) variants.set(n, new Map());
      const m = variants.get(n)!;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    for (const m of variants.values()) {
      if (m.size < 2) continue;
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
      const minority = sorted.slice(1).reduce((a, [, n]) => a + n, 0);
      quality.push({
        kind: "spelling", column: c.name, count: minority,
        message: `"${c.name}" sütununda farklı yazımlar: ${sorted.map(([v, n]) => `"${v}" (${n})`).join(", ")}`,
      });
    }
  }
  for (const c of columns) {
    const empty = rows.filter((r) => isEmpty(r[c.name])).length;
    if (empty > 0 && empty < rows.length)
      quality.push({ kind: "empty", column: c.name, count: empty, message: `"${c.name}" sütununda ${empty} boş hücre` });
  }

  // ---------- Bulgular (LLM'e giden olgular) ----------
  const findings: Finding[] = [];
  const total = revenueCol ? sum(rows, revenueCol.name) : 0;

  if (dateCol && revenueCol) {
    const byMonth = groupBy(rows, (r) => (r[dateCol.name] instanceof Date ? String((r[dateCol.name] as Date).getMonth()) : null));
    const series = [...byMonth.entries()].map(([m, rs]) => ({ m: Number(m), v: sum(rs, revenueCol.name) })).sort((a, b) => a.m - b.m);
    const avg = series.reduce((a, b) => a + b.v, 0) / series.length;
    const peak = series.reduce((a, b) => (b.v > a.v ? b : a));
    findings.push({
      id: "peak-month", score: peak.v / avg,
      fact: `Aylık ${revenueCol.name}: ${series.map((s) => `${MONTHS[s.m]} ${money(s.v)}`).join(", ")}. Zirve ${MONTHS[peak.m]} (ortalamanın ${fmt(peak.v / avg)} katı).`,
    });
    if (profitCol) {
      const peakRows = byMonth.get(String(peak.m)) ?? [];
      const peakMargin = (sum(peakRows, profitCol.name) / peak.v) * 100;
      const allMargin = (sum(rows, profitCol.name) / total) * 100;
      if (allMargin - peakMargin > 2)
        findings.push({ id: "peak-margin", score: (allMargin - peakMargin) / 3,
          fact: `${MONTHS[peak.m]} ayında kâr marjı %${fmt(peakMargin)}, yıl ortalaması %${fmt(allMargin)}: ciro zirvesi marjı düşürmüş.` });
    }

    // Çeyrek bazında boyut kırılımlarında sert düşüş/artış
    const q = (r: Row) => Math.floor((r[dateCol.name] as Date).getMonth() / 3);
    for (const d of dims) {
      if (flags.includes(d)) continue;
      const byDim = groupBy(rows, (r) => (typeof r[d.name] === "string" ? (r[d.name] as string) : null));
      for (const [val, rs] of byDim) {
        if (sum(rs, revenueCol.name) < total * 0.03) continue;
        const qs = [0, 1, 2, 3].map((i) => sum(rs.filter((r) => r[dateCol.name] instanceof Date && q(r) === i), revenueCol.name));
        for (let i = 1; i < 4; i++) {
          if (!qs[i - 1]) continue;
          const ch = (qs[i] - qs[i - 1]) / qs[i - 1];
          // Q4 kampanya etkisi her yerde olduğundan sadece Q2→Q3 ve Q1→Q2 düşüşlerine bak
          if (ch < -0.3 && i < 3)
            findings.push({ id: `drop-${d.name}-${val}-q${i + 1}`, score: Math.abs(ch) * 4,
              fact: `${d.name} = ${val}: ${revenueCol.name} ${i}. çeyrekte ${money(qs[i - 1])}, ${i + 1}. çeyrekte ${money(qs[i])} (%${fmt(ch * 100)}).` });
        }
      }
    }
  }

  // Evet/Hayır bayrak sütunlarında oran uçları (ör. iade)
  for (const f of flags) {
    const isYes = (r: Row) => YES.has(normalizeTr(String(r[f.name] ?? "")));
    const overall = rows.filter(isYes).length / rows.length;
    for (const d of dims) {
      if (d === f) continue;
      for (const [val, rs] of groupBy(rows, (r) => (typeof r[d.name] === "string" ? (r[d.name] as string) : null))) {
        if (rs.length < 40) continue;
        const rate = rs.filter(isYes).length / rs.length;
        if (rate > overall * 2.5 && rate > 0.1)
          findings.push({ id: `flag-${f.name}-${val}`, score: (rate / overall) * 0.9,
            fact: `${d.name} = ${val}: "${f.name}" oranı %${fmt(rate * 100)} (genel ortalama %${fmt(overall * 100)}, ${rs.length} satır).` });
      }
    }
  }

  // Düşük puanlı 1-5 sütunları
  const score = columns.find((c) => c.type === "number" && /memnuniyet|puan|skor|rating/i.test(c.name));
  if (score) {
    for (const d of dims) {
      if (flags.includes(d)) continue;
      for (const [val, rs] of groupBy(rows, (r) => (typeof r[d.name] === "string" ? (r[d.name] as string) : null))) {
        const vals = rs.map((r) => r[score.name]).filter((v): v is number => typeof v === "number");
        if (vals.length < 40) continue;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (avg < 3)
          findings.push({ id: `score-${val}`, score: 2, fact: `${d.name} = ${val}: ortalama ${score.name} ${fmt(avg)} / 5.` });
      }
    }
  }

  // Zarar eden satırlar
  if (profitCol) {
    const neg = rows.filter((r) => typeof r[profitCol.name] === "number" && (r[profitCol.name] as number) < 0);
    if (neg.length) {
      const disc = columns.find((c) => /indirim/i.test(c.name));
      const avgDisc = disc ? neg.reduce((a, r) => a + ((r[disc.name] as number) || 0), 0) / neg.length : null;
      findings.push({ id: "negative-profit", score: 2.2,
        fact: `${neg.length} satırda ${profitCol.name} negatif (toplam ${money(sum(neg, profitCol.name))})${avgDisc !== null ? `; bu satırlarda ortalama indirim %${fmt(avgDisc)}` : ""}.` });
    }
  }

  // Başka sayfadaki hedeflerle karşılaştırma (ör. Temsilciler → Yıllık Hedef)
  if (revenueCol) {
    for (const other of wb.sheets) {
      if (other === sheet) continue;
      const target = other.columns.find((c) => c.kind === "currency" && /hedef|target|kota/i.test(c.name));
      const key = other.columns.find((c) => c.type === "text" && columns.some((m) => m.name === c.name));
      if (!target || !key) continue;
      const actual = groupBy(rows, (r) => (typeof r[key.name] === "string" ? (r[key.name] as string) : null));
      const targets = groupBy(other.rows, (r) => (typeof r[key.name] === "string" ? (r[key.name] as string) : null));
      const ratios = [...targets.entries()]
        .filter(([k]) => actual.has(k))
        .map(([k, rs]) => ({ k, p: sum(actual.get(k)!, revenueCol.name) / sum(rs, target.name) }))
        .filter((x) => Number.isFinite(x.p))
        .sort((a, b) => b.p - a.p);
      if (ratios.length < 3) continue;
      const top = ratios[0], low = ratios[ratios.length - 1];
      findings.push({ id: `target-${key.name}`, score: Math.max(top.p - 1, 1 - low.p) * 6,
        fact: `"${other.name}" sayfasındaki ${target.name} ile karşılaştırınca: en yüksek ${top.k} hedefin %${fmt(top.p * 100)}'i, en düşük ${low.k} %${fmt(low.p * 100)}'i (${key.name}).` });
    }
  }

  // Kanal payı değişimi (yılın başı vs sonu)
  if (dateCol && revenueCol) {
    for (const d of dims) {
      const vals = new Set(rows.map((r) => r[d.name]));
      if (vals.size > 5) continue;
      const first = rows.filter((r) => r[dateCol.name] instanceof Date && (r[dateCol.name] as Date).getMonth() < 2);
      const last = rows.filter((r) => r[dateCol.name] instanceof Date && (r[dateCol.name] as Date).getMonth() > 9);
      for (const v of vals) {
        if (typeof v !== "string") continue;
        const a = sum(first.filter((r) => r[d.name] === v), revenueCol.name) / sum(first, revenueCol.name);
        const b = sum(last.filter((r) => r[d.name] === v), revenueCol.name) / sum(last, revenueCol.name);
        if (b - a > 0.1)
          findings.push({ id: `share-${v}`, score: (b - a) * 10,
            fact: `${d.name} = ${v}: ${revenueCol.name} payı yılın başında %${fmt(a * 100)}, sonunda %${fmt(b * 100)}.` });
      }
    }
  }

  findings.sort((a, b) => b.score - a.score);

  const schema = columns.map((c) => ({
    name: c.name, type: c.type, kind: c.kind,
    samples: [...new Set(rows.slice(0, 200).map((r) => r[c.name]))].slice(0, 4).map((v) =>
      v instanceof Date ? v.toISOString().slice(0, 10) : String(v)),
  }));

  return { sheet: sheet.name, rowCount: rows.length, dateRange, kpis, quality, findings: findings.slice(0, 14), schema };
}
