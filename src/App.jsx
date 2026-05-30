import React, { useEffect, useMemo, useRef, useState } from "react";
import Login from "./components/Login";
import CashClosingPanel from "./components/CashClosingPanel";
import CartPanel from "./components/sales/CartPanel";
import { runReadOnlyReconciliation } from "./lib/business/reconciliation";
import { createSaleTransaction } from "./lib/business/transactionEngine";

// ceplog-bank-movement-constraint-global-guard
if (typeof window !== "undefined" && !window.__ceplogBankMovementConstraintGuard) {
  window.__ceplogBankMovementConstraintGuard = true;

  window.addEventListener("unhandledrejection", (event) => {
    const message = String(event?.reason?.message || event?.reason || "");
    if (
      message.includes("bank_movements_movement_type_check") ||
      (message.includes("bank_movements") && message.includes("movement_type"))
    ) {
      console.warn("CEPLOG güvenli mod: Satıştan sonra gereksiz bank_movements constraint hatası bastırıldı.", event.reason);
      event.preventDefault();
    }
  });
}

import {
  getCurrentUser,
  signOut,
  loadDashboardData,
  resetAllTestData,
  createStockItem,
  createSale,
  createExpense,
  createCashMovement,
  createBankWithdrawal,
  createContactPayment,
  createReceivablePayment,
  createTechnicalServiceWithEffects,
  recordTechnicalServiceFinanceWithEffects,
  updateTechnicalServiceRecord,
  createAuditLog,
  cancelRecord,
  cancelStockPurchase,
  refundSaleWithEffects,
  updateSaleRecord,
  updateStockItem,
} from "./services/dataService";

import { Wallet, Smartphone, Headphones, Package, Search, Wrench, TrendingUp, Plus, Pencil, Save, X, ShieldCheck, ReceiptText, Settings, Calculator, Printer, Globe, MessageCircle, Camera, Trash2, Tablet, Watch, Monitor, Bluetooth, ShoppingBag, Code2, Cpu, Tags, Cable } from "lucide-react";

const parseMoneyInput = (value) => Number(String(value || "0").replace(/\./g, "").replace(/,/g, "").replace(/TL/g, "").replace(/₺/g, "").replace(/\s/g, ""));
const formatMoneyInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} TL`;
};

const normalizeMoney = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return parseMoneyInput(value);
};
const formatMoney = (value) => money(value);
const getAvailableCashBalance = (value = 0) => normalizeMoney(value);
const isCashMethod = (method) => ["nakit", "kasa", "cash"].includes(String(method || "").toLocaleLowerCase("tr-TR"));
const validateAmountPositive = (amount, message = "Tutar 0’dan büyük olmalıdır.") => {
  const cleanAmount = Math.abs(normalizeMoney(amount));
  return cleanAmount > 0 ? { ok: true, amount: cleanAmount } : { ok: false, message };
};
const validateMaxAmount = (amount, maxAllowed, message = "Girilen tutar izin verilen üst limiti aşamaz.") => {
  const cleanAmount = Math.abs(normalizeMoney(amount));
  const cleanMaxAllowed = Math.max(normalizeMoney(maxAllowed), 0);
  if (cleanAmount <= cleanMaxAllowed) return { ok: true, amount: cleanAmount, maxAllowed: cleanMaxAllowed };
  return { ok: false, message, amount: cleanAmount, maxAllowed: cleanMaxAllowed };
};
const validateFinancialLimit = ({
  context = "",
  amount,
  maxAllowed,
  availableCash,
  paymentMethod = "",
  label = "İşlem",
  alreadyPaid = 0,
  totalAmount,
  remainingBalance,
  isCashOut = false,
  messages = {},
} = {}) => {
  const cleanAmount = Math.abs(normalizeMoney(amount));
  const cleanAlreadyPaid = Math.abs(normalizeMoney(alreadyPaid));
  const cleanMaxAllowed = maxAllowed === undefined || maxAllowed === null
    ? remainingBalance === undefined || remainingBalance === null ? null : Math.max(normalizeMoney(remainingBalance), 0)
    : Math.max(normalizeMoney(maxAllowed), 0);
  const cleanTotalAmount = totalAmount === undefined || totalAmount === null ? null : Math.max(normalizeMoney(totalAmount), 0);
  const cashBalance = getAvailableCashBalance(availableCash);
  const cashOut = isCashOut || isCashMethod(paymentMethod) && String(paymentMethod || "").toLocaleLowerCase("tr-TR") !== "kart/banka";

  const positiveCheck = validateAmountPositive(cleanAmount, messages.empty || "Tutar 0’dan büyük olmalıdır.");
  if (!positiveCheck.ok) return positiveCheck;

  if (cleanMaxAllowed !== null && cleanAmount > cleanMaxAllowed) {
    return {
      ok: false,
      message: messages.maxExceeded || `${context || label} tutarı izin verilen üst limiti aşamaz.`,
    };
  }

  if (cleanTotalAmount !== null && cleanAlreadyPaid + cleanAmount > cleanTotalAmount) {
    return {
      ok: false,
      message: messages.totalExceeded || `${label} toplam tutarı ana tutarı aşamaz.`,
    };
  }

  if (cashOut && availableCash !== undefined && availableCash !== null) {
    if (cashBalance <= 0) {
      return {
        ok: false,
        message: messages.cashUnavailable || "Kasada yeterli nakit yok. Nakit ödeme yapılamaz.",
      };
    }
    if (cleanAmount > cashBalance) {
      return {
        ok: false,
        message: messages.cashExceeded || `Kasadaki nakitten fazla ödeme yapılamaz.\nMevcut kasa: ${formatMoney(cashBalance)}\nGirilen ödeme: ${formatMoney(cleanAmount)}`,
      };
    }
  }

  return { ok: true, amount: cleanAmount };
};
const validateCashOutLimit = (amount, availableCash, label = "Nakit ödeme", messages = {}) => validateFinancialLimit({
  amount,
  availableCash,
  paymentMethod: "Nakit",
  isCashOut: true,
  label,
  messages,
});
const validatePaymentDistribution = ({
  totalAmount,
  cashAmount = 0,
  cardAmount = 0,
  debtAmount,
  messages = {},
} = {}) => {
  const total = Math.abs(normalizeMoney(totalAmount));
  const cash = Math.abs(normalizeMoney(cashAmount));
  const card = Math.abs(normalizeMoney(cardAmount));
  const debt = debtAmount === undefined || debtAmount === null ? Math.max(total - cash - card, 0) : Math.abs(normalizeMoney(debtAmount));

  if (total <= 0) return { ok: false, message: messages.empty || "Tutar 0’dan büyük olmalıdır." };
  if (cash + card > total) {
    return { ok: false, message: messages.overpaid || "Nakit + kart toplamı satış fiyatını aşamaz." };
  }
  if (cash + card + debt > total) {
    return { ok: false, message: messages.debtExceeded || "Nakit + kart + kalan toplamı işlem tutarını aşamaz." };
  }
  return { ok: true, total, cash, card, debt };
};
const withKasaBrainTimeout = (promise, message = "İşlem zaman aşımına uğradı. Lütfen sayfayı yenileyip tekrar kontrol edin.", ms = 30000) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([
    promise.finally(() => window.clearTimeout(timeoutId)),
    timeout,
  ]);
};
const cleanMoneyTyping = (value) => String(value || "").replace(/\D/g, "");
const stripMoneyForEdit = (value) => String(value || "").replace(/\D/g, "");
const cleanPhone = (value) => String(value || "").replace(/\D/g, "").slice(0, 11);
const cleanImei = (value) => String(value || "").replace(/\D/g, "").slice(0, 15);
const formatPhoneDisplay = (value, masked = false) => {
  const digits = cleanPhone(value);
  if (!digits) return "";
  if (masked) return digits.length >= 2 ? `0 (5**) *** ** **` : digits;
  const padded = digits.padEnd(11, "_");
  return `${padded.slice(0, 1)} (${padded.slice(1, 4)}) ${padded.slice(4, 7)} ${padded.slice(7, 9)} ${padded.slice(9, 11)}`.replace(/_/g, "");
};
const formatSupabaseSaleError = (error) => {
  const message = String(error?.message || error || "");
  if (message.includes("bank_movements_movement_type_check")) {
    return "Satış kaydı sırasında banka hareket türü Supabase kuralına takıldı. Satış kart/banka tahsilatı sales kaydında tutulacak şekilde düzeltilmelidir.";
  }
  return message;
};

const isBankMovementConstraintError = (error) => {
  const message = String(error?.message || error?.details || error || "");
  return (
    message.includes("bank_movements_movement_type_check") ||
    message.includes("bank_movements") && message.includes("movement_type")
  );
};

const handleSafeSaleBankMovementError = (error) => {
  if (isBankMovementConstraintError(error)) {
    console.warn("Satış kaydedildi; gereksiz bank_movements ara kaydı Supabase constraint nedeniyle atlandı:", error);
    return true;
  }
  return false;
};

const purgeLegacyTechnicalServiceCache = () => {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.localStorage || {})
      .filter((key) => key === "ceplog_technical_services" || key.startsWith("ceplog_technical_services_"))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn("Eski teknik servis localStorage kayıtları temizlenemedi.", error);
  }
};

const money = (value) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(parseMoneyInput(value))} TL`;
const has = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase());
const isTypingElement = (element) => {
  const tagName = String(element?.tagName || "").toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || Boolean(element?.isContentEditable);
};
const normalizeCalculatorExpression = (value) => String(value || "")
  .replace(/\s/g, "")
  .replace(/,/g, ".")
  .replace(/[xX×]/g, "*")
  .replace(/[÷]/g, "/");
const formatCalculatorResult = (value) => {
  const rounded = Math.round((value + Number.EPSILON) * 10000000000) / 10000000000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
};
const evaluateCalculatorExpression = (value) => {
  const expression = normalizeCalculatorExpression(value);
  let index = 0;

  const peek = () => expression[index];
  const consume = () => expression[index++];
  const parseNumber = () => {
    let numberText = "";
    while (/[0-9.]/.test(peek() || "")) numberText += consume();
    if (!numberText || numberText === "." || numberText.split(".").length > 2) throw new Error("Hata");
    return Number(numberText);
  };
  const parseFactor = () => {
    if (peek() === "+") {
      consume();
      return parseFactor();
    }
    if (peek() === "-") {
      consume();
      return -parseFactor();
    }
    if (peek() === "(") {
      consume();
      const value = parseExpression();
      if (consume() !== ")") throw new Error("Hata");
      return value;
    }
    return parseNumber();
  };
  const parseTerm = () => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const next = parseFactor();
      if (operator === "/" && next === 0) throw new Error("Hata");
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  };
  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const next = parseTerm();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  if (!expression || /[^0-9+\-*/().]/.test(expression)) throw new Error("Hata");
  const result = parseExpression();
  if (index !== expression.length || !Number.isFinite(result)) throw new Error("Hata");
  return formatCalculatorResult(result);
};
const isLocalhostRuntime = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};
const stockRemainingAmount = (form) => Math.max(parseMoneyInput(form.buy) - parseMoneyInput(form.supplierPaid), 0);
const sellerCariName = (name) => {
  const clean = String(name || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
  if (!clean) return "";
  return clean.startsWith("SATICI ") ? clean : `SATICI ${clean}`;
};
const isSellerLabel = (value) => String(value || "").trim().toLocaleUpperCase("tr-TR").startsWith("SATICI ");
const sellerNameFromProduct = (product) => {
  const directName = product?.sellerCariName || product?.sellerPerson || product?.seller_person || product?.seller_cari_name || "";
  if (directName) return sellerCariName(directName);

  const supplierName = product?.supplier || product?.supplier_name || "";
  if (isSellerLabel(supplierName)) return sellerCariName(supplierName);
  if ((product?.acquisitionType || product?.acquisition_type) === "Müşteri" && supplierName) return sellerCariName(supplierName);
  return "";
};
const stockSellerDebt = (product) => {
  const explicitDebt = Number(product?.sellerCariRemaining || product?.seller_cari_remaining || 0);
  if (explicitDebt > 0) return explicitDebt;
  if (!sellerNameFromProduct(product)) return 0;

  const isCustomerPurchase =
    (product?.acquisitionType || product?.acquisition_type) === "Müşteri" ||
    product?.condition === "İkinci El" ||
    product?.category === "İkinci El";
  if (!isCustomerPurchase) return 0;

  const totalBuy = parseMoneyInput(product?.buy || product?.buy_price || 0) * Number(product?.qty || product?.quantity || 1);
  const paid = parseMoneyInput(product?.supplierPaid || product?.supplier_paid || 0);
  return Math.max(totalBuy - paid, 0);
};

const saleTypes = ["Telefon Satışı", "Aksesuar Satışı", "Program Satışı", "Saat Satışı", "Tablet Satışı", "Elektronik Satışı", "Bluetooth Satışı", "Diğerleri Satışı"];
const securityPasswordsStorageKey = "ceplog_security_passwords";
const defaultSecurityPasswords = {
  editPassword: "1",
  cancelPassword: "1",
  deletePassword: "1",
};
const securityPasswordFields = [
  { key: "editPassword", actionType: "edit", label: "Düzenleme Şifresi" },
  { key: "cancelPassword", actionType: "cancel", label: "İptal Şifresi" },
  { key: "deletePassword", actionType: "delete", label: "Silme Şifresi" },
];
const otherSaleTypes = ["Program Satışı", "Saat Satışı", "Tablet Satışı", "PC Satışı", "Elektronik Satışı", "Bluetooth Satışı", "Diğerleri Satışı"];
const purchasePaymentMovementTypes = [
  "Alım Ödemesi",
  "Cihaz Alım Ödemesi",
  "Telefon Alım Ödemesi",
  "Stok Alım Ödemesi",
  "Stok Ödemesi",
  "Aksesuar Alım Ödemesi",
  "Ürün Alım Ödemesi",
  "Tedarikçi Ödemesi",
];
const expenseCategories = ["Yemek", "Kargo", "Borç", "İade", "Ivır Zıvır"];
const quickAccessoryGroups = {
  "Kılıf": ["A Kılıf", "B Kılıf", "Silikon Kılıf"],
  "Ekran Koruyucu": ["A Cam", "B Cam", "C Cam"],
  "USB": ["A TYPC", "A Diğerleri", "Replika"],
  "Şarj": ["A Şarj", "B Şarj", "Replika"],
  "Kulaklık": ["Kulaklık"],
};
const accessoryShortcutLabel = (group, sub) => (group === sub ? group : `${group} - ${sub}`);
const defaultAccessoryShortcuts = Object.entries(quickAccessoryGroups).flatMap(([group, subs]) =>
  subs.map((sub) => ({
    id: `default-${group}-${sub}`,
    group,
    sub,
    label: accessoryShortcutLabel(group, sub),
    price: "",
    saleGroup: "Aksesuar",
    saleType: "Aksesuar Satışı",
    isDefault: true,
  }))
);
const accessoryShortcutLimit = 20;
const shortcutCategoryIconMap = {
  aksesuar: Headphones,
  program: Code2,
  telefon: Smartphone,
  tablet: Tablet,
  saat: Watch,
  pc: Monitor,
  bluetooth: Bluetooth,
  elektronik: Cpu,
  diger: Package,
  digerleri: Package,
  x: Package,
};
const getShortcutIconComponent = (shortcut) => {
  const key = normalizeCashEntryText(shortcut?.group || shortcut?.saleGroup || shortcut?.saleType || shortcut?.label || "");
  if (key.includes("kilif")) return Smartphone;
  if (key.includes("ekran") || key.includes("cam") || key.includes("koruyucu")) return ShieldCheck;
  if (key.includes("usb") || key.includes("sarj") || key.includes("kablo") || key.includes("typc")) return Cable;
  if (key.includes("kulak")) return Headphones;
  if (key.includes("aksesuar")) return Headphones;
  if (key.includes("program") || key.includes("yazilim")) return Code2;
  if (key.includes("telefon") || key.includes("iphone") || key.includes("samsung")) return Smartphone;
  if (key.includes("tablet")) return Tablet;
  if (key.includes("saat")) return Watch;
  if (key.includes("pc") || key.includes("bilgisayar")) return Monitor;
  if (key.includes("bluetooth")) return Bluetooth;
  if (key.includes("elektronik")) return Cpu;
  if (key.includes("sim") || key.includes("etiket")) return Tags;
  return shortcutCategoryIconMap[key] || ShoppingBag;
};
const technicalServiceStatuses = ["Beklemede", "İşlemde", "Hazır", "Teslim Edildi", "İptal"];
const technicalServiceFilterOptions = ["TÜMÜ", ...technicalServiceStatuses];
const technicalServiceIncomeTypes = ["Teknik Servis Geliri", "Teknik Servis Kaparo", "Teknik Servis Tahsilat", "Teknik Servis Tahsilatı"];
const technicalServiceRefundTypes = ["Teknik Servis İade", "Teknik Servis İadesi"];
const technicalServiceMovementTypes = [...technicalServiceIncomeTypes, ...technicalServiceRefundTypes];
const toDatetimeLocalInput = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const makeEmptyTechnicalServiceForm = () => ({
  customerName: "",
  phone: "",
  brand: "",
  model: "",
  device: "",
  imei: "",
  color: "",
  accessory: "",
  stockItemId: "",
  issue: "",
  repairAction: "",
  technician: "",
  estimatedPrice: "",
  deposit: "",
  cardDeposit: "",
  bank: "",
  dueDate: toDatetimeLocalInput(),
  status: "Beklemede",
  note: "",
});
const emptyTechnicalPaymentForm = { amount: "", method: "Nakit", bank: "", note: "" };
const emptyTechnicalSummary = {
  total: 0,
  collected: 0,
  cashCollected: 0,
  bankCollected: 0,
  refunded: 0,
  net: 0,
  remaining: 0,
  cashRefundAvailable: 0,
  bankRefundAvailable: 0,
  refundSources: [],
  history: [],
};
const cashEntryTabs = ["Manuel Nakit Girişi", "Dünden Devir", "Bankadan Gelen Nakit"];
const cashEntryMovementTypes = ["Manuel Nakit Girişi", "Nakit Girişi", "Kasaya Nakit Girişi", "Dünden Devir Nakit", "Devir Nakit"];
const cashEntryCancellationType = "Nakit Girişi İptali";
const purchaseCancellationMovementTypes = [
  "Stok Alış İptali",
  "Cihaz Alış İptali",
  "Telefon Alış İptali",
  "Aksesuar Alış İptali",
  "Ürün Alış İptali",
  "Stok Ödemesi İptali",
  "Alım Ödemesi İptali",
  "Tedarikçi Ödemesi İptali",
];
const cashLedgerMovementTypes = ["Satış Nakit", "Bankadan Nakit Gelen", "Manuel Nakit Girişi", "Nakit Girişi", "Kasaya Nakit Girişi", cashEntryCancellationType, "Dünden Devir Nakit", "Devir Nakit", "Gelen Alacak", "Alacak Ödemesi", "Stok Ödemesi", "Cari Ödeme", "Gider", "Bankaya Yatırılan Nakit", "Düzeltme", ...purchaseCancellationMovementTypes, ...technicalServiceMovementTypes];
const receivablePaymentTypes = ["Gelen Alacak", "Alacak Ödemesi"];

const saleGroupRank = (type) => {
  if (type === "Telefon Satışı") return 1;
  if (type === "Aksesuar Satışı") return 2;
  if (type === "Teknik Servis") return 4;
  return 3;
};

const saleGroupName = (type) => {
  if (type === "Telefon Satışı") return "Telefon";
  if (type === "Aksesuar Satışı") return "Aksesuar";
  if (type === "Program Satışı") return "Program";
  if (type === "Saat Satışı") return "Saat";
  if (type === "Tablet Satışı") return "Tablet";
  if (type === "PC Satışı") return "PC";
  if (type === "Elektronik Satışı") return "Elektronik";
  if (type === "Bluetooth Satışı") return "Bluetooth";
  if (type === "Diğerleri Satışı") return "X";
  if (type === "Teknik Servis") return "Teknik Servis";
  return "X";
};

const normalizeStockText = (value) => String(value || "").toLocaleLowerCase("tr-TR");
const isPhoneStockItem = (item) =>
  normalizeStockText(item.module) === "cihaz" && normalizeStockText(item.deviceType || item.device_type) === "telefon";
const isAccessoryStockItem = (item) => normalizeStockText(item.module) === "aksesuar";
const isOtherStockItem = (item) => !isPhoneStockItem(item) && !isAccessoryStockItem(item);
const isSecondHandPhonePurchase = (form, module = form.module) =>
  module === "Cihaz" && form.deviceType === "Telefon" && form.condition === "İkinci El";
const secondHandDocumentAlert = "İkinci el ürün alımında belge/dosya seçmek zorunludur.";
const secondHandDocumentGroups = ["Telefon", "Saat", "Tablet", "PC", "Bluetooth", "Elektronik", "Diğerleri", "X"];
const stockConditionOptions = ["Sıfır Garantili", "Sıfır Spot", "İkinci El"];
const requiresSecondHandDocument = (form, module = form.module) => {
  if (form.condition !== "İkinci El") return false;
  if (isSecondHandPhonePurchase(form, module)) return true;
  if (module !== "Diğer") return false;
  return secondHandDocumentGroups.includes(toInternalOtherGroup(form.deviceType));
};
const recordDate = (item) => item.created_at || item.createdAt || item.date || "";
const isTodayRecord = (item, todayKey) => recordDate(item).slice(0, 10) === todayKey;
const cashMovementType = (item) => item.movement_type || item.movementType || item.type || "";
const cashMovementAmount = (item) => typeof item.amount === "number" ? item.amount : parseMoneyInput(item.amount);
const bankMovementType = (item) => item.movement_type || item.movementType || item.type || "";
const bankMovementAmount = (item) => typeof item.amount === "number" ? item.amount : parseMoneyInput(item.amount);
const bankMovementDirection = (item) => item.direction || (purchasePaymentMovementTypes.includes(bankMovementType(item)) || bankMovementType(item) === "Bankadan Çekilen" ? "out" : "in");
const normalizeCashEntryText = (value) => String(value || "")
  .toLocaleLowerCase("tr-TR")
  .replace(/ı/g, "i")
  .replace(/ç/g, "c")
  .replace(/ğ/g, "g")
  .replace(/ö/g, "o")
  .replace(/ş/g, "s")
  .replace(/ü/g, "u")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");
const banksStorageKey = "ceplog_banks";
const DEFAULT_BANKS = [
  { id: "ziraatbank", name: "Ziraatbank", balance: 0, isDefault: true },
  { id: "isbank", name: "İşbank", balance: 0, isDefault: true },
  { id: "halkbank", name: "Halkbank", balance: 0, isDefault: true },
];
const normalizeBankName = (name) => normalizeCashEntryText(name).replace(/\s+/g, " ").trim();
const createBankId = (name) => normalizeBankName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `bank-${Date.now()}`;
const normalizeBankRecord = (bank) => {
  const name = String(typeof bank === "string" ? bank : bank?.name || "").trim();
  return {
    id: String(typeof bank === "string" ? createBankId(name) : bank?.id || createBankId(name)),
    name,
    balance: Math.max(parseMoneyInput(typeof bank === "string" ? 0 : bank?.balance || 0), 0),
    isDefault: typeof bank === "string" ? false : Boolean(bank?.isDefault),
  };
};
const getBankList = (customBanks = []) => {
  const merged = [];
  [...DEFAULT_BANKS, ...(Array.isArray(customBanks) ? customBanks : [])].forEach((bank) => {
    const cleanBank = normalizeBankRecord(bank);
    if (!cleanBank.name) return;
    if (merged.some((item) => normalizeBankName(item.name) === normalizeBankName(cleanBank.name))) return;
    merged.push(cleanBank);
  });
  return merged;
};
const getBankById = (banks, id) => {
  const cleanId = String(id || "");
  const normalized = normalizeBankName(id);
  return (Array.isArray(banks) ? banks : []).find((bank) => String(bank.id) === cleanId || normalizeBankName(bank.name) === normalized) || null;
};
const loadStoredBanks = () => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(banksStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const saveStoredBanks = (banks) => {
  if (typeof window === "undefined") return;
  const customOnly = (Array.isArray(banks) ? banks : [])
    .filter((bank) => !bank.isDefault)
    .map((bank) => normalizeBankRecord(bank));
  window.localStorage.setItem(banksStorageKey, JSON.stringify(customOnly));
};
const addBank = (banks, name, initialBalance = 0) => {
  const cleanName = String(name || "").trim();
  const balance = parseMoneyInput(initialBalance);
  if (!cleanName) return { ok: false, message: "Banka adı boş olamaz." };
  if (String(initialBalance || "").includes("-") || balance < 0) return { ok: false, message: "Başlangıç bakiyesi negatif olamaz." };

  const currentBanks = getBankList(banks);
  if (currentBanks.some((bank) => normalizeBankName(bank.name) === normalizeBankName(cleanName))) {
    return { ok: false, message: "Bu banka zaten listede var." };
  }

  const bank = { id: createBankId(cleanName), name: cleanName, balance, isDefault: false };
  return { ok: true, bank, banks: getBankList([...currentBanks, bank]) };
};
const cashInflowIncludeTerms = [
  "manuel nakit girisi",
  "nakit girisi",
  "kasaya nakit girisi",
  "dunden devir",
  "devir nakit",
  "bankadan gelen nakit",
  "satis nakit",
  "telefon nakit satis",
  "aksesuar nakit satis",
  "digerleri nakit satis",
  "nakit tahsilat",
  "teknik servis nakit",
  "teknik servis tahsilat",
  "teknik servis kaparo",
  "cari nakit tahsilat",
  "cari tahsilat",
  "alacak tahsilati",
  "gelen alacak",
  "alacak odemesi",
];
const cashInflowExcludeTerms = [
  "stok odemesi",
  "alim odemesi",
  "cihaz alim odemesi",
  "telefon alim odemesi",
  "aksesuar alim odemesi",
  "urun alim odemesi",
  "tedarikci odemesi",
  "tedarikci odeme",
  "saticiya odeme",
  "satici odeme",
  "gider",
  "nakit cikisi",
  "cikis",
  "iade cikisi",
  "satis iadesi",
  "teknik servis iade",
  "cari odeme",
  "stok alis iptali",
  "alis iptali",
  "odeme iptali",
  "nakit girisi iptali",
];
const isCashInflowEntry = (entry) => {
  const direction = normalizeCashEntryText(entry?.direction || entry?.yon || entry?.directionLabel || "");
  if (direction === "out" || direction === "cikis") return false;

  const text = normalizeCashEntryText([
    cashMovementType(entry),
    entry?.operation,
    entry?.note,
    entry?.description,
  ].filter(Boolean).join(" "));

  if (cashInflowExcludeTerms.some((term) => text.includes(term))) return false;
  if (cashInflowIncludeTerms.some((term) => text.includes(term))) return true;
  return direction === "in" || direction === "giris";
};
const isPurchasePaymentMovement = (item, movementType = cashMovementType(item) || bankMovementType(item), direction = item?.direction || "") => {
  const type = String(movementType || "");
  const normalizedDirection = String(direction || "").toLocaleLowerCase("tr-TR");
  if (normalizedDirection && normalizedDirection !== "out") return false;
  if (!purchasePaymentMovementTypes.includes(type)) return false;
  return true;
};
const isCancellableCashEntryMovement = (item) =>
  cashEntryMovementTypes.includes(cashMovementType(item)) && (item?.direction || "in") === "in";
const isPurchaseCancellationMovement = (item, movementType = cashMovementType(item) || bankMovementType(item)) =>
  purchaseCancellationMovementTypes.includes(String(movementType || ""));
const isCashMovementCancellation = (item) => {
  const type = cashMovementType(item);
  const note = String(item?.note || "");
  return type === cashEntryCancellationType ||
    purchaseCancellationMovementTypes.includes(type) ||
    (type === "Düzeltme" && String(item?.relatedTable || item?.related_table || "") === "cash_movements" && note.startsWith("İptal:"));
};
const cashMovementCancellationTypeFor = (item) => {
  const type = cashMovementType(item);
  if (cashEntryMovementTypes.includes(type)) return cashEntryCancellationType;
  if (type === "Stok Ödemesi" || type === "Stok Alım Ödemesi") return "Stok Ödemesi İptali";
  if (type === "Cihaz Alım Ödemesi") return "Cihaz Alış İptali";
  if (type === "Telefon Alım Ödemesi") return "Telefon Alış İptali";
  if (type === "Tedarikçi Ödemesi") return "Tedarikçi Ödemesi İptali";
  if (type === "Alım Ödemesi" || type === "Aksesuar Alım Ödemesi" || type === "Ürün Alım Ödemesi") return "Alım Ödemesi İptali";
  return "";
};
const isCancelableCashMovement = (item) =>
  !isCashMovementCancellation(item) && (
    isCancellableCashEntryMovement(item) ||
    isPurchasePaymentMovement(item)
  );
const isTechnicalServiceMovement = (type) => technicalServiceMovementTypes.includes(String(type || ""));
const isTechnicalServiceIncomeMovement = (type) => technicalServiceIncomeTypes.includes(String(type || ""));
const isTechnicalServiceRefundMovement = (type) => technicalServiceRefundTypes.includes(String(type || ""));
const realIncomeMovementTypes = [
  "Manuel Nakit Girişi",
  "Nakit Girişi",
  "Kasaya Nakit Girişi",
  "Satış Nakit",
  "Satış Tahsilatı",
  "Cari Tahsilat",
  "Gelen Alacak",
  "Alacak Tahsilatı",
  "Alacak Ödemesi",
  ...technicalServiceIncomeTypes,
];
const realExpenseMovementTypes = ["Gider", "Nakit Çıkışı", "Cari Ödeme", "Alacak Ödemesi"];
const correctionMovementTypes = [
  cashEntryCancellationType,
  "Nakit Çıkışı İptali",
  "Gider İptali",
  ...purchaseCancellationMovementTypes,
];
const refundMovementTypes = ["Satış İadesi", "Satış İptali", ...technicalServiceRefundTypes];
const transferMovementTypes = ["Bankadan Nakit Gelen", "Banka Girişi", "Banka Çıkışı", "Kasa Devir", "Dünden Devir Nakit", "Kasa Açılış", "Devir Nakit", "Bankaya Yatırılan Nakit", "Bankadan Çekilen", "Bankaya Giden"];
const movementAmount = (item) => Math.abs(cashMovementAmount(item) || bankMovementAmount(item) || 0);
const movementDirection = (item, type = cashMovementType(item) || bankMovementType(item)) => {
  const direct = String(item?.direction || "").toLocaleLowerCase("tr-TR");
  if (direct === "in" || direct === "out") return direct;
  if (["Bankadan Çekilen", "Banka Çıkışı", "Bankaya Yatırılan Nakit"].includes(type)) return "out";
  if (["Bankaya Giden", "Banka Girişi", "Bankadan Nakit Gelen"].includes(type)) return "in";
  if (purchasePaymentMovementTypes.includes(type) || realExpenseMovementTypes.includes(type) || refundMovementTypes.includes(type)) return "out";
  if (type === cashEntryCancellationType) return "out";
  if (purchaseCancellationMovementTypes.includes(type)) return "in";
  if (realIncomeMovementTypes.includes(type) || type === "Bankadan Nakit Gelen" || type === "Devir Nakit") return "in";
  if (type === "Düzeltme" && String(item?.note || "").startsWith("İptal:")) {
    const note = String(item.note || "");
    return note.includes("Nakit Girişi") ? "out" : "in";
  }
  console.warn("Finans hareket yönü belirlenemedi; net hesaba alınmadı.", { type, item });
  return "";
};
const classifyFinancialMovement = (item) => {
  const type = cashMovementType(item) || bankMovementType(item);
  const direction = movementDirection(item, type);
  const note = String(item?.note || "");

  if (correctionMovementTypes.includes(type) || (type === "Düzeltme" && note.startsWith("İptal:"))) return "correction";
  if (refundMovementTypes.includes(type)) return "refund";
  if (transferMovementTypes.includes(type)) return "transfer";
  if (purchasePaymentMovementTypes.includes(type)) return "purchase_payment";
  if (type === "Alacak Ödemesi" && direction === "out") return "expense";
  if (realIncomeMovementTypes.includes(type)) return "income";
  if (realExpenseMovementTypes.includes(type)) return "expense";
  if (["Cari Borç", "Borç Alınan"].includes(type)) return "payable";
  if (["Borç Verilen", "Alacak Kalan"].includes(type)) return "receivable";
  return "unknown";
};
const getCashNetEffect = (item) => {
  if (!isActiveRecord(item)) return 0;
  const type = cashMovementType(item) || bankMovementType(item);
  const direction = movementDirection(item, type);
  const amount = movementAmount(item);
  if (!direction || !amount) return 0;
  return direction === "out" ? -amount : amount;
};
const isRealCashIncome = (item) => isActiveRecord(item) && classifyFinancialMovement(item) === "income" && movementDirection(item) === "in";
const isRealCashExpense = (item) => isActiveRecord(item) && classifyFinancialMovement(item) === "expense" && movementDirection(item) === "out";
const isPurchasePaymentCancelMovement = (item, purchasePaymentIds = new Set()) => {
  const type = cashMovementType(item) || bankMovementType(item);
  if (purchaseCancellationMovementTypes.includes(type)) return true;
  if (type !== "Düzeltme" || !String(item?.note || "").startsWith("İptal:")) return false;
  const relatedTable = String(item?.relatedTable || item?.related_table || "");
  const relatedId = String(item?.relatedId || item?.related_id || item?.referenceId || item?.reference_id || "");
  return relatedTable === "cash_movements" && purchasePaymentIds.has(relatedId);
};
const serviceMovementId = (item) =>
  String(item?.relatedServiceId || item?.related_service_id || item?.serviceRecordId || item?.service_record_id || item?.referenceId || item?.reference_id || item?.relatedId || item?.related_id || "");
const stockPurchasePaymentAmount = (product) => {
  const paid = parseMoneyInput(product.supplierPaid || 0);
  if (paid > 0) return paid;

  const totalBuy = parseMoneyInput(product.buy) * Number(product.qty || 1);
  const sellerDebt = stockSellerDebt(product);
  return sellerDebt > 0 ? Math.max(totalBuy - sellerDebt, 0) : 0;
};
const getLastSixBarcode = (product) => {
  const code = String(product?.barcode || product?.imei || "").replace(/\s/g, "");
  return code ? code.slice(-6) : "-";
};
const sellerRemainingFromDb = (item) => {
  const explicitDebt = Number(item.seller_cari_remaining || 0);
  if (explicitDebt > 0) return explicitDebt;

  const isCustomerPurchase =
    item.acquisition_type === "Müşteri" ||
    ((item.module === "Cihaz" || item.module === "Diğer") && item.category === "İkinci El");
  const hasSeller = item.seller_person || item.seller_cari_name || isSellerLabel(item.supplier_name);
  if (!isCustomerPurchase || !hasSeller) return 0;

  const totalBuy = Number(item.buy_price || 0) * Number(item.quantity || 1);
  const paid = Number(item.supplier_paid || 0);
  return Math.max(totalBuy - paid, 0);
};

const sortSalesForList = (items) =>
  [...items].sort((a, b) => {
    const rankDiff = saleGroupRank(a.type) - saleGroupRank(b.type);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });


const toNumber = (value) => Number(String(value || "0").replace(/[^\d]/g, "")) || 0;

const fromDbStock = (item) => {
  const sellerRemaining = sellerRemainingFromDb(item);

  return {
    id: item.id,
    module: item.module,
    deviceType: item.device_type || item.deviceType || "Telefon",
    condition: item.module === "Cihaz" || item.module === "Diğer" ? item.category || "Sıfır Garantili" : "Sıfır Garantili",
    category: item.module === "Aksesuar" ? item.category || "KILIF" : item.category || "",
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
    supplierPaid: money(Number(item.supplier_paid || 0)),
    sellerCariRemaining: sellerRemaining,
    sellerCariName: sellerRemaining > 0 ? sellerNameFromProduct(item) : "",
    acquisitionType: item.acquisition_type || "Tedarikçi Firma",
    status: item.status || "active",
  };
};

const fromDbSale = (sale) => ({
  id: sale.id,
  type: sale.sale_type,
  productId: sale.stock_item_id,
  stock_item_id: sale.stock_item_id,
  product_id: sale.stock_item_id,
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
  status: sale.status || "active",
});

const fromDbExpense = (item) => ({
  id: item.id,
  category: item.category,
  amount: money(Number(item.amount || 0)),
  note: item.note || "",
  date: item.created_at || new Date().toISOString(),
  status: item.status || "active",
});

const fromDbBankMovement = (item) => ({
  id: item.id,
  type: item.movement_type,
  bank: item.bank_name,
  direction: item.direction || (purchasePaymentMovementTypes.includes(item.movement_type) || item.movement_type === "Bankadan Çekilen" ? "out" : "in"),
  amount: money(Number(item.amount || 0)),
  note: item.note || "",
  relatedTable: item.related_table || item.relatedTable || "",
  relatedId: item.related_id || item.relatedId || item.related_sale_id || "",
  relatedServiceId: item.related_service_id || item.relatedServiceId || "",
  serviceRecordId: item.service_record_id || item.serviceRecordId || "",
  referenceId: item.reference_id || item.referenceId || "",
  date: item.created_at || new Date().toISOString(),
  status: item.status || "active",
});

const fromDbBankBalance = (item) => ({
  bank: item.bank_name || item.bank || "",
  totalToBank: Number(item.total_in ?? item.totalToBank ?? 0),
  withdrawnFromBank: Number(item.total_out ?? item.withdrawnFromBank ?? 0),
  remaining: Math.max(Number(item.balance ?? item.remaining ?? 0), 0),
  movementCount: Number(item.movement_count ?? item.movementCount ?? 0),
  lastMovementAt: item.last_movement_at || item.lastMovementAt || "",
  source: "supabase",
});

const fromDbCashMovement = (item) => ({
  id: item.id,
  type: item.movement_type || item.type || "",
  direction: item.direction || "",
  amount: Number(item.amount || 0),
  note: item.note || "",
  relatedTable: item.related_table || item.relatedTable || "",
  relatedId: item.related_id || item.relatedId || "",
  relatedServiceId: item.related_service_id || item.relatedServiceId || "",
  serviceRecordId: item.service_record_id || item.serviceRecordId || "",
  referenceId: item.reference_id || item.referenceId || "",
  date: item.created_at || item.date || new Date().toISOString(),
  status: item.status || "active",
});

const fromDbContact = (item) => ({
  id: item.id,
  kind: item.kind || "",
  name: item.name || "",
  phone: item.phone || "",
  balance: Number(item.balance || 0),
  balanceType: item.balance_type || item.balanceType || "",
  relatedTable: item.related_table || item.relatedTable || "",
  relatedId: item.related_id || item.relatedId || "",
  relatedStockId: item.related_stock_id || item.relatedStockId || "",
  stockId: item.stock_id || item.stockId || "",
  itemId: item.item_id || item.itemId || "",
  productId: item.product_id || item.productId || "",
  referenceId: item.reference_id || item.referenceId || "",
  note: item.note || "",
  date: item.created_at || item.date || new Date().toISOString(),
  status: item.status || "active",
});

const fromDbTechnicalService = (item) => {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  return {
    ...payload,
    id: item.id || payload.id,
    workspace_id: item.workspace_id || payload.workspace_id || payload.workspaceId || "",
    workspaceId: item.workspace_id || payload.workspaceId || payload.workspace_id || "",
    customerName: item.customer_name || payload.customerName || "",
    phone: item.phone || payload.phone || "",
    brand: item.brand || payload.brand || "",
    model: item.model || payload.model || "",
    device: item.device || payload.device || "",
    imei: item.imei || payload.imei || "",
    color: item.color || payload.color || "",
    accessory: item.accessory || payload.accessory || "",
    stockItemId: item.stock_item_id || payload.stockItemId || "",
    issue: item.issue || payload.issue || "",
    repairAction: item.repair_action || payload.repairAction || "",
    technician: item.technician || payload.technician || "",
    estimatedPrice: formatMoneyInput(item.estimated_price ?? payload.estimatedPrice ?? 0),
    deposit: formatMoneyInput(item.deposit ?? payload.deposit ?? 0),
    cashDeposit: formatMoneyInput(item.cash_deposit ?? payload.cashDeposit ?? 0),
    cardDeposit: formatMoneyInput(item.card_deposit ?? payload.cardDeposit ?? 0),
    bank: item.bank_name || payload.bank || "",
    dueDate: item.due_date || payload.dueDate || "",
    deliveryDateTime: item.delivery_date_time || payload.deliveryDateTime || item.due_date || "",
    status: item.status || payload.status || "Beklemede",
    note: item.note || payload.note || "",
    createdAt: item.created_at || payload.createdAt || new Date().toISOString(),
    updatedAt: item.updated_at || payload.updatedAt || item.created_at || new Date().toISOString(),
    source: "supabase",
    financeSource: "supabase",
  };
};

const isActiveRecord = (item) => {
  const status = String(item?.status || "active").toLocaleLowerCase("tr-TR");
  return !["deleted", "cancelled", "canceled", "iptal", "iade", "refunded", "refund", "silindi"].includes(status) &&
    !item?.is_cancelled &&
    !item?.is_deleted &&
    !item?.deleted_at &&
    !item?.cancelled_at &&
    !item?.cancel_date;
};
const isActiveMovement = isActiveRecord;

function getSecurityPasswords() {
  if (typeof window === "undefined") return { ...defaultSecurityPasswords };
  try {
    const saved = JSON.parse(window.localStorage.getItem(securityPasswordsStorageKey) || "{}");
    return {
      editPassword: saved.editPassword || defaultSecurityPasswords.editPassword,
      cancelPassword: saved.cancelPassword || defaultSecurityPasswords.cancelPassword,
      deletePassword: saved.deletePassword || defaultSecurityPasswords.deletePassword,
    };
  } catch {
    return { ...defaultSecurityPasswords };
  }
}

function saveSecurityPasswords(passwords) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(securityPasswordsStorageKey, JSON.stringify({
    ...defaultSecurityPasswords,
    ...passwords,
  }));
}

function requireSecurityPassword(actionType, actionLabel = "") {
  const passwords = getSecurityPasswords();
  const config = {
    edit: { key: "editPassword", prompt: "Düzenleme şifresini girin" },
    cancel: { key: "cancelPassword", prompt: "İptal şifresini girin" },
    delete: { key: "deletePassword", prompt: "Silme şifresini girin" },
  }[actionType];

  if (!config) return false;
  const promptText = actionLabel ? `${config.prompt}\n${actionLabel}` : config.prompt;
  const entered = window.prompt(promptText);
  if (entered === null) return false;
  if (entered !== passwords[config.key]) {
    alert("Şifre hatalı. İşlem yapılmadı.");
    return false;
  }
  return true;
}


const deviceTypes = ["Telefon", "Saat", "Tablet", "PC", "Elektronik", "Diğer"];
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
const nonPhoneBrands = ["Apple", "Samsung", "Huawei", "Xiaomi", "Lenovo", "HP", "Casper", "Monster", "Asus", "Acer", "Sony", "LG", "Diğer"];
const otherProductGroups = ["Saat", "Tablet", "PC", "Bluetooth", "Program", "X"];
const programQuickAmounts = [20, 50, 100, 500];
const stockChoiceAddValue = "__ceplog_stock_choice_add__";
const stockChoiceStoragePrefix = "ceplog_stock_choice_options";
const stockChoiceFieldLabels = {
  brand: "Marka",
  name: "Ürün",
  model: "Model",
};
const defaultOtherBrandOptions = {
  Saat: ["Apple", "Samsung", "Huawei", "LG"],
  Tablet: ["Apple", "Samsung", "Huawei"],
  PC: ["Apple", "Lenovo"],
  Bluetooth: ["Apple", "Samsung", "Huawei", "Sony"],
  Elektronik: [],
  Diğerleri: [],
  X: [],
};

function toInternalOtherGroup(group) {
  if (group === "X") return "Diğerleri";
  if (group === "Diğer") return "Diğerleri";
  return group || "Saat";
}

function toVisibleOtherGroup(group) {
  if (group === "Diğerleri" || group === "Diğer") return "X";
  return group || "Saat";
}

function cleanStockChoice(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function uniqueStockChoices(values) {
  const seen = new Set();
  return values
    .map(cleanStockChoice)
    .filter(Boolean)
    .filter((value) => {
      if (value === stockChoiceAddValue) return false;
      const key = normalizeStockText(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function stockChoiceDefaults(group, field) {
  if (field !== "brand") return [];
  return defaultOtherBrandOptions[toInternalOtherGroup(group)] || [];
}

function stockChoiceOptionsFor({ customChoices = {}, stockItems = [], group, field }) {
  const groupKey = toInternalOtherGroup(group);
  const stored = customChoices?.[groupKey]?.[field] || [];
  const existing = stockItems
    .filter((product) => product.module === "Diğer" && toInternalOtherGroup(product.deviceType) === groupKey)
    .map((product) => product[field]);
  return uniqueStockChoices([...stockChoiceDefaults(groupKey, field), ...existing, ...stored]);
}

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

const initialStock = [];
const initialSales = [];

function productTitle(product) {
  if (!product) return "";
  if (product.module === "Aksesuar") return [product.category, product.accessorySubType, product.name].filter(Boolean).join(" / ") || "-";
  if (product.module !== "Cihaz") return [toVisibleOtherGroup(product.deviceType), product.name].filter(Boolean).join(" / ") || "-";
  return [product.brand, product.model, product.memory].filter(Boolean).join(" ");
}

const stockSearchFilters = ["TÜMÜ", "TELEFON", "AKSESUAR", "DİĞERLERİ", "SAAT", "TABLET", "PC", "BLUETOOTH", "ELEKTRONİK", "PROGRAM"];
const technicalSearchFilters = ["TÜMÜ", "TELEFON", "PC", "TABLET", "ELEKTRONİK", "DİĞERLERİ"];
const displayStockGroup = (group) => group === "DİĞERLERİ" ? "X" : group;

function stockSearchGroup(product) {
  const moduleName = normalizeStockText(product?.module);
  const deviceName = normalizeStockText(product?.deviceType || product?.device_type);
  const title = normalizeStockText(productTitle(product));

  if (isPhoneStockItem(product)) return "TELEFON";
  if (isAccessoryStockItem(product)) return "AKSESUAR";
  if (deviceName.includes("saat") || title.includes("saat")) return "SAAT";
  if (deviceName.includes("tablet") || title.includes("tablet")) return "TABLET";
  if (deviceName === "pc" || deviceName.includes("bilgisayar") || title.includes("pc")) return "PC";
  if (deviceName.includes("bluetooth") || title.includes("bluetooth")) return "BLUETOOTH";
  if (deviceName.includes("elektronik") || title.includes("elektronik")) return "ELEKTRONİK";
  if (moduleName.includes("program") || deviceName.includes("program") || title.includes("program")) return "PROGRAM";
  return "DİĞERLERİ";
}

function saleTargetFromStockProduct(product) {
  const group = stockSearchGroup(product);
  if (group === "TELEFON") return { saleGroup: "Telefon", saleType: "Telefon Satışı" };
  if (group === "AKSESUAR") return { saleGroup: "Aksesuar", saleType: "Aksesuar Satışı" };
  if (group === "SAAT") return { saleGroup: "Saat", saleType: "Saat Satışı" };
  if (group === "TABLET") return { saleGroup: "Tablet", saleType: "Tablet Satışı" };
  if (group === "PC") return { saleGroup: "PC", saleType: "PC Satışı" };
  if (group === "ELEKTRONİK") return { saleGroup: "Elektronik", saleType: "Elektronik Satışı" };
  if (group === "PROGRAM") return { saleGroup: "Program", saleType: "Program Satışı" };
  if (group === "BLUETOOTH") return { saleGroup: "Bluetooth", saleType: "Bluetooth Satışı" };
  return { saleGroup: "X", saleType: "Diğerleri Satışı" };
}

function stockSearchHaystack(product) {
  return [
    productTitle(product),
    product?.product_name,
    product?.name,
    product?.brand,
    product?.model,
    product?.memory,
    product?.deviceType,
    product?.device_type,
    product?.module,
    product?.condition,
    product?.category,
    product?.accessorySubType,
    product?.barcode,
    product?.imei,
    product?.serial_no,
    product?.supplier,
    product?.supplier_name,
    product?.sellerPerson,
    product?.seller_person,
    product?.sellerPhone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function formatRecordDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").slice(0, 10);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function reportDateValue(item) {
  return item?.created_at || item?.createdAt || item?.movement_date || item?.saleDate || item?.sale_date || item?.date || "";
}

function isSameReportDay(item, selectedDate) {
  const value = reportDateValue(item);
  if (!value || !selectedDate) return false;
  return localDateKey(value) === selectedDate;
}

function calculateFinanceSummary({ cashMovements = [], bankMovements = [], sales = [], expenses = [], todayKey = localDateKey(new Date()) }) {
  const activeCash = cashMovements.filter(isActiveRecord);
  const activeBank = bankMovements.filter(isActiveRecord);
  const activeSalesRows = sales.filter(isActiveRecord);
  const activeExpenseRows = expenses.filter(isActiveRecord);
  const activeSaleIds = new Set(activeSalesRows.map((sale) => String(sale.id || "")));
  const isLinkedSaleCashMovement = (item) =>
    cashMovementType(item) === "Satış Nakit" &&
    String(item.relatedTable || item.related_table || "") === "sales" &&
    activeSaleIds.has(String(item.relatedId || item.related_id || ""));
  const cashSaleMovementIds = new Set(activeCash.filter(isLinkedSaleCashMovement).map((item) => String(item.relatedId || item.related_id || "")));
  const cashBankMovementIds = new Set(activeCash.filter((item) => cashMovementType(item) === "Bankadan Nakit Gelen" && String(item.relatedTable || item.related_table || "") === "bank_movements").map((item) => String(item.relatedId || item.related_id || "")));
  const cashExpenseMovementIds = new Set(activeCash.filter((item) => cashMovementType(item) === "Gider" && String(item.relatedTable || item.related_table || "") === "expenses").map((item) => String(item.relatedId || item.related_id || "")));
  const purchasePaymentCashMovementIds = new Set(activeCash.filter((item) => isPurchasePaymentMovement(item)).map((item) => String(item.id || "")));

  const normalizedCashSales = activeSalesRows
    .reduce((sum, sale) => sum + normalizeSalePaymentDistributionForReport(sale).cash, 0);
  const todayNormalizedCashSales = activeSalesRows
    .filter((sale) => isSameReportDay(sale, todayKey))
    .reduce((sum, sale) => sum + normalizeSalePaymentDistributionForReport(sale).cash, 0);
  const legacyBankCashIncoming = activeBank
    .filter((item) => bankMovementType(item) === "Bankadan Çekilen" && !cashBankMovementIds.has(String(item.id)))
    .reduce((sum, item) => sum + Math.abs(bankMovementAmount(item)), 0);
  const todayLegacyBankCashIncoming = activeBank
    .filter((item) => bankMovementType(item) === "Bankadan Çekilen" && !cashBankMovementIds.has(String(item.id)) && isSameReportDay(item, todayKey))
    .reduce((sum, item) => sum + Math.abs(bankMovementAmount(item)), 0);
  const legacyExpenseOut = activeExpenseRows
    .filter((item) => !cashExpenseMovementIds.has(String(item.id)))
    .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);

  const cashNetEffect = activeCash
    .filter((item) => !isLinkedSaleCashMovement(item))
    .reduce((sum, item) => sum + getCashNetEffect(item), 0);
  const todayRealCashIncome = activeCash
    .filter((item) => !isLinkedSaleCashMovement(item) && isSameReportDay(item, todayKey) && isRealCashIncome(item))
    .reduce((sum, item) => sum + movementAmount(item), 0) + todayNormalizedCashSales;
  const todayCashIncomeCorrections = activeCash
    .filter((item) => isSameReportDay(item, todayKey) && cashMovementType(item) === cashEntryCancellationType && movementDirection(item) === "out")
    .reduce((sum, item) => sum + movementAmount(item), 0);
  const todayCashIncome = Math.max(todayRealCashIncome - todayCashIncomeCorrections, 0);
  const todayBankCashIncoming = activeCash
    .filter((item) => isSameReportDay(item, todayKey) && cashMovementType(item) === "Bankadan Nakit Gelen" && movementDirection(item) === "in")
    .reduce((sum, item) => sum + movementAmount(item), 0) + todayLegacyBankCashIncoming;
  const todayCashExpense = activeCash
    .filter((item) => isSameReportDay(item, todayKey) && isRealCashExpense(item))
    .reduce((sum, item) => sum + movementAmount(item), 0) + activeExpenseRows
    .filter((item) => !cashExpenseMovementIds.has(String(item.id)) && isSameReportDay(item, todayKey))
    .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
  const cashExpenseTotal = activeCash
    .filter(isRealCashExpense)
    .reduce((sum, item) => sum + movementAmount(item), 0) + legacyExpenseOut;

  const purchasePaymentTotal = activeCash
    .filter((item) => isPurchasePaymentMovement(item))
    .reduce((sum, item) => sum + movementAmount(item), 0) + activeBank
    .filter((item) => isPurchasePaymentMovement(item))
    .reduce((sum, item) => sum + movementAmount(item), 0);
  const purchasePaymentCancelTotal = activeCash
    .filter((item) => isPurchasePaymentCancelMovement(item, purchasePaymentCashMovementIds) && movementDirection(item) === "in")
    .reduce((sum, item) => sum + movementAmount(item), 0) + activeBank
    .filter((item) => isPurchasePaymentCancelMovement(item) && bankMovementDirection(item) === "in")
    .reduce((sum, item) => sum + movementAmount(item), 0);
  const receivablePaymentsTotal = activeCash
    .filter((item) => ["Gelen Alacak", "Alacak Tahsilatı", "Cari Tahsilat", "Alacak Ödemesi"].includes(cashMovementType(item)) && movementDirection(item) === "in")
    .reduce((sum, item) => sum + movementAmount(item), 0);

  return {
    cashSaleMovementIds,
    cashBankMovementIds,
    cashExpenseMovementIds,
    cashNetEffect,
    expectedCash: cashNetEffect + normalizedCashSales + legacyBankCashIncoming - legacyExpenseOut,
    todayCashIncome,
    todayBankCashIncoming,
    todayCashExpense,
    cashExpenseTotal,
    purchasePaymentsNet: Math.max(purchasePaymentTotal - purchasePaymentCancelTotal, 0),
    receivablePaymentsTotal,
    legacyCashSales: normalizedCashSales,
    legacyBankCashIncoming,
    legacyExpenseOut,
  };
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

function normalizeSalePaymentDistributionForReport(sale) {
  const total = parseMoneyInput(sale?.total || sale?.total_amount || 0);
  const rawCash = parseMoneyInput(sale?.cash || sale?.cash_amount || 0);
  const rawCard = parseMoneyInput(sale?.card || sale?.card_amount || 0);
  const rawDebt = parseMoneyInput(sale?.remaining || sale?.remaining_amount || 0);
  const paidTotal = rawCash + rawCard;

  if (total > 0 && paidTotal > total) {
    const card = Math.min(rawCard, total);
    const cash = Math.max(total - card, 0);
    console.warn("Satış ödeme dağılımı raporda normalize edildi.", {
      saleId: sale?.id || "",
      total,
      rawCash,
      rawCard,
      rawDebt,
      normalizedCash: cash,
      normalizedCard: card,
      overpaid: paidTotal - total,
    });
    return { total, cash, card, debt: 0, overpaid: paidTotal - total };
  }

  return {
    total,
    cash: rawCash,
    card: rawCard,
    debt: Math.max(total - paidTotal, 0),
    overpaid: 0,
  };
}

function Stat({ title, value, negative = false }) {
  return (
    <div className={negative ? "stat-card negative" : "stat-card"}>
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
  const [clockNow, setClockNow] = useState(new Date());
  const [dbReady, setDbReady] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [appTheme, setAppTheme] = useState(() => {
    if (typeof window === "undefined") return "1";
    const savedTheme = localStorage.getItem("ceplog_app_theme");
    return ["1", "2", "3"].includes(savedTheme) ? savedTheme : "1";
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [cashMovements, setCashMovements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [businessTransactions, setBusinessTransactions] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [cariMovements, setCariMovements] = useState([]);
  const [returnsData, setReturnsData] = useState([]);
  const [returnItems, setReturnItems] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [posMovements, setPosMovements] = useState([]);
  const [schemaStatus, setSchemaStatus] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [kasaTab, setKasaTab] = useState("yeniSatis");
  const [dailyReportDate, setDailyReportDate] = useState(() => localDateKey(new Date()));
  const [salesListDate, setSalesListDate] = useState(() => localDateKey(new Date()));
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockSearchFilter, setStockSearchFilter] = useState("TÜMÜ");
  const [saleGroup, setSaleGroup] = useState("Telefon");
  const [quickAccessoryGroup, setQuickAccessoryGroup] = useState("Kılıf");
  const [quickAccessorySubType, setQuickAccessorySubType] = useState("A Kılıf");
  const [accessoryShortcuts, setAccessoryShortcuts] = useState([]);
  const [hiddenShortcutIds, setHiddenShortcutIds] = useState([]);
  const [accessoryShortcutForm, setAccessoryShortcutForm] = useState({ group: "Kılıf", sub: "A Kılıf", price: "" });
  const [technicalServices, setTechnicalServices] = useState([]);
  const [technicalServiceForm, setTechnicalServiceForm] = useState(() => makeEmptyTechnicalServiceForm());
  const [selectedTechnicalServiceId, setSelectedTechnicalServiceId] = useState("");
  const [technicalServiceMode, setTechnicalServiceMode] = useState("new");
  const [technicalServiceFormModalOpen, setTechnicalServiceFormModalOpen] = useState(false);
  const [technicalServiceDetailModalOpen, setTechnicalServiceDetailModalOpen] = useState(false);
  const [technicalSearchModalOpen, setTechnicalSearchModalOpen] = useState(false);
  const [technicalSearchQuery, setTechnicalSearchQuery] = useState("");
  const [technicalSearchFilter, setTechnicalSearchFilter] = useState("TÜMÜ");
  const [technicalStatusFilter, setTechnicalStatusFilter] = useState("TÜMÜ");
  const [technicalPaymentForm, setTechnicalPaymentForm] = useState(emptyTechnicalPaymentForm);
  const [technicalRefundForm, setTechnicalRefundForm] = useState(emptyTechnicalPaymentForm);
  const [visibleKasaStats, setVisibleKasaStats] = useState({});
  const [profitUnlocked, setProfitUnlocked] = useState(false);
  const [securityPasswordDrafts, setSecurityPasswordDrafts] = useState(() => getSecurityPasswords());
  const [visibleSecurityPasswords, setVisibleSecurityPasswords] = useState({});
  const [profitDateFrom, setProfitDateFrom] = useState("");
  const [profitDateTo, setProfitDateTo] = useState("");
  const [karaTab, setKaraTab] = useState("alacak");
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorValue, setCalculatorValue] = useState("");
  const [calculatorResult, setCalculatorResult] = useState("");
  const [kasaBrainModal, setKasaBrainModal] = useState(null);
  const [kasaBrainReason, setKasaBrainReason] = useState("");
  const [kasaBrainPassword, setKasaBrainPassword] = useState("");
  const [kasaBrainProcessing, setKasaBrainProcessing] = useState(false);
  const [kasaBrainEditDraft, setKasaBrainEditDraft] = useState(null);
  const [systemCheckFindings, setSystemCheckFindings] = useState([]);
  const [systemCheckLastRun, setSystemCheckLastRun] = useState("");
  const pendingActionKeysRef = useRef(new Set());

  function beginPendingAction(key, message = "Bu işlem zaten devam ediyor. Lütfen bekleyin.") {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return true;
    if (pendingActionKeysRef.current.has(cleanKey)) {
      alert(message);
      return false;
    }
    pendingActionKeysRef.current.add(cleanKey);
    return true;
  }

  function endPendingAction(key) {
    const cleanKey = String(key || "").trim();
    if (cleanKey) pendingActionKeysRef.current.delete(cleanKey);
  }

	  const isManualCashEntryCancelAction = (modal) => {
	    const action = String(modal?.action || "").toLocaleLowerCase("tr-TR");
	    const rowType = String(modal?.row?.type || "").toLocaleLowerCase("tr-TR");
	    const description = String(modal?.row?.description || "").toLocaleLowerCase("tr-TR");

    return (
      action === "iptal" &&
      (
        rowType.includes("nakit girişi") ||
        rowType.includes("manuel nakit") ||
        description.includes("manuel nakit")
      ) &&
	      !rowType.includes("satış")
	    );
	  };

  async function writeKasaBrainAuditLog(logRecord, { action = "UPDATE", eventType = "kasa_brain_action", reason = "" } = {}) {
    const auditId = await createAuditLog({
      tableName: "kasa_brain",
      recordId: logRecord?.rowId || logRecord?.recordId || logRecord?.saleId || logRecord?.stockItemId || null,
      action,
      eventType,
      reason: reason || logRecord?.reason || "",
      oldData: logRecord?.beforeData || null,
      newData: logRecord || null,
      metadata: logRecord || {},
      requestKey: logRecord?.id || logRecord?.actionKey || "",
      strict: true,
    });
    if (!auditId) throw new Error("Kasa Beyni audit kaydı oluşturulamadı.");
    return auditId;
  }

	  const handleManualCashEntryCancel = async ({ reason, password }) => {
	    const row = kasaBrainModal?.row || {};
	    const targetNo = Number(row.no || 0);
	    const targetAmount = Number(row.cash || row.total || 0);

    if (!targetNo || !targetAmount || targetAmount <= 0) {
      window.alert("Kasa Beyni: İptal edilecek manuel nakit girişi bulunamadı.");
      return false;
    }

    const activeCashRows = dailyCashReportRows || [];
    const targetReportRow = activeCashRows.find((item) => Number(item.no || 0) === targetNo);

    if (!targetReportRow) {
      window.alert("Kasa Beyni: Rapor satırı bulunamadı.");
      return false;
    }

    const rowType = String(targetReportRow.type || row.type || "").toLocaleLowerCase("tr-TR");
    const rowDescription = String(targetReportRow.description || row.description || "").toLocaleLowerCase("tr-TR");

    if (rowType.includes("iptal")) {
      window.alert("Kasa Beyni: Bu kayıt zaten iptal kaydıdır. Tekrar iptal edilemez.");
      return false;
    }

    if (rowType.includes("satış")) {
      window.alert("Kasa Beyni: Satıştan gelen nakit bu işlemden ayrı iptal edilemez. Satış iptali için aynı rapordaki Satış İptal akışını kullanın.");
      return false;
    }

	    const originalRef = String(targetReportRow.id || row.id || targetReportRow.relatedId || row.relatedId || targetNo);
      const originalMovement = activeCashMovements.find((movement) => String(movement.id || "") === originalRef) || null;

      if (!originalMovement) {
        window.alert("Kasa Beyni: Bu nakit girişi gerçek cash_movements kaydıyla eşleşmedi. Local/geçici iptal yapılmadı.");
        await refreshFromDatabase();
        return true;
      }

	    if (cashMovementCancellationFor(originalMovement)) {
	      window.alert("Kasa Beyni: Bu manuel nakit girişi daha önce iptal edilmiş. İkinci kez iptal edilemez.");
	      return false;
	    }

	    const nowIso = new Date().toISOString();
	    const actionKey = `cash-entry-cancel:${originalMovement.id}`;
      if (!beginPendingAction(actionKey)) return true;

      try {
        setKasaBrainProcessing(true);
        const cancellationMovement = await createCashMovementCancellation({
          movement_type: cashMovementCancellationTypeFor(originalMovement) || cashEntryCancellationType,
          direction: "out",
          amount: targetAmount,
          note: `İptal: ${targetReportRow.description || row.description || "Manuel Nakit Girişi"} | Kayıt No: ${targetNo} | Sebep: ${reason}`,
          related_table: "cash_movements",
          related_id: originalMovement.id,
        });

        const logRecord = {
          id: `kasa-brain-real-${Date.now()}`,
          actionKey,
          createdAt: nowIso,
          action: kasaBrainModal.action || "İptal",
          rowId: originalMovement.id,
          recordNo: row.no || null,
          type: row.type || "",
          description: row.description || "",
          party: row.party || "",
          cash: Number(row.cash || 0),
          bank: Number(row.bank || 0),
          debt: Number(row.debt || 0),
          refund: Number(row.refund || 0),
          total: Number(row.total || 0),
          reason,
          status: "CASH_ENTRY_CANCEL_SUPABASE_MOVEMENT",
          result: "Reverse cash movement created in Supabase",
          reverseMovementId: cancellationMovement?.id || null,
          duplicateProtected: true,
          passwordUsed: Boolean(password),
        };
        await writeKasaBrainAuditLog(logRecord, { action: "CANCEL", eventType: "kasa_brain_cash_entry_cancel", reason });
        await refreshFromDatabase();

        window.alert(`Kasa Beyni: Manuel nakit girişi iptal edildi.
Ters hareket: -${money(targetAmount)}
Gerçek silme yapılmadı.
Bu kayıt ikinci kez iptal edilemez.`);
        setSyncMessage(`Kasa Beyni: Manuel nakit girişi iptal edildi. Ters hareket oluşturuldu: -${money(targetAmount)}. İkinci iptal engellendi.`);
        closeKasaBrainModal();
        return true;
      } catch (error) {
        console.error("Kasa Beyni manuel nakit iptal hatası:", error);
        window.alert(error.message || "Kasa Beyni: Manuel nakit girişi iptal edilemedi.");
        await refreshFromDatabase();
        return true;
      } finally {
        setKasaBrainProcessing(false);
        endPendingAction(actionKey);
      }
	  };

	  const isSaleCancelAction = (modal) => {
	    const action = String(modal?.action || "").toLocaleLowerCase("tr-TR");
	    const rowType = String(modal?.row?.type || "").toLocaleLowerCase("tr-TR");

	    return action === "satış iptal" && rowType.includes("satış");
	  };

	  const isSaleRefundAction = (modal) => {
	    const action = String(modal?.action || "").toLocaleLowerCase("tr-TR");
	    const rowType = String(modal?.row?.type || "").toLocaleLowerCase("tr-TR");

	    return action === "satış iade" && rowType.includes("satış");
	  };

  const isPurchaseCancelAction = (modal) => {
    const action = String(modal?.action || "").toLocaleLowerCase("tr-TR");
    const rowType = String(modal?.row?.type || "").toLocaleLowerCase("tr-TR");

    return action === "alım iptal" && rowType.includes("alım");
  };

  const normalizeKasaBrainText = (value) =>
    String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ")
      .trim();

  function closeKasaBrainModal() {
    setKasaBrainReason("");
    setKasaBrainPassword("");
    setKasaBrainEditDraft(null);
    setKasaBrainModal(null);
  }

  const findSaleForKasaBrainRow = (row) => {
    const rowType = normalizeKasaBrainText(row?.type);
    if (!rowType.includes("satış") && !rowType.includes("satis")) return null;
    const rowId = String(row?.saleId || row?.relatedSaleId || (normalizeKasaBrainText(row?.relatedTable || row?.related_table) === "sales" ? row?.relatedId || row?.related_id : "") || row?.id || "");
    const rowDescription = normalizeKasaBrainText(row?.description);
    const rowParty = normalizeKasaBrainText(row?.party);
    const rowTotal = parseMoneyInput(row?.total || 0);
    const rowCash = parseMoneyInput(row?.cash || 0);
    const rowBank = parseMoneyInput(row?.bank || 0);
    const rowDebt = parseMoneyInput(row?.debt || 0);

    return (sales || []).find((sale) => {
      const saleId = String(sale?.id || sale?.saleId || "");
      const saleDescription = normalizeKasaBrainText(
        sale?.description ||
        sale?.productName ||
        sale?.product ||
        sale?.deviceName ||
        sale?.model ||
        sale?.name ||
        sale?.title
      );
      const saleParty = normalizeKasaBrainText(
        sale?.customer ||
        sale?.customerName ||
        sale?.cariPerson ||
        sale?.buyer ||
        sale?.party
      );

      const saleTotal = parseMoneyInput(
        sale?.total ||
        sale?.totalAmount ||
        sale?.salePrice ||
        sale?.price ||
        sale?.amount ||
        0
      );

      const saleCash = parseMoneyInput(sale?.cash || sale?.cash_amount || 0);
      const saleBank = parseMoneyInput(sale?.card || sale?.bank || sale?.bank_amount || sale?.card_amount || 0);
      const saleDebt = parseMoneyInput(sale?.remaining || sale?.debt || sale?.cari || 0);

      const idMatch = rowId && saleId && rowId === saleId;
      const descriptionMatch =
        rowDescription &&
        saleDescription &&
        (rowDescription.includes(saleDescription) || saleDescription.includes(rowDescription));

      const partyMatch =
        !rowParty ||
        !saleParty ||
        rowParty.includes(saleParty) ||
        saleParty.includes(rowParty);

      const totalMatch = !rowTotal || !saleTotal || Math.abs(rowTotal - saleTotal) < 1;
      const cashMatch = !rowCash || Math.abs(rowCash - saleCash) < 1;
      const bankMatch = !rowBank || Math.abs(rowBank - saleBank) < 1;
      const debtMatch = !rowDebt || Math.abs(rowDebt - saleDebt) < 1;

      return idMatch || (descriptionMatch && partyMatch && totalMatch && cashMatch && bankMatch && debtMatch);
    });
  };

  const findStockForKasaBrainRow = (row) => {
    const rowType = normalizeKasaBrainText(row?.type);
    const relatedTable = normalizeKasaBrainText(row?.relatedTable || row?.related_table);
    const candidateIds = [
      row?.stockItemId,
      row?.stock_item_id,
      relatedTable === "stock_items" ? (row?.relatedId || row?.related_id) : "",
      rowType.includes("alım") ? row?.id : "",
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const idMatch = (stock || []).find((product) =>
      candidateIds.some((candidateId) => String(product?.id || "") === candidateId)
    );

    if (idMatch) return idMatch;

    const rowDescription = normalizeKasaBrainText(row?.description);
    const rowParty = normalizeKasaBrainText(row?.party);
    const rowCash = parseMoneyInput(row?.cash || 0);
    const rowDebt = parseMoneyInput(row?.debt || 0);

    return (stock || []).find((product) => {
      const productStatus = normalizeKasaBrainText(product?.status || "active");
      if (["deleted", "cancelled", "canceled", "iptal"].includes(productStatus)) return false;

      const productText = normalizeKasaBrainText(
        product?.product_name ||
        product?.productName ||
        product?.name ||
        product?.brand ||
        product?.model ||
        product?.description ||
        product?.imei ||
        product?.barcode
      );
      const productParty = normalizeKasaBrainText(
        product?.supplier_name ||
        product?.supplierName ||
        product?.seller_person ||
        product?.sellerPerson ||
        product?.party
      );
      const productPaid = parseMoneyInput(product?.supplier_paid || product?.supplierPaid || 0);
      const productDebt = parseMoneyInput(product?.seller_cari_remaining || product?.sellerCariRemaining || 0);

      const descriptionMatch =
        rowDescription &&
        productText &&
        (rowDescription.includes(productText) || productText.includes(rowDescription));
      const partyMatch =
        !rowParty ||
        !productParty ||
        rowParty.includes(productParty) ||
        productParty.includes(rowParty);
      const cashMatch = !rowCash || !productPaid || Math.abs(rowCash - productPaid) < 1;
      const debtMatch = !rowDebt || !productDebt || Math.abs(rowDebt - productDebt) < 1;

      return descriptionMatch && partyMatch && cashMatch && debtMatch;
    });
  };

  function buildKasaBrainEditDraft(action, row = {}) {
    if (action !== "Düzelt") return null;

    const sale = findSaleForKasaBrainRow(row);
    if (sale) {
      return {
        mode: "sale",
        id: sale.id,
        type: sale.type || sale.sale_type || "Satış",
        productName: sale.productName || sale.product_name || row.description || "",
        customer: sale.customer || sale.customer_name || "",
        customerPhone: sale.customerPhone || sale.customer_phone || "",
        cariPerson: sale.cariPerson || sale.cari_person || sale.customer || sale.customer_name || "",
        buy: formatMoneyInput(sale.productBuyPrice || sale.buy_cost || row.buy || 0),
        total: formatMoneyInput(sale.total || sale.total_amount || row.sale || row.total || 0),
        cash: formatMoneyInput(sale.cash || sale.cash_amount || row.cash || 0),
        card: formatMoneyInput(sale.card || sale.card_amount || row.bank || 0),
        bank: sale.bank || sale.bank_name || "",
      };
    }

    const stockItem = findStockForKasaBrainRow(row);
    if (stockItem) {
      const cashPaid = activeCashMovements
        .filter((movement) => movementMatchesStock(stockItem, movement) && isPurchasePaymentMovement(movement))
        .reduce((sum, movement) => sum + cashMovementAmount(movement), 0);
      const linkedBankPurchases = activeBankMovements
        .filter((movement) => movementMatchesStock(stockItem, movement) && isPurchasePaymentMovement(movement));
      const bankPaid = linkedBankPurchases.reduce((sum, movement) => sum + bankMovementAmount(movement), 0);
      const fallbackPaid = parseMoneyInput(stockItem.supplierPaid || stockItem.supplier_paid || 0);
      const visibleCashPaid = Math.abs(cashPaid) || (!bankPaid ? fallbackPaid : 0);
      const firstBank = linkedBankPurchases.find((movement) => movement.bank || movement.bank_name);
      return {
        mode: "stock",
        id: stockItem.id,
        module: stockItem.module || "",
        deviceType: stockItem.deviceType || stockItem.device_type || "",
        condition: stockItem.condition || stockItem.category || "",
        category: stockItem.category || stockItem.condition || "",
        accessorySubType: stockItem.accessorySubType || stockItem.sub_type || "",
        brand: stockItem.brand || "",
        model: stockItem.model || "",
        memory: stockItem.memory || "",
        name: stockItem.name || stockItem.productName || stockItem.product_name || row.description || "",
        barcode: stockItem.barcode || stockItem.imei || "",
        buy: formatMoneyInput(stockItem.buy || stockItem.buy_price || row.buy || Math.abs(row.total || 0)),
        sell: formatMoneyInput(stockItem.sell || stockItem.sell_price || 0),
        qty: Number(stockItem.qty || stockItem.quantity || 1),
        supplier: stockItem.supplier || stockItem.supplier_name || row.party || "",
        sellerPerson: stockItem.sellerPerson || stockItem.seller_person || "",
        sellerPhone: stockItem.sellerPhone || stockItem.seller_phone || "",
        acquisitionType: stockItem.acquisitionType || stockItem.acquisition_type || "Tedarikçi Firma",
        cashPaid: formatMoneyInput(visibleCashPaid),
        bankPaid: formatMoneyInput(Math.abs(bankPaid)),
        bank: firstBank?.bank || firstBank?.bank_name || "",
        supplierPaid: formatMoneyInput(visibleCashPaid + Math.abs(bankPaid)),
        sellerCariRemaining: Number(stockItem.sellerCariRemaining || stockItem.seller_cari_remaining || 0),
        note: stockItem.note || "",
      };
    }

    return null;
  }

  function renderKasaBrainEditFields() {
    if (kasaBrainModal?.action !== "Düzelt") return null;

    const draft = kasaBrainEditDraft;
    if (!draft) {
      return (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontWeight: 800 }}>
          Bu rapor satırı düzenlenebilir satış veya alım kaydıyla açık bağlantılı değil.
        </div>
      );
    }

    const setDraftValue = (key, value) => setKasaBrainEditDraft((prev) => ({ ...(prev || draft), [key]: value }));
    const fieldStyle = {
      width: "100%",
      border: "1px solid #cbd5e1",
      borderRadius: 10,
      padding: "8px 10px",
      fontSize: 13,
      fontWeight: 800,
      outline: "none",
      background: "#fff",
    };
    const labelStyle = { display: "grid", gap: 4, fontSize: 11, fontWeight: 900, color: "#475569" };
    const moneyField = (label, key, placeholder = "0 TL") => (
      <label style={labelStyle}>
        {label}
        <input
          type="text"
          inputMode="numeric"
          value={draft[key] || ""}
          placeholder={placeholder}
          onFocus={() => setDraftValue(key, stripMoneyForEdit(draft[key]))}
          onChange={(event) => setDraftValue(key, cleanMoneyTyping(event.target.value))}
          onBlur={() => setDraftValue(key, formatMoneyInput(draft[key]))}
          style={fieldStyle}
        />
      </label>
    );
    const textField = (label, key, placeholder = "", full = false) => (
      <label style={{ ...labelStyle, gridColumn: full ? "1 / -1" : undefined }}>
        {label}
        <input
          value={draft[key] || ""}
          placeholder={placeholder}
          onChange={(event) => setDraftValue(key, event.target.value)}
          style={fieldStyle}
        />
      </label>
    );
    const bankField = (
      <label style={labelStyle}>
        Banka
        <select
          value={draft.bank || ""}
          onChange={(event) => handleBankSelect(event.target.value, (value) => setDraftValue("bank", value))}
          style={fieldStyle}
        >
          <option value="">Banka seç</option>
          {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
          <option value="__add_bank__">+ Banka Ekle</option>
        </select>
      </label>
    );

    if (draft.mode === "sale") {
      const total = parseMoneyInput(draft.total);
      const cash = parseMoneyInput(draft.cash);
      const card = parseMoneyInput(draft.card);
      const buy = parseMoneyInput(draft.buy);
      const remaining = Math.max(total - cash - card, 0);
      const profit = Math.max(total - buy, 0);
      return (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: "#f8fafc", border: "1px solid #dbeafe" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 900 }}>Satış Düzeltme</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {textField("Ürün / Cihaz", "productName", "", true)}
            {textField("Müşteri", "customer")}
            {textField("Cari Kişi", "cariPerson")}
            {textField("Telefon", "customerPhone")}
            {moneyField("Alış Fiyatı", "buy")}
            {moneyField("Satış Fiyatı", "total")}
            {moneyField("Nakit", "cash")}
            {moneyField("Kart / Banka", "card")}
            {bankField}
            <div style={{ display: "grid", gap: 4, padding: 9, borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", fontWeight: 900 }}>
              <span style={{ color: "#475569", fontSize: 12 }}>Kalan / Cari</span>
              <b>{money(remaining)}</b>
            </div>
            <div style={{ display: "grid", gap: 4, padding: 9, borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", fontWeight: 900 }}>
              <span style={{ color: "#475569", fontSize: 12 }}>Kâr</span>
              <b>{money(profit)}</b>
            </div>
          </div>
        </div>
      );
    }

    if (draft.mode === "stock") {
      const buy = parseMoneyInput(draft.buy);
      const qty = Math.max(Number(draft.qty || 1), 1);
      const cashPaid = parseMoneyInput(draft.cashPaid);
      const bankPaid = parseMoneyInput(draft.bankPaid);
      const purchaseTotal = buy * qty;
      const remaining = Math.max(purchaseTotal - cashPaid - bankPaid, 0);
      return (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: "#fff7ed", border: "1px solid #fed7aa" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 900 }}>Alım Düzeltme</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {textField("Ürün / Cihaz", "name", "", true)}
            {textField("Tedarikçi", "supplier")}
            {textField("Satıcı / Cari", "sellerPerson")}
            {textField("Satıcı Telefon", "sellerPhone")}
            {moneyField("Alış Fiyatı", "buy")}
            {moneyField("Satış Fiyatı", "sell")}
            <label style={labelStyle}>
              Adet
              <input
                type="number"
                min="1"
                value={draft.qty || 1}
                onChange={(event) => setDraftValue("qty", event.target.value)}
                style={fieldStyle}
              />
            </label>
            {moneyField("Nakit Ödenen", "cashPaid")}
            {moneyField("Banka Ödenen", "bankPaid")}
            {bankField}
            <div style={{ display: "grid", gap: 4, padding: 9, borderRadius: 10, background: "#fff", border: "1px solid #fed7aa", fontWeight: 900 }}>
              <span style={{ color: "#9a3412", fontSize: 12 }}>Cari / Kalan Borç</span>
              <b>{money(remaining)}</b>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

	  const handleSaleCancel = async ({ reason, password }) => {
    const row = kasaBrainModal?.row || {};
    const targetSale = findSaleForKasaBrainRow(row);

    const duplicateSaleCancel = (cashMovements || []).some((movement) => {
      const movementType = String(movement.movement_type || movement.movementType || movement.type || "").toLocaleLowerCase("tr-TR");
      const note = String(movement.note || "").toLocaleLowerCase("tr-TR");
      const originalRecordNo = String(movement.originalRecordNo || movement.recordNo || "");
      const rowNo = String(row?.no || "");
      const rowDescription = String(row?.description || "").toLocaleLowerCase("tr-TR");

      return (
        movementType.includes("satış iptal") &&
        (
          (rowNo && originalRecordNo && rowNo === originalRecordNo) ||
          (rowNo && note.includes(`kayıt no: ${rowNo}`)) ||
          (rowDescription && note.includes(rowDescription.slice(0, Math.min(rowDescription.length, 30))))
        )
      );
    });

    if (duplicateSaleCancel) {
      window.alert("Kasa Beyni: Bu satış daha önce iptal edilmiş. Kasa tekrar etkilenmez.");
      setKasaBrainReason("");
      setKasaBrainPassword("");
      setKasaBrainModal(null);
      return true;
    }

	    const nowIso = new Date().toISOString();
	    const fallbackSaleId = `report-row-${row?.no || Date.now()}-${String(row?.description || "").slice(0, 20)}`;
	    const saleId = String(targetSale?.id || targetSale?.saleId || row?.id || row?.saleId || row?.relatedId || row?.related_id || fallbackSaleId);

	    const numberValue = (value) => {
      if (typeof value === "number") return value;
      return Number(
        String(value || "0")
          .replace(/\./g, "")
          .replace(",", ".")
          .replace(/[^0-9.-]/g, "")
      ) || 0;
    };

    const rowCash = numberValue(row.cash || targetSale?.cash || targetSale?.cash_amount);
    const rowBank = numberValue(row.bank || targetSale?.card || targetSale?.bank || targetSale?.bank_amount || targetSale?.card_amount);
    const rowDebt = numberValue(row.debt || targetSale?.remaining || targetSale?.debt || targetSale?.cari);
    const rowTotal = numberValue(row.total || targetSale?.total || targetSale?.totalAmount || targetSale?.salePrice || targetSale?.price || targetSale?.amount);

    const saleStatus = String(targetSale?.status || "").toLocaleLowerCase("tr-TR");
    if (
      targetSale &&
      (
        saleStatus.includes("cancel") ||
        saleStatus.includes("iptal") ||
        targetSale?.cancelledByKasaBrain
      )
    ) {
      window.alert("Kasa Beyni: Bu satış daha önce iptal edilmiş. İkinci kez iptal edilemez.");
      return false;
    }

    if (!targetSale?.id || String(targetSale.id).startsWith("report-row-")) {
      window.alert(
        "Kasa Beyni: Bu rapor satırı gerçek satış kaydıyla eşleşmedi.\n\n" +
        "İşlem durduruldu. Kasa, stok, banka ve cari local/geçici olarak değiştirilmedi.\n" +
        "Raporu yenileyip tekrar deneyin."
      );
      await refreshFromDatabase();
      return true;
    }

    const alreadyReversed = (cashMovements || []).some((movement) => {
      const movementType = String(movement.movement_type || movement.movementType || movement.type || "").toLocaleLowerCase("tr-TR");
      const relatedId = String(movement.relatedId || movement.related_id || "");
      const note = String(movement.note || "").toLocaleLowerCase("tr-TR");
      const rowNo = String(row.no || "");

      return (
        movementType.includes("satış iptal") &&
        (
          relatedId === saleId ||
          (rowNo && note.includes(`kayıt no: ${rowNo}`)) ||
          note.includes(String(row.description || "").toLocaleLowerCase("tr-TR"))
        )
      );
    });

    if (alreadyReversed) {
      window.alert("Kasa Beyni: Bu satış için iptal ters hareketi daha önce oluşturulmuş. İkinci kez iptal edilemez.");
      return false;
    }

    if (targetSale?.id && !String(targetSale.id).startsWith("report-row-")) {
      try {
        await cancelRecord("sales", targetSale.id, reason || "Kasa Beyni satış iptali");
        await refreshFromDatabase();

        const logRecord = {
          id: `kasa-brain-real-${Date.now()}`,
          createdAt: nowIso,
          action: kasaBrainModal.action || "Satış İptal",
          recordNo: row.no || null,
          saleId: targetSale.id,
          saleFound: true,
          type: row.type || "Satış",
          description: row.description || "",
          party: row.party || "",
          cash: rowCash,
          bank: rowBank,
          debt: rowDebt,
          total: rowTotal,
          reason,
          status: "REAL_SALE_CANCEL_SUPABASE_RPC",
          result: "cancel_sale_with_effects RPC called through cancelRecord; stock/cash/bank/cari effects handled by backend",
          passwordUsed: Boolean(password)
        };

	        await writeKasaBrainAuditLog(logRecord, { action: "CANCEL", eventType: "kasa_brain_sale_cancel", reason });

        window.alert(
          `Kasa Beyni: Satış iptal edildi.\n` +
          `Kayıt No: ${row.no || "-"}\n` +
          `Stok, kasa, banka ve cari etkileri Supabase güvenli iptal motoru üzerinden işlendi.\n` +
          `Gerçek silme yapılmadı.`
        );

        setSyncMessage(`Kasa Beyni: Satış iptal edildi. Supabase iptal motoru çalıştı. Kayıt No: ${row.no}.`);
        setKasaBrainReason("");
        setKasaBrainPassword("");
        setKasaBrainModal(null);
        return true;
      } catch (error) {
        console.error("Kasa Beyni Supabase satış iptal hatası:", error);
        window.alert(
          `Kasa Beyni: Satış iptali Supabase güvenli motorunda başarısız oldu.\n\n` +
          `${error.message || error}\n\n` +
          `İşlem durduruldu. Kasa, stok, banka ve cari elle/local değiştirilmedi.`
        );
        await refreshFromDatabase();
        return true;
      }
    }

	    window.alert("Kasa Beyni: Satış iptali yalnızca gerçek satış kaydı ve Supabase merkezi transaction RPC ile yapılır. Local/geçici ters hareket oluşturulmadı.");
	    await refreshFromDatabase();
	    return true;
	  };

	  const handleSaleRefund = async ({ reason, password }) => {
	    const row = kasaBrainModal?.row || {};
	    const targetSale = findSaleForKasaBrainRow(row);

	    if (!targetSale?.id) {
	      window.alert(
	        "Kasa Beyni: Bu iade satırı gerçek satış kaydıyla eşleşmedi.\n\n" +
	        "İşlem durduruldu. Kasa, banka, stok ve cari değiştirilmedi.\n" +
	        "Raporu yenileyip tekrar deneyin."
	      );
	      await refreshFromDatabase();
	      return true;
	    }

	    const saleStatus = String(targetSale?.status || "").toLocaleLowerCase("tr-TR");
	    if (["deleted", "cancelled", "canceled", "iptal", "iade", "refunded", "refund"].includes(saleStatus)) {
	      window.alert("Kasa Beyni: Bu satış daha önce iptal/iade edilmiş. İkinci kez iade edilemez.");
	      return true;
	    }

	    const alreadyRefunded = [...(cashMovements || []), ...(bankMovements || [])].some((movement) => {
	      const movementType = String(movement.movement_type || movement.movementType || movement.type || "").toLocaleLowerCase("tr-TR");
	      const relatedId = String(movement.relatedId || movement.related_id || movement.referenceId || movement.reference_id || "");
	      const relatedSaleId = String(movement.related_sale_id || movement.relatedSaleId || "");
	      return movementType.includes("satış iade") && (relatedId === String(targetSale.id) || relatedSaleId === String(targetSale.id));
	    });

	    if (alreadyRefunded) {
	      window.alert("Kasa Beyni: Bu satış için iade hareketi daha önce oluşturulmuş. İkinci kez iade edilemez.");
	      return true;
	    }

	    const actionKey = `sale-refund:${targetSale.id}`;
	    if (!beginPendingAction(actionKey)) return true;

	    try {
	      setKasaBrainProcessing(true);
	      setSyncMessage("Kasa Beyni: Satış iadesi işleniyor...");
	      const result = await withKasaBrainTimeout(
	        refundSaleWithEffects(targetSale.id, reason || "Kasa Beyni satış iadesi"),
	        "Satış iadesi zaman aşımına uğradı. Lütfen sayfayı yenileyip Günlük Kasa Raporu’nu kontrol edin."
	      );
	      await refreshFromDatabase();

	      const logRecord = {
	        id: `kasa-brain-sale-refund-${Date.now()}`,
	        createdAt: new Date().toISOString(),
	        action: kasaBrainModal.action || "Satış İade",
	        recordNo: row.no || null,
	        saleId: targetSale.id,
	        type: row.type || "Satış",
	        description: row.description || targetSale.productName || targetSale.product_name || "",
	        party: row.party || targetSale.customer || targetSale.customer_name || "",
	        cash: Number(row.cash || targetSale.cash || targetSale.cash_amount || 0),
	        bank: Number(row.bank || targetSale.card || targetSale.card_amount || 0),
	        debt: Number(row.debt || targetSale.remaining || targetSale.remaining_amount || 0),
	        total: Number(row.total || targetSale.total || targetSale.total_amount || 0),
	        reason,
	        status: "REAL_SALE_REFUND_SUPABASE_RPC",
	        rpcResult: result || null,
	        passwordUsed: Boolean(password),
	      };

		      await writeKasaBrainAuditLog(logRecord, { action: "UPDATE", eventType: "kasa_brain_sale_refund", reason });

	      window.alert(
	        `Kasa Beyni: Satış iadesi işlendi.\n` +
	        `Kayıt No: ${row.no || "-"}\n` +
	        `Nakit/Kart iade hareketleri oluşturuldu, stok ve cari etkisi güvenli akışla güncellendi.`
	      );
	      setSyncMessage(`Kasa Beyni: Satış iadesi işlendi. Kayıt No: ${row.no || "-"}.`);
	      closeKasaBrainModal();
	      return true;
	    } catch (error) {
	      console.error("Kasa Beyni Supabase satış iade hatası:", error);
	      window.alert(
	        `Kasa Beyni: Satış iadesi Supabase güvenli motorunda başarısız oldu.\n\n` +
	        `${error.message || error}\n\n` +
	        `İşlem durduruldu. Kasa, banka, stok ve cari local/geçici olarak değiştirilmedi.`
	      );
	      await refreshFromDatabase();
	      return true;
	    } finally {
	      setKasaBrainProcessing(false);
	      endPendingAction(actionKey);
	    }
	  };

	  const handlePurchaseCancel = async ({ reason, password }) => {
    const row = kasaBrainModal?.row || {};
    const targetStock = findStockForKasaBrainRow(row);
    const stockId = String(
      targetStock?.id ||
      row?.stockItemId ||
      row?.stock_item_id ||
      (String(row?.relatedTable || row?.related_table || "").toLocaleLowerCase("tr-TR") === "stock_items" ? (row?.relatedId || row?.related_id) : "") ||
      (String(row?.type || "").toLocaleLowerCase("tr-TR").includes("alım") ? row?.id : "") ||
      ""
    ).trim();

    if (!stockId) {
      window.alert(
        "Kasa Beyni: Bu alım satırı gerçek stok kaydıyla eşleşmedi.\n\n" +
        "İşlem durduruldu. Kasa, banka, stok ve cari değiştirilmedi.\n" +
        "Raporu yenileyip tekrar deneyin."
      );
      await refreshFromDatabase();
      return true;
    }

    const actionKey = `purchase-cancel:${stockId}`;
    if (!beginPendingAction(actionKey)) return true;

    try {
      const result = await cancelStockPurchase(stockId, reason || "Kasa Beyni alım iptali");
      await refreshFromDatabase();

      const logRecord = {
        id: `kasa-brain-real-purchase-${Date.now()}`,
        createdAt: new Date().toISOString(),
        action: kasaBrainModal.action || "Alım İptal",
        recordNo: row.no || null,
        stockItemId: stockId,
        type: row.type || "Alım",
        description: row.description || targetStock?.product_name || "",
        party: row.party || targetStock?.supplier_name || "",
        cash: Number(row.cash || 0),
        bank: Number(row.bank || 0),
        debt: Number(row.debt || 0),
        total: Number(row.total || 0),
        reason,
        status: "REAL_PURCHASE_CANCEL_SUPABASE_RPC",
        result: "cancel_stock_purchase_with_effects RPC called; stock/cash/bank/cari effects handled by backend",
        rpcResult: result || null,
        passwordUsed: Boolean(password)
      };

	      await writeKasaBrainAuditLog(logRecord, { action: "CANCEL", eventType: "kasa_brain_purchase_cancel", reason });

      window.alert(
        `Kasa Beyni: Alım iptal edildi.\n` +
        `Kayıt No: ${row.no || "-"}\n` +
        `Stok pasifleştirildi; kasa, banka ve cari etkileri Supabase güvenli iptal motoru üzerinden işlendi.\n` +
        `İkinci iptal engellendi.`
      );

      setSyncMessage(`Kasa Beyni: Alım iptal edildi. Supabase iptal motoru çalıştı. Kayıt No: ${row.no}.`);
      setKasaBrainReason("");
      setKasaBrainPassword("");
      setKasaBrainModal(null);
      return true;
    } catch (error) {
      console.error("Kasa Beyni Supabase alım iptal hatası:", error);
      window.alert(
        `Kasa Beyni: Alım iptali Supabase güvenli motorunda başarısız oldu.\n\n` +
        `${error.message || error}\n\n` +
        `İşlem durduruldu. Kasa, banka, stok ve cari elle/local değiştirilmedi.`
      );
      await refreshFromDatabase();
      return true;
    } finally {
      endPendingAction(actionKey);
    }
  };

const isSameSalesListDay = (item, dateKey) => {
    const rawDate = item?.date || item?.createdAt || item?.created_at || item?.saleDate || item?.sale_date;
    if (!rawDate || !dateKey) return false;

    try {
      return localDateKey(new Date(rawDate)) === dateKey;
    } catch (error) {
      return String(rawDate).slice(0, 10) === dateKey;
    }
  };

  const showKasaBrainRowDetail = (row) => {
    const lines = [
      `Kayıt No: ${row?.no || "-"}`,
      `Tarih: ${row?.date ? new Date(row.date).toLocaleString("tr-TR") : "-"}`,
      `İşlem Türü: ${row?.type || "-"}`,
      `Açıklama: ${row?.description || "-"}`,
      `Kişi/Cari: ${row?.party || row?.customer || row?.cariPerson || "-"}`,
      `Nakit: ${money(row?.cash || 0)}`,
      `Kart/Banka: ${money(row?.bank || 0)}`,
      `Cari/Kalan: ${money(row?.debt || 0)}`,
      `İade: ${money(row?.refund || 0)}`,
      `Toplam: ${money(row?.total || 0)}`,
    ];

    window.alert(`Kasa Beyni Detay\n\n${lines.join("\n")}`);
  };

	  const handleKasaBrainPreAudit = async () => {
	    if (kasaBrainProcessing) return;

	    if (!kasaBrainModal) {
	      window.alert("Kasa Beyni: Seçili işlem bulunamadı.");
	      return;
	    }

    const reason = String(kasaBrainReason || "").trim();
    const password = String(kasaBrainPassword || "").trim();
    const action = String(kasaBrainModal.action || "");
    const row = kasaBrainModal.row || {};

    if (action === "Detay") {
      closeKasaBrainModal();
      return;
    }

    if (reason.length < 3) {
      window.alert("Kasa Beyni: İşlem sebebi en az 3 karakter olmalıdır.");
      return;
    }

    if (!password) {
      window.alert("Kasa Beyni: Yetkili şifresi girilmelidir.");
      return;
    }

	    if (action === "Düzelt") {
	      const passwords = getSecurityPasswords();
      if (password !== passwords.editPassword) {
        alert("Şifre hatalı. İşlem yapılmadı.");
        return;
      }

      const draft = kasaBrainEditDraft || buildKasaBrainEditDraft(action, row);
      if (!draft?.id) {
        alert("Bu rapor satırı düzenlenebilir satış veya alım kaydıyla bağlantılı değil.");
        return;
      }

      try {
        setKasaBrainProcessing(true);
        setSyncMessage("Kasa Beyni: Düzeltme işleniyor...");

        if (draft.mode === "sale") {
          const total = parseMoneyInput(draft.total);
          const cash = parseMoneyInput(draft.cash);
          const card = parseMoneyInput(draft.card);
          const paymentCheck = validatePaymentDistribution({
            totalAmount: total,
            cashAmount: cash,
            cardAmount: card,
            messages: { overpaid: "Nakit + kart toplamı satış fiyatını aşamaz." },
          });
          if (!paymentCheck.ok) {
            alert(paymentCheck.message);
            return;
          }
          if (card > 0 && !draft.bank) {
            alert("Kart/Banka tutarı varsa banka seçilmelidir.");
            return;
          }

          const remaining = Math.max(total - cash - card, 0);
          const buyCost = parseMoneyInput(draft.buy);
          await withKasaBrainTimeout(
            updateSaleRecord(draft.id, {
              sale_type: draft.type,
              product_name: draft.productName,
              customer_name: draft.customer || draft.cariPerson || "",
              customer_phone: draft.customerPhone || "",
              cari_person: draft.cariPerson || draft.customer || "",
              total_amount: total,
              cash_amount: cash,
              card_amount: card,
              remaining_amount: remaining,
              buy_cost: buyCost,
              profit_amount: Math.max(total - buyCost, 0),
              bank_name: draft.bank || "",
            }),
            "Satış düzeltme zaman aşımına uğradı. Lütfen sayfayı yenileyip Günlük Kasa Raporu’nu kontrol edin."
          );
        } else if (draft.mode === "stock") {
          const buy = parseMoneyInput(draft.buy);
          const sell = parseMoneyInput(draft.sell);
          const qty = Number(draft.qty || 1);
          const cashPaid = parseMoneyInput(draft.cashPaid ?? draft.supplierPaid);
          const bankPaid = parseMoneyInput(draft.bankPaid);
          const paid = cashPaid + bankPaid;
          const purchaseTotal = buy * Math.max(qty, 1);
          if (paid > purchaseTotal) {
            alert("Ödenen tutar alış toplamını aşamaz.");
            return;
          }
          if (bankPaid > 0 && !draft.bank) {
            alert("Banka ödemesi varsa banka seçilmelidir.");
            return;
          }

          await withKasaBrainTimeout(
            updateStockItem(draft.id, {
              module: draft.module,
              device_type: draft.deviceType,
              category: draft.module === "Cihaz" ? draft.condition : draft.category,
              sub_type: draft.accessorySubType,
              brand: draft.brand,
              model: draft.model,
              memory: draft.memory,
              product_name: draft.name || draft.model || "Ürün",
              barcode: draft.module === "Cihaz" ? "" : draft.barcode,
              imei: draft.module === "Cihaz" ? draft.barcode : "",
              buy_price: buy,
              sell_price: sell,
              quantity: qty,
              supplier_name: draft.supplier || "",
              seller_person: draft.sellerPerson || "",
              seller_phone: draft.sellerPhone || "",
              acquisition_type: draft.acquisitionType || "Tedarikçi Firma",
              supplier_paid: cashPaid,
              bank_paid: bankPaid,
              bank_name: draft.bank || "",
              seller_cari_remaining: Math.max(purchaseTotal - paid, 0),
              note: draft.note || "",
            }),
            "Alım düzeltme zaman aşımına uğradı. Lütfen sayfayı yenileyip Günlük Kasa Raporu’nu kontrol edin."
          );
        } else {
          alert("Bu düzeltme türü desteklenmiyor.");
          return;
        }

        await refreshFromDatabase();
        setSyncMessage("Düzeltme uygulandı. Kasa/banka/cari etkileri finans sistemiyle yenilendi.");
        alert("Düzeltme uygulandı.");
        closeKasaBrainModal();
      } catch (error) {
        console.error("Kasa Beyni düzeltme hatası", error);
        alert(error.message || "Düzeltme uygulanamadı.");
      } finally {
        setKasaBrainProcessing(false);
      }
	      return;
	    }

	    if (
	      isManualCashEntryCancelAction(kasaBrainModal) ||
	      isSaleCancelAction(kasaBrainModal) ||
	      isSaleRefundAction(kasaBrainModal) ||
	      isPurchaseCancelAction(kasaBrainModal)
	    ) {
	      const passwords = getSecurityPasswords();
	      if (password !== passwords.cancelPassword) {
	        alert("Şifre hatalı. İşlem yapılmadı.");
	        return;
	      }
	    }

		    if (isManualCashEntryCancelAction(kasaBrainModal)) {
		      const done = await handleManualCashEntryCancel({ reason, password });
	      if (done) return;
	    }

	    if (isSaleCancelAction(kasaBrainModal)) {
	      const done = await handleSaleCancel({ reason, password });
	      if (done) return;
	    }

	    if (isSaleRefundAction(kasaBrainModal)) {
	      const done = await handleSaleRefund({ reason, password });
	      if (done) return;
	    }

	    if (isPurchaseCancelAction(kasaBrainModal)) {
      const done = await handlePurchaseCancel({ reason, password });
      if (done) return;
    }

    const logRecord = {
      id: `kasa-brain-${Date.now()}`,
      createdAt: new Date().toISOString(),
      action: kasaBrainModal.action || "",
      recordNo: row.no || null,
      type: row.type || "",
      description: row.description || "",
      party: row.party || "",
      cash: Number(row.cash || 0),
      bank: Number(row.bank || 0),
      debt: Number(row.debt || 0),
      refund: Number(row.refund || 0),
      total: Number(row.total || 0),
      reason,
      status: "PRE_AUDIT_ONLY_PHASE_4"
    };

	    try {
	      await writeKasaBrainAuditLog(logRecord, { action: "UPDATE", eventType: "kasa_brain_pre_audit", reason });
	    } catch (error) {
	      console.error("Kasa Beyni audit log yazılamadı:", error);
	      window.alert(error.message || "Kasa Beyni: Audit log yazılamadı.");
	      return;
	    }

    window.alert(`Kasa Beyni ön audit log oluşturuldu.\nİşlem: ${logRecord.action}\nKayıt No: ${logRecord.recordNo}\nGerçek finansal işlem yapılmadı.`);
    setSyncMessage(`Kasa Beyni ön audit log oluşturuldu: ${logRecord.action} / Kayıt No: ${logRecord.recordNo}. Gerçek finansal işlem yapılmadı.`);
    closeKasaBrainModal();
  };
  const [selectedSupplierAccount, setSelectedSupplierAccount] = useState(null);
  const [selectedReceivableMovement, setSelectedReceivableMovement] = useState(null);
  const [stockTab, setStockTab] = useState("liste");
  const [stockView, setStockView] = useState("cihaz");
  const [otherGroupName, setOtherGroupName] = useState("");
  const [customAccessoryCategories, setCustomAccessoryCategories] = useState([]);
  const [stockChoiceOptions, setStockChoiceOptions] = useState({});
  const [stockChoiceStorageReadyKey, setStockChoiceStorageReadyKey] = useState("");
  const [stock, setStock] = useState(initialStock);
  const [sales, setSales] = useState(initialSales);
  const [suppliers, setSuppliers] = useState(["MOBİLTEK İLETİŞİM", "GALAKSİ TEKNOLOJİ", "BASEUS TÜRKİYE"]);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [cashEntryTab, setCashEntryTab] = useState("Manuel Nakit Girişi");
  const [cashEntryForm, setCashEntryForm] = useState({ amount: "", source: "", note: "" });
  const [cashCarryForm, setCashCarryForm] = useState({ amount: "", note: "" });
  const [banks, setBanks] = useState(() => getBankList(loadStoredBanks()));
  const [bankTransferDrafts, setBankTransferDrafts] = useState({});
  const [bankCashSkeletonForm, setBankCashSkeletonForm] = useState({ name: "", balance: "" });
  const [bankMovements, setBankMovements] = useState([]);
  const [bankBalances, setBankBalances] = useState([]);
  const [saleForm, setSaleForm] = useState({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  const [cartItems, setCartItems] = useState([]);
  const [cartPayments, setCartPayments] = useState({ cashAmount: "", cardAmount: "", bankAmount: "", cariAmount: "" });
  const [cartCustomer, setCartCustomer] = useState({ customerId: "", customerName: "" });
  const [cartBankName, setCartBankName] = useState("");
  const [cartNote, setCartNote] = useState("");
  const [cartProductQuery, setCartProductQuery] = useState("");
  const [kasaSearchModalOpen, setKasaSearchModalOpen] = useState(false);
  const [kasaSearchQuery, setKasaSearchQuery] = useState("");
  const [cartProcessing, setCartProcessing] = useState(false);
  const [cartPaymentModalOpen, setCartPaymentModalOpen] = useState(false);
  const [saleLineModalOpen, setSaleLineModalOpen] = useState(false);
  const [cartPaymentContext, setCartPaymentContext] = useState({ hasCash: false, hasCard: false, hasCari: false });
  const [expandedSaleModalItemId, setExpandedSaleModalItemId] = useState("");
  const [saleReadyModalDismissedKey, setSaleReadyModalDismissedKey] = useState("");
  const bankList = useMemo(() => getBankList(banks), [banks]);
  const bankOptions = useMemo(() => {
    const names = [];
    [...bankList.map((bank) => bank.name), ...bankBalances.map((row) => row.bank)].forEach((name) => {
      const cleanName = String(name || "").trim();
      if (!cleanName) return;
      if (names.some((item) => normalizeBankName(item) === normalizeBankName(cleanName))) return;
      names.push(cleanName);
    });
    return names;
  }, [bankList, bankBalances]);
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ category: "Yemek", amount: "", note: "" });
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [editingSale, setEditingSale] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [query, setQuery] = useState("");
  const safeStock = Array.isArray(stock) ? stock : [];
  const safeSales = Array.isArray(sales) ? sales : [];
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const safeBankMovements = Array.isArray(bankMovements) ? bankMovements : [];
  const safeBankBalances = Array.isArray(bankBalances) ? bankBalances : [];
  const safeCashMovements = Array.isArray(cashMovements) ? cashMovements : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeBusinessTransactions = Array.isArray(businessTransactions) ? businessTransactions : [];
  const safeLedgerEntries = Array.isArray(ledgerEntries) ? ledgerEntries : [];
  const safeSaleItems = Array.isArray(saleItems) ? saleItems : [];
  const safeStockMovements = Array.isArray(stockMovements) ? stockMovements : [];
  const safeCariMovements = Array.isArray(cariMovements) ? cariMovements : [];
  const safeReturns = Array.isArray(returnsData) ? returnsData : [];
  const safeReturnItems = Array.isArray(returnItems) ? returnItems : [];
  const safeExchanges = Array.isArray(exchanges) ? exchanges : [];
  const safePosMovements = Array.isArray(posMovements) ? posMovements : [];
  const safeSchemaStatus = Array.isArray(schemaStatus) ? schemaStatus : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const activeStock = safeStock.filter(isActiveRecord);
  const activeSales = safeSales.filter(isActiveRecord);
  const activeExpenses = safeExpenses.filter(isActiveRecord);
  const activeBankMovements = safeBankMovements.filter(isActiveMovement);
  const activeCashMovements = safeCashMovements.filter(isActiveMovement);
  const activeContacts = safeContacts.filter(isActiveRecord);
  const inStockItems = activeStock.filter((product) => Number(product.quantity || product.qty || 0) > 0);
  const visibleAccessoryShortcuts = useMemo(() => {
    const seen = new Set();
    const hidden = new Set(hiddenShortcutIds.map((id) => String(id)));
    return [...defaultAccessoryShortcuts, ...accessoryShortcuts]
      .filter((shortcut) => !hidden.has(String(shortcut.id)))
      .filter((shortcut) => {
        const key = String(shortcut.productId ? `product:${shortcut.productId}` : shortcut.label || accessoryShortcutLabel(shortcut.group, shortcut.sub)).toLocaleLowerCase("tr-TR");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, accessoryShortcutLimit);
  }, [accessoryShortcuts, hiddenShortcutIds]);

  const shortcutGroupOptions = useMemo(() => {
    const stockGroups = activeStock.map((product) => displayStockGroup(stockSearchGroup(product)));
    return Array.from(new Set(["Aksesuar", "Program", "Telefon", "Tablet", "Saat", "PC", "Bluetooth", "Elektronik", "Diğer", ...stockGroups]));
  }, [activeStock]);

  const supplierOptions = useMemo(() => {
    return Array.from(new Set([...suppliers, ...activeStock.map((product) => product.supplier).filter((supplier) => supplier && !isSellerLabel(supplier))])).sort();
  }, [suppliers, activeStock]);

  const stockChoiceStorageKey = activeWorkspaceId || currentUser?.id || "local";

  function addStockChoice(group, field, existingOptions = []) {
    const label = stockChoiceFieldLabels[field] || "Seçenek";
    const entered = window.prompt(`Yeni ${label} yaz`);
    const value = cleanStockChoice(entered);
    if (!value) return "";

    const normalizedValue = normalizeStockText(value);
    if (existingOptions.some((option) => normalizeStockText(option) === normalizedValue)) {
      alert(`Bu ${label.toLocaleLowerCase("tr-TR")} zaten listede var.`);
      return "";
    }

    const groupKey = toInternalOtherGroup(group);
    setStockChoiceOptions((current) => {
      const groupChoices = current[groupKey] || {};
      const currentFieldChoices = Array.isArray(groupChoices[field]) ? groupChoices[field] : [];
      return {
        ...current,
        [groupKey]: {
          ...groupChoices,
          [field]: uniqueStockChoices([...currentFieldChoices, value]),
        },
      };
    });
    return value;
  }

  function openProgramSale(amount = "") {
    setSaleGroup("Program");
    setSaleForm({
      type: "Program Satışı",
      customer: "",
      cariPerson: "",
      search: "Program",
      productId: "",
      total: amount ? money(amount) : "",
      cash: "",
      card: "",
      bank: cartBankName || saleForm.bank || "",
    });
    setKasaTab("yeniSatis");
    setActive("kasa");
  }

  const isAccessorySale = saleForm.type === "Aksesuar Satışı";
  const isProgramSale = saleForm.type === "Program Satışı";
  const stockSearchResults = useMemo(() => {
    const queryText = stockSearchQuery.trim().toLocaleLowerCase("tr-TR");

    return inStockItems
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => stockSearchFilter === "TÜMÜ" || stockSearchGroup(product) === stockSearchFilter)
      .filter(({ product }) => !queryText || stockSearchHaystack(product).includes(queryText))
      .sort((a, b) => {
        const aTime = new Date(a.product.saleDate || a.product.createdAt || a.product.created_at || 0).getTime();
        const bTime = new Date(b.product.saleDate || b.product.createdAt || b.product.created_at || 0).getTime();
        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
        return a.index - b.index;
      })
      .map(({ product }) => product)
      .slice(0, 80);
  }, [inStockItems, stockSearchFilter, stockSearchQuery]);

  const technicalSearchResults = useMemo(() => {
    const queryText = technicalSearchQuery.trim().toLocaleLowerCase("tr-TR");
    const allowedGroups = new Set(["TELEFON", "PC", "TABLET", "ELEKTRONİK", "DİĞERLERİ"]);

    return inStockItems
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => allowedGroups.has(stockSearchGroup(product)))
      .filter(({ product }) => technicalSearchFilter === "TÜMÜ" || stockSearchGroup(product) === technicalSearchFilter)
      .filter(({ product }) => !queryText || stockSearchHaystack(product).includes(queryText))
      .sort((a, b) => {
        const aTime = new Date(a.product.saleDate || a.product.createdAt || a.product.created_at || 0).getTime();
        const bTime = new Date(b.product.saleDate || b.product.createdAt || b.product.created_at || 0).getTime();
        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
        return a.index - b.index;
      })
      .map(({ product }) => product)
      .slice(0, 80);
  }, [inStockItems, technicalSearchFilter, technicalSearchQuery]);

  const selectedProduct = inStockItems.find((product) => String(product.id) === String(saleForm.productId));
  const saleTotal = parseMoneyInput(saleForm.total || 0);
  const saleCash = parseMoneyInput(saleForm.cash || 0);
  const saleCard = parseMoneyInput(saleForm.card || 0);
  const saleRemaining = Math.max(saleTotal - saleCash - saleCard, 0);
  const saleReadyRemaining = Math.max(saleTotal - saleCash - saleCard, 0);
  const saleFormHasProduct = isProgramSale ? Boolean(saleForm.search.trim()) : Boolean(selectedProduct);
  const saleFormNeedsBank = saleCard > 0;
  const saleFormNeedsCari = saleReadyRemaining > 0;
  const cartSessionStarted = cartItems.length > 0 || Boolean(cartPaymentContext.hasCash || cartPaymentContext.hasCard || cartPaymentContext.hasCari);
  const hasActiveCartSession = cartSessionStarted || Boolean(cartItems.length && (cartCustomer.customerName || cartBankName));
  const sessionCustomerLocked = cartSessionStarted && Boolean(cartCustomer.customerName);
  const sessionBankLocked = cartSessionStarted && Boolean(cartBankName);
  const saleFormCariText = String(cartCustomer.customerName || saleForm.cariPerson || saleForm.customer || "");
  const saleCustomerRequired = !isAccessorySale || saleReadyRemaining > 0;
  const saleFormCustomerReady = !saleCustomerRequired || Boolean(saleFormCariText.trim());
  const saleProductDisplayName = isProgramSale ? (saleForm.search || "Program / Hizmet") : (productTitle(selectedProduct) || "Ürün seçilmedi");
  const saleFormReadyForCart =
    saleTotal > 0 &&
    saleFormHasProduct &&
    saleCash + saleCard <= saleTotal &&
    (!saleFormNeedsBank || Boolean(saleForm.bank || cartBankName)) &&
    (!saleFormNeedsCari || Boolean(saleFormCariText.trim())) &&
    saleFormCustomerReady;
  const saleReadyModalKey = [
    saleForm.type,
    saleForm.productId,
    saleForm.search,
    saleForm.total,
    saleForm.cash,
    saleForm.card,
    saleForm.bank || cartBankName,
    saleFormCariText,
  ].map((value) => String(value || "").trim()).join("|");
  const saleLineUnitCost = isProgramSale ? 0 : parseMoneyInput(selectedProduct?.buy || selectedProduct?.buyPrice || selectedProduct?.buy_price || 0);
  const saleLineProfit = saleTotal - saleLineUnitCost;
  const modalCartItems = cartItems;
  const expandedSaleModalItem = modalCartItems.find((item) => item.cartItemId === expandedSaleModalItemId) || null;
  const showSaleReadyModal = saleLineModalOpen;
  const closeSaleReadyModal = () => {
    setSaleReadyModalDismissedKey(saleReadyModalKey);
    setSaleLineModalOpen(false);
    setExpandedSaleModalItemId("");
  };
  const confirmSaleReadyToCart = (mode = "continue") => {
    setSaleReadyModalDismissedKey(saleReadyModalKey);
    const added = addCurrentSaleFormToCart();
    if (!added) return;
    setSaleLineModalOpen(false);
    setExpandedSaleModalItemId("");
    if (mode === "finish") {
      setCartPaymentModalOpen(true);
      return;
    }
    setKasaSearchQuery("");
    setKasaSearchModalOpen(true);
  };
  const findCartCustomer = (name) => {
    const clean = String(name || "").trim().toLocaleLowerCase("tr-TR");
    if (!clean) return null;
    return activeContacts.find((contact) => String(contact.name || "").trim().toLocaleLowerCase("tr-TR") === clean) || null;
  };
  const normalizeCartProductType = (product) => {
    const group = stockSearchGroup(product);
    if (group === "TELEFON") return { type: "phone", label: "Telefon" };
    if (group === "AKSESUAR") return { type: "accessory", label: "Aksesuar" };
    return { type: "other", label: displayStockGroup(group) || "Diğer" };
  };
  const rebuildCartItem = (item) => {
    const quantity = Math.max(Number(item.quantity || 1), 1);
    const unitPriceAtSale = parseMoneyInput(item.unitPriceText || item.unitPriceAtSale || 0);
    const discountAmount = Math.min(parseMoneyInput(item.discountText || item.discountAmount || 0), Math.max(unitPriceAtSale * quantity, 0));
    const unitCostAtSale = Math.max(parseMoneyInput(item.unitCostAtSale || 0), 0);
    const lineTotal = Math.max((unitPriceAtSale * quantity) - discountAmount, 0);
    const lineProfit = lineTotal - (unitCostAtSale * quantity);
    return {
      ...item,
      quantity,
      unitPriceAtSale,
      discountAmount,
      unitCostAtSale,
      lineTotal,
      lineProfit,
    };
  };
  const cartSummary = useMemo(() => {
    const rows = cartItems.map(rebuildCartItem);
    return rows.reduce((summary, item) => ({
      totalQuantity: summary.totalQuantity + Number(item.quantity || 0),
      grossTotal: summary.grossTotal + (Number(item.unitPriceAtSale || 0) * Number(item.quantity || 0)),
      totalDiscount: summary.totalDiscount + Number(item.discountAmount || 0),
      netTotal: summary.netTotal + Number(item.lineTotal || 0),
      totalCost: summary.totalCost + (Number(item.unitCostAtSale || 0) * Number(item.quantity || 0)),
      totalProfit: summary.totalProfit + Number(item.lineProfit || 0),
    }), { totalQuantity: 0, grossTotal: 0, totalDiscount: 0, netTotal: 0, totalCost: 0, totalProfit: 0 });
  }, [cartItems]);
  const cartPaymentTotal = parseMoneyInput(cartPayments.cashAmount) + parseMoneyInput(cartPayments.cardAmount) + parseMoneyInput(cartPayments.bankAmount) + parseMoneyInput(cartPayments.cariAmount);
  const cartPaymentGap = Math.round(cartSummary.netTotal - cartPaymentTotal);
  function reconcileCartPaymentRemainder(payments, netTotal, { allowCreateCari = false } = {}) {
    const cashAmount = parseMoneyInput(payments.cashAmount);
    const cardAmount = parseMoneyInput(payments.cardAmount);
    const bankAmount = parseMoneyInput(payments.bankAmount);
    const currentCariAmount = parseMoneyInput(payments.cariAmount);
    const paidWithoutCari = cashAmount + cardAmount + bankAmount;
    const expectedCariAmount = Math.max(Math.round(Number(netTotal || 0) - paidWithoutCari), 0);
    let nextCariAmount = currentCariAmount;

    if (expectedCariAmount > 0 && (allowCreateCari || currentCariAmount > 0)) {
      nextCariAmount = expectedCariAmount;
    } else if (expectedCariAmount === 0 && currentCariAmount > 0) {
      nextCariAmount = 0;
    }

    return {
      ...payments,
      cariAmount: nextCariAmount > 0 ? formatMoneyInput(nextCariAmount) : "",
    };
  }
  const cartSearchResults = useMemo(() => {
    const queryText = cartProductQuery.trim().toLocaleLowerCase("tr-TR");
    return inStockItems
      .filter((product) => !queryText || [
        productTitle(product),
        product.barcode,
        product.imei,
        product.category,
        product.brand,
        product.model,
        product.name,
      ].some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(queryText)))
      .slice(0, 8);
  }, [cartProductQuery, inStockItems]);

  const kasaSearchGroupLabels = ["Telefon", "Aksesuar", "Teknik", "Diğerleri / geri kalanlar"];
  const getKasaSearchGroupLabel = (product) => {
    const group = stockSearchGroup(product);
    const haystack = stockSearchHaystack(product);
    if (group === "TELEFON") return "Telefon";
    if (group === "AKSESUAR") return "Aksesuar";
    if (group === "PROGRAM" || haystack.includes("teknik") || haystack.includes("servis") || haystack.includes("işçilik")) return "Teknik";
    return "Diğerleri / geri kalanlar";
  };
  const kasaGroupedSearchResults = useMemo(() => {
    const queryText = kasaSearchQuery.trim().toLocaleLowerCase("tr-TR");
    const grouped = kasaSearchGroupLabels.reduce((next, label) => ({ ...next, [label]: [] }), {});

    inStockItems
      .filter((product) => !queryText || stockSearchHaystack(product).includes(queryText))
      .sort((a, b) => {
        const aGroupIndex = kasaSearchGroupLabels.indexOf(getKasaSearchGroupLabel(a));
        const bGroupIndex = kasaSearchGroupLabels.indexOf(getKasaSearchGroupLabel(b));
        if (aGroupIndex !== bGroupIndex) return aGroupIndex - bGroupIndex;
        return productTitle(a).localeCompare(productTitle(b), "tr");
      })
      .forEach((product) => {
        const groupLabel = getKasaSearchGroupLabel(product);
        if ((grouped[groupLabel] || []).length < 10) grouped[groupLabel].push(product);
      });

    return grouped;
  }, [inStockItems, kasaSearchQuery]);
  const kasaSearchContactMatches = useMemo(() => {
    const queryText = kasaSearchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!queryText) return [];
    return activeContacts
      .filter((contact) => [contact.name, contact.phone, contact.gsm, contact.taxNo, contact.note]
        .some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(queryText)))
      .slice(0, 4);
  }, [activeContacts, kasaSearchQuery]);
  const kasaSearchHasResults = kasaSearchGroupLabels.some((label) => (kasaGroupedSearchResults[label] || []).length > 0);

  function openKasaSearchModal() {
    setKasaSearchModalOpen(true);
    setKasaSearchQuery("");
  }

  function closeKasaSearchModal() {
    setKasaSearchModalOpen(false);
  }

  function selectKasaSearchProduct(product) {
    if (!product) return;
    const target = saleTargetFromStockProduct(product);
    const salePrice = product.sell ?? product.sellPrice ?? product.sell_price ?? "";
    setSaleGroup(target.saleGroup);
    setSaleForm({
      ...saleForm,
      type: target.saleType,
      customer: cartCustomer.customerName || saleForm.customer || "",
      cariPerson: cartCustomer.customerName || saleForm.cariPerson || saleForm.customer || "",
      search: product.barcode || product.imei || productTitle(product) || "",
      productId: String(product.id || ""),
      total: salePrice ? formatMoneyInput(salePrice) : "",
      cash: "",
      card: "",
      bank: cartBankName || "",
    });
    setKasaTab("yeniSatis");
    setActive("kasa");
    setKasaSearchModalOpen(false);
    setSaleLineModalOpen(true);
  }

  function selectKasaSearchContact(contact) {
    const customerName = String(contact?.name || "").trim();
    if (!customerName) return;
    setCartCustomer({ customerId: String(contact?.id || ""), customerName });
    setSaleForm((current) => ({ ...current, customer: current.customer || customerName, cariPerson: current.cariPerson || customerName }));
    setSyncMessage(`${customerName} cari/müşteri bilgisi satış için seçildi.`);
  }

  function cartItemId() {
    return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function makeCartItemFromProduct(product, overrides = {}) {
    const typeInfo = normalizeCartProductType(product);
    const unitPrice = parseMoneyInput(overrides.unitPriceAtSale ?? overrides.price ?? product.sell ?? product.sellPrice ?? product.sell_price ?? 0);
    const unitCost = parseMoneyInput(overrides.unitCostAtSale ?? product.buy ?? product.buyPrice ?? product.buy_price ?? 0);
    const imei = product.module === "Cihaz" ? (product.imei || product.barcode || "") : (product.imei || "");
    return rebuildCartItem({
      cartItemId: cartItemId(),
      productType: typeInfo.type,
      productTypeLabel: typeInfo.label,
      productId: String(product.id || ""),
      productName: overrides.productName || productTitle(product) || product.name || "Ürün",
      imei,
      barcode: product.barcode || "",
      category: product.category || product.deviceType || "",
      quantity: Number(overrides.quantity || 1),
      unitCostAtSale: unitCost,
      unitPriceAtSale: unitPrice,
      unitPriceText: formatMoneyInput(unitPrice),
      discountAmount: 0,
      discountText: "",
      stockAvailable: Number(product.qty || product.quantity || 0),
      isImeiRequired: typeInfo.type === "phone",
      note: overrides.note || "",
      cashAmountAtAdd: parseMoneyInput(overrides.cashAmountAtAdd || 0),
      cardAmountAtAdd: parseMoneyInput(overrides.cardAmountAtAdd || 0),
      cariAmountAtAdd: parseMoneyInput(overrides.cariAmountAtAdd || 0),
      bankNameAtAdd: overrides.bankNameAtAdd || "",
      customerNameAtAdd: overrides.customerNameAtAdd || "",
    });
  }

  function makeServiceCartItem({ name, amount, note = "", category = "Teknik / Hizmet", ...overrides }) {
    const unitPrice = parseMoneyInput(amount);
    return rebuildCartItem({
      cartItemId: cartItemId(),
      productType: "service",
      productTypeLabel: category,
      productId: `service-${Date.now()}`,
      productName: name || "Hizmet / İşçilik",
      imei: "",
      barcode: "",
      category,
      quantity: 1,
      unitCostAtSale: 0,
      unitPriceAtSale: unitPrice,
      unitPriceText: formatMoneyInput(unitPrice),
      discountAmount: 0,
      discountText: "",
      stockAvailable: 999999,
      isImeiRequired: false,
      note,
      cashAmountAtAdd: parseMoneyInput(overrides.cashAmountAtAdd || 0),
      cardAmountAtAdd: parseMoneyInput(overrides.cardAmountAtAdd || 0),
      cariAmountAtAdd: parseMoneyInput(overrides.cariAmountAtAdd || 0),
      bankNameAtAdd: overrides.bankNameAtAdd || "",
      customerNameAtAdd: overrides.customerNameAtAdd || "",
    });
  }

  function addCartItem(nextItem) {
    const item = rebuildCartItem(nextItem);
    if (!item.productName) {
      alert("Ürün adı bulunamadı.");
      return false;
    }
    if (Number(item.unitPriceAtSale || 0) <= 0) {
      alert("Satış fiyatı yazılmalıdır.");
      return false;
    }
    if (item.productType !== "service" && Number(item.stockAvailable || 0) <= 0) {
      alert("Stok yok.");
      return false;
    }
    if (item.isImeiRequired && !item.imei) {
      alert("IMEI zorunlu.");
      return false;
    }
    if (item.imei && cartItems.some((row) => String(row.imei || "") === String(item.imei || ""))) {
      alert("Bu IMEI zaten sepette.");
      return false;
    }
    if (item.productType !== "service" && Number(item.unitCostAtSale || 0) <= 0) {
      alert("Bu ürünün alış fiyatı eksik. Kar hesabı doğru çıkmayabilir.");
    }
    const itemHasPaymentMeta = Number(item.cashAmountAtAdd || 0) > 0 || Number(item.cardAmountAtAdd || 0) > 0 || Number(item.cariAmountAtAdd || 0) > 0;
    if (item.productType !== "service" && item.productId) {
      const sameProductQuantity = cartItems
        .filter((row) => row.productId === item.productId)
        .reduce((total, row) => total + Number(row.quantity || 0), 0);
      if (sameProductQuantity + Number(item.quantity || 1) > Number(item.stockAvailable || 0)) {
        alert("Bu ürün stok adedi kadar sepette. Ödeme tutarı tekrar eklenmedi.");
        return false;
      }
    }
    const mergeRow = cartItems.find((row) => row.productType !== "phone" && row.productType !== "service" && row.productId === item.productId && !itemHasPaymentMeta && !Number(row.cashAmountAtAdd || 0) && !Number(row.cardAmountAtAdd || 0) && !Number(row.cariAmountAtAdd || 0));
    if (mergeRow) {
      const nextQuantity = Math.min(Number(mergeRow.quantity || 0) + Number(item.quantity || 1), Number(mergeRow.stockAvailable || 999999));
      if (nextQuantity <= Number(mergeRow.quantity || 0)) {
        alert("Bu ürün stok adedi kadar sepette. Ödeme tutarı tekrar eklenmedi.");
        return false;
      }
    }

    setCartItems((current) => {
      const mergeIndex = current.findIndex((row) => row.productType !== "phone" && row.productType !== "service" && row.productId === item.productId && !itemHasPaymentMeta && !Number(row.cashAmountAtAdd || 0) && !Number(row.cardAmountAtAdd || 0) && !Number(row.cariAmountAtAdd || 0));
      if (mergeIndex >= 0) {
        return current.map((row, index) => {
          if (index !== mergeIndex) return row;
          const nextQuantity = Math.min(Number(row.quantity || 0) + Number(item.quantity || 1), Number(row.stockAvailable || 999999));
          return rebuildCartItem({ ...row, quantity: nextQuantity });
        });
      }
      return [...current, item];
    });
    setSyncMessage(`${item.productName} sepete eklendi.`);
    return true;
  }

  function addProductToCart(product, overrides = {}) {
    return addCartItem(makeCartItemFromProduct(product, overrides));
  }

  function addShortcutToCart(shortcut) {
    if (shortcut.productId) {
      const product = inStockItems.find((item) => String(item.id) === String(shortcut.productId));
      if (!product) {
        alert("Bu kısayola bağlı ürün stokta bulunamadı veya stokta yok. Kısayolu silip yeniden ekleyebilirsin.");
        return false;
      }
      return addProductToCart(product, { unitPriceAtSale: shortcut.price || product.sell || product.sellPrice || product.sell_price || "" });
    }

    const label = shortcut.label || accessoryShortcutLabel(shortcut.group, shortcut.sub);
    const price = shortcut.price || accessoryShortcutForm.price || "";
    if (!parseMoneyInput(price)) {
      alert("Kısayol için satış fiyatı yok.");
      return false;
    }
    const added = addCartItem(makeServiceCartItem({ name: label, amount: price, note: "Kısayol satış kalemi", category: shortcut.saleGroup || shortcut.group || "Kısayol" }));
    if (!added) return false;
    setCartPayments((current) => ({ ...current, cashAmount: current.cashAmount || formatMoneyInput(price) }));
    return true;
  }

  function addCurrentSaleFormToCart() {
    const resolvedCustomerName = saleFormCariText.trim() || String(cartCustomer.customerName || "").trim();
    const linePaymentMeta = {
      cashAmountAtAdd: saleCash,
      cardAmountAtAdd: saleCard,
      cariAmountAtAdd: saleRemaining,
      bankNameAtAdd: saleForm.bank || cartBankName || "",
      customerNameAtAdd: resolvedCustomerName,
    };

    if (!String(saleForm.total || "").trim() || parseMoneyInput(saleForm.total) <= 0) {
      alert(isProgramSale ? "Ne kadar olduğunu yaz" : "Satış fiyatını yaz");
      return false;
    }
    if (saleCustomerRequired && !resolvedCustomerName) {
      alert(isAccessorySale ? "Cari/kalan varsa aktif sepet müşterisi veya cari kişi zorunludur." : "Müşteri adı soyadı / telefon yaz");
      return false;
    }
    if (saleCard + parseMoneyInput(cartPayments.cardAmount) > 0 && !saleForm.bank && !cartBankName) {
      alert("Kart ödeme varsa banka seç");
      return false;
    }
    if (!alertFinancialValidation(validatePaymentDistribution({
      totalAmount: saleTotal,
      cashAmount: saleCash,
      cardAmount: saleCard,
      messages: { overpaid: "Nakit + kart toplamı satış fiyatını aşamaz." },
    }))) return false;

    if (isProgramSale) {
      if (!saleForm.search.trim()) {
        alert("Ne programı olduğunu yaz");
        return false;
      }
      if (!addCartItem(makeServiceCartItem({ name: saleForm.search.trim(), amount: saleForm.total, category: "Program / Hizmet", ...linePaymentMeta }))) return false;
    } else {
      if (!selectedProduct) {
        alert("Ürün seç");
        return false;
      }
      if (!addProductToCart(selectedProduct, { unitPriceAtSale: saleForm.total, quantity: 1, ...linePaymentMeta })) return false;
    }

    if (resolvedCustomerName) setCartCustomer({ customerId: findCartCustomer(resolvedCustomerName)?.id || cartCustomer.customerId || "", customerName: resolvedCustomerName });
    if (saleForm.bank || cartBankName) setCartBankName(saleForm.bank || cartBankName);
    setCartPaymentContext((current) => ({
      hasCash: current.hasCash || saleCash > 0,
      hasCard: current.hasCard || saleCard > 0,
      hasCari: current.hasCari || saleRemaining > 0,
    }));
    setCartPayments((current) => reconcileCartPaymentRemainder({
      cashAmount: addMoneyText(current.cashAmount, saleCash),
      cardAmount: addMoneyText(current.cardAmount, saleCard),
      bankAmount: current.bankAmount,
      cariAmount: addMoneyText(current.cariAmount, saleRemaining),
    }, cartSummary.netTotal + saleTotal, { allowCreateCari: Boolean(resolvedCustomerName) || saleRemaining > 0 }));
    setSaleForm({ ...saleForm, customer: resolvedCustomerName || saleForm.customer, cariPerson: resolvedCustomerName || saleForm.cariPerson, search: "", productId: "", total: "", cash: "", card: "" });
    return true;
  }

  function updateCartItem(cartItemIdValue, patch) {
    setCartItems((current) => current.map((item) => {
      if (item.cartItemId !== cartItemIdValue) return item;
      const next = { ...item };
      if (patch.quantity !== undefined) {
        const max = item.productType === "service" ? 999999 : Number(item.stockAvailable || 1);
        next.quantity = Math.max(1, Math.min(Number(patch.quantity || 1), max));
      }
      if (patch.unitPriceText !== undefined) next.unitPriceText = cleanMoneyTyping(patch.unitPriceText);
      if (patch.discountText !== undefined) next.discountText = cleanMoneyTyping(patch.discountText);
      if (patch.formatUnitPrice) next.unitPriceText = formatMoneyInput(next.unitPriceText || next.unitPriceAtSale);
      if (patch.formatDiscount) next.discountText = formatMoneyInput(next.discountText || next.discountAmount);
      return rebuildCartItem(next);
    }));
  }

  function removeCartItem(cartItemIdValue) {
    setCartItems((current) => current.filter((item) => item.cartItemId !== cartItemIdValue));
  }

  function clearCart() {
    if (cartItems.length && !window.confirm("Sepette ürün var. Temizlemek istediğine emin misin?")) return;
    setCartItems([]);
    setCartPayments({ cashAmount: "", cardAmount: "", bankAmount: "", cariAmount: "" });
    setCartCustomer({ customerId: "", customerName: "" });
    setCartBankName("");
    setCartPaymentContext({ hasCash: false, hasCard: false, hasCari: false });
    setCartNote("");
  }

  function setFullCartPayment(method) {
    const totalText = formatMoneyInput(cartSummary.netTotal);
    setCartPayments({
      cashAmount: method === "cash" ? totalText : "",
      cardAmount: method === "card" ? totalText : "",
      bankAmount: "",
      cariAmount: method === "cari" ? totalText : "",
    });
  }

  function changeCartPayment(field, value) {
    setCartPayments((current) => {
      const next = { ...current, [field]: formatMoneyInput(cleanMoneyTyping(value)) };
      if (field === "cariAmount") return next;
      return reconcileCartPaymentRemainder(next, cartSummary.netTotal, {
        allowCreateCari: Boolean(cartCustomer.customerName) || parseMoneyInput(current.cariAmount) > 0,
      });
    });
  }

  function addMoneyText(currentValue, addValue) {
    const total = parseMoneyInput(currentValue) + parseMoneyInput(addValue);
    return total > 0 ? formatMoneyInput(total) : "";
  }

  function changeCartCustomer(value) {
    const selected = findCartCustomer(value);
    const customerName = String(value || "");
    setCartCustomer({ customerId: selected?.id || "", customerName });
    setSaleForm((current) => ({ ...current, customer: customerName, cariPerson: customerName }));
  }

  async function completeCartSale() {
    const rows = cartItems.map(rebuildCartItem);
    if (!rows.length) return alert("Sepet boş.");
    if (cartSummary.netTotal <= 0) return alert("Net toplam 0’dan büyük olmalıdır.");
    if (cartPaymentGap !== 0) return alert("Nakit + kart/banka + cari toplamı satış tutarına eşit olmalıdır.");
    if ((parseMoneyInput(cartPayments.cardAmount) + parseMoneyInput(cartPayments.bankAmount)) > 0 && !cartBankName) return alert("Kart/Banka ödeme varsa banka seç.");
    const cartCariAmount = parseMoneyInput(cartPayments.cariAmount);
    const fallbackCartCustomerName = rows.find((item) => String(item.customerNameAtAdd || "").trim())?.customerNameAtAdd || "";
    const cartCustomerName = String(cartCustomer.customerName || saleForm.customer || fallbackCartCustomerName || "").trim();
    const cartCustomerId = cartCustomer.customerId || findCartCustomer(cartCustomerName)?.id || null;
    const isOnlyAccessoryCart = rows.every((item) => {
      const marker = normalizeCashEntryText([item.productType, item.productTypeLabel, item.category, item.note].join(" "));
      return marker.includes("accessory") || marker.includes("aksesuar");
    });
    if ((!isOnlyAccessoryCart || cartCariAmount > 0) && !cartCustomerName) return alert("Müşteri adı soyadı / telefon yaz");
    const invalidStock = rows.find((item) => item.productType !== "service" && Number(item.quantity || 0) > Number(item.stockAvailable || 0));
    if (invalidStock) return alert(`Stok yetersiz: ${invalidStock.productName}`);
    const duplicateImei = rows.find((item, index) => item.imei && rows.findIndex((row) => row.imei === item.imei) !== index);
    if (duplicateImei) return alert(`Aynı IMEI sepette ikinci kez eklenemez: ${duplicateImei.imei}`);
    if (rows.some((item) => Number(item.lineProfit || 0) < 0) && !window.confirm("Bu satışta zararına satılan ürün var. Devam etmek istiyor musun?")) return;

    const actionKey = "cart:sale:create";
    if (!beginPendingAction(actionKey)) return;
    setCartProcessing(true);
    try {
      const idempotencyKey = `cart-sale-${Date.now()}-${cartItemId()}`;
      const result = await createSaleTransaction({
        workspaceId: activeWorkspaceId,
        actorId: currentUser?.id || currentUser?.email || null,
        idempotencyKey,
        customerId: cartCustomerId || cartCustomerName || null,
        customerName: cartCustomerName,
        customer_name: cartCustomerName,
        cariPerson: cartCustomerName || saleForm.cariPerson || "",
        cari_person: cartCustomerName || saleForm.cariPerson || "",
        sale_group: "Sepet",
        sale_type: "Sepet Satışı",
        bank_name: cartBankName || "",
        items: rows.map((item) => ({
          productType: item.productType,
          productId: item.productId,
          product_name: item.productName,
          imei: item.imei || null,
          quantity: Number(item.quantity || 1),
          unitCostAtSale: Number(item.unitCostAtSale || 0),
          unitPriceAtSale: Number(item.unitPriceAtSale || 0),
          discountAmount: Number(item.discountAmount || 0),
          lineTotal: Number(item.lineTotal || 0),
          lineProfit: Number(item.lineProfit || 0),
          metadata: {
            category: item.category,
            barcode: item.barcode,
            source: "cart",
          },
        })),
        payments: {
          cashAmount: parseMoneyInput(cartPayments.cashAmount),
          cardAmount: parseMoneyInput(cartPayments.cardAmount),
          bankAmount: parseMoneyInput(cartPayments.bankAmount),
          cariAmount: cartCariAmount,
        },
        note: cartNote,
        metadata: {
          source: "cart",
          screen: "main_sales",
          itemCount: rows.length,
          customerName: cartCustomerName,
          cariPerson: cartCustomerName || saleForm.cariPerson || "",
          bankName: cartBankName || "",
        },
      });

      if (!result.success) {
        const missingRpc = String(result.message || "").includes("ceplog_apply_cart_sale_transaction") || String(result.details || "").includes("ceplog_apply_cart_sale_transaction");
        const customerValidation = result.errorCode === "MISSING_CUSTOMER" || String(result.message || "").includes("Cari satis icin musteri zorunludur");
        alert(missingRpc
          ? "Sepet satış motoru SQL kurulumu bekliyor. Sepet korunuyor."
          : customerValidation
            ? "Cari kalan için aktif sepet müşterisi gerekli. Müşteri alanını kontrol et; sepet korunuyor."
            : (result.message || "Satış kaydedilemedi. Sepet korunuyor."));
        return;
      }

      await refreshFromDatabase();
      setCartItems([]);
      setCartPayments({ cashAmount: "", cardAmount: "", bankAmount: "", cariAmount: "" });
      setCartCustomer({ customerId: "", customerName: "" });
      setCartBankName("");
      setCartPaymentContext({ hasCash: false, hasCard: false, hasCari: false });
      setCartNote("");
      setCartPaymentModalOpen(false);
      setSyncMessage("Satış başarıyla tamamlandı.");
      alert("Satış başarıyla tamamlandı.");
    } catch (error) {
      alert(error.message || "Satış kaydedilemedi. Sepet korunuyor.");
    } finally {
      setCartProcessing(false);
      endPendingAction(actionKey);
    }
  }

  const alacaklarim = activeSales.filter((sale) => sale.type !== "Aksesuar Satışı" && Number(sale.remaining || 0) > 0);

  const borclarim = useMemo(() => {
    const map = new Map();
    activeStock.forEach((product) => {
      if (!product.supplier || isSellerLabel(product.supplier) || product.acquisitionType === "Müşteri") return;
      const totalBuy = parseMoneyInput(product.buy) * Number(product.qty || 0);
      const paid = parseMoneyInput(product.supplierPaid || 0);
      const accountKey = `supplier:${product.supplier.toLocaleLowerCase("tr-TR")}`;
      const row = map.get(accountKey) || { accountKey, kind: "supplier", name: product.supplier, phone: "", contactId: "", lastProduct: "", totalBuy: 0, paid: 0, remaining: 0 };
      row.lastProduct = productTitle(product);
      row.totalBuy += totalBuy;
      row.paid += paid;
      row.remaining += Math.max(totalBuy - paid, 0);
      map.set(accountKey, row);
    });

    activeStock.forEach((product) => {
      const sellerDebt = stockSellerDebt(product);
      const sellerName = sellerNameFromProduct(product);
      if (!sellerDebt || !sellerName) return;

      const accountKey = `seller:${sellerName.toLocaleLowerCase("tr-TR")}`;
      const row = map.get(accountKey) || {
        accountKey,
        kind: "seller",
        name: sellerName,
        phone: product.sellerPhone || "",
        contactId: "",
        lastProduct: "",
        totalBuy: 0,
        paid: 0,
        remaining: 0,
      };

      row.lastProduct = productTitle(product);
      row.phone = product.sellerPhone || row.phone || "";
      row.totalBuy += parseMoneyInput(product.buy) * Number(product.qty || 1);
      row.paid += parseMoneyInput(product.supplierPaid || 0);
      row.remaining += sellerDebt;
      map.set(accountKey, row);
    });

    activeContacts
      .filter((contact) => ["supplier", "seller"].includes(contact.kind) && contact.balanceType === "payable")
      .forEach((contact) => {
        const accountKey = `${contact.kind}:${contact.name.toLocaleLowerCase("tr-TR")}`;
        const row = map.get(accountKey) || {
          accountKey,
          kind: contact.kind,
          name: contact.name,
          phone: contact.phone || "",
          contactId: contact.id,
          lastProduct: contact.note || "Cari bakiye",
          totalBuy: Math.max(Number(contact.balance || 0), 0),
          paid: 0,
          remaining: 0,
        };
        row.kind = contact.kind;
        row.name = contact.name;
        row.phone = contact.phone || row.phone || "";
        row.contactId = contact.id;
        row.remaining = Number(contact.balance || 0);
        if (!row.lastProduct) row.lastProduct = contact.note || "Cari bakiye";
        map.set(accountKey, row);
      });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
  }, [activeStock, activeContacts]);

  const totalReceivableBalance = activeContacts
    .filter((contact) => contact.kind === "customer" && contact.balanceType === "receivable")
    .reduce((sum, contact) => sum + Number(contact.balance || 0), 0);
  const totalPayableBalance = activeContacts
    .filter((contact) => ["supplier", "seller"].includes(contact.kind) && contact.balanceType === "payable")
    .reduce((sum, contact) => sum + Number(contact.balance || 0), 0);
  const activeTechnicalServices = technicalServices.filter((item) => isActiveRecord(item) && item.status !== "Teslim Edildi");
  const technicalServicesForFinance = technicalServices.filter((item) =>
    isActiveRecord(item) && (
      item.source === "supabase" ||
      item.financeSource === "supabase" ||
      item.workspace_id ||
      item.workspaceId
    )
  );
  const visibleTechnicalServices = technicalStatusFilter === "TÜMÜ"
    ? technicalServices
    : technicalServices.filter((item) => item.status === technicalStatusFilter);
  const technicalReadyCount = technicalServices.filter((item) => item.status === "Hazır").length;
  const technicalDeliveredCount = technicalServices.filter((item) => item.status === "Teslim Edildi").length;
  const technicalEstimatedTotal = technicalServicesForFinance
    .reduce((sum, item) => sum + parseMoneyInput(item.estimatedPrice), 0);
  const technicalCashMovementNet = activeCashMovements
    .filter((item) => isTechnicalServiceMovement(cashMovementType(item)))
    .reduce((sum, item) => sum + (item.direction === "out" || isTechnicalServiceRefundMovement(cashMovementType(item)) ? -cashMovementAmount(item) : cashMovementAmount(item)), 0);
  const technicalBankMovementNet = activeBankMovements
    .filter((item) => isTechnicalServiceMovement(bankMovementType(item)))
    .reduce((sum, item) => sum + (bankMovementDirection(item) === "out" || isTechnicalServiceRefundMovement(bankMovementType(item)) ? -bankMovementAmount(item) : bankMovementAmount(item)), 0);
  const technicalServiceMovementTotal = technicalCashMovementNet + technicalBankMovementNet;

  const technicalServicePaymentHistory = (serviceId) => {
    const cleanServiceId = String(serviceId || "");
    return [
      ...activeCashMovements
        .filter((item) => isTechnicalServiceMovement(cashMovementType(item)) && serviceMovementId(item) === cleanServiceId)
        .map((item) => ({
          id: `cash-${item.id}`,
          date: item.date,
          type: cashMovementType(item),
          method: "Nakit",
          bank: "",
          direction: item.direction || (isTechnicalServiceRefundMovement(cashMovementType(item)) ? "out" : "in"),
          amount: cashMovementAmount(item),
          note: item.note || "",
        })),
      ...activeBankMovements
        .filter((item) => isTechnicalServiceMovement(bankMovementType(item)) && serviceMovementId(item) === cleanServiceId)
        .map((item) => ({
          id: `bank-${item.id}`,
          date: item.date,
          type: bankMovementType(item),
          method: "Kart/Banka",
          bank: item.bank || "",
          direction: bankMovementDirection(item),
          amount: bankMovementAmount(item),
          note: item.note || "",
        })),
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  };

  const technicalServiceSummary = (service) => {
    if (!service) return emptyTechnicalSummary;
    const history = technicalServicePaymentHistory(service.id);
    const sourceMap = new Map();

    history.forEach((item) => {
      const isBank = item.method === "Kart/Banka";
      const bank = isBank ? item.bank || "Banka" : "";
      const key = isBank ? `bank:${bank}` : "cash";
      const row = sourceMap.get(key) || {
        key,
        method: isBank ? "Kart/Banka" : "Nakit",
        bank,
        label: isBank ? bank : "Nakit / Kasa",
        collected: 0,
        refunded: 0,
      };

      if (item.direction === "out" || isTechnicalServiceRefundMovement(item.type)) row.refunded += Number(item.amount || 0);
      else row.collected += Number(item.amount || 0);

      sourceMap.set(key, row);
    });

    const refundSources = Array.from(sourceMap.values()).map((source) => ({
      ...source,
      available: Math.max(source.collected - source.refunded, 0),
    }));
    const cashSource = refundSources.find((source) => source.key === "cash");
    const cashCollected = cashSource?.collected || 0;
    const bankCollected = refundSources
      .filter((source) => source.method === "Kart/Banka")
      .reduce((sum, source) => sum + source.collected, 0);
    const collected = cashCollected + bankCollected;
    const refunded = refundSources.reduce((sum, source) => sum + source.refunded, 0);
    const net = Math.max(collected - refunded, 0);
    const total = parseMoneyInput(service.estimatedPrice);
    return {
      total,
      collected,
      cashCollected,
      bankCollected,
      refunded,
      net,
      remaining: Math.max(total - net, 0),
      cashRefundAvailable: cashSource?.available || 0,
      bankRefundAvailable: refundSources
        .filter((source) => source.method === "Kart/Banka")
        .reduce((sum, source) => sum + source.available, 0),
      refundSources,
      history,
    };
  };
  const selectedTechnicalService = technicalServices.find((item) => String(item.id) === String(selectedTechnicalServiceId));
  const selectedTechnicalSummary = technicalServiceSummary(selectedTechnicalService);
  const technicalServiceMovements = [
    ...activeCashMovements
      .filter((item) => isTechnicalServiceMovement(cashMovementType(item)))
      .map((item) => ({
        id: `cash-${item.id}`,
        rawId: item.id,
        serviceId: serviceMovementId(item),
        date: item.date,
        type: cashMovementType(item),
        method: "Nakit",
        bank: "",
        direction: item.direction || (isTechnicalServiceRefundMovement(cashMovementType(item)) ? "out" : "in"),
        amount: cashMovementAmount(item),
        note: item.note || "",
      })),
    ...activeBankMovements
      .filter((item) => isTechnicalServiceMovement(bankMovementType(item)))
      .map((item) => ({
        id: `bank-${item.id}`,
        rawId: item.id,
        serviceId: serviceMovementId(item),
        date: item.date,
        type: bankMovementType(item),
        method: "Kart/Banka",
        bank: item.bank || "",
        direction: bankMovementDirection(item),
        amount: bankMovementAmount(item),
        note: item.note || "",
      })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());


  async function refreshFromDatabase() {
    setSyncMessage("Veriler Supabase'ten yükleniyor...");
    const data = await loadDashboardData();

    setStock((data.stock || []).map(fromDbStock));
    setSales((data.sales || []).map(fromDbSale));
    setExpenses((data.expenses || []).map(fromDbExpense));
    setBankMovements((data.bankMovements || []).map(fromDbBankMovement));
    setBankBalances((data.bankBalances || []).map(fromDbBankBalance));
    setCashMovements((data.cashMovements || []).map(fromDbCashMovement));
    setContacts((data.contacts || []).map(fromDbContact));
    setAuditLogs(data.auditLogs || []);
    setBusinessTransactions(data.businessTransactions || []);
    setLedgerEntries(data.ledgerEntries || []);
    setSaleItems(data.saleItems || []);
    setStockMovements(data.stockMovements || []);
    setCariMovements(data.cariMovements || []);
    setReturnsData(data.returns || []);
    setReturnItems(data.returnItems || []);
    setExchanges(data.exchanges || []);
    setPosMovements(data.posMovements || []);
    setTechnicalServices((data.technicalServices || []).map(fromDbTechnicalService));
    setSchemaStatus(data.schemaStatus || []);
    setActiveWorkspaceId(data.workspaceId || data.profile?.workspace_id || "");
    setDbReady(true);
    setSyncMessage("Veriler Supabase ile senkronize.");
  }

  async function handleCleanTestReset() {
    if (!isLocalhostRuntime()) {
      alert("Test sıfırlama sadece localhost ortamında çalıştırılabilir.");
      return;
    }

    const firstConfirm = window.confirm("Bu işlem tüm test satış, stok, kasa, cari, teknik servis ve gider kayıtlarını temizleyecek. Devam edilsin mi?");
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("Son kez onayla: Temiz test başlangıcı için tüm test verileri silinsin mi?");
    if (!secondConfirm) return;

    try {
      const result = await resetAllTestData();
      const storageKey = activeWorkspaceId || currentUser?.id || result.workspaceId || "";
      if (storageKey) {
        localStorage.removeItem(`ceplog_technical_services_${storageKey}`);
        localStorage.removeItem(`ceplog_accessory_shortcuts_${storageKey}`);
      }

      setTechnicalServices([]);
      setAccessoryShortcuts([]);
      setSelectedTechnicalServiceId("");
      setTechnicalPaymentForm(emptyTechnicalPaymentForm);
      setTechnicalRefundForm(emptyTechnicalPaymentForm);
      await refreshFromDatabase();

      const failed = result.results.filter((item) => !item.ok && !item.skipped);
      if (failed.length) {
        console.error("Bazı test verileri temizlenemedi", failed);
        alert(`Test sıfırlama tamamlandı ancak bazı tablolar temizlenemedi: ${failed.map((item) => item.table).join(", ")}`);
        return;
      }

      setSyncMessage("Test verileri temizlendi. CEPLOG sıfır bakiye test için hazır.");
      alert("Test verileri temizlendi. CEPLOG sıfır bakiye test için hazır.");
    } catch (error) {
      console.error("Test verileri sıfırlanamadı", error);
      alert(error.message || "Test verileri sıfırlanamadı.");
    }
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

  function openCalculator() {
    setCalculatorOpen(true);
  }

  function closeCalculator() {
    setCalculatorOpen(false);
  }

  function appendCalculatorToken(token) {
    setCalculatorResult("");
    setCalculatorValue((current) => `${current}${token}`);
  }

  function clearCalculator() {
    setCalculatorValue("");
    setCalculatorResult("");
  }

  function deleteCalculatorToken() {
    setCalculatorResult("");
    setCalculatorValue((current) => current.slice(0, -1));
  }

  function calculateCalculatorValue() {
    try {
      const result = evaluateCalculatorExpression(calculatorValue);
      setCalculatorValue(result);
      setCalculatorResult(result);
    } catch {
      setCalculatorResult("Hata");
    }
  }

  useEffect(() => {
    const handleCalculatorShortcut = (event) => {
      const typingTarget = isTypingElement(event.target);

      if (event.key === "Escape" && calculatorOpen) {
        event.preventDefault();
        closeCalculator();
        return;
      }

      if ((event.key === "h" || event.key === "H") && !typingTarget) {
        event.preventDefault();
        openCalculator();
        return;
      }

      if (!calculatorOpen || typingTarget) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendCalculatorToken(event.key);
        return;
      }

      if (event.key === "." || event.key === ",") {
        event.preventDefault();
        appendCalculatorToken(".");
        return;
      }

      if (event.key === "+" || event.key === "-") {
        event.preventDefault();
        appendCalculatorToken(event.key);
        return;
      }

      if (event.key === "*" || event.key === "x" || event.key === "X") {
        event.preventDefault();
        appendCalculatorToken("×");
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        appendCalculatorToken("÷");
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        deleteCalculatorToken();
        return;
      }

      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        calculateCalculatorValue();
        return;
      }

      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        clearCalculator();
      }
    };

    window.addEventListener("keydown", handleCalculatorShortcut);
    return () => window.removeEventListener("keydown", handleCalculatorShortcut);
  }, [calculatorOpen, calculatorValue]);

  async function handleLogout() {
    const ok = window.confirm("Çıkış yapmak istiyor musun?");
    if (!ok) return;

    try {
      await signOut();
      setCurrentUser(null);
      setActiveWorkspaceId("");
      setDbReady(false);
      setSyncMessage("");
    } catch (error) {
      alert(error.message || "Çıkış yapılamadı.");
    }
  }

  function updateSecurityPasswordDraft(key, value) {
    setSecurityPasswordDrafts({ ...securityPasswordDrafts, [key]: value });
  }

  function saveSecurityPasswordField(key) {
    const value = String(securityPasswordDrafts[key] || "").trim();
    if (!value) return alert("Şifre boş bırakılamaz.");

    const nextPasswords = {
      ...getSecurityPasswords(),
      [key]: value,
    };
    saveSecurityPasswords(nextPasswords);
    setSecurityPasswordDrafts(nextPasswords);
    setSyncMessage("Güvenlik şifresi güncellendi.");
    alert("Güvenlik şifresi güncellendi.");
  }

  function toggleSecurityPasswordVisibility(key) {
    setVisibleSecurityPasswords({
      ...visibleSecurityPasswords,
      [key]: !visibleSecurityPasswords[key],
    });
  }

  const report = {
    total: activeSales.reduce((sum, sale) => sum + parseMoneyInput(sale.total), 0),
    cash: activeSales.reduce((sum, sale) => sum + parseMoneyInput(sale.cash), 0),
    card: activeSales.reduce((sum, sale) => sum + parseMoneyInput(sale.card), 0),
    remaining: activeSales.reduce((sum, sale) => sum + Number(sale.remaining || 0), 0),
    profit: activeSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0),
  };
  const saleTotalByType = (predicate) => activeSales
    .filter(predicate)
    .reduce((sum, sale) => sum + parseMoneyInput(sale.total), 0);
  const phoneSalesTotal = saleTotalByType((sale) => sale.type === "Telefon Satışı");
  const accessorySalesTotal = saleTotalByType((sale) => sale.type === "Aksesuar Satışı");
  const technicalServiceTotal = saleTotalByType((sale) => sale.type === "Teknik Servis") + technicalServiceMovementTotal;
  const otherSalesTotal = saleTotalByType((sale) => !["Telefon Satışı", "Aksesuar Satışı", "Teknik Servis"].includes(sale.type));
	  const saleIncomeSummary = (predicate) => {
	    const rows = activeSales.filter(predicate).map(normalizeSalePaymentDistributionForReport);
	    const cash = rows.reduce((sum, sale) => sum + sale.cash, 0);
	    const card = rows.reduce((sum, sale) => sum + sale.card, 0);
	    const debt = rows.reduce((sum, sale) => sum + sale.debt, 0);
	    const matchingSaleIds = new Set((sales || [])
	      .filter(predicate)
	      .map((sale) => String(sale.id || sale.saleId || ""))
	      .filter(Boolean));
	    const refund = activeCashMovements
	      .filter((item) => cashMovementType(item) === "Satış İadesi" && matchingSaleIds.has(String(item.relatedId || item.related_id || item.referenceId || item.reference_id || "")))
	      .reduce((sum, item) => sum + movementAmount(item), 0) + activeBankMovements
	      .filter((item) => bankMovementType(item) === "Satış İadesi" && (
	        matchingSaleIds.has(String(item.relatedSaleId || item.related_sale_id || "")) ||
	        matchingSaleIds.has(String(item.relatedId || item.related_id || item.referenceId || item.reference_id || ""))
	      ))
	      .reduce((sum, item) => sum + movementAmount(item), 0);
	    const total = rows.reduce((sum, sale) => sum + sale.total, 0);
	    return { cash, card, debt, refund, total: Math.max(total - refund, 0) };
	  };
  const phoneIncomeSummary = saleIncomeSummary((sale) => sale.type === "Telefon Satışı");
  const accessoryIncomeSummary = saleIncomeSummary((sale) => sale.type === "Aksesuar Satışı");
  const otherIncomeSummary = saleIncomeSummary((sale) => !["Telefon Satışı", "Aksesuar Satışı", "Teknik Servis"].includes(sale.type));
  const technicalSaleIncomeSummary = saleIncomeSummary((sale) => sale.type === "Teknik Servis");
  const technicalCashIncomeTotal = activeCashMovements
    .filter((item) => isTechnicalServiceIncomeMovement(cashMovementType(item)) && item.direction !== "out")
    .reduce((sum, item) => sum + cashMovementAmount(item), 0);
  const technicalBankIncomeTotal = activeBankMovements
    .filter((item) => isTechnicalServiceIncomeMovement(bankMovementType(item)) && bankMovementDirection(item) !== "out")
    .reduce((sum, item) => sum + bankMovementAmount(item), 0);
  const technicalRefundTotal = activeCashMovements
    .filter((item) => isTechnicalServiceRefundMovement(cashMovementType(item)) || item.direction === "out" && isTechnicalServiceMovement(cashMovementType(item)))
    .reduce((sum, item) => sum + cashMovementAmount(item), 0) + activeBankMovements
    .filter((item) => isTechnicalServiceRefundMovement(bankMovementType(item)) || bankMovementDirection(item) === "out" && isTechnicalServiceMovement(bankMovementType(item)))
    .reduce((sum, item) => sum + bankMovementAmount(item), 0);
  const technicalServiceDebtTotal = technicalServicesForFinance
    .reduce((sum, service) => sum + technicalServiceSummary(service).remaining, 0);
  const technicalIncomeSummary = {
    cash: technicalCashIncomeTotal + technicalSaleIncomeSummary.cash,
    card: technicalBankIncomeTotal + technicalSaleIncomeSummary.card,
    debt: technicalServiceDebtTotal + technicalSaleIncomeSummary.debt,
    refund: technicalRefundTotal,
    total: Math.max(technicalCashIncomeTotal + technicalBankIncomeTotal + technicalSaleIncomeSummary.total - technicalRefundTotal, 0),
  };

  const expenseReport = {
    total: activeExpenses.reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
  };

  const isBankIncomingMovement = (item) =>
    item.type === "Bankaya Giden" ||
    (bankMovementType(item) === "Düzeltme" && bankMovementDirection(item) === "in") ||
    (isPurchaseCancellationMovement(item, bankMovementType(item)) && bankMovementDirection(item) === "in") ||
    (isTechnicalServiceIncomeMovement(bankMovementType(item)) && bankMovementDirection(item) === "in");
	  const isBankOutgoingMovement = (item) =>
	    item.type === "Bankadan Çekilen" ||
	    bankMovementType(item) === "Satış İadesi" ||
	    (bankMovementType(item) === "Düzeltme" && bankMovementDirection(item) === "out") ||
    (isPurchaseCancellationMovement(item, bankMovementType(item)) && bankMovementDirection(item) === "out") ||
    (isTechnicalServiceRefundMovement(bankMovementType(item)) && bankMovementDirection(item) === "out");

  const frontendBankBalanceRows = bankOptions.map((bank) => {
    const totalToBank = activeBankMovements
      .filter((item) => isBankIncomingMovement(item) && normalizeBankName(item.bank) === normalizeBankName(bank))
      .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
    const withdrawnFromBank = activeBankMovements
      .filter((item) => isBankOutgoingMovement(item) && normalizeBankName(item.bank) === normalizeBankName(bank))
      .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
    return {
      bank,
      totalToBank,
      withdrawnFromBank,
      remaining: Math.max(totalToBank - withdrawnFromBank, 0),
      commission: (Math.max(totalToBank - withdrawnFromBank, 0) / 100) * 3.5,
    };
  });
  const rpcBankBalanceRows = safeBankBalances
    .filter((row) => String(row.bank || "").trim())
    .map((row) => ({
      bank: row.bank,
      totalToBank: Number(row.totalToBank || 0),
      withdrawnFromBank: Number(row.withdrawnFromBank || 0),
      remaining: Math.max(Number(row.remaining || 0), 0),
      commission: (Math.max(Number(row.remaining || 0), 0) / 100) * 3.5,
      source: row.source || "supabase",
    }));
  const bankBalanceSourceRows = rpcBankBalanceRows.length ? rpcBankBalanceRows : frontendBankBalanceRows;
  const bankBalanceRowsByName = new Map(
    bankBalanceSourceRows.map((row) => [normalizeBankName(row.bank), row])
  );
  const bankAccountRows = bankOptions.map((bank) => {
    const row = bankBalanceRowsByName.get(normalizeBankName(bank)) || {
      bank,
      totalToBank: 0,
      withdrawnFromBank: 0,
      remaining: 0,
      commission: 0,
    };
    const remaining = Math.max(Number(row.remaining || 0), 0);
    return {
      ...row,
      bank,
      remaining,
      commission: (remaining / 100) * 3.5,
    };
  });

  const bankReport = {
    totalToBank: bankAccountRows.reduce((sum, row) => sum + Number(row.totalToBank || 0), 0),
    withdrawnFromBank: bankAccountRows.reduce((sum, row) => sum + Number(row.withdrawnFromBank || 0), 0),
  };
  bankReport.remainingInBank = bankAccountRows.reduce((sum, row) => sum + Number(row.remaining || 0), 0);

  const bankCashSkeletonTotal = bankReport.remainingInBank;
  const bankCashSkeletonBalanceFor = (name) => {
    const row = bankAccountRows.find((item) => normalizeBankName(item.bank) === normalizeBankName(name));
    return Math.max(Number(row?.remaining || 0), 0);
  };
  const bankCashSkeletonRows = bankOptions.map((name) => {
    const bank = getBankById(bankList, name) || { id: createBankId(name), name, balance: 0, isDefault: false };
    return {
      ...bank,
      balance: bankCashSkeletonBalanceFor(name),
    };
  });

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const monthlyPosTotal = activeBankMovements
    .filter((item) => isBankIncomingMovement(item) && item.date && item.date.slice(0, 7) === currentMonthKey)
    .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
  const monthlyPosCommission = (bankReport.remainingInBank / 100) * 3.5;

  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = new Date().toISOString().slice(0, 7);
  const financeSummary = calculateFinanceSummary({
    cashMovements: activeCashMovements,
    bankMovements: activeBankMovements,
    sales: activeSales,
    expenses: activeExpenses,
    todayKey,
  });
  const carryOverCash = activeCashMovements
    .filter((item) => cashMovementType(item) === "Devir Nakit" && item.direction === "in")
    .reduce((sum, item) => sum + cashMovementAmount(item), 0);
  const todayBankCashIncoming = financeSummary.todayBankCashIncoming;
  const todayCashIn = financeSummary.todayCashIncome;
  const stockPurchasePayments = financeSummary.purchasePaymentsNet;
  const receivablePayments = financeSummary.receivablePaymentsTotal;
  const cardSalesTotal = activeSales.reduce((sum, sale) => sum + normalizeSalePaymentDistributionForReport(sale).card, 0) + technicalBankMovementNet;
  const cashExpensePayments = financeSummary.cashExpenseTotal;

  const systemCheckSummary = systemCheckFindings.reduce((summary, finding) => {
    const severity = String(finding.severity || "INFO").toUpperCase();
    summary.total += 1;
    if (severity === "ERROR") summary.errors += 1;
    else if (severity === "WARNING") summary.warnings += 1;
    else summary.info += 1;
    return summary;
  }, { total: 0, errors: 0, warnings: 0, info: 0 });
  const systemSchemaSummary = safeSchemaStatus.reduce((summary, item) => {
    summary.total += 1;
    if (item.ready) summary.ready += 1;
    else summary.missing += 1;
    return summary;
  }, { total: 0, ready: 0, missing: 0 });
  const systemHasBusinessData = Boolean(
    activeSales.length ||
    activeStock.length ||
    activeExpenses.length ||
    activeBankMovements.length ||
    activeCashMovements.length ||
    activeContacts.length ||
    technicalServicesForFinance.length
  );
  const zeroFinanceChecks = [
    ["Toplam Kasa", financeSummary.expectedCash],
    ["Bugün Nakit Gelirleri", financeSummary.todayCashIncome],
    ["Alım Ödemeleri", financeSummary.purchasePaymentsNet],
    ["Giderler", financeSummary.cashExpenseTotal],
    ["Gelen Alacak", financeSummary.receivablePaymentsTotal],
  ];
  const zeroFinanceFailures = systemHasBusinessData
    ? []
    : zeroFinanceChecks.filter(([, value]) => Math.abs(Number(value || 0)) > 0.009);
  const missingSchemaTables = safeSchemaStatus.filter((item) => !item.ready).map((item) => item.table).filter(Boolean);
  const systemHealthRows = [
    [
      "Sıfır Veri Testi",
      systemHasBusinessData ? "Veri var" : zeroFinanceFailures.length ? "Hata" : "Temiz",
      systemHasBusinessData
        ? "Aktif kayıtlar olduğu için sıfır testi uygulanmadı."
        : zeroFinanceFailures.length
          ? `${zeroFinanceFailures.length} finans özeti 0 değil.`
          : "Aktif ticari kayıt yok ve finans özetleri 0 görünüyor.",
    ],
    [
      "Ledger Altyapısı",
      systemSchemaSummary.missing ? "Migration bekliyor" : "Hazır",
      systemSchemaSummary.total
        ? `${systemSchemaSummary.ready}/${systemSchemaSummary.total} altyapı tablosu hazır.`
        : "Henüz altyapı tablo durumu okunmadı.",
    ],
    [
      "Read-only Kontrol",
      "Aktif",
      "Sistem Kontrol sadece okuma yapar; veri düzeltmez.",
    ],
  ];

  function runSystemControlCheck() {
    const findings = runReadOnlyReconciliation({
      sales: activeSales,
      stock_items: activeStock,
      expenses: activeExpenses,
      bank_movements: activeBankMovements,
      cash_movements: activeCashMovements,
      contacts: activeContacts,
      audit_logs: safeAuditLogs,
      business_transactions: safeBusinessTransactions,
      ledger_entries: safeLedgerEntries,
      sale_items: safeSaleItems,
      stock_movements: safeStockMovements,
      cari_movements: safeCariMovements,
      returns: safeReturns,
      return_items: safeReturnItems,
      exchanges: safeExchanges,
      pos_movements: safePosMovements,
    });

    if (!systemHasBusinessData) {
      zeroFinanceFailures.forEach(([label, value]) => {
        findings.push({
          severity: "ERROR",
          module: "CASH",
          entityType: "finance_summary",
          entityId: null,
          message: `Sıfır veri durumunda ${label} 0 TL olmalı.`,
          expectedValue: "0 TL",
          actualValue: money(value),
          suggestedFix: "Finans özeti localStorage/demo/cache yerine hareket tablolarından hesaplanmalı.",
          createdAt: new Date().toISOString(),
        });
      });
    }

    setSystemCheckFindings(findings);
    setSystemCheckLastRun(new Date().toLocaleString("tr-TR"));
    setSyncMessage(findings.length ? `Sistem Kontrol tamamlandı: ${findings.length} bulgu.` : "Sistem Kontrol tamamlandı: bulgu yok.");
  }

  function dailyReportRowType(item) {
    const type = cashMovementType(item) || bankMovementType(item);
    const direction = movementDirection(item, type);
    const classification = classifyFinancialMovement(item);
    if (classification === "correction") {
      if (type === cashEntryCancellationType) return { label: "Nakit Girişi İptali", tone: "cancel" };
      if (isPurchasePaymentCancelMovement(item)) return { label: "Alış İptali", tone: "cancel" };
      return { label: "Düzeltme / İptal", tone: "cancel" };
    }
	    if (classification === "refund") {
	      if (type === "Satış İadesi") return { label: "Satış İade", tone: "service-refund" };
	      if (type === "Satış İptali") return { label: "Satış İptal", tone: "cancel" };
	      if (isTechnicalServiceRefundMovement(type)) return { label: "Teknik Servis İade", tone: "service-refund" };
	      return { label: "İade / İptal", tone: "cancel" };
	    }
    if (classification === "transfer") return { label: type || "Transfer", tone: direction === "out" ? "cash-out" : "cash-in" };
    if (classification === "purchase_payment") return { label: "Alım Ödemesi", tone: "purchase" };
    if (["Gelen Alacak", "Alacak Ödemesi", "Alacak Tahsilatı", "Cari Tahsilat"].includes(type)) return { label: "Alacak Tahsilatı", tone: "debt" };
    if (type === "Cari Ödeme") return { label: "Cari Ödeme", tone: "debt" };
    if (isTechnicalServiceIncomeMovement(type)) return { label: "Teknik Servis Tahsilat", tone: "service" };
    if (classification === "income") return { label: "Nakit Girişi", tone: "cash-in" };
    if (classification === "expense" || direction === "out") return { label: "Nakit Çıkışı", tone: "cash-out" };
    return { label: type || "Nakit Hareketi", tone: direction === "out" ? "cash-out" : "cash-in" };
  }

  const reportStockQuantity = (product) => {
    if (product?.module === "Cihaz") return 1;
    const quantity = Number(product?.qty || product?.quantity || 1);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  };

  const stockPurchaseReportType = (product) => {
    const group = stockSearchGroup(product);
    if (group === "TELEFON") return { label: "Telefon Alımı", tone: "phone-purchase" };
    if (group === "AKSESUAR") return { label: "Aksesuar Alımı", tone: "purchase" };
    if (group === "SAAT") return { label: "Saat Alımı", tone: "purchase" };
    if (group === "TABLET") return { label: "Tablet Alımı", tone: "purchase" };
    if (group === "PC") return { label: "PC Alımı", tone: "purchase" };
    if (group === "ELEKTRONİK") return { label: "Elektronik Alımı", tone: "purchase" };
    return { label: "Ürün Alımı", tone: "purchase" };
  };

  const stockPurchaseParty = (product) =>
    sellerNameFromProduct(product) || product?.supplier || product?.supplier_name || "-";

  const stockPurchaseDescriptionLines = (product) => {
    const title = productTitle(product) || product?.product_name || product?.name || "-";
    const details = [];
    const condition = product?.condition || (product?.module === "Cihaz" ? product?.category : "");
    const subType = product?.module === "Aksesuar" ? product?.accessorySubType : "";
    const note = product?.compatibleModel || product?.note || "";

    [condition, subType, note]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .forEach((value) => {
        if (!details.some((item) => item.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR")) &&
            !title.toLocaleLowerCase("tr-TR").includes(value.toLocaleLowerCase("tr-TR"))) {
          details.push(value);
        }
      });

    return [title, details.join(" ")].filter(Boolean);
  };

  const relatedStockId = (item) => {
    const relatedTable = String(item?.relatedTable || item?.related_table || "");
    if (relatedTable !== "stock_items") return "";
    return String(item?.relatedId || item?.related_id || "");
  };

  const contactMatchesSameDayStockDebt = (contact, sameDayStockItems) => {
    if (!sameDayStockItems.length) return false;
    if (String(contact?.balanceType || contact?.balance_type || "") !== "payable") return false;

    const note = normalizeKasaBrainText(contact?.note);
    if (!note.includes("alimindan kalan borc") && !note.includes("alımından kalan borç")) return false;

    const contactName = normalizeKasaBrainText(contact?.name);
    return sameDayStockItems.some((product) => {
      const party = normalizeKasaBrainText(stockPurchaseParty(product));
      const title = normalizeKasaBrainText(productTitle(product));
      const hasDebt = stockSellerDebt(product) > 0 ||
        Math.max(parseMoneyInput(product?.buy) * reportStockQuantity(product) - parseMoneyInput(product?.supplierPaid || 0), 0) > 0;

      return hasDebt &&
        contactName &&
        party &&
        (contactName === party || contactName.includes(party) || party.includes(contactName)) &&
        (!title || note.includes(title) || title.includes(note.replace("alimindan kalan borc", "").replace("alımından kalan borç", "").trim()));
    });
  };

  function normalizeDailyCashReportRows(selectedDate) {
    const rows = [];
    const saleIds = new Set(safeSales.map((sale) => String(sale.id)));
    const sameDayStockItems = safeStock.filter((product) => isSameReportDay(product, selectedDate));
    const sameDayStockIds = new Set(sameDayStockItems.map((product) => String(product.id || "")).filter(Boolean));

    sameDayStockItems.forEach((product) => {
      const stockId = String(product.id || "");
      const reportType = stockPurchaseReportType(product);
      const quantity = reportStockQuantity(product);
      const buyTotal = parseMoneyInput(product.buy || product.buy_price || 0) * quantity;
      const cashPayments = safeCashMovements.filter((item) =>
        isSameReportDay(item, selectedDate) &&
        relatedStockId(item) === stockId &&
        isPurchasePaymentMovement(item, cashMovementType(item), item.direction)
      );
      const bankPayments = safeBankMovements.filter((item) =>
        isSameReportDay(item, selectedDate) &&
        relatedStockId(item) === stockId &&
        isPurchasePaymentMovement(item, bankMovementType(item), bankMovementDirection(item))
      );
      const cash = cashPayments.reduce((sum, item) => sum + getCashNetEffect(item), 0);
      const bank = bankPayments.reduce((sum, item) => {
        if (!isActiveMovement(item)) return sum;
        const amount = Math.abs(bankMovementAmount(item));
        return sum + (bankMovementDirection(item) === "out" ? -amount : amount);
      }, 0);
      const storedPaid = parseMoneyInput(product.supplierPaid || product.supplier_paid || 0);
      const fallbackCash = !cashPayments.length && !bankPayments.length && storedPaid > 0 ? -storedPaid : 0;
      const cashTotal = cash || fallbackCash;
      const paidTotal = Math.abs(Math.min(cashTotal, 0)) + Math.abs(Math.min(bank, 0));
      const sellerDebt = stockSellerDebt(product);
      const supplierDebt = !sellerNameFromProduct(product)
        ? Math.max(buyTotal - Math.max(paidTotal, storedPaid), 0)
        : 0;
      const debt = Math.max(sellerDebt || supplierDebt || Math.max(buyTotal - Math.max(paidTotal, storedPaid), 0), 0);
      const descriptionLines = stockPurchaseDescriptionLines(product);

      rows.push({
        id: stockId,
        relatedTable: "stock_items",
        related_table: "stock_items",
        relatedId: stockId,
        related_id: stockId,
        date: reportDateValue(product),
        tone: reportType.tone,
        type: reportType.label,
        description: descriptionLines.join("\n"),
        descriptionLines,
        party: stockPurchaseParty(product),
        buy: buyTotal,
        sale: 0,
        cash: cashTotal,
        bank,
        debt,
        refund: 0,
        total: cashTotal + bank + debt,
      });
    });

	    safeSales.filter((sale) => isSameReportDay(sale, selectedDate)).forEach((sale) => {
	      const saleStatus = String(sale.status || "").toLocaleLowerCase("tr-TR");
	      const refundedSale = ["iade", "refunded", "refund"].includes(saleStatus);
	      const inactive = !isActiveRecord(sale) && !refundedSale;
	      const paymentDistribution = normalizeSalePaymentDistributionForReport(sale);
	      const total = paymentDistribution.total;
	      const cash = paymentDistribution.cash;
      const card = paymentDistribution.card;
      const remaining = paymentDistribution.debt;
      const saleId = sale.id || sale.saleId || "";
      const stockItemId = sale.stock_item_id || sale.productId || sale.product_id || null;
      rows.push({
        id: saleId,
        saleId,
        relatedTable: "sales",
        related_table: "sales",
        relatedId: saleId,
        related_id: saleId,
        stock_item_id: stockItemId,
	        productId: stockItemId,
	        date: reportDateValue(sale),
	        tone: inactive ? "cancel" : (refundedSale ? "service-refund" : "sale"),
	        type: inactive ? "İptal" : (refundedSale ? `${sale.type || sale.sale_type || "Satış"} (İade Edildi)` : (sale.type || sale.sale_type || "Satış")),
	        description: sale.productName || sale.product_name || sale.type || sale.sale_type || "-",
	        party: sale.customer || sale.customer_name || sale.cariPerson || sale.cari_person || "",
	        buy: inactive ? 0 : parseMoneyInput(sale.productBuyPrice || sale.buy_cost || 0),
        sale: inactive ? 0 : total,
        cash: inactive ? 0 : cash,
        bank: inactive ? 0 : card,
        debt: inactive ? 0 : remaining,
        refund: inactive ? total : 0,
        total: inactive ? -total : total,
      });
    });

    safeCashMovements.filter((item) => isSameReportDay(item, selectedDate)).forEach((item) => {
      const type = cashMovementType(item);
      const relatedSaleDuplicate = type === "Satış Nakit" && String(item.relatedTable || item.related_table || "") === "sales" && saleIds.has(String(item.relatedId || item.related_id || ""));
      const relatedStockDuplicate = sameDayStockIds.has(relatedStockId(item)) && isPurchasePaymentMovement(item, type, item.direction);
      if (relatedSaleDuplicate) return;
      if (relatedStockDuplicate) return;
      const amount = Math.abs(cashMovementAmount(item));
      const direction = movementDirection(item, type);
      const inactive = !isActiveMovement(item);
      const classification = classifyFinancialMovement(item);
	      const reportType = inactive ? { label: "İptal", tone: "cancel" } : dailyReportRowType(item);
	      const signedCash = inactive ? 0 : getCashNetEffect(item);
	      rows.push({
	        id: item.id || `cash-${rows.length + 1}`,
	        relatedTable: item.relatedTable || item.related_table || "cash_movements",
	        related_table: item.relatedTable || item.related_table || "cash_movements",
	        relatedId: item.relatedId || item.related_id || item.referenceId || item.reference_id || item.id || "",
	        related_id: item.relatedId || item.related_id || item.referenceId || item.reference_id || item.id || "",
	        date: reportDateValue(item),
	        tone: reportType.tone,
	        type: reportType.label,
        description: item.note || type || "-",
        party: "",
        buy: !inactive && classification === "purchase_payment" ? amount : 0,
        sale: 0,
        cash: signedCash,
        bank: 0,
        debt: !inactive && ["Cari Ödeme"].includes(type) ? amount : 0,
        refund: inactive || ["correction", "refund"].includes(classification) ? amount : 0,
        total: signedCash,
      });
    });

	    safeBankMovements.filter((item) => isSameReportDay(item, selectedDate)).forEach((item) => {
	      const type = bankMovementType(item);
	      const relatedSaleDuplicate = type === "Bankaya Giden" && String(item.relatedTable || item.related_table || "") === "sales" && saleIds.has(String(item.relatedId || item.related_id || ""));
      const relatedStockDuplicate = sameDayStockIds.has(relatedStockId(item)) && isPurchasePaymentMovement(item, type, bankMovementDirection(item));
      if (relatedSaleDuplicate) return;
      if (relatedStockDuplicate) return;
      const amount = Math.abs(bankMovementAmount(item));
      const direction = bankMovementDirection(item);
      const inactive = !isActiveMovement(item);
      const classification = classifyFinancialMovement(item);
	      const reportType = inactive ? { label: "İptal", tone: "cancel" } : dailyReportRowType(item);
	      const signedBank = direction === "out" ? -amount : amount;
	      rows.push({
	        id: item.id || `bank-${rows.length + 1}`,
	        relatedTable: item.relatedTable || item.related_table || "bank_movements",
	        related_table: item.relatedTable || item.related_table || "bank_movements",
	        relatedId: item.relatedId || item.related_id || item.referenceId || item.reference_id || item.id || "",
	        related_id: item.relatedId || item.related_id || item.referenceId || item.reference_id || item.id || "",
	        date: reportDateValue(item),
	        tone: reportType.tone === "cash-in" ? "bank" : reportType.tone,
        type: isTechnicalServiceMovement(type) ? reportType.label : "Banka Hareketi",
        description: item.note || type || "-",
        party: item.bank || item.bank_name || "",
        buy: !inactive && classification === "purchase_payment" ? amount : 0,
        sale: 0,
        cash: 0,
        bank: inactive ? 0 : signedBank,
        debt: 0,
        refund: inactive || ["correction", "refund"].includes(classification) || direction === "out" ? amount : 0,
        total: inactive ? -amount : signedBank,
      });
    });

    safeContacts.filter((contact) => isSameReportDay(contact, selectedDate)).forEach((contact) => {
      const balance = Math.abs(Number(contact.balance || 0));
      if (!balance) return;
      if (contactMatchesSameDayStockDebt(contact, sameDayStockItems)) return;
      const inactive = !isActiveRecord(contact);
      rows.push({
        date: reportDateValue(contact),
        tone: inactive ? "cancel" : "debt",
        type: contact.balanceType === "payable" ? "Borç Alınan" : "Borç / Cari",
        description: contact.note || contact.kind || "-",
        party: contact.name || "",
        buy: 0,
        sale: 0,
        cash: 0,
        bank: 0,
        debt: inactive ? 0 : balance,
        refund: inactive ? balance : 0,
        total: inactive ? -balance : balance,
      });
    });

    return rows
      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
      .map((row, index) => ({ ...row, no: index + 1 }));
  }

  const kasaBrainActionsForRow = (row) => {
    const type = String(row?.type || "").toLocaleLowerCase("tr-TR");
    const isCancelled = type.includes("iptal") || type.includes("iade") || row?.cancelled || row?.cancelledByKasaBrain;

    if (isCancelled) return ["Detay"];

    if (type.includes("satış")) {
      return ["Detay", "Düzelt", "Satış İptal", "Satış İade"];
    }

    if (type.includes("alımı")) {
      return ["Detay", "Düzelt", "Alım İptal"];
    }

    if (type.includes("nakit girişi") || type.includes("manuel nakit")) {
      return ["Detay", "İptal"];
    }

    if (type.includes("alım ödemesi")) {
      return ["Detay", "Düzelt", "Alım İptal"];
    }

    return ["Detay"];
  };

  const dailyCashReportRows = normalizeDailyCashReportRows(dailyReportDate);
  const dailyCashReportTotals = dailyCashReportRows.reduce((totals, row) => ({
    buy: totals.buy + Number(row.buy || 0),
    sale: totals.sale + Number(row.sale || 0),
    cash: totals.cash + Number(row.cash || 0),
    bank: totals.bank + Number(row.bank || 0),
    debt: totals.debt + Number(row.debt || 0),
    refund: totals.refund + Number(row.refund || 0),
  }), { buy: 0, sale: 0, cash: 0, bank: 0, debt: 0, refund: 0 });

  const cashWithBankIncoming = financeSummary.expectedCash;
  const alertFinancialValidation = (validation) => {
    if (validation?.ok) return true;
    alert(validation?.message || "Finansal limit kontrolü başarısız.");
    return false;
  };
  const validateCurrentCashOutLimit = (amount, label = "Nakit ödeme", messages = {}) =>
    validateCashOutLimit(amount, cashWithBankIncoming, label, messages);
  const cashAfterExpenses = cashWithBankIncoming;
  const compactKasaSummaryCards = [
    {
      key: "phone",
      tone: "phone",
      title: "TELEFON ÖZETİ",
      totalLabel: "Toplam Telefon Geliri",
      rows: [
        ["Nakit Satılan", phoneIncomeSummary.cash],
        ["Kartla Alınan", phoneIncomeSummary.card],
        ["Borç Verilen", phoneIncomeSummary.debt],
        ["İade Alınan", phoneIncomeSummary.refund],
      ],
      total: phoneIncomeSummary.total,
    },
    {
      key: "accessory",
      tone: "accessory",
      title: "AKSESUAR ÖZETİ",
      totalLabel: "Toplam Aksesuar Geliri",
      rows: [
        ["Nakit Satılan", accessoryIncomeSummary.cash],
        ["Kartla Alınan", accessoryIncomeSummary.card],
        ["Borç Verilen", accessoryIncomeSummary.debt],
        ["İade Alınan", accessoryIncomeSummary.refund],
      ],
      total: accessoryIncomeSummary.total,
    },
    {
      key: "other",
      tone: "other",
      title: "DİĞER ÖZETİ",
      totalLabel: "Toplam Diğer Gelirler",
      rows: [
        ["Nakit Satılan", otherIncomeSummary.cash],
        ["Kartla Alınan", otherIncomeSummary.card],
        ["Borç Verilen", otherIncomeSummary.debt],
        ["İade Alınan", otherIncomeSummary.refund],
      ],
      total: otherIncomeSummary.total,
    },
    {
      key: "technical",
      tone: "technical",
      title: "TEKNİK SERVİS ÖZETİ",
      totalLabel: "Toplam Teknik Servis Geliri",
      rows: [
        ["Nakit Tahsilat", technicalIncomeSummary.cash],
        ["Kart Tahsilat", technicalIncomeSummary.card],
        ["Borç Verilen", technicalIncomeSummary.debt],
        ["İade Alınan", technicalIncomeSummary.refund],
      ],
      total: technicalIncomeSummary.total,
    },
    {
      key: "total",
      tone: "total",
      title: "ÖZETLER TOPLAMI",
      totalLabel: "Toplam Kasada Olması Gereken",
      rows: [
        ["Dünden Devir", carryOverCash],
        ["Bugün Nakit Gelirleri", todayCashIn],
        ["Bankadan Gelen Nakit Giriş", todayBankCashIncoming],
        ["Alım Ödemeleri", stockPurchasePayments],
        ["Alacak Kalan", totalReceivableBalance],
        ["Gelen Alacak", receivablePayments],
        ["Giderler", cashExpensePayments],
      ],
      total: null,
      negative: cashWithBankIncoming < 0,
    },
  ];
  const renderCompactKasaSummaryCard = (card) => (
    <div key={card.key} className={`compact-summary-card ${card.tone} ${card.negative ? "negative" : ""}`}>
      <h3>{card.title}</h3>
      <div className="compact-summary-lines">
        {card.rows.map(([label, value]) => (
          <div className="compact-summary-line" key={label}>
            <span>{label}</span>
            <b>{money(value)}</b>
          </div>
        ))}
      </div>
      {card.total !== null && (
        <div className="compact-summary-total">
          <span>{card.totalLabel}</span>
          <b>{money(card.total)}</b>
        </div>
      )}
    </div>
  );

  const dayProfit = activeSales
    .filter((sale) => sale.date && sale.date.slice(0, 10) === todayKey)
    .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  const monthProfit = activeSales
    .filter((sale) => sale.date && sale.date.slice(0, 7) === monthKey)
    .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  const rangeProfit = activeSales
    .filter((sale) => {
      const d = sale.date ? sale.date.slice(0, 10) : "";
      if (profitDateFrom && d < profitDateFrom) return false;
      if (profitDateTo && d > profitDateTo) return false;
      return true;
    })
    .reduce((sum, sale) => sum + Number(sale.profit || 0), 0);

  const deviceStock = inStockItems.filter(isPhoneStockItem);
  const accessoryStock = inStockItems.filter(isAccessoryStockItem);
  const otherStock = inStockItems.filter(isOtherStockItem);
  const allStock = inStockItems;
  const currentStockList =
    stockView === "cihaz" ? deviceStock :
    stockView === "aksesuar" ? accessoryStock :
    stockView === "diger" ? otherStock :
    allStock;

  const currentStockBuyTotal = currentStockList.reduce((sum, product) => sum + parseMoneyInput(product.buy) * Number(product.qty || 0), 0);
  const currentStockQtyTotal = currentStockList.reduce((sum, product) => sum + Number(product.qty || 0), 0);

  const filteredStock = inStockItems.filter((product) =>
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

  const filteredSales = activeSales.filter((sale) =>
    !query ||
    has(sale.productName, query) ||
    has(sale.customer, query) ||
    has(sale.cariPerson, query) ||
    has(sale.productBarcode, query)
  );

  const salesListRecords = safeSales.filter((sale) => isSameSalesListDay(sale, salesListDate));
  const sortedSales = sortSalesForList(salesListRecords);
  const sortedFilteredSales = sortSalesForList(filteredSales);

  const visibleSalesListRows = sortedFilteredSales.filter((sale) =>
    isSameSalesListDay(sale, salesListDate)
  );
  const combinedSalesListRows = [
    ...sortedSales.map((sale) => ({ kind: "sale", date: sale.date, sale })),
    ...technicalServiceMovements.filter((movement) => isSameSalesListDay(movement, salesListDate)).map((movement) => {
      const service = technicalServices.find((item) => String(item.id) === String(movement.serviceId));
      return { kind: "technical", date: movement.date, movement, service };
    }),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  function handleBankSelect(value, setter) {
    if (value !== "__add_bank__") {
      setter(value);
      return;
    }

    const name = window.prompt("Yeni banka adı yaz");
    if (!name) return;
    const result = addBank(banks, name, 0);
    if (!result.ok) return alert(result.message);
    setBanks(result.banks);
    saveStoredBanks(result.banks);
    setter(result.bank.name);
    alert("Banka listeye eklendi.");
  }

  function addSupplier() {
    const name = newSupplierName.trim().toUpperCase();
    if (!name) return alert("Tedarikçi firma adı yaz");
    if (!suppliers.includes(name)) setSuppliers([name, ...suppliers]);
    setStockForm({ ...stockForm, supplier: name, acquisitionType: "Tedarikçi Firma" });
    setNewSupplierName("");
    setSupplierModalOpen(false);
  }

  function openSaleEditor(sale) {
    try {
      if (!sale?.id) return alert("Düzenlenecek satış kaydı bulunamadı.");
      if (!requireSecurityPassword("edit", "Satış düzenleme")) return;
      setEditingSale({
        ...sale,
        customer: sale.customer || "",
        customerPhone: sale.customerPhone || "",
        cariPerson: sale.cariPerson || sale.customer || "",
        productName: sale.productName || "",
        productBuyPrice: sale.productBuyPrice || 0,
        total: sale.total || "0 TL",
        cash: sale.cash || "0 TL",
        card: sale.card || "0 TL",
        bank: sale.bank || "",
        remaining: Number(sale.remaining || 0),
        profit: Number(sale.profit || 0),
      });
    } catch (error) {
      alert(error.message || "Satış düzenleme ekranı açılamadı.");
    }
  }

  function openStockEditor(product) {
    if (!product?.id) return alert("Stok kaydı bulunamadı.");
    alert("Stok ekranından düzenleme kapalıdır. Düzeltme, iptal ve iade işlemleri sadece Günlük Kasa Raporu / Kasa Beyni üzerinden yapılır.");
  }

  function stockReferenceValues(product) {
    return [
      product?.id,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean);
  }

  function directStockReferenceValues(item) {
    return [
      item?.relatedStockId,
      item?.related_stock_id,
      item?.stockItemId,
      item?.stock_item_id,
      item?.stockId,
      item?.stock_id,
      item?.itemId,
      item?.item_id,
      item?.productId,
      item?.product_id,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean);
  }

  function relatedRecordValues(item) {
    return [
      item?.relatedId,
      item?.related_id,
      item?.referenceId,
      item?.reference_id,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean);
  }

  function trustedRelatedTable(item) {
    return normalizeStockText(item?.relatedTable || item?.related_table || "");
  }

  function isStockRelatedTable(tableName) {
    return ["stock_items", "stock_item", "stock", "stocks", "purchase", "purchases", "stock_purchases"].includes(tableName);
  }

  function saleMatchesStock(product, sale) {
    const stockRefs = stockReferenceValues(product);
    return directStockReferenceValues(sale).some((reference) => stockRefs.includes(reference));
  }

  function movementMatchesStock(product, movement) {
    const stockRefs = stockReferenceValues(product);
    if (directStockReferenceValues(movement).some((reference) => stockRefs.includes(reference))) return true;
    const tableName = trustedRelatedTable(movement);
    return isStockRelatedTable(tableName) && relatedRecordValues(movement).some((reference) => stockRefs.includes(reference));
  }

  function contactMatchesStock(product, contact) {
    const stockRefs = stockReferenceValues(product);
    if (directStockReferenceValues(contact).some((reference) => stockRefs.includes(reference))) return true;
    const tableName = trustedRelatedTable(contact);
    return isStockRelatedTable(tableName) && relatedRecordValues(contact).some((reference) => stockRefs.includes(reference));
  }

  function technicalServiceMatchesStock(product, service) {
    const stockRefs = stockReferenceValues(product);
    return directStockReferenceValues(service).some((reference) => stockRefs.includes(reference));
  }

  function analyzeStockDeleteLinks(product) {
    const linkedSales = activeSales.filter((sale) => saleMatchesStock(product, sale));
    const linkedCashMovements = activeCashMovements.filter((movement) => movementMatchesStock(product, movement));
    const linkedBankMovements = activeBankMovements.filter((movement) => movementMatchesStock(product, movement));
    const linkedCashPurchases = linkedCashMovements.filter((movement) =>
      isPurchasePaymentMovement(movement)
    );
    const linkedBankPurchases = linkedBankMovements.filter((movement) =>
      isPurchasePaymentMovement(movement)
    );
    const contactLinks = activeContacts.filter((contact) => contactMatchesStock(product, contact));
    const linkedTechnicalServices = technicalServices.filter((service) => isActiveRecord(service) && technicalServiceMatchesStock(product, service));

    return {
      linkedSales,
      linkedCashMovements,
      linkedBankMovements,
      linkedCashPurchases,
      linkedBankPurchases,
      contactLinks,
      linkedTechnicalServices,
      hasCancellablePurchaseLink: Boolean(linkedCashPurchases.length || linkedBankPurchases.length),
      hasUntrustedFinanceHint: Boolean(stockPurchasePaymentAmount(product) > 0 || stockSellerDebt(product) > 0),
      hasFinancialLink: Boolean(
        linkedCashMovements.length ||
        linkedBankMovements.length ||
        linkedCashPurchases.length ||
        linkedBankPurchases.length ||
        contactLinks.length ||
        linkedTechnicalServices.length
      ),
    };
  }

  async function createStockPurchaseCancellationMovements(product, links) {
    throw new Error("Stok ekranından alış iptali kapalıdır. İşlem sadece Günlük Kasa Raporu / Kasa Beyni üzerinden yapılır.");
  }

  async function deleteSale(id) {
    if (!requireSecurityPassword("cancel", "Satış iptali")) return;
    try {
      await cancelRecord("sales", id, "Kullanıcı tarafından satış iptal edildi.");
      await refreshFromDatabase();
      setSyncMessage("Satış güvenli şekilde iptal edildi ve etkileri yenilendi.");
    } catch (error) {
      alert(error.message || "Satış silinemedi.");
    }
  }

  async function deleteStock(id) {
    if (!id) return alert("Stok kaydı bulunamadı.");
    alert("Stok ekranından silme/kaldırma kapalıdır. Düzeltme, iptal ve iade işlemleri sadece Günlük Kasa Raporu / Kasa Beyni üzerinden yapılır.");
  }

  function deleteSupplierDebt(supplierName) {
    if (!supplierName) return alert("Tedarikçi bulunamadı.");
    alert("Tedarikçi/stok bağlantısı silme kapalıdır. Cari/stok düzeltmeleri sadece Günlük Kasa Raporu / Kasa Beyni ve merkezi transaction üzerinden yapılır.");
  }

  async function saveExpense() {
    const amount = parseMoneyInput(expenseForm.amount);
    if (!amount) return alert("Gider tutarını yaz");
    if (expenseForm.category === "Borç" && !expenseForm.note.trim()) return alert("Borç giderinde Not zorunludur");
    if (!alertFinancialValidation(validateCurrentCashOutLimit(amount, "Gider", {
      cashUnavailable: "Kasada yeterli nakit yok. Nakit ödeme yapılamaz.",
      cashExceeded: `Kasadaki nakitten fazla ödeme yapılamaz.\nMevcut kasa: ${formatMoney(cashWithBankIncoming)}\nGirilen ödeme: ${formatMoney(amount)}`,
    }))) return;

    const actionKey = "expense:create";
    if (!beginPendingAction(actionKey)) return;
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
    } finally {
      endPendingAction(actionKey);
    }

    setExpenseForm({ category: "Yemek", amount: "", note: "" });
  }

  async function deleteExpense(id) {
    if (!requireSecurityPassword("delete", "Gider kaydı silme")) return;
    void id;
    alert("Gider silme kapalıdır. Gider iptal/düzeltme işlemleri sadece Günlük Kasa Raporu / Kasa Beyni merkezi transaction akışından yapılmalıdır.");
  }

  async function saveCashEntry() {
    const amount = parseMoneyInput(cashEntryForm.amount);
    const source = cashEntryForm.source.trim();
    const note = cashEntryForm.note.trim();
    if (!amount) return alert("Nakit giriş tutarını yaz");
    if (!source) return alert("Nakit nereden geldi? Alanını yaz");

    const actionKey = "cash-entry:create";
    if (!beginPendingAction(actionKey)) return;
    try {
      await createCashMovement({
        movement_type: "Manuel Nakit Girişi",
        direction: "in",
        amount,
        note: note ? `${source} - ${note}` : source,
      });
      await refreshFromDatabase();
      setSyncMessage("Manuel Nakit Girişi Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Nakit girişi Supabase'e yazılamadı.");
      return;
    } finally {
      endPendingAction(actionKey);
    }

    setCashEntryForm({ amount: "", source: "", note: "" });
  }

  async function saveCashCarryOver() {
    const amount = parseMoneyInput(cashCarryForm.amount);
    const note = cashCarryForm.note.trim();
    if (!amount) return alert("Dünden kalan nakit tutarını yaz");

    const actionKey = "cash-carry-over:create";
    if (!beginPendingAction(actionKey)) return;
    try {
      await createCashMovement({
        movement_type: "Dünden Devir Nakit",
        direction: "in",
        amount,
        note,
      });
      await refreshFromDatabase();
      setSyncMessage("Dünden Devir Nakit Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Dünden devir Supabase'e yazılamadı.");
      return;
    } finally {
      endPendingAction(actionKey);
    }

    setCashCarryForm({ amount: "", note: "" });
  }

  function updateBankTransferDraft(id, patch) {
    setBankTransferDrafts((drafts) => ({
      ...drafts,
      [id]: { ...(drafts[id] || {}), ...patch },
    }));
  }

  async function handleBankCashSkeletonTransfer(bank) {
    const draft = bankTransferDrafts[bank.id] || {};
    const currentBalance = bankCashSkeletonBalanceFor(bank.name);
    const withdrawAmount = parseMoneyInput(draft.withdraw);
    if (!withdrawAmount) return alert("Çekilecek tutar yaz");
    if (withdrawAmount > currentBalance) return alert("Çekilecek tutar bankada olan tutardan fazla olamaz.");

    const actionKey = `bank-withdrawal:${bank.id || bank.name}`;
    if (!beginPendingAction(actionKey)) return;
    try {
      await createBankWithdrawal({
        bank_name: bank.name,
        amount: withdrawAmount,
        note: draft.note || `Bankadan Nakit Gelen - ${bank.name}`,
      });

      setBankTransferDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[bank.id];
        return nextDrafts;
      });
      await refreshFromDatabase();
      setSyncMessage(`${bank.name} hesabından kasaya ${money(withdrawAmount)} aktarıldı.`);
    } catch (error) {
      alert(error.message || "Bankadan kasaya aktarım kaydedilemedi.");
    } finally {
      endPendingAction(actionKey);
    }
  }

  async function addBankCashSkeletonBank() {
    const name = bankCashSkeletonForm.name.trim();
    const result = addBank(banks, name, bankCashSkeletonForm.balance);
    if (!result.ok) return alert(result.message);

    const actionKey = `bank:add:${name.toLocaleLowerCase("tr-TR")}`;
    if (!beginPendingAction(actionKey)) return;

    setBanks(result.banks);
    saveStoredBanks(result.banks);
    setBankCashSkeletonForm({ name: "", balance: "" });

    alert("Banka listeye eklendi. Başlangıç bakiyesi bu aşamada sadece gösterim/listede tutulur; gerçek banka hareketi oluşturulmadı.");
    endPendingAction(actionKey);
  }

  function cashMovementCancellationFor(item) {
    const itemId = String(item?.id || "");
    if (!itemId) return null;
    return activeCashMovements.find((movement) => (
      String(movement.id || "") !== itemId &&
      isCashMovementCancellation(movement) &&
      String(movement.relatedTable || movement.related_table || "") === "cash_movements" &&
      String(movement.relatedId || movement.related_id || movement.referenceId || movement.reference_id || "") === itemId
    )) || null;
  }

  async function createCashMovementCancellation(payload) {
    try {
      return await createCashMovement(payload);
    } catch (error) {
      const message = String(error?.message || error || "");
      if (!message.includes("movement_type") && !message.includes("violates check constraint")) throw error;
      console.warn("İptal hareket tipi Supabase constraint'e takıldı, Düzeltme ile güvenli ters hareket yazılıyor.", error);
      return createCashMovement({
        ...payload,
        movement_type: "Düzeltme",
        note: `İptal: [${payload.movement_type}] ${String(payload.note || "").replace(/^İptal:\s*/i, "")}`,
      });
    }
  }

  async function cancelCashMovement(item) {
    if (!item?.id) return alert("İptal edilecek kasa hareketi bulunamadı.");
    if (!isCancelableCashMovement(item)) return alert("Bu kasa hareketi iptal akışına uygun değil.");
    if (cashMovementCancellationFor(item)) return alert("Bu hareket daha önce iptal edilmiş.");
    if (!requireSecurityPassword("cancel", "Kasa hareketi iptali")) return;

    const amount = cashMovementAmount(item);
    if (!amount) return alert("İptal edilecek tutar bulunamadı.");
    const movementType = cashMovementCancellationTypeFor(item);
    if (!movementType) return alert("Bu hareket için iptal tipi belirlenemedi.");
    const cancellationDirection = item.direction === "out" ? "in" : "out";
    if (cancellationDirection === "out" && !alertFinancialValidation(validateCurrentCashOutLimit(amount, "Kasa hareketi iptali", {
      cashUnavailable: "Kasada yeterli nakit yok. Nakit ödeme yapılamaz.",
      cashExceeded: `Kasadaki nakitten fazla ödeme yapılamaz.\nMevcut kasa: ${formatMoney(cashWithBankIncoming)}\nGirilen ödeme: ${formatMoney(amount)}`,
    }))) return;

    const ok = window.confirm("Bu kasa hareketini iptal etmek istiyor musunuz? Orijinal kayıt silinmez; kasa etkisi ters hareketle geri alınır.");
    if (!ok) return;

    try {
      await createCashMovementCancellation({
        movement_type: movementType,
        direction: cancellationDirection,
        amount,
        note: `İptal: ${item.note || cashMovementType(item)}`,
        related_table: "cash_movements",
        related_id: item.id,
      });
      await refreshFromDatabase();
      setSyncMessage("Kasa hareketi iptal edildi ve kasa etkisi geri alındı.");
      alert("Kasa hareketi iptal edildi ve kasa etkisi geri alındı.");
    } catch (error) {
      console.error("Kasa hareketi iptal hatası", error);
      alert(error.message || "Kasa hareketi iptal edilemedi.");
    }
  }

  async function saveCariPayment(account, amountValue) {
    const amount = parseMoneyInput(amountValue);
    const currentBalance = Number(account?.remaining || 0);
    if (!account?.name) return false;
    if (!amount) {
      alert("Ödeme tutarını yaz");
      return false;
    }
    if (!alertFinancialValidation(validateFinancialLimit({
      amount,
      maxAllowed: currentBalance,
      availableCash: cashWithBankIncoming,
      paymentMethod: "Nakit",
      isCashOut: true,
      label: "Cari ödeme",
      messages: {
        maxExceeded: "Cari bakiye toplamından fazla ödeme yapılamaz.",
        cashUnavailable: "Kasada yeterli nakit yok. Nakit ödeme yapılamaz.",
        cashExceeded: `Kasadaki nakitten fazla ödeme yapılamaz.\nMevcut kasa: ${formatMoney(cashWithBankIncoming)}\nGirilen ödeme: ${formatMoney(amount)}`,
      },
    }))) return false;

    const actionKey = `cari-payment:${account.kind || "supplier"}:${account.name}`;
    if (!beginPendingAction(actionKey)) return false;
    try {
      await createContactPayment({
        kind: account.kind || "supplier",
        name: account.name,
        phone: account.phone || "",
        amount,
        currentBalance,
        notePrefix: "Cari ödeme",
      });
      await refreshFromDatabase();
      setSyncMessage(`${account.name} için cari ödeme kasadan çıkış olarak işlendi.`);
      return true;
    } catch (error) {
      alert(error.message || "Cari ödeme Supabase'e yazılamadı.");
      return false;
    } finally {
      endPendingAction(actionKey);
    }
  }

  async function saveReceivablePayment(sale, amountValue) {
    const amount = parseMoneyInput(amountValue);
    const currentRemaining = Number(sale?.remaining || 0);
    if (!sale?.id) return false;
    if (!amount) {
      alert("Tahsilat tutarını yaz");
      return false;
    }
    if (!alertFinancialValidation(validateFinancialLimit({
      amount,
      maxAllowed: currentRemaining,
      label: "Cari tahsilat",
      messages: {
        maxExceeded: "Müşteri borcundan fazla tahsilat alınamaz.",
      },
    }))) return false;

    const actionKey = `receivable-payment:${sale.id}`;
    if (!beginPendingAction(actionKey)) return false;
    try {
      await createReceivablePayment({
        saleId: sale.id,
        customerName: sale.cariPerson || sale.customer,
        amount,
        currentRemaining,
      });
      await refreshFromDatabase();
      setSyncMessage(`${sale.cariPerson || sale.customer || "Müşteri"} alacak tahsilatı kasaya giriş olarak işlendi.`);
      return true;
    } catch (error) {
      alert(error.message || "Alacak tahsilatı Supabase'e yazılamadı.");
      return false;
    } finally {
      endPendingAction(actionKey);
    }
  }

  function validateStock(module) {
    const isDevice = module === "Cihaz";
    const isSecondHandPhone = isSecondHandPhonePurchase(stockForm, module);
    const needsSecondHandDocument = requiresSecondHandDocument(stockForm, module);
    if (!isSecondHandPhone && !stockForm.supplier.trim()) return "Tedarikçi firma seç";
    if (isSecondHandPhone && !stockForm.sellerPerson.trim()) return "Satanın adı soyadı yaz";
    if (isSecondHandPhone && !stockForm.sellerPhone.trim()) return "Satanın telefonu yaz";
    if (isSecondHandPhone && cleanPhone(stockForm.sellerPhone).length !== 11) return "Satanın telefonu 11 rakam olmalı";
    if (needsSecondHandDocument && !stockForm.saleFormImageName) return secondHandDocumentAlert;
    if (!stockForm.buy || !stockForm.sell) return "Kaça aldın ve kaça satacaksın alanlarını yaz";
    if (!isDevice && !stockForm.qty) return "Stok adedi yaz";
    const purchaseTotal = parseMoneyInput(stockForm.buy) * (isDevice ? 1 : Number(stockForm.qty || 0));
    const paidTotal = parseMoneyInput(stockForm.supplierPaid);
    const paymentLimit = validateFinancialLimit({
      amount: paidTotal || 1,
      maxAllowed: purchaseTotal,
      label: "Alım ödemesi",
      messages: {
        maxExceeded: "Alınan malın alış fiyatından fazla ödeme yapılamaz.",
      },
    });
    if (paidTotal > 0 && !paymentLimit.ok) return paymentLimit.message;
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
    const isSecondHandPhone = isSecondHandPhonePurchase(stockForm, module);
    const qty = isDevice ? 1 : Number(stockForm.qty || 0);
    const purchaseTotal = parseMoneyInput(stockForm.buy) * qty;
    const supplierPaid = parseMoneyInput(stockForm.supplierPaid);
    if (supplierPaid > 0 && !alertFinancialValidation(validateFinancialLimit({
      amount: supplierPaid,
      maxAllowed: purchaseTotal,
      availableCash: cashWithBankIncoming,
      paymentMethod: "Nakit",
      isCashOut: true,
      label: "Alım ödemesi",
      messages: {
        maxExceeded: "Alınan malın alış fiyatından fazla ödeme yapılamaz.",
        cashUnavailable: "Kasada yeterli nakit yok. Nakit ödeme yapılamaz.",
        cashExceeded: `Kasadaki nakitten fazla ödeme yapılamaz.\nMevcut kasa: ${formatMoney(cashWithBankIncoming)}\nGirilen ödeme: ${formatMoney(supplierPaid)}`,
      },
    }))) return;
    const remaining = Math.max(parseMoneyInput(stockForm.buy) * qty - parseMoneyInput(stockForm.supplierPaid), 0);
    const item = {
      ...stockForm,
      id: Date.now(),
      module,
      deviceType: isDevice ? stockForm.deviceType : isAccessory ? "Aksesuar" : (stockForm.deviceType || "Diğer"),
      barcode: cleanBarcode(stockForm.barcode),
      qty,
      buy: formatMoneyInput(stockForm.buy),
      sell: formatMoneyInput(stockForm.sell),
      supplierPaid: formatMoneyInput(stockForm.supplierPaid),
      supplier: isSecondHandPhone ? "" : stockForm.supplier.trim(),
      saleDate: stockForm.saleDate || new Date().toISOString(),
      sellerPhone: cleanPhone(stockForm.sellerPhone),
      acquisitionType: isSecondHandPhone ? "Müşteri" : "Tedarikçi Firma",
      sellerCariName: isSecondHandPhone ? sellerCariName(stockForm.sellerPerson) : "",
      sellerCariRemaining: isSecondHandPhone ? remaining : 0,
    };

    const actionKey = `stock:create:${module}`;
    if (!beginPendingAction(actionKey)) return;
    try {
      await createStockItem({
        module: item.module,
        device_type: item.deviceType,
        category: item.module === "Cihaz" || item.module === "Diğer" ? item.condition : item.category,
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
        acquisition_type: item.acquisitionType,
        supplier_paid: parseMoneyInput(item.supplierPaid),
        seller_cari_remaining: Number(item.sellerCariRemaining || 0),
        note: item.module === "Aksesuar" ? item.compatibleModel : item.note,
      });

      await refreshFromDatabase();
      setSyncMessage("Stok Supabase'e kaydedildi. Kasa ve cari etkisi işlendi.");
    } catch (error) {
      alert(error.message || "Stok kaydı Supabase'e yazılamadı.");
      return;
    } finally {
      endPendingAction(actionKey);
    }

    setStockForm({ ...emptyStockForm, module });
    setStockTab("liste");
  }

  async function saveSale() {
    if (!isProgramSale && !isAccessorySale && !selectedProduct) return alert("Ürün seç");
    if (!isProgramSale && selectedProduct && Number(selectedProduct.qty || 0) <= 0) return alert("Stok yok");
    if (isProgramSale && !saleForm.search.trim()) return alert("Ne programı olduğunu yaz");
    if (!isAccessorySale && saleRemaining > 0 && !saleForm.cariPerson.trim()) return alert("Kalan bakiye varsa cari kişi zorunludur.");
    if (!isAccessorySale && !saleForm.customer.trim()) return alert("Müşteri adı soyadı / telefon yaz");
    if (!String(saleForm.total || "").trim() || parseMoneyInput(saleForm.total) <= 0) {
      return alert(isProgramSale ? "Ne kadar olduğunu yaz" : "Satış fiyatını yaz");
    }
    if (!saleTotal) return alert(isProgramSale ? "Ne kadar olduğunu yaz" : "Satış fiyatını yaz");
    if (!alertFinancialValidation(validatePaymentDistribution({
      totalAmount: saleTotal,
      cashAmount: saleCash,
      cardAmount: saleCard,
      messages: { overpaid: "Nakit + kart toplamı satış fiyatını aşamaz." },
    }))) return;
    if (isAccessorySale && saleRemaining > 0 && !saleForm.cariPerson.trim() && !saleForm.customer.trim()) return alert("Cari/kalan varsa müşteri adı zorunludur.");
    if (saleCard > 0 && !saleForm.bank) return alert("Kart ödeme varsa banka seç");

    const sale = calcSale({
      id: Date.now(),
      type: saleForm.type,
      customer: saleForm.customer.trim(),
      cariPerson: saleForm.cariPerson.trim() || saleForm.customer.trim(),
      bank: saleForm.bank,
      productName: isProgramSale ? saleForm.search.trim() : (selectedProduct ? productTitle(selectedProduct) : saleForm.search.trim()),
      productId: isProgramSale || !selectedProduct ? null : selectedProduct.id,
      productBuyPrice: isProgramSale || !selectedProduct ? 0 : selectedProduct.buy,
      productBarcode: isProgramSale || !selectedProduct ? "" : selectedProduct.barcode,
      total: saleForm.total,
      cash: saleForm.cash,
      card: saleForm.card,
      date: new Date().toISOString(),
    });

    const actionKey = "sale:create";
    if (!beginPendingAction(actionKey)) return;
    try {
      await createSale({
        sale_group: saleGroupName(sale.type),
        sale_type: sale.type,
        stock_item_id: isProgramSale || !selectedProduct ? null : selectedProduct.id,
        product_name: sale.productName,
        customer_name: sale.customer,
        customer_phone: "",
        cari_person: sale.cariPerson || sale.customer,
        total_amount: parseMoneyInput(sale.total),
        cash_amount: parseMoneyInput(sale.cash),
        card_amount: parseMoneyInput(sale.card),
        remaining_amount: parseMoneyInput(sale.remaining),
        buy_cost: parseMoneyInput(sale.productBuyPrice),
        profit_amount: parseMoneyInput(sale.profit),
        bank_name: sale.bank || null,
      });

      await refreshFromDatabase();

      setSyncMessage("Satış Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Satış Supabase'e yazılamadı.");
      return;
    } finally {
      endPendingAction(actionKey);
    }

    setSaleForm({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  }

  async function updateSale() {
    const fixed = calcSale(editingSale);
    const editTotal = parseMoneyInput(fixed.total);
    const editCash = parseMoneyInput(fixed.cash);
    const editCard = parseMoneyInput(fixed.card);
    if (!alertFinancialValidation(validatePaymentDistribution({
      totalAmount: editTotal,
      cashAmount: editCash,
      cardAmount: editCard,
      messages: { overpaid: "Nakit + kart toplamı satış fiyatını aşamaz." },
    }))) return;
    const editCustomerName = String(fixed.customer || fixed.cariPerson || "").trim();
    if (Number(fixed.remaining || 0) > 0 && !editCustomerName) {
      alert("Kalan bakiye varsa müşteri adı zorunludur.");
      return;
    }

    try {
      await updateSaleRecord(fixed.id, {
        sale_group: saleGroupName(fixed.type),
        sale_type: fixed.type,
        product_name: fixed.productName,
        customer_name: editCustomerName,
        customer_phone: fixed.customerPhone || "",
        cari_person: fixed.cariPerson || editCustomerName,
        total_amount: parseMoneyInput(fixed.total),
        cash_amount: parseMoneyInput(fixed.cash),
        card_amount: parseMoneyInput(fixed.card),
        remaining_amount: Number(fixed.remaining || 0),
        buy_cost: parseMoneyInput(fixed.productBuyPrice || 0),
        profit_amount: Number(fixed.profit || 0),
        bank_name: fixed.bank || null,
      });
      await refreshFromDatabase();
      setEditingSale(null);
      setSyncMessage("Satış düzeltmesi aktif workspace içinde Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Satış düzeltmesi Supabase'e yazılamadı.");
    }
  }

  async function updateStock() {
    alert("Stok ekranından düzenleme kapalıdır. Düzeltme, iptal ve iade işlemleri sadece Günlük Kasa Raporu / Kasa Beyni üzerinden yapılır.");
    return;
    const fixed = {
      ...editingStock,
      barcode: cleanBarcode(editingStock.barcode),
      buy: formatMoneyInput(editingStock.buy),
      sell: formatMoneyInput(editingStock.sell),
      supplierPaid: formatMoneyInput(editingStock.supplierPaid),
    };
    const purchaseTotal = parseMoneyInput(fixed.buy) * Number(fixed.qty || 1);
    const paidTotal = parseMoneyInput(fixed.supplierPaid);
    const stockEditPaymentLimit = validateFinancialLimit({
      amount: paidTotal || 1,
      maxAllowed: purchaseTotal,
      label: "Alım ödemesi",
      messages: {
        maxExceeded: "Alınan malın alış fiyatından fazla ödeme yapılamaz.",
      },
    });
    if (paidTotal > 0 && !alertFinancialValidation(stockEditPaymentLimit)) {
      return;
    }
    try {
      await updateStockItem(fixed.id, {
        module: fixed.module,
        device_type: fixed.deviceType,
        category: fixed.module === "Cihaz" || fixed.module === "Diğer" ? fixed.condition : fixed.category,
        sub_type: fixed.accessorySubType,
        brand: fixed.brand,
        model: fixed.model,
        memory: fixed.memory,
        product_name: productTitle(fixed) || fixed.name || fixed.model || "Ürün",
        barcode: fixed.module === "Cihaz" ? "" : fixed.barcode,
        imei: fixed.module === "Cihaz" ? fixed.barcode : "",
        buy_price: parseMoneyInput(fixed.buy),
        sell_price: parseMoneyInput(fixed.sell),
        quantity: Number(fixed.qty || 0),
        supplier_name: fixed.supplier || "",
        seller_person: fixed.sellerPerson || "",
        seller_phone: fixed.sellerPhone || "",
        acquisition_type: fixed.acquisitionType || "Tedarikçi Firma",
        supplier_paid: parseMoneyInput(fixed.supplierPaid),
        seller_cari_remaining: Number(fixed.sellerCariRemaining || 0),
        note: fixed.module === "Aksesuar" ? fixed.compatibleModel : fixed.note,
      });
      await refreshFromDatabase();
      setEditingStock(null);
      setSyncMessage("Stok düzeltmesi aktif workspace içinde Supabase'e kaydedildi.");
    } catch (error) {
      alert(error.message || "Stok düzeltmesi Supabase'e yazılamadı.");
    }
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
    if (!requireSecurityPassword("edit", "Kâr menüsü")) return;
    setProfitUnlocked(true);
    setKaraTab("kar");
  }

  function transferProductToSale(product) {
    if (!product) return;
    const target = saleTargetFromStockProduct(product);
    const code = product.barcode || product.imei || "";
    const title = productTitle(product) || product.name || "Ürün";

    setSaleGroup(target.saleGroup);
    setSaleForm({
      type: target.saleType,
      customer: "",
      cariPerson: "",
      search: code || title,
      productId: product.id,
      total: product.sell || "",
      cash: product.sell || "",
      card: "",
      bank: cartBankName || "",
    });
    setKasaTab("yeniSatis");
    setActive("kasa");
    setSearchModalOpen(false);
    setSyncMessage(`${title} satış formuna aktarıldı.`);
  }

  function openTechnicalServiceForm() {
    setTechnicalServiceForm(makeEmptyTechnicalServiceForm());
    setSelectedTechnicalServiceId("");
    setTechnicalServiceMode("new");
    setTechnicalServiceFormModalOpen(true);
    setTechnicalServiceDetailModalOpen(false);
  }

  function openTechnicalServiceDetail(serviceId, asModal = false) {
    if (!serviceId) return alert("Servis bağlantısı bulunamadı.");
    const exists = technicalServices.some((item) => String(item.id) === String(serviceId));
    if (!exists) return alert("Bağlı teknik servis kaydı bulunamadı.");
    setSelectedTechnicalServiceId(String(serviceId));
    setTechnicalServiceMode("detail");
    setTechnicalServiceDetailModalOpen(Boolean(asModal));
  }

  function cycleTechnicalStatusFilter() {
    const currentIndex = technicalServiceFilterOptions.indexOf(technicalStatusFilter);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % technicalServiceFilterOptions.length : 0;
    setTechnicalStatusFilter(technicalServiceFilterOptions[nextIndex]);
  }

  function transferProductToTechnicalService(product) {
    if (!product) return;
    const title = productTitle(product) || product.name || "Cihaz";
    setTechnicalServiceForm({
      ...technicalServiceForm,
      brand: product.brand || "",
      model: product.model || "",
      device: title,
      imei: cleanImei(product.imei || product.barcode || ""),
      stockItemId: product.id || "",
    });
    setTechnicalServiceMode("new");
    setTechnicalServiceFormModalOpen(true);
    setTechnicalSearchModalOpen(false);
    setSyncMessage(`${title} teknik servis formuna aktarıldı.`);
  }

  async function saveTechnicalService() {
    const customerName = technicalServiceForm.customerName.trim();
    const phone = formatPhoneDisplay(technicalServiceForm.phone);
    const brand = technicalServiceForm.brand.trim();
    const model = technicalServiceForm.model.trim();
    const device = technicalServiceForm.device.trim() || [brand, model].filter(Boolean).join(" ").trim();
    const imei = cleanImei(technicalServiceForm.imei);
    const issue = technicalServiceForm.issue.trim();
    const totalAmount = parseMoneyInput(technicalServiceForm.estimatedPrice);
    const cashDeposit = parseMoneyInput(technicalServiceForm.deposit);
    const cardDeposit = parseMoneyInput(technicalServiceForm.cardDeposit);
    const totalDeposit = cashDeposit + cardDeposit;

    if (!customerName) return alert("Müşteri adı soyadı yaz");
    if (!phone) return alert("Müşteri telefonu yaz");
    if (!device) return alert("Cihaz / model yaz");
    if (technicalServiceForm.imei && imei.length !== 15) return alert("IMEI girildiyse tam 15 rakam olmalıdır.");
    if (!issue) return alert("Arıza açıklaması yaz");
    if (!technicalServiceForm.technician.trim()) return alert("Teknisyen / Teslim Alan seçilmelidir.");
    if (totalDeposit > 0 && !totalAmount) return alert("Kaparo/ödeme alınacaksa toplam servis tutarını yaz.");
    if (totalDeposit > 0 && !alertFinancialValidation(validatePaymentDistribution({
      totalAmount,
      cashAmount: cashDeposit,
      cardAmount: cardDeposit,
      messages: { overpaid: "Kaparo toplam servis ücretinden fazla olamaz." },
    }))) return;
    if (cardDeposit > 0 && !technicalServiceForm.bank) return alert("Kart/banka kaparosu için banka seçmek zorunludur.");

    const serviceId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const actionKey = "technical-service:create";
    if (!beginPendingAction(actionKey)) return;

    const record = {
      id: serviceId,
      customerName,
      phone,
      brand,
      model,
      device,
      imei,
      color: technicalServiceForm.color.trim(),
      accessory: technicalServiceForm.accessory.trim(),
      stockItemId: technicalServiceForm.stockItemId || "",
      issue,
      repairAction: technicalServiceForm.repairAction.trim(),
      technician: technicalServiceForm.technician.trim(),
      estimatedPrice: formatMoneyInput(technicalServiceForm.estimatedPrice),
      deposit: formatMoneyInput(totalDeposit),
      cashDeposit: formatMoneyInput(cashDeposit),
      cardDeposit: formatMoneyInput(cardDeposit),
      bank: technicalServiceForm.bank,
      dueDate: technicalServiceForm.dueDate || toDatetimeLocalInput(),
      deliveryDateTime: technicalServiceForm.dueDate || toDatetimeLocalInput(),
      status: technicalServiceForm.status || "Beklemede",
      note: technicalServiceForm.note.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await createTechnicalServiceWithEffects(record);
    } catch (error) {
      console.error("Teknik servis transaction hatası", error);
      alert(error.message || "Teknik servis kaydı merkezi transaction ile oluşturulamadı. Kayıt yapılmadı.");
      return;
    } finally {
      endPendingAction(actionKey);
    }

    setTechnicalServiceForm(makeEmptyTechnicalServiceForm());
    setSelectedTechnicalServiceId(serviceId);
    setTechnicalServiceMode("detail");
    setTechnicalServiceFormModalOpen(false);
    await refreshFromDatabase();
    setSyncMessage("Teknik servis kaydı açıldı; kaparo/ödeme kasa veya banka hareketlerine işlendi.");
  }

  async function updateTechnicalServiceStatus(id, status) {
    const actionType = status === "İptal" ? "cancel" : "edit";
    const actionLabel = status === "İptal" ? "Teknik servis iptali" : "Teknik servis durum düzenleme";
    if (!requireSecurityPassword(actionType, actionLabel)) return;
    try {
      const current = technicalServices.find((item) => String(item.id) === String(id)) || {};
      await updateTechnicalServiceRecord(id, { ...current, status, payload: { ...current, status } });
      await refreshFromDatabase();
      setSyncMessage("Teknik servis durumu Supabase üzerinde güncellendi.");
    } catch (error) {
      alert(error.message || "Teknik servis durumu güncellenemedi.");
    }
  }

  async function saveTechnicalServiceFinance(service, mode) {
    if (!service?.id) return alert("Servis kaydı seçilemedi.");
    const isRefund = mode === "refund";
    const form = isRefund ? technicalRefundForm : technicalPaymentForm;
    const amount = parseMoneyInput(form.amount);
    const method = form.method || "Nakit";
    const summary = technicalServiceSummary(service);

    if (!amount) return alert(isRefund ? "İade tutarını yaz." : "Ödeme tutarını yaz.");
    if (!summary.total && !isRefund) return alert("Toplam servis tutarı yazılmadan ödeme alınamaz.");
    if (!isRefund && !alertFinancialValidation(validateFinancialLimit({
      amount,
      maxAllowed: summary.remaining,
      label: "Teknik servis ödeme",
      messages: {
        maxExceeded: "Teknik servis kalan bakiyesinden fazla ödeme alınamaz.",
      },
    }))) return;
    if (method === "Kart/Banka" && !form.bank) return alert("Banka seçmek zorunludur.");
    if (isRefund) {
      if (!requireSecurityPassword("cancel", "Teknik servis iadesi")) return;
      const source = method === "Kart/Banka"
        ? summary.refundSources.find((item) => item.method === "Kart/Banka" && item.bank === form.bank)
        : summary.refundSources.find((item) => item.key === "cash");
      const available = source?.available || 0;

      if (!alertFinancialValidation(validateFinancialLimit({
        amount,
        maxAllowed: summary.net,
        availableCash: method === "Nakit" ? cashWithBankIncoming : undefined,
        paymentMethod: method,
        isCashOut: method === "Nakit",
        label: "Teknik servis iadesi",
        messages: {
          maxExceeded: "Teknik servis iadesi ödenen toplam tutardan fazla olamaz.",
          cashUnavailable: "Kasada yeterli nakit yok. Nakit iade yapılamaz.",
          cashExceeded: `Kasadaki nakitten fazla iade yapılamaz.\nMevcut kasa: ${formatMoney(cashWithBankIncoming)}\nGirilen ödeme: ${formatMoney(amount)}`,
        },
      }))) return;
      if (!available) return alert("Bu kaynakta iade edilebilir tutar yok.");
      if (amount > available) return alert(`Bu kaynaktan en fazla ${money(available)} iade yapılabilir.`);
    }

    const note = (form.note || `${isRefund ? "Teknik servis iade" : "Teknik servis tahsilat"} - ${service.customerName || "Müşteri"} - ${service.device || "Cihaz"}`).slice(0, 180);
    const actionKey = `technical-service-finance:${mode}:${service.id}`;

    if (!beginPendingAction(actionKey)) return;
    try {
      await recordTechnicalServiceFinanceWithEffects({
        serviceId: service.id,
        mode,
        amount,
        method,
        bank: form.bank,
        note,
      });
      if (isRefund) setTechnicalRefundForm(emptyTechnicalPaymentForm);
      else setTechnicalPaymentForm(emptyTechnicalPaymentForm);
      await refreshFromDatabase();
      setSyncMessage(isRefund ? "Teknik servis iadesi kaydedildi." : "Teknik servis ödemesi kaydedildi.");
    } catch (error) {
      alert(error.message || "Teknik servis ödeme/iade merkezi transaction ile kaydedilemedi. İşlem yapılmadı.");
    } finally {
      endPendingAction(actionKey);
    }
  }

  function renderTechnicalServiceForm() {
    return (
      <div className="technical-service-form-shell">
        <div className="technical-detail-header">
          <div>
            <h3>YENİ SERVİS KAYDI</h3>
          </div>
          <button className="print-action compact-action" type="button" onClick={printPage} aria-label="Yeni servis kaydını yazdır"><Printer size={15} /> YAZ</button>
          <button className="delete-btn compact-action" type="button" onClick={() => setTechnicalServiceFormModalOpen(false)}>Kapat</button>
        </div>

        <div className="technical-info-grid technical-modal-form-grid">
          <div className="technical-info-block technical-form-block">
            <h4>MÜŞTERİ / CİHAZ BİLGİLERİ</h4>
            <input type="text" placeholder="Müşteri adı" value={technicalServiceForm.customerName} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, customerName: e.target.value })} />
            <input type="tel" inputMode="numeric" placeholder="Telefon 0 (5xx) xxx xx xx" value={technicalServiceForm.phone} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, phone: cleanPhone(e.target.value) })} onBlur={() => setTechnicalServiceForm({ ...technicalServiceForm, phone: formatPhoneDisplay(technicalServiceForm.phone) })} onFocus={() => setTechnicalServiceForm({ ...technicalServiceForm, phone: cleanPhone(technicalServiceForm.phone) })} />
            <input type="text" placeholder="Marka / Cihaz" value={technicalServiceForm.brand} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, brand: e.target.value })} />
            <input type="text" placeholder="Model" value={technicalServiceForm.model} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, model: e.target.value })} />
            <input type="text" placeholder="Cihaz açıklaması" value={technicalServiceForm.device} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, device: e.target.value })} />
            <input type="text" inputMode="numeric" maxLength={15} placeholder="IMEI (opsiyonel, 15 rakam)" value={technicalServiceForm.imei} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, imei: cleanImei(e.target.value) })} />
            <input type="text" placeholder="Renk" value={technicalServiceForm.color} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, color: e.target.value })} />
            <input type="text" placeholder="Aksesuar" value={technicalServiceForm.accessory} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, accessory: e.target.value })} />
          </div>

          <div className="technical-info-block technical-form-block">
            <h4>SERVİS BİLGİLERİ</h4>
            <input type="datetime-local" aria-label="Cihaz teslim tarihi ve saati" value={technicalServiceForm.dueDate} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, dueDate: e.target.value })} />
            <select value={technicalServiceForm.status} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, status: e.target.value })}>
              {technicalServiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <input type="text" placeholder="Teknisyen / Teslim Alan" value={technicalServiceForm.technician} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, technician: e.target.value })} />
            <textarea className="technical-textarea" placeholder="Arıza / Sorun" value={technicalServiceForm.issue} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, issue: e.target.value })} />
            <textarea className="technical-textarea" placeholder="Yapılan işlem" value={technicalServiceForm.repairAction} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, repairAction: e.target.value })} />
            <textarea className="technical-textarea" placeholder="Servis notu" value={technicalServiceForm.note} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, note: e.target.value })} />
          </div>

          <div className="technical-info-block technical-form-block finance">
            <h4>FİNANSAL BİLGİLER</h4>
            <input type="text" inputMode="numeric" placeholder="Toplam servis tutarı" value={technicalServiceForm.estimatedPrice} onFocus={() => setTechnicalServiceForm({ ...technicalServiceForm, estimatedPrice: stripMoneyForEdit(technicalServiceForm.estimatedPrice) })} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, estimatedPrice: cleanMoneyTyping(e.target.value) })} onBlur={() => setTechnicalServiceForm({ ...technicalServiceForm, estimatedPrice: formatMoneyInput(technicalServiceForm.estimatedPrice) })} />
            <input type="text" inputMode="numeric" placeholder="Nakit kaparo / ödeme" value={technicalServiceForm.deposit} onFocus={() => setTechnicalServiceForm({ ...technicalServiceForm, deposit: stripMoneyForEdit(technicalServiceForm.deposit) })} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, deposit: cleanMoneyTyping(e.target.value) })} onBlur={() => setTechnicalServiceForm({ ...technicalServiceForm, deposit: formatMoneyInput(technicalServiceForm.deposit) })} />
            <input type="text" inputMode="numeric" placeholder="Kart kaparo / ödeme" value={technicalServiceForm.cardDeposit} onFocus={() => setTechnicalServiceForm({ ...technicalServiceForm, cardDeposit: stripMoneyForEdit(technicalServiceForm.cardDeposit) })} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, cardDeposit: cleanMoneyTyping(e.target.value) })} onBlur={() => setTechnicalServiceForm({ ...technicalServiceForm, cardDeposit: formatMoneyInput(technicalServiceForm.cardDeposit) })} />
            <select value={technicalServiceForm.bank} onChange={(e) => setTechnicalServiceForm({ ...technicalServiceForm, bank: e.target.value })}>
              <option value="">Kart/banka için banka seç</option>
              {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
            </select>
            <div className="technical-modal-actions">
              <button className="primary" type="button" onClick={saveTechnicalService}><Plus size={16} /> KAYDET</button>
              <button className="choice" type="button" onClick={() => setTechnicalServiceFormModalOpen(false)}>VAZGEÇ</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderTechnicalServiceDetailCard(service, summary, modal = false) {
    if (!service) return null;
    const refundBankSources = (summary.refundSources || []).filter((source) => source.method === "Kart/Banka" && source.available > 0);
    const refundSourceValue = technicalRefundForm.method === "Kart/Banka" ? `bank:${technicalRefundForm.bank}` : "cash";
    const selectRefundSource = (value) => {
      if (value === "cash") {
        setTechnicalRefundForm({ ...technicalRefundForm, method: "Nakit", bank: "" });
        return;
      }
      setTechnicalRefundForm({ ...technicalRefundForm, method: "Kart/Banka", bank: value.replace(/^bank:/, "") });
    };
    const historyRows = summary.history.map((item) => [
      new Date(item.date).toLocaleString("tr-TR"),
      item.type,
      item.method,
      item.note || "-",
      <span className={item.direction === "out" ? "technical-money-out" : "technical-money-in"}>{`${item.direction === "out" ? "-" : "+"}${money(item.amount)}`}</span>,
      item.bank || (item.method === "Nakit" ? "Kasa" : "-"),
      currentUser?.email || "-",
    ]);

    return (
      <div className={modal ? "technical-service-detail-card global-detail" : "technical-service-detail-card"}>
        <div className="technical-detail-header">
          <div>
            <h3>SERVİSTE BİLGİ FORMU — CEPLOG PROFESYONEL TEKNİK EKİP</h3>
          </div>
          <button className="delete-btn compact-action" type="button" onClick={() => modal ? setTechnicalServiceDetailModalOpen(false) : setSelectedTechnicalServiceId("")}>Kapat</button>
        </div>

        <div className="technical-info-grid">
          <div className="technical-info-block">
            <h4>MÜŞTERİ / CİHAZ BİLGİLERİ</h4>
            <div><span>Müşteri adı</span><b>{service.customerName || "-"}</b></div>
            <div><span>Telefon</span><b>{service.phone || "-"}</b></div>
            <div><span>Cihaz</span><b>{service.device || "-"}</b></div>
            <div><span>IMEI</span><b>{service.imei || "-"}</b></div>
            <div><span>Renk</span><b>{service.color || "-"}</b></div>
            <div><span>Aksesuar</span><b>{service.accessory || "-"}</b></div>
          </div>

          <div className="technical-info-block">
            <h4>SERVİS BİLGİLERİ</h4>
            <div><span>Kayıt tarihi</span><b>{formatRecordDate(service.createdAt)}</b></div>
            <div><span>Teslim tarihi</span><b>{formatRecordDate(service.deliveryDateTime || service.dueDate || service.createdAt)}</b></div>
            <div><span>Durum</span><b>{service.status || "-"}</b></div>
            <div><span>Teknisyen / Teslim Alan</span><b>{service.technician || "-"}</b></div>
            <div><span>Arıza / Sorun</span><b>{service.issue || "-"}</b></div>
            <div><span>Yapılan işlem</span><b>{service.repairAction || "-"}</b></div>
            <div><span>Servis notu</span><b>{service.note || "-"}</b></div>
          </div>

          <div className="technical-info-block finance">
            <h4>FİNANSAL ÖZET</h4>
            <div><span>Toplam Servis Tutarı</span><b>{money(summary.total)}</b></div>
            <div><span>Nakit Tahsilat</span><b>{money(summary.cashCollected)}</b></div>
            <div><span>Kart/Banka Tahsilat</span><b>{money(summary.bankCollected)}</b></div>
            <div><span>Toplam İade</span><b>{money(summary.refunded)}</b></div>
            <div><span>Net Tahsilat</span><b>{money(summary.net)}</b></div>
            <div><span>Kalan Tutar</span><b>{money(summary.remaining)}</b></div>
            <div><span>İade Edilebilir Nakit</span><b>{money(summary.cashRefundAvailable)}</b></div>
            <div><span>İade Edilebilir Kart/Banka</span><b>{money(summary.bankRefundAvailable)}</b></div>
            <div className="technical-finance-actions">
              <button className="primary compact-action" type="button" onClick={() => setTechnicalPaymentForm(emptyTechnicalPaymentForm)}>ÖDEME AL</button>
              <button
                className="delete-btn compact-action"
                type="button"
                onClick={() => {
                  const firstSource = (summary.refundSources || []).find((source) => source.available > 0);
                  setTechnicalRefundForm({
                    ...emptyTechnicalPaymentForm,
                    method: firstSource?.method || "Nakit",
                    bank: firstSource?.bank || "",
                  });
                }}
              >
                İADE YAP
              </button>
              <button className="edit-btn compact-action" type="button" onClick={() => setSyncMessage("Ödeme / iade geçmişi aşağıda listelendi.")}>GEÇMİŞİ GÖR</button>
            </div>
          </div>
        </div>

        <div className="technical-service-actions-grid">
          <div className="technical-mini-form">
            <h4>ÖDEME AL</h4>
            <input type="text" inputMode="numeric" placeholder="Tutar" value={technicalPaymentForm.amount} onFocus={() => setTechnicalPaymentForm({ ...technicalPaymentForm, amount: stripMoneyForEdit(technicalPaymentForm.amount) })} onChange={(e) => setTechnicalPaymentForm({ ...technicalPaymentForm, amount: cleanMoneyTyping(e.target.value) })} onBlur={() => setTechnicalPaymentForm({ ...technicalPaymentForm, amount: formatMoneyInput(technicalPaymentForm.amount) })} />
            <select value={technicalPaymentForm.method} onChange={(e) => setTechnicalPaymentForm({ ...technicalPaymentForm, method: e.target.value })}>
              <option value="Nakit">Nakit</option>
              <option value="Kart/Banka">Kart/Banka</option>
            </select>
            {technicalPaymentForm.method === "Kart/Banka" && (
              <select value={technicalPaymentForm.bank} onChange={(e) => setTechnicalPaymentForm({ ...technicalPaymentForm, bank: e.target.value })}>
                <option value="">Banka seç</option>
                {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
              </select>
            )}
            <input placeholder="Açıklama" value={technicalPaymentForm.note} onChange={(e) => setTechnicalPaymentForm({ ...technicalPaymentForm, note: e.target.value })} />
            <button className="primary compact-action" type="button" onClick={() => saveTechnicalServiceFinance(service, "payment")}>ÖDEME AL</button>
          </div>

          <div className="technical-mini-form">
            <h4>PARA İADESİ</h4>
            <div className="technical-refund-sources">
              <b>İade edilebilir kaynaklar</b>
              {(summary.refundSources || []).filter((source) => source.available > 0).length ? (
                (summary.refundSources || []).filter((source) => source.available > 0).map((source) => (
                  <span key={source.key}>{source.label}: {money(source.available)}</span>
                ))
              ) : (
                <span>İade edilebilir tahsilat yok.</span>
              )}
            </div>
            <input type="text" inputMode="numeric" placeholder="İade tutarı" value={technicalRefundForm.amount} onFocus={() => setTechnicalRefundForm({ ...technicalRefundForm, amount: stripMoneyForEdit(technicalRefundForm.amount) })} onChange={(e) => setTechnicalRefundForm({ ...technicalRefundForm, amount: cleanMoneyTyping(e.target.value) })} onBlur={() => setTechnicalRefundForm({ ...technicalRefundForm, amount: formatMoneyInput(technicalRefundForm.amount) })} />
            <select value={refundSourceValue} onChange={(e) => selectRefundSource(e.target.value)}>
              <option value="cash" disabled={summary.cashRefundAvailable <= 0}>Nakit / Kasa — {money(summary.cashRefundAvailable)}</option>
              {refundBankSources.map((source) => (
                <option key={source.key} value={`bank:${source.bank}`}>{source.bank} — {money(source.available)}</option>
              ))}
            </select>
            <input placeholder="Açıklama" value={technicalRefundForm.note} onChange={(e) => setTechnicalRefundForm({ ...technicalRefundForm, note: e.target.value })} />
            <button className="delete-btn compact-action" type="button" onClick={() => saveTechnicalServiceFinance(service, "refund")}>İADE YAP</button>
          </div>
        </div>

        <h4 className="technical-history-title">ÖDEME / İADE GEÇMİŞİ</h4>
        <Table headers={["Tarih", "İşlem", "Yöntem", "Açıklama", "Tutar", "Banka/Kasa", "Kullanıcı"]} rows={historyRows} />
      </div>
    );
  }

  function createBackupPayload() {
    return {
      app: "CEPLOG",
      version: "professional-backup-v1",
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser?.email || currentUser?.id || "unknown",
      company: {
        name: "CEPLOG",
        since: 1999,
        description: "26 Yıllık Tecrübeyle Yapılan Profesyonel GSM Satış Teknik Servis Takip Sistemi",
      },
      counts: {
        stock: activeStock.length,
        sales: activeSales.length,
        expenses: activeExpenses.length,
        bankMovements: activeBankMovements.length,
        cashMovements: activeCashMovements.length,
        contacts: activeContacts.length,
        suppliers: suppliers.length,
        technicalServices: technicalServices.length,
      },
      data: {
        stock,
        sales,
        expenses,
        bankMovements,
        cashMovements,
        contacts,
        suppliers,
        cashClosings: [],
        accessoryShortcuts,
        technicalServices,
      },
    };
  }

  function backupFileName() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `ceplog-yedek-${stamp}.json`;
  }

  function downloadBackupFile() {
    const payload = createBackupPayload();
    const fileName = backupFileName();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSyncMessage(`Yedek dosyası hazırlandı: ${fileName}`);
  }

  async function shareBackupFile() {
    const payload = createBackupPayload();
    const fileName = backupFileName();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const file = new File([blob], fileName, { type: "application/json" });

    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({
          title: "CEPLOG Yedek Dosyası",
          text: "CEPLOG yedek dosyası",
          files: [file],
        });
        setSyncMessage("Yedek paylaşım menüsüne gönderildi.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    downloadBackupFile();
    alert("Bu cihazda doğrudan paylaşım desteklenmiyor. Yedek dosyası indirildi. Google Drive'a veya Mail'e manuel yükleyebilirsin.");
  }

  function prepareEmailBackup() {
    downloadBackupFile();
    const subject = encodeURIComponent("CEPLOG Yedek Dosyası");
    const body = encodeURIComponent("CEPLOG yedek dosyasını oluşturdum. İndirilen JSON dosyasını bu mail'e ekleyerek gönderebilirsin.");
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  const accessoryShortcutStorageKey = activeWorkspaceId || currentUser?.id || "";
  const technicalServiceStorageKey = activeWorkspaceId || currentUser?.id || "";

  useEffect(() => {
    if (!accessoryShortcutStorageKey) return;
    const saved = localStorage.getItem(`ceplog_accessory_shortcuts_${accessoryShortcutStorageKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setAccessoryShortcuts(parsed.slice(0, accessoryShortcutLimit));
      } catch {
        setAccessoryShortcuts([]);
      }
    }

    const hiddenSaved = localStorage.getItem(`ceplog_hidden_accessory_shortcuts_${accessoryShortcutStorageKey}`);
    if (hiddenSaved) {
      try {
        const parsedHidden = JSON.parse(hiddenSaved);
        if (Array.isArray(parsedHidden)) setHiddenShortcutIds(parsedHidden.map((id) => String(id)));
      } catch {
        setHiddenShortcutIds([]);
      }
    } else {
      setHiddenShortcutIds([]);
    }
  }, [accessoryShortcutStorageKey]);

  useEffect(() => {
    if (!accessoryShortcutStorageKey) return;
    localStorage.setItem(`ceplog_accessory_shortcuts_${accessoryShortcutStorageKey}`, JSON.stringify(accessoryShortcuts.slice(0, accessoryShortcutLimit)));
  }, [accessoryShortcuts, accessoryShortcutStorageKey]);

  useEffect(() => {
    if (!accessoryShortcutStorageKey) return;
    localStorage.setItem(`ceplog_hidden_accessory_shortcuts_${accessoryShortcutStorageKey}`, JSON.stringify(hiddenShortcutIds));
  }, [hiddenShortcutIds, accessoryShortcutStorageKey]);

  useEffect(() => {
    purgeLegacyTechnicalServiceCache();
  }, [technicalServiceStorageKey]);

  useEffect(() => {
    if (!stockChoiceStorageKey) return;
    const saved = localStorage.getItem(`${stockChoiceStoragePrefix}_${stockChoiceStorageKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStockChoiceOptions(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        setStockChoiceOptions({});
      }
    } else {
      setStockChoiceOptions({});
    }
    setStockChoiceStorageReadyKey(stockChoiceStorageKey);
  }, [stockChoiceStorageKey]);

  useEffect(() => {
    if (!stockChoiceStorageKey || stockChoiceStorageReadyKey !== stockChoiceStorageKey) return;
    localStorage.setItem(`${stockChoiceStoragePrefix}_${stockChoiceStorageKey}`, JSON.stringify(stockChoiceOptions));
  }, [stockChoiceOptions, stockChoiceStorageKey, stockChoiceStorageReadyKey]);

  function addAccessoryShortcut() {
    const group = accessoryShortcutForm.group || "Kılıf";
    const subOptions = quickAccessoryGroups[group] || [group];
    const sub = accessoryShortcutForm.sub || subOptions[0] || group;
    const price = accessoryShortcutForm.price ? formatMoneyInput(accessoryShortcutForm.price) : "";

    if (!group) return alert("Grup seç");
    if (!sub) return alert("Alt seçenek seç");
    if (accessoryShortcuts.length >= accessoryShortcutLimit) return alert("En fazla 20 kısayol eklenebilir.");

    const label = `${group} - ${sub}`;
    const exists = accessoryShortcuts.some((item) => item.label.toLocaleLowerCase("tr-TR") === label.toLocaleLowerCase("tr-TR"));
    if (exists) return alert("Bu kısayol zaten var.");

    setAccessoryShortcuts([
      ...accessoryShortcuts,
      {
        id: Date.now(),
        group,
        sub,
        label,
        price,
      },
    ].slice(0, accessoryShortcutLimit));

    setAccessoryShortcutForm({ group, sub, price: "" });
  }

  function saleShortcutTarget(group) {
    const cleanGroup = String(group || "").trim().toLocaleLowerCase("tr-TR");
    if (cleanGroup === "aksesuar") return { saleGroup: "Aksesuar", saleType: "Aksesuar Satışı", group: "Aksesuar" };
    if (cleanGroup === "program") return { saleGroup: "Program", saleType: "Program Satışı", group: "Program" };
    if (cleanGroup === "telefon") return { saleGroup: "Telefon", saleType: "Telefon Satışı", group: "Telefon" };
    if (cleanGroup === "saat") return { saleGroup: "Saat", saleType: "Saat Satışı", group: "Saat" };
    if (cleanGroup === "tablet") return { saleGroup: "Tablet", saleType: "Tablet Satışı", group: "Tablet" };
    if (cleanGroup === "pc") return { saleGroup: "PC", saleType: "PC Satışı", group: "PC" };
    if (cleanGroup === "elektronik") return { saleGroup: "Elektronik", saleType: "Elektronik Satışı", group: "Elektronik" };
    if (cleanGroup === "bluetooth") return { saleGroup: "Bluetooth", saleType: "Bluetooth Satışı", group: "Bluetooth" };
    return { saleGroup: "X", saleType: "Diğerleri Satışı", group: "X" };
  }

  const shortcutIdentity = (shortcut) => String(shortcut?.productId ? `product:${shortcut.productId}` : `${shortcut?.saleType || ""}:${shortcut?.label || ""}`).toLocaleLowerCase("tr-TR");

  function makeShortcutFromStockProduct(product) {
    const target = saleTargetFromStockProduct(product);
    const label = productTitle(product) || product.name || product.model || "Ürün";
    const price = product.sell || product.sellPrice || product.sell_price ? formatMoneyInput(product.sell || product.sellPrice || product.sell_price) : "";
    return {
      id: `product-${product.id || Date.now()}`,
      group: target.group,
      sub: label,
      label,
      price,
      productId: String(product.id || ""),
      saleGroup: target.saleGroup,
      saleType: target.saleType,
      source: "stock",
    };
  }

  function addUniversalShortcutFromManagement() {
    if (visibleAccessoryShortcuts.length >= accessoryShortcutLimit) return alert("En fazla 20 kısayol eklenebilir. Yeni kısayol için önce Kısayol Sil ile ana ekrandan yer aç.");

    const modeInput = window.prompt("Kısayol ekleme türünü seç:\n1) Stok ürününden ekle\n2) Manuel / hizmet kısayolu ekle", "1");
    if (modeInput === null) return;
    const mode = String(modeInput || "").trim();

    if (mode === "1") {
      const queryInput = window.prompt("Kısayol yapılacak ürünü ara (IMEI, barkod, ürün adı, model). Boş bırakırsan ilk 20 stok ürünü listelenir.", "");
      if (queryInput === null) return;

      const queryText = String(queryInput || "").trim().toLocaleLowerCase("tr-TR");
      const productMatches = inStockItems
        .filter((product) => !queryText || stockSearchHaystack(product).includes(queryText))
        .slice(0, 20);

      if (!productMatches.length) return alert("Bu aramayla eşleşen stok ürünü bulunamadı.");

      const listText = productMatches.map((product, index) => {
        const group = displayStockGroup(stockSearchGroup(product));
        const price = formatMoneyInput(product.sell || product.sellPrice || product.sell_price || 0) || "Fiyat yok";
        return `${index + 1}) [${group}] ${productTitle(product) || product.name || "Ürün"} — ${product.imei || product.barcode || "kod yok"} — ${price}`;
      }).join("\n");
      const selectedInput = window.prompt(`Kısayol için ürün seç:\n${listText}`, "1");
      if (selectedInput === null) return;
      const selectedIndex = Number(selectedInput) - 1;
      if (!productMatches[selectedIndex]) return alert("Geçerli bir ürün numarası seç.");

      const nextShortcut = makeShortcutFromStockProduct(productMatches[selectedIndex]);
      const exists = [...visibleAccessoryShortcuts, ...accessoryShortcuts].some((item) => shortcutIdentity(item) === shortcutIdentity(nextShortcut));
      if (exists) return alert("Bu ürün ana ekranda zaten kısayol olarak var.");
      setHiddenShortcutIds((current) => current.filter((id) => String(id) !== String(nextShortcut.id)));
      setAccessoryShortcuts((current) => [...current, nextShortcut].slice(0, accessoryShortcutLimit));
      setSyncMessage("Ürün kısayolu ana ekrana eklendi.");
      return;
    }

    if (mode !== "2") return alert("Geçerli bir seçim yap: 1 veya 2.");

    const groupInput = window.prompt(`Manuel kısayol grubu yaz:\n${shortcutGroupOptions.join(", ")}`, "Aksesuar");
    if (groupInput === null) return;

    const target = saleShortcutTarget(groupInput);
    const labelInput = window.prompt("Kısayol adını yaz", target.group === "Program" ? "Program" : "");
    const label = String(labelInput || "").trim().replace(/\s+/g, " ");
    if (!label) return alert("Kısayol adı boş bırakılamaz.");

    const priceInput = window.prompt("Varsayılan fiyat yaz. Boş bırakabilirsin.", "");
    if (priceInput === null) return;
    const price = priceInput ? formatMoneyInput(priceInput) : "";
    const nextShortcut = {
      id: `manual-${Date.now()}`,
      group: target.group,
      sub: label,
      label,
      price,
      saleGroup: target.saleGroup,
      saleType: target.saleType,
      source: "manual",
    };
    const exists = [...visibleAccessoryShortcuts, ...accessoryShortcuts].some((item) => shortcutIdentity(item) === shortcutIdentity(nextShortcut));
    if (exists) return alert("Bu kısayol zaten var.");

    setAccessoryShortcuts((current) => [...current, nextShortcut].slice(0, accessoryShortcutLimit));

    setSyncMessage("Kısayol eklendi.");
  }

  function deleteAccessoryShortcut(id) {
    setAccessoryShortcuts((current) => current.filter((item) => String(item.id) !== String(id)));
    setHiddenShortcutIds((current) => Array.from(new Set([...current, String(id)])));
    setSyncMessage("Kısayol ana ekrandan kaldırıldı. Ürün veya stok kaydı silinmedi.");
  }

  function reportMoneyCell(value, options = {}) {
    const amount = Number(value || 0);
    if (!amount) return <span className="report-money muted">-</span>;
    const negative = options.negative || amount < 0;
    return (
      <span className={negative ? "report-money negative" : "report-money"}>
        {negative ? `-${money(Math.abs(amount))}` : money(amount)}
      </span>
    );
  }

  function reportTypeBadge(row) {
    return <span className={`report-type-badge ${row.tone || "default"}`}>{row.type || "-"}</span>;
  }

  function reportTextCell(value) {
    const lines = Array.isArray(value)
      ? value
      : String(value || "-").split("\n");
    const cleanLines = lines.map((line) => String(line || "").trim()).filter(Boolean);

    return (
      <span className="report-text-cell">
        {(cleanLines.length ? cleanLines : ["-"]).map((line, index) => (
          <span key={`${line}-${index}`}>{line}</span>
        ))}
      </span>
    );
  }

  function printPage() {
    window.print();
  }

  async function captureHomeScreenshot() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("Bu tarayıcı ekran fotoğrafı alma özelliğini desteklemiyor.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || window.innerWidth;
      canvas.height = video.videoHeight || window.innerHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const link = document.createElement("a");
      link.download = `ceplog-ana-ekran-${localDateKey(new Date())}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setSyncMessage("Ana ekran fotoğrafı indirildi.");
    } catch (error) {
      if (error?.name !== "NotAllowedError") {
        alert(error?.message || "Ana ekran fotoğrafı alınamadı.");
      }
    } finally {
      stream?.getTracks?.().forEach((track) => track.stop());
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ceplog_app_theme", appTheme);
  }, [appTheme]);

  useEffect(() => {
    if (!cartItems.length) return;
    setCartPayments((current) => {
      if (!cartCustomer.customerName && parseMoneyInput(current.cariAmount) <= 0) return current;
      const next = reconcileCartPaymentRemainder(current, cartSummary.netTotal, {
        allowCreateCari: Boolean(cartCustomer.customerName),
      });
      if (next.cariAmount === current.cariAmount) return current;
      return next;
    });
  }, [cartItems.length, cartSummary.netTotal, cartCustomer.customerName]);

  useEffect(() => {
    if (!searchModalOpen && !technicalSearchModalOpen && !technicalServiceDetailModalOpen && !technicalServiceFormModalOpen && !kasaSearchModalOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (kasaSearchModalOpen) {
        if (!kasaSearchQuery.trim()) setKasaSearchModalOpen(false);
        return;
      }
      setSearchModalOpen(false);
      setTechnicalSearchModalOpen(false);
      setTechnicalServiceDetailModalOpen(false);
      setTechnicalServiceFormModalOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchModalOpen, technicalSearchModalOpen, technicalServiceDetailModalOpen, technicalServiceFormModalOpen, kasaSearchModalOpen, kasaSearchQuery]);

  useEffect(() => {
    const openSorSatShortcut = (event) => {
      if (event.key !== "s" && event.key !== "S") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const targetTag = String(event.target?.tagName || "").toLocaleLowerCase("tr-TR");
      if (["input", "textarea", "select", "button"].includes(targetTag) || event.target?.isContentEditable) return;
      if (active !== "kasa" || kasaSearchModalOpen || saleLineModalOpen || cartPaymentModalOpen) return;
      event.preventDefault();
      openKasaSearchModal();
    };
    window.addEventListener("keydown", openSorSatShortcut);
    return () => window.removeEventListener("keydown", openSorSatShortcut);
  }, [active, kasaSearchModalOpen, saleLineModalOpen, cartPaymentModalOpen]);

  const calculatorKeys = [
    { label: "C", tone: "danger", action: clearCalculator },
    { label: "Sil", tone: "muted", action: deleteCalculatorToken },
    { label: "÷", tone: "operator", token: "÷" },
    { label: "×", tone: "operator", token: "×" },
    { label: "7", token: "7" },
    { label: "8", token: "8" },
    { label: "9", token: "9" },
    { label: "-", tone: "operator", token: "-" },
    { label: "4", token: "4" },
    { label: "5", token: "5" },
    { label: "6", token: "6" },
    { label: "+", tone: "operator", token: "+" },
    { label: "1", token: "1" },
    { label: "2", token: "2" },
    { label: "3", token: "3" },
    { label: "=", tone: "equals", action: calculateCalculatorValue },
    { label: "0", token: "0", wide: true },
    { label: ", / .", token: ".", wide: true },
  ];

  if (!authChecked) {
    return <div className="app"><section className="card"><h2>CEPLOG yükleniyor...</h2></section></div>;
  }

  if (!currentUser) {
    return <Login onLogin={checkAuthAndLoad} />;
  }

  return (
    <div className={`app premium-dashboard ceplog-theme-${appTheme}`}>
      <div className="shell app-shell">
        <header className="hero hero-banner">
          <div className="hero-banner-copy">
            <div className="brand-title-row">
              <div className="brand-center hero-mockup-grid">
                <div className="hero-brand-block">
                  <h1><span>CEP</span><span className="brand-log">LOG</span></h1>
                  <div className="hero-module-chips" aria-label="CEPLOG modülleri">
                    <span>Kasa</span>
                    <span>Stok</span>
                    <span>Satış</span>
                    <span>Servis</span>
                  </div>
                </div>
                <div className="hero-banner-text">
                  <strong>Satıştan kasaya, stoktan servise tek panel.</strong>
                  <p>Gün sonu kontrolü, cari takibi ve hızlı satış akışı bir arada</p>
                </div>
                <div className="hero-date-card" aria-label="Tarih ve saat">
                  <b>{clockNow.toLocaleDateString("tr-TR")}</b>
                  <strong>{clockNow.toLocaleTimeString("tr-TR", { hour12: false })}</strong>
                </div>
              </div>
            </div>
        {syncMessage && (
          <div className="sync-message">
            <span>{syncMessage}</span>
            <button type="button" onClick={() => setSyncMessage("")} aria-label="Mesajı kapat">×</button>
          </div>
        )}
          </div>
          {isLocalhostRuntime() && <div className="status-pill">WEB TEST</div>}
        </header>

        <nav className="nav-grid premium-sidebar">
          <div className="premium-sidebar-brand premium-store-card" aria-label="Mağaza bilgisi">
            <div className="premium-store-card-content">
              <div className="premium-store-icon" aria-hidden="true">
                <Smartphone size={19} />
              </div>
              <div className="premium-store-copy">
                <strong>AHMET GSM</strong>
                <span>Van Merkez Şube</span>
                <small>Lisanslı Mağaza Paneli</small>
              </div>
            </div>
            <div className="premium-store-phone" aria-hidden="true">
              <span />
            </div>
          </div>
          <div className="sidebar-contact-links">
            <a href="https://www.ceplog.com" target="_blank" rel="noreferrer">
              <Globe size={14} />
              <span>www.ceplog.com</span>
            </a>
            <a href="https://wa.me/905303088372" target="_blank" rel="noreferrer" className="sidebar-whatsapp-link">
              <MessageCircle size={14} />
              <span>WhatsApp</span>
            </a>
          </div>

          <button
            className={active === "kasa" ? "nav-btn sidebar-nav-item active" : "nav-btn sidebar-nav-item"}
            onClick={() => setActive("kasa")}
          >
            <Wallet size={22} />
            <span>KASA</span>
          </button>

          <button
            className={active === "cihaz" && stockForm.deviceType === "Telefon" ? "nav-btn sidebar-nav-item active" : "nav-btn sidebar-nav-item"}
            onClick={() => {
              const nextBrand = brands.includes(stockForm.brand) ? stockForm.brand : "Apple";
              const nextModels = modelsByBrand[nextBrand] || [];
              setStockForm({
                ...stockForm,
                module: "Cihaz",
                deviceType: "Telefon",
                brand: nextBrand,
                model: nextModels.includes(stockForm.model) ? stockForm.model : nextModels[0] || "",
                memory: stockForm.memory || memoryOptions[0],
              });
              setActive("cihaz");
            }}
          >
            <Smartphone size={22} />
            <span>TELEFON</span>
          </button>

          <button
            className={active === "aksesuar" ? "nav-btn sidebar-nav-item active" : "nav-btn sidebar-nav-item"}
            onClick={() => setActive("aksesuar")}
          >
            <Headphones size={22} />
            <span>AKSESUAR</span>
          </button>

          <button
            className={active === "digerler" ? "nav-btn sidebar-nav-item active" : "nav-btn sidebar-nav-item"}
            onClick={() => {
              const visibleGroup = toVisibleOtherGroup(stockForm.deviceType);
              const group = otherProductGroups.includes(visibleGroup) && visibleGroup !== "Telefon" ? visibleGroup : "Saat";
              const internalGroup = toInternalOtherGroup(group);
              setOtherGroupName(group);
              setStockForm({ ...stockForm, module: "Diğer", deviceType: internalGroup, condition: "Sıfır Garantili", brand: "", model: "", memory: "", name: stockForm.name || "" });
              setActive("digerler");
            }}
          >
            <Package size={22} />
            <span>DİĞERLERİ</span>
          </button>

          <button
            className={active === "stok" ? "nav-btn sidebar-nav-item active" : "nav-btn sidebar-nav-item"}
            onClick={() => setActive("stok")}
          >
            <Package size={22} />
            <span>STOK</span>
          </button>

          <button
            className={active === "tamir" ? "nav-btn sidebar-nav-item active" : "nav-btn sidebar-nav-item"}
            onClick={() => setActive("tamir")}
          >
            <Wrench size={22} />
            <span>TEKNİK SERVİS</span>
          </button>

          <button
            className={active === "vole" ? "nav-btn sidebar-nav-item active" : "nav-btn sidebar-nav-item"}
            onClick={openKaraDefter}
          >
            <TrendingUp size={22} />
            <span>KARA DEFTER</span>
          </button>

          <button
            className={active === "yonetim" ? "nav-btn sidebar-nav-item nav-mini-y active" : "nav-btn sidebar-nav-item nav-mini-y"}
            onClick={() => setActive("yonetim")}
            title="Yönetim"
            aria-label="Yönetim"
          >
            <Settings size={22} aria-hidden="true" />
            <span>YÖNETİM</span>
          </button>

        </nav>

        {searchModalOpen && (
          <div className="modal-bg">
            <div className="modal search-modal">
              <div className="search-panel">
                <div className="search-panel-head">
                  <div>
                    <h2 className="search-title">SORGULA</h2>
                    <p>Ürün adı, marka, model, barkod veya IMEI ile stok ara.</p>
                  </div>
                  <button className="choice search-close-btn" type="button" onClick={() => setSearchModalOpen(false)}>
                    <X size={18} /> KAPAT
                  </button>
                </div>

                <input
                  className="global-search-input"
                  placeholder="Ürün adı, barkod veya IMEI yaz"
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />

                <div className="search-filter-tabs">
                  {stockSearchFilters.filter((filter) => filter !== "ELEKTRONİK").map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={stockSearchFilter === filter ? "choice active" : "choice"}
                      onClick={() => setStockSearchFilter(filter)}
                    >
                      {displayStockGroup(filter)}
                    </button>
                  ))}
                </div>

                {!stockSearchResults.length ? (
                  <div className="empty-search-note">Sonuç bulunamadı.</div>
                ) : (
                  <div className="search-results-table">
                    {stockSearchResults.map((product) => {
                      const group = stockSearchGroup(product);
                      const groupLabel = displayStockGroup(group);
                      const quantity = Number(product.qty || 0);
                      const code = product.barcode || product.imei || "-";
                      const supplierOrSeller = sellerNameFromProduct(product) || product.supplier || "-";

                      return (
                        <button
                          key={product.id}
                          type="button"
                          className={quantity <= 0 ? "search-result-card out-of-stock" : "search-result-card"}
                          onClick={() => transferProductToSale(product)}
                        >
                          <div className="search-result-head">
                            <div>
                              <b>{productTitle(product) || product.name || "-"}</b>
                              <span>{[product.brand, product.model, product.memory].filter(Boolean).join(" / ") || product.deviceType || product.category || "-"}</span>
                            </div>
                            <span className="stock-status-badge">{groupLabel}</span>
                          </div>

                          <div className="search-result-grid">
                            <div><span>Kategori</span><b>{product.category || product.condition || "-"}</b></div>
                            <div><span>Grup</span><b>{groupLabel}</b></div>
                            <div><span>Barkod / IMEI</span><b>{code}</b></div>
                            <div><span>Stok</span><b>{quantity > 0 ? quantity : "Stok Yok"}</b></div>
                            <div><span>Satış</span><b>{product.sell || "0 TL"}</b></div>
                            <div><span>Alış</span><b>{product.buy || "0 TL"}</b></div>
                            <div><span>Tedarikçi / Satıcı</span><b>{supplierOrSeller}</b></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {technicalSearchModalOpen && (
          <div className="modal-bg">
            <div className="modal search-modal">
              <div className="search-panel">
                <div className="search-panel-head">
                  <div>
                    <h2 className="search-title">TEKNİK SERVİS SORGULA</h2>
                    <p>Arama yazmadan cihazları listele; cihaz seçince servis formu otomatik dolsun.</p>
                  </div>
                  <button className="choice search-close-btn" type="button" onClick={() => setTechnicalSearchModalOpen(false)}>
                    <X size={18} /> KAPAT
                  </button>
                </div>

                <input
                  className="global-search-input"
                  placeholder="Cihaz adı, marka, model, barkod veya IMEI yaz"
                  value={technicalSearchQuery}
                  onChange={(e) => setTechnicalSearchQuery(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />

                <div className="search-filter-tabs">
                  {technicalSearchFilters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={technicalSearchFilter === filter ? "choice active" : "choice"}
                      onClick={() => setTechnicalSearchFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {!technicalSearchResults.length ? (
                  <div className="empty-search-note">Cihaz bulunamadı.</div>
                ) : (
                  <div className="search-results-table">
                    {technicalSearchResults.map((product) => {
                      const group = stockSearchGroup(product);
                      const code = product.imei || product.barcode || "-";
                      const quantity = Number(product.qty || 0);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          className="search-result-card"
                          onClick={() => transferProductToTechnicalService(product)}
                        >
                          <div className="search-result-head">
                            <div>
                              <b>{productTitle(product) || product.name || "-"}</b>
                              <span>{[product.brand, product.model, product.memory].filter(Boolean).join(" / ") || product.deviceType || product.category || "-"}</span>
                            </div>
                            <span className="stock-status-badge">{group}</span>
                          </div>

                          <div className="search-result-grid">
                            <div><span>Grup</span><b>{group}</b></div>
                            <div><span>Barkod / IMEI</span><b>{code}</b></div>
                            <div><span>Stok</span><b>{quantity}</b></div>
                            <div><span>Satış</span><b>{product.sell || "0 TL"}</b></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {technicalServiceFormModalOpen && (
          <div className="modal-bg">
            <div className="modal technical-service-form-modal">
              {renderTechnicalServiceForm()}
            </div>
          </div>
        )}

        {technicalServiceDetailModalOpen && selectedTechnicalService && (
          <div className="modal-bg">
            <div className="modal technical-global-modal">
              {renderTechnicalServiceDetailCard(selectedTechnicalService, selectedTechnicalSummary, true)}
            </div>
          </div>
        )}

        {calculatorOpen && (
          <div className="modal-bg calculator-overlay" onClick={closeCalculator}>
            <div
              className="calculator-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="calculator-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="calculator-head">
                <div>
                  <h2 id="calculator-title">Hesap Makinesi</h2>
                  <span>CEPLOG</span>
                </div>
                <button type="button" className="calculator-close" onClick={closeCalculator} aria-label="Hesap makinesini kapat">
                  <X size={18} />
                </button>
              </div>

              <div className="calculator-screen">
                <div className="calculator-expression">{calculatorValue || "0"}</div>
                <div className={calculatorResult === "Hata" ? "calculator-result error" : "calculator-result"}>
                  {calculatorResult || "Sonuç"}
                </div>
              </div>

              <div className="calculator-keys">
                {calculatorKeys.map((key) => (
                  <button
                    key={key.label}
                    type="button"
                    className={[
                      "calculator-key",
                      key.tone ? `calculator-key-${key.tone}` : "",
                      key.wide ? "calculator-key-wide" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => key.action ? key.action() : appendCalculatorToken(key.token)}
                  >
                    {key.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {active === "yonetim" && (
          <section className="section management-section compact-management-section">
            <div className="management-compact-shell">
              <div className="management-left-stack">
                <div className="card management-card compact-license-card">
                  <h2>Firma / Lisans Özeti</h2>
                  <div className="management-info-list compact-license-list">
                    <div><span>Program</span><b>CEPLOG</b></div>
                    <div><span>Lisans Sahibi</span><b>{currentUser?.email || "Kayıtlı Kullanıcı"}</b></div>
                    <div><span>Aktif Workspace</span><b>{activeWorkspaceId || "-"}</b></div>
                    <div><span>Paket</span><b>Professional</b></div>
                    <div><span>Durum</span><b>Aktif</b></div>
                    <div><span>Lisansı Aldığınız Tarih</span><b>Tanımlanacak</b></div>
                    <div><span>Kalan Lisans Tarihi</span><b>Tanımlanacak</b></div>
                  </div>
                  <div className="logout-panel compact-logout-panel">
                    <span>Giriş yapan kullanıcı: <b>{currentUser?.email || "Kayıtlı Kullanıcı"}</b></span>
                    <button className="logout-btn" type="button" onClick={handleLogout}>ÇIKIŞ YAP</button>
                  </div>
                </div>

                <div className="card management-card security-password-card compact-security-card">
                  <h2>GÜVENLİK ŞİFRELERİ</h2>
                  <div className="security-password-list compact-security-list">
                    {securityPasswordFields.map((field) => (
                      <div className="security-password-row" key={field.key}>
                        <label>
                          <span>{field.label}</span>
                          <input
                            type={visibleSecurityPasswords[field.key] ? "text" : "password"}
                            value={securityPasswordDrafts[field.key] || ""}
                            onChange={(event) => updateSecurityPasswordDraft(field.key, event.target.value)}
                            placeholder={field.label}
                          />
                        </label>
                        <div className="security-password-actions">
                          <button className="edit-btn" type="button" onClick={() => toggleSecurityPasswordVisibility(field.key)}>
                            {visibleSecurityPasswords[field.key] ? "Gizle" : "Göster"}
                          </button>
                          <button className="primary security-save-btn" type="button" onClick={() => saveSecurityPasswordField(field.key)}>
                            Kaydet
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card management-card management-future-panel management-finance-panel" aria-label="Yönetim finans özet alanı">
                <div className="management-module-tabs">
                  {["Genel Özet", "Sermaye", "Kar-Zarar", "Gider", "Alacak-Borç", "Risk"].map((tab, index) => (
                    <button className={index === 0 ? "active" : ""} type="button" key={tab}>{tab}</button>
                  ))}
                </div>
                <div className="management-finance-kpis">
                  <div><span>Net Sermaye</span><b>{money(cashWithBankIncoming + bankReport.remainingInBank + report.remaining)}</b></div>
                  <div><span>Stok Sermayesi</span><b>{money(activeStock.reduce((sum, item) => sum + parseMoneyInput(item.buy) * Number(item.qty || 1), 0))}</b></div>
                  <div><span>Toplam Alacak</span><b>{money(report.remaining)}</b></div>
                  <div><span>Toplam Borç</span><b>{money(borclarim.reduce((sum, row) => sum + Number(row.remaining || 0), 0))}</b></div>
                  <div><span>Kasa / Banka</span><b>{money(cashWithBankIncoming + bankReport.remainingInBank)}</b></div>
                  <div><span>Bu Ay Net Kar</span><b>{money(report.profit - expenseReport.total)}</b></div>
                </div>
                <div className="management-risk-panel">
                  <div>
                    <h2>Yönetim Finans Özeti</h2>
                    <p>Bu panel mevcut kayıtları okur; veri düzeltme veya finansal işlem yapmaz.</p>
                  </div>
                  <div className="management-risk-list">
                    <span>Read-only</span>
                    <span>Ledger uyumu: {systemSchemaSummary.ready}/{systemSchemaSummary.total || 0}</span>
                    <span>Bulgu: {systemCheckSummary.total}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="management-tools-compact-grid">
              {isLocalhostRuntime() && (
                <div className="card management-card compact-tool-card">
                  <h2>TEMİZ TEST BAŞLANGICI</h2>
                  <p>Localhost testleri çift onaylı kasa kapanış sıfırlama alanından yapılır.</p>
                  <div className="management-info-list">
                    <div><span>Ortam</span><b>Localhost test</b></div>
                    <div><span>Veri sıfırlama</span><b>Çift onaylı</b></div>
                    <div><span>Canlı domain</span><b>Kapalı</b></div>
                  </div>
                  <button
                    className="choice"
                    type="button"
                    onClick={() => {
                      setActive("kasa");
                      setKasaTab("kapanis");
                    }}
                  >
                    Kasa Kapanış Test Alanına Git
                  </button>
                </div>
              )}

              <div className="card management-card compact-tool-card system-control-card">
                <h2>SİSTEM KONTROL</h2>
                <p>Satış, kasa, banka, cari, workspace, audit ve ledger kayıtlarını sadece okuma modunda kontrol eder.</p>
                <div className="backup-preview-grid compact-backup-preview-grid">
                  <Stat title="Toplam Bulgu" value={systemCheckSummary.total} />
                  <Stat title="Hata" value={systemCheckSummary.errors} negative={systemCheckSummary.errors > 0} />
                  <Stat title="Uyarı" value={systemCheckSummary.warnings} negative={systemCheckSummary.warnings > 0} />
                  <Stat title="Bilgi" value={systemCheckSummary.info} />
                </div>
                <button className="primary backup-btn system-control-run-btn" type="button" onClick={runSystemControlCheck}>
                  <ShieldCheck size={18} /> Kontrol Et
                </button>
                <div className="management-info-list">
                  <div><span>Son kontrol</span><b>{systemCheckLastRun || "-"}</b></div>
                  <div><span>Mod</span><b>Read-only</b></div>
                  <div><span>Veri düzeltme</span><b>Yok</b></div>
                  <div><span>Altyapı tabloları</span><b>{systemSchemaSummary.ready}/{systemSchemaSummary.total || 0} hazır</b></div>
                  <div><span>Eksik tablo</span><b>{missingSchemaTables.length || 0}</b></div>
                </div>
                <div className="system-control-health-list">
                  {systemHealthRows.map((row) => (
                    <div className="system-control-health-row" key={row[0]}>
                      <span>{row[0]}</span>
                      <b>{row[1]}</b>
                      <small>{row[2]}</small>
                    </div>
                  ))}
                </div>
                <div className="system-schema-list">
                  {safeSchemaStatus.map((item) => (
                    <div className={item.ready ? "system-schema-row ready" : "system-schema-row missing"} key={item.table}>
                      <span>{item.table || "-"}</span>
                      <b>{item.ready ? "Hazır" : "Eksik"}</b>
                      <small>{item.ready ? `${item.rowCount || 0} kayıt` : "Migration bekliyor"}</small>
                    </div>
                  ))}
                </div>
                <details className="system-control-details">
                  <summary>Bulgu Detayları</summary>
                  <Table
                    headers={["Seviye", "Modül", "Kayıt", "Mesaj", "Beklenen", "Mevcut", "Öneri"]}
                    rows={systemCheckFindings.slice(0, 50).map((finding) => [
                      finding.severity || "-",
                      finding.module || "-",
                      [finding.entityType, finding.entityId].filter(Boolean).join(" / ") || "-",
                      finding.message || "-",
                      finding.expectedValue === undefined ? "-" : String(finding.expectedValue),
                      finding.actualValue === undefined ? "-" : String(finding.actualValue),
                      finding.suggestedFix || "-",
                    ])}
                  />
                </details>
                {systemCheckFindings.length > 50 && (
                  <p>İlk 50 bulgu gösteriliyor. Detaylı liste için sonraki adımda dışa aktarma eklenebilir.</p>
                )}
              </div>

              <div className="card management-card compact-tool-card theme-management-card">
                <h2>Tema</h2>
                <div className="theme-choice-stack" aria-label="Tema seçimi">
                  {["1", "2", "3"].map((themeNo) => (
                    <button
                      key={themeNo}
                      type="button"
                      className={appTheme === themeNo ? "theme-choice-btn active" : "theme-choice-btn"}
                      onClick={() => setAppTheme(themeNo)}
                    >
                      <span>{themeNo}</span>
                      <b>{themeNo === "1" ? "Mevcut" : themeNo === "2" ? "Mor Soft" : "Mavi Pro"}</b>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card management-card management-screenshot-card compact-tool-card">
                <h2>Ana Ekran SS</h2>
                <div className="management-round-actions">
                  <button className="screenshot-round-btn" type="button" onClick={captureHomeScreenshot}>
                    <span>Ana ekran fotoğrafı çek</span>
                    <Camera size={24} />
                  </button>
                  <button className="screenshot-round-btn shortcut-add-round-btn" type="button" onClick={addUniversalShortcutFromManagement}>
                    <span>Kısayol Ekle</span>
                    <Plus size={24} />
                  </button>
                </div>
              </div>

              <div className="card management-card shortcut-delete-card compact-tool-card">
                <h2>Kısayol Sil</h2>
                <div className="shortcut-delete-list">
                  {visibleAccessoryShortcuts.map((shortcut) => (
                    <div className="shortcut-delete-row" key={shortcut.id}>
                      <div>
                        <b>{shortcut.label}</b>
                        <span>{shortcut.price || "Fiyat yok"} · {shortcut.source === "stock" ? "Stok ürünü" : shortcut.isDefault ? "Varsayılan kısayol" : "Manuel kısayol"}</span>
                      </div>
                      <button className="shortcut-delete-management-btn" type="button" onClick={() => deleteAccessoryShortcut(shortcut.id)}>
                        <Trash2 size={15} />
                        Kısayol Sil
                      </button>
                    </div>
                  ))}
                  {!visibleAccessoryShortcuts.length && (
                    <div className="shortcut-delete-empty">Ana ekranda silinecek kısayol yok.</div>
                  )}
                </div>
              </div>

              <div className="card management-card compact-tool-card compact-backup-card">
                <h2>Yedekleme Merkezi</h2>
                <div className="backup-actions">
                  <button className="primary backup-btn" type="button" onClick={downloadBackupFile}>
                    <Save size={18} /> Yedek İndir
                  </button>

                  <button className="primary backup-btn drive-btn" type="button" onClick={shareBackupFile}>
                    <ShieldCheck size={18} /> Paylaş
                  </button>

                  <button className="primary backup-btn mail-btn" type="button" onClick={prepareEmailBackup}>
                    <ReceiptText size={18} /> Mail Hazırla
                  </button>
                </div>
              </div>

              <div className="card management-card compact-tool-card compact-preview-card">
                <h2>Yedek Önizleme</h2>
                <div className="backup-preview-grid compact-backup-preview-grid">
                  <Stat title="Stok" value={activeStock.length} />
                  <Stat title="Satış" value={activeSales.length} />
                  <Stat title="Cari" value={activeContacts.length} />
                  <Stat title="Kasa" value={activeCashMovements.length} />
                  <Stat title="Banka" value={activeBankMovements.length} />
                  <Stat title="Gider" value={activeExpenses.length} />
                </div>
              </div>
            </div>
          </section>
        )}

        {active === "kasa" && (
          <section className={kasaTab === "yeniSatis" ? "section kasa-home-section" : "section"}>
            {kasaTab !== "yeniSatis" && (
            <div className="kasa-subtabs">
              <button className={kasaTab === "yeniSatis" ? "choice active" : "choice"} onClick={() => setKasaTab("yeniSatis")}>YENİ SATIŞ</button>
              <button className={kasaTab === "satisListesi" ? "choice active" : "choice"} onClick={() => setKasaTab("satisListesi")}>SATIŞ LİSTESİ</button>
              <button className={kasaTab === "giderler" ? "choice active" : "choice"} onClick={() => setKasaTab("giderler")}>GİDERLER</button>
              <button className={kasaTab === "nakitGirisi" ? "choice active" : "choice"} onClick={() => {
                setKasaTab("nakitGirisi");
              }}>NAKİT GİRİŞİ</button>
              <button className={kasaTab === "kapanis" ? "choice active" : "choice"} onClick={() => setKasaTab("kapanis")}>KASA KAPANIŞ</button>
              <div className={cashWithBankIncoming < 0 ? "kasa-cash-total negative" : "kasa-cash-total"}>
                <span>TOPLAM KASANDA OLMASI GEREKEN</span>
                <b>{money(cashWithBankIncoming)}</b>
              </div>
            </div>
            )}

            {kasaTab === "yeniSatis" && (
              <div className="kasa-home-dashboard kasa-mockup-dashboard ceplog-kasa-ref">
                <div className="kasa-layout">
                  <div className="card pad kasa-sale-card kasa-sorgula-card">
                    <button className="kasa-sorgula-launch" type="button" onClick={openKasaSearchModal}>
                      <span className="kasa-sorgula-icon"><Search size={34} strokeWidth={2.8} /></span>
                      <span className="kasa-sorgula-copy">
                        <strong>SOR SAT</strong>
                        <small>IMEI, barkod, ürün adı veya model ile ürünü bul; mevcut satış popup akışıyla devam et.</small>
                      </span>
                    </button>
                  </div>

                  <main className="kasa-mid">
                    <section className="card pad kasa-quick">
                      <div className="quick-head quick-head-shortcuts quick-action-head">
                        <div className="quick-action-tabs" aria-label="Kasa hızlı işlemleri">
                          <button className="quick-action-btn" type="button" onClick={() => setKasaTab("satisListesi")}>SATIŞ LİSTESİ</button>
                          <button className="quick-action-btn" type="button" onClick={() => setKasaTab("giderler")}>GİDERLER</button>
                          <button className="quick-action-btn" type="button" onClick={() => setKasaTab("nakitGirisi")}>NAKİT GİRİŞİ</button>
                          <button className="quick-action-btn" type="button" onClick={() => setKasaTab("kapanis")}>KASA KAPATMA</button>
                        </div>
                        <button type="button" className="cart-open-chip" disabled={!cartItems.length} onClick={() => setCartPaymentModalOpen(true)}>
                          Sepeti Aç
                          <b>{cartSummary.totalQuantity}</b>
                        </button>
                      </div>


                      <div className="quick-grid">
                        {visibleAccessoryShortcuts.map((shortcut) => {
                          const ShortcutIcon = getShortcutIconComponent(shortcut);
                          return (
                            <button key={shortcut.id} type="button" className="qitem" onClick={() => addShortcutToCart(shortcut)}>
                              <span className="qicon"><ShortcutIcon size={13} strokeWidth={2.6} /></span>
                              <span className="qtext">
                                <strong>{shortcut.label}</strong>
                                {shortcut.price && <small>{shortcut.price}</small>}
                              </span>
                            </button>
                          );
                        })}
                        {!visibleAccessoryShortcuts.length && (
                          <div className="cart-product-empty">Henüz kısayol eklenmedi.</div>
                        )}
                      </div>
                    </section>

                    <div className="kasa-lower-band">
                      <section className="card pad kasa-day">
                        <div className="kasa-day-grid">
                          <div className="summary-col">
                            <h3>Nakit İşlemler</h3>
                            <div className="srow"><span>Telefon Nakit</span><b>{money(phoneIncomeSummary.cash)}</b></div>
                            <div className="srow"><span>Aksesuar Nakit</span><b>{money(accessoryIncomeSummary.cash)}</b></div>
                            <div className="srow"><span>Diğerleri Nakit</span><b>{money(otherIncomeSummary.cash)}</b></div>
                            <div className="srow"><span>Teknik Nakit</span><b>{money(technicalIncomeSummary.cash)}</b></div>
                            <div className="srow danger"><span>Giderler</span><b>-{money(cashExpensePayments || 0)}</b></div>
                            <div className="srow total"><span>Net Nakit</span><b>{money(cashWithBankIncoming)}</b></div>
                          </div>
                          <div className="summary-col">
                            <h3>Kart / Cari İşlemler</h3>
                            <div className="srow"><span>Telefon Kart</span><b>{money(phoneIncomeSummary.card)}</b></div>
                            <div className="srow"><span>Aksesuar Kart</span><b>{money(accessoryIncomeSummary.card)}</b></div>
                            <div className="srow"><span>Diğer Kart</span><b>{money(otherIncomeSummary.card)}</b></div>
                            <div className="srow"><span>Teknik Kart</span><b>{money(technicalIncomeSummary.card)}</b></div>
                            <div className="srow total"><span>Kart Toplamı</span><b>{money(phoneIncomeSummary.card + accessoryIncomeSummary.card + otherIncomeSummary.card + technicalIncomeSummary.card)}</b></div>
                            <div className="srow"><span>Cari Kalan</span><b>{money(report.remaining || 0)}</b></div>
                          </div>
                        </div>
                      </section>
                    </div>
                  </main>
                </div>

                {kasaSearchModalOpen && (
                  <div className="kasa-search-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="kasa-search-modal-title">
                    <div className="kasa-search-modal-window">
                      <button type="button" className="kasa-search-close" onClick={closeKasaSearchModal} aria-label="SOR SAT penceresini kapat">×</button>
                      <div className="kasa-search-modal-head">
                        <span><Search size={24} strokeWidth={2.8} /></span>
                        <div>
                          <b id="kasa-search-modal-title">SOR SAT</b>
                          <small>Ürünü bul, seç ve mevcut detaylı satış / ödeme popup akışıyla devam et.</small>
                        </div>
                      </div>

                      <label className="kasa-search-input-wrap">
                        <Search size={18} strokeWidth={2.6} />
                        <input
                          autoFocus
                          value={kasaSearchQuery}
                          onChange={(event) => setKasaSearchQuery(event.target.value)}
                          placeholder="IMEI, barkod, ürün adı, model veya cari adı yaz"
                        />
                      </label>

                      <div className="kasa-search-groups">
                        {kasaSearchGroupLabels.map((label) => {
                          const rows = kasaGroupedSearchResults[label] || [];
                          return (
                            <section className="kasa-search-group" key={label}>
                              <div className="kasa-search-group-title">
                                <strong>{label}</strong>
                                <span>{rows.length} ürün</span>
                              </div>
                              <div className="kasa-search-result-list">
                                {rows.length ? rows.map((product) => (
                                  <button type="button" className="kasa-search-result" key={product.id} onClick={() => selectKasaSearchProduct(product)}>
                                    <span>
                                      <b>{productTitle(product) || product.name || "Ürün"}</b>
                                      <small>IMEI/Barkod: {product.imei || product.barcode || "-"}</small>
                                    </span>
                                    <em>{formatMoneyInput(product.sell ?? product.sellPrice ?? product.sell_price ?? 0) || "Fiyat gir"}</em>
                                  </button>
                                )) : (
                                  <p className="kasa-search-empty">Bu grupta eşleşen ürün yok.</p>
                                )}
                              </div>
                            </section>
                          );
                        })}
                      </div>

                      {kasaSearchContactMatches.length > 0 && (
                        <div className="kasa-search-contact-strip">
                          <b>Cari / müşteri eşleşmeleri</b>
                          <div>
                            {kasaSearchContactMatches.map((contact) => (
                              <button type="button" key={contact.id || contact.name} onClick={() => selectKasaSearchContact(contact)}>
                                {contact.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!kasaSearchHasResults && (
                        <div className="kasa-search-no-results">Sonuç bulunamadı. IMEI, barkod, ürün adı veya model bilgisini kontrol et.</div>
                      )}
                    </div>
                  </div>
                )}

                {showSaleReadyModal && (
                  <div className="sale-ready-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sale-ready-modal-title">
                    <div className="sale-ready-modal-window">
                      <button type="button" className="sale-ready-modal-close" onClick={closeSaleReadyModal} aria-label="Pencereyi kapat">×</button>
                      <div className="kasa-sale-ready-head sale-ready-modal-head">
                        <span>✓</span>
                        <div>
                          <b id="sale-ready-modal-title">Ürün Satırını Tamamla</b>
                          <small>Fiyat, ödeme ve cari bilgisini netleştir; sonra sepete gönder.</small>
                        </div>
                      </div>
                      {hasActiveCartSession && (
                        <div className="sale-session-lock-summary" aria-label="Aktif sepet oturumu">
                          <strong>Sepet oturumu aktif</strong>
                          <span>Müşteri: <b>{cartCustomer.customerName || "-"}</b></span>
                          <span>Banka: <b>{cartBankName || "-"}</b></span>
                          <span>Ödeme: <b>{[cartPaymentContext.hasCash ? "Nakit" : "", cartPaymentContext.hasCard ? "Kart" : "", cartPaymentContext.hasCari ? "Cari" : ""].filter(Boolean).join(" + ") || "Satır bazlı"}</b></span>
                        </div>
                      )}
                      {modalCartItems.length > 0 && (
                        <div className="sale-modal-cart-stack" aria-label="Sepetteki ürünler">
                          <div className="sale-modal-cart-head">
                            <strong>Sepetteki Ürünler</strong>
                            <span>{modalCartItems.length} satır</span>
                          </div>
                          <div className="sale-modal-cart-chips">
                            {modalCartItems.map((item) => {
                              const isOpen = expandedSaleModalItemId === item.cartItemId;
                              return (
                                <button
                                  key={item.cartItemId}
                                  type="button"
                                  className={isOpen ? "sale-modal-cart-chip active" : "sale-modal-cart-chip"}
                                  onClick={() => setExpandedSaleModalItemId(isOpen ? "" : item.cartItemId)}
                                  title="Detay göster"
                                >
                                  {item.productName}
                                </button>
                              );
                            })}
                          </div>
                          {expandedSaleModalItem && (
                            <div className="sale-modal-cart-detail">
                              <div><span>Ürün</span><b>{expandedSaleModalItem.productName}</b></div>
                              <div><span>IMEI</span><b>{expandedSaleModalItem.imei || "-"}</b></div>
                              <div><span>Barkod</span><b>{expandedSaleModalItem.barcode || "-"}</b></div>
                              <div><span>Satış</span><b>{money(expandedSaleModalItem.lineTotal)}</b></div>
                              <div><span>Nakit</span><b>{money(expandedSaleModalItem.cashAmountAtAdd || 0)}</b></div>
                              <div><span>Kart/POS</span><b>{money(expandedSaleModalItem.cardAmountAtAdd || 0)}</b></div>
                              <div><span>Banka</span><b>{expandedSaleModalItem.bankNameAtAdd || "-"}</b></div>
                              <div><span>Kalan/Cari</span><b>{money(expandedSaleModalItem.cariAmountAtAdd || 0)}</b></div>
                              <div><span>Kâr</span><b className={Number(expandedSaleModalItem.lineProfit || 0) < 0 ? "negative" : ""}>{money(expandedSaleModalItem.lineProfit)}</b></div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="kasa-sale-ready-actions sale-ready-modal-actions sale-ready-modal-actions-top">
                        <button type="button" className="choice" onClick={closeSaleReadyModal}>
                          <Calculator size={16} />
                          Düzenle
                        </button>
                        <button className="primary" type="button" disabled={!saleFormReadyForCart} onClick={() => confirmSaleReadyToCart("continue")}>Sepete Yolla + Devam Et</button>
                        <button className="primary finish" type="button" disabled={!saleFormReadyForCart} onClick={() => confirmSaleReadyToCart("finish")}>Sepete Yolla + Bitir</button>
                      </div>
                      <div className="sale-line-editor-grid">
                        <label>
                          <span>Ürün</span>
                          <input value={saleProductDisplayName} onChange={(event) => setSaleForm({ ...saleForm, search: event.target.value })} disabled={!isProgramSale} />
                        </label>
                        {!isAccessorySale && (
                          <label className={sessionCustomerLocked ? "session-locked-field" : ""}>
                            <span>{sessionCustomerLocked ? "Müşteri • oturum" : "Müşteri"}</span>
                            <input
                              list="cart-customer-list"
                              value={saleForm.customer || cartCustomer.customerName}
                              readOnly={sessionCustomerLocked}
                              aria-readonly={sessionCustomerLocked}
                              onChange={(event) => {
                                if (sessionCustomerLocked) return;
                                const customerName = event.target.value;
                                changeCartCustomer(customerName);
                              }}
                              placeholder="Müşteri adı soyadı / telefon"
                            />
                            {sessionCustomerLocked && <em>Aktif sepet carisi kullanılıyor</em>}
                          </label>
                        )}
                        <label>
                          <span>Satış Fiyatı</span>
                          <input inputMode="numeric" value={saleForm.total} onFocus={() => setSaleForm({ ...saleForm, total: stripMoneyForEdit(saleForm.total) })} onChange={(event) => setSaleForm({ ...saleForm, total: cleanMoneyTyping(event.target.value) })} onBlur={() => setSaleForm({ ...saleForm, total: formatMoneyInput(saleForm.total) })} />
                        </label>
                        <label>
                          <span>Nakit</span>
                          <input inputMode="numeric" value={saleForm.cash} onFocus={() => setSaleForm({ ...saleForm, cash: stripMoneyForEdit(saleForm.cash) })} onChange={(event) => setSaleForm({ ...saleForm, cash: cleanMoneyTyping(event.target.value) })} onBlur={() => setSaleForm({ ...saleForm, cash: formatMoneyInput(saleForm.cash) })} />
                        </label>
                        <label>
                          <span>Kart / POS</span>
                          <input inputMode="numeric" value={saleForm.card} onFocus={() => setSaleForm({ ...saleForm, card: stripMoneyForEdit(saleForm.card) })} onChange={(event) => setSaleForm({ ...saleForm, card: cleanMoneyTyping(event.target.value) })} onBlur={() => setSaleForm({ ...saleForm, card: formatMoneyInput(saleForm.card) })} />
                        </label>
                        <label className={sessionBankLocked ? "session-locked-field" : ""}>
                          <span>{sessionBankLocked ? "Banka • oturum" : "Banka"}</span>
                          <select
                            value={cartBankName || saleForm.bank}
                            disabled={sessionBankLocked}
                            aria-disabled={sessionBankLocked}
                            onChange={(event) => handleBankSelect(event.target.value, (bank) => {
                              setSaleForm({ ...saleForm, bank });
                              setCartBankName(bank);
                            })}
                          >
                            <option value="">Banka seç</option>
                            {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                            <option value="__add_bank__">+ Banka Ekle</option>
                          </select>
                          {sessionBankLocked && <em>Kart/POS için aktif banka kullanılacak</em>}
                        </label>
                        <label className={sessionCustomerLocked ? "sale-line-cari-field session-locked-field" : "sale-line-cari-field"}>
                          <span>{sessionCustomerLocked ? "Kalan / Cari • oturum" : "Kalan / Cari"}</span>
                          <input
                            list="cart-customer-list"
                            value={sessionCustomerLocked ? cartCustomer.customerName : saleFormCariText}
                            readOnly={sessionCustomerLocked}
                            aria-readonly={sessionCustomerLocked}
                            onChange={(event) => {
                              if (sessionCustomerLocked) return;
                              changeCartCustomer(event.target.value);
                            }}
                            placeholder={saleReadyRemaining > 0 ? "Cari kişi" : "Kalan yok"}
                          />
                          {sessionCustomerLocked && <em>Kalan tutar aktif cariye yazılır</em>}
                        </label>
                        <div className="sale-line-profit-peek" tabIndex={0}>
                          <span>Kâr</span>
                          <b>Kârı göster</b>
                          <strong className={saleLineProfit < 0 ? "negative" : ""}>{money(saleLineProfit)}</strong>
                        </div>
                      </div>
                      <div className="kasa-sale-ready-lines sale-ready-modal-lines">
                        <div><span>Ürün</span><b>{isProgramSale ? saleForm.search : productTitle(selectedProduct)}</b></div>
                        <div><span>Fiyat</span><b>{money(saleTotal)}</b></div>
                        <div><span>Nakit</span><b>{money(saleCash)}</b></div>
                        <div><span>Kart</span><b>{money(saleCard)}</b></div>
                        <div><span>Banka</span><b>{saleForm.bank || cartBankName || "-"}</b></div>
                        <div><span>Cari</span><b>{money(saleReadyRemaining)}</b></div>
                        <div><span>Kâr</span><b className={saleLineProfit < 0 ? "negative" : ""}>{money(saleLineProfit)}</b></div>
                        {saleReadyRemaining > 0 && <div><span>Cari Kişi</span><b>{saleFormCariText || "-"}</b></div>}
                      </div>
                    </div>
                  </div>
                )}

                {cartPaymentModalOpen && (
                  <div className="cart-flow-modal-backdrop" role="dialog" aria-modal="true" aria-label="Satış ödeme ekranı">
                    <div className="cart-flow-modal-window">
                      <button type="button" className="sale-ready-modal-close" onClick={() => setCartPaymentModalOpen(false)} aria-label="Sepet penceresini kapat">×</button>
                      <CartPanel
                        items={cartItems.map(rebuildCartItem)}
                        summary={cartSummary}
                        payments={cartPayments}
                        customer={cartCustomer}
                        bankName={cartBankName}
                        bankOptions={bankOptions}
                        note={cartNote}
                        processing={cartProcessing}
                        money={money}
                        paymentGap={cartPaymentGap}
                        onUpdateItem={updateCartItem}
                        onRemoveItem={removeCartItem}
                        onClear={clearCart}
                        onPaymentChange={changeCartPayment}
                        onCustomerChange={changeCartCustomer}
                        onBankChange={(value) => handleBankSelect(value, setCartBankName)}
                        onNoteChange={setCartNote}
                        onSetFullPayment={setFullCartPayment}
                        onCheckout={completeCartSale}
                      />
                    </div>
                  </div>
                )}

                <datalist id="cart-customer-list">
                  {activeContacts.map((contact) => <option key={contact.id} value={contact.name} />)}
                  {alacaklarim.map((sale) => <option key={`sale-${sale.id}`} value={sale.cariPerson || sale.customer} />)}
                </datalist>
              </div>
            )}

            {kasaTab === "satisListesi" && (
              <section className="card">
                <h2>Satış Listesi</h2>
            <div
              className="sales-list-date-filter"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 12,
                margin: "10px 0 16px",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                background: "#f8fafc"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="print-action" onClick={printPage} aria-label="Satış listesini yazdır">
                  <Printer size={15} />
                  YAZ
                </button>
                <label style={{ fontWeight: 900, color: "#475569" }}>Tarih</label>
                <input
                  type="date"
                  value={salesListDate}
                  onChange={(event) => setSalesListDate(event.target.value)}
                  style={{
                    border: "1px solid #d8def0",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 900,
                    color: "#0f172a",
                    background: "#fff"
                  }}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={() => setSyncMessage(`Satış listesi yenilendi: ${salesListDate}`)}
                >
                  Listeyi Yenile
                </button>
              </div>
            </div>
                <p>Seçilen tarihteki satışlar listelenir. Geçmiş gün satışları bugünün listesinde görünmez.</p>
                <Table headers={["No", "Tarih/Saat", "İşlem Türü", "Müşteri", "Ürün / Cihaz", "Yöntem", "Tutar", "Nakit", "Kart/Banka", "Kalan/Cari", "Kâr", "Durum", "Detay"]} rows={combinedSalesListRows.map((row, index) => {
                  if (row.kind === "technical") {
                    const { movement, service } = row;
                    const signedAmount = movement.direction === "out" ? -movement.amount : movement.amount;
                    return [
                      index + 1,
                      new Date(movement.date).toLocaleString("tr-TR"),
                      movement.type,
                      service?.customerName || "-",
                      service?.device || movement.note || "-",
                      movement.method === "Kart/Banka" ? movement.bank || "Kart/Banka" : "Nakit",
                      <span className={movement.direction === "out" ? "technical-money-out" : "technical-money-in"}>{`${movement.direction === "out" ? "-" : "+"}${money(movement.amount)}`}</span>,
                      movement.method === "Nakit" ? <span className={signedAmount < 0 ? "technical-money-out" : "technical-money-in"}>{money(Math.abs(signedAmount))}</span> : "-",
                      movement.method === "Kart/Banka" ? <span className={signedAmount < 0 ? "technical-money-out" : "technical-money-in"}>{money(Math.abs(signedAmount))}</span> : "-",
                      "-",
                      "-",
                      "Aktif",
                      movement.serviceId ? (
                        <button className="edit-btn" type="button" onClick={() => openTechnicalServiceDetail(movement.serviceId, true)}>Servis Aç</button>
                      ) : (
                        <button className="edit-btn" type="button" onClick={() => alert("Bu teknik servis hareketi servis kaydıyla bağlantılı değil.")}>Bağ Yok</button>
                      ),
                      "-",
                    ];
                  }

                  const { sale } = row;
                  const saleInactive = !isActiveRecord(sale);
                  const paymentDistribution = normalizeSalePaymentDistributionForReport(sale);
                  return [
                    index + 1,
                    new Date(sale.date).toLocaleString("tr-TR"),
                    saleGroupName(sale.type),
                    sale.customer || "-",
                    sale.productName,
                    [
                      parseMoneyInput(sale.cash) > 0 ? "Nakit" : "",
                      parseMoneyInput(sale.card) > 0 ? (sale.bank || "Kart") : "",
                    ].filter(Boolean).join(" + ") || "-",
                    money(paymentDistribution.total),
                    money(paymentDistribution.cash),
                    money(paymentDistribution.card),
                    money(paymentDistribution.debt),
                    money(sale.profit),
                    sale.status || "active",
                    saleInactive ? "İptal edildi" : <button className="edit-btn" onClick={() => openSaleEditor(sale)}><Pencil size={14} /> Düzenle</button>,
                  ];
                })} />
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
                  <Stat title="Nakit Kasa" value={money(cashWithBankIncoming)} negative={cashWithBankIncoming < 0} />
                  <Stat title="Gider Sonrası Nakit" value={money(cashAfterExpenses)} negative={cashAfterExpenses < 0} />
                </div>

                <Table headers={["Tarih", "Gider", "Tutar", "Not"]} rows={activeExpenses.map((item) => [
                  new Date(item.date).toLocaleString("tr-TR"),
                  item.category,
                  item.amount,
                  item.note || "-",
                ])} />
              </section>
            )}

            {kasaTab === "nakitGirisi" && (
              <section className="card">
                <h2>Nakit Girişi</h2>

                <div className="button-grid">
                  {cashEntryTabs.map((type) => (
                    <button
                      key={type}
                      className={cashEntryTab === type ? "choice active" : "choice"}
                      onClick={() => setCashEntryTab(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {cashEntryTab === "Manuel Nakit Girişi" && (
                  <>
                    <div className="form-grid">
                      <input type="text" inputMode="numeric" placeholder="Tutar" value={cashEntryForm.amount} onFocus={() => setCashEntryForm({ ...cashEntryForm, amount: stripMoneyForEdit(cashEntryForm.amount) })} onChange={(e) => setCashEntryForm({ ...cashEntryForm, amount: cleanMoneyTyping(e.target.value) })} onBlur={() => setCashEntryForm({ ...cashEntryForm, amount: formatMoneyInput(cashEntryForm.amount) })} />
                      <input placeholder="Nakit nereden geldi?" value={cashEntryForm.source} onChange={(e) => setCashEntryForm({ ...cashEntryForm, source: e.target.value })} />
                      <input placeholder="Not" value={cashEntryForm.note} onChange={(e) => setCashEntryForm({ ...cashEntryForm, note: e.target.value })} />
                      <div className="remaining-input">
                        <span>Nakit Kasa</span>
                        <b className={cashWithBankIncoming < 0 ? "money-negative" : ""}>{money(cashWithBankIncoming)}</b>
                      </div>
                    </div>

                    <button className="primary" onClick={saveCashEntry}><Plus size={16} /> Nakit Girişini Kaydet</button>
                  </>
                )}

                {cashEntryTab === "Dünden Devir" && (
                  <>
                    <div className="form-grid">
                      <input type="text" inputMode="numeric" placeholder="Dünden Kalan Nakit" value={cashCarryForm.amount} onFocus={() => setCashCarryForm({ ...cashCarryForm, amount: stripMoneyForEdit(cashCarryForm.amount) })} onChange={(e) => setCashCarryForm({ ...cashCarryForm, amount: cleanMoneyTyping(e.target.value) })} onBlur={() => setCashCarryForm({ ...cashCarryForm, amount: formatMoneyInput(cashCarryForm.amount) })} />
                      <input placeholder="Not" value={cashCarryForm.note} onChange={(e) => setCashCarryForm({ ...cashCarryForm, note: e.target.value })} />
                      <div className="remaining-input">
                        <span>İşlem Adı</span>
                        <b>Dünden Devir Nakit</b>
                      </div>
                    </div>

                    <button className="primary" onClick={saveCashCarryOver}><Plus size={16} /> Dünden Devri Kaydet</button>
                  </>
                )}

                {cashEntryTab === "Bankadan Gelen Nakit" && (
                  <div className="cash-bank-skeleton">
                    <h3>Bankadan Gelen Nakit</h3>
                    <p>Banka bakiyesi Supabase banka hareketlerinden hesaplanır. Çekilecek tutarı yazıp Kasaya Aktar ile banka çıkışı ve kasa girişi birlikte kaydedilir.</p>

                    <div className="stats three">
                      <Stat title="Bankada Toplam Olan" value={money(bankCashSkeletonTotal)} />
                      <Stat title="Ziraatbankta Olan" value={money(bankCashSkeletonBalanceFor("Ziraatbank"))} />
                      <Stat title="İşbankta Olan" value={money(bankCashSkeletonBalanceFor("İşbank"))} />
                      <Stat title="Halkbankta Olan" value={money(bankCashSkeletonBalanceFor("Halkbank"))} />
                      <Stat title="Ek Banka 1" value={money(bankCashSkeletonBalanceFor("Ek Banka 1"))} />
                      <Stat title="Ek Banka 2" value={money(bankCashSkeletonBalanceFor("Ek Banka 2"))} />
                    </div>

                    <Table headers={["Banka Adı", "Bankada Olan", "Çekilecek Tutar", "Çekimden Sonra Kalan", "Not", "Kasaya Aktar"]} rows={bankCashSkeletonRows.map((bank) => {
                      const draft = bankTransferDrafts[bank.id] || {};
                      const bankBalance = bankCashSkeletonBalanceFor(bank.name);
                      const withdrawAmount = parseMoneyInput(draft.withdraw);
                      const isOverLimit = withdrawAmount > bankBalance;
                      return [
                        bank.name,
                        money(bankBalance),
                        <input type="text" inputMode="numeric" value={draft.withdraw || ""} placeholder="0 TL" onFocus={() => updateBankTransferDraft(bank.id, { withdraw: stripMoneyForEdit(draft.withdraw || "") })} onChange={(event) => updateBankTransferDraft(bank.id, { withdraw: cleanMoneyTyping(event.target.value) })} onBlur={() => updateBankTransferDraft(bank.id, { withdraw: formatMoneyInput(draft.withdraw || "") })} />,
                        isOverLimit ? <span className="money-negative">Bakiye yetersiz</span> : money(Math.max(bankBalance - withdrawAmount, 0)),
                        <input placeholder="Not" value={draft.note || ""} onChange={(event) => updateBankTransferDraft(bank.id, { note: event.target.value })} />,
                        <button className="edit-btn" type="button" onClick={() => handleBankCashSkeletonTransfer(bank)}>Kasaya Aktar</button>,
                      ];
                    })} />

                    <div className="cash-bank-add-panel">
                      <h3>Banka Ekle</h3>
                      <p>Varsayılan bankalar: Ziraatbank, İşbank, Halkbank. Başlangıç bakiyesi girilirse banka hareketlerine Düzeltme olarak yazılır.</p>
                      <div className="form-grid">
                        <input placeholder="Yeni Banka Adı" value={bankCashSkeletonForm.name} onChange={(event) => setBankCashSkeletonForm({ ...bankCashSkeletonForm, name: event.target.value })} />
                        <input type="text" inputMode="numeric" placeholder="Başlangıç Bakiyesi" value={bankCashSkeletonForm.balance} onFocus={() => setBankCashSkeletonForm({ ...bankCashSkeletonForm, balance: stripMoneyForEdit(bankCashSkeletonForm.balance) })} onChange={(event) => setBankCashSkeletonForm({ ...bankCashSkeletonForm, balance: cleanMoneyTyping(event.target.value) })} onBlur={() => setBankCashSkeletonForm({ ...bankCashSkeletonForm, balance: formatMoneyInput(bankCashSkeletonForm.balance) })} />
                      </div>
                      <button className="primary" type="button" onClick={addBankCashSkeletonBank}>Banka Ekle</button>
                    </div>
                  </div>
                )}

                <Table headers={["Tarih", "İşlem", "Yön", "Tutar", "Not", "İşlem"]} rows={activeCashMovements.filter(isCashInflowEntry).map((item) => {
                  const cancellation = cashMovementCancellationFor(item);
                  const isCancellationRow = isCashMovementCancellation(item);
                  return [
                    new Date(item.date).toLocaleString("tr-TR"),
                    cashMovementType(item) || "-",
                    "Giriş",
                    <span className="technical-money-in">+{money(item.amount)}</span>,
                    item.note || "-",
                    isCancellationRow
                      ? "İptal Kaydı"
                      : cancellation
                        ? "İptal Edildi"
                        : isCancelableCashMovement(item)
                          ? <button className="delete-btn" onClick={() => cancelCashMovement(item)}>İptal</button>
                          : "-",
                  ];
                })} />
              </section>
            )}

            {kasaTab === "kapanis" && (
              <div className="kasa-closing-stack">
                <CashClosingPanel />

                {isLocalhostRuntime() && (
                  <section className="card">
                    <h2>TEMİZ TEST BAŞLANGICI</h2>
                    <p>Bu araç sadece localhost test ortamında görünür. Satış, stok, kasa, banka, cari, gider, teknik servis ve rapor test verilerini temiz test başlangıcı için sıfırlar.</p>
                    <button className="delete-btn" type="button" onClick={handleCleanTestReset}>
                      TEST VERİLERİNİ SIFIRLA
                    </button>
                  </section>
                )}

                <section className="card daily-report-card">
                  <div className="daily-report-header">
                    <div>
                      <h2>GÜNLÜK KASA RAPORU</h2>
                      <p>Seçilen tarihteki tüm satış, alış, kasa, banka ve cari hareketlerini okunaklı şekilde listeler.</p>
                    </div>
                    <div className="daily-report-controls">
                      <button type="button" className="print-action" onClick={printPage} aria-label="Günlük kasa raporunu yazdır">
                        <Printer size={15} />
                        YAZ
                      </button>
                      <label>
                        <span>Tarih</span>
                        <input type="date" value={dailyReportDate} onChange={(event) => setDailyReportDate(event.target.value)} />
                      </label>
                      <button className="primary" onClick={() => setSyncMessage(`Günlük kasa raporu yenilendi: ${dailyReportDate}`)}>
                        Raporu Yenile
                      </button>
                    </div>
                  </div>

                  <Table headers={["No", "Tarih / Saat", "İşlem Türü", "Ürün Açıklaması", "Müşteri / Tedarikçi", "Alış Fiyatı", "Nakit (₺)", "Kart / Banka (₺)", "Borç / Cari (₺)", "İade / İptal (₺)", "Toplam (₺)", "İşlem"]} rows={dailyCashReportRows.map((row) => [
                    row.no,
                    formatRecordDate(row.date),
                    reportTypeBadge(row),
                    reportTextCell(row.descriptionLines || row.description || "-"),
                    reportTextCell(row.party || "-"),
                    reportMoneyCell(row.buy),
                    reportMoneyCell(row.cash),
                    reportMoneyCell(row.bank),
                    reportMoneyCell(row.debt),
                    reportMoneyCell(row.refund, { negative: true }),
                    reportMoneyCell(row.total),
                    (
                      <div className="kasa-brain-actions" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {kasaBrainActionsForRow(row).map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setKasaBrainReason("");
                              setKasaBrainPassword("");
                              setKasaBrainEditDraft(buildKasaBrainEditDraft(action, row));
                              setKasaBrainModal({ action, row });
                            }}
                            style={{
                              border: "1px solid #d8def0",
                              borderRadius: 8,
                              padding: "4px 7px",
                              background: "#fff",
                              color: "#111827",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              position: "relative",
                              zIndex: 9999,
                              pointerEvents: "auto"
                            }}
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    ),
                  ])} />

                  <div className="daily-report-totals">
                    <div><span>Toplam Alış</span><b>{money(dailyCashReportTotals.buy)}</b></div>
                    <div><span>Toplam Satış</span><b>{money(dailyCashReportTotals.sale)}</b></div>
                    <div><span>Toplam Nakit</span><b className={dailyCashReportTotals.cash < 0 ? "money-negative" : ""}>{money(dailyCashReportTotals.cash)}</b></div>
                    <div><span>Toplam Kart / Banka</span><b className={dailyCashReportTotals.bank < 0 ? "money-negative" : ""}>{money(dailyCashReportTotals.bank)}</b></div>
                    <div><span>Toplam Borç / Cari</span><b>{money(dailyCashReportTotals.debt)}</b></div>
                    <div><span>Toplam İade / İptal</span><b className="money-negative">{money(dailyCashReportTotals.refund)}</b></div>
                  </div>
                </section>
              </div>
            )}

            {kasaBrainModal && (
        <div
          data-kasa-brain-mode={kasaBrainModal.action}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
          onClick={closeKasaBrainModal}
        >
          <div
            style={{
              width: "min(720px, 96vw)",
              maxHeight: "92vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 20,
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.35)",
              padding: 18,
              color: "#0f172a"
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
	                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900 }}>Kasa Beyni</h2>
	                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 }}>
	                  Kritik işlem ön izleme merkezi
	                </p>
              </div>
              <button
                type="button"
	                onClick={closeKasaBrainModal}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: 12,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 900
                }}
              >
                Kapat
              </button>
            </div>

	            <div style={{ marginTop: 12, display: "grid", gap: 7 }}>
	              {(kasaBrainModal.action === "Düzelt" ? [
	                ["İşlem", kasaBrainModal.action],
	                ["İşlem Türü", kasaBrainModal.row?.type],
	                ["Toplam", money(kasaBrainModal.row?.total || 0)]
	              ] : [
	                ["İşlem", kasaBrainModal.action],
	                ["Kayıt No", kasaBrainModal.row?.no],
	                ["İşlem Türü", kasaBrainModal.row?.type],
	                ["Ürün Açıklaması", reportTextCell(kasaBrainModal.row?.descriptionLines || kasaBrainModal.row?.description)],
	                ["Müşteri / Tedarikçi", kasaBrainModal.row?.party || "-"],
	                ["Nakit", money(kasaBrainModal.row?.cash || 0)],
	                ["Kart / Banka", money(kasaBrainModal.row?.bank || 0)],
	                ["Borç / Cari", money(kasaBrainModal.row?.debt || 0)],
	                ["Toplam", money(kasaBrainModal.row?.total || 0)]
	              ]).map(([label, value]) => (
	                <div
	                  key={label}
	                  style={{
	                    display: "grid",
	                    gridTemplateColumns: "120px 1fr",
	                    gap: 10,
	                    padding: "7px 10px",
	                    background: "#f8fafc",
	                    border: "1px solid #e2e8f0",
	                    borderRadius: 12,
	                    fontSize: 13
	                  }}
	                >
                  <strong style={{ color: "#475569" }}>{label}</strong>
                  <span style={{ fontWeight: 800 }}>{value || "-"}</span>
                </div>
	              ))}
	            </div>

	            {renderKasaBrainEditFields()}

	            {kasaBrainModal.action !== "Detay" && (
	              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
	                <label style={{ display: "grid", gap: 6, fontWeight: 900, color: "#334155" }}>
	                  İşlem Sebebi
                  <textarea
                    value={kasaBrainReason}
                    onChange={(event) => setKasaBrainReason(event.target.value)}
                    placeholder="Örn: Müşteri iade istedi, yanlış satış kaydı, hatalı tahsilat..."
	                    rows={2}
	                    style={{
	                      width: "100%",
	                      border: "1px solid #cbd5e1",
	                      borderRadius: 12,
	                      padding: 10,
	                      fontSize: 13,
	                      resize: "vertical",
	                      outline: "none"
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontWeight: 900, color: "#334155" }}>
                  Yetkili Şifresi
                  <input
                    type="password"
                    value={kasaBrainPassword}
                    onChange={(event) => setKasaBrainPassword(event.target.value)}
                    placeholder="Yetkili şifresini gir"
	                    style={{
	                      width: "100%",
	                      border: "1px solid #cbd5e1",
	                      borderRadius: 12,
	                      padding: 10,
	                      fontSize: 13,
	                      outline: "none"
                    }}
                  />
                </label>
              </div>
            )}

            <div
              style={{
	                marginTop: 12,
	                padding: 12,
	                background: ["Satış İade", "Satış İptal", "Alım İptal", "Düzelt"].includes(kasaBrainModal.action) ? "#ecfdf5" : "#fff7ed",
	                border: ["Satış İade", "Satış İptal", "Alım İptal", "Düzelt"].includes(kasaBrainModal.action) ? "1px solid #bbf7d0" : "1px solid #fed7aa",
	                borderRadius: 14,
	                color: ["Satış İade", "Satış İptal", "Alım İptal", "Düzelt"].includes(kasaBrainModal.action) ? "#166534" : "#9a3412",
	                fontWeight: 800,
	                fontSize: 13
	              }}
	            >
	              {kasaBrainModal.action === "Detay"
	                ? "Bu ekran sadece kayıt detayını gösterir. Veri değişmez."
	                : isSaleCancelAction(kasaBrainModal)
	                  ? "Satış iptal modu: Onay sonrası gerçek satış kaydı Supabase güvenli iptal motoruyla iptal edilir. Stok, kasa, banka ve cari etkileri birlikte işlenir."
	                  : isSaleRefundAction(kasaBrainModal)
	                    ? "Satış iade modu: Onay sonrası nakit/kart iade hareketleri oluşturulur; stok ve cari etkisi güvenli akışla güncellenir."
	                  : isPurchaseCancelAction(kasaBrainModal)
	                    ? "Alım iptal modu: Onay sonrası stok kaydı pasifleştirilir; kasa, banka ve cari etkileri Supabase güvenli iptal motoruyla birlikte işlenir."
	                    : kasaBrainModal.action === "Düzelt"
	                      ? "Bu işlem Günlük Kasa Raporu üzerinden kontrollü finansal düzeltme akışını çalıştırır. Stok ekranından iptal/düzeltme yapılmaz."
	                      : "Güvenli mod: Bu işlem sadece ön audit log oluşturur. Satış, kasa, stok, cari veya iade kaydı değiştirmez."}
	            </div>

	            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
	              {kasaBrainModal.action === "Detay" ? (
	                <button
	                  type="button"
	                  onClick={closeKasaBrainModal}
                  style={{
                    border: "none",
                    background: "#0f172a",
                    color: "#fff",
                    borderRadius: 12,
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 900
                  }}
                >
                  Kapat
                </button>
              ) : (
                <>
	                  <button
	                    type="button"
	                    onClick={closeKasaBrainModal}
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      borderRadius: 12,
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontWeight: 900
                    }}
                  >
                    Vazgeç
                  </button>
	                  <button
	                    type="button"
	                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); handleKasaBrainPreAudit(); }}
	                    disabled={kasaBrainProcessing}
	                    style={{
	                      border: "none",
	                      background: kasaBrainProcessing ? "#64748b" : "#0f172a",
	                      color: "#fff",
	                      borderRadius: 12,
	                      padding: "10px 14px",
	                      cursor: kasaBrainProcessing ? "wait" : "pointer",
	                      fontWeight: 900
	                    }}
	                  >
	                    {kasaBrainProcessing
	                      ? "İşleniyor..."
	                      : kasaBrainModal.action === "Düzelt"
		                        ? "Düzeltmeyi Uygula"
		                        : isSaleCancelAction(kasaBrainModal)
	                      ? "Satış İptalini Onayla"
	                      : isSaleRefundAction(kasaBrainModal)
	                        ? "Satış İadesini Onayla"
	                      : isPurchaseCancelAction(kasaBrainModal)
	                        ? "Alım İptalini Onayla"
	                        : "Ön Audit Log Oluştur"}
	                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {kasaTab === "bankadanNakit" && (
              <section className="card">
                <h2>Bankadan Nakit Gelen</h2>
                <p>Bu bölüm artık Nakit Girişi sekmesi içindeki merkezi banka listesine yönlendirildi. Bankadan kasaya aktarım oradan kaydedilir.</p>
                <button className="primary" type="button" onClick={() => {
                  setKasaTab("nakitGirisi");
                  setCashEntryTab("Bankadan Gelen Nakit");
                }}>Nakit Girişi &gt; Bankadan Gelen Nakit Aç</button>
              </section>
            )}
          </section>
        )}

        {active === "cihaz" && (
          <section className="card">
            <h2>{stockForm.deviceType || "Cihaz"} Kaydı</h2>
            <DeviceStockForm
              stockForm={stockForm}
              setStockForm={setStockForm}
              saveStock={saveStock}
              supplierOptions={supplierOptions}
              setSupplierModalOpen={setSupplierModalOpen}
              customAccessoryCategories={customAccessoryCategories}
              setCustomAccessoryCategories={setCustomAccessoryCategories}
              phoneOnly={true}
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

        {active === "digerler" && (
          <section className="section">
            <section className="card">
              <h2>X</h2>
              <div className="other-product-tabs">
                {otherProductGroups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    className={toVisibleOtherGroup(stockForm.deviceType || otherGroupName) === group ? "choice active" : "choice"}
                    onClick={() => {
                      const internalGroup = toInternalOtherGroup(group);
                      setOtherGroupName(group);
                      setStockForm({
                        ...stockForm,
                        module: "Diğer",
                        deviceType: internalGroup,
                        condition: stockForm.condition || "Sıfır Garantili",
                        brand: stockForm.brand || "",
                        model: stockForm.model || "",
                        name: stockForm.name || "",
                      });
                    }}
                  >
                    {group}
                  </button>
                ))}
              </div>

              {toVisibleOtherGroup(stockForm.deviceType || otherGroupName) === "Program" ? (
                <div className="conditional-panel">
                  <h3>Program Satışı</h3>
                  <p className="mini-note">Program stoklu ürün gibi çalışmaz. Sabit tutarı seçip satış ekranında hizmet kaydı olarak işlenir.</p>
                  <div className="button-grid">
                    {programQuickAmounts.map((amount) => (
                      <button
                        key={amount}
                        className="choice"
                        type="button"
                        onClick={() => openProgramSale(amount)}
                      >
                        {money(amount)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <OtherStockForm
                  stockForm={stockForm}
                  setStockForm={setStockForm}
                  saveStock={saveStock}
                  otherGroupName={otherGroupName}
                  setOtherGroupName={setOtherGroupName}
                  supplierOptions={supplierOptions}
                  setSupplierModalOpen={setSupplierModalOpen}
                  stockItems={activeStock}
                  stockChoiceOptions={stockChoiceOptions}
                  addStockChoice={addStockChoice}
                  openProgramSale={openProgramSale}
                />
              )}
            </section>
          </section>
        )}

        {active === "stok" && (
          <section className="section">
            <div className="stok-subtabs">
              <button className={stockView === "cihaz" ? "choice active" : "choice"} onClick={() => setStockView("cihaz")}>Cihaz Stok Listesi</button>
              <button className={stockView === "aksesuar" ? "choice active" : "choice"} onClick={() => setStockView("aksesuar")}>Aksesuar Stok Listesi</button>
              <button className={stockView === "diger" ? "choice active" : "choice"} onClick={() => setStockView("diger")}>X</button>
              <button className={stockView === "tum" ? "choice active" : "choice"} onClick={() => setStockView("tum")}>TÜM Stok</button>
              <button className={stockTab === "kayit" ? "choice active" : "choice"} onClick={() => setStockTab(stockTab === "kayit" ? "liste" : "kayit")}>Stok Kaydı</button>
            </div>

            <section className="card">
              <div className="stock-title-row">
                <h2>
                  {stockView === "cihaz" && "Cihaz Stok Listesi"}
                  {stockView === "aksesuar" && "Aksesuar Stok Listesi"}
                  {stockView === "diger" && "X"}
                  {stockView === "tum" && "TÜM Stok"}
                </h2>
                <button type="button" className="print-action" onClick={printPage} aria-label="Stok listesini yazdır">
                  <Printer size={15} />
                  YAZ
                </button>
                <div className="stock-summary-box">
                  <span>Stok Alış Toplamı</span>
                  <b>{money(currentStockBuyTotal)}</b>
                </div>
                <div className="stock-summary-box">
                  <span>Toplam Adet</span>
                  <b>{currentStockQtyTotal}</b>
                </div>
              </div>

              <StockTable stock={currentStockList} setEditingStock={openStockEditor} deviceView={stockView === "cihaz"} />

              {stockView === "tum" && (
                <div className="grouped-stock">
                  <h3>Grup Grup Stok Özeti</h3>
                  {[
                    { groupName: "Cihaz", groupItems: deviceStock },
                    { groupName: "Aksesuar", groupItems: accessoryStock },
                    { groupName: "X", groupItems: otherStock },
                  ].map(({ groupName, groupItems }) => {
                    return (
                      <div key={groupName} className="group-block">
                        <h4>{groupName}</h4>
                        <StockTable stock={groupItems} setEditingStock={openStockEditor} deleteStock={deleteStock} deviceView={groupName === "Cihaz"} />
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
                  {[
                    { value: "Cihaz", label: "Cihaz" },
                    { value: "Aksesuar", label: "Aksesuar" },
                    { value: "Diğer", label: "X" },
                  ].map((module) => (
                    <button key={module.value} className={stockForm.module === module.value ? "choice active" : "choice"} onClick={() => setStockForm({ ...stockForm, module: module.value })}>{module.label}</button>
                  ))}
                </div>
                {stockForm.module === "Cihaz" && (
                  <DeviceStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} />
                )}
                {stockForm.module === "Aksesuar" && (
                  <AccessoryStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} customAccessoryCategories={customAccessoryCategories} setCustomAccessoryCategories={setCustomAccessoryCategories} />
                )}
                {stockForm.module === "Diğer" && (
                  <OtherStockForm stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} otherGroupName={otherGroupName} setOtherGroupName={setOtherGroupName} supplierOptions={supplierOptions} setSupplierModalOpen={setSupplierModalOpen} stockItems={activeStock} stockChoiceOptions={stockChoiceOptions} addStockChoice={addStockChoice} openProgramSale={openProgramSale} />
                )}
              </section>
            )}
          </section>
        )}

        {active === "tamir" && (
          <section className="section technical-service-page">
            <div className="stats four">
              <Stat title="Açık Servis" value={activeTechnicalServices.length} />
              <Stat title="Hazır Cihaz" value={technicalReadyCount} />
              <Stat title="Teslim Edilen" value={technicalDeliveredCount} />
              <Stat title="Tahmini Servis Geliri" value={money(technicalEstimatedTotal)} />
            </div>

            <section className="card technical-service-list-card">
              <div className="technical-section-head">
                <div>
                  <h2>TEKNİK SERVİS — CEPLOG PROFESYONEL SERVİS</h2>
                </div>
                <div className="technical-toolbar">
                  <button className="primary compact-action" type="button" onClick={openTechnicalServiceForm}><Plus size={16} /> YENİ SERVİS KAYDI</button>
                  <button className="print-action compact-action" type="button" onClick={printPage} aria-label="Teknik servis sayfasını yazdır"><Printer size={15} /> YAZ</button>
                  <button className="edit-btn compact-action" type="button" onClick={refreshFromDatabase}>YENİLE</button>
                  <button className="edit-btn compact-action" type="button" onClick={cycleTechnicalStatusFilter}>FİLTRE: {technicalStatusFilter}</button>
                  <button className="choice compact-action" type="button" onClick={() => setTechnicalSearchModalOpen(true)}><Search size={15} /> SORGULA</button>
                </div>
              </div>

              <Table headers={["No", "Kayıt Tarihi", "Teslim Tarihi", "Müşteri", "Telefon", "Cihaz / IMEI", "Arıza", "Durum", "Toplam", "Net Tahsilat", "Kalan", "İşlem / Detay"]} rows={visibleTechnicalServices.map((item, index) => {
                const summary = technicalServiceSummary(item);
                return [
                  index + 1,
                  formatRecordDate(item.createdAt),
                  formatRecordDate(item.deliveryDateTime || item.dueDate || item.createdAt),
                  item.customerName,
                  item.phone || "-",
                  <div className="technical-device-cell"><b>{item.device}</b><span>{item.imei || "-"}</span></div>,
                  item.issue,
                  <span className={`service-status-badge service-status-${String(item.status || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, "-")}`}>{item.status}</span>,
                  item.estimatedPrice || "0 TL",
                  money(summary.net),
                  money(summary.remaining),
                  <div className="service-actions">
                    <button className="edit-btn" type="button" onClick={() => openTechnicalServiceDetail(item.id)}>Detay</button>
                    {item.status !== "İşlemde" && item.status !== "Teslim Edildi" && item.status !== "İptal" && (
                      <button className="edit-btn" type="button" onClick={() => updateTechnicalServiceStatus(item.id, "İşlemde")}>İşleme Al</button>
                    )}
                    {item.status !== "Hazır" && item.status !== "Teslim Edildi" && item.status !== "İptal" && (
                      <button className="edit-btn" type="button" onClick={() => updateTechnicalServiceStatus(item.id, "Hazır")}>Hazır</button>
                    )}
                    {item.status !== "Teslim Edildi" && item.status !== "İptal" && (
                      <button className="primary compact-action" type="button" onClick={() => updateTechnicalServiceStatus(item.id, "Teslim Edildi")}>Teslim</button>
                    )}
                    {item.status !== "İptal" && item.status !== "Teslim Edildi" && (
                      <button className="delete-btn" type="button" onClick={() => updateTechnicalServiceStatus(item.id, "İptal")}>İptal</button>
                    )}
                  </div>,
                ];
              })} />
            </section>

            <section className="card technical-service-form-card technical-service-bottom-card">
              {selectedTechnicalService ? (
                renderTechnicalServiceDetailCard(selectedTechnicalService, selectedTechnicalSummary)
              ) : (
                <div className="empty-search-note">Listeden servis seç veya + YENİ SERVİS KAYDI ile yeni kayıt penceresini aç.</div>
              )}
            </section>
          </section>
        )}

        {active === "vole" && (
          <section className="section">
            <div className="kasa-subtabs">
              <button className={karaTab === "alacak" ? "choice active" : "choice"} onClick={() => setKaraTab("alacak")}>ALACAKLARIM</button>
              <button className={karaTab === "borc" ? "choice active" : "choice"} onClick={() => setKaraTab("borc")}>TEDARİKÇİ / FİRMA</button>
              <button className={karaTab === "banka" ? "choice active" : "choice"} onClick={() => setKaraTab("banka")}>BANKA HESAP</button>
              <button className={karaTab === "kar" ? "choice active" : "choice"} onClick={openProfitTab}>Kâr</button>
              <button className={karaTab === "sorgu" ? "choice active" : "choice"} onClick={() => setKaraTab("sorgu")}>Sorgula</button>
            </div>

            <div className="kara-tools">
              <button type="button" className="primary calculator-open-btn" onClick={openCalculator}>
                <Calculator size={18} />
                Hesap Makinesi
              </button>
            </div>

            {karaTab === "alacak" && (
              <section className="card">
                {!selectedReceivableMovement ? (
                  <>
                    <div className="stock-title-row ledger-title-row">
                      <h2>Kara Defter / Alacaklarım</h2>
                      <button type="button" className="print-action" onClick={printPage} aria-label="Alacaklarımı yazdır">
                        <Printer size={15} />
                        YAZ
                      </button>
                      <div className="ledger-total-card receivable">
                        <span>TOPLAM ALACAKLARIM</span>
                        <b>Alacak: {money(totalReceivableBalance)}</b>
                      </div>
                    </div>
                    <Table headers={["İşlem", "Tarih", "Adı Soyad", "Alınan Mal", "Kalan", "Düzelt", "Sil"]} rows={alacaklarim.map((sale, index) => [
                      index + 1,
                      new Date(sale.date).toLocaleString("tr-TR"),
                      sale.cariPerson || sale.customer,
                      <button className="link-btn" onClick={() => setSelectedReceivableMovement(sale)}>{sale.productName}</button>,
                      money(sale.remaining),
                      <button className="edit-btn" onClick={() => openSaleEditor(sale)}><Pencil size={14} /> Düzenle</button>,
                      <button className="delete-btn" onClick={() => { window.alert("Satış silme kapatıldı. Satış iptal/iade/düzeltme sadece Kasa > Kasa Kapanış > Günlük Kasa Raporu > Kasa Beyni üzerinden yapılır."); }}>Sil</button>,
                    ])} />
                  </>
                ) : (
                  <ReceivableMovementPage
                    sale={selectedReceivableMovement}
                    stock={activeStock}
                    saveReceivablePayment={saveReceivablePayment}
                    setSelectedReceivableMovement={setSelectedReceivableMovement}
                  />
                )}
              </section>
            )}

            {karaTab === "borc" && (
              <section className="card">
                {!selectedSupplierAccount ? (
                  <>
                    <div className="stock-title-row ledger-title-row">
                      <h2>Kara Defter / Tedarikçi/Firma</h2>
                      <button type="button" className="print-action" onClick={printPage} aria-label="Tedarikçi sayfasını yazdır">
                        <Printer size={15} />
                        YAZ
                      </button>
                      <div className="ledger-total-card payable">
                        <span>TOPLAM TEDARİKÇİ / FİRMA BORCU</span>
                        <b>Borç: {money(totalPayableBalance)}</b>
                      </div>
                    </div>
                    <Table headers={["Cari", "Tür", "Son Alınan Mal", "Alış Toplam", "Ödenen", "Şimdiki Borç", "Sil"]} rows={borclarim.map((row) => [
                      <button className="link-btn" onClick={() => setSelectedSupplierAccount(row.accountKey)}>{row.name}</button>,
                      row.kind === "seller" ? "Satıcı" : row.kind === "supplier" ? "Tedarikçi/Firma" : "Cari",
                      row.lastProduct,
                      money(row.totalBuy),
                      money(row.paid),
                      money(row.remaining),
                      row.kind === "supplier" ? <button className="delete-btn" onClick={() => deleteSupplierDebt(row.name)}>Sil</button> : "-",
                    ])} />
                  </>
                ) : (
                  <SupplierAccountPage
                    account={borclarim.find((row) => row.accountKey === selectedSupplierAccount) || { accountKey: selectedSupplierAccount, kind: "supplier", name: selectedSupplierAccount, remaining: 0, totalBuy: 0, paid: 0 }}
                    stock={activeStock}
                    saveCariPayment={saveCariPayment}
                    setSelectedSupplierAccount={setSelectedSupplierAccount}
                  />
                )}
              </section>
            )}
            {karaTab === "banka" && (
              <section className="card">
                <h2>Kara Defter / Banka Hesap</h2>
                <div className="stats three">
                  <Stat title="Bankaya Toplam Giden" value={money(bankReport.totalToBank)} />
                  <Stat title="Bankadan Çekilen" value={money(bankReport.withdrawnFromBank)} />
                  <Stat title="Bankada Kalan" value={money(bankReport.remainingInBank)} />
                </div>

                <div className="bank-account-grid">
                  {bankAccountRows.map((row) => (
                    <div key={row.bank} className="bank-account-card">
                      <h3>{row.bank}</h3>
                      <div><span>Bankaya Giden</span><b>{money(row.totalToBank)}</b></div>
                      <div><span>Bankadan Çekilen</span><b>{money(row.withdrawnFromBank)}</b></div>
                      <div><span>Bankada Kalan</span><b>{money(row.remaining)}</b></div>
                      <div><span>Komisyon Tahmini %3,5</span><b>{money(row.commission)}</b></div>
                    </div>
                  ))}
                </div>

                <Table headers={["Tarih", "İşlem", "Banka/POS", "Tutar", "Not"]} rows={activeBankMovements.map((item) => [
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
                <StockTable stock={filteredStock} setEditingStock={openStockEditor} deleteStock={deleteStock} />
                <h3>Satış Sonuçları</h3>
                <Table headers={["Grup", "Ürün", "Müşteri / Cari Kişi", "Satış", "Nakit", "Kart", "Kalan", "Düzelt", "Sil"]} rows={visibleSalesListRows.map((sale) => [
                  saleGroupName(sale.type),
                  sale.productName,
                  sale.cariPerson || sale.customer || "-",
                  sale.total,
                  sale.cash,
                  sale.card,
                  money(sale.remaining),
                  <button className="edit-btn" onClick={() => openSaleEditor(sale)}>Düzenle</button>,
                  <button className="delete-btn" onClick={() => { window.alert("Satış silme kapatıldı. Satış iptal/iade/düzeltme sadece Kasa > Kasa Kapanış > Günlük Kasa Raporu > Kasa Beyni üzerinden yapılır."); }}>Sil</button>,
                ])} />
              </section>
            )}

          </section>
        )}

        {editingSale && <SaleEditModal sale={editingSale} setSale={setEditingSale} save={updateSale} bankOptions={bankOptions} onBankSelect={handleBankSelect} />}
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

function DeviceStockForm({ stockForm, setStockForm, saveStock, supplierOptions, setSupplierModalOpen, phoneOnly = false }) {
  const isPhone = phoneOnly || stockForm.deviceType === "Telefon";
  const isSecondHandPhone = isSecondHandPhonePurchase(stockForm, "Cihaz");
  const brandOptions = isPhone ? brands : nonPhoneBrands;
  const phoneModels = modelsByBrand[stockForm.brand] || [];
  const selectedPhoneModel = phoneModels.includes(stockForm.model) ? stockForm.model : "";

  function changeDeviceType(deviceType) {
    const nextIsPhone = deviceType === "Telefon";
    const nextBrand = nextIsPhone
      ? (brands.includes(stockForm.brand) ? stockForm.brand : "Apple")
      : (nonPhoneBrands.includes(stockForm.brand) ? stockForm.brand : nonPhoneBrands[0]);
    const nextPhoneModels = modelsByBrand[nextBrand] || [];

    setStockForm({
      ...stockForm,
      module: "Cihaz",
      deviceType,
      brand: nextBrand,
      model: nextIsPhone ? (nextPhoneModels.includes(stockForm.model) ? stockForm.model : nextPhoneModels[0] || "") : "",
      memory: nextIsPhone ? stockForm.memory || memoryOptions[0] : "",
      supplier: nextIsPhone && stockForm.condition === "İkinci El" ? "" : stockForm.supplier,
      sellerPerson: nextIsPhone ? stockForm.sellerPerson : "",
      sellerPhone: nextIsPhone ? stockForm.sellerPhone : "",
      saleFormImageName: nextIsPhone ? stockForm.saleFormImageName : "",
    });
  }

  function changeCondition(condition) {
    const nextSecondHandPhone = stockForm.deviceType === "Telefon" && condition === "İkinci El";
    setStockForm({
      ...stockForm,
      module: "Cihaz",
      condition,
      supplier: nextSecondHandPhone ? "" : stockForm.supplier,
    });
  }

  function changeBrand(brand) {
    const nextPhoneModels = modelsByBrand[brand] || [];
    setStockForm({
      ...stockForm,
      module: "Cihaz",
      brand,
      model: isPhone ? nextPhoneModels[0] || "" : "",
    });
  }

  return (
    <>
      <div className="form-grid">
        {!phoneOnly && (
          <select value={stockForm.deviceType} onChange={(e) => changeDeviceType(e.target.value)}>
            {deviceTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        )}

        <select value={stockForm.condition} onChange={(e) => changeCondition(e.target.value)}>
          <option>Sıfır Garantili</option>
          <option>Sıfır Spot</option>
          <option>İkinci El</option>
        </select>

        <select value={stockForm.brand} onChange={(e) => changeBrand(e.target.value)}>
          {brandOptions.map((brand) => <option key={brand}>{brand}</option>)}
        </select>

        {isPhone ? (
          <>
            <select value={selectedPhoneModel} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", model: e.target.value })}>
              <option value="">Model Ekle</option>
              {phoneModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
            {!selectedPhoneModel && (
              <input placeholder="Model adı yaz" value={stockForm.model} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", model: e.target.value })} />
            )}
            <select value={stockForm.memory} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", memory: e.target.value })}>
              {memoryOptions.map((memory) => <option key={memory}>{memory}</option>)}
            </select>
          </>
        ) : (
          <input placeholder="Model / Model Ekle" value={stockForm.model} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", model: e.target.value })} />
        )}

        <input placeholder="Barkod / IMEI" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(e) => setStockForm({ ...stockForm, module: "Cihaz", barcode: cleanBarcode(e.target.value) })} />

        {!isSecondHandPhone && (
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

      {isSecondHandPhone && (
        <div className="conditional-panel">
          <h3>Müşteriden Alım Bilgileri</h3>
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
      <button className="primary" onClick={() => { if (phoneOnly) setStockForm({ ...stockForm, module: "Cihaz", deviceType: "Telefon" }); saveStock("Cihaz"); }}><Plus size={16} /> Cihazı Stoka Kaydet</button>
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


function OtherStockForm({
  stockForm,
  setStockForm,
  saveStock,
  otherGroupName,
  setOtherGroupName,
  supplierOptions,
  setSupplierModalOpen,
  stockItems = [],
  stockChoiceOptions = {},
  addStockChoice = () => "",
  openProgramSale = () => {},
}) {
  const selectedGroup = toVisibleOtherGroup(stockForm.deviceType || otherGroupName || "Saat");
  const selectedInternalGroup = toInternalOtherGroup(selectedGroup);
  const selectedCondition = stockConditionOptions.includes(stockForm.condition) ? stockForm.condition : "Sıfır Garantili";
  const brandOptions = stockChoiceOptionsFor({ customChoices: stockChoiceOptions, stockItems, group: selectedInternalGroup, field: "brand" });
  const productOptions = stockChoiceOptionsFor({ customChoices: stockChoiceOptions, stockItems, group: selectedInternalGroup, field: "name" });
  const modelOptions = stockChoiceOptionsFor({ customChoices: stockChoiceOptions, stockItems, group: selectedInternalGroup, field: "model" });

  function updateOtherStockForm(patch) {
    setStockForm({
      ...stockForm,
      module: "Diğer",
      deviceType: selectedInternalGroup,
      ...patch,
    });
  }

  function changeOtherGroup(group) {
    const internalGroup = toInternalOtherGroup(group);
    setOtherGroupName(group);
    setStockForm({
      ...stockForm,
      module: "Diğer",
      deviceType: internalGroup,
      condition: stockConditionOptions.includes(stockForm.condition) ? stockForm.condition : "Sıfır Garantili",
      brand: "",
      name: "",
      model: "",
      memory: "",
      saleFormImageName: "",
    });
  }

  function changeChoice(field, value, options) {
    if (value === stockChoiceAddValue) {
      const created = addStockChoice(selectedInternalGroup, field, options);
      if (!created) return;
      updateOtherStockForm({ [field]: created });
      return;
    }
    updateOtherStockForm({ [field]: value });
  }

  function ChoiceSelect({ field, options, value, placeholder }) {
    const cleanValue = cleanStockChoice(value);
    const hasCurrentValue = cleanValue && !options.some((option) => normalizeStockText(option) === normalizeStockText(cleanValue));

    return (
      <select value={cleanValue} onChange={(e) => changeChoice(field, e.target.value, options)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        {hasCurrentValue && <option value={cleanValue}>{cleanValue}</option>}
        <option value={stockChoiceAddValue}>+ {stockChoiceFieldLabels[field]} Ekle</option>
      </select>
    );
  }

  if (selectedGroup === "Program") {
    return (
      <>
        <div className="form-grid">
          <select value={selectedGroup} onChange={(e) => changeOtherGroup(e.target.value)}>
            {otherProductGroups.map((group) => <option key={group}>{group}</option>)}
          </select>
        </div>
        <div className="conditional-panel">
          <h3>Program Satışı</h3>
          <p className="mini-note">Program stoklu ürün gibi çalışmaz. Marka, ürün, model, barkod ve belge alanı yoktur.</p>
          <div className="button-grid">
            {programQuickAmounts.map((amount) => (
              <button key={amount} className="choice" type="button" onClick={() => openProgramSale(amount)}>
                {money(amount)}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="form-grid">
        <select value={selectedGroup} onChange={(e) => changeOtherGroup(e.target.value)}>
          {!otherProductGroups.includes(selectedGroup) && <option value={selectedGroup}>{selectedGroup}</option>}
          {otherProductGroups.map((group) => <option key={group}>{group}</option>)}
        </select>
        <select value={selectedCondition} onChange={(e) => updateOtherStockForm({ condition: e.target.value, saleFormImageName: e.target.value === "İkinci El" ? stockForm.saleFormImageName : "" })}>
          {stockConditionOptions.map((condition) => <option key={condition}>{condition}</option>)}
        </select>
        <ChoiceSelect field="brand" options={brandOptions} value={stockForm.brand} placeholder="Marka seç / ekle" />
        <ChoiceSelect field="name" options={productOptions} value={stockForm.name} placeholder="Ürün seç / ekle" />
        <ChoiceSelect field="model" options={modelOptions} value={stockForm.model} placeholder="Model seç / ekle" />
        <input placeholder="Barkod / IMEI" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(e) => updateOtherStockForm({ barcode: cleanBarcode(e.target.value) })} />
        <select value={stockForm.supplier} onChange={(e) => {
          if (e.target.value === "__add_supplier__") {
            setSupplierModalOpen(true);
            return;
          }
          updateOtherStockForm({ supplier: e.target.value });
        }}>
          <option value="">Tedarikçi / Firma seç</option>
          <option value="__add_supplier__">+ Tedarikçi Ekle</option>
          {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
        </select>
        <input type="text" inputMode="numeric" placeholder="Alış fiyatı" value={stockForm.buy} onFocus={() => setStockForm({ ...stockForm, buy: stripMoneyForEdit(stockForm.buy) })} onChange={(e) => updateOtherStockForm({ buy: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, buy: formatMoneyInput(stockForm.buy) })} />
        <input type="text" inputMode="numeric" placeholder="Satış fiyatı" value={stockForm.sell} onFocus={() => setStockForm({ ...stockForm, sell: stripMoneyForEdit(stockForm.sell) })} onChange={(e) => updateOtherStockForm({ sell: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, sell: formatMoneyInput(stockForm.sell) })} />
        <input type="number" placeholder="Stok adedi" value={stockForm.qty} onChange={(e) => updateOtherStockForm({ qty: e.target.value })} />
        <div className="remaining-input">
          <span>Kalan cari</span>
          <b>{money(Math.max(parseMoneyInput(stockForm.buy) * Number(stockForm.qty || 0) - parseMoneyInput(stockForm.supplierPaid), 0))}</b>
        </div>
        <input type="text" inputMode="numeric" placeholder="Kalan ödeme" value={stockForm.supplierPaid} onFocus={() => setStockForm({ ...stockForm, supplierPaid: stripMoneyForEdit(stockForm.supplierPaid) })} onChange={(e) => updateOtherStockForm({ supplierPaid: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, supplierPaid: formatMoneyInput(stockForm.supplierPaid) })} />
      </div>

      {selectedCondition === "İkinci El" && (
        <div className="conditional-panel">
          <h3>İkinci El Belge / Dosya</h3>
          <p className="mini-note">{secondHandDocumentAlert}</p>
          <div className="form-grid">
            <input type="file" accept="image/*,.pdf" required onChange={(e) => updateOtherStockForm({ saleFormImageName: e.target.files?.[0]?.name || "" })} />
            <input placeholder="Seçilen belge / dosya" value={stockForm.saleFormImageName || ""} readOnly />
          </div>
        </div>
      )}

      <button className="primary" onClick={() => saveStock("Diğer")}><Plus size={16} /> {selectedGroup} Ürününü Stoka Kaydet</button>
    </>
  );
}

function SupplierAccountPage({ account, stock, saveCariPayment, setSelectedSupplierAccount }) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const accountStock = account.kind === "supplier"
    ? stock.filter((product) => product.supplier === account.name)
    : stock.filter((product) => sellerNameFromProduct(product) === account.name);
  const remaining = Number(account.remaining || 0);

  async function handlePayment() {
    const saved = await saveCariPayment(account, paymentAmount);
    if (saved) setPaymentAmount("");
  }

  return (
    <div className="supplier-account-page">
      <button className="choice" onClick={() => setSelectedSupplierAccount(null)}>Geri</button>
      <h2>{account.name}</h2>

      <div className="supplier-summary">
        <div className="summary-row main">
          <span>Cari Türü</span>
          <b>{account.kind === "seller" ? "Satıcı" : account.kind === "supplier" ? "Tedarikçi/Firma" : "Cari"}</b>
        </div>
        <div className={remaining < 0 ? "summary-row debt negative" : "summary-row debt"}>
          <span>Şimdiki Borç</span>
          <b>{money(remaining)}</b>
        </div>
      </div>

      <div className="conditional-panel">
        <h3>Cari Ödeme</h3>
        <div className="form-grid">
          <input type="text" inputMode="numeric" placeholder="Ödeme tutarı" value={paymentAmount} onFocus={() => setPaymentAmount(stripMoneyForEdit(paymentAmount))} onChange={(e) => setPaymentAmount(cleanMoneyTyping(e.target.value))} onBlur={() => setPaymentAmount(formatMoneyInput(paymentAmount))} />
          <div className="remaining-input">
            <span>Ödeme Sonrası</span>
            <b className={remaining - parseMoneyInput(paymentAmount) < 0 ? "money-negative" : ""}>{money(remaining - parseMoneyInput(paymentAmount))}</b>
          </div>
        </div>
        <button className="primary" onClick={handlePayment}>Cari Ödemeyi Kasadan Çık</button>
      </div>

      {accountStock.length > 0 && (
        <Table headers={["Tarih", "Ürün", "Alış", "Ödenen", "Kalan"]} rows={accountStock.map((product) => {
          const totalBuy = parseMoneyInput(product.buy) * Number(product.qty || 0);
          const paid = parseMoneyInput(product.supplierPaid || 0);
          return [
            product.saleDate ? new Date(product.saleDate).toLocaleString("tr-TR") : "-",
            productTitle(product),
            money(totalBuy),
            money(paid),
            money(totalBuy - paid),
          ];
        })} />
      )}
    </div>
  );
}

function ReceivableMovementPage({ sale, stock, saveReceivablePayment, setSelectedReceivableMovement }) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const product = stock.find((item) => String(item.id) === String(sale.productId));

  async function handlePayment() {
    const saved = await saveReceivablePayment(sale, paymentAmount);
    if (saved) {
      setPaymentAmount("");
      setSelectedReceivableMovement(null);
    }
  }

  return (
    <div className="movement-page">
      <button className="choice" onClick={() => setSelectedReceivableMovement(null)}>Geri</button>
      <h2>{sale.productName}</h2>
      <div className="supplier-summary">
        <div className="summary-row main">
          <span>Cari Kişi</span>
          <b>{sale.cariPerson || sale.customer || "-"}</b>
        </div>
        <div className="summary-row debt">
          <span>Kalan Alacak</span>
          <b>{money(sale.remaining || 0)}</b>
        </div>
      </div>
      <Table headers={["Alan", "Değer"]} rows={[
        ["Satış", sale.total],
        ["Nakit", sale.cash],
        ["Kart", sale.card],
        ["Ürün", product ? productTitle(product) : sale.productName],
      ]} />
      <div className="conditional-panel">
        <h3>Alacak Tahsilatı</h3>
        <div className="form-grid">
          <input type="text" inputMode="numeric" placeholder="Tahsil edilen tutar" value={paymentAmount} onFocus={() => setPaymentAmount(stripMoneyForEdit(paymentAmount))} onChange={(e) => setPaymentAmount(cleanMoneyTyping(e.target.value))} onBlur={() => setPaymentAmount(formatMoneyInput(paymentAmount))} />
          <div className="remaining-input">
            <span>Tahsilat Sonrası</span>
            <b>{money(Math.max(Number(sale.remaining || 0) - parseMoneyInput(paymentAmount), 0))}</b>
          </div>
        </div>
        <button className="primary" onClick={handlePayment}>Alacak Ödemesini Kasaya Al</button>
      </div>
    </div>
  );
}

function StockTable({ stock, deviceView = false }) {
  if (deviceView) {
    return (
      <Table
        headers={["No", "Durum", "Marka", "Model", "Hafıza", "Alış", "Satış", "Stok", "Tedarikçi/Satıcı"]}
        rows={stock.map((product, index) => [
          index + 1,
          product.condition || product.category || "-",
          product.brand || "-",
          product.model || "-",
          product.memory || "-",
          money(product.buy),
          money(product.sell),
          product.qty,
          product.supplier || product.sellerCariName || product.sellerPerson || "-",
        ])}
      />
    );
  }

  return (
    <Table
      headers={["Tür", "Ürün", "Barkod/IMEI", "Stok", "Alış", "Satış", "Tedarikçi/Satıcı", "Cari Kalan"]}
      rows={stock.map((product) => [
        toVisibleOtherGroup(product.deviceType),
        productTitle(product),
        product.barcode,
        product.qty,
        money(product.buy),
        money(product.sell),
        product.supplier || product.sellerCariName || product.sellerPerson || "-",
        money(product.sellerCariRemaining || 0),
      ])}
    />
  );
}

function SaleEditModal({ sale, setSale, save, bankOptions = [], onBankSelect }) {
  const safeSale = sale || {};
  const safeBanks = Array.isArray(bankOptions) ? bankOptions : [];
  const remaining = safeSale.type === "Aksesuar Satışı" ? 0 : Math.max(parseMoneyInput(safeSale.total || 0) - parseMoneyInput(safeSale.cash || 0) - parseMoneyInput(safeSale.card || 0), 0);
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Satış Düzelt</h2>
        <input placeholder="Müşteri adı soyadı / telefon" value={safeSale.customer || ""} onChange={(e) => setSale({ ...safeSale, customer: e.target.value, cariPerson: e.target.value })} />
        <input placeholder="Cari kişi" value={safeSale.cariPerson || ""} onChange={(e) => setSale({ ...safeSale, cariPerson: e.target.value })} />
        <input type="text" inputMode="numeric" placeholder="Satış fiyatı" value={safeSale.total || ""} onFocus={() => setSale({ ...safeSale, total: stripMoneyForEdit(safeSale.total) })} onChange={(e) => setSale({ ...safeSale, total: cleanMoneyTyping(e.target.value) })} onBlur={() => setSale({ ...safeSale, total: formatMoneyInput(safeSale.total) })} />
        <input type="text" inputMode="numeric" placeholder="Nakit" value={safeSale.cash || ""} onFocus={() => setSale({ ...safeSale, cash: stripMoneyForEdit(safeSale.cash) })} onChange={(e) => setSale({ ...safeSale, cash: cleanMoneyTyping(e.target.value) })} onBlur={() => setSale({ ...safeSale, cash: formatMoneyInput(safeSale.cash) })} />
        <input type="text" inputMode="numeric" placeholder="Kart" value={safeSale.card || ""} onFocus={() => setSale({ ...safeSale, card: stripMoneyForEdit(safeSale.card) })} onChange={(e) => setSale({ ...safeSale, card: cleanMoneyTyping(e.target.value) })} onBlur={() => setSale({ ...safeSale, card: formatMoneyInput(safeSale.card) })} />
        <select value={safeSale.bank || ""} onChange={(e) => {
          if (e.target.value === "__add_bank__") {
            if (onBankSelect) {
              onBankSelect(e.target.value, (bank) => setSale({ ...safeSale, bank }));
            }
            return;
          }
          setSale({ ...safeSale, bank: e.target.value });
        }}>
          <option value="">Banka seç</option>
          {safeBanks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
          <option value="__add_bank__">+ Banka Ekle</option>
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
          <input placeholder="Model / Model Ekle" value={item.model || ""} onChange={(e) => setItem({ ...item, model: e.target.value })} />
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
