import { NextResponse } from "next/server";

// Sesli komut: tarayıcıdan gelen kaydı Groq Whisper ile yazıya çevirir.
export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY tanımlı değil" }, { status: 500 });
  const form = await req.formData();
  const audio = form.get("audio") as File | null;
  if (!audio) return NextResponse.json({ error: "Ses dosyası yok" }, { status: 400 });
  const out = new FormData();
  out.append("file", audio, "komut.webm");
  out.append("model", "whisper-large-v3-turbo");
  out.append("language", "tr");
  out.append("response_format", "json");
  const t0 = Date.now();
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: out,
  });
  if (!res.ok) return NextResponse.json({ error: `Groq ${res.status}` }, { status: 500 });
  const { text } = await res.json();
  return NextResponse.json({ text: String(text).trim(), ms: Date.now() - t0 });
}
