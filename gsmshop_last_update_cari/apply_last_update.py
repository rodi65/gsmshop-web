#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

# 1) State: müşteri telefonu ayrı alanını kaldır, cari kişi alanı ekle
text = text.replace(
"  const [customerName, setCustomerName] = useState('');\n  const [customerPhone, setCustomerPhone] = useState('');",
"  const [customerName, setCustomerName] = useState('');\n  const [cariPerson, setCariPerson] = useState('');"
)

# 2) Cari kişi seçenekleri
needle = "  const projectedProfit = saleTotal - purchaseTotal;\n"
replacement = """  const projectedProfit = saleTotal - purchaseTotal;

  const cariPersonOptions = useMemo(() => {
    const existing = data.sales
      .filter((sale) => sale.creditAmount > 0 && sale.customerName)
      .map((sale) => sale.customerName);
    if (customerName.trim()) existing.unshift(customerName.trim());
    return Array.from(new Set(existing));
  }, [data.sales, customerName]);
"""
text = text.replace(needle, replacement)

# 3) Satış türü değişince cari kişi sıfırlansın
text = text.replace(
"    setCardAmount('');\n    setMessage('');\n    setSuccess(null);",
"    setCardAmount('');\n    setCariPerson('');\n    setMessage('');\n    setSuccess(null);"
)

# 4) Validasyon metinleri
text = text.replace(
"    if (!isAccessorySale && !customerName.trim()) {\n      setMessage('Cihaz satışında müşteri adı zorunludur.');\n      return;\n    }",
"""    if (!isAccessorySale && !customerName.trim()) {
      setMessage('Müşteri adı soyadı / telefon birlikte yazılmalı.');
      return;
    }

    if (!isAccessorySale && creditAmount > 0 && !cariPerson.trim()) {
      setMessage('Kalan varsa cari kişi seçilmeden hesap kapanmaz.');
      return;
    }"""
)

# 5) Sale object: telefon ayrı tutulmasın, cari kişi seçimi borca bağlansın
text = text.replace(
"      customerName: isAccessorySale ? '' : customerName.trim(),\n      customerPhone: isAccessorySale ? '' : customerPhone.trim(),",
"      customerName: isAccessorySale ? '' : (creditAmount > 0 ? cariPerson.trim() : customerName.trim()),\n      customerDisplay: isAccessorySale ? '' : customerName.trim(),\n      customerPhone: '',\n      cariPerson: isAccessorySale ? '' : cariPerson.trim(),"
)

# 6) Reset
text = text.replace("    setCustomerPhone('');", "    setCariPerson('');")

# 7) JSX: müşteri adı + telefon tek alan olsun, müşteri telefonu ayrı alan kalksın
old_customer_block = """        {!isAccessorySale && (
          <>
            <label>
              Müşteri adı
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
            </label>
            <label>
              Müşteri telefonu
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
          </>
        )}"""

new_customer_block = """        {!isAccessorySale && (
          <label className="span-2">
            Müşteri adı soyadı / telefon
            <input
              placeholder="Örnek: Ahmet Yılmaz 0555 555 55 55"
              value={customerName}
              onChange={(event) => {
                setCustomerName(event.target.value);
                if (!cariPerson) setCariPerson(event.target.value);
              }}
              required
            />
          </label>
        )}"""
text = text.replace(old_customer_block, new_customer_block)

# 8) Kalan cari kişi alanı
old_alert = """        {!isAccessorySale && creditAmount > 0 && (
          <div className="alert span-3">
            <AlertTriangle size={18} />
            Nakit + kart toplamı satıştan düşük. {formatMoney(creditAmount)} cari kalan oluşacak.
          </div>
        )}"""

new_alert = """        {!isAccessorySale && creditAmount > 0 && (
          <>
            <div className="alert span-3">
              <AlertTriangle size={18} />
              Nakit + kart toplamı satıştan düşük. {formatMoney(creditAmount)} kalan cari oluşacak.
            </div>

            <label className="span-3">
              Kalan cari kişi
              <input
                list="cari-person-options"
                placeholder="Cari kişi seç veya müşteri adı soyadı / telefon yaz"
                value={cariPerson}
                onChange={(event) => setCariPerson(event.target.value)}
                required
              />
              <datalist id="cari-person-options">
                {cariPersonOptions.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>
          </>
        )}"""
text = text.replace(old_alert, new_alert)

# 9) Satış listesinde müşteriDisplay varsa onu göster
text = text.replace("sale.customerName || '-'", "sale.customerDisplay || sale.customerName || '-'")

# 10) Cari özeti telefon kolonu boş kalmasın
text = text.replace("item.customerPhone || '-'", "'Tek alanda'")

if "customerPhone, setCustomerPhone" in text:
    raise SystemExit("Güncelleme tamamlanmadı: customerPhone state hâlâ duruyor.")

app_path.write_text(text, encoding="utf-8")
print("GSMSHOP son istek uygulandı: müşteri telefonu ayrı alanı kaldırıldı, kalan cari kişi seçimi eklendi.")
