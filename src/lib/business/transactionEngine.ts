import { supabase } from "../supabase";
import {
  validateCancelTransaction,
  validateCollectionTransaction,
  validateExchangeTransaction,
  validateExpenseTransaction,
  validateReturnTransaction,
  validateSaleTransaction,
} from "./businessRules";
import { BusinessRuleError } from "./errors";
import type {
  BusinessTransactionResult,
  CancelTransactionInput,
  CollectionTransactionInput,
  ExchangeTransactionInput,
  ExpenseTransactionInput,
  ReturnTransactionInput,
  SaleTransactionInput,
} from "./transactionTypes";

type RpcName =
  | "ceplog_apply_sale_transaction"
  | "ceplog_apply_cart_sale_transaction"
  | "ceplog_record_collection_transaction"
  | "ceplog_record_expense_transaction"
  | "ceplog_cancel_sale_transaction"
  | "ceplog_return_sale_transaction"
  | "ceplog_exchange_sale_transaction"
  | "ceplog_record_stock_purchase_transaction"
  | "ceplog_cancel_stock_purchase_transaction"
  | "ceplog_record_manual_stock_adjustment";

function toPayload(input: Record<string, unknown>): Record<string, unknown> {
  return {
    ...input,
    workspace_id: input.workspaceId,
    actor_id: input.actorId || null,
    idempotency_key: input.idempotencyKey,
  };
}

function errorResult(error: unknown): BusinessTransactionResult {
  if (error instanceof BusinessRuleError) {
    return { success: false, errorCode: error.code, message: error.message, details: error.details };
  }
  const message = error instanceof Error ? error.message : "Islem tamamlanamadi.";
  return { success: false, errorCode: "TRANSACTION_ENGINE_ERROR", message, details: error };
}

async function callTransactionRpc(name: RpcName, input: Record<string, unknown>): Promise<BusinessTransactionResult> {
  try {
    const { data, error } = await supabase.rpc(name, { payload: toPayload(input) });
    if (error) throw error;
    return {
      success: true,
      transactionId: data?.transaction_id || data?.transactionId,
      referenceId: data?.reference_id || data?.referenceId,
      status: data?.status || "POSTED",
      summary: data?.summary || data || {},
    };
  } catch (error) {
    console.error(`CEPLOG transaction RPC failed: ${name}`, error);
    return errorResult(error);
  }
}

export async function createSaleTransaction(input: SaleTransactionInput): Promise<BusinessTransactionResult> {
  try {
    validateSaleTransaction(input);
    const isCartSale = input.items.length > 1 || input.metadata?.source === "cart";
    return await callTransactionRpc(isCartSale ? "ceplog_apply_cart_sale_transaction" : "ceplog_apply_sale_transaction", input as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResult(error);
  }
}

export async function recordCollectionTransaction(input: CollectionTransactionInput): Promise<BusinessTransactionResult> {
  try {
    validateCollectionTransaction(input);
    return await callTransactionRpc("ceplog_record_collection_transaction", input as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResult(error);
  }
}

export async function recordExpenseTransaction(input: ExpenseTransactionInput): Promise<BusinessTransactionResult> {
  try {
    validateExpenseTransaction(input);
    return await callTransactionRpc("ceplog_record_expense_transaction", input as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResult(error);
  }
}

export async function cancelSaleTransaction(input: CancelTransactionInput): Promise<BusinessTransactionResult> {
  try {
    validateCancelTransaction(input);
    return await callTransactionRpc("ceplog_cancel_sale_transaction", input as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResult(error);
  }
}

export async function returnSaleTransaction(input: ReturnTransactionInput): Promise<BusinessTransactionResult> {
  try {
    validateReturnTransaction(input);
    return await callTransactionRpc("ceplog_return_sale_transaction", input as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResult(error);
  }
}

export async function exchangeSaleTransaction(input: ExchangeTransactionInput): Promise<BusinessTransactionResult> {
  try {
    validateExchangeTransaction(input);
    return await callTransactionRpc("ceplog_exchange_sale_transaction", input as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResult(error);
  }
}

export async function recordStockPurchaseTransaction(input: Record<string, unknown>): Promise<BusinessTransactionResult> {
  if (!String(input.workspaceId || "").trim()) return { success: false, errorCode: "MISSING_WORKSPACE", message: "workspace_id zorunludur." };
  if (!String(input.idempotencyKey || "").trim()) return { success: false, errorCode: "MISSING_IDEMPOTENCY_KEY", message: "idempotencyKey zorunludur." };
  return await callTransactionRpc("ceplog_record_stock_purchase_transaction", input);
}

export async function cancelStockPurchaseTransaction(input: Record<string, unknown>): Promise<BusinessTransactionResult> {
  if (!String(input.workspaceId || "").trim()) return { success: false, errorCode: "MISSING_WORKSPACE", message: "workspace_id zorunludur." };
  if (!String(input.idempotencyKey || "").trim()) return { success: false, errorCode: "MISSING_IDEMPOTENCY_KEY", message: "idempotencyKey zorunludur." };
  if (!String(input.stockId || input.stock_id || "").trim()) return { success: false, errorCode: "MISSING_STOCK", message: "stock_id zorunludur." };
  if (!String(input.reason || "").trim()) return { success: false, errorCode: "MISSING_REASON", message: "İşlem sebebi zorunludur." };
  return await callTransactionRpc("ceplog_cancel_stock_purchase_transaction", input);
}

export async function recordManualStockAdjustment(input: Record<string, unknown>): Promise<BusinessTransactionResult> {
  if (!String(input.workspaceId || "").trim()) return { success: false, errorCode: "MISSING_WORKSPACE", message: "workspace_id zorunludur." };
  if (!String(input.idempotencyKey || "").trim()) return { success: false, errorCode: "MISSING_IDEMPOTENCY_KEY", message: "idempotencyKey zorunludur." };
  return await callTransactionRpc("ceplog_record_manual_stock_adjustment", input);
}
