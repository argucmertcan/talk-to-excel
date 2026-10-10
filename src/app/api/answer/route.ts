import { NextResponse } from "next/server";
import { groqJson } from "@/lib/groq";

const schema = {
  type: "object", additionalProperties: false, required: ["answer"],
  properties: { answer: { type: "string" } },
};

export async function POST(req: Request) {
  const { question, result } = (await req.json()) as { question: string; result: object };
  try {
    const { data, ms } = await groqJson<{ answer: string }>(
      [
        {
          role: "system",
          content:
            "Kullanıcının sorusunu, uygulamanın hesapladığı SONUÇ tablosuna bakarak Türkçe, 1-3 cümleyle cevapla. Sadece tablodaki sayıları kullan, sayıları Türkçe biçimde yaz (1,2 milyon ₺, %14,3). Varsa dikkat çekici olanı vurgula.",
        },
        { role: "user", content: `SORU: ${question}\nSONUÇ: ${JSON.stringify(result)}` },
      ],
      "answer",
      schema,
    );
    return NextResponse.json({ ...data, ms });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
