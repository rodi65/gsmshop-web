import { supabase } from "../lib/supabase";

const MAIN_ACCOUNT_EMAIL = "ahmetsenltd@gmail.com";
let workspaceSession = {
  userId: "",
  profile: null,
  workspaceId: "",
};

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  workspaceSession = { userId: "", profile: null, workspaceId: "" };
}

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function defaultWorkspaceIdForUser(user) {
  if (!user?.id) return "";
  return normalizedEmail(user.email) === MAIN_ACCOUNT_EMAIL ? "main" : user.id;
}

export function setCurrentWorkspaceId(workspaceId) {
  const cleanWorkspaceId = String(workspaceId || "").trim();
  workspaceSession = {
    ...workspaceSession,
    profile: workspaceSession.profile ? { ...workspaceSession.profile, workspace_id: cleanWorkspaceId } : null,
    workspaceId: cleanWorkspaceId,
  };
}

export async function ensureUserProfile(userArg) {
  const user = userArg || await getCurrentUser();
  if (!user?.id) return null;

  if (workspaceSession.userId === user.id && workspaceSession.profile && workspaceSession.workspaceId) {
    return workspaceSession.profile;
  }

  const defaultWorkspaceId = defaultWorkspaceIdForUser(user);
  const isMainAccount = normalizedEmail(user.email) === MAIN_ACCOUNT_EMAIL;

  const { data: existing, error: findError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (findError) throw findError;

  if (!existing) {
    const profilePayload = {
      id: user.id,
      email: user.email || "",
      workspace_id: defaultWorkspaceId,
      role: isMainAccount ? "owner" : "staff",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert([profilePayload], { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    workspaceSession = { userId: user.id, profile: data, workspaceId: data.workspace_id || defaultWorkspaceId };
    return data;
  }

  const workspaceId = isMainAccount ? "main" : existing.workspace_id || defaultWorkspaceId;
  const shouldUpdate =
    existing.workspace_id !== workspaceId ||
    existing.email !== user.email ||
    (!existing.role && isMainAccount);

  if (shouldUpdate) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        email: user.email || existing.email || "",
        workspace_id: workspaceId,
        role: existing.role || (isMainAccount ? "owner" : "staff"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;
    workspaceSession = { userId: user.id, profile: data, workspaceId: data.workspace_id || workspaceId };
    return data;
  }

  workspaceSession = { userId: user.id, profile: existing, workspaceId };
  return existing;
}

export async function getCurrentProfile() {
  return ensureUserProfile();
}

export async function getCurrentWorkspaceId() {
  const profile = await ensureUserProfile();
  const user = await getCurrentUser();
  const workspaceId = profile?.workspace_id || defaultWorkspaceIdForUser(user);
  setCurrentWorkspaceId(workspaceId);
  return workspaceId;
}

function toDbNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || "0")
    .replace(/TL/g, "")
    .replace(/₺/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[^0-9-]/g, "");
  return Number(cleaned || 0);
}

function isMissingRelationError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || message.includes("could not find the table") || message.includes("does not exist");
}

function isMissingSchemaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return isMissingRelationError(error) || error?.code === "42703" || message.includes("column") && message.includes("does not exist");
}

async function safeWorkspaceRows(tableName, workspaceId, { orderColumn = "created_at", ascending = false, limit = 5000 } = {}) {
  try {
    let query = supabase.from(tableName).select("*").eq("workspace_id", workspaceId);
    if (orderColumn) query = query.order(orderColumn, { ascending });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) {
      if (isMissingSchemaError(error)) {
        console.warn(`${tableName} tablosu/kolonu hazır değil; Sistem Kontrol bu kaynağı boş kabul edecek.`, error);
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.warn(`${tableName} okunamadı; Sistem Kontrol bu kaynağı boş kabul edecek.`, error);
      return [];
    }
    throw error;
  }
}

async function safeWorkspaceTable(tableName, workspaceId, options = {}) {
  const { orderColumn = "created_at", ascending = false, limit = 5000 } = options;
  try {
    let query = supabase.from(tableName).select("*").eq("workspace_id", workspaceId);
    if (orderColumn) query = query.order(orderColumn, { ascending });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) {
      if (isMissingSchemaError(error)) {
        console.warn(`${tableName} tablosu/kolonu hazır değil; Sistem Kontrol bu kaynağı boş kabul edecek.`, error);
        return { table: tableName, ready: false, rows: [], message: error.message || "Tablo veya kolon bulunamadı." };
      }
      throw error;
    }
    return { table: tableName, ready: true, rows: data || [], message: "" };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return { table: tableName, ready: false, rows: [], message: error.message || "Tablo veya kolon bulunamadı." };
    }
    throw error;
  }
}

function isMissingRpcError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    error?.code === "42883" ||
    message.includes("could not find the function") ||
    message.includes("function") && message.includes("schema cache")
  );
}

function financialRpcMissingError(error) {
  const wrapped = new Error("Finansal güvenlik fonksiyonu kurulmamış. Supabase SQL migration çalıştırılmalı.");
  wrapped.cause = error;
  return wrapped;
}

function isMissingTechnicalServiceFinanceColumn(error) {
  const message = String(error?.message || "").toLowerCase();
  const missingColumnCodes = new Set(["42703", "PGRST204", "PGRST205"]);
  const mentionsMissingColumn =
    message.includes("could not find") ||
    message.includes("column") && (message.includes("does not exist") || message.includes("schema cache"));
  return (
    (missingColumnCodes.has(error?.code) || mentionsMissingColumn) &&
    (
      message.includes("related_service_id") ||
      message.includes("service_record_id") ||
      message.includes("reference_id") ||
      message.includes("related_id")
    )
  );
}

function technicalServiceFinanceColumnsError(error) {
  const wrapped = new Error("Teknik servis banka bağlantı kolonları Supabase’de eksik. bank_movements_related_id_fix_20260525.sql dosyasını SQL Editor’da çalıştırın.");
  wrapped.cause = error;
  return wrapped;
}

function isTechnicalServiceMovementTypeError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("movement_type") && (message.includes("check constraint") || message.includes("violates"));
}

function technicalServiceMovementTypeError(error) {
  const wrapped = new Error("Supabase teknik servis finans SQL migration çalıştırılmalı. technical_service_movement_type_fix_20260525.sql dosyasını SQL Editor’da çalıştırın.");
  wrapped.cause = error;
  return wrapped;
}

async function callFinancialRpc(name, payload, missingMessage = "") {
  const { data, error } = await supabase.rpc(name, payload);
  if (error) {
    if (isMissingRpcError(error)) {
      if (missingMessage) {
        const wrapped = new Error(missingMessage);
        wrapped.cause = error;
        throw wrapped;
      }
      throw financialRpcMissingError(error);
    }
    throw error;
  }
  return data;
}

function makeIdempotencyKey(prefix, parts = []) {
  const randomPart = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return [prefix, ...parts, randomPart]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(":");
}

async function callBusinessTransactionRpc(name, payload) {
  const { data, error } = await supabase.rpc(name, { payload });
  if (error) {
    if (isMissingRpcError(error)) {
      const wrapped = new Error(`${name} merkezi transaction RPC kurulmamış. İşlem durduruldu; eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.`);
      wrapped.cause = error;
      throw wrapped;
    }
    throw error;
  }
  return { applied: true, data };
}

async function fetchWorkspaceRecord(tableName, id, workspaceId) {
  if (!id) return null;
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function createAuditLog({
  tableName,
  recordId,
  action = "UPDATE",
  eventType = "",
  reason = "",
  oldData = null,
  newData = null,
  metadata = {},
  requestKey = "",
  workspaceId: workspaceIdArg = "",
  strict = false,
} = {}) {
  try {
    const workspaceId = workspaceIdArg || await getCurrentWorkspaceId();
    const { data, error } = await supabase.rpc("create_audit_log", {
      p_workspace_id: workspaceId,
      p_table_name: tableName || "unknown",
      p_record_id: recordId ? String(recordId) : null,
      p_action: action,
      p_event_type: eventType || null,
      p_reason: reason || null,
      p_old_data: oldData,
      p_new_data: newData,
      p_metadata: metadata || {},
      p_request_key: requestKey || null,
    });

    if (error) {
      if (isMissingRpcError(error) || isMissingRelationError(error)) {
        if (strict) {
          const wrapped = new Error("Audit log RPC kurulmamış. Kritik işlem audit kaydı olmadan tamamlanamaz.");
          wrapped.cause = error;
          throw wrapped;
        }
        console.warn("Audit log RPC kurulmamış; işlem devam etti.", error);
        return null;
      }
      if (strict) throw error;
      console.warn("Audit log Supabase'e yazılamadı; işlem devam etti.", error);
      return null;
    }

    return data || null;
  } catch (error) {
    if (strict) throw error;
    console.warn("Audit log hazırlanamadı; işlem devam etti.", error);
    return null;
  }
}

function criticalOperationKey(operationType, targetTable, targetId) {
  return [operationType, targetTable, targetId]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(":");
}

function idempotencyUnavailable(error) {
  return isMissingRpcError(error) || isMissingRelationError(error);
}

export async function tryBeginIdempotency({
  operationType,
  targetTable = "",
  targetId = "",
  payload = {},
  operationKey = "",
  workspaceId: workspaceIdArg = "",
} = {}) {
  const workspaceId = workspaceIdArg || await getCurrentWorkspaceId();
  const key = operationKey || criticalOperationKey(operationType, targetTable, targetId);

  if (!key) {
    throw new Error("Idempotency anahtarı oluşturulamadı. Kritik işlem durduruldu.");
  }

  const requestPayload = (() => {
    try {
      return JSON.parse(JSON.stringify(payload || {}));
    } catch {
      return {};
    }
  })();

  try {
    const { data, error } = await supabase.rpc("try_begin_idempotency_key", {
      p_workspace_id: workspaceId,
      p_operation_key: key,
      p_operation_type: operationType || "unknown",
      p_target_table: targetTable || null,
      p_target_id: targetId ? String(targetId) : null,
      p_request_payload: requestPayload,
    });

    if (error) {
      if (idempotencyUnavailable(error)) {
        const wrapped = new Error("Idempotency RPC kurulmamış. Çift kayıt riski nedeniyle işlem durduruldu.");
        wrapped.cause = error;
        throw wrapped;
      }
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: row?.allowed !== false,
      operationKey: key,
      workspaceId,
      status: row?.existing_status || "",
      result: row?.existing_result || null,
      keyId: row?.key_id || "",
      missing: false,
    };
  } catch (error) {
    if (idempotencyUnavailable(error)) {
      const wrapped = new Error("Idempotency kontrolü yapılamadı. Çift kayıt riski nedeniyle işlem durduruldu.");
      wrapped.cause = error;
      throw wrapped;
    }
    throw error;
  }
}

export async function completeIdempotency({
  operationKey,
  status = "completed",
  result = {},
  workspaceId: workspaceIdArg = "",
} = {}) {
  if (!operationKey) return null;

  const workspaceId = workspaceIdArg || await getCurrentWorkspaceId();
  const resultPayload = (() => {
    try {
      return JSON.parse(JSON.stringify(result || {}));
    } catch {
      return {};
    }
  })();

  const { data, error } = await supabase.rpc("complete_idempotency_key", {
    p_workspace_id: workspaceId,
    p_operation_key: operationKey,
    p_status: status,
    p_result_payload: resultPayload,
  });

  if (error) {
    if (idempotencyUnavailable(error)) {
      const wrapped = new Error("Idempotency tamamlanamadı. İşlem sonucu güvenli şekilde işaretlenemedi.");
      wrapped.cause = error;
      throw wrapped;
    }
    throw error;
  }

  return data;
}

function sellerContactName(value) {
  const clean = String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
  if (!clean) return "";
  return clean.startsWith("SATICI ") ? clean : `SATICI ${clean}`;
}

function isSellerLabel(value) {
  return String(value || "").trim().toLocaleUpperCase("tr-TR").startsWith("SATICI ");
}

function stockSellerName(item) {
  const directName = item.seller_person || item.seller_name || item.seller_cari_name;
  if (directName) return sellerContactName(directName);
  if (isSellerLabel(item.supplier_name)) return sellerContactName(item.supplier_name);
  if (item.acquisition_type === "Müşteri" && item.supplier_name) return sellerContactName(item.supplier_name);
  return "";
}

export async function loadBankBalances(workspaceIdArg) {
  const workspaceId = workspaceIdArg || await getCurrentWorkspaceId();
  const { data, error } = await supabase.rpc("get_bank_balances", { p_workspace_id: workspaceId });

  if (error) {
    if (isMissingRpcError(error) || isMissingRelationError(error)) {
      console.warn("Banka bakiye RPC kurulmamış; geçici olarak frontend hareket toplamları kullanılacak.", error);
      return [];
    }
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function loadDashboardData() {
  const profile = await getCurrentProfile();
  const workspaceId = profile?.workspace_id || await getCurrentWorkspaceId();
  const [
    stock,
    sales,
    expenses,
    bank,
    closings,
    cash,
    contacts,
    auditLogsTable,
    businessTransactionsTable,
    ledgerEntriesTable,
    saleItemsTable,
    stockMovementsTable,
    cariMovementsTable,
    returnsTable,
    returnItemsTable,
    exchangesTable,
    posMovementsTable,
    technicalServicesTable,
  ] = await Promise.all([
    supabase.from("stock_items").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("sales").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.neq.deleted").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("bank_movements").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("cash_closings").select("*").eq("workspace_id", workspaceId).order("closing_date", { ascending: false }),
    supabase.from("cash_movements").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    safeWorkspaceTable("audit_logs", workspaceId, { orderColumn: "changed_at", ascending: false }),
    safeWorkspaceTable("business_transactions", workspaceId),
    safeWorkspaceTable("ledger_entries", workspaceId),
    safeWorkspaceTable("sale_items", workspaceId),
    safeWorkspaceTable("stock_movements", workspaceId),
    safeWorkspaceTable("cari_movements", workspaceId),
    safeWorkspaceTable("returns", workspaceId),
    safeWorkspaceTable("return_items", workspaceId),
    safeWorkspaceTable("exchanges", workspaceId),
    safeWorkspaceTable("pos_movements", workspaceId),
    safeWorkspaceTable("technical_services", workspaceId),
  ]);

  for (const response of [stock, sales, expenses, bank, closings]) {
    if (response.error) throw response.error;
  }

  if (cash.error && !isMissingRelationError(cash.error)) throw cash.error;
  if (contacts.error && !isMissingRelationError(contacts.error)) throw contacts.error;

  let bankBalances = [];
  try {
    bankBalances = await loadBankBalances(workspaceId);
  } catch (error) {
    console.warn("Banka bakiyeleri Supabase RPC üzerinden alınamadı; hareketlerden yerel türetme kullanılacak.", error);
  }

  return {
    profile,
    workspaceId,
    stock: stock.data || [],
    sales: sales.data || [],
    expenses: expenses.data || [],
    bankMovements: bank.data || [],
    bankBalances,
    cashClosings: closings.data || [],
    cashMovements: cash.error ? [] : cash.data || [],
    contacts: contacts.error ? [] : contacts.data || [],
    auditLogs: auditLogsTable.rows,
    businessTransactions: businessTransactionsTable.rows,
    ledgerEntries: ledgerEntriesTable.rows,
    saleItems: saleItemsTable.rows,
    stockMovements: stockMovementsTable.rows,
    cariMovements: cariMovementsTable.rows,
    returns: returnsTable.rows,
    returnItems: returnItemsTable.rows,
    exchanges: exchangesTable.rows,
    posMovements: posMovementsTable.rows,
    technicalServices: technicalServicesTable.rows,
    schemaStatus: [
      auditLogsTable,
      businessTransactionsTable,
      ledgerEntriesTable,
      saleItemsTable,
      stockMovementsTable,
      cariMovementsTable,
      returnsTable,
      returnItemsTable,
      exchangesTable,
      posMovementsTable,
      technicalServicesTable,
    ].map(({ table, ready, message, rows }) => ({ table, ready, message, rowCount: rows.length })),
  };
}

export async function resetAllTestData() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocalhost) {
    throw new Error("Test sıfırlama sadece localhost ortamında çalıştırılabilir.");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) throw new Error("Aktif workspace bulunamadı.");

  const tables = [
    "ledger_entries",
    "return_items",
    "returns",
    "exchanges",
    "sale_items",
    "stock_movements",
    "cari_movements",
    "pos_movements",
    "cash_movements",
    "bank_movements",
    "cash_closings",
    "expenses",
    "sales",
    "technical_services",
    "stock_items",
    "contacts",
    "business_transactions",
    "audit_logs",
  ];

  const results = [];
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("workspace_id", workspaceId);

    if (error) {
      if (isMissingRelationError(error)) {
        results.push({ table, ok: false, skipped: true, message: "Tablo bulunamadı." });
        continue;
      }
      console.error("Test verisi sıfırlama hatası", { table, error });
      results.push({ table, ok: false, skipped: false, message: error.message || String(error) });
      continue;
    }

    results.push({ table, ok: true, skipped: false, message: "Temizlendi." });
  }

  return { workspaceId, results };
}

export async function findOrCreateContact({ kind, name, phone = "", balance = 0, balanceType = "receivable", note = "" }) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const cleanName = String(name || "").trim();
  const requestedBalance = toDbNumber(balance);
  if (!cleanName) return null;
  if (requestedBalance !== 0) {
    throw new Error("Cari bakiyesi doğrudan güncellenemez. Cari etki merkezi transaction/RPC hareketiyle oluşturulmalıdır.");
  }

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .ilike("name", cleanName)
    .or("status.is.null,status.eq.active")
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { data, error } = await supabase
      .from("contacts")
      .update({
        phone: phone || existing.phone,
        balance_type: balanceType || existing.balance_type,
        note: note || existing.note,
        status: "active",
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert([{
      kind,
      name: cleanName,
      phone,
      balance: 0,
      balance_type: balanceType,
      workspace_id: workspaceId,
      note,
      status: "active",
      created_by: user?.id,
      updated_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createCashMovement(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const serviceReferenceId = payload.related_service_id || payload.service_record_id || payload.reference_id || (
    payload.related_table === "technical_services" ? payload.related_id : ""
  );

  const cashTransaction = await callBusinessTransactionRpc("ceplog_record_cash_movement_transaction", {
    workspace_id: workspaceId,
    actor_id: user?.id || null,
    idempotency_key: payload.idempotency_key || makeIdempotencyKey("cash-movement", [
      payload.movement_type,
      payload.direction,
      payload.related_table,
      payload.related_id,
      serviceReferenceId,
      payload.amount,
    ]),
    movement_type: payload.movement_type,
    direction: payload.direction,
    amount: toDbNumber(payload.amount),
    note: payload.note || "",
    related_table: payload.related_table || null,
    related_id: payload.related_id || null,
    related_service_id: serviceReferenceId || null,
    service_record_id: serviceReferenceId || null,
    reference_id: serviceReferenceId || payload.reference_id || null,
  });

  if (!cashTransaction.applied) {
    throw new Error("Kasa hareketi merkezi transaction RPC sonucu uygulanmadı. Eski direkt cash_movements yazımı güvenlik nedeniyle çalıştırılmadı.");
  }

  const movementId = cashTransaction.data?.reference_id || cashTransaction.data?.referenceId || cashTransaction.data?.movement_id || cashTransaction.data?.movementId;
  return await fetchWorkspaceRecord("cash_movements", movementId, workspaceId) || cashTransaction.data;
}

export async function createBankMovement(payload) {
  void payload;
  throw new Error("Banka hareketi doğrudan yazılamaz. Banka/POS etkisi sadece merkezi transaction RPC üzerinden oluşturulmalıdır.");
}

export async function createTechnicalServiceWithEffects(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const serviceId = payload.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const result = await callBusinessTransactionRpc("ceplog_record_technical_service_transaction", {
    workspace_id: workspaceId,
    actor_id: user?.id || null,
    idempotency_key: makeIdempotencyKey("technical-service", [serviceId]),
    service: {
      ...payload,
      id: serviceId,
      estimated_price: toDbNumber(payload.estimatedPrice ?? payload.estimated_price),
      cash_deposit: toDbNumber(payload.cashDeposit ?? payload.cash_deposit),
      card_deposit: toDbNumber(payload.cardDeposit ?? payload.card_deposit),
      deposit: toDbNumber(payload.deposit),
      bank_name: payload.bank || payload.bank_name || "",
    },
    payments: {
      cash_amount: toDbNumber(payload.cashDeposit ?? payload.cash_deposit),
      card_amount: toDbNumber(payload.cardDeposit ?? payload.card_deposit),
      bank_name: payload.bank || payload.bank_name || "",
    },
    note: payload.note || "",
  });

  const recordId = result.data?.reference_id || result.data?.referenceId || result.data?.service_id || result.data?.serviceId || serviceId;
  return await fetchWorkspaceRecord("technical_services", recordId, workspaceId) || result.data;
}

export async function recordTechnicalServiceFinanceWithEffects(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const result = await callBusinessTransactionRpc("ceplog_record_technical_service_finance_transaction", {
    workspace_id: workspaceId,
    actor_id: user?.id || null,
    idempotency_key: makeIdempotencyKey("technical-service-finance", [payload.serviceId || payload.service_id, payload.mode]),
    service_id: payload.serviceId || payload.service_id,
    mode: payload.mode,
    amount: toDbNumber(payload.amount),
    method: payload.method || "Nakit",
    bank_name: payload.bank || payload.bank_name || "",
    note: payload.note || "",
  });

  const recordId = payload.serviceId || payload.service_id || result.data?.reference_id || result.data?.service_id;
  return recordId ? await fetchWorkspaceRecord("technical_services", recordId, workspaceId) || result.data : result.data;
}

export async function updateTechnicalServiceRecord(id, payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const { data, error } = await supabase
    .from("technical_services")
    .update({
      status: payload.status,
      repair_action: payload.repairAction ?? payload.repair_action,
      note: payload.note,
      payload: payload.payload || payload,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error("technical_services tablosu kurulmamış. Teknik servis kayıtları localStorage yerine Supabase tablosuna taşınmalıdır.");
    }
    throw error;
  }
  return data;
}

export async function createContactPayment({ kind, name, phone = "", amount, currentBalance = 0, notePrefix = "Cari ödeme" }) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const cleanName = String(name || "").trim();
  const paymentAmount = toDbNumber(amount);

  if (!cleanName) throw new Error("Cari adı boş olamaz.");
  if (!paymentAmount) throw new Error("Ödeme tutarı yaz.");

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .ilike("name", cleanName)
    .or("status.is.null,status.eq.active")
    .maybeSingle();

  if (findError) throw findError;

  let contact = existing;

  if (!contact) {
    throw new Error("Cari ödeme için mevcut cari kaydı bulunamadı. Cari kayıt ve bakiye merkezi satış/alım transaction akışından oluşmalıdır.");
  }

  const movementId = await callFinancialRpc("record_contact_payment", {
    p_contact_id: contact.id,
    p_workspace_id: workspaceId,
    p_amount: paymentAmount,
    p_note: `${notePrefix} - ${cleanName}`,
  });

  return { contact: { ...contact, balance: Math.max(toDbNumber(contact.balance) - paymentAmount, 0) }, movement: { id: movementId } };
}

export async function createReceivablePayment({ saleId, customerName = "", amount, currentRemaining = 0 }) {
  const workspaceId = await getCurrentWorkspaceId();
  const paymentAmount = toDbNumber(amount);

  if (!saleId) throw new Error("Alacak kaydı seçilemedi.");
  if (!paymentAmount) throw new Error("Tahsilat tutarını yaz.");

  const collectionTransaction = await callBusinessTransactionRpc("ceplog_record_collection_transaction", {
    workspace_id: workspaceId,
    actor_id: null,
    idempotency_key: makeIdempotencyKey("collection", [saleId]),
    sale_id: saleId,
    customer_id: null,
    customer_name: customerName || "",
    amount: paymentAmount,
    payment_method: "CASH",
    note: `Alacak ödemesi - ${customerName || "Müşteri"}`,
  });

  if (collectionTransaction.applied) {
    return {
      sale: { id: saleId, remaining_amount: Math.max(toDbNumber(currentRemaining) - paymentAmount, 0) },
      movement: { id: collectionTransaction.data?.reference_id || collectionTransaction.data?.movement_id || "" },
      transaction: collectionTransaction.data,
    };
  }
  throw new Error("Cari tahsilat merkezi transaction RPC sonucu uygulanmadı. Eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.");
}

export async function repairStockSideEffects(stockItems = [], cashMovements = [], contacts = []) {
  void stockItems;
  void cashMovements;
  void contacts;
  throw new Error("Otomatik stok finans onarımı kapalıdır. Eksik kasa/cari etkileri sadece merkezi transaction/RPC ve audit ile oluşturulabilir.");
}

export async function createStockItem(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const paid = toDbNumber(payload.supplier_paid);
  const buyTotal = toDbNumber(payload.buy_price) * Number(payload.quantity || 1);
  if (paid > buyTotal) throw new Error("Ödeme tutarı alış tutarını aşamaz.");
  const remaining = Math.max(buyTotal - paid, 0);
  const sellerName = stockSellerName(payload);
  const paymentName = sellerName || payload.supplier_name || "";
  const isSecondHandPhoneSeller =
    payload.module === "Cihaz" &&
    payload.device_type === "Telefon" &&
    payload.category === "İkinci El" &&
    Boolean(sellerName);
  const sellerRemaining = Number(payload.seller_cari_remaining || 0);
  const isSellerPurchase = payload.acquisition_type === "Müşteri" || isSecondHandPhoneSeller || (sellerRemaining > 0 && Boolean(sellerName));
  const stockPayload = { ...payload };
  if (remaining > 0 && isSellerPurchase && !sellerRemaining) {
    stockPayload.seller_cari_remaining = remaining;
  }

  const stockTransaction = await callBusinessTransactionRpc("ceplog_record_stock_purchase_transaction", {
    workspace_id: workspaceId,
    actor_id: user?.id || null,
    idempotency_key: makeIdempotencyKey("stock-purchase", [stockPayload.barcode || stockPayload.imei || stockPayload.product_name]),
    module: stockPayload.module || "",
    device_type: stockPayload.device_type || "",
    category: stockPayload.category || "",
    sub_type: stockPayload.sub_type || "",
    brand: stockPayload.brand || "",
    model: stockPayload.model || "",
    memory: stockPayload.memory || "",
    product_name: stockPayload.product_name || "Ürün",
    barcode: stockPayload.barcode || "",
    imei: stockPayload.imei || "",
    buy_price: toDbNumber(stockPayload.buy_price),
    sell_price: toDbNumber(stockPayload.sell_price),
    quantity: Number(stockPayload.quantity || 1),
    supplier_name: stockPayload.supplier_name || "",
    supplier_paid: toDbNumber(stockPayload.supplier_paid),
    seller_person: stockPayload.seller_person || "",
    seller_phone: stockPayload.seller_phone || "",
    acquisition_type: stockPayload.acquisition_type || "",
    seller_cari_remaining: Number(stockPayload.seller_cari_remaining || 0),
    note: stockPayload.note || "",
  });

  if (stockTransaction.applied) {
    const stockId = stockTransaction.data?.reference_id || stockTransaction.data?.referenceId || stockTransaction.data?.stock_id || stockTransaction.data?.stockId;
    return await fetchWorkspaceRecord("stock_items", stockId, workspaceId) || stockTransaction.data;
  }
  throw new Error("Stok alış merkezi transaction RPC sonucu uygulanmadı. Eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.");
}

export async function createSale(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  const salePayload = {
    ...payload,
    workspace_id: workspaceId,
    total_amount: toDbNumber(payload.total_amount),
    cash_amount: toDbNumber(payload.cash_amount),
    card_amount: toDbNumber(payload.card_amount),
    remaining_amount: toDbNumber(payload.remaining_amount),
    buy_cost: toDbNumber(payload.buy_cost),
    profit_amount: toDbNumber(payload.profit_amount),
    created_by: user?.id,
    updated_by: user?.id,
  };

  if (salePayload.cash_amount + salePayload.card_amount > salePayload.total_amount) {
    throw new Error("Nakit + kart toplamı satış fiyatını aşamaz.");
  }

  const saleTransaction = await callBusinessTransactionRpc("ceplog_apply_sale_transaction", {
    workspace_id: workspaceId,
    actor_id: user?.id || null,
    idempotency_key: makeIdempotencyKey("sale", [salePayload.stock_item_id || salePayload.product_name]),
    customer_id: null,
    customer_name: salePayload.customer_name || "",
    customer_phone: salePayload.customer_phone || "",
    cari_person: salePayload.cari_person || salePayload.customer_name || "",
    sale_group: salePayload.sale_group || "",
    sale_type: salePayload.sale_type || "",
    bank_name: salePayload.bank_name || "",
    items: [{
      product_type: salePayload.sale_group || salePayload.sale_type || "sale",
      product_id: salePayload.stock_item_id || "",
      imei: salePayload.imei || "",
      quantity: 1,
      unit_cost_at_sale: salePayload.buy_cost,
      unit_price_at_sale: salePayload.total_amount,
      discount_amount: 0,
      line_total: salePayload.total_amount,
      line_profit: salePayload.profit_amount,
      product_name: salePayload.product_name || "Satış",
    }],
    payments: {
      cash_amount: salePayload.cash_amount,
      card_amount: salePayload.card_amount,
      bank_amount: 0,
      cari_amount: salePayload.remaining_amount,
    },
    note: salePayload.note || "",
    metadata: { legacyPayload: salePayload },
  });

  if (saleTransaction.applied) {
    const saleId = saleTransaction.data?.reference_id || saleTransaction.data?.referenceId || saleTransaction.data?.sale_id || saleTransaction.data?.saleId;
    return await fetchWorkspaceRecord("sales", saleId, workspaceId) || saleTransaction.data;
  }
  throw new Error("Satış merkezi transaction RPC sonucu uygulanmadı. Eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.");
}

export async function createExpense(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  if (payload.category === "Borç" && !String(payload.note || "").trim()) {
    throw new Error("Borç giderinde Not zorunludur.");
  }

  const expenseTransaction = await callBusinessTransactionRpc("ceplog_record_expense_transaction", {
    workspace_id: workspaceId,
    actor_id: user?.id || null,
    idempotency_key: makeIdempotencyKey("expense", [payload.category, payload.amount]),
    category: payload.category || "Gider",
    sub_category: payload.sub_category || "",
    amount: toDbNumber(payload.amount),
    payment_method: payload.payment_method || payload.paymentMethod || "CASH",
    supplier_id: payload.supplier_id || null,
    note: payload.note || payload.category || "Gider",
  });

  if (expenseTransaction.applied) {
    const expenseId = expenseTransaction.data?.reference_id || expenseTransaction.data?.referenceId || expenseTransaction.data?.expense_id || expenseTransaction.data?.expenseId;
    return await fetchWorkspaceRecord("expenses", expenseId, workspaceId) || expenseTransaction.data;
  }
  throw new Error("Gider merkezi transaction RPC sonucu uygulanmadı. Eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.");
}

export async function createBankWithdrawal(payload) {
  await getCurrentUser();
  await getCurrentWorkspaceId();
  if (!payload.bank_name) throw new Error("Banka seçmek zorunludur.");
  throw new Error("Bankadan kasaya aktarım merkezi RPC transaction'a bağlanmadan aktif değildir. Yarım banka/kasa hareketi oluşturmamak için işlem durduruldu.");
}

export async function updateSaleRecord(id, payload) {
  const workspaceId = await getCurrentWorkspaceId();
  const { data: saleBeforeUpdate, error: saleBeforeError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (saleBeforeError) console.warn("Satış audit eski kayıt okunamadı.", saleBeforeError);

  const updatePayload = {
    total_amount: toDbNumber(payload.total_amount),
    cash_amount: toDbNumber(payload.cash_amount),
    card_amount: toDbNumber(payload.card_amount),
    remaining_amount: toDbNumber(payload.remaining_amount),
    bank_name: payload.bank_name || "",
    customer_name: payload.customer_name || payload.cari_person || "",
    customer_phone: payload.customer_phone || "",
    product_name: payload.product_name || "",
    buy_cost: toDbNumber(payload.buy_cost),
    profit_amount: toDbNumber(payload.profit_amount),
  };

  const data = await callFinancialRpc("update_sale_with_effects", {
    p_sale_id: id,
    p_workspace_id: workspaceId,
    p_total_amount: updatePayload.total_amount,
    p_cash_amount: updatePayload.cash_amount,
    p_card_amount: updatePayload.card_amount,
    p_remaining_amount: updatePayload.remaining_amount,
    p_bank_name: updatePayload.bank_name,
    p_customer_name: updatePayload.customer_name,
    p_customer_phone: updatePayload.customer_phone,
    p_product_name: updatePayload.product_name,
    p_buy_cost: updatePayload.buy_cost,
    p_profit_amount: updatePayload.profit_amount,
    p_cari_person: payload.cari_person || payload.customer_name || "",
  }, "Satış düzeltme transaction fonksiyonu kurulmamış. Supabase central_financial_rpc_phase1_20260528.sql dosyasını SQL Editor’da tekrar çalıştırın.");

  await createAuditLog({
    tableName: "sales",
    recordId: id,
    action: "UPDATE",
    eventType: "sale_update",
    reason: "Satış düzeltmesi",
    oldData: saleBeforeUpdate || null,
    newData: data || null,
    metadata: { fields: Object.keys(updatePayload) },
    workspaceId,
  });

  return data;
}

export async function updateStockItem(id, payload) {
  const workspaceId = await getCurrentWorkspaceId();
  const { data: stockBeforeUpdate, error: stockBeforeError } = await supabase
    .from("stock_items")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (stockBeforeError) console.warn("Stok audit eski kayıt okunamadı.", stockBeforeError);

  const buyTotal = toDbNumber(payload.buy_price) * Number(payload.quantity || 0);
  const paid = toDbNumber(payload.supplier_paid) + toDbNumber(payload.bank_paid);
  if (paid > buyTotal) throw new Error("Ödeme tutarı alış tutarını aşamaz.");
  const result = await callFinancialRpc("update_stock_with_effects", {
    p_stock_id: id,
    p_workspace_id: workspaceId,
    p_buy_price: toDbNumber(payload.buy_price),
    p_sell_price: toDbNumber(payload.sell_price),
    p_quantity: Number(payload.quantity || 0),
    p_supplier_name: payload.supplier_name || "",
    p_supplier_paid: toDbNumber(payload.supplier_paid),
    p_category: payload.category || "",
    p_seller_person: payload.seller_person || "",
    p_seller_phone: payload.seller_phone || "",
    p_bank_paid: toDbNumber(payload.bank_paid),
    p_bank_name: payload.bank_name || "",
    p_product_name: payload.product_name || "",
  }, "Alım düzeltme transaction fonksiyonu kurulmamış. Supabase central_financial_rpc_phase1_20260528.sql dosyasını SQL Editor’da tekrar çalıştırın.");

  const { data: stockAfterUpdate, error: stockAfterError } = await supabase
    .from("stock_items")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (stockAfterError) console.warn("Stok audit yeni kayıt okunamadı.", stockAfterError);

  await createAuditLog({
    tableName: "stock_items",
    recordId: id,
    action: "UPDATE",
    eventType: "stock_update",
    reason: "Stok düzeltmesi",
    oldData: stockBeforeUpdate || null,
    newData: stockAfterUpdate || null,
    metadata: {
      fields: Object.keys(payload || {}),
      rpcResult: result || null,
    },
    workspaceId,
  });

  return result;
}

export async function refundSaleWithEffects(id, reason = "Satış iadesi") {
  const workspaceId = await getCurrentWorkspaceId();
  const { data: saleBeforeRefund, error: saleReadError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (saleReadError) throw saleReadError;
  if (!saleBeforeRefund) throw new Error("İade edilecek satış kaydı bulunamadı.");

  const saleStatus = String(saleBeforeRefund.status || "").toLowerCase();
  if (["deleted", "cancelled", "canceled", "iptal", "iade", "refunded", "refund"].includes(saleStatus)) {
    throw new Error("Bu satış daha önce iptal/iade edilmiş. İkinci kez iade edilemez.");
  }

  const idempotency = await tryBeginIdempotency({
    operationType: "refund_sale",
    targetTable: "sales",
    targetId: id,
    operationKey: criticalOperationKey("refund_sale", "sales", id),
    payload: { saleId: id, reason },
    workspaceId,
  });

  if (!idempotency.allowed) {
    throw new Error("Bu satış iade işlemi daha önce işlenmiş. İkinci kez çalıştırılamaz.");
  }

  try {
    const refundTransaction = await callBusinessTransactionRpc("ceplog_return_sale_transaction", {
      workspace_id: workspaceId,
      actor_id: null,
      idempotency_key: idempotency.operationKey,
      sale_id: id,
      items: [],
      refund_method: "MIXED",
      refund_amount: Math.max(toDbNumber(saleBeforeRefund.cash_amount) + toDbNumber(saleBeforeRefund.card_amount), 0),
      reason,
    });

    if (!refundTransaction.applied) {
      throw new Error("Satış iade merkezi transaction RPC sonucu uygulanmadı. Eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.");
    }
    const result = refundTransaction.data;

    const { data: saleAfterRefund, error: saleAfterError } = await supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (saleAfterError) console.warn("Satış iade audit yeni kayıt okunamadı.", saleAfterError);

    await createAuditLog({
      tableName: "sales",
      recordId: id,
      action: "REFUND",
      eventType: "sale_refund_with_effects",
      reason,
      oldData: saleBeforeRefund || null,
      newData: saleAfterRefund || result || null,
      metadata: {
        idempotencyKey: idempotency.operationKey,
        rpcResult: result || null,
      },
      requestKey: idempotency.operationKey,
      workspaceId,
    });

    if (!idempotency.missing) {
      await completeIdempotency({
        operationKey: idempotency.operationKey,
        result: { saleId: id, status: saleAfterRefund?.status || result?.status || "iade" },
        workspaceId,
      });
    }

    return result;
  } catch (error) {
    if (!idempotency.missing) {
      await completeIdempotency({
        operationKey: idempotency.operationKey,
        status: "failed",
        result: { saleId: id, message: error?.message || String(error) },
        workspaceId,
      });
    }
    throw error;
  }
}

export async function softDelete(tableName, id) {
  if (tableName === "sales") {
    return cancelRecord(tableName, id, "Satış silme/iptal");
  }

  void id;
  throw new Error(`${tableName} kaydı doğrudan silinemez. Kritik kayıtlar sadece ilgili merkezi iptal/iade transaction akışından kapatılabilir.`);
}

export async function cancelStockPurchase(id, reason = "Alım iptal edildi") {
  const workspaceId = await getCurrentWorkspaceId();

  const { data: stockBeforeCancel, error: stockReadError } = await supabase
    .from("stock_items")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (stockReadError) throw stockReadError;
  if (!stockBeforeCancel) throw new Error("İptal edilecek alım/stok kaydı bulunamadı.");
  if (["deleted", "cancelled", "canceled", "iptal"].includes(String(stockBeforeCancel.status || "").toLowerCase())) {
    throw new Error("Bu alım daha önce iptal edilmiş. İkinci kez iptal edilemez.");
  }

  const idempotency = await tryBeginIdempotency({
    operationType: "cancel_purchase",
    targetTable: "stock_items",
    targetId: id,
    operationKey: criticalOperationKey("cancel_purchase", "stock_items", id),
    payload: { stockItemId: id, reason },
    workspaceId,
  });

  if (!idempotency.allowed) {
    throw new Error("Bu alım iptal işlemi daha önce işlenmiş. İkinci kez çalıştırılamaz.");
  }

  try {
    const cancelTransaction = await callBusinessTransactionRpc("ceplog_cancel_stock_purchase_transaction", {
      workspace_id: workspaceId,
      actor_id: null,
      idempotency_key: idempotency.operationKey,
      stock_id: id,
      reason,
    });

    if (!cancelTransaction.applied) {
      throw new Error("Alım iptal merkezi transaction RPC sonucu uygulanmadı. Eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.");
    }
    const result = cancelTransaction.data;

    const { data: stockAfterCancel, error: stockAfterError } = await supabase
      .from("stock_items")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (stockAfterError) console.warn("Alım iptal audit yeni stok kaydı okunamadı.", stockAfterError);

    await createAuditLog({
      tableName: "stock_items",
      recordId: id,
      action: "CANCEL",
      eventType: "stock_purchase_cancel_with_effects",
      reason,
      oldData: stockBeforeCancel || null,
      newData: stockAfterCancel || result || null,
      metadata: {
        idempotencyKey: idempotency.operationKey,
        rpcResult: result || null,
      },
      requestKey: idempotency.operationKey,
      workspaceId,
    });

    if (!idempotency.missing) {
      await completeIdempotency({
        operationKey: idempotency.operationKey,
        result: { stockItemId: id, status: stockAfterCancel?.status || result?.status || "deleted" },
        workspaceId,
      });
    }

    return result;
  } catch (error) {
    if (!idempotency.missing) {
      await completeIdempotency({
        operationKey: idempotency.operationKey,
        status: "failed",
        result: { stockItemId: id, message: error?.message || String(error) },
        workspaceId,
      });
    }
    throw error;
  }
}

export async function cancelRecord(tableName, id, reason = "Kayıt iptal edildi") {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  if (tableName === "sales") {
    const { data: saleBeforeCancel, error: saleReadError } = await supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (saleReadError) throw saleReadError;
    if (!saleBeforeCancel) throw new Error("İptal edilecek satış kaydı bulunamadı.");
    if (["cancelled", "canceled", "iptal"].includes(String(saleBeforeCancel.status || "").toLowerCase())) {
      throw new Error("Bu satış daha önce iptal edilmiş. İkinci kez iptal edilemez.");
    }

    const stockItemId = saleBeforeCancel.stock_item_id;

    if (!stockItemId) {
      throw new Error("Bu satış kaydında stock_item_id yok. Stok iadesi yapılamaz. Satış kaydında cihaz bağlantısı eksik.");
    }

    const { data: stockBefore, error: stockBeforeError } = await supabase
      .from("stock_items")
      .select("id, quantity, status")
      .eq("id", stockItemId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (stockBeforeError) throw stockBeforeError;
    if (!stockBefore) throw new Error("Satışa bağlı stok kaydı bulunamadı.");

    const idempotency = await tryBeginIdempotency({
      operationType: "cancel",
      targetTable: "sales",
      targetId: id,
      operationKey: criticalOperationKey("cancel", "sales", id),
      payload: { saleId: id, reason, stockItemId },
      workspaceId,
    });

    if (!idempotency.allowed) {
      throw new Error("Bu iptal işlemi daha önce işlenmiş. İkinci kez çalıştırılamaz.");
    }

    try {
      const cancelTransaction = await callBusinessTransactionRpc("ceplog_cancel_sale_transaction", {
        workspace_id: workspaceId,
        actor_id: user?.id || null,
        idempotency_key: idempotency.operationKey,
        sale_id: id,
        reason,
      });

      if (!cancelTransaction.applied) {
        throw new Error("Satış iptal merkezi transaction RPC sonucu uygulanmadı. Eski çoklu tablo akışı güvenlik nedeniyle çalıştırılmadı.");
      }
      const result = cancelTransaction.data;

      const { data: saleAfterCancel, error: saleAfterReadError } = await supabase
        .from("sales")
        .select("id, status")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (saleAfterReadError) throw saleAfterReadError;
      if (!saleAfterCancel) throw new Error("İptal sonrası satış kaydı tekrar okunamadı.");
      if (!["cancelled", "canceled", "iptal"].includes(String(saleAfterCancel.status || "").toLowerCase())) {
        throw new Error("Satış iptal RPC satış durumunu iptal olarak işaretlemedi. Ek düzeltme yapılmadı; SQL RPC kontrol edilmeli.");
      }

      const { data: stockAfter, error: stockAfterReadError } = await supabase
        .from("stock_items")
        .select("id, quantity, status")
        .eq("id", stockItemId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (stockAfterReadError) throw stockAfterReadError;
      if (!stockAfter) throw new Error("İptal sonrası stok kaydı tekrar okunamadı.");

      const receivableNames = Array.from(new Set([
        saleBeforeCancel.customer_name,
        saleBeforeCancel.cari_person,
      ]
        .map((name) => String(name || "").trim())
        .filter(Boolean)));

      const { data: saleAfterAudit, error: saleAfterAuditError } = await supabase
        .from("sales")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (saleAfterAuditError) console.warn("Satış iptal audit yeni kayıt okunamadı.", saleAfterAuditError);

      await createAuditLog({
        tableName: "sales",
        recordId: id,
        action: "CANCEL",
        eventType: "sale_cancel_with_effects",
        reason,
        oldData: saleBeforeCancel || null,
        newData: saleAfterAudit || saleAfterCancel || null,
        metadata: {
          stockItemId,
          stockBefore,
          stockAfter,
          rpcResult: result || null,
          receivableNames,
          idempotencyKey: idempotency.operationKey,
        },
        requestKey: idempotency.operationKey,
        workspaceId,
      });

      if (!idempotency.missing) {
        await completeIdempotency({
          operationKey: idempotency.operationKey,
          result: {
            tableName: "sales",
            id,
            status: saleAfterAudit?.status || saleAfterCancel?.status || "cancelled",
            rpcResult: result || null,
          },
          workspaceId,
        });
      }

      return result;
    } catch (error) {
      if (!idempotency.missing) {
        await completeIdempotency({
          operationKey: idempotency.operationKey,
          status: "failed",
          result: { tableName: "sales", id, message: error?.message || String(error) },
          workspaceId,
        });
      }
      throw error;
    }
  }

  const { data: recordBeforeCancel, error: recordBeforeError } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (recordBeforeError) console.warn("İptal audit eski kayıt okunamadı.", recordBeforeError);

  const idempotency = await tryBeginIdempotency({
    operationType: "cancel",
    targetTable: tableName,
    targetId: id,
    operationKey: criticalOperationKey("cancel", tableName, id),
    payload: { tableName, id, reason },
    workspaceId,
  });

  if (!idempotency.allowed) {
    throw new Error("Bu iptal işlemi daha önce işlenmiş. İkinci kez çalıştırılamaz.");
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .update({
        status: "cancelled",
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw error;

    await createAuditLog({
      tableName,
      recordId: id,
      action: "CANCEL",
      eventType: `${tableName}_cancel`,
      reason,
      oldData: recordBeforeCancel || null,
      newData: data || null,
      metadata: { tableName, idempotencyKey: idempotency.operationKey },
      requestKey: idempotency.operationKey,
      workspaceId,
    });

    if (!idempotency.missing) {
      await completeIdempotency({
        operationKey: idempotency.operationKey,
        result: { tableName, id, status: data?.status || "cancelled" },
        workspaceId,
      });
    }

    return data;
  } catch (error) {
    if (!idempotency.missing) {
      await completeIdempotency({
        operationKey: idempotency.operationKey,
        status: "failed",
        result: { tableName, id, message: error?.message || String(error) },
        workspaceId,
      });
    }
    throw error;
  }
}

export async function createDailyBackup() {
  const { data, error } = await supabase.rpc("create_daily_backup");
  if (error) throw error;
  return data;
}

export async function closeCashDay(date, note) {
  const workspaceId = await getCurrentWorkspaceId();
  const { data, error } = await supabase.rpc("close_cash_day", {
    target_date: date || new Date().toISOString().slice(0, 10),
    closing_note: note || null,
  });

  if (error) throw error;

  if (data) {
    const { error: updateError } = await supabase
      .from("cash_closings")
      .update({ workspace_id: workspaceId })
      .eq("id", data);

    if (updateError && !isMissingRelationError(updateError)) throw updateError;
  }

  return data;
}

export async function loadAuditLogs(limit = 100) {
  const workspaceId = await getCurrentWorkspaceId();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
