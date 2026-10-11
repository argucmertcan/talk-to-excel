# Talk to Excel

Excel dosyanı yükle, Türkçe konuş, tablo gözünün önünde değişsin: filtre, sıralama, yeni sütun, renklendirme, grafik, özet tablo, rapor.

Claude Code ile yapıldı. Nasıl yapıldığını (promptlar, aşamalar, gerçek hatalar) anlatan video: https://youtu.be/CK87E0hdJwo

## Neler yapıyor
- **Otomatik analiz:** KPI'lar (ciro, kâr, marj), veri kalitesi (mükerrer satır, yazım tutarsızlığı, boş hücre) ve yapay zekâ içgörüleri.
- **Konuşarak değiştirme:** "Sadece Kasım siparişlerini göster", "zarar edenleri kırmızı yap", "kâr marjı sütunu ekle". Her komut geri alınabilir.
- **Soru sorma:** "Hangi ürünün iade oranı en yüksek?" Cevabı motor hesaplar, yapay zekâ cümleye döker.
- **Sesli komut** (Groq Whisper) ve **yönetici raporu** (PDF / Excel dışa aktarma).

## Mimari ilke
Yapay zekâ veriyi **görmez ve değiştirmez.**
1. Tarayıcıdaki motor dosyayı okur, şemayı ve küçük özetleri çıkarır.
2. Yapay zekâ (Groq, `openai/gpt-oss-120b`) bu şemaya bakıp bir **işlem planı** (JSON) yazar: filtre, sütun, renk, özet, grafik…
3. Motor planı doğrular ve uygular. Sayıları her zaman kod hesaplar. Hata ya da boş sonuçta plan, hata mesajıyla yeniden istenir.
4. Görünüm = temel veri + işlem listesi; "geri al" son işlemi listeden çıkarır.

## Yerelde çalıştır
```bash
npm install
cp .env.example .env.local   # GROQ_API_KEY değerini gir (https://console.groq.com)
npm run dev
```
Açılışta **örnek dosya** (`demo/nova_elektronik_satis_2025.xlsx`, kurgusal, 5.000 satır) tek tıkla yüklenir.

## Yayına alma (Railway vb.)
- Node 20+, build `npm run build`, start `npm start`.
- Ortam değişkeni: `GROQ_API_KEY`. Anahtar yalnızca sunucuda kullanılır. Dosya tarayıcıda işlenir, sunucuya yüklenmez.

## Git etiketleri: aşama aşama
| Etiket | Aşama |
|---|---|
| `asama-0` | Proje kuralları (CLAUDE.md) + kurgusal demo veri üreticisi |
| `asama-1-hata` → `asama-1` | Excel yükleme + sanal kaydırmalı tablo · hata: tarihler bir gün geri kayıyordu (SheetJS saat dilimi) |
| `asama-2` | Otomatik analiz: profil, veri kalitesi, içgörüler |
| `asama-3` | Doğal dil → işlem planı → tarayıcıda uygulama; kendini düzeltme |
| `asama-4` | Canlı his: sütun odağı, satır haritası, geri al, grafik paneli, sesli komut |
| `asama-5` | Yönetici raporu, PDF ve Excel dışa aktarma |
| `final` | Sağlamlık: lookup kuralları, boş sonuçta kendini düzeltme, filtre taşımama |

```bash
git checkout asama-1-hata   # tarih hatasını kendin gör
```
