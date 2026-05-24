#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")
css_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/style.css")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

# Para formatı: ₺ yerine açık TL ibaresi.
old_money = '''const money = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));'''

new_money = '''const parseMoneyInput = (value) => Number(String(value || "0").replace(/\\\\./g, "").replace(/,/g, ""));
const formatMoneyInput = (value) => {
  const digits = String(value || "").replace(/\\\\D/g, "");
  return digits.replace(/\\\\B(?=(\\\\d{3})+(?!\\\\d))/g, ".");
};

const money = (value) =>
  `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(parseMoneyInput(value))} TL`;'''

if old_money in text:
    text = text.replace(old_money, new_money)
elif "const parseMoneyInput" not in text:
    raise SystemExit("money fonksiyonu beklenen yapıda bulunamadı. Önce V2 son tam sürüm cihaz dahil paketini uygulayın.")

# State: tedarikçi modalı
old_state = '''  const [editingSale, setEditingSale] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [query, setQuery] = useState("");'''

new_state = '''  const [editingSale, setEditingSale] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState(["MOBİLTEK İLETİŞİM", "GALAKSİ TEKNOLOJİ", "BASEUS TÜRKİYE"]);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");'''

text = text.replace(old_state, new_state)

# supplierOptions mevcut suppliers state ile birleşsin.
old_supplier_options = '''  const supplierOptions = useMemo(() => {
    return Array.from(new Set(stock.map((product) => product.supplier).filter(Boolean))).sort();
  }, [stock]);'''

new_supplier_options = '''  const supplierOptions = useMemo(() => {
    return Array.from(new Set([...suppliers, ...stock.map((product) => product.supplier).filter(Boolean)])).sort();
  }, [stock, suppliers]);'''

text = text.replace(old_supplier_options, new_supplier_options)

# Yardımcı tedarikçi kayıt fonksiyonu ekle.
insert_before = "  function saveSale() {"
supplier_func = '''  function addSupplier() {
    const name = newSupplierName.trim().toUpperCase();
    if (!name) return alert("Tedarikçi firma adı yaz");
    if (!suppliers.includes(name)) setSuppliers([name, ...suppliers]);
    setStockForm({ ...stockForm, supplier: name, acquisitionType: "Tedarikçi Firma" });
    setNewSupplierName("");
    setSupplierModalOpen(false);
  }

'''
if "function addSupplier()" not in text:
    text = text.replace(insert_before, supplier_func + insert_before)

# ParseMoneyInput kritik hesaplamalar.
repls = {
    "Number(saleForm.total || selectedProduct?.sell || 0)": "parseMoneyInput(saleForm.total || selectedProduct?.sell || 0)",
    "Number(saleForm.cash || 0)": "parseMoneyInput(saleForm.cash || 0)",
    "Number(saleForm.card || 0)": "parseMoneyInput(saleForm.card || 0)",
    "Number(stockForm.buy)": "parseMoneyInput(stockForm.buy)",
    "Number(stockForm.sell)": "parseMoneyInput(stockForm.sell)",
    "Number(stockForm.supplierPaid || 0)": "parseMoneyInput(stockForm.supplierPaid || 0)",
    "Number(editingStock.buy || 0)": "parseMoneyInput(editingStock.buy || 0)",
    "Number(editingStock.sell || 0)": "parseMoneyInput(editingStock.sell || 0)",
    "Number(editingStock.supplierPaid || 0)": "parseMoneyInput(editingStock.supplierPaid || 0)",
    "Number(sale.total || 0)": "parseMoneyInput(sale.total || 0)",
    "Number(sale.cash || 0)": "parseMoneyInput(sale.cash || 0)",
    "Number(sale.card || 0)": "parseMoneyInput(sale.card || 0)",
    "Number(product.buy || 0)": "parseMoneyInput(product.buy || 0)",
    "Number(product.sell || 0)": "parseMoneyInput(product.sell || 0)",
    "Number(row.totalBuy)": "parseMoneyInput(row.totalBuy)",
    "Number(row.paid)": "parseMoneyInput(row.paid)",
    "Number(row.remaining)": "parseMoneyInput(row.remaining)",
}
for old, new in repls.items():
    text = text.replace(old, new)

# totalBuy özel çarpımı koru
text = text.replace("const totalBuy = parseMoneyInput(product.buy || 0) * Number(product.qty || 0);", "const totalBuy = parseMoneyInput(product.buy || 0) * Number(product.qty || 0);")

# Fiyat input placeholderları ve formatlı onChange'ler.
price_repls = {
    'placeholder="Satış fiyatı" value={saleForm.total} onChange={(event) => setSaleForm({ ...saleForm, total: event.target.value })}':
    'placeholder="Satış fiyatı (TL)" value={saleForm.total} onChange={(event) => setSaleForm({ ...saleForm, total: formatMoneyInput(event.target.value) })}',
    'placeholder="Nakit" value={saleForm.cash} onChange={(event) => setSaleForm({ ...saleForm, cash: event.target.value })}':
    'placeholder="Nakit (TL)" value={saleForm.cash} onChange={(event) => setSaleForm({ ...saleForm, cash: formatMoneyInput(event.target.value) })}',
    'placeholder="Kart" value={saleForm.card} onChange={(event) => setSaleForm({ ...saleForm, card: event.target.value })}':
    'placeholder="Kart (TL)" value={saleForm.card} onChange={(event) => setSaleForm({ ...saleForm, card: formatMoneyInput(event.target.value) })}',
    'placeholder="Alış" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", buy: event.target.value })}':
    'placeholder="Alış (TL)" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", buy: formatMoneyInput(event.target.value) })}',
    'placeholder="Satış" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sell: event.target.value })}':
    'placeholder="Satış (TL)" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sell: formatMoneyInput(event.target.value) })}',
    'placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: event.target.value })}':
    'placeholder="Ödenen (TL)" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: formatMoneyInput(event.target.value) })}',
    'placeholder="Alış" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", buy: event.target.value })}':
    'placeholder="Alış (TL)" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", buy: formatMoneyInput(event.target.value) })}',
    'placeholder="Satış" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", sell: event.target.value })}':
    'placeholder="Satış (TL)" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", sell: formatMoneyInput(event.target.value) })}',
    'placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", supplierPaid: event.target.value })}':
    'placeholder="Ödenen (TL)" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", supplierPaid: formatMoneyInput(event.target.value) })}',
    'placeholder="Satış fiyatı" value={sale.total} onChange={(event) => setSale({ ...sale, total: event.target.value })}':
    'placeholder="Satış fiyatı (TL)" value={sale.total} onChange={(event) => setSale({ ...sale, total: formatMoneyInput(event.target.value) })}',
    'placeholder="Nakit" value={sale.cash} onChange={(event) => setSale({ ...sale, cash: event.target.value })}':
    'placeholder="Nakit (TL)" value={sale.cash} onChange={(event) => setSale({ ...sale, cash: formatMoneyInput(event.target.value) })}',
    'placeholder="Kart" value={sale.card} onChange={(event) => setSale({ ...sale, card: event.target.value })}':
    'placeholder="Kart (TL)" value={sale.card} onChange={(event) => setSale({ ...sale, card: formatMoneyInput(event.target.value) })}',
    'placeholder="Alış" value={item.buy} onChange={(event) => setItem({ ...item, buy: event.target.value })}':
    'placeholder="Alış (TL)" value={item.buy} onChange={(event) => setItem({ ...item, buy: formatMoneyInput(event.target.value) })}',
    'placeholder="Satış" value={item.sell} onChange={(event) => setItem({ ...item, sell: event.target.value })}':
    'placeholder="Satış (TL)" value={item.sell} onChange={(event) => setItem({ ...item, sell: formatMoneyInput(event.target.value) })}',
    'placeholder="Ödenen" value={item.supplierPaid || ""} onChange={(event) => setItem({ ...item, supplierPaid: event.target.value })}':
    'placeholder="Ödenen (TL)" value={item.supplierPaid || ""} onChange={(event) => setItem({ ...item, supplierPaid: formatMoneyInput(event.target.value) })}',
}
for old, new in price_repls.items():
    text = text.replace(old, new)

# Ürün seçildiğinde fiyatları formatlı yaz
text = text.replace('total: product?.sell || "", cash: product?.sell || ""', 'total: formatMoneyInput(product?.sell || ""), cash: formatMoneyInput(product?.sell || "")')

# Tedarikçi firma seçeneğini datalist yerine select + ekle seçeneği yap.
old_supplier_block = '''        {(stockForm.acquisitionType || "Müşteri") === "Tedarikçi Firma" && (
          <>
            <input list="supplier-options" placeholder="Tedarikçi Firma seç veya yaz" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplier: event.target.value })} />
            <datalist id="supplier-options">
              {supplierOptions.map((supplier) => <option key={supplier} value={supplier} />)}
            </datalist>
          </>
        )}'''

new_supplier_block = '''        {(stockForm.acquisitionType || "Müşteri") === "Tedarikçi Firma" && (
          <select value={stockForm.supplier} onChange={(event) => {
            if (event.target.value === "__add_supplier__") {
              setSupplierModalOpen(true);
              return;
            }
            setStockForm({ ...stockForm, module: "Cihaz", supplier: event.target.value });
          }}>
            <option value="">Tedarikçi Firma seç</option>
            <option value="__add_supplier__">+ Tedarikçi Ekle</option>
            {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
          </select>
        )}'''

if old_supplier_block in text:
    text = text.replace(old_supplier_block, new_supplier_block)
else:
    raise SystemExit("Tedarikçi firma bloğu beklenen yapıda bulunamadı. Önce cihaz alım mantığı güncellemesini uygulayın.")

# Aksesuar tedarikçi inputunu da select yap.
old_acc_supplier = '<input placeholder="Tedarikçi / Satıcı firma" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", supplier: event.target.value })} />'
new_acc_supplier = '''<select value={stockForm.supplier} onChange={(event) => {
          if (event.target.value === "__add_supplier__") {
            setSupplierModalOpen(true);
            return;
          }
          setStockForm({ ...stockForm, module: "Aksesuar", supplier: event.target.value });
        }}>
          <option value="">Tedarikçi Firma seç</option>
          <option value="__add_supplier__">+ Tedarikçi Ekle</option>
          {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
        </select>'''
text = text.replace(old_acc_supplier, new_acc_supplier)

# AccessoryStockForm'a supplierOptions prop ekle
text = text.replace(
    '<AccessoryStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} />',
    '<AccessoryStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} />'
)
text = text.replace(
    'function AccessoryStockForm({ stockForm, setStockForm, saveStock }) {',
    'function AccessoryStockForm({ stockForm, setStockForm, saveStock, supplierOptions = [] }) {'
)

# Supplier modal render ekle
modal_insert = '''        {editingSale && <SaleEditModal sale={editingSale} setSale={setEditingSale} save={updateSale} />}
        {editingStock && <StockEditModal item={editingStock} setItem={setEditingStock} save={updateStock} />}'''

modal_new = '''        {editingSale && <SaleEditModal sale={editingSale} setSale={setEditingSale} save={updateSale} />}
        {editingStock && <StockEditModal item={editingStock} setItem={setEditingStock} save={updateStock} />}
        {supplierModalOpen && (
          <div className="modal-bg">
            <div className="modal">
              <h2>Tedarikçi Ekle</h2>
              <input placeholder="Tedarikçi firma adı" value={newSupplierName} onChange={(event) => setNewSupplierName(event.target.value)} autoFocus />
              <div className="modal-actions">
                <button className="primary" onClick={addSupplier}><Save size={16} /> Kaydet</button>
                <button className="choice" onClick={() => setSupplierModalOpen(false)}><X size={16} /> Vazgeç</button>
              </div>
            </div>
          </div>
        )}'''

text = text.replace(modal_insert, modal_new)

app_path.write_text(text, encoding="utf-8")

if css_path.exists():
    css = css_path.read_text(encoding="utf-8")
    css_path.write_text(css, encoding="utf-8")

print("TL ibaresi, noktalı fiyat formatı ve tedarikçi ekleme penceresi güncellendi.")
