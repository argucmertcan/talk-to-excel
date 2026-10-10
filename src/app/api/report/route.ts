import { NextResponse } from "next/server";
import { groqJson } from "@/lib/groq";

export interface Report {
  title: string;
  executiveSummary: string;
  sections: { heading: string; body: string; bullets: string[] }[];
  recommendations: { action: string; why: string; priority: "Yüksek" | "Orta" | "Düşük" }[];
}

const str = { type: "string" };
const schema = {
  type: "object", additionalProperties: false, required: ["title", "executiveSummary", "sections", "recommendations"],
  properties: {
    title: str,
    executiveSummary: str,
    sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "body", "bullets"],
      properties: { heading: str, body: str, bullets: { type: "array", items: str } } } },
    recommendations: { type: "array", items: { type: "object", additionalProperties: false, required: ["action", "why", "priority"],
      properties: { action: str, why: str, priority: { type: "string", enum: ["Yüksek", "Orta", "Düşük"] } } } },
  },
};

const SYSTEM = `Sen bir yönetim danışmanısın. Sana bir Excel dosyasından programın hesapladığı KPI'lar, olgular,
veri kalitesi notları ve (varsa) kullanıcının sohbette incelediği konular verilecek.
Üst yönetime gidecek kısa, net, Türkçe bir rapor yaz:
- title: dosyanın konusunu ve dönemini anlatan başlık.
- executiveSummary: 3-4 cümle; en önemli 2-3 mesaj.
- sections: 3-4 bölüm (ör. Satış Performansı, Kârlılık, Ürün & Müşteri, Ekip). Her birinde 1-2 cümle body ve 2-4 madde.
- recommendations: 3-5 somut aksiyon, gerekçe ve öncelik.
Kurallar: SADECE verilen sayıları kullan, yeni sayı uydurma (önerilerde de "%15 artırın" gibi kaynaksız hedef yazma); sayıları Türkçe biçimde yaz (12,4 milyon ₺, %17,3).
Kullanıcının sohbette incelediği konular varsa bunlara mutlaka bir bölümde yer ver.`;

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const { data, ms } = await groqJson<Report>(
      [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(body) }],
      "report",
      schema,
    );
    return NextResponse.json({ ...data, ms });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
