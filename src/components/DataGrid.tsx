"use client";
import { useMemo, useRef, useState } from "react";
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

export function colWidth(c: Column) {
  const base = Math.max(c.name.length * 8.5 + 32, 90);
  if (c.kind === "currency") return Math.max(base, 150);
  if (c.type === "date") return Math.max(base, 110);
  if (c.type === "text") return Math.max(base, 140);
  return base;
}

export function DataGrid({
  columns, rows, highlights, newColumns,
}: { columns: Column[]; rows: Row[]; highlights?: Map<string, Highlight[]>; newColumns?: Set<string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(800);

  const widths = useMemo(() => columns.map(colWidth), [columns]);
  const total = widths.reduce((a, b) => a + b, 0) + 64;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el && el.clientHeight !== height) setHeight(el.clientHeight);
      }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="scroll-thin relative h-full overflow-auto rounded-2xl border border-line bg-panel"
    >
      <div style={{ width: total, height: (rows.length + 1) * ROW_H }} className="relative">
        <div className="sticky top-0 z-10 flex border-b border-line bg-panel-2 text-[13px] font-semibold text-muted" style={{ height: ROW_H }}>
          <div className="sticky left-0 z-10 flex w-16 shrink-0 items-center justify-center bg-panel-2">#</div>
          {columns.map((c, i) => (
            <div key={c.name} style={{ width: widths[i] }} className={`flex shrink-0 items-center px-3 ${c.type === "number" ? "justify-end" : ""} ${newColumns?.has(c.name) ? "text-accent-2" : ""}`}>
              <span className="truncate">{c.name}</span>
            </div>
          ))}
        </div>
        {rows.slice(start, end).map((r, k) => {
          const i = start + k;
          const hs = highlights?.get(String(r[ID])) ?? [];
          const rowColor = hs.find((h) => !h.column)?.color;
          return (
            <div
              key={String(r[ID] ?? i)}
              className={`absolute left-0 flex border-b border-line/50 text-[13px] transition-colors duration-500 hover:bg-white/[0.03] ${rowColor ? ROW_BG[rowColor] : ""}`}
              style={{ top: (i + 1) * ROW_H, height: ROW_H, width: total }}
            >
              <div className="sticky left-0 flex w-16 shrink-0 items-center justify-center bg-panel font-mono text-[11px] text-muted">
                {rowColor && <span className={`absolute left-0 top-0 h-full w-1 ${BAR[rowColor]}`} />}
                {i + 1}
              </div>
              {columns.map((c, j) => {
                const cell = hs.find((h) => h.column === c.name)?.color;
                return (
                  <div
                    key={c.name}
                    style={{ width: widths[j] }}
                    className={`flex shrink-0 items-center px-3 transition-colors duration-500 ${c.type === "number" ? "justify-end font-mono tabular-nums" : ""} ${cell ? CELL_FG[cell] : ""} ${newColumns?.has(c.name) ? "bg-accent/[0.06]" : ""}`}
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
  );
}
