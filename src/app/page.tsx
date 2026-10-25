"use client";
import { useMemo, useState } from "react";
import { Uploader } from "@/components/Uploader";
import { DataGrid } from "@/components/DataGrid";
import { InsightPanel, type InsightState } from "@/components/InsightPanel";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { ChartPanel } from "@/components/ChartPanel";
import { ReportView } from "@/components/ReportView";
import { downloadWorkbook } from "@/lib/export";
import type { Report } from "@/app/api/report/route";
import { AnimatePresence, motion } from "framer-motion";
import { readWorkbook } from "@/lib/workbook";
import { formatNumber } from "@/lib/format";
import { breakdown, monthlySeries, profileWorkbook } from "@/lib/profile";
import { applyOps, describeOp, withIds, type Op, type View } from "@/lib/ops";
import { runCommand, type Turn } from "@/lib/assistant";
import type { Workbook } from "@/lib/types";

/** Komut sonrası tablonun kayacağı sütun: yeni sütun > renklendirilen sütun > sıralanan sütun */
function focusOf(ops: Op[]): string | null {
  for (const o of [...ops].reverse()) if (o.type === "add_column") return o.name;
  for (const o of [...ops].reverse()) if (o.type === "highlight") return o.column ?? o.conditions[0]?.column ?? null;
  for (const o of [...ops].reverse()) if (o.type === "sort") return o.column;
  return null;
}

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
  const [pulse, setPulse] = useState<number | undefined>(undefined);
  const [focus, setFocus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [chartHidden, setChartHidden] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<(Report & { ms?: number }) | null>(null);
  const [reportError, setReportError] = useState<string | undefined>();

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

  async function openReport() {
    if (!wb || !profile || !view) return;
    setReportOpen(true);
    setReport(null);
    setReportError(undefined);
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dosya: wb.fileName,
        donem: profile.dateRange,
        kpi: profile.kpis,
        olgular: profile.findings.map((f) => f.fact),
        veri_kalitesi: profile.quality.map((q) => q.message),
        icgoruler: insights.insights?.map((i) => `${i.title}: ${i.detail}`) ?? [],
        sohbet: history.filter((h) => h.role === "assistant").map((h) => h.content).slice(-6),
      }),
    }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    if (res.error) setReportError(res.error);
    else setReport(res);
  }

  const reportDim = useMemo(() => {
    const main = wb?.sheets.find((x) => x.name === profile?.sheet);
    const text = main?.columns.filter((c) => c.type === "text") ?? [];
    return (text.find((c) => /bölge|region|şehir|kategori/i.test(c.name)) ?? text[0])?.name ?? "";
  }, [wb, profile]);

  function exportExcel() {
    if (!wb || !view || !profile) return;
    downloadWorkbook({
      fileName: wb.fileName.replace(/\.xlsx?$/i, "") + "_analiz.xlsx",
      report,
      kpis: profile.kpis,
      view: { columns: view.columns, rows: view.rows },
      steps: ops.map(describeOp),
    });
  }

  async function send(text: string) {
    if (!wb || !sheet || !profile) return;
    if (/\brapor/i.test(text)) {
      setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "Yönetici raporunu hazırlıyorum…" }]);
      openReport();
      return;
    }
    setTab("sohbet");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const r = await runCommand({
        base: "", message: text, wb, sheet, rows: baseRows, steps, history,
        quality: profile.quality.map((q) => q.message),
      });
      setSteps(r.steps);
      afterChange(r.newOps, view, r.view);
      setMessages((m) => [...m, { role: "assistant", text: r.reply, answer: r.answer, ops: r.newOps.map(describeOp), ms: r.ms }]);
      setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: r.answer ?? r.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // Komuttan sonra: hangi sütuna odaklanılacak, ne değişti
  function afterChange(newOps: Op[], before: View | null, after: View) {
    setFocus(focusOf(newOps));
    setPulse((p) => (p ?? 0) + 1);
    setChartHidden(false);
    const parts: string[] = [];
    if (before && after.rows.length !== before.rows.length && !after.grouped) parts.push(`${formatNumber(after.rows.length)} satır`);
    if (after.highlights.size && after.highlights.size !== before?.highlights.size) parts.push(`${formatNumber(after.highlights.size)} satır boyandı`);
    const added = [...after.newColumns].filter((c) => !before?.newColumns.has(c));
    if (added.length && !after.grouped) parts.push(`+ ${added.join(", ")}`);
    if (after.grouped && !before?.grouped) parts.push(`${after.rows.length} gruplu özet`);
    setToast(parts.join(" · ") || null);
    setTimeout(() => setToast(null), 3200);
  }

  function undo() {
    const next = steps.slice(0, -1);
    const after = wb && sheet ? applyOps(wb, sheet, baseRows, next.flat()) : null;
    setSteps(next);
    if (after) afterChange([], view, after);
  }

  function reset() {
    setSteps([]);
    setPulse((p) => (p ?? 0) + 1);
    setFocus(null);
  }

  return (
    <>
    <main className="app-shell flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line px-6">
        <div className="flex shrink-0 items-center gap-2 text-lg font-semibold md:text-[1.771875rem]">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-ink">X</span>
          <div className="flex flex-col gap-0.5">
            <span className="leading-none">Talk to Excel</span>
            <span className="text-[0.7rem] font-normal leading-none text-muted">Beta</span>
          </div>
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
            <button onClick={exportExcel} className="rounded-xl border border-line px-3 py-2 text-sm text-muted hover:text-white">
              ⤓ Excel
            </button>
            <button onClick={openReport} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-2">
              Rapor oluştur
            </button>
          </>
        )}
      </header>
      {sheet && profile && view ? (
        <div className="flex min-h-0 flex-1 gap-4 p-4">
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            {ops.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <AnimatePresence initial={false}>
                  {steps.map((step, si) =>
                    step.map((o, i) => (
                      <motion.span
                        key={`${si}-${i}-${describeOp(o)}`}
                        initial={{ opacity: 0, scale: 0.8, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ delay: i * 0.12 }}
                        className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 font-mono text-xs text-accent-2"
                      >
                        {describeOp(o)}
                      </motion.span>
                    )),
                  )}
                </AnimatePresence>
                <span className="ml-auto flex gap-1.5">
                  <button onClick={undo} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-white">↶ Geri al</button>
                  <button onClick={reset} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-white">Sıfırla</button>
                </span>
              </div>
            )}
            {view.errors.length > 0 && <p className="text-sm text-rose-300">{view.errors.join(" · ")}</p>}
            {view.chart && !chartHidden && <ChartPanel key={pulse} view={view} onClose={() => setChartHidden(true)} />}
            <div className="relative min-h-0 flex-1">
              <DataGrid
                columns={view.columns}
                rows={view.rows}
                highlights={view.highlights}
                newColumns={view.newColumns}
                focusColumn={focus}
                pulse={pulse}
              />
              <AnimatePresence>
                {toast && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: 10, x: "-50%" }}
                    className="pointer-events-none absolute bottom-6 left-1/2 z-20 rounded-full border border-accent/40 bg-ink/90 px-4 py-2 text-sm font-medium text-accent-2 shadow-xl backdrop-blur"
                  >
                    {toast}
                  </motion.div>
                )}
              </AnimatePresence>
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
    {reportOpen && wb && sheet && profile && (
      <ReportView
        fileName={wb.fileName}
        report={report}
        error={reportError}
        kpis={profile.kpis}
        monthly={monthlySeries(wb.sheets.find((x) => x.name === profile.sheet)!)}
        regions={breakdown(wb.sheets.find((x) => x.name === profile.sheet)!, reportDim).slice(0, 8)}
        dimLabel={reportDim}
        view={view ? { columns: view.columns, rows: view.rows } : null}
        steps={ops.map(describeOp)}
        onClose={() => setReportOpen(false)}
        onExcel={exportExcel}
      />
    )}
    </>
  );
}
