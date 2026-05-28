export class BusinessRuleError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code = "BUSINESS_RULE_ERROR", details?: unknown) {
    super(message);
    this.name = "BusinessRuleError";
    this.code = code;
    this.details = details;
  }
}

export class InsufficientStockError extends BusinessRuleError {
  constructor(message = "Stok yetersiz.", details?: unknown) {
    super(message, "INSUFFICIENT_STOCK", details);
    this.name = "InsufficientStockError";
  }
}

export class InvalidPaymentSplitError extends BusinessRuleError {
  constructor(message = "Odeme dagilimi islem toplamiyla uyumlu degil.", details?: unknown) {
    super(message, "INVALID_PAYMENT_SPLIT", details);
    this.name = "InvalidPaymentSplitError";
  }
}

export class MissingWorkspaceError extends BusinessRuleError {
  constructor(message = "workspace_id zorunludur.", details?: unknown) {
    super(message, "MISSING_WORKSPACE", details);
    this.name = "MissingWorkspaceError";
  }
}

export class MissingAuditError extends BusinessRuleError {
  constructor(message = "Audit kaydi zorunludur.", details?: unknown) {
    super(message, "MISSING_AUDIT", details);
    this.name = "MissingAuditError";
  }
}

export class DuplicateTransactionError extends BusinessRuleError {
  constructor(message = "Bu islem daha once kaydedilmis.", details?: unknown) {
    super(message, "DUPLICATE_TRANSACTION", details);
    this.name = "DuplicateTransactionError";
  }
}

export class LedgerBalanceError extends BusinessRuleError {
  constructor(message = "Ledger debit/credit dengesi bozuk.", details?: unknown) {
    super(message, "LEDGER_BALANCE_ERROR", details);
    this.name = "LedgerBalanceError";
  }
}

export class MissingCustomerError extends BusinessRuleError {
  constructor(message = "Cari/musteri baglantisi zorunludur.", details?: unknown) {
    super(message, "MISSING_CUSTOMER", details);
    this.name = "MissingCustomerError";
  }
}

export class MissingReasonError extends BusinessRuleError {
  constructor(message = "Islem nedeni zorunludur.", details?: unknown) {
    super(message, "MISSING_REASON", details);
    this.name = "MissingReasonError";
  }
}

export class InvalidReturnError extends BusinessRuleError {
  constructor(message = "Iade islemi gecersiz.", details?: unknown) {
    super(message, "INVALID_RETURN", details);
    this.name = "InvalidReturnError";
  }
}

export class InvalidExchangeError extends BusinessRuleError {
  constructor(message = "Degisim islemi gecersiz.", details?: unknown) {
    super(message, "INVALID_EXCHANGE", details);
    this.name = "InvalidExchangeError";
  }
}
