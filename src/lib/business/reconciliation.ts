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

function sameId(a: unknown, b: unknown): boolean {
  return String(a || "") !== "" && String(a || "") === String(b || "");
}

function rowAmount(row: any): number {
  return Math.abs(toMoney(row?.amount ?? row?.total ?? row?.total_amount ?? 0));
}

function movementDirection(row: any): string {
  return String(row?.direction || row?.movement_direction || "").trim().toUpperCase();
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

export function checkMovementIntegrity(data: {
  cashMovements?: any[];
  bankMovements?: any[];
  posMovements?: any[];
  cariMovements?: any[];
  stockMovements?: any[];
}): ReconciliationFinding[] {
  const findings: ReconciliationFinding[] = [];
  const movementGroups: Array<[ReconciliationModule, string, any[], string[]]> = [
    ["CASH", "cash_movements", data.cashMovements || [], ["IN", "OUT", "in", "out", "Giriş", "Çıkış", "giris", "cikis"]],
    ["BANK", "bank_movements", data.bankMovements || [], ["IN", "OUT", "in", "out"]],
    ["BANK", "pos_movements", data.posMovements || [], ["IN", "OUT"]],
    ["CARI", "cari_movements", data.cariMovements || [], ["DEBIT", "CREDIT"]],
  ];

  movementGroups.forEach(([module, tableName, rows, allowedDirections]) => {
    rows.forEach((row) => {
      if (isCancelled(row)) return;
      const amount = rowAmount(row);
      const direction = movementDirection(row);
      if (compareMoney(amount, 0) < 0) {
        findings.push(finding({ severity: "ERROR", module, entityType: tableName, entityId: row.id || null, message: "Hareket tutari negatif olamaz.", actualValue: amount, suggestedFix: "Kaynak transaction/RPC kontrol edilmeli." }));
      }
      if (amount === 0) {
        findings.push(finding({ severity: "WARNING", module, entityType: tableName, entityId: row.id || null, message: "Hareket tutari 0 gorunuyor.", actualValue: amount, suggestedFix: "Kayit islem turu ve tutar alani kontrol edilmeli." }));
      }
      if (direction && !allowedDirections.map((item) => item.toUpperCase()).includes(direction)) {
        findings.push(finding({ severity: "WARNING", module, entityType: tableName, entityId: row.id || null, message: "Hareket yonu beklenen degerlerden farkli.", expectedValue: allowedDirections.join(", "), actualValue: direction, suggestedFix: "Direction normalize edilmeli." }));
      }
    });
  });

  (data.stockMovements || []).forEach((row) => {
    if (isCancelled(row)) return;
    if (!row.product_id && !row.stock_id && !row.related_stock_id) {
      findings.push(finding({ severity: "ERROR", module: "STOCK", entityType: "stock_movements", entityId: row.id || null, message: "Stok hareketinde urun/stok baglantisi eksik.", suggestedFix: "Stok hareketi sadece transaction engine uzerinden olusmali." }));
    }
    if (toMoney(row.quantity_delta ?? row.quantity ?? 0) === 0) {
      findings.push(finding({ severity: "ERROR", module: "STOCK", entityType: "stock_movements", entityId: row.id || null, message: "Stok hareket miktari 0 olamaz.", suggestedFix: "Kaynak stok transaction kontrol edilmeli." }));
    }
  });

  return findings;
}

export function checkStockMovementConsistency(data: { stockItems?: any[]; stockMovements?: any[] }): ReconciliationFinding[] {
  const movements = data.stockMovements || [];
  if (!movements.length) return [];

  return (data.stockItems || []).flatMap((stock) => {
    if (isCancelled(stock)) return [];
    const stockId = stock.id;
    const movementQty = sumMoney(movements
      .filter((movement) => sameId(movement.product_id, stockId) || sameId(movement.stock_id, stockId) || sameId(movement.related_stock_id, stockId))
      .map((movement) => movement.quantity_delta ?? movement.quantity ?? 0));
    const cardQty = toMoney(stock.quantity ?? stock.qty ?? (stock.module === "Cihaz" ? 1 : 0));
    if (compareMoney(movementQty, cardQty) !== 0) {
      return [
        finding({
          severity: "WARNING",
          module: "STOCK",
          entityType: "stock_items",
          entityId: stockId || null,
          message: "Stok karti miktari ile stock_movements toplami farkli.",
          expectedValue: movementQty,
          actualValue: cardQty,
          suggestedFix: "Otomatik duzeltme yok; stok transaction gecmisi incelenmeli.",
        }),
      ];
    }
    return [];
  });
}

export function checkCariMovementConsistency(data: { contacts?: any[]; cariMovements?: any[] }): ReconciliationFinding[] {
  const movements = data.cariMovements || [];
  if (!movements.length) return [];

  return (data.contacts || []).flatMap((contact) => {
    if (isCancelled(contact)) return [];
    const contactId = contact.id;
    const movementBalance = movements
      .filter((movement) => sameId(movement.contact_id, contactId))
      .reduce((sum, movement) => {
        const amount = rowAmount(movement);
        return movementDirection(movement) === "CREDIT" ? sum - amount : sum + amount;
      }, 0);
    const storedBalance = toMoney(contact.balance || 0);
    if (compareMoney(movementBalance, storedBalance) !== 0) {
      return [
        finding({
          severity: "WARNING",
          module: "CARI",
          entityType: "contacts",
          entityId: contactId || null,
          message: "Cari kart bakiyesi ile cari_movements toplamı farkli.",
          expectedValue: movementBalance,
          actualValue: storedBalance,
          suggestedFix: "Cari bakiye hareketlerden turetilmeli; otomatik update yapilmaz.",
        }),
      ];
    }
    return [];
  });
}

export function checkReturnExchangeConsistency(data: {
  returns?: any[];
  returnItems?: any[];
  exchanges?: any[];
  sales?: any[];
}): ReconciliationFinding[] {
  const findings: ReconciliationFinding[] = [];
  const returnItems = data.returnItems || [];
  const sales = data.sales || [];

  (data.returns || []).forEach((returnRow) => {
    const returnId = returnRow.id;
    if (!returnRow.sale_id) {
      findings.push(finding({ severity: "ERROR", module: "RETURN", entityType: "returns", entityId: returnId || null, message: "Iade kaydinda sale_id eksik.", suggestedFix: "Iade sadece satis baglantisiyla olusturulmali." }));
    } else if (sales.length && !sales.some((sale) => sameId(sale.id, returnRow.sale_id))) {
      findings.push(finding({ severity: "WARNING", module: "RETURN", entityType: "returns", entityId: returnId || null, message: "Iade kaydinin bagli satisi listede bulunamadi.", actualValue: returnRow.sale_id, suggestedFix: "Workspace veya silinmis satis durumu kontrol edilmeli." }));
    }
    if (!String(returnRow.reason || "").trim()) {
      findings.push(finding({ severity: "WARNING", module: "RETURN", entityType: "returns", entityId: returnId || null, message: "Iade nedeni bos.", suggestedFix: "Iade nedeni zorunlu olmali." }));
    }
    if (returnItems.length && !returnItems.some((item) => sameId(item.return_id, returnId))) {
      findings.push(finding({ severity: "ERROR", module: "RETURN", entityType: "returns", entityId: returnId || null, message: "Iade kaydi var ama return_items yok.", suggestedFix: "Urun bazli iade satirlari kontrol edilmeli." }));
    }
  });

  (data.exchanges || []).forEach((exchange) => {
    if (!exchange.old_sale_id || !exchange.new_sale_id) {
      findings.push(finding({ severity: "WARNING", module: "EXCHANGE", entityType: "exchanges", entityId: exchange.id || null, message: "Degisim kaydinda eski/yeni satis baglantisi eksik.", suggestedFix: "Degisim eski iade + yeni satis + fiyat farki olarak olusmali." }));
    }
    if (!String(exchange.reason || "").trim()) {
      findings.push(finding({ severity: "WARNING", module: "EXCHANGE", entityType: "exchanges", entityId: exchange.id || null, message: "Degisim nedeni bos.", suggestedFix: "Degisim nedeni zorunlu olmali." }));
    }
  });

  return findings;
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
    ...checkMovementIntegrity({
      cashMovements: data.cash_movements,
      bankMovements: data.bank_movements,
      posMovements: data.pos_movements,
      cariMovements: data.cari_movements,
      stockMovements: data.stock_movements,
    }),
    ...checkSalesConsistency({
      sales: data.sales,
      saleItems: data.sale_items,
      cashMovements: data.cash_movements,
      bankMovements: data.bank_movements,
      cariMovements: data.cari_movements,
      auditLogs: data.audit_logs,
    }),
    ...checkStockMovementConsistency({ stockItems: data.stock_items, stockMovements: data.stock_movements }),
    ...checkCariMovementConsistency({ contacts: data.contacts, cariMovements: data.cari_movements }),
    ...checkReturnExchangeConsistency({
      returns: data.returns,
      returnItems: data.return_items,
      exchanges: data.exchanges,
      sales: data.sales,
    }),
    ...checkLedgerBalance(data.business_transactions, data.ledger_entries),
  ];
}
