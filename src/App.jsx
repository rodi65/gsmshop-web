
import React, { useMemo, useState } from "react";
import { Wallet, Smartphone, Headphones, Search, TrendingUp, Wrench, Plus, Pencil, Save, X } from "lucide-react";
import "./style.css";

const money = (v) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0));
const today = () => new Date().toISOString().slice(0, 10);
const has = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase());

const saleTypes = ["Telefon Satışı", "Saat Satışı", "Tablet Satışı", "PC Satışı", "Elektronik Satışı", "Aksesuar Satışı"];
const deviceTypes = ["Telefon", "Saat", "Tablet", "PC", "Elektronik"];
const banks = ["Ziraat", "İş Bankası", "Garanti", "Akbank", "Yapı Kredi", "Halkbank", "VakıfBank", "QNB", "Enpara", "Diğer"];
const categories = ["Kılıf", "Şarj", "Koruyucu", "Kulaklık", "Blutut Kulaklık"];
const brands = ["Apple", "Samsung", "Huawei", "Xiaomi", "Oppo", "Vivo", "Honor", "Realme", "Tecno", "Poco", "OnePlus", "TCL", "Infinix", "Alcatel", "Motorola"];
const modelsByBrand = {
  Apple: ["iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone Air", "iPhone 17", "iPhone 16 Pro Max", "iPhone 16 Pro", "Apple Watch Ultra 3"],
  Samsung: ["Galaxy S26 Ultra", "Galaxy S26+", "Galaxy S26", "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25", "Galaxy Watch Ultra"],
  Huawei: ["Huawei Pura 80 Ultra", "Huawei Pura 80 Pro", "Huawei Mate 70 Pro", "Huawei Watch GT 6 Pro"],
  Xiaomi: ["Xiaomi 15 Ultra", "Xiaomi 15 Pro", "Redmi Note 14 Pro+ 5G", "Xiaomi Watch S4"],
  Oppo: ["OPPO Find X9 Pro", "OPPO Find X9"],
  Vivo: ["vivo X300 Pro", "vivo X300"],
  Honor: ["HONOR Magic8 Pro", "HONOR Magic8"],
  Realme: ["realme GT 7 Pro", "realme GT 6"],
  Tecno: ["TECNO Phantom V Fold2", "TECNO Camon 40 Pro"],
  Poco: ["POCO F8 Ultra", "POCO F8 Pro"],
  OnePlus: ["OnePlus 13", "OnePlus 13R"],
  TCL: ["TCL 60 SE", "TCL 50 Pro NXTPAPER"],
  Infinix: ["Infinix Zero 40 5G", "Infinix Note 40 Pro+"],
  Alcatel: ["Alcatel 1S 2021", "Alcatel 1L Pro"],
  Motorola: ["Motorola Razr Ultra", "Motorola Edge 60 Pro"],
};

const initialStock = [
  { id: 101, module: "Cihaz", deviceType: "Telefon", condition: "Sıfır Garantili", brand: "Apple", model: "iPhone 17 Pro Max", memory: "256 GB", barcode: "356789123456789", buy: 70000, sell: 85000, qty: 1, supplier: "MOBİLTEK İLETİŞİM", sellerPerson: "", sellerPhone: "", supplierPaid: 0, note: "" },
  { id: 102, module: "Cihaz", deviceType: "Telefon", condition: "Sıfır Spot", brand: "Samsung", model: "Galaxy S26 Ultra", memory: "512 GB", barcode: "356789123456780", buy: 80000, sell: 98000, qty: 1, supplier: "GALAKSİ TEKNOLOJİ", sellerPerson: "", sellerPhone: "", supplierPaid: 0, note: "S26 serisi" },
  { id: 103, module: "Cihaz", deviceType: "Saat", condition: "Sıfır Garantili", brand: "Apple", model: "Apple Watch Ultra 3", memory: "", barcode: "869000000001", buy: 25000, sell: 32000, qty: 1, supplier: "MOBİLTEK İLETİŞİM", sellerPerson: "", sellerPhone: "", supplierPaid: 0, note: "" },
  { id: 201, module: "Aksesuar", deviceType: "Aksesuar", category: "Kılıf", name: "iPhone 17 Pro Max Kılıf", compatibleModel: "iPhone 17 Pro Max", barcode: "869000000101", buy: 150, sell: 400, qty: 20, supplier: "BASEUS TÜRKİYE", supplierPaid: 0 },
  { id: 202, module: "Aksesuar", deviceType: "Aksesuar", category: "Blutut Kulaklık", name: "Baseus Bluetooth Kulaklık", compatibleModel: "Genel", barcode: "869000000103", buy: 500, sell: 950, qty: 10, supplier: "BASEUS TÜRKİYE", supplierPaid: 0 },
];

const initialSales = [
  { id: 1, type: "Telefon Satışı", customer: "Mehmet Kaya 0555 555 55 55", cariPerson: "Mehmet Kaya 0555 555 55 55", bank: "Garanti", productName: "iPhone 17 Pro Max", productId: 101, productBuyPrice: 70000, total: 85000, cash: 30000, card: 40000, remaining: 15000, profit: 15000, date: new Date().toISOString() },
];

function calcSale(sale) {
  const total = Number(sale.total || 0);
  const cash = Number(sale.cash || 0);
  const card = Number(sale.card || 0);
  const remaining = sale.type === "Aksesuar Satışı" ? 0 : Math.max(total - cash - card, 0);
  const profit = total - Number(sale.productBuyPrice || 0);
  return { ...sale, total, cash, card, remaining, profit };
}

function productTitle(p) {
  return p.module === "Aksesuar" ? p.name : [p.brand, p.model, p.memory].filter(Boolean).join(" ");
}

function Stat({ title, value }) {
  return <div className="stat-card"><div className="stat-title">{title}</div><div className="stat-value">{value}</div></div>;
}

export default function App() {
  const [active, setActive] = useState("kasa");
  const [stock, setStock] = useState(initialStock);
  const [sales, setSales] = useState(initialSales);
  const [saleForm, setSaleForm] = useState({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  const [stockForm, setStockForm] = useState({ module: "Cihaz", deviceType: "Telefon", condition: "Sıfır Garantili", brand: "Apple", model: "iPhone 17 Pro Max", memory: "256 GB", category: "Kılıf", name: "", compatibleModel: "", barcode: "", buy: "", sell: "", qty: 1, supplier: "", supplierPaid: 0, sellerPerson: "", sellerPhone: "", note: "" });
  const [editingSale, setEditingSale] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [query, setQuery] = useState("");

  const isAccessorySale = saleForm.type === "Aksesuar Satışı";
  const saleDeviceType = saleForm.type.replace(" Satışı", "");
  const saleProducts = stock
    .filter(p => isAccessorySale ? p.module === "Aksesuar" : p.module === "Cihaz" && p.deviceType === saleDeviceType)
    .filter(p => !saleForm.search || has(productTitle(p), saleForm.search) || has(p.barcode, saleForm.search));

  const selectedProduct = stock.find(p => String(p.id) === String(saleForm.productId));
  const saleTotal = Number(saleForm.total || selectedProduct?.sell || 0);
  const saleCash = Number(saleForm.cash || 0);
  const saleCard = Number(saleForm.card || 0);
  const saleRemaining = isAccessorySale ? 0 : Math.max(saleTotal - saleCash - saleCard, 0);

  const alacaklarim = sales.filter(s => s.type !== "Aksesuar Satışı" && Number(s.remaining || 0) > 0);
  const borclarim = useMemo(() => {
    const map = new Map();
    stock.forEach(p => {
      const supplier = p.supplier || "FİRMASIZ";
      const totalBuy = Number(p.buy || 0) * Number(p.qty || 0);
      const paid = Number(p.supplierPaid || 0);
      const row = map.get(supplier) || { supplier, lastProduct: "", totalBuy: 0, paid: 0, remaining: 0 };
      row.lastProduct = productTitle(p);
      row.totalBuy += totalBuy;
      row.paid += paid;
      row.remaining += Math.max(totalBuy - paid, 0);
      map.set(supplier, row);
    });
    return Array.from(map.values());
  }, [stock]);

  const report = {
    total: sales.reduce((a, s) => a + Number(s.total || 0), 0),
    cash: sales.reduce((a, s) => a + Number(s.cash || 0), 0),
    card: sales.reduce((a, s) => a + Number(s.card || 0), 0),
    remaining: sales.reduce((a, s) => a + Number(s.remaining || 0), 0),
    profit: sales.reduce((a, s) => a + Number(s.profit || 0), 0),
  };

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
      total: saleTotal,
      cash: saleCash,
      card: saleCard,
      date: new Date().toISOString(),
    });

    setStock(stock.map(p => p.id === selectedProduct.id ? { ...p, qty: Math.max(Number(p.qty) - 1, 0) } : p));
    setSales([sale, ...sales]);
    setSaleForm({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  }

  function saveStock() {
    if (!stockForm.supplier) return alert("Tedarikçi / satıcı firma yaz");
    if (!stockForm.buy || !stockForm.sell || !stockForm.qty) return alert("Alış, satış ve stok yaz");
    const item = {
      ...stockForm,
      id: Date.now(),
      buy: Number(stockForm.buy),
      sell: Number(stockForm.sell),
      qty: Number(stockForm.qty),
      supplierPaid: Number(stockForm.supplierPaid || 0),
      module: stockForm.module,
      deviceType: stockForm.module === "Aksesuar" ? "Aksesuar" : stockForm.deviceType,
    };
    setStock([item, ...stock]);
    setStockForm({ ...stockForm, name: "", barcode: "", buy: "", sell: "", qty: 1, supplierPaid: 0, note: "" });
  }

  function updateSale() {
    const fixed = calcSale(editingSale);
    setSales(sales.map(s => s.id === fixed.id ? fixed : s));
    setEditingSale(null);
  }

  function updateStock() {
    const fixed = { ...editingStock, buy: Number(editingStock.buy || 0), sell: Number(editingStock.sell || 0), qty: Number(editingStock.qty || 0), supplierPaid: Number(editingStock.supplierPaid || 0) };
    setStock(stock.map(p => p.id === fixed.id ? fixed : p));
    setEditingStock(null);
  }

  const filteredStock = stock.filter(p => !query || has(productTitle(p), query) || has(p.barcode, query) || has(p.supplier, query));
  const filteredSales = sales.filter(s => !query || has(s.productName, query) || has(s.customer, query) || has(s.cariPerson, query));

  return (
    <div className="app">
      <div className="shell">
        <header className="hero">
          <div>
            <h1>GSMSHOP</h1>
            <p>Web kasa, stok, alacak ve borç takip sistemi.</p>
          </div>
          <div className="status-pill">WEB TEST</div>
        </header>

        <nav className="nav-grid">
          {[
            ["kasa", "Kasa", Wallet],
            ["cihaz", "Cihaz/Stok", Smartphone],
            ["aksesuar", "Aksesuar", Headphones],
            ["sorgu", "Sorgulama", Search],
            ["vole", "Vole", TrendingUp],
            ["tamir", "Tamir", Wrench],
          ].map(([key, label, Icon]) => (
            <button key={key} disabled={key === "tamir"} className={active === key ? "nav-btn active" : key === "tamir" ? "nav-btn disabled" : "nav-btn"} onClick={() => key !== "tamir" && setActive(key)}>
              <Icon size={22} /><span>{label}</span>{key === "tamir" && <small>Yakında</small>}
            </button>
          ))}
        </nav>

        {active === "kasa" && (
          <section className="section">
            <div className="kasa-subtabs">
              <button className="choice active" type="button">Yeni Satış</button>
              <button className="choice" type="button" onClick={() => setActive("alacak")}>ALACAKLARIM</button>
              <button className="choice" type="button" onClick={() => setActive("borc")}>Borçlarım</button>
            </div>
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
                <div className="button-grid">{saleTypes.map(t => <button key={t} className={saleForm.type === t ? "choice active" : "choice"} onClick={() => setSaleForm({ ...saleForm, type: t, productId: "", search: "" })}>{t.replace(" Satışı", "")}</button>)}</div>

                {!isAccessorySale && <input placeholder="Müşteri adı soyadı / telefon" value={saleForm.customer} onChange={e => setSaleForm({ ...saleForm, customer: e.target.value, cariPerson: saleForm.cariPerson || e.target.value })} />}

                <input placeholder={isAccessorySale ? "Barkod veya ürün adı" : "Barkod / IMEI veya model"} value={saleForm.search} onChange={e => setSaleForm({ ...saleForm, search: e.target.value })} />

                <select value={saleForm.productId} onChange={e => {
                  const p = stock.find(x => String(x.id) === e.target.value);
                  setSaleForm({ ...saleForm, productId: e.target.value, total: p?.sell || "", cash: p?.sell || "", card: "" });
                }}>
                  <option value="">Ürün seç</option>
                  {saleProducts.map(p => <option key={p.id} value={p.id}>{productTitle(p)} | Stok {p.qty} | {money(p.sell)}</option>)}
                </select>

                <input type="number" placeholder="Satış fiyatı" value={saleForm.total} onChange={e => setSaleForm({ ...saleForm, total: e.target.value })} />
                <input type="number" placeholder="Nakit" value={saleForm.cash} onChange={e => setSaleForm({ ...saleForm, cash: e.target.value })} />
                <div className="two">
                  <input type="number" placeholder="Kart" value={saleForm.card} onChange={e => setSaleForm({ ...saleForm, card: e.target.value })} />
                  <div className="remaining-box"><span>Kalan</span><b>{money(saleRemaining)}</b></div>
                </div>
                <select value={saleForm.bank} onChange={e => setSaleForm({ ...saleForm, bank: e.target.value })}>
                  <option value="">Banka seç</option>{banks.map(b => <option key={b}>{b}</option>)}
                </select>

                {!isAccessorySale && saleRemaining > 0 && (
                  <div className="warning">
                    <b>Kalan cari kişi</b>
                    <input list="cari-list" placeholder="Cari kişi seç veya yaz" value={saleForm.cariPerson} onChange={e => setSaleForm({ ...saleForm, cariPerson: e.target.value })} />
                    <datalist id="cari-list">{alacaklarim.map(s => <option key={s.id} value={s.cariPerson || s.customer} />)}</datalist>
                  </div>
                )}

                <div className="close-summary">
                  <small>KAPANIŞ ÖZETİ</small>
                  <div><span>Satış</span><b>{money(saleTotal)}</b></div>
                  <div><span>Nakit</span><b>{money(saleCash)}</b></div>
                  <div><span>Kart</span><b>{money(saleCard)}</b></div>
                  <div><span>Kalan</span><b>{money(saleRemaining)}</b></div>
                </div>

                <button className="primary" onClick={saveSale}><Plus size={16}/> Satışı Kaydet</button>
              </div>

              <div className="card">
                <h2>Satış Listesi</h2>
                <Table headers={["No", "Saat", "Ürün", "Müşteri", "Nakit", "Kart", "Kalan", "Kâr", "İşlem"]} rows={sales.map((s, i) => [
                  i + 1,
                  new Date(s.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                  s.productName,
                  s.customer || "-",
                  money(s.cash),
                  money(s.card),
                  money(s.remaining),
                  money(s.profit),
                  <button className="edit-btn" onClick={() => setEditingSale({ ...s })}><Pencil size={14}/> Düzenle</button>
                ])} />
              </div>
            </div>
          </section>
        )}

        {active === "cihaz" && (
          <StockSection title="Cihaz / Stok" only="Cihaz" stock={stock} stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} setEditingStock={setEditingStock} />
        )}

        {active === "aksesuar" && (
          <StockSection title="Aksesuar Stok" only="Aksesuar" stock={stock} stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} setEditingStock={setEditingStock} />
        )}

        {active === "alacak" && (
          <section className="card">
            <h2>Alacaklarım</h2>
            <p>Ben satış yaptım, müşteri eksik ödeme yaptı. Bana borçlu olanlar burada görünür.</p>
            <Table headers={["İşlem", "Adı Soyad", "Alınan Mal", "Kalan", "Düzelt"]} rows={alacaklarim.map((s, i) => [
              i + 1,
              s.cariPerson || s.customer,
              s.productName,
              money(s.remaining),
              <button className="edit-btn" onClick={() => setEditingSale({ ...s })}><Pencil size={14}/> Düzenle</button>
            ])} />
          </section>
        )}

        {active === "borc" && (
          <section className="card">
            <h2>Borçlarım</h2>
            <p>Mal aldığım tedarikçiler ve firmalara olan borçlarım burada görünür.</p>
            <Table headers={["Firma", "Son Alınan Mal", "Alış Toplam", "Ödenen", "Kalan"]} rows={borclarim.map(b => [
              b.supplier,
              b.lastProduct,
              money(b.totalBuy),
              money(b.paid),
              money(b.remaining)
            ])} />
          </section>
        )}

        {active === "sorgu" && (
          <section className="card">
            <h2>Sorgulama</h2>
            <input placeholder="Ürün, müşteri, firma, barkod ara" value={query} onChange={e => setQuery(e.target.value)} />
            <h3>Stok Sonuçları</h3>
            <StockTable stock={filteredStock} setEditingStock={setEditingStock} />
            <h3>Satış Sonuçları</h3>
            <Table headers={["Ürün", "Müşteri", "Satış", "Kalan", "Düzelt"]} rows={filteredSales.map(s => [
              s.productName, s.customer || "-", money(s.total), money(s.remaining), <button className="edit-btn" onClick={() => setEditingSale({ ...s })}>Düzenle</button>
            ])} />
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

function StockSection({ title, only, stock, stockForm, setStockForm, saveStock, setEditingStock }) {
  const isAcc = only === "Aksesuar";
  return (
    <section className="section">
      <div className="card">
        <h2>{title} Kaydı</h2>
        <div className="form-grid">
          <select value={stockForm.module} onChange={e => setStockForm({ ...stockForm, module: e.target.value })}><option>Cihaz</option><option>Aksesuar</option></select>
          {stockForm.module === "Cihaz" ? (
            <>
              <select value={stockForm.deviceType} onChange={e => setStockForm({ ...stockForm, deviceType: e.target.value })}>{deviceTypes.map(x => <option key={x}>{x}</option>)}</select>
              <select value={stockForm.brand} onChange={e => setStockForm({ ...stockForm, brand: e.target.value, model: modelsByBrand[e.target.value]?.[0] || "" })}>{brands.map(x => <option key={x}>{x}</option>)}</select>
              <select value={stockForm.model} onChange={e => setStockForm({ ...stockForm, model: e.target.value })}>{(modelsByBrand[stockForm.brand] || []).map(x => <option key={x}>{x}</option>)}</select>
              <input placeholder="Hafıza" value={stockForm.memory} onChange={e => setStockForm({ ...stockForm, memory: e.target.value })} />
            </>
          ) : (
            <>
              <select value={stockForm.category} onChange={e => setStockForm({ ...stockForm, category: e.target.value })}>{categories.map(x => <option key={x}>{x}</option>)}</select>
              <input placeholder="Ürün adı" value={stockForm.name} onChange={e => setStockForm({ ...stockForm, name: e.target.value })} />
              <input placeholder="Model uyumu" value={stockForm.compatibleModel} onChange={e => setStockForm({ ...stockForm, compatibleModel: e.target.value })} />
            </>
          )}
          <input placeholder="Barkod / IMEI" value={stockForm.barcode} onChange={e => setStockForm({ ...stockForm, barcode: e.target.value })} />
          <input type="number" placeholder="Alış" value={stockForm.buy} onChange={e => setStockForm({ ...stockForm, buy: e.target.value })} />
          <input type="number" placeholder="Satış" value={stockForm.sell} onChange={e => setStockForm({ ...stockForm, sell: e.target.value })} />
          <input type="number" placeholder="Stok" value={stockForm.qty} onChange={e => setStockForm({ ...stockForm, qty: e.target.value })} />
          <input placeholder="Tedarikçi / Satıcı firma" value={stockForm.supplier} onChange={e => setStockForm({ ...stockForm, supplier: e.target.value })} />
          <input type="number" placeholder="Firmaya ödenen" value={stockForm.supplierPaid} onChange={e => setStockForm({ ...stockForm, supplierPaid: e.target.value })} />
        </div>
        <button className="primary" onClick={saveStock}><Plus size={16}/> Stok Kaydet</button>
      </div>

    </section>
  );
}

function StockTable({ stock, setEditingStock }) {
  return <Table headers={["Tür", "Ürün", "Barkod/IMEI", "Stok", "Alış", "Satış", "Tedarikçi", "Düzelt"]} rows={stock.map(p => [
    p.deviceType,
    productTitle(p),
    p.barcode,
    p.qty,
    money(p.buy),
    money(p.sell),
    p.supplier,
    <button className="edit-btn" onClick={() => setEditingStock({ ...p })}><Pencil size={14}/> Düzenle</button>
  ])} />;
}

function Table({ headers, rows }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>Kayıt yok.</td></tr>}</tbody></table></div>;
}

function SaleEditModal({ sale, setSale, save }) {
  const remaining = sale.type === "Aksesuar Satışı" ? 0 : Math.max(Number(sale.total || 0) - Number(sale.cash || 0) - Number(sale.card || 0), 0);
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Satış Düzelt</h2>
        <input placeholder="Müşteri adı soyadı / telefon" value={sale.customer || ""} onChange={e => setSale({ ...sale, customer: e.target.value, cariPerson: e.target.value })} />
        <input placeholder="Cari kişi" value={sale.cariPerson || ""} onChange={e => setSale({ ...sale, cariPerson: e.target.value })} />
        <input type="number" placeholder="Satış fiyatı" value={sale.total} onChange={e => setSale({ ...sale, total: e.target.value, remaining })} />
        <input type="number" placeholder="Nakit" value={sale.cash} onChange={e => setSale({ ...sale, cash: e.target.value })} />
        <input type="number" placeholder="Kart" value={sale.card} onChange={e => setSale({ ...sale, card: e.target.value })} />
        <select value={sale.bank || ""} onChange={e => setSale({ ...sale, bank: e.target.value })}><option value="">Banka seç</option>{banks.map(b => <option key={b}>{b}</option>)}</select>
        <div className="remaining-box"><span>Yeni Kalan</span><b>{money(remaining)}</b></div>
        <div className="modal-actions">
          <button className="primary" onClick={save}><Save size={16}/> Kaydet</button>
          <button className="choice" onClick={() => setSale(null)}><X size={16}/> Vazgeç</button>
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
        {item.module === "Aksesuar" ? <input placeholder="Ürün adı" value={item.name || ""} onChange={e => setItem({ ...item, name: e.target.value })} /> : <input placeholder="Model" value={item.model || ""} onChange={e => setItem({ ...item, model: e.target.value })} />}
        <input placeholder="Barkod / IMEI" value={item.barcode || ""} onChange={e => setItem({ ...item, barcode: e.target.value })} />
        <input type="number" placeholder="Stok" value={item.qty} onChange={e => setItem({ ...item, qty: e.target.value })} />
        <input type="number" placeholder="Alış" value={item.buy} onChange={e => setItem({ ...item, buy: e.target.value })} />
        <input type="number" placeholder="Satış" value={item.sell} onChange={e => setItem({ ...item, sell: e.target.value })} />
        <input placeholder="Tedarikçi / Satıcı firma" value={item.supplier || ""} onChange={e => setItem({ ...item, supplier: e.target.value })} />
        <input type="number" placeholder="Firmaya ödenen" value={item.supplierPaid || 0} onChange={e => setItem({ ...item, supplierPaid: e.target.value })} />
        <div className="modal-actions">
          <button className="primary" onClick={save}><Save size={16}/> Kaydet</button>
          <button className="choice" onClick={() => setItem(null)}><X size={16}/> Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
