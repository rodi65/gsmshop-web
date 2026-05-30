import { BusinessRuleError, InvalidPaymentSplitError, MissingCustomerError } from "./errors";
import { compareMoney, roundMoney, sumMoney } from "./money";
import type { SaleItemInput, SaleTransactionInput } from "./transactionTypes";

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

export function normalizeCartMoney(value: unknown, fieldName = "money"): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new BusinessRuleError(`${fieldName} geçersiz para değeri.`, "INVALID_MONEY", { fieldName, value });
    return roundMoney(value);
  }

  if (value === undefined || value === null || value === "") return 0;
  if (typeof value !== "string") throw new BusinessRuleError(`${fieldName} geçersiz para değeri.`, "INVALID_MONEY", { fieldName, value });

  const raw = value.trim();
  if (!raw) return 0;

  let cleaned = raw
    .replace(/TL/gi, "")
    .replace(/₺/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) throw new BusinessRuleError(`${fieldName} geçersiz para değeri.`, "INVALID_MONEY", { fieldName, value });
  return roundMoney(parsed);
}

function normalizeQuantity(value: unknown, index: number): number {
  const quantity = Number(firstValue(value, 1));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BusinessRuleError("Sepet satır miktarı 0’dan büyük olmalıdır.", "INVALID_QUANTITY", { index, quantity: value });
  }
  return quantity;
}

function normalizeCartSaleItem(item: SaleItemInput & Record<string, unknown>, index: number): SaleItemInput & Record<string, unknown> {
  const quantity = normalizeQuantity(item.quantity, index);
  const productType = cleanText(firstValue(item.productType, item.product_type, "sale"));
  const isServiceLine = ["service", "program", "hizmet"].includes(productType.toLocaleLowerCase("tr-TR"));
  const productId = cleanText(firstValue(item.productId, item.product_id, item.stockId, item.stock_id, isServiceLine ? `cart-line-${index + 1}` : ""));
  const productName = cleanText(firstValue(item.product_name, item.name, item.productName, "Ürün"));
  const unitPriceAtSale = normalizeCartMoney(firstValue(item.unitPriceAtSale, item.unit_price_at_sale, item.unitPrice, item.unit_price, item.price), `items[${index}].unitPrice`);
  const unitCostAtSale = normalizeCartMoney(firstValue(item.unitCostAtSale, item.unit_cost_at_sale, item.unitCost, item.unit_cost, 0), `items[${index}].unitCost`);
  const discountAmount = normalizeCartMoney(firstValue(item.discountAmount, item.discount_amount, 0), `items[${index}].discount`);
  const lineTotal = roundMoney((unitPriceAtSale * quantity) - discountAmount);
  const lineProfit = roundMoney(lineTotal - (unitCostAtSale * quantity));

  return {
    ...item,
    productType,
    product_type: productType,
    productId,
    product_id: productId,
    stockId: cleanText(firstValue(item.stockId, item.stock_id, productId)),
    stock_id: cleanText(firstValue(item.stock_id, item.stockId, productId)),
    name: productName,
    product_name: productName,
    imei: firstValue(item.imei, null) as string | null,
    barcode: cleanText(firstValue(item.barcode, "")),
    quantity,
    unitPrice: unitPriceAtSale,
    unit_price: unitPriceAtSale,
    unitPriceAtSale,
    unit_price_at_sale: unitPriceAtSale,
    unitCostAtSale,
    unit_cost_at_sale: unitCostAtSale,
    discountAmount,
    discount_amount: discountAmount,
    lineTotal,
    line_total: lineTotal,
    lineProfit,
    line_profit: lineProfit,
  };
}

export function normalizeCartSalePayload(input: SaleTransactionInput & Record<string, unknown>): SaleTransactionInput & Record<string, unknown> {
  const items = (Array.isArray(input.items) ? input.items : []).map((item, index) => normalizeCartSaleItem(item as SaleItemInput & Record<string, unknown>, index));
  const subtotal = sumMoney(items.map((item) => Number(item.unitPriceAtSale || 0) * Number(item.quantity || 0)));
  const discount = sumMoney(items.map((item) => item.discountAmount || 0));
  const saleTotal = sumMoney(items.map((item) => item.lineTotal));
  const cashAmount = normalizeCartMoney(firstValue(input.payments?.cashAmount, input.payments?.cash_amount, 0), "payments.cashAmount");
  const cardAmount = normalizeCartMoney(firstValue(input.payments?.cardAmount, input.payments?.card_amount, 0), "payments.cardAmount");
  const bankAmount = normalizeCartMoney(firstValue(input.payments?.bankAmount, input.payments?.bank_amount, 0), "payments.bankAmount");
  const cariAmount = normalizeCartMoney(firstValue(input.payments?.cariAmount, input.payments?.cari_amount, 0), "payments.cariAmount");
  const paymentTotal = sumMoney([cashAmount, cardAmount, bankAmount, cariAmount]);
  const remainingAmount = roundMoney(saleTotal - paymentTotal);
  const customerName = cleanText(firstValue(input.customerName, input.customer_name, input.metadata?.customerName, ""));
  const cariPerson = cleanText(firstValue(input.cariPerson, input.cari_person, input.metadata?.cariPerson, customerName));
  const bankName = cleanText(firstValue(input.bankName, input.bank_name, input.payments?.bankName, input.payments?.bank_name, input.metadata?.bankName, ""));
  const bankId = cleanText(firstValue(input.activeBankId, input.bankId, input.bank_id, input.payments?.bankId, input.payments?.bank_id, ""));
  const sessionId = cleanText(firstValue(input.sessionId, input.session_id, input.idempotencyKey));

  return {
    ...input,
    sessionId,
    session_id: sessionId,
    customerId: input.customerId || input.customer_id || null,
    customer_id: input.customer_id || input.customerId || null,
    customerName,
    customer_name: customerName,
    activeCariId: input.activeCariId || input.active_cari_id || input.customerId || null,
    active_cari_id: input.active_cari_id || input.activeCariId || input.customerId || null,
    activeCustomer: input.activeCustomer || { customerId: input.customerId || null, customerName },
    active_customer: input.active_customer || { customer_id: input.customerId || null, customer_name: customerName },
    activeBankId: bankId,
    active_bank_id: bankId,
    bankName,
    bank_name: bankName,
    bankId,
    bank_id: bankId,
    cariPerson,
    cari_person: cariPerson,
    product_name: items.length === 1 ? String(items[0]?.product_name || "Sepet Satışı") : `Sepet Satışı (${items.length} kalem)`,
    totalAmount: saleTotal,
    total_amount: saleTotal,
    items,
    payments: {
      ...input.payments,
      cashAmount,
      cash_amount: cashAmount,
      cardAmount,
      card_amount: cardAmount,
      bankAmount,
      bank_amount: bankAmount,
      cariAmount,
      cari_amount: cariAmount,
      bankId,
      bank_id: bankId,
      bankName,
      bank_name: bankName,
      totalAmount: saleTotal,
      total_amount: saleTotal,
    },
    totals: {
      ...(input.totals || {}),
      subtotal,
      discount,
      saleTotal,
      sale_total: saleTotal,
      paymentTotal,
      payment_total: paymentTotal,
      remainingAmount,
      remaining_amount: remainingAmount,
    },
    metadata: {
      ...(input.metadata || {}),
      source: input.metadata?.source || "cart",
      note: input.note || input.metadata?.note || "",
      clientTimestamp: input.metadata?.clientTimestamp || new Date().toISOString(),
      normalizedBy: "kasa-beyni-cart-sale",
    },
  };
}

export function validateCartSale(input: SaleTransactionInput & Record<string, unknown>): void {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new BusinessRuleError("Sepet satışı için en az bir ürün zorunludur.", "EMPTY_SALE_ITEMS");
  }

  input.items.forEach((item, index) => {
    const unitPrice = normalizeCartMoney(firstValue(item.unitPriceAtSale, item.unit_price_at_sale, item.unitPrice, item.unit_price), `items[${index}].unitPrice`);
    const lineTotal = normalizeCartMoney(firstValue(item.lineTotal, item.line_total), `items[${index}].lineTotal`);
    const quantity = normalizeQuantity(item.quantity, index);
    const productType = cleanText(firstValue(item.productType, item.product_type, "sale"));
    const isServiceLine = ["service", "program", "hizmet"].includes(productType.toLocaleLowerCase("tr-TR"));
    const productId = cleanText(firstValue(item.productId, item.product_id, item.stockId, item.stock_id, ""));
    if (!isServiceLine && !productId) throw new BusinessRuleError("Stoklu sepet kalemi için geçerli stock id zorunludur.", "MISSING_PRODUCT_ID", { index });
    if (compareMoney(unitPrice, 0) <= 0) throw new BusinessRuleError("Ürün satış fiyatı 0’dan büyük olmalıdır.", "INVALID_ITEM_PRICE", { index, unitPrice });
    if (compareMoney(lineTotal, 0) <= 0) throw new BusinessRuleError("Ürün satır toplamı 0’dan büyük olmalıdır.", "INVALID_ITEM_TOTAL", { index, lineTotal });
    if (compareMoney(lineTotal, roundMoney(unitPrice * quantity - normalizeCartMoney(firstValue(item.discountAmount, item.discount_amount, 0), `items[${index}].discount`))) !== 0) {
      throw new BusinessRuleError("Ürün satır toplamı fiyat x adet ile uyuşmuyor.", "INVALID_LINE_TOTAL", { index });
    }
  });

  const saleTotal = normalizeCartMoney(firstValue(input.totals?.saleTotal, input.totals?.sale_total, input.totalAmount, input.total_amount), "totals.saleTotal");
  const cashAmount = normalizeCartMoney(firstValue(input.payments?.cashAmount, input.payments?.cash_amount, 0), "payments.cashAmount");
  const cardAmount = normalizeCartMoney(firstValue(input.payments?.cardAmount, input.payments?.card_amount, 0), "payments.cardAmount");
  const bankAmount = normalizeCartMoney(firstValue(input.payments?.bankAmount, input.payments?.bank_amount, 0), "payments.bankAmount");
  const cariAmount = normalizeCartMoney(firstValue(input.payments?.cariAmount, input.payments?.cari_amount, 0), "payments.cariAmount");
  const paymentTotal = sumMoney([cashAmount, cardAmount, bankAmount, cariAmount]);

  if (compareMoney(saleTotal, 0) <= 0) throw new BusinessRuleError("Satış toplamı payload içinde 0 geliyor. Ürün fiyatı kontrol edilmeli.", "INVALID_SALE_TOTAL", { saleTotal });
  if ([cashAmount, cardAmount, bankAmount, cariAmount].some((amount) => compareMoney(amount, 0) < 0)) throw new BusinessRuleError("Ödeme tutarları negatif olamaz.", "INVALID_PAYMENT_AMOUNT");
  if (compareMoney(paymentTotal, saleTotal) !== 0) throw new InvalidPaymentSplitError("Nakit + kart/banka + cari toplamı satış tutarına eşit olmalıdır.", { saleTotal, paymentTotal, payments: input.payments });

  const bankText = cleanText(firstValue(input.bankId, input.bank_id, input.bankName, input.bank_name, input.activeBankId, input.active_bank_id, input.payments?.bankId, input.payments?.bank_id, input.payments?.bankName, input.payments?.bank_name));
  if (compareMoney(cardAmount + bankAmount, 0) > 0 && !bankText) throw new BusinessRuleError("Kart tahsilatı için banka seçilmelidir.", "MISSING_BANK");

  const customerText = cleanText(firstValue(input.customerId, input.customerName, input.customer_name, input.cariPerson, input.cari_person, input.activeCariId, input.active_cari_id, input.metadata?.customerName, input.metadata?.cariPerson));
  if (compareMoney(cariAmount, 0) > 0 && !customerText) throw new MissingCustomerError("Cari borç var ama müşteri/cari seçilmemiş.");
}
