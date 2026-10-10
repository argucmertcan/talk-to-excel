import "server-only";

const URL = "https://api.groq.com/openai/v1/chat/completions";
export const MODEL = "openai/gpt-oss-120b";

type Msg = { role: "system" | "user" | "assistant"; content: string };

/** Groq'a JSON şemalı istek atar; parse edilmiş nesneyi ve süreyi döndürür. */
export async function groqJson<T>(messages: Msg[], schemaName: string, schema: object): Promise<{ data: T; ms: number }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY tanımlı değil (.env.local)");
  const t0 = Date.now();
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: { name: schemaName, schema, strict: true } },
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return { data: JSON.parse(json.choices[0].message.content) as T, ms: Date.now() - t0 };
}
