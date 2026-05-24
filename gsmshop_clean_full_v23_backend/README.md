# GSMSHOP V23 Backend Altyapı Paketi

Bu paket uygulamayı gerçek işletme kullanımına yaklaştırmak için hazırlanmış veritabanı altyapısıdır.

## Eklenen altyapı

- Supabase gerçek veritabanı şeması
- Kullanıcı girişi
- Stok tablosu
- Satış tablosu
- Gider tablosu
- Banka/POS hareketleri
- Kasa kapanış raporu
- İşlem geçmişi / audit log
- Silinen kayıtları loglama
- Günlük otomatik yedek fonksiyonu
- Supabase client dosyası
- Uygulama servis dosyası

## Önemli gerçek

Bu paket dosyaları hazırlar. Canlı veritabanına bağlanmak için Supabase projesinden iki bilgi gerekir:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Bunlar olmadan uygulama gerçek veritabanına bağlanamaz.

## Kurulum

ZIP dosyasını `/Users/ahmetshen/Documents/gsmshop-web` içine çıkar.

Terminal:

```bash
cd /Users/ahmetshen/Documents/gsmshop-web
bash gsmshop_clean_full_v23_backend/scripts/install_backend_files.sh
```

## Supabase tarafı

1. Supabase sitesinde yeni proje oluştur.
2. SQL Editor aç.
3. `gsmshop_clean_full_v23_backend/supabase/schema.sql` dosyasındaki SQL'i komple yapıştır.
4. Run / Çalıştır.
5. Authentication > Users bölümünden kullanıcı oluştur.
6. Oluşan kullanıcının ID değerini al.
7. SQL Editor'da şu örneği kendi ID'nle çalıştır:

```sql
insert into public.profiles(id, full_name, role)
values ('AUTH_USER_ID_BURAYA', 'Ahmet Şen', 'owner')
on conflict (id) do update set role='owner', full_name='Ahmet Şen';
```

## .env ayarı

Proje kökündeki `.env` dosyasına şunları yaz:

```env
VITE_SUPABASE_URL=https://SENIN-PROJE-ID.supabase.co
VITE_SUPABASE_ANON_KEY=SENIN_SUPABASE_ANON_KEY
```

Sonra:

```bash
npm run dev
```

## Kasa kapanış

`CashClosingPanel.jsx` dosyası şu işlemi yapar:

- Günlük satış toplamı
- Nakit toplamı
- Kart toplamı
- Alacak toplamı
- Gider toplamı
- Net kasa
- Kâr toplamı

Bunları `cash_closings` tablosuna işler ve aynı anda `daily_backups` tablosuna günlük yedek alır.

## Silme mantığı

Gerçek sistemde fiziksel silme yerine `status = deleted` kullanılır. Böylece kayıt görünmez ama geçmişi `audit_logs` tablosunda kalır.

## İşlem geçmişi

Şu tablolar otomatik audit log üretir:

- stock_items
- sales
- expenses
- bank_movements
- cash_closings

Her insert/update/delete kayıt altına alınır.

## Bu paket ne yapmaz?

Mevcut App.jsx ekranlarının tamamını otomatik olarak Supabase'e bağlamaz. Bunun için sonraki adımda mevcut V22/V23 App.jsx içindeki `useState` kayıtlarını dataService fonksiyonlarına bağlamak gerekir.

Doğru sıradaki bir sonraki iş:

1. Satış kaydet -> `createSale`
2. Stok kaydet -> `createStockItem`
3. Gider kaydet -> `createExpense`
4. Bankadan nakit gelen -> `createBankWithdrawal`
5. Sil -> `softDelete`
6. Kasa kapanışı -> `closeCashDay`
