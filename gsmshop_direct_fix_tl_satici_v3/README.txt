GSMSHOP Direkt TL + SATICI Cari Düzeltmesi V3

Önceki paketler Python hatası verdi. Bu V3 paket function-based regex kullanır ve kaçış hatasını aşar.

Yaptıkları:
- Alış / Satış / Ödenen / Nakit / Kart alanlarına yazılan rakam para gibi görünür:
  1000 -> 1.000 TL
  3500 -> 3.500 TL
- Cihaz kaydında Ödenen alanından sonra Kalan alanı eklenir.
- Kalan = Alış - Ödenen.
- Müşteriden cihaz alınırsa cari adı SATICI + AD SOYAD formatında görünür.
- Stok listesine Cari Kalan kolonu ekler.

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_direct_fix_tl_satici_v3
python3 apply_direct_fix_tl_satici_v3.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx src/style.css
git commit -m "TL format kalan ve satici cari duzeltildi v3"
git push
