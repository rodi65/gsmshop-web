
import React, { useMemo, useState } from "react";
import { Wallet, Smartphone, Headphones, Search, TrendingUp, Wrench, Plus, Archive, RotateCcw, Trash2 } from "lucide-react";

const money = (v) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0));
const has = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase());
const today = () => new Date().toISOString().slice(0, 10);
const isImei = (v) => String(v || "").length === 15 && String(v || "").split("").every((c) => c >= "0" && c <= "9");

const deviceTypes = ["Telefon", "Saat", "Tablet", "PC", "Elektronik"];
const saleTypes = ["Telefon Satışı", "Saat Satışı", "Tablet Satışı", "PC Satışı", "Elektronik Satışı", "Aksesuar Satışı"];
const banks = ["Ziraat", "İş Bankası", "Garanti", "Akbank", "Yapı Kredi", "Halkbank", "VakıfBank", "QNB", "Enpara", "Diğer"];
const baseCategories = ["Kılıf", "Şarj", "Koruyucu", "Kulaklık", "Blutut Kulaklık"];

const brandGroups = {
  Apple: ["Apple"],
  Samsung: ["Samsung"],
  Huawei: ["Huawei"],
  "Çin Markaları": ["Xiaomi", "Oppo", "Vivo", "Honor", "Realme", "Tecno", "Poco", "OnePlus", "TCL", "Infinix", "Alcatel", "Motorola"],
};

const models = {
  Apple: ["iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone Air", "iPhone 17", "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15"],
  Samsung: ["Galaxy S26 Ultra", "Galaxy S26+", "Galaxy S26", "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25", "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24"],
  Huawei: ["Huawei Pura 80 Ultra", "Huawei Pura 80 Pro", "Huawei Mate 70 Pro", "Huawei Pura 70 Pro"],
  Xiaomi: ["Xiaomi 15 Ultra", "Xiaomi 15 Pro", "Xiaomi 15", "Redmi Note 14 Pro+ 5G"],
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

const watchModels = {
  Apple: ["Apple Watch Ultra 3", "Apple Watch Series 11", "Apple Watch SE 3"],
  Samsung: ["Galaxy Watch Ultra", "Galaxy Watch7", "Galaxy Watch6 Classic"],
  Huawei: ["Huawei Watch GT 6 Pro", "Huawei Watch GT 6", "Huawei Watch 5"],
  Xiaomi: ["Xiaomi Watch S4", "Xiaomi Watch 2 Pro"],
};

const initialStock = [
  { id: 101, module: "Cihaz", deviceType: "Telefon", condition: "Sıfır Garantili", brandGroup: "Apple", brand: "Apple", model: "iPhone 17 Pro Max", memory: "256 GB", barcodeImei: "356789123456789", buy: 70000, sell: 85000, qty: 1, sellerCompany: "TEKNOSA", sellerPerson: "", sellerPhone: "", note: "" },
  { id: 102, module: "Cihaz", deviceType: "Telefon", condition: "Sıfır Garantili", brandGroup: "Samsung", brand: "Samsung", model: "Galaxy S26 Ultra", memory: "512 GB", barcodeImei: "356789123456780", buy: 80000, sell: 98000, qty: 1, sellerCompany: "DİSTRİBÜTÖR", sellerPerson: "", sellerPhone: "", note: "S26 serisi" },
  { id: 103, module: "Cihaz", deviceType: "Saat", condition: "Sıfır Garantili", brandGroup: "Apple", brand: "Apple", model: "Apple Watch Ultra 3", memory: "", barcodeImei: "869000000001", buy: 25000, sell: 32000, qty: 1, sellerCompany: "TEKNOSA", sellerPerson: "", sellerPhone: "", note: "" },
  { id: 201, module: "Aksesuar", deviceType: "Aksesuar", category: "Kılıf", name: "iPhone 17 Pro Max Kılıf", compatibleModel: "iPhone 17 Pro Max", barcode: "869000000101", buy: 150, sell: 400, qty: 20, supplierName: "ABC AKSESUAR" },
  { id: 202, module: "Aksesuar", deviceType: "Aksesuar", category: "Blutut Kulaklık", name: "Baseus Bluetooth Kulaklık", compatibleModel: "Genel", barcode: "869000000103", buy: 500, sell: 950, qty: 10, supplierName: "XYZ ELEKTRONİK" },
];

const initialSales = [
  { id: 1, type: "Telefon Satışı", customer: "Mehmet Kaya 0555 555 55 55", bank: "Garanti", productName: "iPhone 17 Pro Max", productDeviceType: "Telefon", productBarcodeImei: "356789123456789", productBuyPrice: 70000, total: 85000, cash: 30000, card: 40000, remaining: 15000, profit: 15000, date: new Date().toISOString() },
  { id: 2, type: "Aksesuar Satışı", customer: "", bank: "", productName: "iPhone 17 Pro Max Kılıf", productDeviceType: "Aksesuar", productBarcodeImei: "869000000101", productBuyPrice: 150, total: 400, cash: 400, card: 0, remaining: 0, profit: 250, date: new Date().toISOString() },
  { id: 3, type: "Saat Satışı", customer: "Ahmet Demir 0544 444 44 44", bank: "İş Bankası", productName: "Apple Watch Ultra 3", productDeviceType: "Saat", productBarcodeImei: "869000000001", productBuyPrice: 25000, total: 32000, cash: 12000, card: 20000, remaining: 0, profit: 7000, date: new Date().toISOString() },
];

function StatCard({ title, value, note, dark }) {
  return <div className={dark ? "stat-card dark" : "stat-card"}><div className="stat-title">{title}</div><div className="stat-value">{value}</div>{note && <div className="stat-note">{note}</div>}</div>;
}

function stockSummary(items) {
  const qty = items.reduce((s, p) => s + Number(p.qty || 0), 0);
  const buy = items.reduce((s, p) => s + Number(p.qty || 0) * Number(p.buy || 0), 0);
  const sell = items.reduce((s, p) => s + Number(p.qty || 0) * Number(p.sell || 0), 0);
  return { qty, buy, sell, profit: sell - buy };
}

export default function App() {
  const [activeModule, setActiveModule] = useState("kasa");
  const [stock, setStock] = useState(initialStock);
  const [sales, setSales] = useState(initialSales);
  const [stockTab, setStockTab] = useState("Telefon");
  const [categories, setCategories] = useState(baseCategories.map((name) => ({ name, fixed: true, archived: false })));
  const [newCategory, setNewCategory] = useState("");
  const [lastAction, setLastAction] = useState(null);
  const [saleNote, setSaleNote] = useState("");
  const [saleForm, setSaleForm] = useState({ type: "Telefon Satışı", customer: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  const [deviceForm, setDeviceForm] = useState({ deviceType: "Telefon", condition: "Sıfır Garantili", brandGroup: "Apple", brand: "Apple", model: "iPhone 17 Pro Max", memory: "256 GB", barcodeImei: "", buy: "", sell: "", qty: "1", sellerCompany: "", sellerPerson: "", sellerPhone: "", note: "" });
  const [accessoryForm, setAccessoryForm] = useState({ category: "Kılıf", name: "", compatibleModel: "", barcode: "", qty: "1", buy: "", sell: "", supplierName: "" });
  const [query, setQuery] = useState({ text: "", type: "Tümü", brand: "Tümü" });
  const [voleTab, setVoleTab] = useState("Günlük");
  const [range, setRange] = useState({ start: today(), end: today() });

  const companyNames = useMemo(() => Array.from(new Set(stock.map((s) => s.supplierName || s.sellerCompany).filter(Boolean))).sort(), [stock]);
  const activeCategories = categories.filter((c) => !c.archived);
  const archivedCategories = categories.filter((c) => c.archived);
  const isAccessorySale = saleForm.type === "Aksesuar Satışı";
  const saleDeviceType = saleForm.type.replace(" Satışı", "");
  const saleProducts = stock
    .filter((p) => isAccessorySale ? p.module === "Aksesuar" : p.module === "Cihaz" && p.deviceType === saleDeviceType)
    .filter((p) => !saleForm.search || has(p.barcode || p.barcodeImei, saleForm.search) || has(p.name, saleForm.search) || has(p.model, saleForm.search));
  const selectedSaleProduct = stock.find((p) => String(p.id) === String(saleForm.productId));
  const saleTotal = Number(saleForm.total || selectedSaleProduct?.sell || 0);
  const saleCash = Number(saleForm.cash || 0);
  const saleCard = Number(saleForm.card || 0);
  const saleRemaining = Math.max(saleTotal - saleCash - saleCard, 0);
  const saleProfit = selectedSaleProduct ? saleTotal - Number(selectedSaleProduct.buy || 0) : 0;

  const report = useMemo(() => {
    const sum = (type, key) => sales.filter((s) => !type || s.type === type).reduce((a, s) => a + Number(s[key] || 0), 0);
    return {
      total: sum(null, "total"),
      phone: sum("Telefon Satışı", "total"),
      watch: sum("Saat Satışı", "total"),
      accessory: sum("Aksesuar Satışı", "total"),
      cash: sum(null, "cash"),
      card: sum(null, "card"),
      remaining: sales.filter((s) => s.type !== "Aksesuar Satışı").reduce((a, s) => a + Number(s.remaining || 0), 0),
    };
  }, [sales]);

  const customerCari = useMemo(() => {
    const m = new Map();
    sales.filter((s) => s.type !== "Aksesuar Satışı" && Number(s.remaining || 0) > 0).forEach((s) => {
      const r = m.get(s.customer) || { customer: s.customer, total: 0, paid: 0, remaining: 0 };
      r.total += Number(s.total || 0);
      r.paid += Number(s.cash || 0) + Number(s.card || 0);
      r.remaining += Number(s.remaining || 0);
      m.set(s.customer, r);
    });
    return Array.from(m.values());
  }, [sales]);

  const supplierCari = useMemo(() => {
    const m = new Map();
    stock.filter((s) => s.module === "Aksesuar" || s.sellerCompany).forEach((s) => {
      const name = String(s.supplierName || s.sellerCompany || "FİRMASIZ").toUpperCase();
      const r = m.get(name) || { name, lastProduct: "", lastPayment: 0, totalPurchase: 0, totalPayment: 0, remaining: 0 };
      r.lastProduct = s.name || s.model;
      r.totalPurchase += Number(s.buy || 0) * Number(s.qty || 0);
      r.remaining += Number(s.buy || 0) * Number(s.qty || 0);
      m.set(name, r);
    });
    return Array.from(m.values());
  }, [stock]);

  function addSale() {
    const p = stock.find((x) => String(x.id) === String(saleForm.productId));
    if (!p) return alert("Ürün seç");
    if (Number(p.qty) <= 0) return alert("Stok yok");
    if (Number(saleForm.card || 0) > 0 && !saleForm.bank) return alert("Kart ödeme varsa banka seçimi zorunlu");
    if (!isAccessorySale && !saleForm.customer.trim()) return alert("Cihaz satışında müşteri adı ve telefonu gerekli");
    const total = Number(saleForm.total || p.sell);
    const cash = Number(saleForm.cash || 0);
    const card = Number(saleForm.card || 0);
    const remaining = isAccessorySale ? 0 : Math.max(total - cash - card, 0);
    const profit = total - Number(p.buy || 0);
    const productName = p.name || [p.brand, p.model, p.memory].filter(Boolean).join(" ");
    setStock(stock.map((x) => x.id === p.id ? { ...x, qty: Number(x.qty) - 1 } : x));
    setSales([{ id: Date.now(), type: saleForm.type, customer: isAccessorySale ? "" : saleForm.customer, bank: saleForm.bank || "", productName, productDeviceType: p.deviceType, productBarcodeImei: p.barcode || p.barcodeImei, productBuyPrice: Number(p.buy || 0), total, cash, card, remaining, profit, note: saleNote, date: new Date().toISOString() }, ...sales]);
    setLastAction({ productName, type: saleForm.type, oldQty: Number(p.qty), newQty: Number(p.qty) - 1, profit, remaining });
    setSaleForm({ type: "Telefon Satışı", customer: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
    setSaleNote("");
  }

  function addDeviceStock() {
    if (!deviceForm.brand || !deviceForm.model || !deviceForm.barcodeImei || !deviceForm.buy || !deviceForm.sell || !deviceForm.qty) return alert("Zorunlu alanlar eksik");
    if (stock.some((s) => (s.barcodeImei || s.barcode) === deviceForm.barcodeImei)) return alert("Bu Barkod / IMEI zaten kayıtlı");
    if (deviceForm.condition === "İkinci El" && (!deviceForm.sellerPerson || !deviceForm.sellerPhone)) return alert("İkinci elde satıcı şahıs ve telefon zorunlu");
    setStock([{ id: Date.now(), module: "Cihaz", ...deviceForm, codeType: isImei(deviceForm.barcodeImei) ? "IMEI" : "Barkod", buy: Number(deviceForm.buy), sell: Number(deviceForm.sell), qty: Number(deviceForm.qty) }, ...stock]);
    setDeviceForm({ ...deviceForm, barcodeImei: "", buy: "", sell: "", qty: "1", sellerPerson: "", sellerPhone: "", note: "" });
  }

  function addAccessoryStock() {
    if (!accessoryForm.category || !accessoryForm.name || !accessoryForm.barcode || !accessoryForm.qty || !accessoryForm.buy || !accessoryForm.sell || !accessoryForm.supplierName) return alert("Aksesuar zorunlu alanları eksik");
    if (stock.some((s) => (s.barcode || s.barcodeImei) === accessoryForm.barcode)) return alert("Bu barkod zaten kayıtlı");
    setStock([{ id: Date.now(), module: "Aksesuar", deviceType: "Aksesuar", ...accessoryForm, buy: Number(accessoryForm.buy), sell: Number(accessoryForm.sell), qty: Number(accessoryForm.qty) }, ...stock]);
    setAccessoryForm({ category: "Kılıf", name: "", compatibleModel: "", barcode: "", qty: "1", buy: "", sell: "", supplierName: "" });
  }

  const filteredStock = stock.filter((p) => p.deviceType === stockTab);
  const summary = stockSummary(filteredStock);
  const queryStock = stock.filter((p) => (!query.text || has(p.barcodeImei || p.barcode, query.text) || has(p.name, query.text) || has(p.model, query.text) || has(p.supplierName || p.sellerCompany || p.sellerPerson, query.text)) && (query.type === "Tümü" || p.deviceType === query.type) && (query.brand === "Tümü" || p.brand === query.brand));
  const querySales = sales.filter((s) => !query.text || has(s.productBarcodeImei, query.text) || has(s.customer, query.text) || has(s.productName, query.text));

  const profitReport = useMemo(() => {
    const now = new Date();
    const filtered = sales.filter((s) => {
      const d = new Date(s.date);
      const dISO = d.toISOString().slice(0, 10);
      if (voleTab === "Günlük") return dISO === today();
      if (voleTab === "Aylık") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      return dISO >= range.start && dISO <= range.end;
    });
    return ["Telefon Satışı", "Saat Satışı", "Tablet Satışı", "PC Satışı", "Elektronik Satışı", "Aksesuar Satışı", "Tamir Geliri"].map((g) => {
      const items = filtered.filter((s) => s.type === g);
      const sale = items.reduce((a, s) => a + Number(s.total || 0), 0);
      const cost = items.reduce((a, s) => a + (g === "Tamir Geliri" ? 0 : Number(s.productBuyPrice || 0)), 0);
      return { group: g, count: items.length, sale, cost, profit: sale - cost };
    });
  }, [sales, voleTab, range]);
  const totalProfit = profitReport.reduce((a, r) => a + r.profit, 0);

  function StockTable({ items, showSummary = true }) {
    return <div className="table-wrap">
      {showSummary && <div className="stats four"><StatCard title="Ürün adedi" value={summary.qty} /><StatCard title="Alış toplam" value={money(summary.buy)} /><StatCard title="Satış toplam" value={money(summary.sell)} /><StatCard title="Kâr" value={money(summary.profit)} /></div>}
      <table><thead><tr><th>Tür</th><th>Durum/Kategori</th><th>Ürün</th><th>Barkod/IMEI</th><th>Stok</th><th>Alış</th><th>Satış</th><th>Kâr</th><th>Firma/Şahıs</th></tr></thead><tbody>
        {items.map((p) => <tr key={p.id}><td><span className="badge">{p.deviceType}</span></td><td>{p.condition || p.category}</td><td><b>{p.name || [p.brand, p.model, p.memory].filter(Boolean).join(" ")}</b></td><td>{p.barcodeImei || p.barcode}</td><td>{p.qty}</td><td>{money(p.buy)}</td><td>{money(p.sell)}</td><td>{money(Number(p.sell || 0) - Number(p.buy || 0))}</td><td>{p.supplierName || p.sellerCompany || p.sellerPerson}</td></tr>)}
      </tbody></table>
    </div>;
  }

  const nav = [["kasa", "Kasa", Wallet], ["cihaz", "Cihaz", Smartphone], ["aksesuar", "Aksesuar", Headphones], ["sorgulama", "Sorgulama", Search], ["vole", "Vole", TrendingUp], ["tamir", "Tamir", Wrench]];

  return <div className="app"><div className="shell">
    <header className="hero"><div><h1>GSMSHOP</h1><p>Web test sürümü. Önce burada test, sonra bulut ve APK.</p></div><div className="status-pill">WEB TEST</div></header>
    <div className="nav-grid">{nav.map(([key, label, Icon]) => <button key={key} disabled={key === "tamir"} onClick={() => key !== "tamir" && setActiveModule(key)} className={activeModule === key ? "nav-btn active" : key === "tamir" ? "nav-btn disabled" : "nav-btn"}><Icon size={24} /><span>{label}</span>{key === "tamir" && <small>Yakında aktif</small>}</button>)}</div>

    {activeModule === "kasa" && <section className="section">
      <div className="stats four"><StatCard title="Toplam Satış" value={money(report.total)} /><StatCard title="Telefon Satışı" value={money(report.phone)} /><StatCard title="Saat Satışı" value={money(report.watch)} /><StatCard title="Aksesuar Satışı" value={money(report.accessory)} /></div>
      <div className="stats three"><StatCard title="Nakit" value={money(report.cash)} /><StatCard title="Kart" value={money(report.card)} /><StatCard title="Cari Kalan" value={money(report.remaining)} note="Aksesuar satışında cari yok" /></div>
      <div className="grid sale-layout">
        <div className="card">
          <div className="card-head"><div><h2>Hızlı Satış</h2><p>Ürün seç, ödeme gir, stok ve kâr otomatik işlensin.</p></div><span className="badge">Kasa</span></div>
          <div className="button-grid">{saleTypes.map((t) => <button key={t} className={saleForm.type === t ? "choice active" : "choice"} onClick={() => setSaleForm({ ...saleForm, type: t, productId: "", search: "" })}>{t.replace(" Satışı", "")}</button>)}</div>
          {!isAccessorySale && <input placeholder="Müşteri adı ve telefonu" value={saleForm.customer} onChange={(e) => setSaleForm({ ...saleForm, customer: e.target.value })} />}
          <div className="mini-box"><b>ÜRÜN ARAMA</b><input placeholder={isAccessorySale ? "Barkod veya ürün adı" : "Barkod / IMEI veya model"} value={saleForm.search} onChange={(e) => setSaleForm({ ...saleForm, search: e.target.value })} /></div>
          <select value={saleForm.productId} onChange={(e) => { const p = stock.find((x) => String(x.id) === e.target.value); setSaleForm({ ...saleForm, productId: e.target.value, total: p?.sell || "" }); }}><option value="">Ürün seç</option>{saleProducts.map((p) => <option key={p.id} value={p.id}>{p.name || p.model} - Stok {p.qty} - {money(p.sell)}</option>)}</select>
          {selectedSaleProduct && <div className="preview"><b>Seçilen ürün: {selectedSaleProduct.name || selectedSaleProduct.model}</b><span>Stok: {selectedSaleProduct.qty} | Alış: {money(selectedSaleProduct.buy)} | Satış: {money(selectedSaleProduct.sell)}</span><span>Ön kâr: <b>{money(saleProfit)}</b></span>{!isAccessorySale && saleRemaining > 0 && <strong className="danger">Cari oluşacak: {money(saleRemaining)}</strong>}</div>}
          <div className="mini-box"><b>ÖDEME</b><input type="number" placeholder="Satış fiyatı" value={saleForm.total} onChange={(e) => setSaleForm({ ...saleForm, total: e.target.value })} /><input type="number" placeholder="Nakit" value={saleForm.cash} onChange={(e) => setSaleForm({ ...saleForm, cash: e.target.value })} /><div className="two"><input type="number" placeholder="Kart" value={saleForm.card} onChange={(e) => setSaleForm({ ...saleForm, card: e.target.value })} /><div className="remaining-box"><span>Kalan</span><b>{money(saleRemaining)}</b></div></div><select value={saleForm.bank} onChange={(e) => setSaleForm({ ...saleForm, bank: e.target.value })}><option value="">Banka seç</option>{banks.map((b) => <option key={b}>{b}</option>)}</select><input placeholder="Satış notu / açıklama" value={saleNote} onChange={(e) => setSaleNote(e.target.value)} /></div>
          {!isAccessorySale && saleRemaining > 0 && <div className="warning">Kalan tutar cari borç olarak müşteri adına yazılacak. Müşteri adı ve telefonu olmadan hesap kapanmaz.</div>}
          <div className="close-summary"><small>KAPANIŞ ÖZETİ</small><div><span>Satış:</span><b>{money(saleTotal)}</b></div><div><span>Nakit:</span><b>{money(saleCash)}</b></div><div><span>Kart:</span><b>{money(saleCard)}</b></div><div><span>Kalan:</span><b>{money(saleRemaining)}</b></div></div>
          <button className="primary" onClick={addSale}><Plus size={16} /> Hesabı Kapat / Satış Kaydet</button>
          {lastAction && <div className="success"><b>Son satış kaydedildi</b><span>{lastAction.type}: {lastAction.productName}</span><span>Stok: {lastAction.oldQty} → {lastAction.newQty}</span><span>Kâr: {money(lastAction.profit)} {lastAction.remaining > 0 ? `| Cari: ${money(lastAction.remaining)}` : ""}</span></div>}
        </div>
        <div className="card wide">
          <div className="list-title"><h2>Satış Listesi</h2><b>{new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false })} · {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</b></div>
          <table><thead><tr><th>No</th><th>Saat</th><th>Ürün</th><th>Nakit</th><th>Kart</th><th>Borç</th><th>Kalan</th></tr></thead><tbody>{sales.map((s, i) => <tr key={s.id}><td><b>{i + 1}</b></td><td>{new Date(s.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false })}</td><td><b>{s.productName}</b><br /><small>{s.type}{s.customer ? ` · ${s.customer}` : ""}</small></td><td>{money(s.cash)}</td><td>{money(s.card)}{s.bank ? <small><br />{s.bank}</small> : null}</td><td>{money(s.remaining)}</td><td><b>{money(Math.max(Number(s.total || 0) - Number(s.cash || 0) - Number(s.card || 0), 0))}</b></td></tr>)}</tbody></table>
          <div className="total-square"><span>Toplam Satış</span><b>{money(sales.reduce((a, s) => a + Number(s.total || 0), 0))}</b></div>
        </div>
      </div>
      <div className="card"><h2>Cari</h2>{customerCari.length ? customerCari.map((c) => <div key={c.customer} className="cari-row"><b>{c.customer}</b><span>Kalan: <b className="danger">{money(c.remaining)}</b></span></div>) : <p>Cari borç yok.</p>}</div>
    </section>}

    {activeModule === "cihaz" && <section className="section"><div className="card"><div className="tab-row">{deviceTypes.map((t) => <button key={t} className={stockTab === t ? "choice active" : "choice"} onClick={() => setStockTab(t)}>{t}</button>)}</div><StockTable items={filteredStock} /></div><div className="card"><h2>Cihaz Stok Kayıt</h2><div className="form-grid"><select value={deviceForm.deviceType} onChange={(e) => setDeviceForm({ ...deviceForm, deviceType: e.target.value })}>{deviceTypes.map((x) => <option key={x}>{x}</option>)}</select><select value={deviceForm.condition} onChange={(e) => setDeviceForm({ ...deviceForm, condition: e.target.value })}>{["Sıfır Garantili", "Sıfır Spot", "İkinci El"].map((x) => <option key={x}>{x}</option>)}</select><select value={deviceForm.brandGroup} onChange={(e) => { const bg = e.target.value; setDeviceForm({ ...deviceForm, brandGroup: bg, brand: brandGroups[bg][0] }); }}>{Object.keys(brandGroups).map((x) => <option key={x}>{x}</option>)}</select><select value={deviceForm.brand} onChange={(e) => setDeviceForm({ ...deviceForm, brand: e.target.value, model: (models[e.target.value] || watchModels[e.target.value] || [""])[0] })}>{brandGroups[deviceForm.brandGroup].map((x) => <option key={x}>{x}</option>)}</select><select value={deviceForm.model} onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })}>{(deviceForm.deviceType === "Saat" ? (watchModels[deviceForm.brand] || models[deviceForm.brand] || []) : (models[deviceForm.brand] || [])).map((x) => <option key={x}>{x}</option>)}</select><input placeholder="Hafıza" value={deviceForm.memory} onChange={(e) => setDeviceForm({ ...deviceForm, memory: e.target.value })} /><input placeholder="Barkod / IMEI" value={deviceForm.barcodeImei} onChange={(e) => setDeviceForm({ ...deviceForm, barcodeImei: e.target.value })} /><input type="number" placeholder="Alış" value={deviceForm.buy} onChange={(e) => setDeviceForm({ ...deviceForm, buy: e.target.value })} /><input type="number" placeholder="Satış" value={deviceForm.sell} onChange={(e) => setDeviceForm({ ...deviceForm, sell: e.target.value })} /><input type="number" placeholder="Stok" value={deviceForm.qty} onChange={(e) => setDeviceForm({ ...deviceForm, qty: e.target.value })} /><input list="companies" placeholder="Satıcı firma" value={deviceForm.sellerCompany} onChange={(e) => setDeviceForm({ ...deviceForm, sellerCompany: e.target.value })} /><input placeholder="Satıcı şahıs" value={deviceForm.sellerPerson} onChange={(e) => setDeviceForm({ ...deviceForm, sellerPerson: e.target.value })} /><input placeholder="Satıcı telefon" value={deviceForm.sellerPhone} onChange={(e) => setDeviceForm({ ...deviceForm, sellerPhone: e.target.value })} /><input placeholder="Not" value={deviceForm.note} onChange={(e) => setDeviceForm({ ...deviceForm, note: e.target.value })} /></div><datalist id="companies">{companyNames.map((c) => <option key={c} value={c} />)}</datalist><button className="primary" onClick={addDeviceStock}><Plus size={16} /> Cihaz Stok Kaydet</button></div></section>}

    {activeModule === "aksesuar" && <section className="section"><div className="card"><div className="card-head"><h2>Aksesuar Kategorileri</h2><div className="inline-actions"><button>Güncelle</button><button className="primary small" onClick={() => { if (newCategory.trim()) setCategories([...categories, { name: newCategory.trim(), fixed: false, archived: false }]); setNewCategory(""); }}><Plus size={16} /> Kategori Kayıt</button></div></div><input placeholder="Yeni kategori" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} /><div className="category-grid">{activeCategories.map((c) => <div key={c.name} className="category-card"><b>{c.name}</b><button onClick={() => setCategories(categories.map((x) => x.name === c.name ? { ...x, archived: true } : x))}><Archive size={14} /> Arşiv</button></div>)}</div>{archivedCategories.length > 0 && <div className="archive"><h3>Arşiv</h3>{archivedCategories.map((c) => <div key={c.name} className="archive-row"><b>{c.name}</b><button onClick={() => setCategories(categories.map((x) => x.name === c.name ? { ...x, archived: false } : x))}><RotateCcw size={14} /> Geri Al</button><button className="danger-btn" onClick={() => setCategories(categories.filter((x) => x.name !== c.name))}><Trash2 size={14} /> Sil</button></div>)}</div>}</div><div className="card"><h2>Aksesuar Stok Kayıt</h2><div className="form-grid"><select value={accessoryForm.category} onChange={(e) => setAccessoryForm({ ...accessoryForm, category: e.target.value })}>{activeCategories.map((c) => <option key={c.name}>{c.name}</option>)}</select><input placeholder="Ürün adı" value={accessoryForm.name} onChange={(e) => setAccessoryForm({ ...accessoryForm, name: e.target.value })} /><input placeholder="Model uyumu" value={accessoryForm.compatibleModel} onChange={(e) => setAccessoryForm({ ...accessoryForm, compatibleModel: e.target.value })} /><input placeholder="Barkod" value={accessoryForm.barcode} onChange={(e) => setAccessoryForm({ ...accessoryForm, barcode: e.target.value })} /><input type="number" placeholder="Stok" value={accessoryForm.qty} onChange={(e) => setAccessoryForm({ ...accessoryForm, qty: e.target.value })} /><input type="number" placeholder="Alış" value={accessoryForm.buy} onChange={(e) => setAccessoryForm({ ...accessoryForm, buy: e.target.value })} /><input type="number" placeholder="Satış" value={accessoryForm.sell} onChange={(e) => setAccessoryForm({ ...accessoryForm, sell: e.target.value })} /><input list="companies" placeholder="Satıcı firma" value={accessoryForm.supplierName} onChange={(e) => setAccessoryForm({ ...accessoryForm, supplierName: e.target.value })} /></div><button className="primary" onClick={addAccessoryStock}><Plus size={16} /> Aksesuar Stok Kaydet</button></div><div className="card"><h2>Aksesuar Stok Listesi</h2><StockTable items={stock.filter((p) => p.module === "Aksesuar")} showSummary={false} /></div><div className="card"><h2>Satıcı Firma Carisi</h2><div className="supplier-grid">{supplierCari.map((f) => <div key={f.name} className="supplier-card"><h3>{f.name}</h3><span>Son alınan mal: {f.lastProduct}</span><span>Son ödeme: {money(f.lastPayment)}</span><span>Toplam alış: {money(f.totalPurchase)}</span><span>Toplam ödeme: {money(f.totalPayment)}</span><b>KALAN: {money(f.remaining)}</b></div>)}</div></div></section>}

    {activeModule === "sorgulama" && <section className="section"><div className="card"><h2>Sorgulama</h2><p>IMEI, barkod, isim, ürün, model veya firma adıyla ara.</p><div className="form-grid three-col"><input placeholder="Arama metni" value={query.text} onChange={(e) => setQuery({ ...query, text: e.target.value })} /><select value={query.type} onChange={(e) => setQuery({ ...query, type: e.target.value })}><option>Tümü</option><option>Telefon</option><option>Saat</option><option>Tablet</option><option>PC</option><option>Elektronik</option><option>Aksesuar</option></select><select value={query.brand} onChange={(e) => setQuery({ ...query, brand: e.target.value })}><option>Tümü</option>{Object.values(brandGroups).flat().map((b) => <option key={b}>{b}</option>)}</select></div><div className="grid two-col"><div><h3>Stok Sonuçları</h3><StockTable items={queryStock} showSummary={false} /></div><div><h3>Satış Sonuçları</h3><table><tbody>{querySales.map((s) => <tr key={s.id}><td><span className="badge">{s.type}</span></td><td>{s.productName}</td><td>{s.customer || "-"}</td><td>{money(s.total)}</td></tr>)}</tbody></table></div></div></div></section>}

    {activeModule === "vole" && <section className="section"><div className="card"><h2>Vole</h2><p>Kâr raporu: günlük, aylık ve tarih aralığı.</p><div className="tab-row">{["Günlük", "Aylık", "Tarih Aralığı"].map((t) => <button key={t} className={voleTab === t ? "choice active" : "choice"} onClick={() => setVoleTab(t)}>{t}</button>)}</div>{voleTab === "Tarih Aralığı" && <div className="form-grid two-fields"><input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /><input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></div>}<div className="profit-grid">{profitReport.map((r) => <div key={r.group} className="profit-card"><h3>{r.group}</h3><span>İşlem: {r.count}</span><span>Satış: {money(r.sale)}</span><span>Alış: {money(r.cost)}</span><b>Kâr: {money(r.profit)}</b></div>)}</div><StatCard dark title="Toplam Kâr" value={money(totalProfit)} /></div></section>}
  </div></div>;
}
