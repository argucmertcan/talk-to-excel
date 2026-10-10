// Bir sohbet komutunun uçtan uca akışı: plan → uygula → (hata varsa bir kez düzelt) → (soruysa) cevap.
// Hem arayüz hem de terminal test aracı bunu kullanır.
import { applyOps, type Condition, type Op, type View } from "./ops";
import { normalizeTr } from "./profile";
import { buildContext, resultPreview } from "./context";
import type { Row, Sheet, Workbook } from "./types";

export interface Turn { role: "user" | "assistant"; content: string }
export interface CommandResult {
  steps: Op[][];
  reply: string;
  answer?: string;
  mode: string;
  ms: number;
  retried: boolean;
  newOps: Op[];
  view: View;
}

interface Plan { reply: string; mode: string; ops: Op[]; needsAnswer: boolean; ms: number; error?: string }

export async function runCommand(opts: {
  base: string; // API kökü ("" tarayıcıda)
  message: string;
  wb: Workbook;
  sheet: Sheet;
  rows: Row[];
  steps: Op[][];
  history: Turn[];
  quality: string[];
}): Promise<CommandResult> {
  const { base, message, wb, sheet, rows, history, quality } = opts;
  const post = (path: string, body: object) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  const plan = async (msg: string, steps: Op[][], hist: Turn[]): Promise<Plan> => {
    const ops = steps.flat();
    const view = applyOps(wb, sheet, rows, ops);
    const res = (await post("/api/plan", { message: msg, context: buildContext(wb, sheet, ops, view, quality), history: hist })) as Plan;
    if (res.error) throw new Error(res.error);
    return res;
  };
  // Yeni soruda (replace) önceki adımlardan kopyalanmış ve kullanıcının hiç anmadığı filtreleri at
  const dropCarried = (ops: Op[], prev: Op[][]) => {
    const old = new Set(prev.flat().flatMap((o) => (o.type === "filter" ? o.conditions.map((c) => JSON.stringify(c)) : [])));
    const msg = normalizeTr(message);
    const mentioned = (c: Condition) => [c.value, c.value2 ?? ""].some((v) => v && msg.includes(normalizeTr(v)));
    return ops
      .map((o) => (o.type === "filter" ? { ...o, conditions: o.conditions.filter((c) => !old.has(JSON.stringify(c)) || mentioned(c)) } : o))
      .filter((o) => o.type !== "filter" || o.conditions.length > 0);
  };
  const next = (steps: Op[][], p: Plan) => {
    if (p.mode === "replace") p = { ...p, ops: dropCarried(p.ops, steps) };
    let s = steps;
    if (p.mode === "replace" || p.mode === "reset") s = [];
    if (p.mode === "undo") s = s.slice(0, -1);
    if ((p.mode === "append" || p.mode === "replace") && p.ops.length) s = [...s, p.ops];
    return s;
  };

  let p = await plan(message, opts.steps, history);
  let ms = p.ms;
  let steps = next(opts.steps, p);
  let view = applyOps(wb, sheet, rows, steps.flat());
  let retried = false;
  // Hata ya da boş sonuç: modele geri bildirip planı bir kez yeniden kurdur
  const empty = view.rows.length === 0 && rows.length > 0;
  if ((view.errors.length || empty) && (p.mode === "append" || p.mode === "replace")) {
    retried = true;
    const problem = view.errors.length
      ? `uygulanamadı: ${view.errors.join("; ")}`
      : "0 satır döndürdü; filtre değerlerini bağlamdaki degerler/ornek listelerindeki yazımla ve doğru sütunla kontrol et";
    const fix = await plan(
      `HATA: "${message}" isteği için ürettiğin plan ${problem}. Aynı isteği düzeltilmiş planla yeniden üret.`,
      opts.steps,
      history,
    );
    ms += fix.ms;
    p = { ...fix, needsAnswer: p.needsAnswer || fix.needsAnswer };
    steps = next(opts.steps, p);
    view = applyOps(wb, sheet, rows, steps.flat());
  }

  let answer: string | undefined;
  if (p.needsAnswer && !view.errors.length) {
    const a = await post("/api/answer", { question: message, result: resultPreview(view) });
    answer = a.answer;
    ms += a.ms ?? 0;
  }
  return { steps, reply: p.reply, answer, mode: p.mode, ms, retried, newOps: p.ops, view };
}
