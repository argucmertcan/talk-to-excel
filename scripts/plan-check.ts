// Geliştirme aracı: doğal dil komutlarını uçtan uca dener (plan → uygula → cevap).
import { readFileSync } from "node:fs";
import { readWorkbook } from "../src/lib/workbook";
import { describeOp, withIds, type Op } from "../src/lib/ops";
import { profileWorkbook, mainSheet } from "../src/lib/profile";
import { runCommand, type Turn } from "../src/lib/assistant";

(async () => {
  const buf = readFileSync("demo/nova_elektronik_satis_2025.xlsx");
  const wb = await readWorkbook(new File([buf], "nova_elektronik_satis_2025.xlsx"));
  const sheet = mainSheet(wb);
  const quality = profileWorkbook(wb).quality.map((q) => q.message);
  const rows = withIds(sheet);
  let steps: Op[][] = [];
  const history: Turn[] = [];
  for (const message of process.argv.slice(2)) {
    const r = await runCommand({ base: "http://localhost:3210", message, wb, sheet, rows, steps, history, quality });
    steps = r.steps;
    console.log(`\n>>> ${message}  (${r.ms} ms, mode=${r.mode}${r.retried ? ", DÜZELTİLDİ" : ""})\n    ${r.reply}`);
    steps.flat().forEach((o) => console.log("    •", describeOp(o)));
    if (r.view.errors.length) console.log("    ! HATALAR:", r.view.errors);
    console.log(`    → ${r.view.rows.length} satır | ${r.view.columns.map((c) => c.name).slice(-4).join(" | ")} | vurgulu: ${r.view.highlights.size}${r.view.chart ? ` | grafik: ${r.view.chart.chart} ${r.view.chart.x} × ${r.view.chart.ys.join(", ")}` : ""}`);
    if (r.answer) console.log("    CEVAP:", r.answer);
    history.push({ role: "user", content: message }, { role: "assistant", content: r.answer ?? r.reply });
  }
})();
