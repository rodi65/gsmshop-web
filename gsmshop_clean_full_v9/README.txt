GSMSHOP TEMİZ V9

Bu paket V8 üzerine tam dosya olarak hazırlanmıştır.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Değişiklikler:
- Banka listesi:
  Ziraatbank, İşbank, Garantibank, Halkbank, Qnbbank, Vakıfbank, Yapıkredi
- Kartlı satış hangi POS/bankadan gittiyse banka defterine o isimle eklenir.
- Banka notunda "Kart ödemesi" yerine "POSTAN Gelen" yazar.
- Borçlarım adı Tedarikçi/Firma oldu.
- Tedarikçi/Firma listesinde firma adına tıklanınca hesap sayfası açılır.
- Hesap sayfasında:
  SON Hesap
  SON Gelen
  SON Ödenen
  ŞİMDİKİ Borcun
  görünür.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v9
python3 apply_clean_full_v9.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V9 banka pos ve tedarikci hesap"
git push
