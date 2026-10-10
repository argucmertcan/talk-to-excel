"use client";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Legend } from "recharts";
import type { Report } from "@/app/api/report/route";
import type { Kpi } from "@/lib/profile";
import type { Column, Row } from "@/lib/types";
import { formatCell, formatCompact, formatNumber } from "@/lib/format";

const PRIORITY: Record<string, string> = { Yüksek: "bg-rose-100 text-rose-700", Orta: "bg-amber-100 text-amber-700", Düşük: "bg-slate-100 text-slate-600" };
const LOADING = ["Veriler özetleniyor", "Bulgular sıralanıyor", "Groq raporu yazıyor"];

export function ReportView(props: {
  fileName: string;
  report: (Report & { ms?: number }) | null;
  error?: string;
  kpis: Kpi[];
  monthly: { ay: string; ciro: number; kar: number }[];
  regions: { ad: string; ciro: number }[];
  dimLabel: string;
  view: { columns: Column[]; rows: Row[] } | null;
  steps: string[];
  onClose: () => void;
  onExcel: () => void;
}) {
  const { report, kpis, monthly, regions, view, steps } = props;
  const today = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date());
  const tick = { fill: "#475569", fontSize: 11 };

  return (
    <div className="report-overlay fixed inset-0 z-50 overflow-y-auto bg-ink/80 backdrop-blur-sm">
      <div className="report-actions sticky top-0 z-10 flex justify-center gap-2 bg-gradient-to-b from-ink via-ink/80 to-transparent p-4 pb-8">
        <button onClick={() => window.print()} disabled={!report} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">PDF indir</button>
        <button onClick={props.onExcel} disabled={!report} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">Excel indir</button>
        <button onClick={props.onClose} className="rounded-xl border border-line bg-panel px-4 py-2 text-sm">Kapat</button>
      </div>
      <motion.article
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="report-paper mx-auto mb-16 w-[900px] max-w-[95vw] rounded-2xl bg-white p-12 text-slate-800 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-xs text-white">X</span>
              Talk to Excel · Yönetici Raporu
            </div>
            <h1 className="text-3xl font-bold leading-tight text-slate-900">{report?.title ?? "Rapor hazırlanıyor…"}</h1>
            <p className="mt-1 text-sm text-slate-500">{props.fileName} · {today}</p>
          </div>
          {report?.ms !== undefined && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 font-mono text-xs text-emerald-700">Groq · {(report.ms / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn</span>
          )}
        </header>

        <section className="mt-6 grid grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">{k.label}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900">
                {k.kind === "plain" ? formatNumber(k.value) : formatCompact(k.value, k.kind)}
              </div>
            </div>
          ))}
        </section>

        {!report && !props.error && (
          <div className="my-16 space-y-3">
            {LOADING.map((l, i) => (
              <motion.div key={l} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.5 }} className="flex items-center gap-3 text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> {l}…
              </motion.div>
            ))}
          </div>
        )}
        {props.error && <p className="my-10 text-rose-600">{props.error}</p>}

        {report && (
          <>
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-600">Yönetici Özeti</h2>
              <p className="text-[15px] leading-relaxed">{report.executiveSummary}</p>
            </section>

            <section className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-600">Aylık ciro ve kâr</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly} margin={{ left: 0, right: 8, top: 4 }}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="ay" tick={tick} />
                      <YAxis tick={tick} tickFormatter={(v) => formatCompact(v)} width={48} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line dataKey="ciro" name="Ciro" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                      <Line dataKey="kar" name="Kâr" stroke="#0ea5e9" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-600">{props.dimLabel} bazında ciro</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regions} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <XAxis type="number" tick={tick} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis type="category" dataKey="ad" tick={tick} width={110} />
                      <Bar dataKey="ciro" fill="#10b981" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {report.sections.map((s) => (
              <section key={s.heading} className="mt-8 break-inside-avoid">
                <h2 className="mb-1 text-lg font-bold text-slate-900">{s.heading}</h2>
                <p className="text-[15px] leading-relaxed text-slate-700">{s.body}</p>
                <ul className="mt-2 space-y-1">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-[14px] text-slate-700"><span className="text-emerald-500">▸</span>{b}</li>
                  ))}
                </ul>
              </section>
            ))}

            {view && steps.length > 0 && (
              <section className="mt-8 break-inside-avoid">
                <h2 className="mb-1 text-lg font-bold text-slate-900">Sohbette incelenen görünüm</h2>
                <p className="mb-2 text-xs text-slate-500">{steps.join(" → ")}</p>
                <table className="w-full text-left text-[12px]">
                  <thead><tr>{view.columns.slice(0, 7).map((c) => <th key={c.name} className="border-b border-slate-200 py-1 pr-3 font-semibold">{c.name}</th>)}</tr></thead>
                  <tbody>
                    {view.rows.slice(0, 12).map((r, i) => (
                      <tr key={i}>{view.columns.slice(0, 7).map((c) => <td key={c.name} className="border-b border-slate-100 py-1 pr-3">{formatCell(r[c.name], c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="mt-8 break-inside-avoid rounded-xl bg-emerald-50 p-5">
              <h2 className="mb-3 text-lg font-bold text-slate-900">Öneriler</h2>
              <ol className="space-y-2">
                {report.recommendations.map((r, i) => (
                  <li key={r.action} className="flex gap-3 text-[14px]">
                    <span className="font-mono font-bold text-emerald-600">{i + 1}.</span>
                    <div className="flex-1"><b>{r.action}</b> <span className="text-slate-600">— {r.why}</span></div>
                    <span className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY[r.priority]}`}>{r.priority}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </motion.article>
    </div>
  );
}
