GSMSHOP TEMİZ V10

Bu paket V9 üzerine tam dosya olarak hazırlanmıştır.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Değişiklikler:
- Kara Defter > Alacaklarım tablosuna Tarih kolonu eklendi.
- Sıralama:
  İşlem / Tarih / Adı Soyad / Alınan Mal / Kalan / Düzelt / Sil
- Alınan Mal artık tıklanabilir.
- Alınan Mal tıklanınca o ürünün/satışın hareket sayfası açılır.
- Hareket sayfasında:
  Alınan Mal
  Tarih
  Adı Soyad
  Satış Tutarı
  Ödenen
  Kalan
  Nakit ödeme
  Kart ödeme
  Barkod/IMEI
  Alış maliyeti
  Kâr
  görünür.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v10
python3 apply_clean_full_v10.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V10 alacak hareket sayfasi"
git push
