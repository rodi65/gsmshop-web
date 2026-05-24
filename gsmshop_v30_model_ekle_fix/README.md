GSMSHOP V30 - MODEL EKLE DÜZELTMESİ

Düzeltme:
- Telefon seçildiğinde de Model kısmında en üstte Model Ekle seçeneği gelir.
- Telefon dışı cihazlarda telefon modelleri çıkmaz.
- Telefon dışı cihazlarda Model Ekle mantığı korunur.

Kurulum:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_v30_model_ekle_fix
python3 apply_v30_model_ekle_fix.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx
git commit -m "V30 model ekle secenegi duzeltildi"
git push
