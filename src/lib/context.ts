import type { Sheet, Workbook } from "./types";
import { describeOp, type Op, type View } from "./ops";
import { formatCell } from "./format";

const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Groq'a giden bağlam: veri değil, şema + örnekler + mevcut durum. */
export function buildContext(wb: Workbook, sheet: Sheet, ops: Op[], view: View, quality: string[] = []) {
  const sample = sheet.rows.slice(0, 2000);
  const columns = sheet.columns.map((c) => {
    const uniq = [...new Set(sample.map((r) => r[c.name]).filter((v) => v !== null && v !== ""))];
    const fmt = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
    const nums = uniq.filter((v): v is number => typeof v === "number");
    return {
      ad: c.name,
      tip: c.type,
      ...(c.type === "text" && uniq.length <= 40
        ? { degerler: uniq.map(fmt) }
        : { ornek: uniq.slice(0, 3).map(fmt) }),
      ...(nums.length ? { aralik: [Math.min(...nums), Math.max(...nums)] } : {}),
      ...(c.type === "date"
        ? (() => {
            const ts = sheet.rows.map((r) => r[c.name]).filter((v): v is Date => v instanceof Date).map((d) => d.getTime());
            return { tarih_araligi: [fmtDate(Math.min(...ts)), fmtDate(Math.max(...ts))] };
          })()
        : {}),
    };
  });
  return {
    dosya: wb.fileName,
    aktif_sayfa: sheet.name,
    satir: sheet.rows.length,
    sutunlar: columns,
    diger_sayfalar: wb.sheets.filter((s) => s !== sheet).map((s) => ({ ad: s.name, sutunlar: s.columns.map((c) => c.name) })),
    veri_kalitesi: quality,
    mevcut_islemler: ops.map((o) => ({ ozet: describeOp(o), islem: o })),
    mevcut_gorunum: { satir: view.rows.length, sutunlar: view.columns.map((c) => c.name) },
  };
}

/** Cevap adımı için sonuç tablosunun küçük bir kesiti */
export function resultPreview(view: View, max = 25) {
  return {
    toplam_satir: view.rows.length,
    sutunlar: view.columns.map((c) => c.name),
    satirlar: view.rows.slice(0, max).map((r) =>
      Object.fromEntries(view.columns.map((c) => {
        return [c.name, formatCell(r[c.name], c)];
      })),
    ),
  };
}
