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

function isMissingRpcError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
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

export async function loadDashboardData() {
  const profile = await getCurrentProfile();
  const workspaceId = profile?.workspace_id || await getCurrentWorkspaceId();
  const [stock, sales, expenses, bank, closings, cash, contacts] = await Promise.all([
    supabase.from("stock_items").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("sales").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("bank_movements").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("cash_closings").select("*").eq("workspace_id", workspaceId).order("closing_date", { ascending: false }),
    supabase.from("cash_movements").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").eq("workspace_id", workspaceId).or("status.is.null,status.eq.active").order("created_at", { ascending: false }),
  ]);

  for (const response of [stock, sales, expenses, bank, closings]) {
    if (response.error) throw response.error;
  }

  if (cash.error && !isMissingRelationError(cash.error)) throw cash.error;
  if (contacts.error && !isMissingRelationError(contacts.error)) throw contacts.error;

  return {
    profile,
    workspaceId,
    stock: stock.data || [],
    sales: sales.data || [],
    expenses: expenses.data || [],
    bankMovements: bank.data || [],
    cashClosings: closings.data || [],
    cashMovements: cash.error ? [] : cash.data || [],
    contacts: contacts.error ? [] : contacts.data || [],
  };
}

export async function resetAllTestData() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) throw new Error("Aktif workspace bulunamadı.");

  const tables = [
    "cash_movements",
    "bank_movements",
    "cash_closings",
    "expenses",
    "sales",
    "stock_items",
    "contacts",
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
  if (!cleanName) return null;

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
        balance: Number(existing.balance || 0) + toDbNumber(balance),
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
      balance: toDbNumber(balance),
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

  const { data, error } = await supabase
    .from("cash_movements")
    .insert([{
      movement_type: payload.movement_type,
      direction: payload.direction,
      amount: toDbNumber(payload.amount),
      note: payload.note || "",
      related_table: payload.related_table || null,
      related_id: payload.related_id || null,
      ...(serviceReferenceId ? {
        related_service_id: serviceReferenceId,
        service_record_id: serviceReferenceId,
        reference_id: serviceReferenceId,
      } : {}),
      workspace_id: workspaceId,
      status: "active",
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) {
    console.error("cash_movements insert error", {
      error,
      payload: {
        movement_type: payload.movement_type,
        direction: payload.direction,
        amount: toDbNumber(payload.amount),
        related_table: payload.related_table || null,
        related_id: payload.related_id || null,
        related_service_id: serviceReferenceId || null,
        service_record_id: serviceReferenceId || null,
        reference_id: serviceReferenceId || null,
      },
    });
    if (serviceReferenceId && isMissingTechnicalServiceFinanceColumn(error)) {
      throw technicalServiceFinanceColumnsError(error);
    }
    if (isTechnicalServiceMovementTypeError(error)) {
      throw technicalServiceMovementTypeError(error);
    }
    throw error;
  }
  return data;
}

export async function createBankMovement(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();
  const serviceReferenceId = payload.related_service_id || payload.service_record_id || payload.reference_id || (
    payload.related_table === "technical_services" ? payload.related_id : ""
  );

  if (!payload.bank_name) {
    throw new Error("Banka seçmek zorunludur.");
  }

  const { data, error } = await supabase
    .from("bank_movements")
    .insert([{
      movement_type: payload.movement_type,
      direction: payload.direction || "in",
      bank_name: payload.bank_name,
      amount: toDbNumber(payload.amount),
      note: payload.note || "",
      related_table: payload.related_table || null,
      related_id: payload.related_id || null,
      related_service_id: serviceReferenceId || null,
      service_record_id: serviceReferenceId || null,
      reference_id: serviceReferenceId || null,
      workspace_id: workspaceId,
      status: "active",
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) {
    console.error("bank_movements insert error", {
      error,
      payload: {
        movement_type: payload.movement_type,
        direction: payload.direction || "in",
        bank_name: payload.bank_name,
        amount: toDbNumber(payload.amount),
        related_table: payload.related_table || null,
        related_id: payload.related_id || null,
        related_service_id: serviceReferenceId || null,
        service_record_id: serviceReferenceId || null,
        reference_id: serviceReferenceId || null,
      },
    });
    if (serviceReferenceId && isMissingTechnicalServiceFinanceColumn(error)) {
      throw technicalServiceFinanceColumnsError(error);
    }
    if (isTechnicalServiceMovementTypeError(error)) {
      throw technicalServiceMovementTypeError(error);
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
    const { data: createdContact, error: createError } = await supabase
      .from("contacts")
      .insert([{
        kind,
        name: cleanName,
        phone,
        balance: toDbNumber(currentBalance),
        balance_type: "payable",
        workspace_id: workspaceId,
        note: "Ödeme sırasında cari kaydı oluşturuldu.",
        status: "active",
        created_by: user?.id,
        updated_by: user?.id,
      }])
      .select()
      .single();

    if (createError) throw createError;
    contact = createdContact;
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

  const movementId = await callFinancialRpc("record_receivable_payment", {
    p_sale_id: saleId,
    p_workspace_id: workspaceId,
    p_amount: paymentAmount,
    p_note: `Alacak ödemesi - ${customerName || "Müşteri"}`,
  });

  return {
    sale: { id: saleId, remaining_amount: Math.max(toDbNumber(currentRemaining) - paymentAmount, 0) },
    movement: { id: movementId },
  };
}

export async function repairStockSideEffects(stockItems = [], cashMovements = [], contacts = []) {
  let changed = false;

  for (const item of stockItems) {
    const paid = Number(item.supplier_paid || 0);
    const totalBuy = Number(item.buy_price || 0) * Number(item.quantity || 1);
    const sellerRemaining = Number(item.seller_cari_remaining || 0);
    const inferredPaid = paid || (sellerRemaining > 0 ? Math.max(totalBuy - sellerRemaining, 0) : 0);
    const sellerName = stockSellerName(item);
    const paymentName = sellerName || item.supplier_name || "";

    const hasStockPayment = cashMovements.some((movement) =>
      movement.movement_type === "Stok Ödemesi" &&
      movement.related_table === "stock_items" &&
      String(movement.related_id || "") === String(item.id)
    );

    if (inferredPaid > 0 && !hasStockPayment) {
      await createCashMovement({
        movement_type: "Stok Ödemesi",
        direction: "out",
        amount: inferredPaid,
        related_table: "stock_items",
        related_id: item.id,
        note: `${item.product_name || "Stok"} alım ödemesi${paymentName ? ` - ${paymentName}` : ""}`,
      });
      changed = true;
    }

    const isSecondHandPhoneSeller =
      item.module === "Cihaz" &&
      (item.device_type || item.deviceType) === "Telefon" &&
      (item.category === "İkinci El" || item.acquisition_type === "Müşteri") &&
      Boolean(sellerName);
    const sellerBalance = sellerRemaining || Math.max(totalBuy - paid, 0);
    const hasSellerContact = sellerName && contacts.some((contact) =>
      contact.kind === "seller" &&
      String(contact.name || "").toLocaleLowerCase("tr-TR") === sellerName.toLocaleLowerCase("tr-TR") &&
      contact.balance_type === "payable"
    );

    if (isSecondHandPhoneSeller && sellerBalance > 0 && !hasSellerContact) {
      await findOrCreateContact({
        kind: "seller",
        name: sellerName,
        phone: item.seller_phone || "",
        balance: sellerBalance,
        balanceType: "payable",
        note: `${item.product_name || "Cihaz"} alımından kalan borç`,
      });
      changed = true;
    }
  }

  return changed;
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

  const { data, error } = await supabase
    .from("stock_items")
    .insert([{ ...stockPayload, workspace_id: workspaceId, status: stockPayload.status || "active", created_by: user?.id, updated_by: user?.id }])
    .select()
    .single();

  if (error) throw error;

  if (paid > 0) {
    await createCashMovement({
      movement_type: "Stok Ödemesi",
      direction: "out",
      amount: paid,
      related_table: "stock_items",
      related_id: data.id,
      note: `${payload.product_name || "Stok"} alım ödemesi${paymentName ? ` - ${paymentName}` : ""}`,
    });
  }

  if (remaining > 0 && isSellerPurchase) {
    await findOrCreateContact({
      kind: "seller",
      name: sellerName,
      phone: payload.seller_phone || "",
      balance: Number(stockPayload.seller_cari_remaining || 0) || remaining,
      balanceType: "payable",
      note: `${payload.product_name || "Cihaz"} alımından kalan borç`,
    });
  }

  if (remaining > 0 && !isSellerPurchase && payload.supplier_name) {
    await findOrCreateContact({
      kind: "supplier",
      name: payload.supplier_name,
      balance: remaining,
      balanceType: "payable",
      note: `${payload.product_name || "Stok"} alımından kalan borç`,
    });
  }

  return data;
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

  let stockItemToDecrease = null;
  if (payload.stock_item_id) {
    const { data: stockItem, error: stockFindError } = await supabase
      .from("stock_items")
      .select("id, quantity")
      .eq("id", payload.stock_item_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (stockFindError) throw stockFindError;
    if (!stockItem) throw new Error("Satılacak stok kaydı bulunamadı.");
    if (Number(stockItem.quantity || 0) <= 0) throw new Error("Stok yok.");
    stockItemToDecrease = stockItem;
  }

  const { data: sale, error } = await supabase
    .from("sales")
    .insert([salePayload])
    .select()
    .single();

  if (error) throw error;

  if (stockItemToDecrease) {
    const currentQuantity = Number(stockItemToDecrease.quantity || 0);
    const { error: stockUpdateError } = await supabase
      .from("stock_items")
      .update({
        quantity: Math.max(currentQuantity - 1, 0),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stockItemToDecrease.id)
      .eq("workspace_id", workspaceId);

    if (stockUpdateError) throw stockUpdateError;
  }

  if (toDbNumber(payload.cash_amount) > 0) {
    await createCashMovement({
      movement_type: "Satış Nakit",
      direction: "in",
      amount: toDbNumber(payload.cash_amount),
      related_table: "sales",
      related_id: sale.id,
      note: `${payload.product_name || "Satış"} nakit tahsilat`,
    });
  }

  // Satışta kart/banka tutarı sales.card_amount alanında tutulur.
  // bank_movements tablosuna "Bankaya Giden" tipi yazılmıyor.
  // Çünkü Supabase check constraint bu tipi kabul etmiyor ve satış sonrası gereksiz hata üretiyor.

  if (toDbNumber(salePayload.remaining_amount) > 0 && (payload.cari_person || payload.customer_name)) {
    await findOrCreateContact({
      kind: "customer",
      name: payload.cari_person || payload.customer_name,
      phone: payload.customer_phone || "",
      balance: toDbNumber(salePayload.remaining_amount),
      balanceType: "receivable",
      note: `${payload.product_name || "Satış"} satışından kalan alacak`,
    });
  }

  return sale;
}

export async function createExpense(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  if (payload.category === "Borç" && !String(payload.note || "").trim()) {
    throw new Error("Borç giderinde Not zorunludur.");
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert([{ ...payload, workspace_id: workspaceId, created_by: user?.id, updated_by: user?.id }])
    .select()
    .single();

  if (error) throw error;
  if (toDbNumber(payload.amount) > 0) {
    await createCashMovement({
      movement_type: "Gider",
      direction: "out",
      amount: toDbNumber(payload.amount),
      related_table: "expenses",
      related_id: data.id,
      note: payload.note || payload.category || "Gider",
    });
  }
  return data;
}

export async function createBankWithdrawal(payload) {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  if (!payload.bank_name) {
    throw new Error("Banka seçmek zorunludur.");
  }

  const { data, error } = await supabase
    .from("bank_movements")
    .insert([{
      movement_type: "Bankadan Çekilen",
      bank_name: payload.bank_name,
      amount: toDbNumber(payload.amount),
      note: payload.note || `Bankadan Nakit Gelen - ${payload.bank_name}`,
      workspace_id: workspaceId,
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
  if (toDbNumber(payload.amount) > 0) {
    await createCashMovement({
      movement_type: "Bankadan Nakit Gelen",
      direction: "in",
      amount: toDbNumber(payload.amount),
      related_table: "bank_movements",
      related_id: data.id,
      note: payload.note || `Bankadan Nakit Gelen - ${payload.bank_name}`,
    });
  }
  return data;
}

export async function updateSaleRecord(id, payload) {
  const workspaceId = await getCurrentWorkspaceId();
  return callFinancialRpc("update_sale_with_effects", {
    p_sale_id: id,
    p_workspace_id: workspaceId,
    p_total_amount: toDbNumber(payload.total_amount),
    p_cash_amount: toDbNumber(payload.cash_amount),
    p_card_amount: toDbNumber(payload.card_amount),
    p_remaining_amount: toDbNumber(payload.remaining_amount),
    p_bank_name: payload.bank_name || "",
    p_customer_name: payload.customer_name || payload.cari_person || "",
    p_customer_phone: payload.customer_phone || "",
    p_product_name: payload.product_name || "",
    p_buy_cost: toDbNumber(payload.buy_cost),
    p_profit_amount: toDbNumber(payload.profit_amount),
  });
}

export async function updateStockItem(id, payload) {
  const workspaceId = await getCurrentWorkspaceId();
  const buyTotal = toDbNumber(payload.buy_price) * Number(payload.quantity || 0);
  const paid = toDbNumber(payload.supplier_paid);
  if (paid > buyTotal) throw new Error("Ödeme tutarı alış tutarını aşamaz.");
  return callFinancialRpc("update_stock_with_effects", {
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
  });
}

export async function softDelete(tableName, id) {
  if (tableName === "sales") {
    return cancelRecord(tableName, id, "Satış silme/iptal");
  }

  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  const { data, error } = await supabase
    .from(tableName)
    .update({
      status: "deleted",
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelRecord(tableName, id, reason = "Kayıt iptal edildi") {
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  if (tableName === "sales") {
    return callFinancialRpc("cancel_sale_with_effects", {
      p_sale_id: id,
      p_workspace_id: workspaceId,
      p_reason: reason,
    }, "Finansal iptal fonksiyonu kurulmamış. Supabase financial_integrity SQL çalıştırılmalı.");
  }

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
  return data;
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
