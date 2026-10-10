"use client";
import { useState } from "react";
import { Uploader } from "@/components/Uploader";
import { DataGrid } from "@/components/DataGrid";
import { readWorkbook } from "@/lib/workbook";
import { formatNumber } from "@/lib/format";
import type { Workbook } from "@/lib/types";

export default function Home() {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  async function onFile(f: File) {
    setLoading(true);
    try {
      setWb(await readWorkbook(f));
      setActive(0);
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
      <section className="min-h-0 flex-1 p-4">
        {sheet ? <DataGrid columns={sheet.columns} rows={sheet.rows} /> : <Uploader onFile={onFile} loading={loading} />}
      </section>
    </main>
  );
}
