GSMSHOP TEMİZ V15

Bu paket V14 üzerine tam dosya olarak hazırlanmıştır.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Değişiklikler:
- Kasa > Bankadan Nakit Gelen bölümünde banka ismi seçmek zorunlu oldu.
- Bankadan para çekme kaydında seçilen banka adı banka hareketine işlenir.
- Ana menüde sabit seçenekler:
  Kasa
  Telefon
  Aksesuar
  Teknik
  Tablet
  Diğerleri
- Stok ve Kara Defter, Diğerleri butonu altına taşındı.
- Telefon butonu Cihaz kaydını Telefon tipiyle açar.
- Tablet butonu Cihaz kaydını Tablet tipiyle açar.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v15
python3 apply_clean_full_v15.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V15 banka zorunlu ve ana menu"
git push
