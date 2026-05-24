GSMSHOP TEMİZ V24 - SUPABASE BAĞLANTI

Bu paket V23 backend altyapısını mevcut uygulamaya bağlar.

Eklenenler:
- Giriş ekranı
- Çıkış butonu
- Supabase'ten veri yükleme
- Senkronize Et butonu
- Stok kaydet -> stock_items tablosuna yazar
- Satış kaydet -> sales tablosuna yazar
- Kartlı satış -> bank_movements tablosuna POSTAN Gelen olarak yazar
- Gider kaydet -> expenses tablosuna yazar
- Bankadan Nakit Gelen -> bank_movements tablosuna yazar
- Silme -> gerçek silme değil, status=deleted
- Kasa Kapanış sekmesi
- Kasa Kapanış + Günlük Yedek fonksiyonları

Kurulum:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v24_supabase
python3 apply_clean_full_v24_supabase.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

ÖNEMLİ:
.env dosyasında şu iki satır doğru olmalı:
VITE_SUPABASE_URL=https://oncutcudpzwupofhavlv.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

Kullanıcı girişi için Supabase Authentication > Users kısmından kullanıcı oluşturman gerekir.
Sonra profiles tablosunda o kullanıcının rolü owner yapılmalı.
