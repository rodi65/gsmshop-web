GSMSHOP V2 SON TAM SÜRÜM

Bu paket küçük yama değil, App.jsx ve style.css dosyalarını komple son sürüme çevirir.
Bu yüzden "Cihaz bölümü beklenen yapıda bulunamadı" hatası vermez.

İçerik:
- Ana menü: Kasa, Cihaz, Aksesuar, Stok, Sorgula, Tamir, Vole
- Kasa içinde: Yeni Satış, ALACAKLARIM, Borçlarım
- Cihaz bölümü doğrudan cihaz kayıt ekranıdır
- Cihazda Barkod/IMEI en fazla 15 rakam
- Ödenen alanı
- Müşteri seçeneği ilk sırada
- Müşteri seçilirse: Satanın adı soyadı, telefonu, otomatik tarih/saat, alımı yapan, satış formu resmi
- Stok bölümünde liste ve stok kaydı
- Sorgula eski detaylı mantıkta

Kurulum:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_full_latest_v2_cihaz
python3 apply_gsmshop_full_latest_v2_cihaz.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
npm install
npm run dev

GitHub:
git add src/App.jsx src/style.css package.json index.html src/main.jsx
git commit -m "GSMSHOP V2 son tam surum cihaz dahil"
git push
