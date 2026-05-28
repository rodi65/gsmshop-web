import { compareMoney, sumMoney, toMoney } from "./money";

export type ReconciliationSeverity = "ERROR" | "WARNING" | "INFO";
export type ReconciliationModule = "SALES" | "STOCK" | "CASH" | "BANK" | "CARI" | "RETURN" | "CANCEL" | "EXCHANGE" | "AUDIT" | "WORKSPACE" | "LEDGER";

export interface ReconciliationFinding {
  severity: ReconciliationSeverity;
  module: ReconciliationModule;
  entityType: string;
  entityId?: string | null;
  message: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  suggestedFix?: string;
  createdAt: string;
}

function finding(input: Omit<ReconciliationFinding, "createdAt">): ReconciliationFinding {
  return { ...input, createdAt: new Date().toISOString() };
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function isCancelled(record: any): boolean {
  const status = String(record?.status || "").toLowerCase();
  return Boolean(record?.is_deleted || record?.is_cancelled || record?.deleted_at || record?.cancelled_at || ["cancelled", "canceled", "iptal", "deleted", "silindi"].includes(status));
}

export function checkWorkspaceIds(tables: Record<string, any[]>): ReconciliationFinding[] {
  return Object.entries(tables).flatMap(([tableName, rows]) =>
    (rows || [])
      .filter((row) => isBlank(row?.workspace_id))
      .map((row) =>
        finding({
          severity: "ERROR",
          module: "WORKSPACE",
          entityType: tableName,
          entityId: row?.id || null,
          message: `${tableName} kaydinda workspace_id eksik.`,
          suggestedFix: "Kayit otomatik duzeltilmesin; kaynak islem workspace baglantisi ile yeniden incelensin.",
        }),
      ),
  );
}

export function checkSalesConsistency(data: {
  sales?: any[];
  saleItems?: any[];
  cashMovements?: any[];
  bankMovements?: any[];
  cariMovements?: any[];
  auditLogs?: any[];
}): ReconciliationFinding[] {
  const findings: ReconciliationFinding[] = [];
  const saleItems = data.saleItems || [];
  const cash = data.cashMovements || [];
  const bank = data.bankMovements || [];
  const cari = data.cariMovements || [];
  const audits = data.auditLogs || [];

  (data.sales || []).forEach((sale) => {
    if (isCancelled(sale)) return;
    const saleId = sale.id;
    const total = toMoney(sale.total_amount ?? sale.sale_price ?? sale.price ?? sale.total);
    const items = saleItems.filter((item) => item.sale_id === saleId || item.saleId === saleId);
    const saleCash = sumMoney(cash.filter((row) => row.related_sale_id === saleId || row.sale_id === saleId || row.reference_id === saleId).map((row) => row.amount));
    const saleBank = sumMoney(bank.filter((row) => row.related_sale_id === saleId || row.sale_id === saleId || row.reference_id === saleId).map((row) => row.amount));
    const saleCari = sumMoney(cari.filter((row) => row.reference_id === saleId || row.sale_id === saleId).map((row) => row.amount));
    const paymentTotal = sumMoney([saleCash, saleBank, saleCari]);

    if (saleItems.length > 0 && items.length === 0) {
      findings.push(finding({ severity: "ERROR", module: "SALES", entityType: "sales", entityId: saleId, message: "Satis kaydi var ama sale_items yok.", suggestedFix: "Satis islem kaynagi RPC/transaction log ile incelenmeli." }));
    }
    if (total > 0 && paymentTotal > 0 && compareMoney(paymentTotal, total) !== 0) {
      findings.push(finding({ severity: "WARNING", module: "SALES", entityType: "sales", entityId: saleId, message: "Satis odeme dagilimi satis toplamiyla esit degil.", expectedValue: total, actualValue: paymentTotal, suggestedFix: "Otomatik duzeltme yapma; ilgili transaction yeniden kontrol edilmeli." }));
    }
    const hasAudit = audits.some((log) => log.entity_id === saleId || log.reference_id === saleId);
    if (audits.length > 0 && !hasAudit) {
      findings.push(finding({ severity: "WARNING", module: "AUDIT", entityType: "sales", entityId: saleId, message: "Satis icin audit kaydi bulunamadi.", suggestedFix: "Eksik audit nedeni incelenmeli." }));
    }
  });

  return findings;
}

export function checkLedgerBalance(businessTransactions: any[] = [], ledgerEntries: any[] = []): ReconciliationFinding[] {
  return businessTransactions.flatMap((transaction) => {
    const entries = ledgerEntries.filter((entry) => entry.business_transaction_id === transaction.id);
    if (entries.length === 0) {
      return [
        finding({
          severity: "ERROR",
          module: "LEDGER",
          entityType: "business_transactions",
          entityId: transaction.id,
          message: "Business transaction var ama ledger_entries yok.",
          suggestedFix: "Islem otomatik duzeltilmesin; RPC kaydi incelensin.",
        }),
      ];
    }

    const debit = sumMoney(entries.filter((entry) => entry.direction === "DEBIT").map((entry) => entry.amount));
    const credit = sumMoney(entries.filter((entry) => entry.direction === "CREDIT").map((entry) => entry.amount));
    if (compareMoney(debit, credit) !== 0) {
      return [
        finding({
          severity: "ERROR",
          module: "LEDGER",
          entityType: "business_transactions",
          entityId: transaction.id,
          message: "Ledger debit/credit dengesi bozuk.",
          expectedValue: debit,
          actualValue: credit,
          suggestedFix: "Transaction yeniden olusturulmadan otomatik duzeltme yapilmaz.",
        }),
      ];
    }
    return [];
  });
}

export function runReadOnlyReconciliation(data: Record<string, any[]>): ReconciliationFinding[] {
  return [
    ...checkWorkspaceIds(data),
    ...checkSalesConsistency({
      sales: data.sales,
      saleItems: data.sale_items,
      cashMovements: data.cash_movements,
      bankMovements: data.bank_movements,
      cariMovements: data.cari_movements,
      auditLogs: data.audit_logs,
    }),
    ...checkLedgerBalance(data.business_transactions, data.ledger_entries),
  ];
}
