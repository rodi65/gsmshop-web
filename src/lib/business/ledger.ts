import type { CollectionTransactionInput, ExpenseTransactionInput, LedgerEntryDraft, SaleTransactionInput } from "./transactionTypes";
import { sumMoney } from "./money";
import { validateLedgerBalance } from "./businessRules";

export function buildSaleLedgerEntries(input: SaleTransactionInput): LedgerEntryDraft[] {
  const totalSale = sumMoney(input.items.map((item) => item.lineTotal));
  const totalCost = sumMoney(input.items.map((item) => item.unitCostAtSale * item.quantity));
  const entries: LedgerEntryDraft[] = [];

  if (input.payments.cashAmount > 0) entries.push({ accountType: "CASH", direction: "DEBIT", amount: input.payments.cashAmount, description: "Nakit satis" });
  if (input.payments.cardAmount > 0 || input.payments.bankAmount > 0) {
    entries.push({ accountType: "POS_RECEIVABLE", direction: "DEBIT", amount: input.payments.cardAmount + input.payments.bankAmount, description: "Kart/Banka satis" });
  }
  if (input.payments.cariAmount > 0) {
    entries.push({ accountType: "CUSTOMER_RECEIVABLE", direction: "DEBIT", amount: input.payments.cariAmount, entityType: "contact", entityId: input.customerId || null, description: "Cari satis" });
  }

  entries.push({ accountType: "SALES_REVENUE", direction: "CREDIT", amount: totalSale, description: "Satis geliri" });
  if (totalCost > 0) {
    entries.push({ accountType: "COST_OF_GOODS_SOLD", direction: "DEBIT", amount: totalCost, description: "Satilan mal maliyeti" });
    entries.push({ accountType: "INVENTORY_ASSET", direction: "CREDIT", amount: totalCost, description: "Stok cikisi" });
  }

  assertLedgerBalanced(entries);
  return entries;
}

export function buildCollectionLedgerEntries(input: CollectionTransactionInput): LedgerEntryDraft[] {
  const debitAccount = input.paymentMethod === "CASH" ? "CASH" : "BANK";
  const entries: LedgerEntryDraft[] = [
    { accountType: debitAccount, direction: "DEBIT", amount: input.amount, description: "Cari tahsilat" },
    { accountType: "CUSTOMER_RECEIVABLE", direction: "CREDIT", amount: input.amount, entityType: "contact", entityId: input.customerId, description: "Cari alacak kapanisi" },
  ];
  assertLedgerBalanced(entries);
  return entries;
}

export function buildExpenseLedgerEntries(input: ExpenseTransactionInput): LedgerEntryDraft[] {
  const creditAccount = input.paymentMethod === "CASH" ? "CASH" : input.paymentMethod === "BANK" ? "BANK" : "SUPPLIER_PAYABLE";
  const entries: LedgerEntryDraft[] = [
    { accountType: "EXPENSE", direction: "DEBIT", amount: input.amount, description: input.category },
    { accountType: creditAccount, direction: "CREDIT", amount: input.amount, entityType: input.supplierId ? "contact" : null, entityId: input.supplierId || null, description: "Gider odemesi" },
  ];
  assertLedgerBalanced(entries);
  return entries;
}

export function buildCancelLedgerEntries(originalEntries: LedgerEntryDraft[]): LedgerEntryDraft[] {
  const entries = originalEntries.map((entry) => ({
    ...entry,
    direction: entry.direction === "DEBIT" ? "CREDIT" : "DEBIT",
    description: `Iptal: ${entry.description || ""}`.trim(),
  })) as LedgerEntryDraft[];
  assertLedgerBalanced(entries);
  return entries;
}

export function buildReturnLedgerEntries(originalEntries: LedgerEntryDraft[]): LedgerEntryDraft[] {
  return buildCancelLedgerEntries(originalEntries).map((entry) => ({
    ...entry,
    description: `Iade: ${entry.description || ""}`.trim(),
  }));
}

export function buildExchangeLedgerEntries(returnEntries: LedgerEntryDraft[], saleEntries: LedgerEntryDraft[]): LedgerEntryDraft[] {
  const entries = [...returnEntries, ...saleEntries];
  assertLedgerBalanced(entries);
  return entries;
}

export function assertLedgerBalanced(entries: LedgerEntryDraft[]): void {
  validateLedgerBalance(entries);
}
