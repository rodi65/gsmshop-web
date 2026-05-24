#!/usr/bin/env python3
from pathlib import Path
import re

project = Path("/Users/ahmetshen/Documents/gsmshop-web")
app_path = project / "src" / "App.jsx"

if not app_path.exists():
    raise FileNotFoundError("src/App.jsx bulunamadı")

text = app_path.read_text(encoding="utf-8")
backup = project / "src" / "App.before_v29_telefon_stok_mantik_fix.jsx"
backup.write_text(text, encoding="utf-8")

helper = '''
const normalizeText = (value) => String(value || "").toLocaleLowerCase("tr-TR");

const isPhoneStockItem = (item) => {
  const moduleName = normalizeText(item.module);
  const deviceType = normalizeText(item.deviceType || item.device_type);
  return moduleName === "cihaz" && deviceType === "telefon";
};

const isAccessoryStockItem = (item) => {
  const moduleName = normalizeText(item.module);
  return moduleName === "aksesuar";
};

const isOtherStockItem = (item) => {
  return !isPhoneStockItem(item) && !isAccessoryStockItem(item);
};

const nonPhoneStockBrands = ["Apple", "Samsung", "Xiaomi", "Huawei", "Lenovo", "HP", "Casper", "Monster", "Asus", "Acer", "Diğer"];
const nonPhoneStockTypes = ["Sıfır Garantili", "İkinci El", "Sıfır Spot"];
const nonPhoneStockGroups = ["Saat", "Tablet", "PC", "Elektronik", "Diğer"];
'''

if "const isPhoneStockItem = (item)" not in text:
    marker = "const sortSalesForList = (items) =>"
    idx = text.find(marker)
    if idx != -1:
        text = text[:idx] + helper + "\n" + text[idx:]
    else:
        text = helper + "\n" + text

if "dbRawCategory" not in text and "const fromDbStock" in text:
    text = text.replace(
        'const fromDbStock = (item) => ({',
        'const fromDbStock = (item) => {\n  const dbRawCategory = item.category || item.device_type || item.deviceType || "";\n  return ({'
    )
    text = text.replace(
        '});\n\nconst fromDbSale',
        '});\n};\n\nconst fromDbSale',
        1
    )

text = re.sub(
    r'deviceType:\s*item\.device_type\s*\|\|\s*item\.deviceType\s*\|\|\s*"Telefon",',
    'deviceType: item.device_type || item.deviceType || (item.module === "Cihaz" ? "Telefon" : dbRawCategory) || "Telefon",',
    text
)

validation_guard = '''
    const isSecondHandPhonePurchase =
      module === "Cihaz" &&
      (stockForm.deviceType || "Telefon") === "Telefon" &&
      stockForm.category === "İkinci El";

    const isCompanyEnoughPurchase =
      module === "Cihaz" &&
      ((stockForm.deviceType || "Telefon") !== "Telefon" || stockForm.category !== "İkinci El");
'''

if "const isSecondHandPhonePurchase =" not in text:
    text = text.replace(
        "  async function saveStock(module) {",
        "  async function saveStock(module) {\n" + validation_guard,
        1
    )

patterns_to_guard = [
    ('if (stockForm.acquisitionType === "Müşteri" && !stockForm.sellerPerson.trim()) {',
     'if (isSecondHandPhonePurchase && stockForm.acquisitionType === "Müşteri" && !stockForm.sellerPerson.trim()) {'),
    ('if (stockForm.acquisitionType === "Müşteri" && !stockForm.sellerPhone.trim()) {',
     'if (isSecondHandPhonePurchase && stockForm.acquisitionType === "Müşteri" && !stockForm.sellerPhone.trim()) {'),
    ('if (stockForm.acquisitionType === "Müşteri" && !stockForm.saleFormImage) {',
     'if (isSecondHandPhonePurchase && stockForm.acquisitionType === "Müşteri" && !stockForm.saleFormImage) {'),
]
for old, new in patterns_to_guard:
    text = text.replace(old, new)

text = text.replace(
    '{(phoneModels[stockForm.brand] || []).map((model) => (',
    '{((stockForm.deviceType || "Telefon") === "Telefon" ? (phoneModels[stockForm.brand] || []) : ["Model Ekle"]).map((model) => ('
)
text = text.replace(
    '{phoneModels[stockForm.brand]?.map((model) => (',
    '{((stockForm.deviceType || "Telefon") === "Telefon" ? (phoneModels[stockForm.brand] || []) : ["Model Ekle"]).map((model) => ('
)

text = text.replace('placeholder="Model"', 'placeholder="Model yaz / ekle"')
text = text.replace('"İkinciel"', '"İkinci El"')
text = text.replace("'İkinciel'", "'İkinci El'")
text = text.replace("İkinciel", "İkinci El")

text = text.replace("Aksesuar Cihaz Listesi", "Aksesuar Stok Listesi")
text = text.replace("Aksesuar Cihaz", "Aksesuar Stok")

text = text.replace(
    'stock.filter((item) => item.module === "Cihaz")',
    'stock.filter((item) => isPhoneStockItem(item))'
)
text = text.replace(
    'stock.filter((item) => item.module === "Aksesuar")',
    'stock.filter((item) => isAccessoryStockItem(item))'
)
text = text.replace(
    'stock.filter((item) => item.module !== "Cihaz" && item.module !== "Aksesuar")',
    'stock.filter((item) => isOtherStockItem(item))'
)
text = text.replace(
    'const deviceStock = stock.filter((item) => item.module === "Cihaz");',
    'const deviceStock = stock.filter((item) => isPhoneStockItem(item));'
)
text = text.replace(
    'const accessoryStock = stock.filter((item) => item.module === "Aksesuar");',
    'const accessoryStock = stock.filter((item) => isAccessoryStockItem(item));'
)
text = text.replace(
    'const otherStock = stock.filter((item) => item.module !== "Cihaz" && item.module !== "Aksesuar");',
    'const otherStock = stock.filter((item) => isOtherStockItem(item));'
)

text = text.replace(
    'device_type: item.deviceType,',
    'device_type: item.deviceType || stockForm.deviceType || "Telefon",'
)
text = text.replace(
    'category: item.category,',
    'category: item.category || stockForm.category || "",'
)
text = text.replace(
    'acquisition_type: item.acquisitionType || stockForm.acquisitionType || "Müşteri",',
    'acquisition_type: isSecondHandPhonePurchase ? "Müşteri" : "Tedarikçi",'
)

text = text.replace("Cihaz Stok listesi", "Cihaz Stok Listesi")
text = text.replace("Cihaz stok listesi", "Cihaz Stok Listesi")

if "Sadece İkinci El telefon alımlarında müşteri bilgisi zorunludur." not in text:
    text = text.replace(
        "Cihaz girişleri buradan yapılır. Eklenen cihazlar Stok bölümüne otomatik eklenir.",
        "Cihaz girişleri buradan yapılır. Eklenen cihazlar Stok bölümüne otomatik eklenir. Sadece İkinci El telefon alımlarında müşteri bilgisi zorunludur; diğer alımlarda firma bilgisi yeterlidir."
    )

app_path.write_text(text, encoding="utf-8")

print("GSMSHOP V29 Telefon/Stok mantık düzeltmesi uygulandı.")
print("Yedek: src/App.before_v29_telefon_stok_mantik_fix.jsx")
