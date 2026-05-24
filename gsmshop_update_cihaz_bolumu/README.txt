GSMSHOP Cihaz Bölümü Güncellemesi

Bu paket Cihaz bölümünü düzenler:
- Cihaz içindeki gereksiz Cihaz sekmesi/seçimi kaldırılır.
- Barkod / IMEI alanı sadece rakam alır ve 15 haneden fazlasını kabul etmez.
- Firmaya Ödenen / Yapılan ödeme yerine Ödenen yazılır.
- Stok adedindeki hazır 1 kaldırılmış yapı korunur.
- Tedarikçi / Satıcı firma alanı üst sıraya alınır.
- Alım tipi eklenir: Müşteri her zaman ilk seçenektir.
- Müşteri seçilirse şu alanlar açılır:
  1. Satanın Adı Soyadı
  2. Satanın Telefonu
  3. Sattığı Tarih otomatik
  4. Alımı Yapan
  5. Satış Formu Resmi ekleme
- Kaydedilen cihaz Stok bölümüne eklenir.

Kullanım:
1. ZIP'i /Users/ahmetshen/Documents/gsmshop-web içine klasör olarak çıkar.
2. Terminal:

cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_update_cihaz_bolumu
python3 apply_cihaz_bolumu_update.py

3. GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx src/style.css
git commit -m "Cihaz bolumu alim bilgileri duzenlendi"
git push

4. Vercel otomatik güncellenecek.
