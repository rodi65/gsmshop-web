#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")
css_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/style.css")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

if 'const memoryOptions = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];' not in text:
    text = text.replace(
        'const brands = ["Apple", "Samsung", "Huawei", "Xiaomi", "Oppo", "Vivo", "Honor", "Realme", "Tecno", "Poco", "OnePlus", "TCL", "Infinix", "Alcatel", "Motorola"];',
        'const brands = ["Apple", "Samsung", "Huawei", "Xiaomi", "Oppo", "Vivo", "Honor", "Realme", "Tecno", "Poco", "OnePlus", "TCL", "Infinix", "Alcatel", "Motorola"];\nconst memoryOptions = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];'
    )

supplier_options_code = """  const supplierOptions = useMemo(() => {
    return Array.from(new Set(stock.map((product) => product.supplier).filter(Boolean))).sort();
  }, [stock]);

"""
if "const supplierOptions = useMemo" not in text:
    text = text.replace("  const filteredStock = stock.filter((product) =>", supplier_options_code + "  const filteredStock = stock.filter((product) =>")

text = text.replace("      qty: Number(stockForm.qty),", '      qty: module === "Cihaz" ? 1 : Number(stockForm.qty),')

old_validate = '  function validateStock() {\n    if (!stockForm.supplier.trim()) return "Tedarikçi / satıcı firma yaz";\n    if (!stockForm.buy || !stockForm.sell || !stockForm.qty) return "Alış, satış ve stok adedi yaz";\n    if (!stockForm.barcode) return "Barkod / IMEI yaz";\n    if (stock.some((product) => product.barcode === stockForm.barcode)) return "Bu Barkod / IMEI zaten kayıtlı";\n    return "";\n  }'
new_validate = '  function validateStock(module = stockForm.module) {\n    const isDevice = module === "Cihaz";\n    const isCustomerPurchase = isDevice && (stockForm.acquisitionType || "Müşteri") === "Müşteri";\n\n    if (!isCustomerPurchase && !stockForm.supplier.trim()) return "Tedarikçi / satıcı firma seç";\n    if (isCustomerPurchase && !stockForm.sellerPerson.trim()) return "Satanın adı soyadı yaz";\n    if (isCustomerPurchase && !stockForm.sellerPhone.trim()) return "Satanın telefonu yaz";\n\n    if (isDevice) {\n      if (!stockForm.buy || !stockForm.sell) return "Alış ve satış fiyatı yaz";\n    } else {\n      if (!stockForm.buy || !stockForm.sell || !stockForm.qty) return "Alış, satış ve stok adedi yaz";\n    }\n\n    if (!stockForm.barcode) return "Barkod / IMEI yaz";\n    if (stock.some((product) => product.barcode === stockForm.barcode)) return "Bu Barkod / IMEI zaten kayıtlı";\n    return "";\n  }'
if old_validate in text:
    text = text.replace(old_validate, new_validate)
else:
    raise SystemExit("validateStock fonksiyonu beklenen yapıda bulunamadı. Önce V2 son tam sürüm cihaz dahil paketini uygulayın.")

text = text.replace("    const error = validateStock();", "    const error = validateStock(module);")

text = text.replace(
    '<DeviceStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} />',
    '<DeviceStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} />'
)

text = text.replace(
    'function DeviceStockForm({ stockForm, setStockForm, saveStock }) {',
    'function DeviceStockForm({ stockForm, setStockForm, saveStock, supplierOptions = [] }) {'
)

old_memory_input = '<input placeholder="Hafıza" value={stockForm.memory} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", memory: event.target.value })} />'
new_memory_select = '<select value={stockForm.memory} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", memory: event.target.value })}>\n          {memoryOptions.map((memory) => <option key={memory}>{memory}</option>)}\n        </select>'
text = text.replace(old_memory_input, new_memory_select)

old_device_part = '        <input placeholder="Tedarikçi / Satıcı firma" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplier: event.target.value })} />\n\n        <select value={stockForm.acquisitionType || "Müşteri"} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", acquisitionType: event.target.value })}>\n          <option>Müşteri</option>\n          <option>Tedarikçi Firma</option>\n        </select>\n\n        <input type="number" placeholder="Alış" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", buy: event.target.value })} />\n        <input type="number" placeholder="Satış" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sell: event.target.value })} />\n        <input type="number" placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: event.target.value })} />\n        <input type="number" placeholder="Stok adedi" value={stockForm.qty} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", qty: event.target.value })} />'
new_device_part = '        <select value={stockForm.acquisitionType || "Müşteri"} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", acquisitionType: event.target.value, supplier: event.target.value === "Müşteri" ? "" : stockForm.supplier })}>\n          <option>Müşteri</option>\n          <option>Tedarikçi Firma</option>\n        </select>\n\n        {(stockForm.acquisitionType || "Müşteri") === "Tedarikçi Firma" && (\n          <>\n            <input list="supplier-options" placeholder="Tedarikçi Firma seç veya yaz" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplier: event.target.value })} />\n            <datalist id="supplier-options">\n              {supplierOptions.map((supplier) => <option key={supplier} value={supplier} />)}\n            </datalist>\n          </>\n        )}\n\n        <input type="number" placeholder="Alış" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", buy: event.target.value })} />\n        <input type="number" placeholder="Satış" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sell: event.target.value })} />\n        <input type="number" placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: event.target.value })} />'
if old_device_part in text:
    text = text.replace(old_device_part, new_device_part)
else:
    raise SystemExit("Cihaz formundaki tedarikçi/stok alanları beklenen yapıda bulunamadı. Önce V2 son tam sürüm cihaz dahil paketini uygulayın.")

text = text.replace(
    '<h3>Müşteriden Alım Bilgileri</h3>',
    '<h3>Müşteriden Alım Bilgileri</h3><p className="mini-note">Alım tipi Müşteri seçildiğinde tedarikçi firma bilgisi istenmez.</p>'
)

text = text.replace('product.supplier,', 'product.supplier || product.sellerPerson || "-",')

app_path.write_text(text, encoding="utf-8")

if css_path.exists():
    css = css_path.read_text(encoding="utf-8")
    if ".mini-note" not in css:
        css += '\n.mini-note {\n  margin: -4px 0 10px;\n  color: #64748b;\n  font-size: 13px;\n}\n'
    css_path.write_text(css, encoding="utf-8")

print("Cihaz alım mantığı güncellendi: müşteri/tedarikçi ayrımı, hafıza seçenekleri, stok adedi kaldırma ve tedarikçi listesi eklendi.")
