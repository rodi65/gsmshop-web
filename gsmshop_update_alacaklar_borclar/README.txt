GSMSHOP Alacaklarım / Borçlarım güncellemesi

Bu paket şunları yapar:
- Cari özeti butonu ALACAKLARIM olur.
- Müşteri cari özeti başlığı Alacaklarım olur.
- Tablo kolonları şu sıraya döner:
  1. İşlem
  2. Adı Soyad
  3. Alınan Mal
  4. Kalan
- Cari özet butonunun yanına Borçlarım butonu eklenir.
- Borçlarım sekmesinde firma borç özeti gösterilir.

Kullanım:
1. ZIP'i gsmshop-web klasörünün içine klasör olarak çıkar.
2. Terminal:

cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_update_alacaklar_borclar
python3 apply_alacaklar_borclar_update.py

3. Sonra GitHub'a gönder:

cd /Users/ahmetshen/Documents/gsmshop-web
git add src/App.jsx
git commit -m "Alacaklarım ve Borçlarım ekranları düzenlendi"
git push

4. Vercel otomatik güncellenecek.
