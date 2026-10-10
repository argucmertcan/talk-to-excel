# Talk to Excel

Kullanıcı bir Excel dosyası yükler; uygulama dosyayı analiz eder ve kullanıcı Türkçe doğal dille
konuşarak tabloyu canlı değiştirir (filtre, sıralama, yeni sütun, renklendirme, grafik, özet tablo)
ve rapor alır.

## Mimari ilke
- LLM (Groq) veriyi **görmez ve değiştirmez**. Sadece şema + küçük özetleri görür ve bir **işlem planı**
  (JSON) üretir. İşlemleri tarayıcıdaki motor uygular. Hızlı, ucuz, güvenli ve geri alınabilir.
- Görünüm = temel veri + işlem listesi. "Geri al" = son işlemi listeden çıkar.

## Teknoloji
- Next.js (App Router) + TypeScript + Tailwind
- SheetJS (`xlsx`) ile dosya okuma/yazma, tamamen tarayıcıda
- Groq API (`openai/gpt-oss-120b`), anahtar sadece sunucuda: `.env.local` → `GROQ_API_KEY`
- Grafik: Recharts. Animasyon: Framer Motion.

## Kurallar
- Arayüz dili Türkçe. Sayılar `tr-TR` biçiminde (1.234,56 ₺).
- API anahtarı asla istemciye gitmez, loglanmaz.
- Demo veri: `demo/nova_elektronik_satis_2025.xlsx` (üretici: `demo/generate_demo.py`).
