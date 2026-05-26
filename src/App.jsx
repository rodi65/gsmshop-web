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
  createBankMovement,
  createContactPayment,
  createReceivablePayment,
  repairStockSideEffects,
  softDelete,
  cancelRecord,
  updateSaleRecord,
  updateStockItem,
} from "./services/dataService";

import { Wallet, Smartphone, Headphones, Package, Search, Wrench, TrendingUp, Plus, Pencil, Save, X, ShieldCheck, ReceiptText } from "lucide-react";

const parseMoneyInput = (value) => Number(String(value || "0").replace(/\./g, "").replace(/,/g, "").replace(/TL/g, "").replace(/₺/g, "").replace(/\s/g, ""));
const formatMoneyInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} TL`;
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
const money = (value) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(parseMoneyInput(value))} TL`;
const has = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase());
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

const saleTypes = ["Telefon Satışı", "Saat Satışı", "Tablet Satışı", "PC Satışı", "Elektronik Satışı", "Aksesuar Satışı"];
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
const mainSaleGroups = ["Telefon", "Aksesuar", "Program", "Saat", "Tablet", "Elektronik"];
const otherSaleTypes = ["Saat Satışı", "PC Satışı", "Elektronik Satışı"];
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
const accessoryShortcutLimit = 30;
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
const cashEntryTypes = ["Manuel Nakit Girişi", "Devir Nakit"];
const cashEntryMovementTypes = ["Manuel Nakit Girişi", "Nakit Girişi", "Kasaya Nakit Girişi"];
const cashEntryCancellationType = "Nakit Girişi İptali";
const purchaseCancellationMovementTypes = [
  "Stok Alış İptali",
  "Cihaz Alış İptali",
  "Telefon Alış İptali",
  "Stok Ödemesi İptali",
  "Alım Ödemesi İptali",
  "Tedarikçi Ödemesi İptali",
];
const cashLedgerMovementTypes = ["Satış Nakit", "Bankadan Nakit Gelen", "Manuel Nakit Girişi", "Nakit Girişi", "Kasaya Nakit Girişi", cashEntryCancellationType, "Devir Nakit", "Gelen Alacak", "Alacak Ödemesi", "Stok Ödemesi", "Cari Ödeme", "Gider", "Bankaya Yatırılan Nakit", "Düzeltme", ...purchaseCancellationMovementTypes, ...technicalServiceMovementTypes];
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
  if (type === "Teknik Servis") return "Teknik Servis";
  return "Diğerleri";
};

const normalizeStockText = (value) => String(value || "").toLocaleLowerCase("tr-TR");
const isPhoneStockItem = (item) =>
  normalizeStockText(item.module) === "cihaz" && normalizeStockText(item.deviceType || item.device_type) === "telefon";
const isAccessoryStockItem = (item) => normalizeStockText(item.module) === "aksesuar";
const isOtherStockItem = (item) => !isPhoneStockItem(item) && !isAccessoryStockItem(item);
const isSecondHandPhonePurchase = (form, module = form.module) =>
  module === "Cihaz" && form.deviceType === "Telefon" && form.condition === "İkinci El";
const recordDate = (item) => item.created_at || item.createdAt || item.date || "";
const isTodayRecord = (item, todayKey) => recordDate(item).slice(0, 10) === todayKey;
const cashMovementType = (item) => item.movement_type || item.movementType || item.type || "";
const cashMovementAmount = (item) => typeof item.amount === "number" ? item.amount : parseMoneyInput(item.amount);
const bankMovementType = (item) => item.movement_type || item.movementType || item.type || "";
const bankMovementAmount = (item) => typeof item.amount === "number" ? item.amount : parseMoneyInput(item.amount);
const bankMovementDirection = (item) => item.direction || (purchasePaymentMovementTypes.includes(bankMovementType(item)) || bankMovementType(item) === "Bankadan Çekilen" ? "out" : "in");
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
    (item.module === "Cihaz" && item.category === "İkinci El");
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
    condition: item.module === "Cihaz" ? item.category || "Sıfır Garantili" : "Sıfır Garantili",
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

const isActiveRecord = (item) => {
  const status = String(item?.status || "active").toLocaleLowerCase("tr-TR");
  return !["deleted", "cancelled", "canceled", "iptal", "silindi"].includes(status) &&
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
const defaultBanks = ["Ziraatbank", "İşbank", "Halkbank"];
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
const otherProductGroups = ["Saat", "Tablet", "PC", "Bluetooth", "Elektronik", "Program", "Diğerleri"];

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
  if (product.module !== "Cihaz") return [product.deviceType, product.name].filter(Boolean).join(" / ") || "-";
  return [product.brand, product.model, product.memory].filter(Boolean).join(" ");
}

const stockSearchFilters = ["TÜMÜ", "TELEFON", "AKSESUAR", "DİĞERLERİ", "SAAT", "TABLET", "PC", "BLUETOOTH", "ELEKTRONİK", "PROGRAM"];
const technicalSearchFilters = ["TÜMÜ", "TELEFON", "PC", "TABLET", "ELEKTRONİK", "DİĞERLERİ"];

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
  return { saleGroup: "Diğerleri", saleType: "Diğerleri Satışı" };
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
  return item?.created_at || item?.createdAt || item?.movement_date || item?.sale_date || item?.date || "";
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
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [cashMovements, setCashMovements] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [kasaTab, setKasaTab] = useState("yeniSatis");
  const [dailyReportDate, setDailyReportDate] = useState(() => localDateKey(new Date()));
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockSearchFilter, setStockSearchFilter] = useState("TÜMÜ");
  const [saleGroup, setSaleGroup] = useState("Telefon");
  const [quickAccessoryGroup, setQuickAccessoryGroup] = useState("Kılıf");
  const [quickAccessorySubType, setQuickAccessorySubType] = useState("A Kılıf");
  const [accessoryShortcuts, setAccessoryShortcuts] = useState([]);
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
  const [technicalServiceStorageReadyKey, setTechnicalServiceStorageReadyKey] = useState("");
  const [visibleKasaStats, setVisibleKasaStats] = useState({});
  const [profitUnlocked, setProfitUnlocked] = useState(false);
  const [securityPasswordDrafts, setSecurityPasswordDrafts] = useState(() => getSecurityPasswords());
  const [visibleSecurityPasswords, setVisibleSecurityPasswords] = useState({});
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
  const [cashEntryForm, setCashEntryForm] = useState({ type: "Manuel Nakit Girişi", amount: "", note: "" });
  const [customBanks, setCustomBanks] = useState([]);
  const [bankMovements, setBankMovements] = useState([]);
  const [saleForm, setSaleForm] = useState({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  const bankOptions = useMemo(() => Array.from(new Set([...defaultBanks, ...customBanks])).filter(Boolean), [customBanks]);
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
  const safeCashMovements = Array.isArray(cashMovements) ? cashMovements : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const activeStock = safeStock.filter(isActiveRecord);
  const activeSales = safeSales.filter(isActiveRecord);
  const activeExpenses = safeExpenses.filter(isActiveRecord);
  const activeBankMovements = safeBankMovements.filter(isActiveMovement);
  const activeCashMovements = safeCashMovements.filter(isActiveMovement);
  const activeContacts = safeContacts.filter(isActiveRecord);
  const inStockItems = activeStock.filter((product) => Number(product.quantity || product.qty || 0) > 0);

  const supplierOptions = useMemo(() => {
    return Array.from(new Set([...suppliers, ...activeStock.map((product) => product.supplier).filter((supplier) => supplier && !isSellerLabel(supplier))])).sort();
  }, [suppliers, activeStock]);

  const isAccessorySale = saleForm.type === "Aksesuar Satışı";
  const isProgramSale = saleForm.type === "Program Satışı";
  const saleDeviceType = saleForm.type.replace(" Satışı", "");

  const saleProducts = isProgramSale ? [] : inStockItems
    .filter((product) => {
      if (isAccessorySale) return product.module === "Aksesuar";
      if (saleDeviceType === "Telefon") return product.module === "Cihaz" && product.deviceType === "Telefon";
      if (saleDeviceType === "Elektronik") return ["Elektronik", "PC"].includes(product.deviceType);
      return product.deviceType === saleDeviceType || product.deviceType === saleGroup;
    })
    .filter((product) => !saleForm.search || has(productTitle(product), saleForm.search) || has(product.barcode, saleForm.search))
    .filter((product) => Number(product.qty || 0) > 0);

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
  const saleTotal = parseMoneyInput(saleForm.total || selectedProduct?.sell || 0);
  const saleCash = parseMoneyInput(saleForm.cash || 0);
  const saleCard = parseMoneyInput(saleForm.card || 0);
  const saleRemaining = isAccessorySale ? 0 : Math.max(saleTotal - saleCash - saleCard, 0);

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
    let data = await loadDashboardData();
    let repairMessage = "";

    try {
      const repaired = await repairStockSideEffects(data.stock || [], data.cashMovements || [], data.contacts || []);
      if (repaired) {
        data = await loadDashboardData();
        repairMessage = "Eksik kasa/cari hareketleri stok kayıtlarından tamamlandı.";
      }
    } catch (error) {
      console.error(error);
      repairMessage = `Veriler yüklendi; eksik kasa/cari onarımı yapılamadı: ${error.message || "Supabase migration gerekebilir."}`;
    }

    setStock((data.stock || []).map(fromDbStock));
    setSales((data.sales || []).map(fromDbSale));
    setExpenses((data.expenses || []).map(fromDbExpense));
    setBankMovements((data.bankMovements || []).map(fromDbBankMovement));
    setCashMovements((data.cashMovements || []).map(fromDbCashMovement));
    setContacts((data.contacts || []).map(fromDbContact));
    setActiveWorkspaceId(data.workspaceId || data.profile?.workspace_id || "");
    setDbReady(true);
    setSyncMessage(repairMessage || "Veriler Supabase ile senkronize.");
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
    const refund = 0;
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
    (bankMovementType(item) === "Düzeltme" && bankMovementDirection(item) === "out") ||
    (isPurchaseCancellationMovement(item, bankMovementType(item)) && bankMovementDirection(item) === "out") ||
    (isTechnicalServiceRefundMovement(bankMovementType(item)) && bankMovementDirection(item) === "out");

  const bankReport = {
    totalToBank: activeBankMovements.filter(isBankIncomingMovement).reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
    withdrawnFromBank: activeBankMovements.filter(isBankOutgoingMovement).reduce((sum, item) => sum + parseMoneyInput(item.amount), 0),
  };
  bankReport.remainingInBank = Math.max(bankReport.totalToBank - bankReport.withdrawnFromBank, 0);

  const bankAccountRows = bankOptions.map((bank) => {
    const totalToBank = activeBankMovements
      .filter((item) => isBankIncomingMovement(item) && item.bank === bank)
      .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
    const withdrawnFromBank = activeBankMovements
      .filter((item) => isBankOutgoingMovement(item) && item.bank === bank)
      .reduce((sum, item) => sum + parseMoneyInput(item.amount), 0);
    return {
      bank,
      totalToBank,
      withdrawnFromBank,
      remaining: Math.max(totalToBank - withdrawnFromBank, 0),
      commission: (Math.max(totalToBank - withdrawnFromBank, 0) / 100) * 3.5,
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

  function normalizeDailyCashReportRows(selectedDate) {
    const rows = [];
    const saleIds = new Set(safeSales.map((sale) => String(sale.id)));

    safeSales.filter((sale) => isSameReportDay(sale, selectedDate)).forEach((sale) => {
      const inactive = !isActiveRecord(sale);
      const paymentDistribution = normalizeSalePaymentDistributionForReport(sale);
      const total = paymentDistribution.total;
      const cash = paymentDistribution.cash;
      const card = paymentDistribution.card;
      const remaining = paymentDistribution.debt;
      rows.push({
        date: reportDateValue(sale),
        tone: inactive ? "cancel" : "sale",
        type: inactive ? "İptal" : "Satış",
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
      if (relatedSaleDuplicate) return;
      const amount = Math.abs(cashMovementAmount(item));
      const direction = movementDirection(item, type);
      const inactive = !isActiveMovement(item);
      const classification = classifyFinancialMovement(item);
      const reportType = inactive ? { label: "İptal", tone: "cancel" } : dailyReportRowType(item);
      const signedCash = inactive ? 0 : getCashNetEffect(item);
      rows.push({
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
      const relatedSaleDuplicate = String(item.relatedTable || item.related_table || "") === "sales" && saleIds.has(String(item.relatedId || item.related_id || ""));
      if (relatedSaleDuplicate) return;
      const amount = Math.abs(bankMovementAmount(item));
      const direction = bankMovementDirection(item);
      const inactive = !isActiveMovement(item);
      const classification = classifyFinancialMovement(item);
      const reportType = inactive ? { label: "İptal", tone: "cancel" } : dailyReportRowType(item);
      const signedBank = direction === "out" ? -amount : amount;
      rows.push({
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

  const dailyCashReportRows = normalizeDailyCashReportRows(dailyReportDate);
  const dailyCashReportTotals = dailyCashReportRows.reduce((totals, row) => ({
    buy: totals.buy + Number(row.buy || 0),
    sale: totals.sale + Number(row.sale || 0),
    cash: totals.cash + Number(row.cash || 0),
    bank: totals.bank + Number(row.bank || 0),
    debt: totals.debt + Number(row.debt || 0),
    refund: totals.refund + Number(row.refund || 0),
    netCash: totals.netCash + Number(row.cash || 0),
  }), { buy: 0, sale: 0, cash: 0, bank: 0, debt: 0, refund: 0, netCash: 0 });

  const cashWithBankIncoming = financeSummary.expectedCash;
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

  const sortedSales = sortSalesForList(activeSales);
  const sortedFilteredSales = sortSalesForList(filteredSales);
  const combinedSalesListRows = [
    ...sortedSales.map((sale) => ({ kind: "sale", date: sale.date, sale })),
    ...technicalServiceMovements.map((movement) => {
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
    const clean = name.trim();
    if (!clean) return;
    alert(`${clean} banka ekleme isteği alındı. Kalıcı banka listesi için Yönetim > Banka Ayarları bölümünde Supabase kaydı yapılacak. Şimdilik ana bankalar: Ziraatbank, İşbank, Halkbank.`);
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
    if (!product?.id) return alert("Düzenlenecek stok kaydı bulunamadı.");
    if (!requireSecurityPassword("edit", "Stok düzenleme")) return;
    setEditingStock({ ...product });
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
    const title = productTitle(product) || "Stok kaydı";
    const movementType = product?.module === "Cihaz" ? "Cihaz Alış İptali" : "Stok Alış İptali";
    const note = `Stok alış iptali - ${title}`;
    let createdCount = 0;

    for (const movement of links.linkedBankPurchases) {
      const amount = bankMovementAmount(movement);
      if (!amount) continue;
      const originalDirection = bankMovementDirection(movement);
      await createBankMovement({
        movement_type: movementType,
        direction: originalDirection === "out" ? "in" : "out",
        bank_name: movement.bank || movement.bank_name || "",
        amount,
        related_table: "stock_items",
        related_id: product.id,
        note,
      });
      createdCount += 1;
    }

    for (const movement of links.linkedCashPurchases) {
      const amount = cashMovementAmount(movement);
      if (!amount) continue;
      const originalDirection = movement.direction || "out";
      await createCashMovement({
        movement_type: movementType,
        direction: originalDirection === "out" ? "in" : "out",
        amount,
        related_table: "stock_items",
        related_id: product.id,
        note,
      });
      createdCount += 1;
    }

    return createdCount;
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
    const product = activeStock.find((item) => String(item.id) === String(id)) || stock.find((item) => String(item.id) === String(id));
    if (!product) return alert("Silinecek stok kaydı bulunamadı.");
    if (!requireSecurityPassword("delete", "Stok kaydı silme")) return;

    const links = analyzeStockDeleteLinks(product);
    if (links.linkedSales.length) {
      alert("Bu cihaz satış kaydına bağlı olduğu için stoktan doğrudan silinemez. Önce Kasa > Satış Listesi bölümünden satış iptal/iade işlemi yapılmalıdır.");
      return;
    }

    try {
      let deleteMode = "stockOnly";
      if (links.hasFinancialLink) {
        const choiceText = links.hasCancellablePurchaseLink
          ? "Bu stok kaydı alış/kasa hareketine bağlı.\n\nBu cihazı/ürünü stoktan kaldırırken kasa/banka etkisini değiştirmek isteyip istemediğinizi seçin.\n\n1 - Sadece stoktan kaldır\n2 - Alış/kasa etkisini iptal ederek kaldır\n3 - Vazgeç"
          : "Bu stok kaydı başka kayıtlara bağlı görünüyor ancak açık alış/kasa ödeme bağlantısı bulunamadı.\n\n1 - Sadece stoktan kaldır\n3 - Vazgeç";
        const choice = window.prompt(choiceText);
        if (choice === null || choice.trim() === "" || choice.trim() === "3") return;
        if (!["1", "2"].includes(choice.trim()) || choice.trim() === "2" && !links.hasCancellablePurchaseLink) {
          alert("Geçerli bir seçim yapılmadı. İşlem iptal edildi.");
          return;
        }

        if (choice.trim() === "2") {
          try {
            const createdCount = await createStockPurchaseCancellationMovements(product, links);
            deleteMode = createdCount > 0 ? "purchaseCancelled" : "stockOnly";
          } catch (error) {
            console.error("Stok alış iptali ters hareket hatası", error);
            const message = String(error?.message || error || "");
            if (message.includes("movement_type") || message.includes("violates check constraint")) {
              alert("Stok alış iptali hareket tipi Supabase'de eksik. supabase/stock_purchase_cancel_movement_type_20260526.sql dosyasını SQL Editor'da çalıştırın.");
            } else {
              alert(`Stok alış iptali için ters kasa/banka hareketi oluşturulamadı: ${error.message || error}`);
            }
            await refreshFromDatabase();
            return;
          }
        }
      }

      await softDelete("stock_items", id);
      await refreshFromDatabase();
      const message = deleteMode === "purchaseCancelled"
        ? "Stok kaydı kaldırıldı ve kasa/banka etkisi ters hareketle düzeltildi."
        : links.hasUntrustedFinanceHint
          ? "Bu kayıtla ilgili finansal bağlantı kesin olarak bulunamadı. Kasa/banka hareketi değiştirilmedi."
          : "Cihaz stoktan kaldırıldı. Kasa/banka hareketleri değiştirilmedi.";
      setSyncMessage(message);
      alert(message);
    } catch (error) {
      alert(error.message || "Stok silinemedi.");
    }
  }

  function deleteSupplierDebt(supplierName) {
    if (!requireSecurityPassword("delete", "Tedarikçi/Firma kaydı silme")) return;
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
    if (!requireSecurityPassword("delete", "Gider kaydı silme")) return;
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

  async function saveCashEntry() {
    const amount = parseMoneyInput(cashEntryForm.amount);
    const note = cashEntryForm.note.trim();
    if (!amount) return alert("Nakit giriş tutarını yaz");
    if (!note) return alert("Nakit nerden geldi? Not alanını yaz");

    try {
      await createCashMovement({
        movement_type: cashEntryForm.type,
        direction: "in",
        amount,
        note,
      });
      await refreshFromDatabase();
      setSyncMessage(`${cashEntryForm.type} Supabase'e kaydedildi.`);
    } catch (error) {
      alert(error.message || "Nakit girişi Supabase'e yazılamadı.");
      return;
    }

    setCashEntryForm({ type: "Manuel Nakit Girişi", amount: "", note: "" });
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

    const ok = window.confirm("Bu kasa hareketini iptal etmek istiyor musunuz? Orijinal kayıt silinmez; kasa etkisi ters hareketle geri alınır.");
    if (!ok) return;

    try {
      await createCashMovementCancellation({
        movement_type: movementType,
        direction: item.direction === "out" ? "in" : "out",
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
    if (!account?.name) return false;
    if (!amount) {
      alert("Ödeme tutarını yaz");
      return false;
    }

    try {
      await createContactPayment({
        kind: account.kind || "supplier",
        name: account.name,
        phone: account.phone || "",
        amount,
        currentBalance: Number(account.remaining || 0),
        notePrefix: "Cari ödeme",
      });
      await refreshFromDatabase();
      setSyncMessage(`${account.name} için cari ödeme kasadan çıkış olarak işlendi.`);
      return true;
    } catch (error) {
      alert(error.message || "Cari ödeme Supabase'e yazılamadı.");
      return false;
    }
  }

  async function saveReceivablePayment(sale, amountValue) {
    const amount = parseMoneyInput(amountValue);
    if (!sale?.id) return false;
    if (!amount) {
      alert("Tahsilat tutarını yaz");
      return false;
    }

    try {
      await createReceivablePayment({
        saleId: sale.id,
        customerName: sale.cariPerson || sale.customer,
        amount,
        currentRemaining: Number(sale.remaining || 0),
      });
      await refreshFromDatabase();
      setSyncMessage(`${sale.cariPerson || sale.customer || "Müşteri"} alacak tahsilatı kasaya giriş olarak işlendi.`);
      return true;
    } catch (error) {
      alert(error.message || "Alacak tahsilatı Supabase'e yazılamadı.");
      return false;
    }
  }

  function validateStock(module) {
    const isDevice = module === "Cihaz";
    const isSecondHandPhone = isSecondHandPhonePurchase(stockForm, module);
    if (!isSecondHandPhone && !stockForm.supplier.trim()) return "Tedarikçi firma seç";
    if (isSecondHandPhone && !stockForm.sellerPerson.trim()) return "Satanın adı soyadı yaz";
    if (isSecondHandPhone && !stockForm.sellerPhone.trim()) return "Satanın telefonu yaz";
    if (isSecondHandPhone && cleanPhone(stockForm.sellerPhone).length !== 11) return "Satanın telefonu 11 rakam olmalı";
    if (isSecondHandPhone && !stockForm.saleFormImageName) return "Satış formu resmi eklemeden kayıt yapılamaz";
    if (!stockForm.buy || !stockForm.sell) return "Kaça aldın ve kaça satacaksın alanlarını yaz";
    if (!isDevice && !stockForm.qty) return "Stok adedi yaz";
    const purchaseTotal = parseMoneyInput(stockForm.buy) * (isDevice ? 1 : Number(stockForm.qty || 0));
    const paidTotal = parseMoneyInput(stockForm.supplierPaid);
    if (paidTotal > purchaseTotal) return "Ödeme tutarı alış tutarını aşamaz.";
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

    try {
      await createStockItem({
        module: item.module,
        device_type: item.deviceType,
        category: item.module === "Cihaz" ? item.condition : item.category,
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
    }

    setStockForm({ ...emptyStockForm, module });
    setStockTab("liste");
  }

  async function saveSale() {
    if (!isProgramSale && !isAccessorySale && !selectedProduct) return alert("Ürün seç");
    if (!isProgramSale && selectedProduct && Number(selectedProduct.qty || 0) <= 0) return alert("Stok yok");
    if (isProgramSale && !saleForm.search.trim()) return alert("Ne programı olduğunu yaz");
    if (!isAccessorySale && !saleForm.customer.trim()) return alert("Müşteri adı soyadı / telefon yaz");
    if (!isAccessorySale && saleRemaining > 0 && !saleForm.cariPerson.trim()) return alert("Kalan varsa Cari Ekle zorunludur");
    if (saleCard > 0 && !saleForm.bank) return alert("Kart ödeme varsa banka seç");
    if (!saleTotal) return alert(isProgramSale ? "Ne kadar olduğunu yaz" : "Satış fiyatını yaz");
    if (saleCash + saleCard > saleTotal) return alert("Nakit + kart toplamı satış fiyatını aşamaz.");

    const sale = calcSale({
      id: Date.now(),
      type: saleForm.type,
      customer: isAccessorySale ? "" : saleForm.customer.trim(),
      cariPerson: isAccessorySale ? "" : (saleForm.cariPerson.trim() || saleForm.customer.trim()),
      bank: saleForm.bank,
      productName: isProgramSale ? saleForm.search.trim() : (selectedProduct ? productTitle(selectedProduct) : saleForm.search.trim()),
      productId: isProgramSale || !selectedProduct ? null : selectedProduct.id,
      productBuyPrice: isProgramSale || !selectedProduct ? 0 : selectedProduct.buy,
      productBarcode: isProgramSale || !selectedProduct ? "" : selectedProduct.barcode,
      total: saleForm.total || (isProgramSale || !selectedProduct ? "" : selectedProduct.sell),
      cash: saleForm.cash,
      card: saleForm.card,
      date: new Date().toISOString(),
    });

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
    }

    setSaleForm({ type: "Telefon Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
  }

  async function updateSale() {
    const fixed = calcSale(editingSale);
    const editTotal = parseMoneyInput(fixed.total);
    const editCash = parseMoneyInput(fixed.cash);
    const editCard = parseMoneyInput(fixed.card);
    if (editCash + editCard > editTotal) {
      alert("Nakit + kart toplamı satış fiyatını aşamaz.");
      return;
    }
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
    const fixed = {
      ...editingStock,
      barcode: cleanBarcode(editingStock.barcode),
      buy: formatMoneyInput(editingStock.buy),
      sell: formatMoneyInput(editingStock.sell),
      supplierPaid: formatMoneyInput(editingStock.supplierPaid),
    };
    const purchaseTotal = parseMoneyInput(fixed.buy) * Number(fixed.qty || 1);
    const paidTotal = parseMoneyInput(fixed.supplierPaid);
    if (paidTotal > purchaseTotal) {
      alert("Ödeme tutarı alış tutarını aşamaz.");
      return;
    }
    try {
      await updateStockItem(fixed.id, {
        module: fixed.module,
        device_type: fixed.deviceType,
        category: fixed.module === "Cihaz" ? fixed.condition : fixed.category,
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
      bank: "",
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
    if (totalDeposit > totalAmount) return alert("Alınan kaparo/ödeme toplam servis tutarından fazla olamaz.");
    if (cardDeposit > 0 && !technicalServiceForm.bank) return alert("Kart/banka kaparosu için banka seçmek zorunludur.");

    const serviceId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const movementNote = `${customerName} - ${device} - ${issue}`.slice(0, 180);

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

    let cashMovementSaved = false;
    try {
      if (cashDeposit > 0) {
        await createCashMovement({
          movement_type: "Teknik Servis Kaparo",
          direction: "in",
          amount: cashDeposit,
          related_table: "technical_services",
          related_id: serviceId,
          related_service_id: serviceId,
          service_record_id: serviceId,
          reference_id: serviceId,
          note: movementNote,
        });
        cashMovementSaved = true;
      }

      if (cardDeposit > 0) {
        await createBankMovement({
          movement_type: "Teknik Servis Kaparo",
          direction: "in",
          bank_name: technicalServiceForm.bank,
          amount: cardDeposit,
          related_table: "technical_services",
          related_id: serviceId,
          related_service_id: serviceId,
          service_record_id: serviceId,
          reference_id: serviceId,
          note: movementNote,
        });
      }
    } catch (error) {
      console.error("Teknik servis kayıt finans hareketi hatası", error);
      if (cashMovementSaved && cardDeposit > 0) {
        setTechnicalServices([record, ...technicalServices]);
        setTechnicalServiceForm(makeEmptyTechnicalServiceForm());
        setSelectedTechnicalServiceId(serviceId);
        setTechnicalServiceMode("detail");
        setTechnicalServiceFormModalOpen(false);
        await refreshFromDatabase();
        const message = error.message || "Banka/kart hareketi kaydedilemedi.";
        alert(`Yarım işlem uyarısı: Nakit hareket kasaya kaydedildi ancak banka/kart hareketi kaydedilemedi. Hata: ${message}`);
        setSyncMessage("Yarım işlem: Nakit kaparo kaydedildi, banka/kart kaparosu kaydedilemedi.");
        return;
      }
      alert(error.message || "Teknik servis finansal hareketi kaydedilemedi. Supabase migration gerekebilir.");
      return;
    }

    setTechnicalServices([record, ...technicalServices]);
    setTechnicalServiceForm(makeEmptyTechnicalServiceForm());
    setSelectedTechnicalServiceId(serviceId);
    setTechnicalServiceMode("detail");
    setTechnicalServiceFormModalOpen(false);
    await refreshFromDatabase();
    setSyncMessage("Teknik servis kaydı açıldı; kaparo/ödeme kasa veya banka hareketlerine işlendi.");
  }

  function updateTechnicalServiceStatus(id, status) {
    const actionType = status === "İptal" ? "cancel" : "edit";
    const actionLabel = status === "İptal" ? "Teknik servis iptali" : "Teknik servis durum düzenleme";
    if (!requireSecurityPassword(actionType, actionLabel)) return;
    setTechnicalServices(technicalServices.map((item) => (
      item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
    )));
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
    if (!isRefund && amount > summary.remaining) return alert("Ödeme kalan servis tutarından fazla olamaz.");
    if (method === "Kart/Banka" && !form.bank) return alert("Banka seçmek zorunludur.");
    if (isRefund) {
      if (!requireSecurityPassword("cancel", "Teknik servis iadesi")) return;
      const source = method === "Kart/Banka"
        ? summary.refundSources.find((item) => item.method === "Kart/Banka" && item.bank === form.bank)
        : summary.refundSources.find((item) => item.key === "cash");
      const available = source?.available || 0;

      if (amount > summary.net) return alert("İade tutarı bu servis için tahsil edilen toplamdan fazla olamaz.");
      if (!available) return alert("Bu kaynakta iade edilebilir tutar yok.");
      if (amount > available) return alert(`Bu kaynaktan en fazla ${money(available)} iade yapılabilir.`);
    }

    const movementType = isRefund ? "Teknik Servis İade" : "Teknik Servis Tahsilat";
    const direction = isRefund ? "out" : "in";
    const note = (form.note || `${isRefund ? "Teknik servis iade" : "Teknik servis tahsilat"} - ${service.customerName || "Müşteri"} - ${service.device || "Cihaz"}`).slice(0, 180);

    try {
      if (method === "Kart/Banka") {
        await createBankMovement({
          movement_type: movementType,
          direction,
          bank_name: form.bank,
          amount,
          related_table: "technical_services",
          related_id: service.id,
          related_service_id: service.id,
          service_record_id: service.id,
          reference_id: service.id,
          note,
        });
      } else {
        await createCashMovement({
          movement_type: movementType,
          direction,
          amount,
          related_table: "technical_services",
          related_id: service.id,
          related_service_id: service.id,
          service_record_id: service.id,
          reference_id: service.id,
          note,
        });
      }

      setTechnicalServices(technicalServices.map((item) => (
        String(item.id) === String(service.id) ? { ...item, updatedAt: new Date().toISOString() } : item
      )));
      if (isRefund) setTechnicalRefundForm(emptyTechnicalPaymentForm);
      else setTechnicalPaymentForm(emptyTechnicalPaymentForm);
      await refreshFromDatabase();
      setSyncMessage(isRefund ? "Teknik servis iadesi kaydedildi." : "Teknik servis ödemesi kaydedildi.");
    } catch (error) {
      alert(error.message || "Teknik servis ödeme/iade hareketi kaydedilemedi. Supabase migration gerekebilir.");
    }
  }

  function renderTechnicalServiceForm() {
    return (
      <div className="technical-service-form-shell">
        <div className="technical-detail-header">
          <div>
            <h3>YENİ SERVİS KAYDI</h3>
          </div>
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
  }, [accessoryShortcutStorageKey]);

  useEffect(() => {
    if (!accessoryShortcutStorageKey) return;
    localStorage.setItem(`ceplog_accessory_shortcuts_${accessoryShortcutStorageKey}`, JSON.stringify(accessoryShortcuts.slice(0, accessoryShortcutLimit)));
  }, [accessoryShortcuts, accessoryShortcutStorageKey]);

  useEffect(() => {
    if (!technicalServiceStorageKey) return;
    const saved = localStorage.getItem(`ceplog_technical_services_${technicalServiceStorageKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTechnicalServices(Array.isArray(parsed) ? parsed : []);
      } catch {
        setTechnicalServices([]);
      }
    } else {
      setTechnicalServices([]);
    }
    setTechnicalServiceStorageReadyKey(technicalServiceStorageKey);
  }, [technicalServiceStorageKey]);

  useEffect(() => {
    if (!technicalServiceStorageKey || technicalServiceStorageReadyKey !== technicalServiceStorageKey) return;
    localStorage.setItem(`ceplog_technical_services_${technicalServiceStorageKey}`, JSON.stringify(technicalServices.slice(0, 1000)));
  }, [technicalServices, technicalServiceStorageKey, technicalServiceStorageReadyKey]);

  function addAccessoryShortcut() {
    const group = accessoryShortcutForm.group || "Kılıf";
    const subOptions = quickAccessoryGroups[group] || [group];
    const sub = accessoryShortcutForm.sub || subOptions[0] || group;
    const price = accessoryShortcutForm.price ? formatMoneyInput(accessoryShortcutForm.price) : "";

    if (!group) return alert("Grup seç");
    if (!sub) return alert("Alt seçenek seç");
    if (accessoryShortcuts.length >= accessoryShortcutLimit) return alert("En fazla 30 kısayol eklenebilir.");

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

  function deleteAccessoryShortcut(id) {
    setAccessoryShortcuts(accessoryShortcuts.filter((item) => item.id !== id));
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

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchModalOpen && !technicalSearchModalOpen && !technicalServiceDetailModalOpen && !technicalServiceFormModalOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setSearchModalOpen(false);
      setTechnicalSearchModalOpen(false);
      setTechnicalServiceDetailModalOpen(false);
      setTechnicalServiceFormModalOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchModalOpen, technicalSearchModalOpen, technicalServiceDetailModalOpen, technicalServiceFormModalOpen]);

  if (!authChecked) {
    return <div className="app"><section className="card"><h2>CEPLOG yükleniyor...</h2></section></div>;
  }

  if (!currentUser) {
    return <Login onLogin={checkAuthAndLoad} />;
  }

  return (
    <div className="app">
      <div className="shell">
        <header className="hero">
          <div>
            <div className="brand-title-row">
              <div className="brand-center">
                <div className="brand-main-line">
                  <h1><span>CEP</span><span className="brand-log">LOG</span></h1>
                  <span className="since-badge">Since 1999</span>
                  <div className="live-clock">
                    {clockNow.toLocaleDateString("tr-TR")} • {clockNow.toLocaleTimeString("tr-TR", { hour12: false })}
                  </div>
                </div>
                <p>26 Yıllık Tecrübeyle Yapılan Profesyonel GSM Satış Teknik Servis Takip Sistemi</p>
              </div>
            </div>
        {syncMessage && (
          <div className="sync-message">
            <span>{syncMessage}</span>
            <button type="button" onClick={() => setSyncMessage("")} aria-label="Mesajı kapat">×</button>
          </div>
        )}
          </div>
          <div className="status-pill">WEB TEST</div>
        </header>

        <nav className="nav-grid">
          <button
            className={active === "kasa" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActive("kasa")}
          >
            <Wallet size={22} />
            <span>KASA</span>
          </button>

          <button
            className={active === "cihaz" && stockForm.deviceType === "Telefon" ? "nav-btn active" : "nav-btn"}
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
            className={active === "aksesuar" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActive("aksesuar")}
          >
            <Headphones size={22} />
            <span>AKSESUAR</span>
          </button>

          <button
            className={active === "digerler" ? "nav-btn active" : "nav-btn"}
            onClick={() => {
              const group = otherProductGroups.includes(stockForm.deviceType) && stockForm.deviceType !== "Telefon" ? stockForm.deviceType : "Saat";
              setOtherGroupName(group);
              setStockForm({ ...stockForm, module: "Diğer", deviceType: group, condition: "Sıfır Garantili", brand: "", model: "", memory: "", name: stockForm.name || "" });
              setActive("digerler");
            }}
          >
            <Package size={22} />
            <span>DİĞERLERİ</span>
          </button>

          <button
            className={searchModalOpen ? "nav-btn active" : "nav-btn"}
            onClick={() => setSearchModalOpen(true)}
          >
            <Search size={22} />
            <span>SORGULA</span>
          </button>

          <button
            className={active === "stok" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActive("stok")}
          >
            <Package size={22} />
            <span>STOK</span>
          </button>

          <button
            className={active === "tamir" ? "nav-btn active" : "nav-btn"}
            onClick={() => setActive("tamir")}
          >
            <Wrench size={22} />
            <span>TEKNİK</span>
          </button>

          <button
            className={active === "vole" ? "nav-btn active" : "nav-btn"}
            onClick={openKaraDefter}
          >
            <TrendingUp size={22} />
            <span>KARA DEFTER</span>
          </button>

          <button
            className={active === "yonetim" ? "nav-btn nav-mini-y active" : "nav-btn nav-mini-y"}
            onClick={() => setActive("yonetim")}
            title="Yönetim"
          >
            <span>Y</span>
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
                  {stockSearchFilters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={stockSearchFilter === filter ? "choice active" : "choice"}
                      onClick={() => setStockSearchFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {!stockSearchResults.length ? (
                  <div className="empty-search-note">Sonuç bulunamadı.</div>
                ) : (
                  <div className="search-results-table">
                    {stockSearchResults.map((product) => {
                      const group = stockSearchGroup(product);
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
                            <span className="stock-status-badge">{group}</span>
                          </div>

                          <div className="search-result-grid">
                            <div><span>Kategori</span><b>{product.category || product.condition || "-"}</b></div>
                            <div><span>Grup</span><b>{group}</b></div>
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

        {active === "yonetim" && (
          <section className="section management-section">
            <div className="management-hero card">
              <div>
                <h2>Yönetim Paneli</h2>
                <p>Program sahibi, lisans, güvenlik, kullanıcı yetkileri, yedekleme ve log işlemleri buradan yönetilir.</p>
              </div>
              <div className="management-badge">
                <span>CEPLOG PRO</span>
                <b>Since 1999</b>
              </div>
            </div>

            <div className="management-grid">
              <div className="card management-card">
                <h2>Firma / Lisans Özeti</h2>
                <div className="management-info-list">
                  <div><span>Program</span><b>CEPLOG</b></div>
                  <div><span>Lisans Sahibi</span><b>{currentUser?.email || "Kayıtlı Kullanıcı"}</b></div>
                  <div><span>Aktif Workspace</span><b>{activeWorkspaceId || "-"}</b></div>
                  <div><span>Paket</span><b>Professional</b></div>
                  <div><span>Durum</span><b>Aktif</b></div>
                  <div><span>Son Yedek</span><b>Manuel Kontrol</b></div>
                </div>
                <div className="logout-panel">
                  <span>Giriş yapan kullanıcı: <b>{currentUser?.email || "Kayıtlı Kullanıcı"}</b></span>
                  <button className="logout-btn" type="button" onClick={handleLogout}>ÇIKIŞ YAP</button>
                </div>
              </div>

              <div className="card management-card security-password-card">
                <h2>GÜVENLİK ŞİFRELERİ</h2>
                <p>Düzenleme, iptal ve silme işlemleri için ayrı güvenlik şifreleri belirleyin.</p>

                <div className="security-password-list">
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

              <div className="card management-card">
                <h2>Yedekleme Merkezi</h2>
                <p>Stok, satış, kasa, banka, cari, gider ve aksesuar kısayolları tek JSON dosyası olarak yedeklenir.</p>

                <div className="backup-actions">
                  <button className="primary backup-btn" type="button" onClick={downloadBackupFile}>
                    <Save size={18} /> Cihaza / PC’ye Yedek İndir
                  </button>

                  <button className="primary backup-btn drive-btn" type="button" onClick={shareBackupFile}>
                    <ShieldCheck size={18} /> Google Drive / Paylaş
                  </button>

                  <button className="primary backup-btn mail-btn" type="button" onClick={prepareEmailBackup}>
                    <ReceiptText size={18} /> Mail İçin Yedek Hazırla
                  </button>
                </div>

                <div className="backup-warning">
                  <b>Not:</b> Google Drive’a doğrudan otomatik yükleme için ileride Google Drive API bağlantısı gerekir. Bu sürümde dosya indirilir veya cihazın paylaşım menüsü açılır.
                </div>
              </div>
            </div>

            <div className="card management-card">
              <h2>Yedek Önizleme</h2>
              <div className="backup-preview-grid">
                <Stat title="Stok Kaydı" value={activeStock.length} />
                <Stat title="Satış Kaydı" value={activeSales.length} />
                <Stat title="Cari Kayıt" value={activeContacts.length} />
                <Stat title="Kasa Hareketi" value={activeCashMovements.length} />
                <Stat title="Banka Hareketi" value={activeBankMovements.length} />
                <Stat title="Gider Kaydı" value={activeExpenses.length} />
              </div>
            </div>

            <div className="card management-card">
              <h2>Sonraki Yönetim Modülleri</h2>
              <div className="management-roadmap">
                <div><b>Güvenlik</b><span>Kritik işlem şifresi değiştirme</span></div>
                <div><b>Kullanıcılar</b><span>Owner / Yönetici / Personel rolleri</span></div>
                <div><b>Yetkiler</b><span>Satış silme, kâr görme, kasa kapatma izinleri</span></div>
                <div><b>Loglar</b><span>Kim hangi işlemi yaptı takibi</span></div>
                <div><b>Drive API</b><span>Gerçek otomatik Google Drive yedekleme</span></div>
              </div>
            </div>
          </section>
        )}

        {active === "kasa" && (
          <section className="section">
            <div className="kasa-subtabs">
              <button className={kasaTab === "yeniSatis" ? "choice active" : "choice"} onClick={() => setKasaTab("yeniSatis")}>YENİ SATIŞ</button>
              <button className={kasaTab === "satisListesi" ? "choice active" : "choice"} onClick={() => setKasaTab("satisListesi")}>SATIŞ LİSTESİ</button>
              <button className={kasaTab === "giderler" ? "choice active" : "choice"} onClick={() => setKasaTab("giderler")}>GİDERLER</button>
              <button className={kasaTab === "nakitGirisi" ? "choice active" : "choice"} onClick={() => setKasaTab("nakitGirisi")}>NAKİT GİRİŞİ</button>
              <button className={kasaTab === "kapanis" ? "choice active" : "choice"} onClick={() => setKasaTab("kapanis")}>KASA KAPANIŞ</button>
              <button className={kasaTab === "bankadanNakit" ? "choice active" : "choice"} onClick={() => setKasaTab("bankadanNakit")}>BANKADAN NAKİT GELEN</button>
              <div className={cashWithBankIncoming < 0 ? "kasa-cash-total negative" : "kasa-cash-total"}>
                <span>TOPLAM KASANDA OLMASI GEREKEN</span>
                <b>{money(cashWithBankIncoming)}</b>
              </div>
            </div>

            {kasaTab === "yeniSatis" && (
              <>
                <div className="compact-summary-grid">
                  {compactKasaSummaryCards.map((card) => (
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
                  ))}
                </div>

                <div className="grid sale-layout">
                  <div className="card large-sales-panel">
                    <h2 className="large-sales-title">YENİ SATIŞ</h2>
                    <div className="big-sale-grid">
                      {mainSaleGroups.map((group) => (
                        <button
                          key={group}
                          className={saleGroup === group ? "big-sale-btn large-sales-button active" : "big-sale-btn large-sales-button"}
                          onClick={() => {
                            setSaleGroup(group);
                            setSaleForm({
                              ...saleForm,
                              type:
                                group === "Telefon" ? "Telefon Satışı" :
                                group === "Aksesuar" ? "Aksesuar Satışı" :
                                group === "Teknik" ? "Teknik Servis" :
                                group === "PC" ? "PC Satışı" :
                                group === "Program" ? "Program Satışı" :
                                group === "Saat" ? "Saat Satışı" :
                                group === "Tablet" ? "Tablet Satışı" :
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

                    {saleGroup === "Elektronik" && (
                      <div className="electronics-sub-tabs">
                        <button
                          type="button"
                          className={saleForm.type === "PC Satışı" ? "choice active" : "choice"}
                          onClick={() => setSaleForm({ ...saleForm, type: "PC Satışı", productId: "", search: "", total: "", cash: "", card: "" })}
                        >
                          PC
                        </button>
                        <button
                          type="button"
                          className={saleForm.type === "Elektronik Satışı" ? "choice active" : "choice"}
                          onClick={() => setSaleForm({ ...saleForm, type: "Elektronik Satışı", productId: "", search: "", total: "", cash: "", card: "" })}
                        >
                          Diğer Elektronik
                        </button>
                      </div>
                    )}



                    {!isAccessorySale && (
                      <input
                        placeholder="Müşteri adı soyadı / telefon 0 (5xx) xxx xx xx"
                        value={saleForm.customer}
                        onChange={(e) => {
                          const customerName = e.target.value;
                          setSaleForm({
                            ...saleForm,
                            customer: customerName,
                            cariPerson: customerName,
                          });
                        }}
                      />
                    )}

                    {isProgramSale ? (
                      <input
                        placeholder="Ne Programı"
                        value={saleForm.search}
                        onChange={(e) => setSaleForm({ ...saleForm, search: e.target.value })}
                      />
                    ) : (
                      <>
                        <input placeholder={isAccessorySale ? "Barkod veya ürün adı" : "Barkod / IMEI veya model"} value={saleForm.search} onChange={(e) => setSaleForm({ ...saleForm, search: e.target.value })} />

                        <select value={saleForm.productId} onChange={(e) => {
                          const product = stock.find((item) => String(item.id) === e.target.value);
                          setSaleForm({
                            ...saleForm,
                            productId: e.target.value,
                            search: product?.barcode || product?.imei || "",
                            total: product?.sell || "",
                            cash: product?.sell || "",
                            card: ""
                          });
                        }}>
                          <option value="">Ürün seç</option>
                          {saleProducts.map((product) => (
                            <option key={product.id} value={product.id}>{productTitle(product)} | IMEI: {getLastSixBarcode(product)}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <input type="text" inputMode="numeric" placeholder={isProgramSale ? "Ne Kadar" : "Satış fiyatı"} value={saleForm.total} onFocus={() => setSaleForm({ ...saleForm, total: stripMoneyForEdit(saleForm.total) })} onChange={(e) => setSaleForm({ ...saleForm, total: cleanMoneyTyping(e.target.value) })} onBlur={() => setSaleForm({ ...saleForm, total: formatMoneyInput(saleForm.total) })} />
                    <input type="text" inputMode="numeric" placeholder={isProgramSale ? "Nakit Ödenen" : "Nakit"} value={saleForm.cash} onFocus={() => setSaleForm({ ...saleForm, cash: stripMoneyForEdit(saleForm.cash) })} onChange={(e) => setSaleForm({ ...saleForm, cash: cleanMoneyTyping(e.target.value) })} onBlur={() => setSaleForm({ ...saleForm, cash: formatMoneyInput(saleForm.cash) })} />

                    <div className="two">
                      <input type="text" inputMode="numeric" placeholder={isProgramSale ? "Kartla Ödenen" : "Kart"} value={saleForm.card} onFocus={() => setSaleForm({ ...saleForm, card: stripMoneyForEdit(saleForm.card) })} onChange={(e) => setSaleForm({ ...saleForm, card: cleanMoneyTyping(e.target.value) })} onBlur={() => setSaleForm({ ...saleForm, card: formatMoneyInput(saleForm.card) })} />
                      <div className="remaining-box"><span>Kalan</span><b>{money(saleRemaining)}</b></div>
                    </div>

                    <select value={saleForm.bank} onChange={(e) => handleBankSelect(e.target.value, (bank) => setSaleForm({ ...saleForm, bank }))}>
                      <option value="">Banka seç</option>
                      {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                      <option value="__add_bank__">+ Banka Ekle</option>
                    </select>

                    {!isAccessorySale && saleRemaining > 0 && (
                      <div className="warning">
                        <b>{isProgramSale ? "Cari Ekle" : "Kalan cari kişi"}</b>
                        <input list="cari-list" placeholder={isProgramSale ? "Cari Ekle - müşteri adı" : "Cari kişi seç veya yaz"} value={saleForm.cariPerson} onChange={(e) => setSaleForm({ ...saleForm, cariPerson: e.target.value })} />
                        <datalist id="cari-list">
                          {alacaklarim.map((sale) => <option key={sale.id} value={sale.cariPerson || sale.customer} />)}
                        </datalist>
                      </div>
                    )}

                    <button className="primary" onClick={saveSale}><Plus size={16} /> SATIŞI KAYDET</button>
                  </div>

                  <div className="card large-accessory-panel">
                    <h2 className="large-accessory-title">AKSESUAR HIZLI SATIŞ</h2>
                    <p>Önce grup seç, sonra alt seçeneği seç, istersen fiyat yaz ve kısayol ekle. En fazla 30 kısayol eklenir.</p>

                    <div className="shortcut-limit-info">
                      EKLENEN KISAYOL: <b>{accessoryShortcuts.length} / {accessoryShortcutLimit}</b>
                    </div>

                    <div className="accessory-user-shortcuts compact-shortcuts">
                      {accessoryShortcuts.map((shortcut) => (
                        <div key={shortcut.id} className={saleForm.type === "Aksesuar Satışı" && saleForm.search === shortcut.label ? "shortcut-chip active" : "shortcut-chip"}>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAccessoryGroup(shortcut.group);
                              setQuickAccessorySubType(shortcut.sub || shortcut.group);
                              setAccessoryShortcutForm({ group: shortcut.group, sub: shortcut.sub || shortcut.group, price: shortcut.price || "" });
                              setSaleGroup("Aksesuar");
                              setSaleForm({
                                ...saleForm,
                                type: "Aksesuar Satışı",
                                productId: "",
                                search: shortcut.label,
                                total: shortcut.price || "",
                                cash: shortcut.price || "",
                                card: "",
                              });
                            }}
                          >
                            <span>{shortcut.label}</span>
                            {shortcut.price && <small>{shortcut.price}</small>}
                          </button>
                          <button className="shortcut-delete" type="button" onClick={() => deleteAccessoryShortcut(shortcut.id)}>SİL</button>
                        </div>
                      ))}

                      {!accessoryShortcuts.length && (
                        <div className="empty-shortcut-note">Henüz kısayol eklenmedi. Grup ve alt seçenek seçip Kısayol Ekle dediğinde burada kalır.</div>
                      )}
                    </div>

                    <div className="accessory-shortcut-price-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Varsayılan fiyat"
                        value={accessoryShortcutForm.price}
                        onFocus={() => setAccessoryShortcutForm({ ...accessoryShortcutForm, price: stripMoneyForEdit(accessoryShortcutForm.price) })}
                        onChange={(e) => {
                          const price = cleanMoneyTyping(e.target.value);
                          setAccessoryShortcutForm({ ...accessoryShortcutForm, price });
                          if (saleForm.type === "Aksesuar Satışı" && saleForm.search === `${accessoryShortcutForm.group} - ${accessoryShortcutForm.sub}`) {
                            setSaleForm({ ...saleForm, total: price, cash: price });
                          }
                        }}
                        onBlur={() => {
                          const price = formatMoneyInput(accessoryShortcutForm.price);
                          setAccessoryShortcutForm({ ...accessoryShortcutForm, price });
                          if (saleForm.type === "Aksesuar Satışı" && saleForm.search === `${accessoryShortcutForm.group} - ${accessoryShortcutForm.sub}`) {
                            setSaleForm({ ...saleForm, total: price, cash: price });
                          }
                        }}
                      />

                      <button className="primary" type="button" onClick={addAccessoryShortcut}>
                        <Plus size={16} /> KISAYOL EKLE
                      </button>
                    </div>

                    <h3>GRUP SEÇ</h3>
                    <div className="accessory-select-tabs">
                      {Object.keys(quickAccessoryGroups).map((group) => (
                        <button
                          key={group}
                          type="button"
                          className={accessoryShortcutForm.group === group ? "choice active" : "choice"}
                          onClick={() => {
                            const firstSub = quickAccessoryGroups[group]?.[0] || group;
                            setAccessoryShortcutForm({ ...accessoryShortcutForm, group, sub: firstSub });
                            setQuickAccessoryGroup(group);
                            setQuickAccessorySubType(firstSub);
                            setSaleGroup("Aksesuar");
                            setSaleForm({
                              ...saleForm,
                              type: "Aksesuar Satışı",
                              productId: "",
                              search: `${group} - ${firstSub}`,
                              total: accessoryShortcutForm.price || "",
                              cash: accessoryShortcutForm.price || "",
                              card: "",
                            });
                          }}
                        >
                          {group}
                        </button>
                      ))}
                    </div>

                    <h3>ALT SEÇENEK SEÇ</h3>
                    <div className="accessory-select-tabs accessory-sub-tabs">
                      {(quickAccessoryGroups[accessoryShortcutForm.group] || []).map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          className={accessoryShortcutForm.sub === sub ? "choice active" : "choice"}
                          onClick={() => {
                            setAccessoryShortcutForm({ ...accessoryShortcutForm, sub });
                            setQuickAccessoryGroup(accessoryShortcutForm.group);
                            setQuickAccessorySubType(sub);
                            setSaleGroup("Aksesuar");
                            setSaleForm({
                              ...saleForm,
                              type: "Aksesuar Satışı",
                              productId: "",
                              search: `${accessoryShortcutForm.group} - ${sub}`,
                              total: accessoryShortcutForm.price || "",
                              cash: accessoryShortcutForm.price || "",
                              card: "",
                            });
                          }}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>

                  </div>


                </div>
              </>
            )}

            {kasaTab === "satisListesi" && (
              <section className="card">
                <h2>Satış Listesi</h2>
                <p>Normal satışlar ve teknik servis kaparo/tahsilat/iade hareketleri aynı listede görünür.</p>
                <Table headers={["No", "Tarih/Saat", "İşlem Türü", "Müşteri", "Ürün / Cihaz", "Yöntem", "Tutar", "Kalan / Kâr", "Durum", "Detay", "Sil"]} rows={combinedSalesListRows.map((row, index) => {
                  if (row.kind === "technical") {
                    const { movement, service } = row;
                    return [
                      index + 1,
                      new Date(movement.date).toLocaleString("tr-TR"),
                      movement.type,
                      service?.customerName || "-",
                      service?.device || movement.note || "-",
                      movement.method === "Kart/Banka" ? movement.bank || "Kart/Banka" : "Nakit",
                      <span className={movement.direction === "out" ? "technical-money-out" : "technical-money-in"}>{`${movement.direction === "out" ? "-" : "+"}${money(movement.amount)}`}</span>,
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
                    sale.total,
                    `${money(sale.remaining)} / ${money(sale.profit)}`,
                    sale.status || "active",
                    <button className="edit-btn" onClick={() => openSaleEditor(sale)}><Pencil size={14} /> Düzenle</button>,
                    <button className="delete-btn" onClick={() => deleteSale(sale.id)}>Sil</button>,
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

                <Table headers={["Tarih", "Gider", "Tutar", "Not", "Sil"]} rows={activeExpenses.map((item) => [
                  new Date(item.date).toLocaleString("tr-TR"),
                  item.category,
                  item.amount,
                  item.note || "-",
                  <button className="delete-btn" onClick={() => deleteExpense(item.id)}>Sil</button>,
                ])} />
              </section>
            )}

            {kasaTab === "nakitGirisi" && (
              <section className="card">
                <h2>Nakit Girişi</h2>

                <div className="button-grid">
                  {cashEntryTypes.map((type) => (
                    <button
                      key={type}
                      className={cashEntryForm.type === type ? "choice active" : "choice"}
                      onClick={() => setCashEntryForm({ ...cashEntryForm, type })}
                    >
                      {type === "Devir Nakit" ? "Dünden Devir Nakit" : type}
                    </button>
                  ))}
                </div>

                <div className="form-grid">
                  <input type="text" inputMode="numeric" placeholder="Tutar" value={cashEntryForm.amount} onFocus={() => setCashEntryForm({ ...cashEntryForm, amount: stripMoneyForEdit(cashEntryForm.amount) })} onChange={(e) => setCashEntryForm({ ...cashEntryForm, amount: cleanMoneyTyping(e.target.value) })} onBlur={() => setCashEntryForm({ ...cashEntryForm, amount: formatMoneyInput(cashEntryForm.amount) })} />
                  <input placeholder="Nakit nerden geldi?" value={cashEntryForm.note} onChange={(e) => setCashEntryForm({ ...cashEntryForm, note: e.target.value })} />
                  <div className="remaining-input">
                    <span>Nakit Kasa</span>
                    <b className={cashWithBankIncoming < 0 ? "money-negative" : ""}>{money(cashWithBankIncoming)}</b>
                  </div>
                </div>

                <button className="primary" onClick={saveCashEntry}><Plus size={16} /> Nakit Girişini Kaydet</button>

                <Table headers={["Tarih", "İşlem", "Yön", "Tutar", "Not", "İşlem"]} rows={activeCashMovements.map((item) => {
                  const cancellation = cashMovementCancellationFor(item);
                  const isCancellationRow = isCashMovementCancellation(item);
                  return [
                    new Date(item.date).toLocaleString("tr-TR"),
                    item.type || "-",
                    item.direction === "out" ? "Çıkış" : "Giriş",
                    <span className={item.direction === "out" ? "technical-money-out" : "technical-money-in"}>{`${item.direction === "out" ? "-" : "+"}${money(item.amount)}`}</span>,
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

                <section className="card daily-report-card">
                  <div className="daily-report-header">
                    <div>
                      <h2>GÜNLÜK KASA RAPORU</h2>
                      <p>Seçilen tarihteki satış, kasa, banka, cari ve teknik servis hareketlerini okuma amaçlı listeler.</p>
                    </div>
                    <div className="daily-report-controls">
                      <label>
                        <span>Tarih</span>
                        <input type="date" value={dailyReportDate} onChange={(event) => setDailyReportDate(event.target.value)} />
                      </label>
                      <button className="primary" onClick={() => setSyncMessage(`Günlük kasa raporu yenilendi: ${dailyReportDate}`)}>
                        Raporu Yenile
                      </button>
                    </div>
                  </div>

                  <Table headers={["No", "Tarih / Saat", "İşlem Türü", "Ürün / Açıklama", "Müşteri / Tedarikçi", "Alış Fiyatı", "Satış Fiyatı", "Nakit", "Kart / Banka", "Borç / Cari", "İade / İptal", "Toplam"]} rows={dailyCashReportRows.map((row) => [
                    row.no,
                    formatRecordDate(row.date),
                    reportTypeBadge(row),
                    row.description || "-",
                    row.party || "-",
                    reportMoneyCell(row.buy),
                    reportMoneyCell(row.sale),
                    reportMoneyCell(row.cash),
                    reportMoneyCell(row.bank),
                    reportMoneyCell(row.debt),
                    reportMoneyCell(row.refund, { negative: true }),
                    reportMoneyCell(row.total),
                  ])} />

                  <div className="daily-report-totals">
                    <div><span>Toplam Alış</span><b>{money(dailyCashReportTotals.buy)}</b></div>
                    <div><span>Toplam Satış</span><b>{money(dailyCashReportTotals.sale)}</b></div>
                    <div><span>Toplam Nakit</span><b className={dailyCashReportTotals.cash < 0 ? "money-negative" : ""}>{money(dailyCashReportTotals.cash)}</b></div>
                    <div><span>Toplam Kart/Banka</span><b className={dailyCashReportTotals.bank < 0 ? "money-negative" : ""}>{money(dailyCashReportTotals.bank)}</b></div>
                    <div><span>Toplam Borç/Cari</span><b>{money(dailyCashReportTotals.debt)}</b></div>
                    <div><span>Toplam İade/İptal</span><b className="money-negative">{money(dailyCashReportTotals.refund)}</b></div>
                    <div className="daily-report-net"><span>Net Kasa Etkisi</span><b className={dailyCashReportTotals.netCash < 0 ? "money-negative" : ""}>{money(dailyCashReportTotals.netCash)}</b></div>
                  </div>
                </section>
              </div>
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
                  <select value={bankCashForm.bank} onChange={(e) => handleBankSelect(e.target.value, (bank) => setBankCashForm({ ...bankCashForm, bank }))}>
                    <option value="">Banka seçmek zorunlu</option>
                    {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
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
              <h2>DİĞERLERİ</h2>
              <div className="other-product-tabs">
                {otherProductGroups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    className={(stockForm.deviceType || otherGroupName) === group ? "choice active" : "choice"}
                    onClick={() => {
                      setOtherGroupName(group);
                      setStockForm({
                        ...stockForm,
                        module: "Diğer",
                        deviceType: group,
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

              {(stockForm.deviceType || otherGroupName) === "Program" ? (
                <div className="conditional-panel">
                  <h3>Program Satışı</h3>
                  <p className="mini-note">Program stoklu ürün gibi çalışmaz. Satış ekranında Program seçeneğiyle kayıt edilir; eksik ödeme mevcut alacak mantığına işlenir.</p>
                  <button
                    className="primary"
                    type="button"
                    onClick={() => {
                      setSaleGroup("Program");
                      setSaleForm({ type: "Program Satışı", customer: "", cariPerson: "", search: "", productId: "", total: "", cash: "", card: "", bank: "" });
                      setKasaTab("yeniSatis");
                      setActive("kasa");
                    }}
                  >
                    Program Satışına Git
                  </button>
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
              <button className={stockView === "diger" ? "choice active" : "choice"} onClick={() => setStockView("diger")}>Diğerleri</button>
              <button className={stockView === "tum" ? "choice active" : "choice"} onClick={() => setStockView("tum")}>TÜM Stok</button>
              <button className={stockTab === "kayit" ? "choice active" : "choice"} onClick={() => setStockTab(stockTab === "kayit" ? "liste" : "kayit")}>Stok Kaydı</button>
            </div>

            <section className="card">
              <div className="stock-title-row">
                <h2>
                  {stockView === "cihaz" && "Cihaz Stok Listesi"}
                  {stockView === "aksesuar" && "Aksesuar Stok Listesi"}
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

              <StockTable stock={currentStockList} setEditingStock={openStockEditor} deleteStock={deleteStock} deviceView={stockView === "cihaz"} />

              {stockView === "tum" && (
                <div className="grouped-stock">
                  <h3>Grup Grup Stok Özeti</h3>
                  {[
                    { groupName: "Cihaz", groupItems: deviceStock },
                    { groupName: "Aksesuar", groupItems: accessoryStock },
                    { groupName: "Diğerleri", groupItems: otherStock },
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

            {karaTab === "alacak" && (
              <section className="card">
                {!selectedReceivableMovement ? (
                  <>
                    <div className="ledger-total-card receivable">
                      <span>TOPLAM ALACAKLARIM</span>
                      <b>Alacak: {money(totalReceivableBalance)}</b>
                    </div>
                    <h2>Kara Defter / Alacaklarım</h2>
                    <Table headers={["İşlem", "Tarih", "Adı Soyad", "Alınan Mal", "Kalan", "Düzelt", "Sil"]} rows={alacaklarim.map((sale, index) => [
                      index + 1,
                      new Date(sale.date).toLocaleString("tr-TR"),
                      sale.cariPerson || sale.customer,
                      <button className="link-btn" onClick={() => setSelectedReceivableMovement(sale)}>{sale.productName}</button>,
                      money(sale.remaining),
                      <button className="edit-btn" onClick={() => openSaleEditor(sale)}><Pencil size={14} /> Düzenle</button>,
                      <button className="delete-btn" onClick={() => deleteSale(sale.id)}>Sil</button>,
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
                    <div className="ledger-total-card payable">
                      <span>TOPLAM TEDARİKÇİ / FİRMA BORCU</span>
                      <b>Borç: {money(totalPayableBalance)}</b>
                    </div>
                    <h2>Kara Defter / Tedarikçi/Firma</h2>
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
                <Table headers={["Grup", "Ürün", "Müşteri / Cari Kişi", "Satış", "Nakit", "Kart", "Kalan", "Düzelt", "Sil"]} rows={sortedFilteredSales.map((sale) => [
                  saleGroupName(sale.type),
                  sale.productName,
                  sale.cariPerson || sale.customer || "-",
                  sale.total,
                  sale.cash,
                  sale.card,
                  money(sale.remaining),
                  <button className="edit-btn" onClick={() => openSaleEditor(sale)}>Düzenle</button>,
                  <button className="delete-btn" onClick={() => deleteSale(sale.id)}>Sil</button>,
                ])} />
              </section>
            )}

          </section>
        )}

        {editingSale && <SaleEditModal sale={editingSale} setSale={setEditingSale} save={updateSale} bankOptions={bankOptions} />}
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


function OtherStockForm({ stockForm, setStockForm, saveStock, otherGroupName, setOtherGroupName, supplierOptions, setSupplierModalOpen }) {
  const selectedGroup = stockForm.deviceType || otherGroupName || "Saat";
  return (
    <>
      <div className="form-grid">
        <select value={selectedGroup} onChange={(e) => {
          setOtherGroupName(e.target.value);
          setStockForm({ ...stockForm, module: "Diğer", deviceType: e.target.value || "Diğerleri" });
        }}>
          {otherProductGroups.map((group) => <option key={group}>{group}</option>)}
        </select>
        <select value={stockForm.condition || "Sıfır Garantili"} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", condition: e.target.value })}>
          <option>Sıfır Garantili</option>
          <option>İkinci El</option>
          <option>Sıfır Spot</option>
        </select>
        <input placeholder="Marka" value={stockForm.brand || ""} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", brand: e.target.value })} />
        <input placeholder="Model / Ürün adı" value={stockForm.model || stockForm.name || ""} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", model: e.target.value, name: e.target.value })} />
        <input placeholder="Barkod / Seri No" inputMode="numeric" maxLength={15} value={stockForm.barcode} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", barcode: cleanBarcode(e.target.value) })} />
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
        <input type="text" inputMode="numeric" placeholder="Alış fiyatı" value={stockForm.buy} onFocus={() => setStockForm({ ...stockForm, buy: stripMoneyForEdit(stockForm.buy) })} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", buy: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, buy: formatMoneyInput(stockForm.buy) })} />
        <input type="text" inputMode="numeric" placeholder="Satış fiyatı" value={stockForm.sell} onFocus={() => setStockForm({ ...stockForm, sell: stripMoneyForEdit(stockForm.sell) })} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", sell: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, sell: formatMoneyInput(stockForm.sell) })} />
        <input type="number" placeholder="Stok adedi" value={stockForm.qty} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", qty: e.target.value })} />
        <div className="remaining-input">
          <span>Kalan cari</span>
          <b>{money(Math.max(parseMoneyInput(stockForm.buy) * Number(stockForm.qty || 0) - parseMoneyInput(stockForm.supplierPaid), 0))}</b>
        </div>
        <input type="text" inputMode="numeric" placeholder="Nakit ödeme" value={stockForm.supplierPaid} onFocus={() => setStockForm({ ...stockForm, supplierPaid: stripMoneyForEdit(stockForm.supplierPaid) })} onChange={(e) => setStockForm({ ...stockForm, module: "Diğer", supplierPaid: cleanMoneyTyping(e.target.value) })} onBlur={() => setStockForm({ ...stockForm, supplierPaid: formatMoneyInput(stockForm.supplierPaid) })} />
      </div>

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

function StockTable({ stock, setEditingStock, deleteStock, deviceView = false }) {
  if (deviceView) {
    return (
      <Table
        headers={["No", "Durum", "Marka", "Model", "Hafıza", "Alış", "Satış", "Stok", "Tedarikçi/Satıcı", "Düzelt", "Sil"]}
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
          <button className="edit-btn" onClick={() => setEditingStock({ ...product })}><Pencil size={14} /> Düzenle</button>,
          <button className="delete-btn" onClick={() => deleteStock(product.id)}>Sil</button>,
        ])}
      />
    );
  }

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

function SaleEditModal({ sale, setSale, save, bankOptions = [] }) {
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
            alert("Banka ekleme ana satış ekranından yapılacak. Ana bankalar: Ziraatbank, İşbank, Halkbank.");
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
