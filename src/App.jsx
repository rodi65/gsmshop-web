import React, { useMemo, useState } from "react";
import {
  Wallet,
  Smartphone,
  Headphones,
  Search,
  TrendingUp,
  Wrench,
  Plus,
  Pencil,
  Save,
  X,
  Package,
} from "lucide-react";

const money = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const has = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase());

const saleTypes = ["Telefon Satışı", "Saat Satışı", "Tablet Satışı", "PC Satışı", "Elektronik Satışı", "Aksesuar Satışı"];
const deviceTypes = ["Telefon", "Saat", "Tablet", "PC", "Elektronik"];
const banks = ["Ziraat", "İş Bankası", "Garanti", "Akbank", "Yapı Kredi", "Halkbank", "VakıfBank", "QNB", "Enpara", "Diğer"];
const categories = ["Kılıf", "Şarj", "Koruyucu", "Kulaklık", "Blutut Kulaklık"];
const brands = ["Apple", "Samsung", "Huawei", "Xiaomi", "Oppo", "Vivo", "Honor", "Realme", "Tecno", "Poco", "OnePlus", "TCL", "Infinix", "Alcatel", "Motorola"];
const memoryOptions = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];

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
    buy: 70000,
    sell: 85000,
    qty: 1,
    supplier: "MOBİLTEK İLETİŞİM",
    supplierPaid: 0,
    acquisitionType: "Tedarikçi Firma",
    sellerPerson: "",
    sellerPhone: "",
    saleDate: "",
    buyerName: "",
    saleFormImageName: "",
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
    buy: 80000,
    sell: 98000,
    qty: 1,
    supplier: "GALAKSİ TEKNOLOJİ",
    supplierPaid: 0,
    acquisitionType: "Tedarikçi Firma",
    sellerPerson: "",
    sellerPhone: "",
    saleDate: "",
    buyerName: "",
    saleFormImageName: "",
    note: "S26 serisi",
  },
  {
    id: 201,
    module: "Aksesuar",
    deviceType: "Aksesuar",
    category: "Kılıf",
    name: "iPhone 17 Pro Max Kılıf",
    compatibleModel: "iPhone 17 Pro Max",
    barcode: "869000000101",
    buy: 150,
    sell: 400,
    qty: 20,
    supplier: "BASEUS TÜRKİYE",
    supplierPaid: 0,
  },
];

const initialSales = [
  {
    id: 1,
    type: "Telefon Satışı",
    customer: "Mehmet Kaya 0555 555 55 55",
    cariPerson: "Mehmet Kaya 0555 555 55 55",
    bank: "Garanti",
    productName: "iPhone 17 Pro Max",
    productId: 101,
    productBuyPrice: 70000,
    productBarcode: "356789123456789",
    total: 85000,
    cash: 30000,
    card: 40000,
    remaining: 15000,
    profit: 15000,
    date: new Date().toISOString(),
  },
];

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
  qty: "",
  supplier: "",
  supplierPaid: "",
  acquisitionType: "Müşteri",
  sellerPerson: "",
  sellerPhone: "",
  saleDate: "",
  buyerName: "",
  saleFormImageName: "",
  note: "",
};

function cleanBarcode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function productTitle(product) {
  if (!product) return "";
  if (product.module === "Aksesuar") return product.name || "-";
  return [product.brand, product.model, product.memory].filter(Boolean).join(" ");
}

function calcSale(sale) {
  const total = Number(sale.total || 0);
  const cash = Number(sale.cash || 0);
  const card = Number(sale.card || 0);
  const remaining = sale.type === "Aksesuar Satışı" ? 0 : Math.max(total - cash - card, 0);
  const profit = total - Number(sale.productBuyPrice || 0);
  return { ...sale, total, cash, card, remaining, profit };
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
  const [stockTab, setStockTab] = useState("liste");
  const [stock, setStock] = useState(initialStock);
  const [sales, setSales] = useState(initialSales);
  const [saleForm, setSaleForm] = useState({
    type: "Telefon Satışı",
    customer: "",
    cariPerson: "",
    search: "",
    productId: "",
    total: "",
    cash: "",
    card: "",
    bank: "",
  });
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [editingSale, setEditingSale] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [query, setQuery] = useState("");

  const isAccessorySale = saleForm.type === "Aksesuar Satışı";
  const saleDeviceType = saleForm.type.replace(" Satışı", "");

  const saleProducts = stock
    .filter((product) => isAccessorySale ? product.module === "Aksesuar" : product.module === "Cihaz" && product.deviceType === saleDeviceType)
    .filter((product) => !saleForm.search || has(productTitle(product), saleForm.search) || has(product.barcode, saleForm.search))
    .filter((product) => Number(product.qty || 0) > 0);

  const selectedProduct = stock.find((product) => String(product.id) === String(saleForm.productId));
  const saleTotal = Number(saleForm.total || selectedProduct?.sell || 0);
  const saleCash = Number(saleForm.cash || 0);
  const saleCard = Number(saleForm.card || 0);
  const saleRemaining = isAccessorySale ? 0 : Math.max(saleTotal - saleCash - saleCard, 0);

  const alacaklarim = sales.filter((sale) => sale.type !== "Aksesuar Satışı" && Number(sale.remaining || 0) > 0);

  const borclarim = useMemo(() => {
    const map = new Map();
    stock.forEach((product) => {
      const supplier = product.supplier || "FİRMASIZ";
      const totalBuy = Number(product.buy || 0) * Number(product.qty || 0);
      const paid = Number(product.supplierPaid || 0);
      const row = map.get(supplier) || { supplier, lastProduct: "", totalBuy: 0, paid: 0, remaining: 0 };
      row.lastProduct = productTitle(product);
      row.totalBuy += totalBuy;
      row.paid += paid;
      row.remaining += Math.max(totalBuy - paid, 0);
      map.set(supplier, row);
    });
    return Array.from(map.values());
  }, [stock]);

  const report = {
    total: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    cash: sales.reduce((sum, sale) => sum + Number(sale.cash || 0), 0),
    card: sales.reduce((sum, sale) => sum + Number(sale.card || 0), 0),
    remaining: sales.reduce((sum, sale) => sum + Number(sale.remaining || 0), 0),
    profit: sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0),
  };

  const supplierOptions = useMemo(() => {
    return Array.from(new Set(stock.map((product) => product.supplier).filter(Boolean))).sort();
  }, [stock]);

  const filteredStock = stock.filter((product) =>
    !query ||
    has(productTitle(product), query) ||
    has(product.barcode, query) ||
    has(product.supplier || product.sellerPerson || "-", query) ||
    has(product.brand, query) ||
    has(product.model, query) ||
    has(product.name, query) ||
    has(product.sellerPerson, query)
  );

  const filteredSales = sales.filter((sale) =>
    !query ||
    has(sale.productName, query) ||
    has(sale.customer, query) ||
    has(sale.cariPerson, query) ||
    has(sale.productBarcode, query)
  );

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
      total: saleTotal,
      cash: saleCash,
      card: saleCard,
      date: new Date().toISOString(),
    });

    setStock(stock.map((product) => product.id === selectedProduct.id ? { ...product, qty: Math.max(Number(product.qty || 0) - 1, 0) } : product));
    setSales([sale, ...sales]);
    setSaleForm({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  }

  function buildStockItem(module) {
    return {
      ...stockForm,
      id: Date.now(),
      module,
      deviceType: module === "Aksesuar" ? "Aksesuar" : stockForm.deviceType,
      barcode: cleanBarcode(stockForm.barcode),
      buy: Number(stockForm.buy),
      sell: Number(stockForm.sell),
      qty: module === "Cihaz" ? 1 : Number(stockForm.qty),
      supplierPaid: Number(stockForm.supplierPaid || 0),
      acquisitionType: stockForm.acquisitionType || "Müşteri",
      sellerPerson: stockForm.sellerPerson || "",
      sellerPhone: stockForm.sellerPhone || "",
      saleDate: stockForm.saleDate || new Date().toISOString(),
      buyerName: stockForm.buyerName || "",
      saleFormImageName: stockForm.saleFormImageName || "",
    };
  }

  function validateStock(module = stockForm.module) {
    const isDevice = module === "Cihaz";
    const isCustomerPurchase = isDevice && (stockForm.acquisitionType || "Müşteri") === "Müşteri";

    if (!isCustomerPurchase && !stockForm.supplier.trim()) return "Tedarikçi / satıcı firma seç";
    if (isCustomerPurchase && !stockForm.sellerPerson.trim()) return "Satanın adı soyadı yaz";
    if (isCustomerPurchase && !stockForm.sellerPhone.trim()) return "Satanın telefonu yaz";

    if (isDevice) {
      if (!stockForm.buy || !stockForm.sell) return "Alış ve satış fiyatı yaz";
    } else {
      if (!stockForm.buy || !stockForm.sell || !stockForm.qty) return "Alış, satış ve stok adedi yaz";
    }

    if (!stockForm.barcode) return "Barkod / IMEI yaz";
    if (stock.some((product) => product.barcode === stockForm.barcode)) return "Bu Barkod / IMEI zaten kayıtlı";
    return "";
  }

  function saveStock(module = stockForm.module) {
    const error = validateStock(module);
    if (error) return alert(error);

    setStock([buildStockItem(module), ...stock]);
    setStockForm({ ...emptyStockForm, module });
    setStockTab("liste");
  }

  function updateSale() {
    const fixed = calcSale(editingSale);
    setSales(sales.map((sale) => sale.id === fixed.id ? fixed : sale));
    setEditingSale(null);
  }

  function updateStock() {
    if (!editingStock.supplier) return alert("Tedarikçi / satıcı firma yaz");
    const fixed = {
      ...editingStock,
      barcode: cleanBarcode(editingStock.barcode),
      buy: Number(editingStock.buy || 0),
      sell: Number(editingStock.sell || 0),
      qty: Number(editingStock.qty || 0),
      supplierPaid: Number(editingStock.supplierPaid || 0),
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
            ["sorgu", "Sorgula", Search],
            ["tamir", "Tamir", Wrench],
            ["vole", "Vole", TrendingUp],
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
              <button className={kasaTab === "alacak" ? "choice active" : "choice"} onClick={() => setKasaTab("alacak")}>ALACAKLARIM</button>
              <button className={kasaTab === "borc" ? "choice active" : "choice"} onClick={() => setKasaTab("borc")}>Borçlarım</button>
            </div>

            {kasaTab === "satis" && (
              <>
                <div className="stats five">
                  <Stat title="Toplam Satış" value={money(report.total)} />
                  <Stat title="Nakit" value={money(report.cash)} />
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
                      <input placeholder="Müşteri adı soyadı / telefon" value={saleForm.customer} onChange={(event) => setSaleForm({ ...saleForm, customer: event.target.value, cariPerson: saleForm.cariPerson || event.target.value })} />
                    )}

                    <input placeholder={isAccessorySale ? "Barkod veya ürün adı" : "Barkod / IMEI veya model"} value={saleForm.search} onChange={(event) => setSaleForm({ ...saleForm, search: event.target.value })} />

                    <select value={saleForm.productId} onChange={(event) => {
                      const product = stock.find((item) => String(item.id) === event.target.value);
                      setSaleForm({ ...saleForm, productId: event.target.value, total: product?.sell || "", cash: product?.sell || "", card: "" });
                    }}>
                      <option value="">Ürün seç</option>
                      {saleProducts.map((product) => (
                        <option key={product.id} value={product.id}>{productTitle(product)} | Stok {product.qty} | {money(product.sell)}</option>
                      ))}
                    </select>

                    <input type="number" placeholder="Satış fiyatı" value={saleForm.total} onChange={(event) => setSaleForm({ ...saleForm, total: event.target.value })} />
                    <input type="number" placeholder="Nakit" value={saleForm.cash} onChange={(event) => setSaleForm({ ...saleForm, cash: event.target.value })} />

                    <div className="two">
                      <input type="number" placeholder="Kart" value={saleForm.card} onChange={(event) => setSaleForm({ ...saleForm, card: event.target.value })} />
                      <div className="remaining-box"><span>Kalan</span><b>{money(saleRemaining)}</b></div>
                    </div>

                    <select value={saleForm.bank} onChange={(event) => setSaleForm({ ...saleForm, bank: event.target.value })}>
                      <option value="">Banka seç</option>
                      {banks.map((bank) => <option key={bank}>{bank}</option>)}
                    </select>

                    {!isAccessorySale && saleRemaining > 0 && (
                      <div className="warning">
                        <b>Kalan cari kişi</b>
                        <input list="cari-list" placeholder="Cari kişi seç veya yaz" value={saleForm.cariPerson} onChange={(event) => setSaleForm({ ...saleForm, cariPerson: event.target.value })} />
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
                    <Table headers={["No", "Saat", "Ürün", "Müşteri", "Nakit", "Kart", "Kalan", "Kâr", "İşlem"]} rows={sales.map((sale, index) => [
                      index + 1,
                      new Date(sale.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                      sale.productName,
                      sale.customer || "-",
                      money(sale.cash),
                      money(sale.card),
                      money(sale.remaining),
                      money(sale.profit),
                      <button className="edit-btn" onClick={() => setEditingSale({ ...sale })}><Pencil size={14} /> Düzenle</button>,
                    ])} />
                  </div>
                </div>
              </>
            )}

            {kasaTab === "alacak" && (
              <section className="card">
                <h2>Alacaklarım</h2>
                <Table headers={["İşlem", "Adı Soyad", "Alınan Mal", "Kalan", "Düzelt"]} rows={alacaklarim.map((sale, index) => [
                  index + 1,
                  sale.cariPerson || sale.customer,
                  sale.productName,
                  money(sale.remaining),
                  <button className="edit-btn" onClick={() => setEditingSale({ ...sale })}><Pencil size={14} /> Düzenle</button>,
                ])} />
              </section>
            )}

            {kasaTab === "borc" && (
              <section className="card">
                <h2>Borçlarım</h2>
                <Table headers={["Firma", "Son Alınan Mal", "Alış Toplam", "Ödenen", "Kalan"]} rows={borclarim.map((row) => [
                  row.supplier,
                  row.lastProduct,
                  money(row.totalBuy),
                  money(row.paid),
                  money(row.remaining),
                ])} />
              </section>
            )}
          </section>
        )}

        {active === "cihaz" && (
          <section className="card">
            <h2>Cihaz Kaydı</h2>
            <p>Cihaz girişleri buradan yapılır. Eklenen cihazlar Stok bölümüne otomatik eklenir.</p>
            <DeviceStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} />
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
                <StockTable stock={stock} setEditingStock={setEditingStock} />
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
                  <DeviceStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} />
                ) : (
                  <AccessoryStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} />
                )}
              </section>
            )}
          </section>
        )}

        {active === "sorgu" && (
          <section className="card">
            <h2>Sorgula</h2>
            <p>IMEI, barkod, isim soyisim, marka, model, ürün adı veya tedarikçi firma ile arama yap.</p>
            <input placeholder="IMEI / Barkod / İsim Soyisim / Marka Model / Ürün / Firma" value={query} onChange={(event) => setQuery(event.target.value)} />

            <div className="query-hints">
              <span>IMEI/Barkod</span>
              <span>İsim Soyisim</span>
              <span>Marka Model</span>
              <span>Ürün Adı</span>
              <span>Tedarikçi Firma</span>
            </div>

            <h3>Stok Sonuçları</h3>
            <StockTable stock={filteredStock} setEditingStock={setEditingStock} />

            <h3>Satış Sonuçları</h3>
            <Table headers={["Ürün", "Müşteri / Cari Kişi", "Satış", "Nakit", "Kart", "Kalan", "Düzelt"]} rows={filteredSales.map((sale) => [
              sale.productName,
              sale.cariPerson || sale.customer || "-",
              money(sale.total),
              money(sale.cash),
              money(sale.card),
              money(sale.remaining),
              <button className="edit-btn" onClick={() => setEditingSale({ ...sale })}>Düzenle</button>,
            ])} />
          </section>
        )}

        {active === "tamir" && (
          <section className="card">
            <h2>Tamir</h2>
            <p>Tamir modülü şimdilik aktif değil.</p>
          </section>
        )}

        {active === "vole" && (
          <section className="card">
            <h2>Vole</h2>
            <div className="stats five">
              <Stat title="Satış" value={money(report.total)} />
              <Stat title="Alacak" value={money(report.remaining)} />
              <Stat title="Nakit" value={money(report.cash)} />
              <Stat title="Kart" value={money(report.card)} />
              <Stat title="Kâr" value={money(report.profit)} />
            </div>
          </section>
        )}

        {editingSale && <SaleEditModal sale={editingSale} setSale={setEditingSale} save={updateSale} />}
        {editingStock && <StockEditModal item={editingStock} setItem={setEditingStock} save={updateStock} />}
      </div>
    </div>
  );
}

function DeviceStockForm({ stockForm, setStockForm, saveStock, supplierOptions = [] }) {
  return (
    <>
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

        <select value={stockForm.memory} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", memory: event.target.value })}>
          {memoryOptions.map((memory) => <option key={memory}>{memory}</option>)}
        </select>
        <input placeholder="Barkod / IMEI" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", barcode: cleanBarcode(event.target.value) })} />
        <select value={stockForm.acquisitionType || "Müşteri"} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", acquisitionType: event.target.value, supplier: event.target.value === "Müşteri" ? "" : stockForm.supplier })}>
          <option>Müşteri</option>
          <option>Tedarikçi Firma</option>
        </select>

        {(stockForm.acquisitionType || "Müşteri") === "Tedarikçi Firma" && (
          <>
            <input list="supplier-options" placeholder="Tedarikçi Firma seç veya yaz" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplier: event.target.value })} />
            <datalist id="supplier-options">
              {supplierOptions.map((supplier) => <option key={supplier} value={supplier} />)}
            </datalist>
          </>
        )}

        <input type="number" placeholder="Alış" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", buy: event.target.value })} />
        <input type="number" placeholder="Satış" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", sell: event.target.value })} />
        <input type="number" placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Cihaz", supplierPaid: event.target.value })} />
      </div>

      {(stockForm.acquisitionType || "Müşteri") === "Müşteri" && (
        <div className="conditional-panel">
          <h3>Müşteriden Alım Bilgileri</h3><p className="mini-note">Alım tipi Müşteri seçildiğinde tedarikçi firma bilgisi istenmez.</p>
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
    </>
  );
}

function AccessoryStockForm({ stockForm, setStockForm, saveStock }) {
  return (
    <>
      <div className="form-grid">
        <select value={stockForm.category} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", category: event.target.value })}>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        <input placeholder="Ürün adı" value={stockForm.name} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", name: event.target.value })} />
        <input placeholder="Model uyumu" value={stockForm.compatibleModel} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", compatibleModel: event.target.value })} />
        <input placeholder="Barkod / IMEI" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", barcode: cleanBarcode(event.target.value) })} />
        <input type="number" placeholder="Alış" value={stockForm.buy} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", buy: event.target.value })} />
        <input type="number" placeholder="Satış" value={stockForm.sell} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", sell: event.target.value })} />
        <input type="number" placeholder="Stok adedi" value={stockForm.qty} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", qty: event.target.value })} />
        <input placeholder="Tedarikçi / Satıcı firma" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", supplier: event.target.value })} />
        <input type="number" placeholder="Ödenen" value={stockForm.supplierPaid} onChange={(event) => setStockForm({ ...stockForm, module: "Aksesuar", supplierPaid: event.target.value })} />
      </div>
      <button className="primary" onClick={() => saveStock("Aksesuar")}><Plus size={16} /> Aksesuarı Stoka Kaydet</button>
    </>
  );
}

function StockTable({ stock, setEditingStock }) {
  return (
    <Table
      headers={["Tür", "Ürün", "Barkod/IMEI", "Stok", "Alış", "Satış", "Tedarikçi", "Düzelt"]}
      rows={stock.map((product) => [
        product.deviceType,
        productTitle(product),
        product.barcode,
        product.qty,
        money(product.buy),
        money(product.sell),
        product.supplier || product.sellerPerson || "-",
        <button className="edit-btn" onClick={() => setEditingStock({ ...product })}><Pencil size={14} /> Düzenle</button>,
      ])}
    />
  );
}

function SaleEditModal({ sale, setSale, save }) {
  const remaining = sale.type === "Aksesuar Satışı" ? 0 : Math.max(Number(sale.total || 0) - Number(sale.cash || 0) - Number(sale.card || 0), 0);

  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Satış Düzelt</h2>
        <input placeholder="Müşteri adı soyadı / telefon" value={sale.customer || ""} onChange={(event) => setSale({ ...sale, customer: event.target.value, cariPerson: event.target.value })} />
        <input placeholder="Cari kişi" value={sale.cariPerson || ""} onChange={(event) => setSale({ ...sale, cariPerson: event.target.value })} />
        <input type="number" placeholder="Satış fiyatı" value={sale.total} onChange={(event) => setSale({ ...sale, total: event.target.value })} />
        <input type="number" placeholder="Nakit" value={sale.cash} onChange={(event) => setSale({ ...sale, cash: event.target.value })} />
        <input type="number" placeholder="Kart" value={sale.card} onChange={(event) => setSale({ ...sale, card: event.target.value })} />
        <select value={sale.bank || ""} onChange={(event) => setSale({ ...sale, bank: event.target.value })}>
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
          <input placeholder="Ürün adı" value={item.name || ""} onChange={(event) => setItem({ ...item, name: event.target.value })} />
        ) : (
          <input placeholder="Model" value={item.model || ""} onChange={(event) => setItem({ ...item, model: event.target.value })} />
        )}
        <input placeholder="Barkod / IMEI" inputMode="numeric" maxLength={15} value={item.barcode || ""} onChange={(event) => setItem({ ...item, barcode: cleanBarcode(event.target.value) })} />
        <input type="number" placeholder="Stok" value={item.qty} onChange={(event) => setItem({ ...item, qty: event.target.value })} />
        <input type="number" placeholder="Alış" value={item.buy} onChange={(event) => setItem({ ...item, buy: event.target.value })} />
        <input type="number" placeholder="Satış" value={item.sell} onChange={(event) => setItem({ ...item, sell: event.target.value })} />
        <input placeholder="Tedarikçi / Satıcı firma" value={item.supplier || ""} onChange={(event) => setItem({ ...item, supplier: event.target.value })} />
        <input type="number" placeholder="Ödenen" value={item.supplierPaid || ""} onChange={(event) => setItem({ ...item, supplierPaid: event.target.value })} />
        <div className="modal-actions">
          <button className="primary" onClick={save}><Save size={16} /> Kaydet</button>
          <button className="choice" onClick={() => setItem(null)}><X size={16} /> Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
