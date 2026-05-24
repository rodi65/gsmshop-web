#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
project = Path("/Users/ahmetshen/Documents/gsmshop-web")
app_path = project / "src" / "App.jsx"
service_path = project / "src" / "services" / "dataService.js"
pkg = Path(__file__).resolve().parent
if not app_path.exists():
    raise FileNotFoundError("src/App.jsx bulunamadı")
service_path.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(pkg / "src" / "services" / "dataService.js", service_path)
text = app_path.read_text(encoding="utf-8")
(project / "src" / "App.before_v28_cari_kasa_stok_fix.jsx").write_text(text, encoding="utf-8")
if "createCashMovement" not in text:
    text = text.replace("  createBankWithdrawal,\n  softDelete,", "  createBankWithdrawal,\n  createCashMovement,\n  findOrCreateContact,\n  softDelete,")
for fn in ["refreshFromDatabase", "saveStock", "saveSale", "saveExpense", "saveBankCashIncoming", "deleteStock", "deleteSale"]:
    text = re.sub(rf"(?<!async )function {fn}\\(", f"async function {fn}(", text)
if "const [contacts, setContacts]" not in text:
    text = text.replace('  const [syncMessage, setSyncMessage] = useState("");', '  const [syncMessage, setSyncMessage] = useState("");\n  const [contacts, setContacts] = useState([]);\n  const [cashMovements, setCashMovements] = useState([]);')
if "setContacts(data.contacts || []);" not in text:
    text = text.replace("    setBankMovements((data.bankMovements || []).map(fromDbBankMovement));", "    setBankMovements((data.bankMovements || []).map(fromDbBankMovement));\n    setContacts(data.contacts || []);\n    setCashMovements(data.cashMovements || []);")
if "const stockCashPayments = cashMovements" not in text:
    text = text.replace('  const expenseReport = {\n    total: expenses.reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),\n  };', '  const expenseReport = {\n    total: expenses.reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),\n  };\n\n  const stockCashPayments = cashMovements\n    .filter((item) => item.movement_type === "Stok Ödemesi" || item.movementType === "Stok Ödemesi")\n    .reduce((sum, item) => sum + Number(item.amount || 0), 0);')
text = text.replace("const cashWithBankIncoming = report.cash + bankReport.withdrawnFromBank;", "const cashWithBankIncoming = report.cash + bankReport.withdrawnFromBank - stockCashPayments;")
old = "    setStock([item, ...stock]);\n    setStockForm({ ...emptyStockForm, module });\n    setStockTab(\"liste\");"
new = """    try {\n      const saved = await createStockItem({\n        module: item.module,\n        device_type: item.deviceType,\n        category: item.category,\n        sub_type: item.accessorySubType,\n        brand: item.brand,\n        model: item.model,\n        memory: item.memory,\n        product_name: productTitle(item) || item.name || item.model || \"Ürün\",\n        barcode: item.module === \"Cihaz\" ? \"\" : item.barcode,\n        imei: item.module === \"Cihaz\" ? item.barcode : \"\",\n        buy_price: parseMoneyInput(item.buy),\n        sell_price: parseMoneyInput(item.sell),\n        quantity: Number(item.qty || 1),\n        supplier_name: item.supplier,\n        seller_person: item.sellerPerson,\n        seller_phone: item.sellerPhone,\n        acquisition_type: item.acquisitionType || stockForm.acquisitionType || \"Müşteri\",\n        supplier_paid: parseMoneyInput(item.supplierPaid),\n        seller_cari_remaining: Number(item.sellerCariRemaining || 0),\n        note: item.compatibleModel || \"\",\n      });\n\n      setStock([fromDbStock(saved), ...stock]);\n      setSyncMessage(\"Stok kalıcı olarak Supabase\'e kaydedildi. Cari ve kasa hareketi işlendi.\");\n    } catch (error) {\n      alert(error.message || \"Stok kaydı Supabase\'e yazılamadı.\");\n      return;\n    }\n\n    setStockForm({ ...emptyStockForm, module });\n    setStockTab(\"liste\");"""
if old in text:
    text = text.replace(old, new, 1)
if "supplier_paid" not in text[text.find("const fromDbStock"):text.find("const fromDbSale")]:
    text = text.replace("sellerCariRemaining: 0,", "sellerCariRemaining: Number(item.seller_cari_remaining || 0),\n  supplierPaid: money(Number(item.supplier_paid || 0)),\n  acquisitionType: item.acquisition_type || \"Müşteri\",")
app_path.write_text(text, encoding="utf-8")
print("GSMSHOP V28 cari + kasa + stok kalıcılık düzeltmesi uygulandı.")
print("ÖNEMLİ: Supabase SQL Editor’da supabase/v28_cari_kasa_stok.sql dosyasını da bir kez çalıştır.")
