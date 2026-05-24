GSMSHOP TEMİZ V5

Bu paket yama değildir. src/App.jsx ve src/style.css dosyalarını komple yazar.

Düzeltmeler:
- Para alanlarında yanlış rakamı düzeltmek kolaylaştırıldı.
  Alanın içine tıklayınca TL/nokta temizlenir, rakamı silebilir/düzeltebilirsin.
  Alandan çıkınca tekrar 1.000 TL formatına döner.
- Cep telefonu kayıt alanları 11 rakam sınırına alındı.
- Müşteri seçilerek alınan cihazlarda Satış Formu Resmi zorunlu oldu.
- Alış etiketi "Kaça aldın" oldu.
- Satış etiketi "Kaça Satacaksın" oldu.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v5
python3 apply_clean_full_v5.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V5"
git push
