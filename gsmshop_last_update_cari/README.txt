GSMSHOP son güncelleme paketi

Bu paket şunları yapar:
- Satış ekranında müşteri telefonu ayrı alanını kaldırır.
- Tek alan yapar: Müşteri adı soyadı / telefon.
- Kalan ödeme varsa "Kalan cari kişi" alanını gösterir.
- Kalan varsa cari kişi seçilmeden satış kapanmaz.
- Cari borcu seçilen cari kişiye yazar.

Kullanım:
1. ZIP'i aç.
2. Terminalde şu komutu çalıştır:

python3 apply_last_update.py

3. Sonra projeyi GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx
git commit -m "Satış ekranında kalan cari kişi seçimi eklendi"
git push

4. Vercel otomatik güncellenecek.
