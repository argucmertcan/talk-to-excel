"use client";
import { useMemo, useState } from "react";
import { Uploader } from "@/components/Uploader";
import { DataGrid } from "@/components/DataGrid";
import { InsightPanel, type InsightState } from "@/components/InsightPanel";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { readWorkbook } from "@/lib/workbook";
import { formatNumber } from "@/lib/format";
import { profileWorkbook } from "@/lib/profile";
import { applyOps, describeOp, withIds, type Op } from "@/lib/ops";
import { runCommand, type Turn } from "@/lib/assistant";
import type { Workbook } from "@/lib/types";

export default function Home() {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightState>({});
  const [tab, setTab] = useState<"analiz" | "sohbet">("analiz");
  const [steps, setSteps] = useState<Op[][]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  const profile = useMemo(() => (wb ? profileWorkbook(wb) : null), [wb]);
  const sheet = wb?.sheets[active];
  const baseRows = useMemo(() => (sheet ? withIds(sheet) : []), [sheet]);
  const ops = useMemo(() => steps.flat(), [steps]);
  const view = useMemo(() => (wb && sheet ? applyOps(wb, sheet, baseRows, ops) : null), [wb, sheet, baseRows, ops]);

  async function onFile(f: File) {
    setLoading(true);
    try {
      const book = await readWorkbook(f);
      const p = profileWorkbook(book);
      setWb(book);
      setActive(book.sheets.findIndex((s) => s.name === p.sheet));
      setInsights({});
      setSteps([]);
      setMessages([]);
      setHistory([]);
      setTab("analiz");
      fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: book.fileName, profile: p }),
      })
        .then((r) => r.json())
        .then((d) => setInsights(d.error ? { error: d.error } : d))
        .catch((e) => setInsights({ error: String(e) }));
    } finally {
      setLoading(false);
    }
  }

  async function send(text: string) {
    if (!wb || !sheet || !profile) return;
    setTab("sohbet");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const r = await runCommand({
        base: "", message: text, wb, sheet, rows: baseRows, steps, history,
        quality: profile.quality.map((q) => q.message),
      });
      setSteps(r.steps);
      setMessages((m) => [...m, { role: "assistant", text: r.reply, answer: r.answer, ops: r.newOps.map(describeOp), ms: r.ms }]);
      setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: r.answer ?? r.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line px-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-ink">X</span>
          Talk to Excel
        </div>
        {wb && (
          <>
            <span className="text-muted">/</span>
            <span className="truncate text-sm text-muted">{wb.fileName}</span>
            <nav className="ml-6 flex gap-1">
              {wb.sheets.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => { setActive(i); setSteps([]); }}
                  className={`rounded-lg px-3 py-1.5 text-sm ${i === active ? "bg-panel-2 text-white" : "text-muted hover:text-white"}`}
                >
                  {s.name}
                </button>
              ))}
            </nav>
            <span className="ml-auto text-sm text-muted">
              {formatNumber(view?.rows.length ?? 0)} satır · {view?.columns.length} sütun
            </span>
          </>
        )}
      </header>
      {sheet && profile && view ? (
        <div className="flex min-h-0 flex-1 gap-4 p-4">
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            {ops.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {ops.map((o, i) => (
                  <span key={i} className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 font-mono text-xs text-accent-2">
                    {describeOp(o)}
                  </span>
                ))}
              </div>
            )}
            {view.errors.length > 0 && <p className="text-sm text-rose-300">{view.errors.join(" · ")}</p>}
            <div className="min-h-0 flex-1">
              <DataGrid columns={view.columns} rows={view.rows} highlights={view.highlights} newColumns={view.newColumns} />
            </div>
          </section>
          <aside className="flex w-[420px] shrink-0 flex-col rounded-2xl border border-line bg-panel p-4">
            <div className="mb-3 flex gap-1 rounded-xl bg-ink p-1">
              {(["analiz", "sohbet"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg py-1.5 text-sm capitalize ${tab === t ? "bg-panel-2 font-semibold text-white" : "text-muted"}`}
                >
                  {t === "analiz" ? "Analiz" : "Sohbet"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {tab === "analiz" ? (
                <div className="scroll-thin h-full overflow-y-auto pr-1">
                  <InsightPanel profile={profile} state={insights} onAsk={send} />
                </div>
              ) : (
                <ChatPanel messages={messages} busy={busy} onSend={send} />
              )}
            </div>
          </aside>
        </div>
      ) : (
        <section className="min-h-0 flex-1 p-4">
          <Uploader onFile={onFile} loading={loading} />
        </section>
      )}
    </main>
  );
}
