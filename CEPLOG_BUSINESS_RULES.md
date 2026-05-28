# CEPLOG Is Kurallari

## 1. Genel Mantik

CEPLOG'da her finansal ve stok etkili islem bir business transaction olarak ele alinir.

Bir islem sunlari ayni anda etkileyebilir:

- Satis kaydi
- Satis kalemleri
- Stok hareketleri
- Kasa hareketleri
- Banka/POS hareketleri
- Cari hareketleri
- Gider kayitlari
- Audit log
- Ledger kayitlari

Bir islem kismen basarili olamaz. Ya tamami basarili olur ya tamami geri alinir.

## 2. Satis Kurallari

### Nakit Satis

Beklenen etkiler:

- sales kaydi olusur.
- sale_items kaydi olusur.
- stock_movements icinde urun kadar cikis olusur.
- cash_movements icinde satis tutari kadar giris olusur.
- ledger_entries icinde kasa ve satis geliri kayitlari olusur.
- urun maliyeti satis aninda sabitlenir.
- kar hesaplanir.
- audit_logs kaydi olusur.

### Kart / POS Satis

Beklenen etkiler:

- sales kaydi olusur.
- sale_items kaydi olusur.
- stok duser.
- bank_movements veya pos_movements icinde giris olusur.
- cash_movements etkilenmez.
- audit_logs kaydi olusur.

### Cari Satis

Beklenen etkiler:

- sales kaydi olusur.
- sale_items kaydi olusur.
- stok duser.
- cari_movements icinde musteri alacagi artar.
- cash_movements etkilenmez.
- bank_movements etkilenmez.
- audit_logs kaydi olusur.

### Parcali Odeme

Ornek:

Toplam satis: 20.000 TL
Nakit: 5.000 TL
Kart: 10.000 TL
Cari: 5.000 TL

Beklenen etkiler:

- Stok duser.
- Kasa +5.000 TL
- Banka/POS +10.000 TL
- Cari alacak +5.000 TL
- Toplam odeme = satis net toplami olmalidir.

## 3. Kar Kurallari

Satis kari su sekilde hesaplanir:

Satis Kari = Satis Fiyati - Satis Anindaki Alis Fiyati - Urun Bazli Iskonto

Her satis kaleminde su degerler saklanmalidir:

- unit_cost_at_sale
- unit_price_at_sale
- quantity
- discount_amount
- line_total
- line_profit

Gecmis satisin kari, urun kartindaki alis fiyati sonradan degisirse degismemelidir.

## 4. Stok Kurallari

Stok bakiyesi hareketlerden hesaplanir.

Stok = baslangic + girisler - cikislar + iadeler - fire/eksik/ayipli cikislar

Stok hareket nedenleri:

- PURCHASE_IN
- SALE_OUT
- RETURN_IN
- CANCEL_IN
- EXCHANGE_IN
- EXCHANGE_OUT
- FIRE_OUT
- DEFECTIVE_OUT
- MANUAL_ADJUSTMENT

Telefon urunlerinde IMEI varsa ayni IMEI aktif stokta iki kez bulunmamalidir.

Stok ekranindan iptal, iade, duzeltme ve silme yapilmaz. Bu islemler Gunluk Kasa Raporu / Kasa Beyni uzerinden kontrollu ilerler.

## 5. Kasa Kurallari

Kasa bakiyesi hareketlerden hesaplanir.

Kasa = nakit girisleri - nakit cikislari

Nakit girisleri:

- Nakit satis
- Nakit tahsilat
- Kasa giris duzeltmesi

Nakit cikislari:

- Gider
- Iade odemesi
- Borc odemesi
- Kasa cikis duzeltmesi

## 6. Banka / POS Kurallari

Kart satislari kasa degil banka/POS tarafina yazilir.

POS bekleyen tutarlar ayri izlenmelidir:

- POS_PENDING
- POS_SETTLED
- POS_COMMISSION
- BANK_IN
- BANK_OUT

## 7. Cari Kurallari

Cari bakiye hareketlerden hesaplanir.

Cari alacak artar:

- Cari satis
- Borclandirma

Cari alacak azalir:

- Tahsilat
- Iade
- Mahsup
- Iptal

Musteri veya tedarikci cari hareketi her zaman contact/customer/supplier baglantisi tasimalidir.

## 8. Gider Kurallari

Gider odeme tipine gore islenir.

Nakit gider:

- Kasa azalir.
- Gider kaydi olusur.
- Net kar duser.

Banka gider:

- Banka azalir.
- Gider kaydi olusur.
- Net kar duser.

Borc yazilan gider:

- Cari/borc artar.
- Kasa/banka hemen etkilenmez.
- Net kar donemsel gider olarak duser.

## 9. Iptal Kurallari

Iptal yanlis yapilan islemi geri almak icin kullanilir.

Satis iptal edilirse:

- Orijinal satis silinmez.
- status = CANCELLED yapilir.
- Ters stok hareketi olusur.
- Ters kasa/banka/cari hareketi olusur.
- Ters ledger kaydi olusur.
- audit_logs kaydi olusur.
- Iptal nedeni zorunludur.

## 10. Iade Kurallari

Iade, musteri urunu geri getirdiginde kullanilir.

Iade edilirse:

- returns kaydi olusur.
- Satis status = RETURNED veya PARTIAL_RETURNED olur.
- Iade edilen urun saglam ise stok geri girer.
- Ayipli ise ayipli/problemli stok veya zarar/fire kaydi olusur.
- Para iadesi varsa kasa/banka cikisi olur.
- Cari satis ise cari alacak azalir.
- Kar terslenir.
- audit_logs kaydi olusur.

## 11. Degisim Kurallari

Degisim = eski urun iadesi + yeni urun satisi + fiyat farkidir.

Beklenen etkiler:

- Eski urun stok geri girer veya ayipli/problemli alana alinir.
- Yeni urun stoktan duser.
- Eski ve yeni urun farki hesaplanir.
- Fark pozitifse musteri odeme yapar.
- Fark negatifse musteriye iade veya cari mahsup yapilir.
- exchange_id ile eski iade ve yeni satis birbirine baglanir.
- audit_logs kaydi olusur.

## 12. Audit Kurallari

Asagidaki islemler audit_logs icine yazilmalidir:

- Satis
- Iptal
- Iade
- Degisim
- Gider
- Tahsilat
- Stok alis
- Manuel stok duzeltme
- Kasa duzeltme
- Cari duzeltme
- Ayipli mal girisi
- Fire/eksik stok

Audit kaydi en az su alanlari tasimalidir:

- workspace_id
- actor/user_id
- action
- entity_type
- entity_id
- before_data
- after_data
- reason
- created_at
