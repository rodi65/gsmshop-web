import React, { useMemo, useState } from "react";
import { Wallet, Smartphone, Headphones, Package, Search, Wrench, TrendingUp, Plus, Pencil, Save, X } from "lucide-react";

const parseMoneyInput = (value) => Number(String(value || "0").replace(/\./g, "").replace(/,/g, "").replace(/TL/g, "").replace(/₺/g, "").replace(/\s/g, ""));
const formatMoneyInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} TL`;
};

const cleanMoneyTyping = (value) => String(value || "").replace(/\D/g, "");
const stripMoneyForEdit = (value) => String(value || "").replace(/\D/g, "");
const cleanPhone = (value) => String(value || "").replace(/\D/g, "").slice(0, 11);
const money = (value) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(parseMoneyInput(value))} TL`;
const has = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase());
const stockRemainingAmount = (form) => Math.max(parseMoneyInput(form.buy) - parseMoneyInput(form.supplierPaid), 0);
const sellerCariName = (name) => {
  const clean = String(name || "").trim().toUpperCase();
  return clean ? `SATICI ${clean}` : "";
};

const saleTypes = ["Telefon Satışı", "Saat Satışı", "Tablet Satışı", "PC Satışı", "Elektronik Satışı", "Aksesuar Satışı"];
const deviceTypes = ["Telefon", "Saat", "Tablet", "PC", "Elektronik"];
const banks = ["Ziraat", "İş Bankası", "Garanti", "Akbank", "Yapı Kredi", "Halkbank", "VakıfBank", "QNB", "Enpara", "Diğer"];
const memoryOptions = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];
const categories = ["Kılıf", "Şarj", "Koruyucu", "Kulaklık", "Blutut Kulaklık"];
const brands = ["Apple", "Samsung", "Huawei", "Xiaomi", "Oppo", "Vivo", "Honor", "Realme", "Tecno", "Poco", "OnePlus", "TCL", "Infinix", "Alcatel", "Motorola"];

const modelsByBrand = {
  Apple: ["iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone Air", "iPhone 17", "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15", "Apple Watch Ultra 3", "Apple Watch Series 11", "Apple Watch SE 3"],
  Samsung: ["Galaxy S26 Ultra", "Galaxy S26+", "Galaxy S26", "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25", "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy Watch Ultra", "Galaxy Watch7"],
  Huawei: ["Huawei Pura 80 Ultra", "Huawei Pura 80 Pro", "Huawei Mate 70 Pro", "Huawei Pura 70 Pro", "Huawei Watch GT 6 Pro", "Huawei Watch GT 6"],
  Xiaomi: ["Xiaomi 15 Ultra", "Xiaomi 15 Pro", "Xiaomi 15", "Redmi Note 14 Pro+ 5G", "Xiaomi Watch S4"],
  Oppo: ["OPPO Find X9 Pro", "OPPO Find X9", "OPPO Reno15 Pro 5G"],
  Vivo: ["vivo X300 Pro", "vivo X300", "vivo X200 Pro"],
  Honor: ["HONOR Magic8 Pro", "HONOR Magic8", "HONOR Magic7 Pro"],
  Realme: ["realme GT 7 Pro", "realme GT 6", "realme 14 Pro+"],
  Tecno: ["TECNO Phantom V Fold2", "TECNO Camon 40 Pro"],
  Poco: ["POCO F8 Ultra", "POCO F8 Pro", "POCO F7 Ultra"],
  OnePlus: ["OnePlus 13", "OnePlus 13R", "OnePlus 12"],
  TCL: ["TCL 60 SE", "TCL 50 Pro NXTPAPER"],
  Infinix: ["Infinix Zero 40 5G", "Infinix Note 40 Pro+"],
  Alcatel: ["Alcatel 1S 2021", "Alcatel 1L Pro"],
  Motorola: ["Motorola Razr Ultra", "Motorola Edge 60 Pro"],
};

const emptyStockForm = {
  module: "Cihaz",
  deviceType: "Telefon",
  condition: "Sıfır Garantili",
  brand: "Apple",
  model: "iPhone 17 Pro Max",
  memory: "256 GB",
  category: "Kılıf",
  name: "",
  compatibleModel: "",
  barcode: "",
  buy: "",
  sell: "",
  supplierPaid: "",
  qty: "",
  acquisitionType: "Müşteri",
  supplier: "",
  sellerPerson: "",
  sellerPhone: "",
  saleDate: "",
  buyerName: "",
  saleFormImageName: "",
  note: "",
};

const initialStock = [
  {
    id: 101,
    module: "Cihaz",
    deviceType: "Telefon",
    condition: "Sıfır Garantili",
    brand: "Apple",
    model: "iPhone 17 Pro Max",
    memory: "256 GB",
    barcode: "356789123456789",
    buy: "70.000 TL",
    sell: "85.000 TL",
    supplierPaid: "70.000 TL",
    qty: 1,
    acquisitionType: "Tedarikçi Firma",
    supplier: "MOBİLTEK İLETİŞİM",
    sellerPerson: "",
    sellerPhone: "",
    saleDate: "",
    buyerName: "",
    saleFormImageName: "",
    sellerCariName: "",
    sellerCariRemaining: 0,
    note: "",
  },
  {
    id: 102,
    module: "Cihaz",
    deviceType: "Telefon",
    condition: "Sıfır Spot",
    brand: "Samsung",
    model: "Galaxy S26 Ultra",
    memory: "512 GB",
    barcode: "356789123456780",
    buy: "80.000 TL",
    sell: "98.000 TL",
    supplierPaid: "80.000 TL",
    qty: 1,
    acquisitionType: "Tedarikçi Firma",
    supplier: "GALAKSİ TEKNOLOJİ",
    sellerPerson: "",
    sellerPhone: "",
    saleDate: "",
    buyerName: "",
    saleFormImageName: "",
    sellerCariName: "",
    sellerCariRemaining: 0,
    note: "",
  },
  {
    id: 201,
    module: "Aksesuar",
    deviceType: "Aksesuar",
    category: "Kılıf",
    name: "iPhone 17 Pro Max Kılıf",
    compatibleModel: "iPhone 17 Pro Max",
    barcode: "869000000101",
    buy: "150 TL",
    sell: "400 TL",
    supplierPaid: "150 TL",
    qty: 20,
    supplier: "BASEUS TÜRKİYE",
  },
];

const initialSales = [
  {
    id: 1,
    type: "Telefon Satışı",
    customer: "Mehmet Kaya 0555 555 55 55",
    cariPerson: "Mehmet Kaya 0555 555 55 55",
    bank: "Garanti",
    productName: "iPhone 17 Pro Max 256 GB",
    productId: 101,
    productBuyPrice: "70.000 TL",
    productBarcode: "356789123456789",
    total: "85.000 TL",
    cash: "30.000 TL",
    card: "40.000 TL",
    remaining: 15000,
    profit: 15000,
    date: new Date().toISOString(),
  },
];

function productTitle(product) {
  if (!product) return "";
  if (product.module === "Aksesuar") return product.name || "-";
  return [product.brand, product.model, product.memory].filter(Boolean).join(" ");
}

function cleanBarcode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function calcSale(sale) {
  const total = parseMoneyInput(sale.total);
  const cash = parseMoneyInput(sale.cash);
  const card = parseMoneyInput(sale.card);
  const remaining = sale.type === "Aksesuar Satışı" ? 0 : Math.max(total - cash - card, 0);
  const profit = total - parseMoneyInput(sale.productBuyPrice || 0);
  return { ...sale, total: money(total), cash: money(cash), card: money(card), remaining, profit };
}

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={headers.length}>Kayıt yok.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("kasa");
  const [kasaTab, setKasaTab] = useState("satis");
  const [karaTab, setKaraTab] = useState("alacak");
  const [stockTab, setStockTab] = useState("liste");
  const [stock, setStock] = useState(initialStock);
  const [sales, setSales] = useState(initialSales);
  const [suppliers, setSuppliers] = useState(["MOBİLTEK İLETİŞİM", "GALAKSİ TEKNOLOJİ", "BASEUS TÜRKİYE"]);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [bankCashForm, setBankCashForm] = useState({ amount: "", note: "" });
  const [bankMovements, setBankMovements] = useState([
    { id: 1, type: "Bankaya Giden", amount: "40.000 TL", note: "Kart ödemesi", date: new Date().toISOString() },
  ]);
  const [saleForm, setSaleForm] = useState({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [editingSale, setEditingSale] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [query, setQuery] = useState("");

  const supplierOptions = useMemo(() => {
    return Array.from(new Set([...suppliers, ...stock.map((product) => product.supplier).filter(Boolean)])).sort();
  }, [suppliers, stock]);

  const isAccessorySale = saleForm.type === "Aksesuar Satışı";
  const saleDeviceType = saleForm.type.replace(" Satışı", "");

  const saleProducts = stock
    .filter((product) => isAccessorySale ? product.module === "Aksesuar" : product.module === "Cihaz" && product.deviceType === saleDeviceType)
    .filter((product) => !saleForm.search || has(productTitle(product), saleForm.search) || has(product.barcode, saleForm.search))
    .filter((product) => Number(product.qty || 0) > 0);

  const selectedProduct = stock.find((product) => String(product.id) === String(saleForm.productId));
  const saleTotal = parseMoneyInput(saleForm.total || selectedProduct?.sell || 0);
  const saleCash = parseMoneyInput(saleForm.cash || 0);
  const saleCard = parseMoneyInput(saleForm.card || 0);
  const saleRemaining = isAccessorySale ? 0 : Math.max(saleTotal - saleCash - saleCard, 0);

  const alacaklarim = sales.filter((sale) => sale.type !== "Aksesuar Satışı" && Number(sale.remaining || 0) > 0);

  const borclarim = useMemo(() => {
    const map = new Map();
    stock.forEach((product) => {
      if (!product.supplier) return;
      const totalBuy = parseMoneyInput(product.buy) * Number(product.qty || 0);
      const paid = parseMoneyInput(product.supplierPaid || 0);
      const row = map.get(product.supplier) || { supplier: product.supplier, lastProduct: "", totalBuy: 0, paid: 0, remaining: 0 };
      row.lastProduct = productTitle(product);
      row.totalBuy += totalBuy;
      row.paid += paid;
      row.remaining += Math.max(totalBuy - paid, 0);
      map.set(product.supplier, row);
    });
    return Array.from(map.values());
  }, [stock]);

  const report = {
    total: sales.reduce((sum, sale) => sum + parseMoneyInput(sale.total), 0),
    cash: sales.reduce((sum, sale) => sum + parseMoneyInput(sale.cash), 0),
    card: sales.reduce((sum, sale) => sum + parseMoneyInput(sale.card), 0),
    remaining: sales.reduce((sum, sale) => sum + Number(sale.remaining || 0), 0),
    profit: sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0),
  };

  const bankReport = {
    totalToBank: bankMovements.filter((item) => item.type === "Bankaya Giden").reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
    withdrawnFromBank: bankMovements.filter((item) => item.type === "Bankadan Çekilen").reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
  };
  bankReport.remainingInBank = Math.max(bankReport.totalToBank - bankReport.withdrawnFromBank, 0);
  const cashWithBankIncoming = report.cash + bankReport.withdrawnFromBank;

  const filteredStock = stock.filter((product) =>
    !query ||
    has(productTitle(product), query) ||
    has(product.barcode, query) ||
    has(product.supplier, query) ||
    has(product.brand, query) ||
    has(product.model, query) ||
    has(product.name, query) ||
    has(product.sellerPerson, query) ||
    has(product.sellerCariName, query)
  );

  const filteredSales = sales.filter((sale) =>
    !query ||
    has(sale.productName, query) ||
    has(sale.customer, query) ||
    has(sale.cariPerson, query) ||
    has(sale.productBarcode, query)
  );

  function addSupplier() {
    const name = newSupplierName.trim().toUpperCase();
    if (!name) return alert("Tedarikçi firma adı yaz");
    if (!suppliers.includes(name)) setSuppliers([name, ...suppliers]);
    setStockForm({ ...stockForm, supplier: name, acquisitionType: "Tedarikçi Firma" });
    setNewSupplierName("");
    setSupplierModalOpen(false);
  }

  function askDeletePassword() {
    const password = window.prompt("Silmek için şifre gir");
    return password === "1";
  }

  function deleteSale(id) {
    if (!askDeletePassword()) return alert("Şifre yanlış. Silme işlemi iptal edildi.");
    setSales(sales.filter((sale) => sale.id !== id));
  }

  function deleteStock(id) {
    if (!askDeletePassword()) return alert("Şifre yanlış. Silme işlemi iptal edildi.");
    setStock(stock.filter((product) => product.id !== id));
  }

  function deleteSupplierDebt(supplierName) {
    if (!askDeletePassword()) return alert("Şifre yanlış. Silme işlemi iptal edildi.");
    setStock(stock.filter((product) => product.supplier !== supplierName));
  }

  function saveBankCashIncoming() {
    const amount = parseMoneyInput(bankCashForm.amount);
    if (!amount) return alert("Bankadan gelen nakit tutarını yaz");
    if (amount > bankReport.remainingInBank) return alert("Bankada kalan tutardan fazla çekim yapılamaz");

    setBankMovements([
      {
        id: Date.now(),
        type: "Bankadan Çekilen",
        amount: money(amount),
        note: bankCashForm.note || "Kasaya nakit giriş",
        date: new Date().toISOString(),
      },
      ...bankMovements,
    ]);

    setBankCashForm({ amount: "", note: "" });
    alert("Bankadan gelen para nakit kasasına eklendi ve Bankadan Çekilen bölümüne işlendi.");
  }

  function validateStock(module) {
    const isDevice = module === "Cihaz";
    const isCustomerPurchase = isDevice && (stockForm.acquisitionType || "Müşteri") === "Müşteri";
    if (!isCustomerPurchase && !stockForm.supplier.trim()) return "Tedarikçi firma seç";
    if (isCustomerPurchase && !stockForm.sellerPerson.trim()) return "Satanın adı soyadı yaz";
    if (isCustomerPurchase && !stockForm.sellerPhone.trim()) return "Satanın telefonu yaz";
    if (isCustomerPurchase && cleanPhone(stockForm.sellerPhone).length !== 11) return "Satanın telefonu 11 rakam olmalı";
    if (isCustomerPurchase && !stockForm.saleFormImageName) return "Satış formu resmi eklemeden kayıt yapılamaz";
    if (!stockForm.buy || !stockForm.sell) return "Kaça aldın ve kaça satacaksın alanlarını yaz";
    if (!isDevice && !stockForm.qty) return "Stok adedi yaz";
    if (!stockForm.barcode) return "Barkod / IMEI yaz";
    if (stockForm.barcode.length > 15) return "Barkod / IMEI en fazla 15 rakam olabilir";
    if (stock.some((product) => product.barcode === stockForm.barcode)) return "Bu Barkod / IMEI zaten kayıtlı";
    return "";
  }

  function saveStock(module = stockForm.module) {
    const error = validateStock(module);
    if (error) return alert(error);

    const isDevice = module === "Cihaz";
    const isCustomerPurchase = isDevice && (stockForm.acquisitionType || "Müşteri") === "Müşteri";
    const item = {
      ...stockForm,
      id: Date.now(),
      module,
      deviceType: isDevice ? stockForm.deviceType : "Aksesuar",
      barcode: cleanBarcode(stockForm.barcode),
      qty: isDevice ? 1 : Number(stockForm.qty || 0),
      buy: formatMoneyInput(stockForm.buy),
      sell: formatMoneyInput(stockForm.sell),
      supplierPaid: formatMoneyInput(stockForm.supplierPaid),
      supplier: isCustomerPurchase ? "" : stockForm.supplier,
      saleDate: stockForm.saleDate || new Date().toISOString(),
      sellerPhone: cleanPhone(stockForm.sellerPhone),
      sellerCariName: isCustomerPurchase ? sellerCariName(stockForm.sellerPerson) : "",
      sellerCariRemaining: isCustomerPurchase ? stockRemainingAmount(stockForm) : 0,
    };

    setStock([item, ...stock]);
    setStockForm({ ...emptyStockForm, module });
    setStockTab("liste");
  }

  function saveSale() {
    if (!selectedProduct) return alert("Ürün seç");
    if (Number(selectedProduct.qty || 0) <= 0) return alert("Stok yok");
    if (!isAccessorySale && !saleForm.customer.trim()) return alert("Müşteri adı soyadı / telefon yaz");
    if (!isAccessorySale && saleRemaining > 0 && !saleForm.cariPerson.trim()) return alert("Kalan varsa cari kişi seçilmelidir");
    if (saleCard > 0 && !saleForm.bank) return alert("Kart ödeme varsa banka seç");

    const sale = calcSale({
      id: Date.now(),
      type: saleForm.type,
      customer: isAccessorySale ? "" : saleForm.customer.trim(),
      cariPerson: isAccessorySale ? "" : saleForm.cariPerson.trim(),
      bank: saleForm.bank,
      productName: productTitle(selectedProduct),
      productId: selectedProduct.id,
      productBuyPrice: selectedProduct.buy,
      productBarcode: selectedProduct.barcode,
      total: saleForm.total || selectedProduct.sell,
      cash: saleForm.cash,
      card: saleForm.card,
      date: new Date().toISOString(),
    });

    setStock(stock.map((product) => product.id === selectedProduct.id ? { ...product, qty: Math.max(Number(product.qty || 0) - 1, 0) } : product));
    setSales([sale, ...sales]);

    if (parseMoneyInput(sale.card) > 0) {
      setBankMovements([
        {
          id: Date.now() + 1,
          type: "Bankaya Giden",
          amount: sale.card,
          note: `${sale.bank || "Banka"} kart satışı - ${sale.productName}`,
          date: new Date().toISOString(),
        },
        ...bankMovements,
      ]);
    }

    setSaleForm({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  }

  function updateSale() {
    const fixed = calcSale(editingSale);
    setSales(sales.map((sale) => sale.id === fixed.id ? fixed : sale));
    setEditingSale(null);
  }

  function updateStock() {
    const fixed = {
      ...editingStock,
      barcode: cleanBarcode(editingStock.barcode),
      buy: formatMoneyInput(editingStock.buy),
      sell: formatMoneyInput(editingStock.sell),
      supplierPaid: formatMoneyInput(editingStock.supplierPaid),
    };
    setStock(stock.map((product) => product.id === fixed.id ? fixed : product));
    setEditingStock(null);
  }

  return (
    <div className="app">
      <div className="shell">
        <header className="hero">
          <div>
            <h1>GSMSHOP</h1>
            <p>Web kasa, cihaz, aksesuar, stok, sorgulama, tamir ve kâr takip sistemi.</p>
          </div>
          <div className="status-pill">WEB TEST</div>
        </header>

        <nav className="nav-grid">
          {[
            ["kasa", "Kasa", Wallet],
            ["cihaz", "Cihaz", Smartphone],
            ["aksesuar", "Aksesuar", Headphones],
            ["stok", "Stok", Package],
            ["tamir", "Tamir", Wrench],
            ["vole", "Kara Defter", TrendingUp],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              disabled={key === "tamir"}
              className={active === key ? "nav-btn active" : key === "tamir" ? "nav-btn disabled" : "nav-btn"}
              onClick={() => key !== "tamir" && setActive(key)}
            >
              <Icon size={22} />
              <span>{label}</span>
              {key === "tamir" && <small>Yakında</small>}
            </button>
          ))}
        </nav>

        {active === "kasa" && (
          <section className="section">
            <div className="kasa-subtabs">
              <button className={kasaTab === "satis" ? "choice active" : "choice"} onClick={() => setKasaTab("satis")}>Yeni Satış</button>
              <button className={kasaTab === "bankadanNakit" ? "choice active" : "choice"} onClick={() => setKasaTab("bankadanNakit")}>Bankadan Nakit Gelen</button>
            </div>

            {kasaTab === "satis" && (
              <>
                <div className="stats five">
                  <Stat title="Toplam Satış" value={money(report.total)} />
                  <Stat title="Nakit Kasa" value={money(cashWithBankIncoming)} />
                  <Stat title="Kart" value={money(report.card)} />
                  <Stat title="Kalan Alacak" value={money(report.remaining)} />
                  <Stat title="Kâr" value={money(report.profit)} />
                </div>

                <div className="grid sale-layout">
                  <div className="card">
                    <h2>Yeni Satış</h2>
                    <div className="button-grid">
                      {saleTypes.map((type) => (
                        <button key={type} className={saleForm.type === type ? "choice active" : "choice"} onClick={() => setSaleForm({ ...saleForm, type, productId: "", search: "", total: "", cash: "", card: "" })}>
                          {type.replace(" Satışı", "")}
                        </button>
                      ))}
                    </div>

                    {!isAccessorySale && (
                      <input placeholder="Müşteri adı soyadı / telefon" value={saleForm.customer} onChange={(e) => setSaleForm({ ...saleForm, customer: e.target.value, cariPerson: saleForm.cariPerson || e.target.value })} />
                    )}

                    <input placeholder={isAccessorySale ? "Barkod veya ürün adı" : "Barkod / IMEI veya model"} value={saleForm.search} onChange={(e) => setSaleForm({ ...saleForm, search: e.target.value })} />

                    <select value={saleForm.productId} onChange={(e) => {
                      const product = stock.find((item) => String(item.id) === e.target.value);
                      setSaleForm({ ...saleForm, productId: e.target.value, total: product?.sell || "", cash: product?.sell || "", card: "" });
                    }}>
                      <option value="">Ürün seç</option>
                      {saleProducts.map((product) => (
                        <option key={product.id} value={product.id}>{productTitle(product)} | Stok {product.qty} | {money(product.sell)}</option>
                      ))}
                    </select>

                    <input type="text" inputMode="numeric" placeholder="Satış fiyatı" value={saleForm.total} onFocus={() => setSaleForm({ ...saleForm, total: stripMoneyForEdit(saleForm.total) })} onChange={(e) => setSaleForm({ ...saleForm, total: cleanMoneyTyping(e.target.value) })} onBlur={() => setSaleForm({ ...saleForm, total: formatMoneyInput(saleForm.total) })} />
                    <input type="text" inputMode="numeric" placeholder="Nakit" value={saleForm.cash} onFocus={() => setSaleForm({ ...saleForm, cash: stripMoneyForEdit(saleForm.cash) })} onChange={(e) => setSaleForm({ ...saleForm, cash: cleanMoneyTyping(e.target.value) })} onBlur={() => setSaleForm({ ...saleForm, cash: formatMoneyInput(saleForm.cash) })} />

                    <div className="two">
                      <input type="text" inputMode="numeric" placeholder="Kart" value={saleForm.card} onFocus={() => setSaleForm({ ...saleForm, card: stripMoneyForEdit(saleForm.card) })} onChange={(e) => setSaleForm({ ...saleForm, card: cleanMoneyTyping(e.target.value) })} onBlur={() => setSaleForm({ ...saleForm, card: formatMoneyInput(saleForm.card) })} />
                      <div className="remaining-box"><span>Kalan</span><b>{money(saleRemaining)}</b></div>
                    </div>

                    <select value={saleForm.bank} onChange={(e) => setSaleForm({ ...saleForm, bank: e.target.value })}>
                      <option value="">Banka seç</option>
                      {banks.map((bank) => <option key={bank}>{bank}</option>)}
                    </select>

                    {!isAccessorySale && saleRemaining > 0 && (
                      <div className="warning">
                        <b>Kalan cari kişi</b>
                        <input list="cari-list" placeholder="Cari kişi seç veya yaz" value={saleForm.cariPerson} onChange={(e) => setSaleForm({ ...saleForm, cariPerson: e.target.value })} />
                        <datalist id="cari-list">
                          {alacaklarim.map((sale) => <option key={sale.id} value={sale.cariPerson || sale.customer} />)}
                        </datalist>
                      </div>
                    )}

                    <div className="close-summary">
                      <small>KAPANIŞ ÖZETİ</small>
                      <div><span>Satış</span><b>{money(saleTotal)}</b></div>
                      <div><span>Nakit</span><b>{money(saleCash)}</b></div>
                      <div><span>Kart</span><b>{money(saleCard)}</b></div>
                      <div><span>Kalan</span><b>{money(saleRemaining)}</b></div>
                    </div>

                    <button className="primary" onClick={saveSale}><Plus size={16} /> Satışı Kaydet</button>
                  </div>

                  <div className="card">
                    <h2>Satış Listesi</h2>
                    <Table headers={["No", "Saat", "Ürün", "Müşteri", "Nakit", "Kart", "Kalan", "Kâr", "İşlem", "Sil"]} rows={sales.map((sale, index) => [
                      index + 1,
                      new Date(sale.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                      sale.productName,
                      sale.customer || "-",
                      sale.cash,
                      sale.card,
                      money(sale.remaining),
                      money(sale.profit),
                      <button className="edit-btn" onClick={() => setEditingSale({ ...sale })}><Pencil size={14} /> Düzenle</button>,
                      <button className="delete-btn" onClick={() => deleteSale(sale.id)}>Sil</button>,
                    ])} />
                  </div>
                </div>
              </>
            )}

            {kasaTab === "bankadanNakit" && (
              <section className="card">
                <h2>Bankadan Nakit Gelen</h2>
                <p>Bankadan kasaya para çekildiğinde nakit kasasına eklenir ve Kara Defter içindeki Bankadan Çekilen bölümüne otomatik işlenir.</p>

                <div className="stats three">
                  <Stat title="Bankaya Toplam Giden" value={money(bankReport.totalToBank)} />
                  <Stat title="Bankadan Çekilen" value={money(bankReport.withdrawnFromBank)} />
                  <Stat title="Bankada Kalan" value={money(bankReport.remainingInBank)} />
                </div>

                <div className="form-grid">
                  <input type="text" inputMode="numeric" placeholder="Bankadan gelen tutar" value={bankCashForm.amount} onFocus={() => setBankCashForm({ ...bankCashForm, amount: stripMoneyForEdit(bankCashForm.amount) })} onChange={(e) => setBankCashForm({ ...bankCashForm, amount: cleanMoneyTyping(e.target.value) })} onBlur={() => setBankCashForm({ ...bankCashForm, amount: formatMoneyInput(bankCashForm.amount) })} />
                  <input placeholder="Açıklama / Not" value={bankCashForm.note} onChange={(e) => setBankCashForm({ ...bankCashForm, note: e.target.value })} />
                </div>

                <button className="primary" onClick={saveBankCashIncoming}>Kasaya Nakit Girişi Kaydet</button>
              </section>
            )}
          </section>
        )}

        {active === "cihaz" && (
          <section className="card">
            <h2>Cihaz Kaydı</h2>
            <DeviceStockForm
              stockForm={stockForm}
              setStockForm={setStockForm}
              saveStock={saveStock}
              supplierOptions={supplierOptions}
              setSupplierModalOpen={setSupplierModalOpen}
            />
          </section>
        )}

        {active === "aksesuar" && (
          <section className="card">
            <h2>Aksesuar</h2>
            <p>Aksesuar işlemleri için Kasa ekranından satış yapabilir, Stok ekranından kayıt ve liste işlemlerini yönetebilirsin.</p>
          </section>
        )}

        {active === "stok" && (
          <section className="section">
            <div className="stok-subtabs">
              <button className={stockTab === "liste" ? "choice active" : "choice"} onClick={() => setStockTab("liste")}>Stok Listesi</button>
              <button className={stockTab === "kayit" ? "choice active" : "choice"} onClick={() => setStockTab("kayit")}>Stok Kaydı</button>
            </div>

            {stockTab === "liste" && (
              <section className="card">
                <h2>Stok</h2>
                <StockTable stock={stock} setEditingStock={setEditingStock} deleteStock={deleteStock} />
              </section>
            )}

            {stockTab === "kayit" && (
              <section className="card">
                <h2>Stok Kaydı</h2>
                <div className="button-grid">
                  {["Cihaz", "Aksesuar"].map((module) => (
                    <button key={module} className={stockForm.module === module ? "choice active" : "choice"} onClick={() => setStockForm({ ...stockForm, module })}>{module}</button>
                  ))}
                </div>
                {stockForm.module === "Cihaz" ? (
                  <DeviceStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} />
                ) : (
                  <AccessoryStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} />
                )}
              </section>
            )}
          </section>
        )}

        {active === "tamir" && <section className="card"><h2>Tamir</h2><p>Tamir modülü şimdilik aktif değil.</p></section>}

        {active === "vole" && (
          <section className="section">
            <div className="kasa-subtabs">
              <button className={karaTab === "alacak" ? "choice active" : "choice"} onClick={() => setKaraTab("alacak")}>Alacaklarım</button>
              <button className={karaTab === "borc" ? "choice active" : "choice"} onClick={() => setKaraTab("borc")}>Borçlarım</button>
              <button className={karaTab === "banka" ? "choice active" : "choice"} onClick={() => setKaraTab("banka")}>Bankadan Alacağım</button>
              <button className={karaTab === "sorgu" ? "choice active" : "choice"} onClick={() => setKaraTab("sorgu")}>Sorgula</button>
            </div>

            {karaTab === "alacak" && (
              <section className="card">
                <h2>Kara Defter / Alacaklarım</h2>
                <Table headers={["İşlem", "Adı Soyad", "Alınan Mal", "Kalan", "Düzelt", "Sil"]} rows={alacaklarim.map((sale, index) => [
                  index + 1,
                  sale.cariPerson || sale.customer,
                  sale.productName,
                  money(sale.remaining),
                  <button className="edit-btn" onClick={() => setEditingSale({ ...sale })}><Pencil size={14} /> Düzenle</button>,
                  <button className="delete-btn" onClick={() => deleteSale(sale.id)}>Sil</button>,
                ])} />
              </section>
            )}

            {karaTab === "borc" && (
              <section className="card">
                <h2>Kara Defter / Borçlarım</h2>
                <Table headers={["Firma", "Son Alınan Mal", "Alış Toplam", "Ödenen", "Kalan", "Sil"]} rows={borclarim.map((row) => [
                  row.supplier,
                  row.lastProduct,
                  money(row.totalBuy),
                  money(row.paid),
                  money(row.remaining),
                  <button className="delete-btn" onClick={() => deleteSupplierDebt(row.supplier)}>Sil</button>,
                ])} />
              </section>
            )}

            {karaTab === "banka" && (
              <section className="card">
                <h2>Kara Defter / Bankadan Alacağım</h2>
                <div className="stats three">
                  <Stat title="Bankaya Toplam Giden" value={money(bankReport.totalToBank)} />
                  <Stat title="Bankadan Çekilen" value={money(bankReport.withdrawnFromBank)} />
                  <Stat title="Bankada Kalan" value={money(bankReport.remainingInBank)} />
                </div>

                <Table headers={["Tarih", "İşlem", "Tutar", "Not"]} rows={bankMovements.map((item) => [
                  new Date(item.date).toLocaleString("tr-TR"),
                  item.type,
                  item.amount,
                  item.note || "-",
                ])} />
              </section>
            )}

            {karaTab === "sorgu" && (
              <section className="card">
                <h2>Kara Defter / Sorgula</h2>
                <input placeholder="IMEI / Barkod / İsim Soyisim / Marka Model / Ürün / Firma" value={query} onChange={(e) => setQuery(e.target.value)} />
                <div className="query-hints">
                  <span>IMEI/Barkod</span>
                  <span>İsim Soyisim</span>
                  <span>Marka Model</span>
                  <span>Ürün Adı</span>
                  <span>Tedarikçi Firma</span>
                </div>
                <h3>Stok Sonuçları</h3>
                <StockTable stock={filteredStock} setEditingStock={setEditingStock} deleteStock={deleteStock} />
                <h3>Satış Sonuçları</h3>
                <Table headers={["Ürün", "Müşteri / Cari Kişi", "Satış", "Nakit", "Kart", "Kalan", "Düzelt", "Sil"]} rows={filteredSales.map((sale) => [
                  sale.productName,
                  sale.cariPerson || sale.customer || "-",
                  sale.total,
                  sale.cash,
                  sale.card,
                  money(sale.remaining),
                  <button className="edit-btn" onClick={() => setEditingSale({ ...sale })}>Düzenle</button>,
                  <button className="delete-btn" onClick={() => deleteSale(sale.id)}>Sil</button>,
                ])} />
              </section>
            )}

          </section>
        )}

        {editingSale && <SaleEditModal sale={editingSale} setSale={setEditingSale} save={updateSale} />}
        {editingStock && <StockEditModal item={editingStock} setItem={setEditingStock} save={updateStock} />}
        {supplierModalOpen && (
          <div className="modal-bg">
            <div className="modal">
              <h2>Tedarikçi Ekle</h2>
              <input placeholder="Tedarikçi firma adı" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} autoFocus />
              <div className="modal-actions">
                <button className="primary" onClick={addSupplier}><Save size={16} /> Kaydet</button>
                <button className="choice" onClick={() => setSupplierModalOpen(false)}><X size={16} /> Vazgeç</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceStockForm({ stockForm, setStockForm, saveStock, supplierOptions, setSupplierModalOpen }) {
  return (
    <>
      <div className="form-grid">
        <select value={stockForm.deviceType} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", deviceType: e.target.value })}>
          {deviceTypes.map((item) => <option key={item}>{item}</option>)}
        </select>

        <select value={stockForm.condition} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", condition: e.target.value })}>
          <option>Sıfır Garantili</option>
          <option>Sıfır Spot</option>
          <option>İkinci El</option>
        </select>

        <select value={stockForm.brand} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", brand: e.target.value, model: modelsByBrand[e.target.value]?.[0] || "" })}>
          {brands.map((brand) => <option key={brand}>{brand}</option>)}
        </select>

        <select value={stockForm.model} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", model: e.target.value })}>
          {(modelsByBrand[stockForm.brand] || []).map((model) => <option key={model}>{model}</option>)}
        </select>

        <select value={stockForm.memory} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", memory: e.target.value })}>
          {memoryOptions.map((memory) => <option key={memory}>{memory}</option>)}
        </select>

        <input placeholder="Barkod / IMEI" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", barcode: cleanBarcode(e.target.value) })} />

        <select value={stockForm.acquisitionType || "Müşteri"} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", acquisitionType: e.target.value, supplier: e.target.value === "Müşteri" ? "" : stockForm.supplier })}>
          <option>Müşteri</option>
          <option>Tedarikçi Firma</option>
        </select>

        {(stockForm.acquisitionType || "Müşteri") === "Tedarikçi Firma" && (
          <select value={stockForm.supplier} onChange={(e) => {
            if (e.target.value === "__add_supplier__") {
              setSupplierModalOpen(true);
              return;
            }
            setStockForm({ ...stockForm, module: "Cihaz", supplier: e.target.value });
          }}>
            <option value="">Tedarikçi Firma seç</option>
            <option value="__add_supplier__">+ Tedarikçi Ekle</option>
            {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
          </select>
        )}

        <input type="text" inputMode="numeric" placeholder="Kaça aldın" value={stockForm.buy} onFocus={() => setStockForm({ ...stockForm, buy: stripMoneyForEdit(stockForm.buy) })} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", buy: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, buy: formatMoneyInput(stockForm.buy) })} />
        <input type="text" inputMode="numeric" placeholder="Kaça Satacaksın" value={stockForm.sell} onFocus={() => setStockForm({ ...stockForm, sell: stripMoneyForEdit(stockForm.sell) })} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", sell: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, sell: formatMoneyInput(stockForm.sell) })} />
        <input type="text" inputMode="numeric" placeholder="Ödenen" value={stockForm.supplierPaid} onFocus={() => setStockForm({ ...stockForm, supplierPaid: stripMoneyForEdit(stockForm.supplierPaid) })} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, supplierPaid: formatMoneyInput(stockForm.supplierPaid) })} />

        <div className="remaining-input">
          <span>Kalan</span>
          <b>{money(stockRemainingAmount(stockForm))}</b>
        </div>
      </div>

      {(stockForm.acquisitionType || "Müşteri") === "Müşteri" && (
        <div className="conditional-panel">
          <h3>Müşteriden Alım Bilgileri</h3>
          <p className="mini-note">Alım tipi Müşteri seçildiğinde tedarikçi firma bilgisi istenmez.</p>
          <div className="form-grid">
            <div className="input-label">
              <strong>SATICI</strong>
              <input placeholder="Satanın Adı Soyadı" value={stockForm.sellerPerson} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", sellerPerson: e.target.value })} />
            </div>
            <div className="seller-cari-preview">
              <span>Açılacak cari</span>
              <b>{sellerCariName(stockForm.sellerPerson) || "SATICI"}</b>
            </div>
            <input placeholder="Satanın Telefonu" inputMode="numeric" maxLength={11} value={stockForm.sellerPhone} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", sellerPhone: cleanPhone(e.target.value) })} />
            <input value={new Date().toLocaleString("tr-TR")} readOnly title="Sattığı tarih otomatik girilir" />
            <input placeholder="Alımı yapan" value={stockForm.buyerName} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", buyerName: e.target.value })} />
            <input type="file" accept="image/*,.pdf" required onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", saleFormImageName: e.target.files?.[0]?.name || "" })} />
            <input placeholder="Satış formu resmi zorunlu" value={stockForm.saleFormImageName} readOnly />
          </div>
        </div>
      )}

      <input placeholder="Not" value={stockForm.note} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", note: e.target.value })} />
      <button className="primary" onClick={() => saveStock("Cihaz")}><Plus size={16} /> Cihazı Stoka Kaydet</button>
    </>
  );
}

function AccessoryStockForm({ stockForm, setStockForm, saveStock, supplierOptions, setSupplierModalOpen }) {
  return (
    <>
      <div className="form-grid">
        <select value={stockForm.category} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", category: e.target.value })}>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        <input placeholder="Ürün adı" value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", name: e.target.value })} />
        <input placeholder="Model uyumu" value={stockForm.compatibleModel} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", compatibleModel: e.target.value })} />
        <input placeholder="Barkod" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", barcode: cleanBarcode(e.target.value) })} />
        <input type="text" inputMode="numeric" placeholder="Kaça aldın" value={stockForm.buy} onFocus={() => setStockForm({ ...stockForm, buy: stripMoneyForEdit(stockForm.buy) })} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", buy: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, buy: formatMoneyInput(stockForm.buy) })} />
        <input type="text" inputMode="numeric" placeholder="Kaça Satacaksın" value={stockForm.sell} onFocus={() => setStockForm({ ...stockForm, sell: stripMoneyForEdit(stockForm.sell) })} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", sell: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, sell: formatMoneyInput(stockForm.sell) })} />
        <input type="number" placeholder="Stok adedi" value={stockForm.qty} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", qty: e.target.value })} />
        <select value={stockForm.supplier} onChange={(e) => {
          if (e.target.value === "__add_supplier__") {
            setSupplierModalOpen(true);
            return;
          }
          setStockForm({ ...stockForm, module: "Aksesuar", supplier: e.target.value });
        }}>
          <option value="">Tedarikçi Firma seç</option>
          <option value="__add_supplier__">+ Tedarikçi Ekle</option>
          {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
        </select>
        <input type="text" inputMode="numeric" placeholder="Ödenen" value={stockForm.supplierPaid} onFocus={() => setStockForm({ ...stockForm, supplierPaid: stripMoneyForEdit(stockForm.supplierPaid) })} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", supplierPaid: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, supplierPaid: formatMoneyInput(stockForm.supplierPaid) })} />
      </div>
      <button className="primary" onClick={() => saveStock("Aksesuar")}><Plus size={16} /> Aksesuarı Stoka Kaydet</button>
    </>
  );
}

function StockTable({ stock, setEditingStock, deleteStock }) {
  return (
    <Table
      headers={["Tür", "Ürün", "Barkod/IMEI", "Stok", "Alış", "Satış", "Tedarikçi/Satıcı", "Cari Kalan", "Düzelt", "Sil"]}
      rows={stock.map((product) => [
        product.deviceType,
        productTitle(product),
        product.barcode,
        product.qty,
        money(product.buy),
        money(product.sell),
        product.supplier || product.sellerCariName || product.sellerPerson || "-",
        money(product.sellerCariRemaining || 0),
        <button className="edit-btn" onClick={() => setEditingStock({ ...product })}><Pencil size={14} /> Düzenle</button>,
        <button className="delete-btn" onClick={() => deleteStock(product.id)}>Sil</button>,
      ])}
    />
  );
}

function SaleEditModal({ sale, setSale, save }) {
  const remaining = sale.type === "Aksesuar Satışı" ? 0 : Math.max(parseMoneyInput(sale.total) - parseMoneyInput(sale.cash) - parseMoneyInput(sale.card), 0);
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Satış Düzelt</h2>
        <input placeholder="Müşteri adı soyadı / telefon" value={sale.customer || ""} onChange={(e) => setSale({ ...sale, customer: e.target.value, cariPerson: e.target.value })} />
        <input placeholder="Cari kişi" value={sale.cariPerson || ""} onChange={(e) => setSale({ ...sale, cariPerson: e.target.value })} />
        <input type="text" inputMode="numeric" placeholder="Satış fiyatı" value={sale.total} onFocus={() => setSale({ ...sale, total: stripMoneyForEdit(sale.total) })} onChange={(e) => setSale({ ...sale, total: cleanMoneyTyping(e.target.value) })} onBlur={() => setSale({ ...sale, total: formatMoneyInput(sale.total) })} />
        <input type="text" inputMode="numeric" placeholder="Nakit" value={sale.cash} onFocus={() => setSale({ ...sale, cash: stripMoneyForEdit(sale.cash) })} onChange={(e) => setSale({ ...sale, cash: cleanMoneyTyping(e.target.value) })} onBlur={() => setSale({ ...sale, cash: formatMoneyInput(sale.cash) })} />
        <input type="text" inputMode="numeric" placeholder="Kart" value={sale.card} onFocus={() => setSale({ ...sale, card: stripMoneyForEdit(sale.card) })} onChange={(e) => setSale({ ...sale, card: cleanMoneyTyping(e.target.value) })} onBlur={() => setSale({ ...sale, card: formatMoneyInput(sale.card) })} />
        <select value={sale.bank || ""} onChange={(e) => setSale({ ...sale, bank: e.target.value })}>
          <option value="">Banka seç</option>
          {banks.map((bank) => <option key={bank}>{bank}</option>)}
        </select>
        <div className="remaining-box"><span>Yeni Kalan</span><b>{money(remaining)}</b></div>
        <div className="modal-actions">
          <button className="primary" onClick={save}><Save size={16} /> Kaydet</button>
          <button className="choice" onClick={() => setSale(null)}><X size={16} /> Vazgeç</button>
        </div>
      </div>
    </div>
  );
}

function StockEditModal({ item, setItem, save }) {
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Stok Düzelt</h2>
        {item.module === "Aksesuar" ? (
          <input placeholder="Ürün adı" value={item.name || ""} onChange={(e) => setItem({ ...item, name: e.target.value })} />
        ) : (
          <input placeholder="Model" value={item.model || ""} onChange={(e) => setItem({ ...item, model: e.target.value })} />
        )}
        <input placeholder="Barkod / IMEI" inputMode="numeric" maxLength={15} value={item.barcode || ""} onChange={(e) => setItem({ ...item, barcode: cleanBarcode(e.target.value) })} />
        <input type="number" placeholder="Stok" value={item.qty} onChange={(e) => setItem({ ...item, qty: e.target.value })} />
        <input type="text" inputMode="numeric" placeholder="Kaça aldın" value={item.buy} onFocus={() => setItem({ ...item, buy: stripMoneyForEdit(item.buy) })} onChange={(e) => setItem({ ...item, buy: cleanMoneyTyping(e.target.value) })} onBlur={() => setItem({ ...item, buy: formatMoneyInput(item.buy) })} />
        <input type="text" inputMode="numeric" placeholder="Kaça Satacaksın" value={item.sell} onFocus={() => setItem({ ...item, sell: stripMoneyForEdit(item.sell) })} onChange={(e) => setItem({ ...item, sell: cleanMoneyTyping(e.target.value) })} onBlur={() => setItem({ ...item, sell: formatMoneyInput(item.sell) })} />
        <input placeholder="Tedarikçi / Satıcı firma" value={item.supplier || ""} onChange={(e) => setItem({ ...item, supplier: e.target.value })} />
        <input type="text" inputMode="numeric" placeholder="Ödenen" value={item.supplierPaid || ""} onFocus={() => setItem({ ...item, supplierPaid: stripMoneyForEdit(item.supplierPaid) })} onChange={(e) => setItem({ ...item, supplierPaid: cleanMoneyTyping(e.target.value) })} onBlur={() => setItem({ ...item, supplierPaid: formatMoneyInput(item.supplierPaid) })} />
        <div className="modal-actions">
          <button className="primary" onClick={save}><Save size={16} /> Kaydet</button>
          <button className="choice" onClick={() => setItem(null)}><X size={16} /> Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
