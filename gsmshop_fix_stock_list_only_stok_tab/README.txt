GSMSHOP Stok Listesi Konum Düzeltmesi

Bu paket şunu yapar:
- Cihaz ekranının altındaki stok/listesi kaldırılır.
- Aksesuar ekranının altındaki stok/listesi kaldırılır.
- Stok listesi sadece ana menüdeki yeni "Stok" sekmesinde görünür.

ÖNEMLİ:
Önce son verdiğim "gsmshop_update_stok_menu" paketini çalıştırmış olmalısın.
Sonra bu paketi çalıştır.

Kullanım:
1. ZIP'i /Users/ahmetshen/Documents/gsmshop-web içine klasör olarak çıkar.
2. Terminal:

cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_fix_stock_list_only_stok_tab
python3 apply_stock_list_only_stok_tab.py

3. GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx
git commit -m "Stok listesi sadece stok sekmesine tasindi"
git push

4. Vercel otomatik güncellenecek.
