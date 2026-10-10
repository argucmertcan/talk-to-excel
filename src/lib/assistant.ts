// Bir sohbet komutunun uçtan uca akışı: plan → uygula → (hata varsa bir kez düzelt) → (soruysa) cevap.
// Hem arayüz hem de terminal test aracı bunu kullanır.
import { applyOps, type Op, type View } from "./ops";
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
  const next = (steps: Op[][], p: Plan) => {
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
  if (view.errors.length && (p.mode === "append" || p.mode === "replace")) {
    retried = true;
    const fix = await plan(
      `HATA: "${message}" isteği için ürettiğin plan uygulanamadı: ${view.errors.join("; ")}. Aynı isteği düzeltilmiş planla yeniden üret.`,
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
