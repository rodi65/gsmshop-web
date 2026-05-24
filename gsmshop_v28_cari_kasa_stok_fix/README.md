GSMSHOP V28 - CARI + KASA + STOK KALICILIK DUZELTMESI

Düzeltmeler:
- Cihaz/aksesuar alımında eksik ödeme varsa cari hesap oluşur.
- Müşteriden cihaz alımında SATICI cari hesabı oluşur.
- Tedarikçi/Firma kaydı contacts tablosuna düşer.
- Stok alımında ödeme yapıldıysa kasadan Stok Ödemesi olarak düşer.
- Satışta kalan varsa müşteri cari hesabı oluşur.
- Satış nakdi kasa hareketine girer.
- Gider kasadan düşer.
- Bankadan nakit gelen kasa hareketine girer.
- Stok giriş çıkıştan sonra Supabase'ten tekrar yüklenir.

Kurulum:
1) Supabase SQL Editor’da supabase/v28_cari_kasa_stok.sql dosyasını çalıştır.
2) Terminal:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_v28_cari_kasa_stok_fix
python3 apply_v28_cari_kasa_stok_fix.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev
