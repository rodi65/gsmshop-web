GSMSHOP TL + Tedarikçi Ekle Güncellemesi

Bu paket şunları yapar:
- Tüm para gösterimlerinde TL ibaresi kullanılır.
- Fiyat alanlarına yazarken otomatik nokta koyar: 10000 -> 10.000
- Satış, alış, nakit, kart, ödenen alanlarının placeholderında TL görünür.
- Tedarikçi Firma seçildiğinde seçeneklerin en üstünde "+ Tedarikçi Ekle" çıkar.
- Tedarikçi Ekle tıklanınca küçük pencere açılır, firma kaydedilir.
- Yeni firma tedarikçi listesine eklenir ve seçilir.

ÖNEMLİ:
Önce "gsmshop_full_latest_v2_cihaz" ve sonra "gsmshop_update_cihaz_alim_mantigi" paketini uygulamış olmalısın.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_update_tl_tedarikci
python3 apply_tl_tedarikci_update.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx src/style.css
git commit -m "TL format ve tedarikci ekleme eklendi"
git push
