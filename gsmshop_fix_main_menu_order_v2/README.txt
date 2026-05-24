GSMSHOP Ana Menü Sıralama Düzeltmesi V2

Önceki pakette SyntaxError oluştu. Bu paket düzeltilmiş sürümdür.

Ana ekran menüsünü şu sıraya getirir:
1. Kasa
2. Cihaz
3. Aksesuar
4. Stok
5. Sorgula
6. Tamir
7. Vole

Kullanım:
1. ZIP'i /Users/ahmetshen/Documents/gsmshop-web içine klasör olarak çıkar.
2. Terminal:

cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_fix_main_menu_order_v2
python3 apply_main_menu_order_fix_v2.py

3. GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx src/style.css
git commit -m "Ana menu siralamasi duzenlendi v2"
git push

4. Vercel otomatik güncellenecek.
