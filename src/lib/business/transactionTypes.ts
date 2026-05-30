export const BusinessTransactionTypes = {
  SALE_CASH: "SALE_CASH",
  SALE_CARD: "SALE_CARD",
  SALE_CARI: "SALE_CARI",
  SALE_MIXED_PAYMENT: "SALE_MIXED_PAYMENT",
  COLLECTION_CASH: "COLLECTION_CASH",
  COLLECTION_BANK: "COLLECTION_BANK",
  EXPENSE_CASH: "EXPENSE_CASH",
  EXPENSE_BANK: "EXPENSE_BANK",
  EXPENSE_CREDIT: "EXPENSE_CREDIT",
  STOCK_PURCHASE_CASH: "STOCK_PURCHASE_CASH",
  STOCK_PURCHASE_BANK: "STOCK_PURCHASE_BANK",
  STOCK_PURCHASE_CREDIT: "STOCK_PURCHASE_CREDIT",
  SALE_CANCEL: "SALE_CANCEL",
  SALE_RETURN_CASH: "SALE_RETURN_CASH",
  SALE_RETURN_CARD: "SALE_RETURN_CARD",
  SALE_RETURN_CARI: "SALE_RETURN_CARI",
  SALE_EXCHANGE: "SALE_EXCHANGE",
  SERVICE_SALE: "SERVICE_SALE",
  SERVICE_RETURN: "SERVICE_RETURN",
  MANUAL_STOCK_ADJUSTMENT: "MANUAL_STOCK_ADJUSTMENT",
  DEFECTIVE_PRODUCT_ENTRY: "DEFECTIVE_PRODUCT_ENTRY",
  LOSS_FIRE_ENTRY: "LOSS_FIRE_ENTRY",
} as const;

export type BusinessTransactionType = keyof typeof BusinessTransactionTypes;

export type PaymentMethod = "CASH" | "CARD" | "BANK" | "CARI" | "MIXED" | "CREDIT" | "NONE";

export type StockMovementReason =
  | "PURCHASE_IN"
  | "SALE_OUT"
  | "RETURN_IN"
  | "CANCEL_IN"
  | "EXCHANGE_IN"
  | "EXCHANGE_OUT"
  | "FIRE_OUT"
  | "DEFECTIVE_OUT"
  | "MANUAL_ADJUSTMENT";

export type LedgerAccountType =
  | "CASH"
  | "BANK"
  | "POS_RECEIVABLE"
  | "CUSTOMER_RECEIVABLE"
  | "SUPPLIER_PAYABLE"
  | "INVENTORY_ASSET"
  | "SALES_REVENUE"
  | "SERVICE_REVENUE"
  | "COST_OF_GOODS_SOLD"
  | "EXPENSE"
  | "DISCOUNT"
  | "SALES_RETURN"
  | "RETURN_REFUND"
  | "ROUNDING"
  | "EQUITY_ADJUSTMENT";

export type BusinessTransactionStatus = "DRAFT" | "POSTED" | "CANCELLED" | "REVERSED" | "ERROR";
export type LedgerDirection = "DEBIT" | "CREDIT";
export type ReturnCondition = "SELLABLE" | "DEFECTIVE" | "SCRAP";

export interface BusinessTransactionInput {
  workspaceId: string;
  actorId?: string | null;
  transactionType: BusinessTransactionType;
  idempotencyKey: string;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SaleItemInput {
  productType: string;
  productId: string;
  imei?: string | null;
  quantity: number;
  unitCostAtSale: number;
  unitPriceAtSale: number;
  discountAmount: number;
  lineTotal: number;
  lineProfit: number;
}

export interface SalePaymentInput {
  cashAmount: number;
  cardAmount: number;
  bankAmount: number;
  cariAmount: number;
}

export interface SaleTransactionInput {
  workspaceId: string;
  actorId?: string | null;
  idempotencyKey: string;
  customerId?: string | null;
  customerName?: string | null;
  customer_name?: string | null;
  cariPerson?: string | null;
  cari_person?: string | null;
  items: SaleItemInput[];
  payments: SalePaymentInput;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExpenseTransactionInput {
  workspaceId: string;
  actorId?: string | null;
  idempotencyKey: string;
  category: string;
  subCategory?: string | null;
  amount: number;
  paymentMethod: "CASH" | "BANK" | "CREDIT";
  supplierId?: string | null;
  note?: string | null;
}

export interface CollectionTransactionInput {
  workspaceId: string;
  actorId?: string | null;
  idempotencyKey: string;
  customerId: string;
  amount: number;
  paymentMethod: "CASH" | "BANK";
  note?: string | null;
}

export interface CancelTransactionInput {
  workspaceId: string;
  actorId?: string | null;
  idempotencyKey: string;
  saleId: string;
  reason: string;
}

export interface ReturnTransactionInput {
  workspaceId: string;
  actorId?: string | null;
  idempotencyKey: string;
  saleId: string;
  items: Array<{
    saleItemId: string;
    quantity: number;
    condition: ReturnCondition;
  }>;
  refundMethod: PaymentMethod;
  refundAmount: number;
  reason: string;
}

export interface ExchangeTransactionInput {
  workspaceId: string;
  actorId?: string | null;
  idempotencyKey: string;
  oldSaleId: string;
  returnItems: ReturnTransactionInput["items"];
  newSaleItems: SaleItemInput[];
  paymentDifference: number;
  paymentMethodForDifference: PaymentMethod;
  reason: string;
}

export interface LedgerEntryDraft {
  accountType: LedgerAccountType;
  direction: LedgerDirection;
  amount: number;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BusinessTransactionResult {
  success: boolean;
  transactionId?: string;
  referenceId?: string;
  status?: BusinessTransactionStatus;
  summary?: Record<string, unknown>;
  errorCode?: string;
  message?: string;
  details?: unknown;
}
