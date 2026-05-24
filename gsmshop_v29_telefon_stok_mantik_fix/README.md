GSMSHOP V29 - TELEFON / STOK MANTIK DÜZELTMESİ

Bu paket mevcut çalışan V28 dosyanın üzerine doğrudan patch uygular.

Düzeltilenler:
1. Sadece İkinci El telefon alımında müşteri/satıcı bilgileri zorunlu olur.
2. Sıfır Garantili / Sıfır Spot telefon alımlarında firma bilgisi yeterli olur.
3. Telefon dışındaki cihaz stok girişlerinde telefon modelleri çıkmaz.
4. Telefon dışı cihazlarda durum seçenekleri korunur:
   - Sıfır Garantili
   - İkinci El
   - Sıfır Spot
5. Telefon dışı model alanı boş/Model Ekle mantığına alınır.
6. Stok ekranında Cihaz Stok Listesi sadece telefon/cihazları gösterir.
7. Aksesuar Cihaz Listesi adı Aksesuar Stok Listesi olur ve sadece aksesuarları gösterir.
8. Diğerleri stok ekranında telefon ve aksesuar dışındaki tüm stoklar görünür.
9. Supabase kalıcılığı, cari ve kasa etkisi V28 üzerinden korunur.

Kurulum:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_v29_telefon_stok_mantik_fix
python3 apply_v29_telefon_stok_mantik_fix.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/services/dataService.js
git commit -m "V29 telefon stok mantik duzeltmesi"
git push
