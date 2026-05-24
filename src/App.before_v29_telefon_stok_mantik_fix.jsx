import React, { useEffect, useMemo, useState } from "react";
import Login from "./components/Login";
import CashClosingPanel from "./components/CashClosingPanel";
import {
  getCurrentUser,
  signOut,
  loadDashboardData,
  createStockItem,
  createSale,
  createExpense,
  createBankWithdrawal,
  createCashMovement,
  findOrCreateContact,
  softDelete,
} from "./services/dataService";

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
const mainSaleGroups = ["Telefon", "Teknik", "Saat", "Tablet", "PC", "Elektronik"];
const otherSaleTypes = ["Saat Satışı", "PC Satışı", "Elektronik Satışı"];
const expenseCategories = ["Yemek", "Kargo", "Borç", "İade", "Ivır Zıvır"];
const quickAccessoryGroups = {
  "Kılıf": ["A Kılıf", "B Kılıf", "Silikon Kılıf"],
  "Ekran Koruyucu": ["A Cam", "B Cam", "C Cam"],
  "USB": ["A TYPC", "A Diğerleri", "Replika"],
  "Şarj": ["A Şarj", "B Şarj", "Replika"],
  "Kulaklık": ["Kulaklık"],
};

const saleGroupRank = (type) => {
  if (type === "Telefon Satışı") return 1;
  if (type === "Aksesuar Satışı") return 2;
  if (type === "Teknik Servis") return 4;
  return 3;
};

const saleGroupName = (type) => {
  if (type === "Telefon Satışı") return "Telefon";
  if (type === "Aksesuar Satışı") return "Aksesuar";
  if (type === "Teknik Servis") return "Teknik Servis";
  return "Diğerleri";
};

const sortSalesForList = (items) =>
  [...items].sort((a, b) => {
    const rankDiff = saleGroupRank(a.type) - saleGroupRank(b.type);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });


const toNumber = (value) => Number(String(value || "0").replace(/[^\d]/g, "")) || 0;

const fromDbStock = (item) => ({
  id: item.id,
  module: item.module,
  deviceType: item.device_type || item.deviceType || "Telefon",
  category: item.category || "KILIF",
  accessorySubType: item.sub_type || item.accessorySubType || "",
  brand: item.brand || "",
  model: item.model || "",
  memory: item.memory || "",
  name: item.product_name || "",
  compatibleModel: item.note || "",
  barcode: item.imei || item.barcode || "",
  buy: money(Number(item.buy_price || 0)),
  sell: money(Number(item.sell_price || 0)),
  qty: Number(item.quantity || 0),
  supplier: item.supplier_name || "",
  sellerPerson: item.seller_person || "",
  sellerPhone: item.seller_phone || "",
  saleDate: item.created_at || new Date().toISOString(),
  supplierPaid: money(0),
  sellerCariRemaining: Number(item.seller_cari_remaining || 0),
  supplierPaid: money(Number(item.supplier_paid || 0)),
  acquisitionType: item.acquisition_type || "Müşteri",
});

const fromDbSale = (sale) => ({
  id: sale.id,
  type: sale.sale_type,
  productId: sale.stock_item_id,
  productName: sale.product_name,
  productBarcode: "",
  productBuyPrice: Number(sale.buy_cost || 0),
  customer: sale.customer_name || "",
  customerPhone: sale.customer_phone || "",
  cariPerson: sale.cari_person || "",
  total: money(Number(sale.total_amount || 0)),
  cash: money(Number(sale.cash_amount || 0)),
  card: money(Number(sale.card_amount || 0)),
  bank: sale.bank_name || "",
  remaining: Number(sale.remaining_amount || 0),
  profit: Number(sale.profit_amount || 0),
  date: sale.created_at || new Date().toISOString(),
});

const fromDbExpense = (item) => ({
  id: item.id,
  category: item.category,
  amount: money(Number(item.amount || 0)),
  note: item.note || "",
  date: item.created_at || new Date().toISOString(),
});

const fromDbBankMovement = (item) => ({
  id: item.id,
  type: item.movement_type,
  bank: item.bank_name,
  amount: money(Number(item.amount || 0)),
  note: item.note || "",
  date: item.created_at || new Date().toISOString(),
});


const deviceTypes = ["Telefon", "Saat", "Tablet", "PC", "Elektronik"];
const banks = ["Ziraatbank", "İşbank", "Garantibank", "Halkbank", "Qnbbank", "Vakıfbank", "Yapıkredi"];
const memoryOptions = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];
const categories = ["KILIF", "EKRAN Koruyucu", "USB", "ŞARJ", "KULAKLIK"];
const accessoryGroups = {
  "KILIF": ["A Kılıf", "B Kılıf", "Silikon Kılıf"],
  "EKRAN Koruyucu": ["A Cam", "B Cam", "C Cam"],
  "USB": ["A TYPC", "A Diğerleri", "Replika"],
  "ŞARJ": ["A Şarj", "B Şarj", "Replika"],
  "KULAKLIK": ["Kulaklık"],
  "DİĞERLERİ": ["Diğer"]
};
const fixedAccessoryCategories = ["KILIF", "EKRAN Koruyucu", "USB", "ŞARJ", "KULAKLIK"];
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
  category: "KILIF",
  accessorySubType: "A Kılıf",
  archivedCategory: false,
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
    sellerCariRemaining: Number(item.seller_cari_remaining || 0),
  supplierPaid: money(Number(item.supplier_paid || 0)),
  acquisitionType: item.acquisition_type || "Müşteri",
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
    sellerCariRemaining: Number(item.seller_cari_remaining || 0),
  supplierPaid: money(Number(item.supplier_paid || 0)),
  acquisitionType: item.acquisition_type || "Müşteri",
    note: "",
  },
  {
    id: 201,
    module: "Aksesuar",
    deviceType: "Aksesuar",
    category: "KILIF",
    accessorySubType: "A Kılıf",
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
  if (product.module === "Aksesuar") return [product.category, product.accessorySubType, product.name].filter(Boolean).join(" / ") || "-";
  if (product.module !== "Cihaz") return [product.deviceType, product.name].filter(Boolean).join(" / ") || "-";
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
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [contacts, setContacts] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [kasaTab, setKasaTab] = useState("yeniSatis");
  const [saleGroup, setSaleGroup] = useState("Telefon");
  const [quickAccessoryGroup, setQuickAccessoryGroup] = useState("Kılıf");
  const [quickAccessorySubType, setQuickAccessorySubType] = useState("A Kılıf");
  const [visibleKasaStats, setVisibleKasaStats] = useState({});
  const [profitUnlocked, setProfitUnlocked] = useState(false);
  const [profitDateFrom, setProfitDateFrom] = useState("");
  const [profitDateTo, setProfitDateTo] = useState("");
  const [karaTab, setKaraTab] = useState("alacak");
  const [selectedSupplierAccount, setSelectedSupplierAccount] = useState(null);
  const [selectedReceivableMovement, setSelectedReceivableMovement] = useState(null);
  const [stockTab, setStockTab] = useState("liste");
  const [stockView, setStockView] = useState("cihaz");
  const [otherGroupName, setOtherGroupName] = useState("");
  const [customAccessoryCategories, setCustomAccessoryCategories] = useState([]);
  const [stock, setStock] = useState(initialStock);
  const [sales, setSales] = useState(initialSales);
  const [suppliers, setSuppliers] = useState(["MOBİLTEK İLETİŞİM", "GALAKSİ TEKNOLOJİ", "BASEUS TÜRKİYE"]);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [bankCashForm, setBankCashForm] = useState({ amount: "", bank: "", note: "" });
  const [bankMovements, setBankMovements] = useState([
    { id: 1, type: "Bankaya Giden", amount: "40.000 TL", note: "POSTAN Gelen - Garantibank", bank: "Garantibank", date: new Date().toISOString() },
  ]);
  const [saleForm, setSaleForm] = useState({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ category: "Yemek", amount: "", note: "" });
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


  async function refreshFromDatabase() {
    setSyncMessage("Veriler Supabase'ten yükleniyor...");
    const data = await loadDashboardData();
    setStock((data.stock || []).map(fromDbStock));
    setSales((data.sales || []).map(fromDbSale));
    setExpenses((data.expenses || []).map(fromDbExpense));
    setBankMovements((data.bankMovements || []).map(fromDbBankMovement));
    setContacts(data.contacts || []);
    setCashMovements(data.cashMovements || []);
    setDbReady(true);
    setSyncMessage("Veriler Supabase ile senkronize.");
  }

  async function checkAuthAndLoad() {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
      if (user) await refreshFromDatabase();
    } catch (error) {
      console.error(error);
      setSyncMessage(error.message || "Supabase bağlantısı kontrol edilemedi.");
    } finally {
      setAuthChecked(true);
    }
  }

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  async function handleLogout() {
    await signOut();
    setCurrentUser(null);
    setDbReady(false);
  }

  const report = {
    total: sales.reduce((sum, sale) => sum + parseMoneyInput(sale.total), 0),
    cash: sales.reduce((sum, sale) => sum + parseMoneyInput(sale.cash), 0),
    card: sales.reduce((sum, sale) => sum + parseMoneyInput(sale.card), 0),
    remaining: sales.reduce((sum, sale) => sum + Number(sale.remaining || 0), 0),
    profit: sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0),
  };

  const expenseReport = {
    total: expenses.reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
  };

  const stockCashPayments = cashMovements
    .filter((item) => item.movement_type === "Stok Ödemesi" || item.movementType === "Stok Ödemesi")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const bankReport = {
    totalToBank: bankMovements.filter((item) => item.type === "Bankaya Giden").reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
    withdrawnFromBank: bankMovements.filter((item) => item.type === "Bankadan Çekilen").reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
  };
  bankReport.remainingInBank = Math.max(bankReport.totalToBank - bankReport.withdrawnFromBank, 0);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const monthlyPosTotal = bankMovements
    .filter((item) => item.type === "Bankaya Giden" && item.date && item.date.slice(0, 7) === currentMonthKey)
    .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
  const monthlyPosCommission = monthlyPosTotal * 0.035;

  const cashWithBankIncoming = report.cash + bankReport.withdrawnFromBank - stockCashPayments;
  const cashAfterExpenses = Math.max(cashWithBankIncoming - expenseReport.total, 0);

  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = new Date().toISOString().slice(0, 7);
  const dayProfit = sales
    .filter((sale) => sale.date && sale.date.slice(0, 10) === todayKey)
    .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  const monthProfit = sales
    .filter((sale) => sale.date && sale.date.slice(0, 7) === monthKey)
    .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  const rangeProfit = sales
    .filter((sale) => {
      const d = sale.date ? sale.date.slice(0, 10) : "";
      if (profitDateFrom && d < profitDateFrom) return false;
      if (profitDateTo && d > profitDateTo) return false;
      return true;
    })
    .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);

  const deviceStock = stock.filter((product) => product.module === "Cihaz");
  const accessoryStock = stock.filter((product) => product.module === "Aksesuar");
  const otherStock = stock.filter((product) => product.module !== "Cihaz" && product.module !== "Aksesuar");
  const allStock = stock;
  const currentStockList =
    stockView === "cihaz" ? deviceStock :
    stockView === "aksesuar" ? accessoryStock :
    stockView === "diger" ? otherStock :
    allStock;

  const currentStockBuyTotal = currentStockList.reduce((sum, product) => sum + parseMoneyInput(product.buy) * Number(product.qty || 0), 0);
  const currentStockQtyTotal = currentStockList.reduce((sum, product) => sum + Number(product.qty || 0), 0);

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

  const sortedSales = sortSalesForList(sales);
  const sortedFilteredSales = sortSalesForList(filteredSales);

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

  async function deleteSale(id) {
    if (!askDeletePassword()) return alert("Şifre yanlış. Silme işlemi iptal edildi.");
    try {
      await softDelete("sales", id);
      setSales(sales.filter((sale) => sale.id !== id));
      setSyncMessage("Satış Supabase'de silindi olarak işaretlendi.");
    } catch (error) {
      alert(error.message || "Satış silinemedi.");
    }
  }

  async function deleteStock(id) {
    if (!askDeletePassword()) return alert("Şifre yanlış. Silme işlemi iptal edildi.");
    try {
      await softDelete("stock_items", id);
      setStock(stock.filter((product) => product.id !== id));
      setSyncMessage("Stok Supabase'de silindi olarak işaretlendi.");
    } catch (error) {
      alert(error.message || "Stok silinemedi.");
    }
  }

  function deleteSupplierDebt(supplierName) {
    if (!askDeletePassword()) return alert("Şifre yanlış. Silme işlemi iptal edildi.");
    setStock(stock.filter((product) => product.supplier !== supplierName));
  }

  async function saveExpense() {
    const amount = parseMoneyInput(expenseForm.amount);
    if (!amount) return alert("Gider tutarını yaz");
    if (expenseForm.category === "Borç" && !expenseForm.note.trim()) return alert("Borç giderinde Not zorunludur");

    try {
      const savedExpense = await createExpense({
        category: expenseForm.category,
        amount,
        note: expenseForm.note.trim(),
      });
      setExpenses([fromDbExpense(savedExpense), ...expenses]);
      setSyncMessage("Gider Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Gider Supabase'e yazılamadı.");
      return;
    }

    setExpenseForm({ category: "Yemek", amount: "", note: "" });
  }

  async function deleteExpense(id) {
    if (!askDeletePassword()) return alert("Şifre yanlış. Silme işlemi iptal edildi.");
    try {
      await softDelete("expenses", id);
      setExpenses(expenses.filter((item) => item.id !== id));
      setSyncMessage("Gider Supabase'de silindi olarak işaretlendi.");
    } catch (error) {
      alert(error.message || "Gider silinemedi.");
    }
  }

  async function saveBankCashIncoming() {
    const amount = parseMoneyInput(bankCashForm.amount);
    if (!bankCashForm.bank) return alert("Banka ismi seçmek zorunludur");
    if (!amount) return alert("Bankadan gelen nakit tutarını yaz");
    if (amount > bankReport.remainingInBank) return alert("Bankada kalan tutardan fazla çekim yapılamaz");

    try {
      const savedMovement = await createBankWithdrawal({
        bank_name: bankCashForm.bank,
        amount,
        note: bankCashForm.note || `Bankadan Nakit Gelen - ${bankCashForm.bank}`,
      });
      setBankMovements([fromDbBankMovement(savedMovement), ...bankMovements]);
      setSyncMessage("Bankadan nakit gelen Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Banka hareketi Supabase'e yazılamadı.");
      return;
    }

    setBankCashForm({ amount: "", bank: "", note: "" });
    alert("Bankadan gelen para nakit kasasına eklendi ve Bankadan Çekilen bölümüne işlendi.");
  }

  function validateStock(module) {
    const isDevice = module === "Cihaz";
    const isAccessory = module === "Aksesuar";
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

  async function saveStock(module = stockForm.module) {
    const error = validateStock(module);
    if (error) return alert(error);

    const isDevice = module === "Cihaz";
    const isAccessory = module === "Aksesuar";
    const isCustomerPurchase = isDevice && (stockForm.acquisitionType || "Müşteri") === "Müşteri";
    const item = {
      ...stockForm,
      id: Date.now(),
      module,
      deviceType: isDevice ? stockForm.deviceType : isAccessory ? "Aksesuar" : (stockForm.deviceType || "Diğer"),
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

    try {
      const saved = await createStockItem({
        module: item.module,
        device_type: item.deviceType,
        category: item.category,
        sub_type: item.accessorySubType,
        brand: item.brand,
        model: item.model,
        memory: item.memory,
        product_name: productTitle(item) || item.name || item.model || "Ürün",
        barcode: item.module === "Cihaz" ? "" : item.barcode,
        imei: item.module === "Cihaz" ? item.barcode : "",
        buy_price: parseMoneyInput(item.buy),
        sell_price: parseMoneyInput(item.sell),
        quantity: Number(item.qty || 1),
        supplier_name: item.supplier,
        seller_person: item.sellerPerson,
        seller_phone: item.sellerPhone,
        acquisition_type: item.acquisitionType || stockForm.acquisitionType || "Müşteri",
        supplier_paid: parseMoneyInput(item.supplierPaid),
        seller_cari_remaining: Number(item.sellerCariRemaining || 0),
        note: item.compatibleModel || "",
      });

      setStock([fromDbStock(saved), ...stock]);
      setSyncMessage("Stok Supabase'e kaydedildi. Cari ve kasa hareketi işlendi.");
    } catch (error) {
      alert(error.message || "Stok kaydı Supabase'e yazılamadı.");
      return;
    }

    setStockForm({ ...emptyStockForm, module });
    setStockTab("liste");
  }

  async function saveSale() {
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

    try {
      const savedSale = await createSale({
        sale_group: saleGroupName(sale.type),
        sale_type: sale.type,
        stock_item_id: selectedProduct.id,
        product_name: sale.productName,
        customer_name: sale.customer,
        customer_phone: "",
        cari_person: sale.cariPerson,
        total_amount: parseMoneyInput(sale.total),
        cash_amount: parseMoneyInput(sale.cash),
        card_amount: parseMoneyInput(sale.card),
        remaining_amount: sale.remaining,
        buy_cost: sale.productBuyPrice,
        profit_amount: sale.profit,
        bank_name: sale.bank || null,
      });

      setStock(stock.map((product) => product.id === selectedProduct.id ? { ...product, qty: Math.max(Number(product.qty || 0) - 1, 0) } : product));
      setSales([fromDbSale(savedSale), ...sales]);

      if (parseMoneyInput(sale.card) > 0) {
        setBankMovements([
          {
            id: Date.now() + 1,
            type: "Bankaya Giden",
            amount: sale.card,
            note: `POSTAN Gelen - ${sale.bank || "Banka"} - ${sale.productName}`,
            bank: sale.bank || "",
            date: new Date().toISOString(),
          },
          ...bankMovements,
        ]);
      }

      setSyncMessage("Satış Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Satış Supabase'e yazılamadı.");
      return;
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

  function revealKasaStat(key) {
    setVisibleKasaStats({ ...visibleKasaStats, [key]: true });
  }

  function maskedValue(key, value) {
    return visibleKasaStats[key] ? value : "*******";
  }

  function openKaraDefter() {
    setActive("vole");
  }

  function openProfitTab() {
    if (profitUnlocked) {
      setKaraTab("kar");
      return;
    }
    const password = window.prompt("Kâr menüsü için şifre gir");
    if (password === "1") {
      setProfitUnlocked(true);
      setKaraTab("kar");
    } else {
      alert("Şifre yanlış.");
    }
  }

  if (!authChecked) {
    return <div className="app"><section className="card"><h2>GSMSHOP yükleniyor...</h2></section></div>;
  }

  if (!currentUser) {
    return <Login onLogin={checkAuthAndLoad} />;
  }

  return (
    <div className="app">
      <div className="shell">
        <header className="hero">
          <div>
            <h1>GSMSHOP</h1>
            <p>Web kasa, cihaz, aksesuar, stok, sorgulama, tamir ve kâr takip sistemi.</p>
        {syncMessage && <div className="sync-message">{syncMessage}</div>}
          </div>
          <div className="status-pill">WEB TEST</div>
        </header>

        <nav className="nav-grid">
          <button
            className={active === "kasa" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActive("kasa")}
          >
            <Wallet size={22} />
            <span>Kasa</span>
          </button>

          <button
            className={active === "cihaz" && stockForm.deviceType === "Telefon" ? "nav-btn active" : "nav-btn"}
            onClick={() => {
              setStockForm({ ...stockForm, module: "Cihaz", deviceType: "Telefon" });
              setActive("cihaz");
            }}
          >
            <Smartphone size={22} />
            <span>Telefon</span>
          </button>

          <button
            className={active === "aksesuar" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActive("aksesuar")}
          >
            <Headphones size={22} />
            <span>Aksesuar</span>
          </button>

          <button
            className={active === "stok" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActive("stok")}
          >
            <Package size={22} />
            <span>Stok</span>
          </button>

          <button
            className="nav-btn disabled"
            disabled
          >
            <Wrench size={22} />
            <span>Teknik</span>
            <small>Yakında</small>
          </button>

          <button
            className={active === "vole" ? "nav-btn active" : "nav-btn"}
            onClick={openKaraDefter}
          >
            <TrendingUp size={22} />
            <span>Kara Defter</span>
          </button>
        </nav>

        {active === "kasa" && (
          <section className="section">
            <div className="kasa-subtabs">
              <button className={kasaTab === "yeniSatis" ? "choice active" : "choice"} onClick={() => setKasaTab("yeniSatis")}>Yeni Satış</button>
              <button className={kasaTab === "satisListesi" ? "choice active" : "choice"} onClick={() => setKasaTab("satisListesi")}>Satış Listesi</button>
              <button className={kasaTab === "giderler" ? "choice active" : "choice"} onClick={() => setKasaTab("giderler")}>Giderler</button>
              <button className={kasaTab === "kapanis" ? "choice active" : "choice"} onClick={() => setKasaTab("kapanis")}>Kasa Kapanış</button>
              <button className={kasaTab === "bankadanNakit" ? "choice active" : "choice"} onClick={() => setKasaTab("bankadanNakit")}>Bankadan Nakit Gelen</button>
            </div>

            {kasaTab === "yeniSatis" && (
              <>
                <div className="stats four">
                  <button className="stat-button" onClick={() => revealKasaStat("total")}>
                    <Stat title="Toplam Satış" value={maskedValue("total", money(report.total))} />
                  </button>
                  <button className="stat-button" onClick={() => revealKasaStat("cash")}>
                    <Stat title="Nakit Kasa" value={maskedValue("cash", money(cashWithBankIncoming))} />
                  </button>
                  <button className="stat-button" onClick={() => revealKasaStat("card")}>
                    <Stat title="Kart" value={maskedValue("card", money(report.card))} />
                  </button>
                  <button className="stat-button" onClick={() => revealKasaStat("remaining")}>
                    <Stat title="Alacak" value={maskedValue("remaining", money(report.remaining))} />
                  </button>
                </div>

                <div className="grid sale-layout">
                  <div className="card">
                    <h2>Yeni Satış</h2>
                    <div className="big-sale-grid">
                      {mainSaleGroups.map((group) => (
                        <button
                          key={group}
                          className={saleGroup === group ? "big-sale-btn active" : "big-sale-btn"}
                          onClick={() => {
                            setSaleGroup(group);
                            setSaleForm({
                              ...saleForm,
                              type:
                                group === "Telefon" ? "Telefon Satışı" :
                                group === "Teknik" ? "Teknik Servis" :
                                group === "Saat" ? "Saat Satışı" :
                                group === "Tablet" ? "Tablet Satışı" :
                                group === "PC" ? "PC Satışı" :
                                group === "Elektronik" ? "Elektronik Satışı" :
                                "Telefon Satışı",
                              productId: "",
                              search: "",
                              total: "",
                              cash: "",
                              card: "",
                            });
                          }}
                        >
                          {group}
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
                      <div><span>Gider</span><b>{money(expenseReport.total)}</b></div>
                      <div><span>Net Nakit</span><b>{money(cashAfterExpenses)}</b></div>
                    </div>

                    <button className="primary" onClick={saveSale}><Plus size={16} /> Satışı Kaydet</button>
                  </div>

                  <div className="card">
                    <h2>Aksesuar Hızlı Seçim</h2>
                    <p>Kasa satış ekranında aksesuar grubunu hızlı seç.</p>

                    <div className="quick-accessory-grid">
                      {Object.keys(quickAccessoryGroups).map((group) => (
                        <button
                          key={group}
                          className={quickAccessoryGroup === group ? "big-sale-btn active" : "big-sale-btn"}
                          onClick={() => {
                            setQuickAccessoryGroup(group);
                            setQuickAccessorySubType(quickAccessoryGroups[group][0]);
                            setSaleGroup("Aksesuar");
                            setSaleForm({
                              ...saleForm,
                              type: "Aksesuar Satışı",
                              search: `${group} ${quickAccessoryGroups[group][0]}`,
                              productId: "",
                              total: "",
                              cash: "",
                              card: "",
                            });
                          }}
                        >
                          {group}
                        </button>
                      ))}
                    </div>

                    {(quickAccessoryGroup === "Kılıf" || quickAccessoryGroup === "Ekran Koruyucu") && (
                      <>
                        <h3>{quickAccessoryGroup} Alt Seçenekleri</h3>
                        <div className="button-grid">
                          {quickAccessoryGroups[quickAccessoryGroup].map((subType) => (
                            <button
                              key={subType}
                              className={quickAccessorySubType === subType ? "choice active" : "choice"}
                              onClick={() => {
                                setQuickAccessorySubType(subType);
                                setSaleGroup("Aksesuar");
                                setSaleForm({
                                  ...saleForm,
                                  type: "Aksesuar Satışı",
                                  search: `${quickAccessoryGroup} ${subType}`,
                                  productId: "",
                                  total: "",
                                  cash: "",
                                  card: "",
                                });
                              }}
                            >
                              {subType}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="close-summary accessory-pick-summary">
                      <small>SEÇİLEN AKSESUAR</small>
                      <div><span>Grup</span><b>{quickAccessoryGroup}</b></div>
                      <div><span>Alt</span><b>{quickAccessorySubType}</b></div>
                    </div>
                  </div>


                </div>
              </>
            )}

            {kasaTab === "satisListesi" && (
              <section className="card">
                <h2>Satış Listesi</h2>
                <Table headers={["No", "Grup", "Saat", "Ürün", "Müşteri", "Nakit", "Kart", "Kalan", "Kâr", "İşlem", "Sil"]} rows={sortedSales.map((sale, index) => [
                  index + 1,
                  saleGroupName(sale.type),
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
              </section>
            )}

            {kasaTab === "giderler" && (
              <section className="card">
                <h2>Giderler</h2>
                <p>Yemek, Kargo, Borç, İade ve Ivır Zıvır giderlerini buradan işle. Sadece Borç seçeneğinde Not zorunludur.</p>

                <div className="button-grid">
                  {expenseCategories.map((category) => (
                    <button
                      key={category}
                      className={expenseForm.category === category ? "choice active" : "choice"}
                      onClick={() => setExpenseForm({ ...expenseForm, category })}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="form-grid">
                  <input type="text" inputMode="numeric" placeholder="Gider tutarı" value={expenseForm.amount} onFocus={() => setExpenseForm({ ...expenseForm, amount: stripMoneyForEdit(expenseForm.amount) })} onChange={(e) => setExpenseForm({ ...expenseForm, amount: cleanMoneyTyping(e.target.value) })} onBlur={() => setExpenseForm({ ...expenseForm, amount: formatMoneyInput(expenseForm.amount) })} />
                  <input placeholder={expenseForm.category === "Borç" ? "Not zorunlu" : "Not"} value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} />
                </div>

                <button className="primary" onClick={saveExpense}>Gider Kaydet</button>

                <div className="stats three">
                  <Stat title="Toplam Gider" value={money(expenseReport.total)} />
                  <Stat title="Nakit Kasa" value={money(cashWithBankIncoming)} />
                  <Stat title="Gider Sonrası Nakit" value={money(cashAfterExpenses)} />
                </div>

                <Table headers={["Tarih", "Gider", "Tutar", "Not", "Sil"]} rows={expenses.map((item) => [
                  new Date(item.date).toLocaleString("tr-TR"),
                  item.category,
                  item.amount,
                  item.note || "-",
                  <button className="delete-btn" onClick={() => deleteExpense(item.id)}>Sil</button>,
                ])} />
              </section>
            )}

            {kasaTab === "kapanis" && (
              <CashClosingPanel />
            )}

            {kasaTab === "bankadanNakit" && (
              <section className="card">
                <h2>Bankadan Nakit Gelen</h2>
                <p>Bankadan kasaya para çekildiğinde nakit kasasına eklenir ve Kara Defter içindeki Bankadan Çekilen bölümüne otomatik işlenir.</p>

                <div className="commission-info">
                  <strong>Banka Bu Ay Bu Kadar Paranı Komisyon Olarak Aldı</strong>
                  <span>{money(monthlyPosCommission)}</span>
                  <small>Hesap: Bu ay POS’a giden paranın %3,5’i. Bu ay POS’a giden toplam: {money(monthlyPosTotal)}</small>
                </div>

                <div className="stats three">
                  <Stat title="Bankaya Toplam Giden" value={money(bankReport.totalToBank)} />
                  <Stat title="Bankadan Çekilen" value={money(bankReport.withdrawnFromBank)} />
                  <Stat title="Bankada Kalan" value={money(bankReport.remainingInBank)} />
                </div>

                <div className="form-grid">
                  <select value={bankCashForm.bank} onChange={(e) => setBankCashForm({ ...bankCashForm, bank: e.target.value })}>
                    <option value="">Banka seçmek zorunlu</option>
                    {banks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
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
            <h2>{stockForm.deviceType === "Tablet" ? "Tablet Kaydı" : "Telefon Kaydı"}</h2>
            <DeviceStockForm
              stockForm={stockForm}
              setStockForm={setStockForm}
              saveStock={saveStock}
              supplierOptions={supplierOptions}
              setSupplierModalOpen={setSupplierModalOpen}
              customAccessoryCategories={customAccessoryCategories}
              setCustomAccessoryCategories={setCustomAccessoryCategories}
            />
          </section>
        )}

        {active === "aksesuar" && (
          <section className="card">
            <h2>Aksesuar Bölümü</h2>
            <p>Aksesuar ürünlerini kategori butonlarıyla seçerek kaydet. İlk 5 ana grup değiştirilemez; istenirse arşive alınır.</p>
            <AccessoryStockForm
              stockForm={stockForm}
              setStockForm={setStockForm}
              saveStock={saveStock}
              supplierOptions={supplierOptions}
              setSupplierModalOpen={setSupplierModalOpen}
            />
          </section>
        )}

        {active === "stok" && (
          <section className="section">
            <div className="stok-subtabs">
              <button className={stockView === "cihaz" ? "choice active" : "choice"} onClick={() => setStockView("cihaz")}>Cihaz Stok Listesi</button>
              <button className={stockView === "aksesuar" ? "choice active" : "choice"} onClick={() => setStockView("aksesuar")}>Aksesuar Cihaz Listesi</button>
              <button className={stockView === "diger" ? "choice active" : "choice"} onClick={() => setStockView("diger")}>Diğerleri</button>
              <button className={stockView === "tum" ? "choice active" : "choice"} onClick={() => setStockView("tum")}>TÜM Stok</button>
              <button className={stockTab === "kayit" ? "choice active" : "choice"} onClick={() => setStockTab(stockTab === "kayit" ? "liste" : "kayit")}>Stok Kaydı</button>
            </div>

            <section className="card">
              <div className="stock-title-row">
                <h2>
                  {stockView === "cihaz" && "Cihaz Stok Listesi"}
                  {stockView === "aksesuar" && "Aksesuar Cihaz Listesi"}
                  {stockView === "diger" && "Diğerleri"}
                  {stockView === "tum" && "TÜM Stok"}
                </h2>
                <div className="stock-summary-box">
                  <span>Stok Alış Toplamı</span>
                  <b>{money(currentStockBuyTotal)}</b>
                </div>
                <div className="stock-summary-box">
                  <span>Toplam Adet</span>
                  <b>{currentStockQtyTotal}</b>
                </div>
              </div>

              <StockTable stock={currentStockList} setEditingStock={setEditingStock} deleteStock={deleteStock} />

              {stockView === "tum" && (
                <div className="grouped-stock">
                  <h3>Grup Grup Stok Özeti</h3>
                  {["Cihaz", "Aksesuar", "Diğer"].map((groupName) => {
                    const groupItems = groupName === "Diğer"
                      ? stock.filter((item) => item.module !== "Cihaz" && item.module !== "Aksesuar")
                      : stock.filter((item) => item.module === groupName);
                    return (
                      <div key={groupName} className="group-block">
                        <h4>{groupName}</h4>
                        <StockTable stock={groupItems} setEditingStock={setEditingStock} deleteStock={deleteStock} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {stockTab === "kayit" && (
              <section className="card">
                <h2>Stok Kaydı</h2>
                <div className="button-grid">
                  {["Cihaz", "Aksesuar", "Diğer"].map((module) => (
                    <button key={module} className={stockForm.module === module ? "choice active" : "choice"} onClick={() => setStockForm({ ...stockForm, module })}>{module}</button>
                  ))}
                </div>
                {stockForm.module === "Cihaz" && (
                  <DeviceStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} />
                )}
                {stockForm.module === "Aksesuar" && (
                  <AccessoryStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} customAccessoryCategories={customAccessoryCategories} setCustomAccessoryCategories={setCustomAccessoryCategories} />
                )}
                {stockForm.module === "Diğer" && (
                  <OtherStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} otherGroupName={otherGroupName} setOtherGroupName={setOtherGroupName} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} />
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
              <button className={karaTab === "borc" ? "choice active" : "choice"} onClick={() => setKaraTab("borc")}>Tedarikçi/Firma</button>
              <button className={karaTab === "banka" ? "choice active" : "choice"} onClick={() => setKaraTab("banka")}>Bankadan Alacağım</button>
              <button className={karaTab === "kar" ? "choice active" : "choice"} onClick={openProfitTab}>Kâr</button>
              <button className={karaTab === "sorgu" ? "choice active" : "choice"} onClick={() => setKaraTab("sorgu")}>Sorgula</button>
            </div>

            {karaTab === "alacak" && (
              <section className="card">
                {!selectedReceivableMovement ? (
                  <>
                    <h2>Kara Defter / Alacaklarım</h2>
                    <p>Alınan Mal adına tıklayınca o satış/ürün hareketi açılır.</p>
                    <Table headers={["İşlem", "Tarih", "Adı Soyad", "Alınan Mal", "Kalan", "Düzelt", "Sil"]} rows={alacaklarim.map((sale, index) => [
                      index + 1,
                      new Date(sale.date).toLocaleString("tr-TR"),
                      sale.cariPerson || sale.customer,
                      <button className="link-btn" onClick={() => setSelectedReceivableMovement(sale)}>{sale.productName}</button>,
                      money(sale.remaining),
                      <button className="edit-btn" onClick={() => setEditingSale({ ...sale })}><Pencil size={14} /> Düzenle</button>,
                      <button className="delete-btn" onClick={() => deleteSale(sale.id)}>Sil</button>,
                    ])} />
                  </>
                ) : (
                  <ReceivableMovementPage
                    sale={selectedReceivableMovement}
                    stock={stock}
                    setSelectedReceivableMovement={setSelectedReceivableMovement}
                  />
                )}
              </section>
            )}

            {karaTab === "borc" && (
              <section className="card">
                {!selectedSupplierAccount ? (
                  <>
                    <h2>Kara Defter / Tedarikçi/Firma</h2>
                    <p>Hesap detayını görmek için firma adına tıkla.</p>
                    <Table headers={["Tedarikçi/Firma", "Son Alınan Mal", "Alış Toplam", "Ödenen", "Şimdiki Borç", "Sil"]} rows={borclarim.map((row) => [
                      <button className="link-btn" onClick={() => setSelectedSupplierAccount(row.supplier)}>{row.supplier}</button>,
                      row.lastProduct,
                      money(row.totalBuy),
                      money(row.paid),
                      money(row.remaining),
                      <button className="delete-btn" onClick={() => deleteSupplierDebt(row.supplier)}>Sil</button>,
                    ])} />
                  </>
                ) : (
                  <SupplierAccountPage
                    supplierName={selectedSupplierAccount}
                    stock={stock}
                    setSelectedSupplierAccount={setSelectedSupplierAccount}
                  />
                )}
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

                <Table headers={["Tarih", "İşlem", "Banka/POS", "Tutar", "Not"]} rows={bankMovements.map((item) => [
                  new Date(item.date).toLocaleString("tr-TR"),
                  item.type,
                  item.bank || "-",
                  item.amount,
                  item.note || "-",
                ])} />
              </section>
            )}

            {karaTab === "kar" && (
              <section className="card">
                <h2>Kara Defter / Kâr Menüsü</h2>
                <div className="stats three">
                  <Stat title="Günün Kârı" value={money(dayProfit)} />
                  <Stat title="Ayın Kârı" value={money(monthProfit)} />
                  <Stat title="Toplam Kâr" value={money(report.profit)} />
                </div>

                <div className="form-grid">
                  <input type="date" value={profitDateFrom} onChange={(e) => setProfitDateFrom(e.target.value)} />
                  <input type="date" value={profitDateTo} onChange={(e) => setProfitDateTo(e.target.value)} />
                  <div className="remaining-input">
                    <span>Tarih Seçenekli Kâr</span>
                    <b>{money(rangeProfit)}</b>
                  </div>
                </div>

                <Table headers={["Tarih", "Ürün", "Satış", "Maliyet", "Kâr"]} rows={sales
                  .filter((sale) => {
                    const d = sale.date ? sale.date.slice(0, 10) : "";
                    if (profitDateFrom && d < profitDateFrom) return false;
                    if (profitDateTo && d > profitDateTo) return false;
                    return true;
                  })
                  .map((sale) => [
                    new Date(sale.date).toLocaleString("tr-TR"),
                    sale.productName,
                    sale.total,
                    money(sale.productBuyPrice || 0),
                    money(sale.profit || 0),
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
                <Table headers={["Grup", "Ürün", "Müşteri / Cari Kişi", "Satış", "Nakit", "Kart", "Kalan", "Düzelt", "Sil"]} rows={sortedFilteredSales.map((sale) => [
                  saleGroupName(sale.type),
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

function AccessoryStockForm({
  stockForm,
  setStockForm,
  saveStock,
  supplierOptions,
  setSupplierModalOpen,
  customAccessoryCategories = [],
  setCustomAccessoryCategories = () => {},
}) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryBox, setShowNewCategoryBox] = useState(false);
  const allAccessoryCategories = [...categories, ...customAccessoryCategories];
  const subTypes = accessoryGroups[stockForm.category] || [stockForm.category];

  function addCustomCategory() {
    const name = newCategoryName.trim().toUpperCase();
    if (!name) return alert("Yeni kategori adı yaz");
    if (customAccessoryCategories.length >= 6) return alert("En fazla 6 yeni kategori eklenebilir");
    if (allAccessoryCategories.includes(name)) return alert("Bu kategori zaten var");

    setCustomAccessoryCategories([...customAccessoryCategories, name]);
    setStockForm({
      ...stockForm,
      module: "Aksesuar",
      category: name,
      accessorySubType: name,
      name,
      archivedCategory: false,
    });
    setNewCategoryName("");
    setShowNewCategoryBox(false);
  }

  const computedProductName = [stockForm.category, stockForm.accessorySubType].filter(Boolean).join("-");

  return (
    <>
      <div className="accessory-category-panel">
        {allAccessoryCategories.map((category) => (
          <div key={category} className="accessory-category-block">
            <button
              className={stockForm.category === category ? "choice active" : "choice"}
              onClick={() => setStockForm({
                ...stockForm,
                module: "Aksesuar",
                category,
                accessorySubType: (accessoryGroups[category] || [category])[0],
                name: [category, (accessoryGroups[category] || [category])[0]].filter(Boolean).join("-"),
                archivedCategory: false,
              })}
            >
              {category}
            </button>
          </div>
        ))}

        <div className="accessory-category-block">
          <button
            className={showNewCategoryBox ? "choice active" : "choice"}
            onClick={() => setShowNewCategoryBox(!showNewCategoryBox)}
            type="button"
          >
            + Yeni Kategori Ekle
          </button>
        </div>
      </div>

      {showNewCategoryBox && (
        <div className="new-category-box">
          <div className="form-grid">
            <input placeholder="Yeni kategori adı" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            <button className="primary" onClick={addCustomCategory} type="button">Kaydet</button>
            <div className="remaining-input">
              <span>Yeni Kategori Hakkı</span>
              <b>{customAccessoryCategories.length} / 6</b>
            </div>
          </div>
        </div>
      )}

      <div className="button-grid">
        {subTypes.map((subType) => (
          <button
            key={subType}
            className={stockForm.accessorySubType === subType ? "choice active" : "choice"}
            onClick={() => setStockForm({ ...stockForm, module: "Aksesuar", accessorySubType: subType, name: [stockForm.category, subType].filter(Boolean).join("-") })}
          >
            {subType}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <select value={stockForm.supplier} onChange={(e) => {
          if (e.target.value === "__add_supplier__") {
            setSupplierModalOpen(true);
            return;
          }
          setStockForm({ ...stockForm, module: "Aksesuar", supplier: e.target.value });
        }}>
          <option value="">Tedarikçi / Firma seç</option>
          <option value="__add_supplier__">+ Tedarikçi Ekle</option>
          {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
        </select>

        <input placeholder="Barkod numarası" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", barcode: cleanBarcode(e.target.value) })} />

        <input
          placeholder="Ürünün adı"
          value={stockForm.name || computedProductName}
          onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", name: e.target.value })}
        />

        <input type="text" inputMode="numeric" placeholder="Kaça aldın" value={stockForm.buy} onFocus={() => setStockForm({ ...stockForm, buy: stripMoneyForEdit(stockForm.buy) })} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", buy: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, buy: formatMoneyInput(stockForm.buy) })} />
        <input type="text" inputMode="numeric" placeholder="Kaça satacaksın" value={stockForm.sell} onFocus={() => setStockForm({ ...stockForm, sell: stripMoneyForEdit(stockForm.sell) })} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", sell: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, sell: formatMoneyInput(stockForm.sell) })} />
        <input type="number" placeholder="Kaç Adet aldın" value={stockForm.qty} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", qty: e.target.value })} />
        <div className="remaining-input">
          <span>Toplam Aldığın</span>
          <b>{money(parseMoneyInput(stockForm.buy) * Number(stockForm.qty || 0))}</b>
        </div>
        <input type="text" inputMode="numeric" placeholder="Ödenen" value={stockForm.supplierPaid} onFocus={() => setStockForm({ ...stockForm, supplierPaid: stripMoneyForEdit(stockForm.supplierPaid) })} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", supplierPaid: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, supplierPaid: formatMoneyInput(stockForm.supplierPaid) })} />
        <input placeholder="Ürün Bilgisi" value={stockForm.compatibleModel} onChange={(e) => setStockForm({ ...stockForm, module: "Aksesuar", compatibleModel: e.target.value })} />
      </div>

      <button className="primary" onClick={() => saveStock("Aksesuar")}><Plus size={16} /> Aksesuarı Stoka Kaydet</button>
    </>
  );
}


function OtherStockForm({ stockForm, setStockForm, saveStock, otherGroupName, setOtherGroupName, supplierOptions, setSupplierModalOpen }) {
  return (
    <>
      <div className="form-grid">
        <input placeholder="Grup adı" value={otherGroupName} onChange={(e) => {
          setOtherGroupName(e.target.value);
          setStockForm({ ...stockForm, module: "Diğer", deviceType: e.target.value || "Diğer" });
        }} />
        <input placeholder="Ürün adı" value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", name: e.target.value })} />
        <input placeholder="Barkod numarası" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", barcode: cleanBarcode(e.target.value) })} />
        <select value={stockForm.supplier} onChange={(e) => {
          if (e.target.value === "__add_supplier__") {
            setSupplierModalOpen(true);
            return;
          }
          setStockForm({ ...stockForm, module: "Diğer", supplier: e.target.value });
        }}>
          <option value="">Tedarikçi / Firma seç</option>
          <option value="__add_supplier__">+ Tedarikçi Ekle</option>
          {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
        </select>
        <input type="text" inputMode="numeric" placeholder="Kaça aldın" value={stockForm.buy} onFocus={() => setStockForm({ ...stockForm, buy: stripMoneyForEdit(stockForm.buy) })} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", buy: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, buy: formatMoneyInput(stockForm.buy) })} />
        <input type="text" inputMode="numeric" placeholder="Kaça satacaksın" value={stockForm.sell} onFocus={() => setStockForm({ ...stockForm, sell: stripMoneyForEdit(stockForm.sell) })} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", sell: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, sell: formatMoneyInput(stockForm.sell) })} />
        <input type="number" placeholder="Kaç Adet aldın" value={stockForm.qty} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", qty: e.target.value })} />
        <div className="remaining-input">
          <span>Toplam Aldığın</span>
          <b>{money(parseMoneyInput(stockForm.buy) * Number(stockForm.qty || 0))}</b>
        </div>
        <input type="text" inputMode="numeric" placeholder="Ödenen" value={stockForm.supplierPaid} onFocus={() => setStockForm({ ...stockForm, supplierPaid: stripMoneyForEdit(stockForm.supplierPaid) })} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", supplierPaid: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, supplierPaid: formatMoneyInput(stockForm.supplierPaid) })} />
      </div>

      <button className="primary" onClick={() => saveStock("Diğer")}><Plus size={16} /> Diğer Ürünü Stoka Kaydet</button>
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
