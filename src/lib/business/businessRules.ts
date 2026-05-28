import type {
  BusinessTransactionInput,
  CancelTransactionInput,
  CollectionTransactionInput,
  ExchangeTransactionInput,
  ExpenseTransactionInput,
  LedgerEntryDraft,
  ReturnTransactionInput,
  SalePaymentInput,
  SaleTransactionInput,
} from "./transactionTypes";
import { compareMoney, multiplyMoney, roundMoney, sumMoney, toMoney } from "./money";
import {
  BusinessRuleError,
  InvalidExchangeError,
  InvalidPaymentSplitError,
  InvalidReturnError,
  LedgerBalanceError,
  MissingCustomerError,
  MissingReasonError,
  MissingWorkspaceError,
} from "./errors";

function requireText(value: unknown, message: string, code = "REQUIRED_FIELD"): string {
  const text = String(value || "").trim();
  if (!text) throw new BusinessRuleError(message, code);
  return text;
}

function requirePositiveMoney(value: unknown, message = "Tutar 0'dan buyuk olmalidir."): number {
  const amount = toMoney(value);
  if (compareMoney(amount, 0) <= 0) throw new BusinessRuleError(message, "INVALID_AMOUNT", { amount });
  return amount;
}

export function validateBaseTransaction(input: BusinessTransactionInput): void {
  if (!String(input.workspaceId || "").trim()) throw new MissingWorkspaceError();
  requireText(input.transactionType, "transactionType zorunludur.", "MISSING_TRANSACTION_TYPE");
  requireText(input.idempotencyKey, "idempotencyKey zorunludur.", "MISSING_IDEMPOTENCY_KEY");
}

export function validatePaymentSplit(total: number, payments: Partial<SalePaymentInput>): void {
  const paymentTotal = sumMoney([
    payments.cashAmount || 0,
    payments.cardAmount || 0,
    payments.bankAmount || 0,
    payments.cariAmount || 0,
  ]);

  if (compareMoney(paymentTotal, total) !== 0) {
    throw new InvalidPaymentSplitError("Nakit + kart/banka + cari toplami satis tutarina esit olmalidir.", {
      total,
      paymentTotal,
      payments,
    });
  }
}

export function validateSaleTransaction(input: SaleTransactionInput): void {
  validateBaseTransaction({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    transactionType: "SALE_MIXED_PAYMENT",
    idempotencyKey: input.idempotencyKey,
  });

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new BusinessRuleError("Satis icin en az bir urun zorunludur.", "EMPTY_SALE_ITEMS");
  }

  input.items.forEach((item, index) => {
    requireText(item.productType, "Urun tipi zorunludur.", "MISSING_PRODUCT_TYPE");
    requireText(item.productId, "Urun baglantisi zorunludur.", "MISSING_PRODUCT_ID");
    if (Number(item.quantity || 0) <= 0) throw new BusinessRuleError("Miktar 0'dan buyuk olmalidir.", "INVALID_QUANTITY", { index });

    const expectedLineTotal = multiplyMoney(item.unitPriceAtSale, item.quantity);
    const netExpectedLineTotal = roundMoney(expectedLineTotal - toMoney(item.discountAmount));
    const expectedProfit = roundMoney(netExpectedLineTotal - multiplyMoney(item.unitCostAtSale, item.quantity));

    if (compareMoney(item.unitCostAtSale, 0) < 0) throw new BusinessRuleError("Alis fiyati negatif olamaz.", "INVALID_COST", { index });
    if (compareMoney(item.unitPriceAtSale, 0) < 0) throw new BusinessRuleError("Satis fiyati negatif olamaz.", "INVALID_PRICE", { index });
    if (compareMoney(item.lineTotal, netExpectedLineTotal) !== 0) {
      throw new BusinessRuleError("Satis satiri toplam tutari hatali.", "INVALID_LINE_TOTAL", { index, expectedLineTotal: netExpectedLineTotal, actualLineTotal: item.lineTotal });
    }
    if (compareMoney(item.lineProfit, expectedProfit) !== 0) {
      throw new BusinessRuleError("Satis satiri kar hesabi hatali.", "INVALID_LINE_PROFIT", { index, expectedProfit, actualLineProfit: item.lineProfit });
    }
  });

  const saleTotal = sumMoney(input.items.map((item) => item.lineTotal));
  validatePaymentSplit(saleTotal, input.payments);

  if (compareMoney(input.payments.cariAmount || 0, 0) > 0 && !String(input.customerId || "").trim()) {
    throw new MissingCustomerError("Cari satis icin musteri zorunludur.");
  }
}

export function validateExpenseTransaction(input: ExpenseTransactionInput): void {
  validateBaseTransaction({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    transactionType: input.paymentMethod === "CASH" ? "EXPENSE_CASH" : input.paymentMethod === "BANK" ? "EXPENSE_BANK" : "EXPENSE_CREDIT",
    idempotencyKey: input.idempotencyKey,
  });
  requireText(input.category, "Gider kategorisi zorunludur.", "MISSING_EXPENSE_CATEGORY");
  requirePositiveMoney(input.amount);
  if (input.paymentMethod === "CREDIT" && !input.supplierId && !String(input.note || "").trim()) {
    throw new MissingCustomerError("Borclu gider icin tedarikci veya not zorunludur.");
  }
}

export function validateCollectionTransaction(input: CollectionTransactionInput): void {
  validateBaseTransaction({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    transactionType: input.paymentMethod === "CASH" ? "COLLECTION_CASH" : "COLLECTION_BANK",
    idempotencyKey: input.idempotencyKey,
  });
  requireText(input.customerId, "Tahsilat icin musteri zorunludur.", "MISSING_CUSTOMER");
  requirePositiveMoney(input.amount);
}

export function validateCancelTransaction(input: CancelTransactionInput): void {
  validateBaseTransaction({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    transactionType: "SALE_CANCEL",
    idempotencyKey: input.idempotencyKey,
  });
  requireText(input.saleId, "Iptal icin satis baglantisi zorunludur.", "MISSING_SALE_ID");
  if (!String(input.reason || "").trim()) throw new MissingReasonError("Iptal nedeni zorunludur.");
}

export function validateReturnTransaction(input: ReturnTransactionInput): void {
  validateBaseTransaction({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    transactionType: input.refundMethod === "CASH" ? "SALE_RETURN_CASH" : input.refundMethod === "CARD" || input.refundMethod === "BANK" ? "SALE_RETURN_CARD" : "SALE_RETURN_CARI",
    idempotencyKey: input.idempotencyKey,
  });
  requireText(input.saleId, "Iade icin satis baglantisi zorunludur.", "MISSING_SALE_ID");
  if (!String(input.reason || "").trim()) throw new MissingReasonError("Iade nedeni zorunludur.");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new InvalidReturnError("Iade icin en az bir satir zorunludur.");
  input.items.forEach((item) => {
    requireText(item.saleItemId, "Iade satiri icin saleItemId zorunludur.", "MISSING_SALE_ITEM_ID");
    if (Number(item.quantity || 0) <= 0) throw new InvalidReturnError("Iade miktari 0'dan buyuk olmalidir.");
  });
  if (compareMoney(input.refundAmount, 0) < 0) throw new InvalidReturnError("Iade tutari negatif olamaz.");
}

export function validateExchangeTransaction(input: ExchangeTransactionInput): void {
  validateBaseTransaction({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    transactionType: "SALE_EXCHANGE",
    idempotencyKey: input.idempotencyKey,
  });
  requireText(input.oldSaleId, "Degisim icin eski satis zorunludur.", "MISSING_OLD_SALE_ID");
  if (!String(input.reason || "").trim()) throw new MissingReasonError("Degisim nedeni zorunludur.");
  if (!input.returnItems?.length || !input.newSaleItems?.length) {
    throw new InvalidExchangeError("Degisim eski urun iadesi ve yeni urun satisi icermelidir.");
  }
}

export function validateLedgerBalance(entries: LedgerEntryDraft[]): void {
  const debit = sumMoney(entries.filter((entry) => entry.direction === "DEBIT").map((entry) => entry.amount));
  const credit = sumMoney(entries.filter((entry) => entry.direction === "CREDIT").map((entry) => entry.amount));
  if (compareMoney(debit, credit) !== 0) throw new LedgerBalanceError("Ledger debit/credit toplami esit degil.", { debit, credit, entries });
}
