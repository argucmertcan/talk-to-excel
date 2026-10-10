"use client";
import { useRef, useState } from "react";
import { motion } from "framer-motion";

const DEMO = "/demo/nova_elektronik_satis_2025.xlsx";

export function Uploader({ onFile, loading }: { onFile: (f: File) => void; loading: boolean }) {
  async function loadDemo(e: React.MouseEvent) {
    e.stopPropagation();
    const blob = await (await fetch(DEMO)).blob();
    onFile(new File([blob], DEMO.split("/").pop()!));
  }

  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        onClick={() => input.current?.click()}
        className={`w-full max-w-2xl cursor-pointer rounded-3xl border-2 border-dashed p-14 text-center transition ${
          over ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-accent/60"
        }`}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/15 text-4xl">
          📊
        </div>
        <h2 className="text-2xl font-semibold">Excel dosyanı buraya bırak</h2>
        <p className="mt-2 text-muted">.xlsx, .xls veya .csv — dosya tarayıcından çıkmaz</p>
        <div className="mt-8 inline-flex rounded-xl bg-accent px-6 py-3 font-medium text-ink">
          {loading ? "Okunuyor…" : "Dosya seç"}
        </div>
        <button onClick={loadDemo} className="mt-4 block w-full text-sm text-muted underline-offset-4 hover:text-white hover:underline">
          veya örnek dosyayla dene
        </button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </motion.div>
    </div>
  );
}
