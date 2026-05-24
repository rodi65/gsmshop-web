GSMSHOP Sorgulama + Stok Kaydı Düzeltmesi

Bu paket şunları yapar:
- Sorgulama ekranı eski detaylı mantığa döner:
  IMEI, barkod, isim soyisim, marka, model, ürün adı, firma ile arama.
- Stok ve satış sonuçları ayrı görünür.
- Ana menüye "Stok Kaydı" diye ayrı seçenek eklenir.
- Stok ekleme işleri Stok Kaydı ekranına taşınır.
- Stok ekranı liste/takip ekranı olarak kalır.
- Cihaz ve Aksesuar ana menüleri artık stok kayıt formu göstermez.

Kullanım:
1. ZIP'i /Users/ahmetshen/Documents/gsmshop-web içine klasör olarak çıkar.
2. Terminal:

cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_fix_sorgulama_stok_kaydi
python3 apply_sorgulama_stok_kaydi_fix.py

3. GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx src/style.css
git commit -m "Sorgulama eski haline alindi ve stok kaydi sekmesi eklendi"
git push

4. Vercel otomatik güncellenecek.
