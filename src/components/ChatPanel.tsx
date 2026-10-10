"use client";
import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  answer?: string;
  ops?: string[];
  ms?: number;
  error?: boolean;
}

const SUGGESTIONS = [
  "Zarar eden siparişleri kırmızı yap",
  "Kâr marjı sütunu ekle",
  "Bölgelere göre ciro ve kârı göster",
  "Hangi ürünün iade oranı en yüksek?",
];

export function ChatPanel({ messages, busy, onSend }: { messages: ChatMessage[]; busy: boolean; onSend: (t: string) => void }) {
  const [text, setText] = useState("");
  const [rec, setRec] = useState<"idle" | "rec" | "busy">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Sesli komut: bas-konuş-bırak → Groq Whisper → komut olarak gönder
  async function toggleMic() {
    if (rec === "rec") {
      recorder.current?.stop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRec("busy");
      const form = new FormData();
      form.append("audio", new Blob(chunks, { type: mr.mimeType }));
      try {
        const r = await fetch("/api/transcribe", { method: "POST", body: form }).then((r) => r.json());
        if (r.text) send(r.text);
      } finally {
        setRec("idle");
      }
    };
    recorder.current = mr;
    mr.start();
    setRec("rec");
  }
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = (t: string) => {
    if (!t.trim() || busy) return;
    onSend(t.trim());
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted">Tabloya ne yapmak istediğini yaz:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-accent/60">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm font-medium text-ink">{m.text}</div>
          ) : (
            <div key={i} className={`mr-4 rounded-2xl rounded-bl-md border px-3 py-2 text-sm ${m.error ? "border-rose-500/40 text-rose-200" : "border-line bg-panel-2"}`}>
              <p>{m.text}</p>
              {m.answer && <p className="mt-2 font-medium text-white">{m.answer}</p>}
              {m.ops && m.ops.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.ops.map((o) => (
                    <span key={o} className="rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] text-accent-2">{o}</span>
                  ))}
                </div>
              )}
              {m.ms !== undefined && <div className="mt-1 text-right font-mono text-[10px] text-muted">{(m.ms / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} sn</div>}
            </div>
          ),
        )}
        {busy && (
          <div className="mr-4 flex gap-1 rounded-2xl border border-line bg-panel-2 px-3 py-3">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(text); }}
        className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-ink p-2 focus-within:border-accent/70"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={rec === "rec" ? "Dinliyorum… bitirince 🎙'a tekrar bas" : "Excel'ine bir şey söyle…"}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={toggleMic}
          disabled={busy || rec === "busy"}
          title="Sesle komut ver"
          className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${rec === "rec" ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-line text-muted hover:text-white"}`}
        >
          {rec === "rec" && <span className="absolute inset-0 animate-ping rounded-xl border border-rose-400" />}
          {rec === "busy" ? "…" : "🎙"}
        </button>
        <button disabled={busy || !text.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">
          Gönder
        </button>
      </form>
    </div>
  );
}
