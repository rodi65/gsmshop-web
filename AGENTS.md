# CEPLOG Project Rules

## Ana Ilke

CEPLOG'da stok, kasa, banka/POS, cari, satis, iptal, iade, degisim, tahsilat, gider ve stok alis islemleri merkezi transaction engine uzerinden yapilmalidir.

Hicbir UI ekrani stok, kasa, banka veya cari bakiyeyi dogrudan guncelleyemez.

## Degistirilemez Kurallar

1. Canli veride kritik finansal kayitlar DELETE edilmez.
2. Satis silinmez; iptal edilir.
3. Iade, satis kaydini bozmaz; ters hareket olusturur.
4. Degisim = eski urun iadesi + yeni urun satisi + fiyat farki islemidir.
5. Kasa bakiyesi elle set edilmez; cash_movements veya ledger hareketlerinden hesaplanir.
6. Banka/POS bakiyesi elle set edilmez; bank_movements/pos_movements veya ledger hareketlerinden hesaplanir.
7. Cari bakiye elle set edilmez; cari_movements uzerinden hesaplanir.
8. Stok adedi elle set edilmez; stock_movements uzerinden hesaplanir.
9. Satis kari satis anindaki alis fiyati ile sabitlenir.
10. Sonradan urun alis fiyati degisirse gecmis satisin kari degismez.
11. Her kritik islem workspace_id ile yapilir.
12. Her kritik islem audit_logs tablosuna yazilir.
13. Stok, kasa, banka, cari etkileyen her islem atomik transaction mantiginda yapilir.
14. Islem yarim kalirsa tum islem geri alinmalidir.
15. Ayni islem cift tiklama veya tekrar gonderimle iki kez olusmamalidir; idempotency_key kullanilmalidir.
16. UI ekranlari dogrudan coklu tablo guncellemesi yapmamali; transaction service veya database RPC cagirmalidir.
17. Stok ekranindan iptal, iade, duzeltme veya silme yapilmaz; bu islemler yalniz Gunluk Kasa Raporu / Kasa Beyni uzerinden kontrollu yapilir.

## Yasaklar

- Satisi dogrudan silmek yasak.
- Satis iptalini DELETE ile yapmak yasak.
- Iadeyi satis satirini duzenleyerek yapmak yasak.
- Degisimi tek urun guncellemesi gibi yapmak yasak.
- Stok adedini sebepsiz direkt update etmek yasak.
- Kasa tutarini direkt update etmek yasak.
- Cari bakiyeyi direkt update etmek yasak.
- Audit log olusturmadan kritik islem yapmak yasak.
- workspace_id bos kritik kayit olusturmak yasak.

## Zorunlu Islem Tipleri

- SALE_CASH
- SALE_CARD
- SALE_CARI
- SALE_MIXED_PAYMENT
- COLLECTION_CASH
- COLLECTION_BANK
- EXPENSE_CASH
- EXPENSE_BANK
- EXPENSE_CREDIT
- STOCK_PURCHASE_CASH
- STOCK_PURCHASE_BANK
- STOCK_PURCHASE_CREDIT
- SALE_CANCEL
- SALE_RETURN_CASH
- SALE_RETURN_CARD
- SALE_RETURN_CARI
- SALE_EXCHANGE
- SERVICE_SALE
- SERVICE_RETURN
- MANUAL_STOCK_ADJUSTMENT
- DEFECTIVE_PRODUCT_ENTRY
- LOSS_FIRE_ENTRY

## Test Zorunlulugu

Kasa, banka, cari, stok etkileyen degisikliklerden sonra su senaryolar test edilmelidir:

1. Nakit satis
2. Kart satis
3. Cari satis
4. Parcali odeme
5. Nakit tahsilat
6. Banka tahsilat
7. Nakit gider
8. Banka gider
9. Borc yazilan gider
10. Satis iptali
11. Satis iadesi
12. Degisim
13. Eksi stok engeli
14. Zararina satis uyarisi
15. Eksik workspace_id kontrolu
16. Eksik audit log kontrolu
17. Duplicate idempotency kontrolu
