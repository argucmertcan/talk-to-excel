import { NextResponse } from "next/server";
import { groqJson } from "@/lib/groq";
import type { Profile } from "@/lib/profile";

export interface Insight {
  title: string;
  detail: string;
  tone: "positive" | "negative" | "warning" | "info";
  question: string;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "insights"],
  properties: {
    summary: { type: "string" },
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "tone", "question"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          tone: { type: "string", enum: ["positive", "negative", "warning", "info"] },
          question: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `Sen deneyimli bir iş analistisin. Sana bir Excel dosyasının şeması ve programın hesapladığı OLGULAR verilecek.
Görevin: yöneticinin ilk bakışta bilmesi gereken en önemli 5 içgörüyü Türkçe yazmak.
Kurallar:
- SADECE verilen olgulardaki sayıları kullan; yeni sayı uydurma, hesap yapma.
- Gürültü gibi duran küçük düşüşleri atla; iş açısından anlamlı, birbirinden farklı 5 konu seç.
- title: en fazla 6 kelime, çarpıcı. detail: 1-2 cümle, sayılarla. question: kullanıcının bu konuyu tabloda incelemek için yazabileceği kısa bir komut (ör. "Kasım siparişlerini indirime göre sırala").
- summary: dosyayı tek cümlede anlat (ne verisi, hangi dönem, kaç satır).`;

export async function POST(req: Request) {
  const { fileName, profile } = (await req.json()) as { fileName: string; profile: Profile };
  const user = JSON.stringify({
    dosya: fileName,
    sayfa: profile.sheet,
    satir: profile.rowCount,
    donem: profile.dateRange,
    sutunlar: profile.schema.map((c) => `${c.name} (${c.type})`),
    kpi: profile.kpis,
    veri_kalitesi: profile.quality.map((q) => q.message),
    olgular: profile.findings.map((f) => f.fact),
  });
  try {
    const { data, ms } = await groqJson<{ summary: string; insights: Insight[] }>(
      [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      "insights",
      schema,
    );
    return NextResponse.json({ ...data, ms });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
