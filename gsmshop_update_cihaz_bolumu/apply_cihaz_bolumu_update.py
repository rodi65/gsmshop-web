#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")
css_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/style.css")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

old_form_fields = '''  supplier: "",
  supplierPaid: "",
  sellerPerson: "",
  sellerPhone: "",
  note: "",'''

new_form_fields = '''  supplier: "",
  supplierPaid: "",
  acquisitionType: "Müşteri",
  sellerPerson: "",
  sellerPhone: "",
  saleDate: "",
  buyerName: "",
  saleFormImageName: "",
  note: "",'''

if old_form_fields in text:
    text = text.replace(old_form_fields, new_form_fields)

text = text.replace("  function saveStock() {", "  function saveStock(forcedModule = null) {")
text = text.replace("    const module = stockForm.module;", "    const module = forcedModule || stockForm.module;")

old_item_fields = '''      supplierPaid: Number(stockForm.supplierPaid || 0),
    };'''

new_item_fields = '''      supplierPaid: Number(stockForm.supplierPaid || 0),
      acquisitionType: stockForm.acquisitionType || "Müşteri",
      sellerPerson: stockForm.sellerPerson || "",
      sellerPhone: stockForm.sellerPhone || "",
      saleDate: stockForm.saleDate || new Date().toISOString(),
      buyerName: stockForm.buyerName || "",
      saleFormImageName: stockForm.saleFormImageName || "",
    };'''

if old_item_fields in text:
    text = text.replace(old_item_fields, new_item_fields)

old_cihaz_block = '''        {active === "cihaz" && (
          <section className="card">
            <h2>Cihaz</h2>
            <p>Cihaz işlemleri için Kasa ekranından satış yapabilir, Stok ekranından kayıt ve liste işlemlerini yönetebilirsin.</p>
          </section>
        )}'''

new_cihaz_block = '''        {active === "cihaz" && (
          <section className="card">
            <h2>Cihaz Kaydı</h2>
            <p>Cihaz girişleri buradan yapılır. Eklenen cihazlar Stok bölümüne otomatik eklenir.</p>

            <div className="form-grid">
              <select value={stockForm.deviceType} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", deviceType: event.target.value })}>
                {deviceTypes.map((item) => <option key={item}>{item}</option>)}
              </select>

              <select value={stockForm.condition} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", condition: event.target.value })}>
                <option>Sıfır Garantili</option>
                <option>Sıfır Spot</option>
                <option>İkinci El</option>
              </select>

              <select value={stockForm.brand} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", brand: event.target.value, model: modelsByBrand[event.target.value]?.[0] || "" })}>
                {brands.map((brand) => <option key={brand}>{brand}</option>)}
              </select>

              <select value={stockForm.model} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", model: event.target.value })}>
                {(modelsByBrand[stockForm.brand] || []).map((model) => <option key={model}>{model}</option>)}
              </select>

              <input placeholder="Hafıza" value={stockForm.memory} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", memory: event.target.value })} />

              <input
                placeholder="Barkod / IMEI"
                inputMode="numeric"
                maxLength={15}
                value={stockForm.barcode}
                onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", barcode: cleanBarcode(event.target.value) })}
              />

              <input placeholder="Tedarikçi / Satıcı firma" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplier: event.target.value })} />

              <select value={stockForm.acquisitionType || "Müşteri"} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", acquisitionType: event.target.value })}>
                <option>Müşteri</option>
                <option>Tedarikçi Firma</option>
              </select>

              <input type="number" placeholder="Alış" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", buy: event.target.value })} />
              <input type="number" placeholder="Satış" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sell: event.target.value })} />
              <input type="number" placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: event.target.value })} />
              <input type="number" placeholder="Stok adedi" value={stockForm.qty} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", qty: event.target.value })} />
            </div>

            {(stockForm.acquisitionType || "Müşteri") === "Müşteri" && (
              <div className="conditional-panel">
                <h3>Müşteriden Alım Bilgileri</h3>
                <div className="form-grid">
                  <input placeholder="Satanın Adı Soyadı" value={stockForm.sellerPerson} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sellerPerson: event.target.value })} />
                  <input placeholder="Satanın Telefonu" value={stockForm.sellerPhone} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sellerPhone: event.target.value })} />
                  <input value={stockForm.saleDate || new Date().toLocaleString("tr-TR")} readOnly title="Sattığı tarih otomatik girilir" />
                  <input placeholder="Alımı yapan" value={stockForm.buyerName} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", buyerName: event.target.value })} />
                  <input type="file" accept="image/*,.pdf" onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", saleFormImageName: event.target.files?.[0]?.name || "" })} />
                  <input placeholder="Satış formu resmi" value={stockForm.saleFormImageName} readOnly />
                </div>
              </div>
            )}

            <input placeholder="Not" value={stockForm.note} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", note: event.target.value })} />

            <button className="primary" onClick={() => saveStock("Cihaz")}><Plus size={16} /> Cihazı Stoka Kaydet</button>
          </section>
        )}'''

if old_cihaz_block not in text:
    raise SystemExit("Cihaz bölümü beklenen yapıda bulunamadı. Önce son tam sürüm paketini uyguladığından emin ol.")

text = text.replace(old_cihaz_block, new_cihaz_block)
text = text.replace('placeholder="Firmaya ödenen"', 'placeholder="Ödenen"')
text = text.replace('placeholder="Yapılan ödeme"', 'placeholder="Ödenen"')

app_path.write_text(text, encoding="utf-8")

if css_path.exists():
    css = css_path.read_text(encoding="utf-8")
    if ".conditional-panel" not in css:
        css += '''
.conditional-panel {
  margin-top: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 16px;
}

.conditional-panel h3 {
  margin: 0 0 10px;
}
'''
    css_path.write_text(css, encoding="utf-8")

print("Cihaz bölümü güncellendi: Cihaz sekmesi kaldırıldı, IMEI 15 hane sınırı korundu, Ödenen alanı geldi, müşteriden alım bilgileri eklendi.")
