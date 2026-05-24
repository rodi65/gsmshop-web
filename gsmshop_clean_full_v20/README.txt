GSMSHOP TEMİZ V20

Bu paket V19 üzerine tam dosya olarak hazırlanmıştır.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Değişiklikler:
- Ana menüde Diğerleri açıldığında Kara Defter görünmeye devam eder.
- Diğerleri içine Bankadan Nakit Gelen kısayolu eklendi.
- Bankadan Nakit Gelen yazısının altına aylık POS komisyon bilgisi eklendi:
  "Banka Bu Ay Bu Kadar Paranı Komisyon Olarak Aldı"
- Komisyon hesabı:
  Bu ay POS’a giden toplam paranın %3,5’i
- Bu ay POS’a giden toplam tutar da aynı yerde gösterilir.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v20
python3 apply_clean_full_v20.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V20 pos komisyon ve digerleri"
git push
