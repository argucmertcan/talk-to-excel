"use client";
import { motion } from "framer-motion";
import type { Profile } from "@/lib/profile";
import type { Insight } from "@/app/api/insights/route";
import { formatCompact, formatNumber } from "@/lib/format";
import { CountUp } from "./CountUp";

const TONE: Record<Insight["tone"], { dot: string; ring: string }> = {
  positive: { dot: "bg-emerald-400", ring: "border-emerald-500/30" },
  negative: { dot: "bg-rose-400", ring: "border-rose-500/30" },
  warning: { dot: "bg-amber-400", ring: "border-amber-500/30" },
  info: { dot: "bg-sky-400", ring: "border-sky-500/30" },
};

export interface InsightState {
  summary?: string;
  insights?: Insight[];
  ms?: number;
  error?: string;
}

export function InsightPanel({ profile, state, onAsk }: { profile: Profile; state: InsightState; onAsk?: (q: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {profile.kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-line bg-panel-2 p-3"
          >
            <div className="text-xs text-muted">{k.label}</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
              <CountUp
                value={k.value}
                format={(n) => (k.kind === "plain" ? formatNumber(Math.round(n)) : formatCompact(n, k.kind))}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {profile.quality.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">Veri kalitesi</div>
          <ul className="space-y-1 text-[13px] text-amber-100/90">
            {profile.quality.map((q) => (
              <li key={q.message}>• {q.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Yapay zekâ içgörüleri</h3>
          {state.ms !== undefined && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent-2">
              Groq · {(state.ms / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn
            </span>
          )}
        </div>
        {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
        {!state.insights && !state.error && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-panel-2" />
            ))}
          </div>
        )}
        {state.summary && <p className="mb-3 text-[13px] leading-relaxed text-muted">{state.summary}</p>}
        <div className="space-y-2">
          {state.insights?.map((ins, i) => (
            <motion.div
              key={ins.title}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
              className={`rounded-xl border bg-panel-2 p-3 ${TONE[ins.tone].ring}`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[ins.tone].dot}`} />
                {ins.title}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{ins.detail}</p>
              {onAsk && (
                <button onClick={() => onAsk(ins.question)} className="mt-2 text-xs text-accent-2 hover:underline">
                  ↳ {ins.question}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
