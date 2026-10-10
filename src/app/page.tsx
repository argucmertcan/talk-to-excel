"use client";
import { useMemo, useState } from "react";
import { Uploader } from "@/components/Uploader";
import { DataGrid } from "@/components/DataGrid";
import { readWorkbook } from "@/lib/workbook";
import { formatNumber } from "@/lib/format";
import { profileWorkbook } from "@/lib/profile";
import { InsightPanel, type InsightState } from "@/components/InsightPanel";
import type { Workbook } from "@/lib/types";

export default function Home() {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightState>({});
  const profile = useMemo(() => (wb ? profileWorkbook(wb) : null), [wb]);

  async function onFile(f: File) {
    setLoading(true);
    try {
      const book = await readWorkbook(f);
      const p = profileWorkbook(book);
      setWb(book);
      setActive(book.sheets.findIndex((s) => s.name === p.sheet));
      setInsights({});
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

  const sheet = wb?.sheets[active];

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
                  onClick={() => setActive(i)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${i === active ? "bg-panel-2 text-white" : "text-muted hover:text-white"}`}
                >
                  {s.name}
                </button>
              ))}
            </nav>
            <span className="ml-auto text-sm text-muted">
              {formatNumber(sheet?.rows.length ?? 0)} satır · {sheet?.columns.length} sütun
            </span>
          </>
        )}
      </header>
      {sheet && profile ? (
        <div className="flex min-h-0 flex-1 gap-4 p-4">
          <section className="min-w-0 flex-1">
            <DataGrid columns={sheet.columns} rows={sheet.rows} />
          </section>
          <aside className="scroll-thin w-[400px] shrink-0 overflow-y-auto rounded-2xl border border-line bg-panel p-4">
            <InsightPanel profile={profile} state={insights} />
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
