GSMSHOP Kasa Menü Düzeltmesi

Bu paket şu hataları düzeltir:
- Ana ekrandaki "Alacaklarım = ... Borçlarım = ..." açıklamasını kaldırır.
- ALACAKLARIM ve Borçlarım butonlarını ana menüden kaldırır.
- ALACAKLARIM ve Borçlarım butonlarını Kasa bölümünün içine alır.
- "Satış Listesi Yanlış satışta düzenle" yazısını kaldırır.
- Stok listesi başlığındaki gereksiz açıklamayı kaldırır.

Kullanım:
1. ZIP'i /Users/ahmetshen/Documents/gsmshop-web içine klasör olarak çıkar.
2. Terminal:

cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_fix_kasa_tabs
python3 apply_fix_kasa_tabs.py

3. GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx
git commit -m "Kasa icinde alacaklarim borclarim sekmeleri duzenlendi"
git push

4. Vercel otomatik güncellenecek.
