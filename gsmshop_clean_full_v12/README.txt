GSMSHOP TEMİZ V12

Bu paket V11 üzerine tam dosya olarak hazırlanmıştır.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Değişiklikler:
- Kasa menüsünde Toplam Satış, Nakit Kasa, Kart, Alacak rakamları ana ekranda ******* olarak görünür.
- Bu kartlara tıklanınca rakam görünür.
- Kâr, Kasa ana menüsünden kaldırıldı.
- Kâr, Kara Defter içine eklendi.
- Kara Defter içinde Kâr menüsü:
  Günün Kârı
  Ayın Kârı
  Toplam Kâr
  Tarih seçenekli Kâr
- Kara Defter ana menüsüne basınca şifre ister.
- Şifre silme şifresiyle aynıdır: 1

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v12
python3 apply_clean_full_v12.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V12 kara defter sifre ve kar"
git push
