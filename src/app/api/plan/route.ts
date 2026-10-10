import { NextResponse } from "next/server";
import { groqJson } from "@/lib/groq";
import type { Op } from "@/lib/ops";

const str = { type: "string" };
const nstr = { type: ["string", "null"] };
const condition = {
  type: "object", additionalProperties: false, required: ["column", "operator", "value", "value2"],
  properties: {
    column: str,
    operator: { type: "string", enum: ["=", "!=", ">", ">=", "<", "<=", "contains", "in", "between", "empty", "not_empty"] },
    value: str, value2: nstr,
  },
};
const obj = (type: string, props: Record<string, object>) => ({
  type: "object", additionalProperties: false, required: ["type", ...Object.keys(props)],
  properties: { type: { type: "string", enum: [type] }, ...props },
});
const opSchema = {
  anyOf: [
    obj("filter", { conditions: { type: "array", items: condition } }),
    obj("sort", { column: str, direction: { type: "string", enum: ["asc", "desc"] } }),
    obj("add_column", { name: str, formula: str }),
    obj("highlight", { conditions: { type: "array", items: condition }, color: { type: "string", enum: ["red", "green", "yellow", "blue"] }, column: nstr }),
    obj("group", {
      by: { type: "array", items: str },
      metrics: { type: "array", items: { type: "object", additionalProperties: false, required: ["column", "agg"],
        properties: { column: str, agg: { type: "string", enum: ["sum", "avg", "count", "min", "max", "rate"] } } } },
    }),
    obj("lookup", { sheet: str, key: str, column: str }),
    obj("limit", { count: { type: "integer" } }),
    obj("hide_columns", { columns: { type: "array", items: str } }),
    obj("remove_duplicates", {}),
    obj("replace", { column: str, find: str, replace: str }),
    obj("chart", { chart: { type: "string", enum: ["bar", "line", "pie"] }, x: str, y: str, title: str }),
  ],
};
const schema = {
  type: "object", additionalProperties: false, required: ["reply", "mode", "ops", "needsAnswer"],
  properties: {
    reply: str,
    mode: { type: "string", enum: ["append", "replace", "undo", "reset", "none"] },
    ops: { type: "array", items: opSchema },
    needsAnswer: { type: "boolean" },
  },
};

const SYSTEM = `Sen "Talk to Excel" uygulamasının beynisin. Kullanıcı Türkçe konuşarak tabloyu değiştirir.
Veriyi GÖRMEZSİN; sadece şemayı, örnek değerleri ve mevcut işlem listesini görürsün. Görevin bir İŞLEM PLANI üretmek; uygulama işlemleri kendisi uygular.

İşlemler (sırayla uygulanır):
- filter: koşullar VE ile bağlanır. Tarih değerleri YYYY-MM-DD. "in" için değerleri | ile ayır ("Ankara|İzmir"). between için value ve value2.
- sort, limit, hide_columns
- add_column: formül dili: [Sütun Adı], + - * /, karşılaştırma (> < = != >= <=), & (metin birleştirme),
  fonksiyonlar: ROUND(x, n), ABS(x), IF(koşul, a, b), MIN, MAX, MONTH([Tarih]) → "Kasım", QUARTER([Tarih]) → "Ç4", YEAR, WEEKDAY.
  Yüzde sütunları 0-100 arası olsun ve adı "(%)" ile bitsin (ör. "Kâr Marjı (%)" = ROUND([Kâr (₺)] / [Ciro (₺)] * 100, 1)).
- highlight: koşula uyan satırları boyar (column null = tüm satır, değilse sadece o hücre). Kırmızı=kötü, yeşil=iyi, sarı=dikkat.
  Renklendirme isteğinde filtre EKLEME; kullanıcı sadece boyamak istiyor, diğer satırlar görünür kalmalı.
- group: özet tablo. Metrik sütun adları otomatik oluşur: sum → "Toplam <ad> (₺)", avg → "Ortalama <ad> ...", count → "Satır Sayısı", rate → "<ad> Oranı (%)" (Evet/Hayır sütunlarında Evet oranı).
  Group'tan sonraki sort/highlight/add_column bu YENİ sütun adlarını kullanmalı (ör. "Toplam Ciro (₺)").
- lookup: başka sayfadan anahtar sütunla değer getirir (birden çok eşleşme toplanır). KURAL: lookup her zaman, aynı anahtar sütunla yapılmış bir group'tan SONRA gelir (ops sırası: group → lookup → add_column → highlight). Örn. temsilci hedefi: group by "Satış Temsilcisi" → lookup Temsilciler/"Satış Temsilcisi"/"Yıllık Hedef (₺)" → add_column "Hedef Gerçekleşme (%)".
- remove_duplicates, replace (yazım düzeltme). "Veri kalitesini düzelt" denirse SADECE bağlamdaki veri_kalitesi listesindeki sorunları düzelt (mükerrer → remove_duplicates, farklı yazım → az kullanılan yazımı çok kullanılana replace). Boş hücreleri uydurma değerle doldurma.
- chart (x ve y mevcut görünümdeki sütunlar; genelde group'tan sonra).

mode:
- append: yeni işlemler mevcut listenin sonuna eklenir. Kullanıcı mevcut görünüm üzerinde devam ediyorsa ("bunları", "şimdi de", "bunlardan", "ayrıca", renklendirme, sütun ekleme).
- replace: kullanıcı mevcut görünümle ilgisi olmayan YENİ bir soru soruyor ya da yeni bir özet istiyorsa (ör. "hangi ürünün iade oranı en yüksek?", "bölgelere göre ciro"). Mevcut işlemler silinir, ops baştan kurulur.
- undo: "geri al" (ops boş bırak). reset: "sıfırla", "orijinale dön" (ops boş). none: sadece sohbet / açıklama.

needsAnswer: kullanıcı bir SORU sorduysa (en çok, kaç, hangisi, neden...) true; uygulama sonucu hesaplayıp sana tekrar gösterecek.
Grafik isteği mevcut görünümü kastediyorsa ("bunu grafiğe dök", "bunları çiz") mode append. Yeni bir konunun grafiği isteniyorsa ("aylara göre ciroyu çiz") mode replace ve önce uygun group kur.
Ay bazında özet için önce add_column "Ay" = MONTH([Tarih]) ekle, sonra group by "Ay" (ay sırası korunur; ay sütununu ciroya göre sıralama).
Tarih filtrelerinde between kullan (ör. Kasım 2025 → value "2025-11-01", value2 "2025-11-30"); dönem bilgisini bağlamdaki tarih aralığından al.
Sorularda sonucu tek satıra indirme (limit en az 5): group + sort + limit 10 kullan ki karşılaştırma görünsün.
Oran soruları (iade oranı vb.) için group metriğinde agg "rate" kullan; elle formül kurma. Aynı metriği iki kez ekleme.
reply: ne yaptığını anlatan tek kısa Türkçe cümle ("Kasım siparişlerini filtreleyip indirime göre sıraladım."). Sayı uydurma.
Mevcut görünüm bir özetse (group) ve yeni istek ham sütunlarda filtre gerektiriyorsa mode replace kullan ve filtreyi group'tan ÖNCE koy.
Bir değeri filtrelerken onu hangi sütunun "degerler" listesinde gördüysen o sütunu kullan (Ankara bir Şehir'dir, Bölge değil).
Kullanıcı mesajı "HATA:" ile başlıyorsa önceki planın uygulanırken hata verdi demektir; aynı isteği hatasız yeniden planla.
Sütun adlarını şemadaki gibi BİREBİR yaz. Değerleri örnek değerlerdeki yazımla yaz.`;

export async function POST(req: Request) {
  const { message, context, history } = (await req.json()) as {
    message: string; context: object; history: { role: "user" | "assistant"; content: string }[];
  };
  try {
    const { data, ms } = await groqJson<{ reply: string; mode: string; ops: Op[]; needsAnswer: boolean }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `BAĞLAM:\n${JSON.stringify(context)}` },
        ...history.slice(-6),
        { role: "user", content: message },
      ],
      "plan",
      schema,
    );
    return NextResponse.json({ ...data, ms });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
