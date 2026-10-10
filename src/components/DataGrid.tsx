"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Column, Row } from "@/lib/types";
import { formatCell } from "@/lib/format";
import { ID, type Color, type Highlight } from "@/lib/ops";

export const ROW_BG: Record<Color, string> = {
  red: "bg-rose-500/15", green: "bg-emerald-500/15", yellow: "bg-amber-400/15", blue: "bg-sky-500/15",
};
export const CELL_FG: Record<Color, string> = {
  red: "bg-rose-500/30 text-rose-100", green: "bg-emerald-500/30 text-emerald-100",
  yellow: "bg-amber-400/30 text-amber-100", blue: "bg-sky-500/30 text-sky-100",
};
export const BAR: Record<Color, string> = {
  red: "bg-rose-400", green: "bg-emerald-400", yellow: "bg-amber-300", blue: "bg-sky-400",
};

const ROW_H = 34;
const OVERSCAN = 12;
const NUM_W = 64;

export function colWidth(c: Column) {
  const base = Math.max(c.name.length * 8.5 + 32, 90);
  if (c.kind === "currency") return Math.max(base, 150);
  if (c.type === "date") return Math.max(base, 110);
  if (c.type === "text") return Math.max(base, 140);
  return base;
}

export function DataGrid({
  columns, rows, highlights, newColumns, focusColumn, pulse,
}: {
  columns: Column[];
  rows: Row[];
  highlights?: Map<string, Highlight[]>;
  newColumns?: Set<string>;
  /** komuttan sonra görünür alana kaydırılacak sütun */
  focusColumn?: string | null;
  /** her komutta değişir; animasyonları yeniden tetikler */
  pulse?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(800);

  const widths = useMemo(() => columns.map(colWidth), [columns]);
  const total = widths.reduce((a, b) => a + b, 0) + NUM_W;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN);

  // Komuttan sonra ilgili sütuna yumuşak kaydır, satırları başa al
  useEffect(() => {
    const el = ref.current;
    if (!el || pulse === undefined) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
    if (!focusColumn) return;
    const idx = columns.findIndex((c) => c.name === focusColumn);
    if (idx < 0) return;
    const x = NUM_W + widths.slice(0, idx).reduce((a, b) => a + b, 0);
    const target = Math.max(0, x - el.clientWidth / 2 + widths[idx] / 2);
    el.scrollTo({ left: target, top: 0, behavior: "smooth" });
  }, [pulse]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kaydırma çubuğu yanında vurgulu satırların haritası
  const ticks = useMemo(() => {
    if (!highlights?.size || rows.length === 0) return [];
    const out: { top: number; color: Color }[] = [];
    rows.forEach((r, i) => {
      const h = highlights.get(String(r[ID]));
      if (h?.length) out.push({ top: i / rows.length, color: h[0].color });
    });
    return out;
  }, [highlights, rows]);

  return (
    <div className="relative h-full">
      <div
        ref={(el) => {
          ref.current = el;
          if (el && el.clientHeight !== height) setHeight(el.clientHeight);
        }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="scroll-thin relative h-full overflow-auto rounded-2xl border border-line bg-panel"
      >
        <div key={pulse} style={{ width: total, height: (rows.length + 1) * ROW_H }} className="relative animate-[gridIn_.35s_ease-out]">
          <div className="sticky top-0 z-10 flex border-b border-line bg-panel-2 text-[13px] font-semibold text-muted" style={{ height: ROW_H, width: total }}>
            <div className="sticky left-0 z-10 flex shrink-0 items-center justify-center bg-panel-2" style={{ width: NUM_W }}>#</div>
            {columns.map((c, i) => {
              const isNew = newColumns?.has(c.name);
              const isFocus = c.name === focusColumn;
              return (
                <div
                  key={c.name}
                  style={{ width: widths[i] }}
                  className={`flex shrink-0 items-center px-3 ${c.type === "number" ? "justify-end" : ""} ${isNew ? "text-accent-2" : ""} ${isFocus ? "animate-[headPulse_1.6s_ease-out]" : ""}`}
                >
                  {isNew && <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  <span className="truncate">{c.name}</span>
                </div>
              );
            })}
          </div>
          {rows.slice(start, end).map((r, k) => {
            const i = start + k;
            const hs = highlights?.get(String(r[ID])) ?? [];
            const rowColor = hs.find((h) => !h.column)?.color;
            return (
              <div
                key={String(r[ID] ?? i)}
                className={`absolute left-0 flex border-b border-line/50 text-[13px] transition-colors duration-700 hover:bg-white/[0.03] ${rowColor ? ROW_BG[rowColor] : ""}`}
                style={{ top: (i + 1) * ROW_H, height: ROW_H, width: total }}
              >
                <div className="sticky left-0 flex shrink-0 items-center justify-center bg-panel font-mono text-[11px] text-muted" style={{ width: NUM_W }}>
                  {rowColor && <span className={`absolute left-0 top-0 h-full w-1 ${BAR[rowColor]}`} />}
                  {i + 1}
                </div>
                {columns.map((c, j) => {
                  const cell = hs.find((h) => h.column === c.name)?.color;
                  const isNew = newColumns?.has(c.name);
                  return (
                    <div
                      key={c.name}
                      style={{ width: widths[j], animationDelay: isNew ? `${Math.min(k, 30) * 18}ms` : undefined }}
                      className={`flex shrink-0 items-center px-3 transition-colors duration-700 ${c.type === "number" ? "justify-end font-mono tabular-nums" : ""} ${cell ? CELL_FG[cell] : ""} ${isNew ? "bg-accent/[0.06] animate-[cellIn_.5s_ease-out_both]" : ""}`}
                    >
                      <span className="truncate">{formatCell(r[c.name], c)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {ticks.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-[3px] top-[38px] w-[6px]">
          {ticks.map((t, i) => (
            <span key={i} className={`absolute left-0 h-[2px] w-full rounded ${BAR[t.color]}`} style={{ top: `${t.top * 100}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}
