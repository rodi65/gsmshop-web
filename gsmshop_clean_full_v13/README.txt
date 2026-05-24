GSMSHOP TEMİZ V13

Bu paket V12 üzerine tam dosya olarak hazırlanmıştır.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Değişiklikler:
- Kara Defter ana menüsüne girişte şifre istemez.
- Şifre sadece Kara Defter içindeki Kâr sekmesine tıklanınca istenir.
- Kâr şifresi silme şifresiyle aynıdır: 1
- Aksesuarda Arşive Al seçenekleri kaldırıldı.
- Arşive Al yerine yeni kategori ekleme sistemi geldi.
- En fazla 6 yeni kategori eklenebilir.
- Barkod numarası ile Tedarikçi/Firma seçimi arasına Ürünün adı alanı eklendi.
- Ürünün adı seçilen aksesuar seçeneğine göre otomatik oluşur. Örnek: KILIF-A Kılıf
- En sondaki Ürün adı/açıklama alanı Ürün Bilgisi olarak değiştirildi.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v13
python3 apply_clean_full_v13.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V13 aksesuar kategori ve kar sifresi"
git push
