GSMSHOP TEMİZ V19

Bu paket V17 ve V18'i kullanmamış olsan bile tek başına yeterlidir.
src/App.jsx ve src/style.css dosyalarını komple yazar.

Değişiklikler:
- Kasa > Yeni Satış büyük butonları eski yapıya alındı:
  Telefon
  Teknik
  Saat
  Tablet
  PC
  Elektronik
- Tablet artık Kasa > Yeni Satış içindedir.
- Sağ boşluğa, eski satış listesi yerine Aksesuar Hızlı Seçim paneli eklendi.
- Aksesuar hızlı seçim butonları Telefon butonu büyüklüğünde:
  Kılıf
  Ekran Koruyucu
  USB
  Şarj
  Kulaklık
- Kılıf alt seçenekleri eklendi:
  A Kılıf
  B Kılıf
  Silikon Kılıf
- Ekran Koruyucu alt seçenekleri eklendi:
  A Cam
  B Cam
  C Cam
- Satış listesi sıralaması korunur:
  Telefon
  Aksesuar
  Diğerleri
  Teknik Servis

Kullanım:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v19
python3 apply_clean_full_v19.py

Test:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

GitHub/Vercel:
git add src/App.jsx src/style.css
git commit -m "GSMSHOP temiz V19 kasa satis ve aksesuar hizli secim"
git push
