GSMSHOP TEMİZ V16

Bu paket V15 üzerine tam dosya olarak hazırlanmıştır.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Kasa Menüsü:
- Yeni Satış
- Satış Listesi
- Giderler
- Bankadan Nakit Gelen
yan yana sekmeler olarak düzenlendi.

Giderler:
- Yemek
- Kargo
- Borç
- İade
- Ivır Zıvır
seçenekleri eklendi.
- Her giderde Not alanı var.
- Sadece Borç seçeneğinde Not zorunlu.
- Giderler listesinde silme şifreyle çalışır.

Kapanış Özeti:
- Gider eklendi.
- Net Nakit eklendi.

Yeni Satış:
- Sayfa içinde büyük butonlar eklendi:
  Telefon
  Aksesuar
  Teknik
  Diğerleri
- Telefon, Aksesuar ve Teknik dışındaki satış türleri Diğerleri altında bulunur.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v16
python3 apply_clean_full_v16.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V16 kasa gider ve yeni satis"
git push
