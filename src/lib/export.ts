import * as XLSX from "xlsx";
import type { Column, Row } from "./types";
import type { Kpi } from "./profile";
import type { Report } from "@/app/api/report/route";

function sheetFrom(columns: Column[], rows: Row[]) {
  const aoa = [columns.map((c) => c.name), ...rows.map((r) => columns.map((c) => r[c.name] ?? null))];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: "dd.mm.yyyy" });
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.name.length + 2, c.type === "text" ? 16 : 12) }));
  ws["!autofilter"] = { ref: ws["!ref"]! };
  return ws;
}

/** Rapor + mevcut görünüm + ham veri → tek .xlsx */
export function downloadWorkbook(opts: {
  fileName: string;
  report?: Report | null;
  kpis: Kpi[];
  view: { columns: Column[]; rows: Row[] };
  steps: string[];
}) {
  const wb = XLSX.utils.book_new();
  if (opts.report) {
    const r = opts.report;
    const aoa: (string | number)[][] = [
      [r.title], [],
      ["Yönetici Özeti"], [r.executiveSummary], [],
      ["Göstergeler"], ...opts.kpis.map((k) => [k.label, Math.round(k.value * 100) / 100]), [],
      ...r.sections.flatMap((s) => [[s.heading], [s.body], ...s.bullets.map((b) => ["• " + b]), []]),
      ["Öneriler", "Gerekçe", "Öncelik"], ...r.recommendations.map((x) => [x.action, x.why, x.priority]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 70 }, { wch: 60 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
  }
  const view = sheetFrom(opts.view.columns, opts.view.rows);
  XLSX.utils.book_append_sheet(wb, view, "Analiz");
  if (opts.steps.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Uygulanan işlemler"], ...opts.steps.map((s) => [s])]), "İşlemler");
  }
  XLSX.writeFile(wb, opts.fileName);
}
