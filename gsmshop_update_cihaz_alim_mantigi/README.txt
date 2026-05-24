GSMSHOP Cihaz Alım Mantığı Güncellemesi

Bu paket şunları yapar:
- Cihaz stok kaydında "Müşteri" seçilirse Tedarikçi / Satıcı firma bilgisi istenmez.
- "Tedarikçi Firma" seçilirse müşteri bilgileri istenmez.
- Hafıza alanı seçenek olur: 64 GB, 128 GB, 256 GB, 512 GB, 1 TB.
- Cihaz kaydında Stok Adedi alanı kaldırılır; cihaz otomatik 1 adet stok girer.
- Tedarikçi Firma alanı seçenekli olur; mevcut tedarikçiler listelenir.
- Stok listesinde müşteri alımında tedarikçi yerine satan kişi gösterilir.

ÖNEMLİ:
Önce "gsmshop_full_latest_v2_cihaz" paketini uygulamış olmalısın.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_update_cihaz_alim_mantigi
python3 apply_cihaz_alim_mantigi_update.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx src/style.css
git commit -m "Cihaz alim mantigi duzenlendi"
git push
