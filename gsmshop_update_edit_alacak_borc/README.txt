GSMSHOP Alacak/Borç ve Düzeltme Güncellemesi

Bu paket şunları yapar:
1. ALACAKLARIM:
   - Sadece satış yaptığın ve eksik ödeme yapan müşteriler görünür.
   - Kolonlar: İşlem, Adı Soyad, Alınan Mal, Kalan, Düzelt.

2. BORÇLARIM:
   - Mal aldığın tedarikçiler/firma borçları görünür.
   - Tedarikçi, son alınan mal, alış toplam, ödenen ve kalan gösterilir.

3. DÜZELTME:
   - Satış listesinde "Düzenle" butonu gelir.
   - Alacaklarım ekranında "Düzenle" butonu gelir.
   - Stok listesinde "Düzenle" butonu gelir.
   - Yanlış satış ve yanlış stok kayıtları düzeltilebilir.

Kullanım:
1. ZIP'i /Users/ahmetshen/Documents/gsmshop-web içine klasör olarak çıkar.
2. Terminal:

cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_update_edit_alacak_borc
python3 apply_edit_alacak_borc_update.py

3. GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx src/style.css
git commit -m "Alacak borç ayrımı ve düzeltme seçenekleri eklendi"
git push

4. Vercel otomatik güncellenecek.
