# Talk to Excel

**[English](#english) · [Türkçe](#türkçe)**

## English

Upload an Excel file, talk to it, and watch the table change: filter, sort, add columns, color rows, build charts, pivots and an exec report.

Built with Claude Code. Build walkthrough video (Turkish, with the prompts and the real bugs): https://youtu.be/CK87E0hdJwo

> The UI and the model's replies are in Turkish (it targets Turkish small-business users). The architecture below is language-agnostic.

### What it does
- **Auto-analysis:** KPIs (revenue, profit, margin), data quality (duplicate rows, inconsistent spellings, empty cells) and AI insights.
- **Edit by talking:** "show only November orders", "color loss-making rows red", "add a profit margin column". Every command is undoable.
- **Ask questions:** "which product has the highest return rate?" The engine computes the answer; the model only phrases it.
- **Voice commands** (Groq Whisper) and an **exec report** (PDF / Excel export).

### Architecture: the model never sees or changes the data
1. The in-browser engine reads the file and extracts the schema plus small column summaries.
2. The model (Groq, `openai/gpt-oss-120b`) looks at that schema and writes an **operation plan** (JSON): filter, derived column, color, pivot, chart…
3. The engine validates and applies the plan. Numbers are always computed by code. On an error or an empty result, the plan is requested again with the error message.
4. View = base data + operation list; "undo" removes the last operation.

The file is processed in the browser and never uploaded to the server; the API key is only used server-side.

### Run locally
```bash
npm install
cp .env.example .env.local   # set GROQ_API_KEY (https://console.groq.com)
npm run dev
```
A fictional **sample file** (`demo/nova_elektronik_satis_2025.xlsx`, 5,000 rows) loads with one click.

### Deploy (Railway etc.)
Node 20+, build `npm run build`, start `npm start`, env var `GROQ_API_KEY`.

### Git tags: stage by stage
Each build stage is a tag, including the buggy versions:

| Tag | Stage |
|---|---|
| `asama-0` | Project rules (CLAUDE.md) + fictional demo data generator |
| `asama-1-hata` → `asama-1` | Excel upload + virtualized table · bug: every date showed one day early (SheetJS timezone handling) |
| `asama-2` | Auto-analysis: profile, data quality, insights |
| `asama-3` | Natural language → operation plan → applied in the browser; self-correction |
| `asama-4` | "Live" feel: column focus, row map, undo, chart panel, voice commands |
| `asama-5` | Exec report, PDF and Excel export |
| `final` | Robustness: lookup rules, self-correction on empty results, no filter carry-over |

```bash
git checkout asama-1-hata   # see the date bug yourself
```

---

## Türkçe

Excel dosyanı yükle, Türkçe konuş, tablo gözünün önünde değişsin: filtre, sıralama, yeni sütun, renklendirme, grafik, özet tablo, rapor.

Claude Code ile yapıldı. Nasıl yapıldığını (promptlar, aşamalar, gerçek hatalar) anlatan video: https://youtu.be/CK87E0hdJwo

### Neler yapıyor
- **Otomatik analiz:** KPI'lar (ciro, kâr, marj), veri kalitesi (mükerrer satır, yazım tutarsızlığı, boş hücre) ve yapay zekâ içgörüleri.
- **Konuşarak değiştirme:** "Sadece Kasım siparişlerini göster", "zarar edenleri kırmızı yap", "kâr marjı sütunu ekle". Her komut geri alınabilir.
- **Soru sorma:** "Hangi ürünün iade oranı en yüksek?" Cevabı motor hesaplar, yapay zekâ cümleye döker.
- **Sesli komut** (Groq Whisper) ve **yönetici raporu** (PDF / Excel dışa aktarma).

### Mimari ilke
Yapay zekâ veriyi **görmez ve değiştirmez.**
1. Tarayıcıdaki motor dosyayı okur, şemayı ve küçük özetleri çıkarır.
2. Yapay zekâ (Groq, `openai/gpt-oss-120b`) bu şemaya bakıp bir **işlem planı** (JSON) yazar: filtre, sütun, renk, özet, grafik…
3. Motor planı doğrular ve uygular. Sayıları her zaman kod hesaplar. Hata ya da boş sonuçta plan, hata mesajıyla yeniden istenir.
4. Görünüm = temel veri + işlem listesi; "geri al" son işlemi listeden çıkarır.

### Yerelde çalıştır
```bash
npm install
cp .env.example .env.local   # GROQ_API_KEY değerini gir (https://console.groq.com)
npm run dev
```
Açılışta **örnek dosya** (`demo/nova_elektronik_satis_2025.xlsx`, kurgusal, 5.000 satır) tek tıkla yüklenir.

### Yayına alma (Railway vb.)
- Node 20+, build `npm run build`, start `npm start`.
- Ortam değişkeni: `GROQ_API_KEY`. Anahtar yalnızca sunucuda kullanılır. Dosya tarayıcıda işlenir, sunucuya yüklenmez.

### Git etiketleri: aşama aşama
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
