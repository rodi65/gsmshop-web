#!/usr/bin/env python3
from pathlib import Path
import re

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")
css_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/style.css")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

HELPER_BLOCK = '\nconst parseMoneyInput = (value) => Number(String(value || "0").replace(/\\./g, "").replace(/,/g, "").replace(/TL/g, "").replace(/₺/g, "").replace(/\\s/g, ""));\n\nconst formatMoneyInput = (value) => {\n  const digits = String(value || "").replace(/\\D/g, "");\n  if (!digits) return "";\n  return `${digits.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".")} TL`;\n};\n\nconst money = (value) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(parseMoneyInput(value))} TL`;\n\nconst stockRemainingAmount = (form) => {\n  const buy = parseMoneyInput(form.buy || 0);\n  const paid = parseMoneyInput(form.supplierPaid || 0);\n  return Math.max(buy - paid, 0);\n};\n\nconst sellerCariName = (name) => {\n  const clean = String(name || "").trim().toUpperCase();\n  return clean ? `SATICI ${clean}` : "";\n};\n'

# 1) Yardımcı para fonksiyonları
if "const parseMoneyInput" not in text:
    old_money = '''const money = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));'''
    if old_money in text:
        text = text.replace(old_money, HELPER_BLOCK)
    else:
        has_line = 'const has = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase());'
        text = text.replace(has_line, has_line + "\n" + HELPER_BLOCK)

# 2) Eğer money hâlâ ₺ üretiyorsa TL formatına çevir
text = re.sub(
    r'const money = \(value\) =>\s*new Intl\.NumberFormat\("tr-TR",[\s\S]*?\)\.format\(Number\(value \|\| 0\)\);',
    HELPER_BLOCK,
    text,
    count=1
)

# 3) Hesaplamaları TL string parse edecek hale getir
pairs = {
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
}
for old, new in pairs.items():
    text = text.replace(old, new)

# 4) Para inputlarını formatMoneyInput yap. Regex replacement string değil function kullanılıyor, kaçış hatası yok.
def fix_sale_input(match):
    label = match.group(1).replace(" (TL)", "")
    field = match.group(2)
    return f'<input type="text" inputMode="numeric" placeholder="{label}" value={{saleForm.{field}}} onChange={{(event) => setSaleForm({{ ...saleForm, {field}: formatMoneyInput(event.target.value) }})}} />'

text = re.sub(
    r'<input\s+type="number"\s+placeholder="(Satış fiyatı(?: \(TL\))?|Nakit(?: \(TL\))?|Kart(?: \(TL\))?)"\s+value=\{saleForm\.(total|cash|card)\}\s+onChange=\{\(event\) => setSaleForm\(\{ \...saleForm, \2: [^}]+ \}\)\}\s*/>',
    fix_sale_input,
    text
)

def fix_stock_input(match):
    label = match.group(1).replace(" (TL)", "")
    field = match.group(2)
    module = match.group(3)
    return f'<input type="text" inputMode="numeric" placeholder="{label}" value={{stockForm.{field}}} onChange={{(event) => setStockForm({{ ...stockForm, module: "{module}", {field}: formatMoneyInput(event.target.value) }})}} />'

text = re.sub(
    r'<input\s+type="number"\s+placeholder="(Alış(?: \(TL\))?|Satış(?: \(TL\))?|Ödenen(?: \(TL\))?)"\s+value=\{stockForm\.(buy|sell|supplierPaid)\}\s+onChange=\{\(event\) => setStockForm\(\{ \...stockForm, module: "(Cihaz|Aksesuar)", \2: [^}]+ \}\)\}\s*/>',
    fix_stock_input,
    text
)

# 5) Kalan alanı ekle
paid_line = '<input type="text" inputMode="numeric" placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: formatMoneyInput(event.target.value) })} />'
if paid_line in text and "stockRemainingAmount(stockForm)" not in text:
    text = text.replace(paid_line, paid_line + '''
        <div className="remaining-input">
          <span>Kalan</span>
          <b>{money(stockRemainingAmount(stockForm))}</b>
        </div>''')

# 6) SATICI cari önizleme
seller_line = '<input placeholder="Satanın Adı Soyadı" value={stockForm.sellerPerson} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sellerPerson: event.target.value })} />'
if seller_line in text and "seller-cari-preview" not in text:
    text = text.replace(seller_line, seller_line + '''
            <div className="seller-cari-preview">
              <span>Açılacak cari</span>
              <b>{sellerCariName(stockForm.sellerPerson) || "SATICI"}</b>
            </div>''')

# 7) Kayıt nesnesine cari bilgisi
if "sellerCariRemaining" not in text:
    old = '''      saleFormImageName: stockForm.saleFormImageName || "",
    };'''
    new = '''      saleFormImageName: stockForm.saleFormImageName || "",
      sellerCariName: (stockForm.acquisitionType || "Müşteri") === "Müşteri" ? sellerCariName(stockForm.sellerPerson) : "",
      sellerCariRemaining: (stockForm.acquisitionType || "Müşteri") === "Müşteri" ? stockRemainingAmount(stockForm) : 0,
    };'''
    text = text.replace(old, new)

# 8) Stok listesi kolonları
text = text.replace(
    'headers={["Tür", "Ürün", "Barkod/IMEI", "Stok", "Alış", "Satış", "Tedarikçi", "Düzelt"]}',
    'headers={["Tür", "Ürün", "Barkod/IMEI", "Stok", "Alış", "Satış", "Tedarikçi/Satıcı", "Cari Kalan", "Düzelt"]}'
)

old_row = '''        product.supplier || product.sellerPerson || "-",
        <button className="edit-btn" onClick={() => setEditingStock({ ...product })}><Pencil size={14} /> Düzenle</button>,'''
new_row = '''        product.supplier || product.sellerCariName || product.sellerPerson || "-",
        money(product.sellerCariRemaining || 0),
        <button className="edit-btn" onClick={() => setEditingStock({ ...product })}><Pencil size={14} /> Düzenle</button>,'''
text = text.replace(old_row, new_row)

app_path.write_text(text, encoding="utf-8")

# 9) CSS
CSS_ADD = '\n.remaining-input {\n  min-height: 42px;\n  border: 1px solid #cbd5e1;\n  border-radius: 12px;\n  padding: 6px 12px;\n  background: #f8fafc;\n  margin-top: 8px;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n}\n\n.remaining-input span,\n.seller-cari-preview span {\n  font-size: 12px;\n  color: #64748b;\n}\n\n.remaining-input b,\n.seller-cari-preview b {\n  font-size: 16px;\n  color: #020617;\n}\n\n.seller-cari-preview {\n  min-height: 42px;\n  border: 1px solid #cbd5e1;\n  border-radius: 12px;\n  padding: 6px 12px;\n  background: #f8fafc;\n  margin-top: 8px;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n}\n'
if css_path.exists():
    css = css_path.read_text(encoding="utf-8")
    if ".remaining-input" not in css:
        css += CSS_ADD
    css_path.write_text(css, encoding="utf-8")

print("V3 düzeltme tamamlandı: TL format, Kalan alanı ve SATICI cari bilgisi eklendi.")
