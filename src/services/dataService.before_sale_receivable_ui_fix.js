import { supabase } from "../lib/supabase";

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
  const [stock, sales, expenses, bank, closings, cash, contacts] = await Promise.all([
    supabase.from("stock_items").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("sales").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("bank_movements").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("cash_closings").select("*").order("closing_date", { ascending: false }),
    supabase.from("cash_movements").select("*").or("status.is.null,status.neq.deleted").order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").or("status.is.null,status.neq.deleted").order("created_at", { ascending: false }),
  ]);

  for (const response of [stock, sales, expenses, bank, closings]) {
    if (response.error) throw response.error;
  }

  if (cash.error && !isMissingRelationError(cash.error)) throw cash.error;
  if (contacts.error && !isMissingRelationError(contacts.error)) throw contacts.error;

  return {
    stock: stock.data || [],
    sales: sales.data || [],
    expenses: expenses.data || [],
    bankMovements: bank.data || [],
    cashClosings: closings.data || [],
    cashMovements: cash.error ? [] : cash.data || [],
    contacts: contacts.error ? [] : contacts.data || [],
  };
}

export async function findOrCreateContact({ kind, name, phone = "", balance = 0, balanceType = "receivable", note = "" }) {
  const user = await getCurrentUser();
  const cleanName = String(name || "").trim();
  if (!cleanName) return null;

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("*")
    .eq("kind", kind)
    .ilike("name", cleanName)
    .or("status.is.null,status.neq.deleted")
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

  const { data, error } = await supabase
    .from("cash_movements")
    .insert([{
      movement_type: payload.movement_type,
      direction: payload.direction,
      amount: toDbNumber(payload.amount),
      note: payload.note || "",
      related_table: payload.related_table || null,
      related_id: payload.related_id || null,
      status: "active",
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createContactPayment({ kind, name, phone = "", amount, currentBalance = 0, notePrefix = "Cari ödeme" }) {
  const user = await getCurrentUser();
  const cleanName = String(name || "").trim();
  const paymentAmount = toDbNumber(amount);

  if (!cleanName) throw new Error("Cari adı boş olamaz.");
  if (!paymentAmount) throw new Error("Ödeme tutarı yaz.");

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("*")
    .eq("kind", kind)
    .ilike("name", cleanName)
    .or("status.is.null,status.neq.deleted")
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

  const movement = await createCashMovement({
    movement_type: "Cari Ödeme",
    direction: "out",
    amount: paymentAmount,
    note: `${notePrefix} - ${cleanName}`,
    related_table: "contacts",
    related_id: contact.id,
  });

  const { data: updatedContact, error: updateError } = await supabase
    .from("contacts")
    .update({
      balance: toDbNumber(contact.balance) - paymentAmount,
      balance_type: "payable",
      status: "active",
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contact.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return { contact: updatedContact, movement };
}

export async function createReceivablePayment({ saleId, customerName = "", amount, currentRemaining = 0 }) {
  const user = await getCurrentUser();
  const paymentAmount = toDbNumber(amount);

  if (!saleId) throw new Error("Alacak kaydı seçilemedi.");
  if (!paymentAmount) throw new Error("Tahsilat tutarını yaz.");

  const movement = await createCashMovement({
    movement_type: "Alacak Ödemesi",
    direction: "in",
    amount: paymentAmount,
    note: `Alacak ödemesi - ${customerName || "Müşteri"}`,
    related_table: "sales",
    related_id: saleId,
  });

  const { data: sale, error } = await supabase
    .from("sales")
    .update({
      remaining_amount: Math.max(toDbNumber(currentRemaining) - paymentAmount, 0),
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", saleId)
    .select()
    .single();

  if (error) throw error;
  return { sale, movement };
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
  const paid = toDbNumber(payload.supplier_paid);
  const buyTotal = toDbNumber(payload.buy_price) * Number(payload.quantity || 1);
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
    .insert([{ ...stockPayload, status: stockPayload.status || "active", created_by: user?.id, updated_by: user?.id }])
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

  const { data: sale, error } = await supabase
    .from("sales")
    .insert([{ ...payload, created_by: user?.id, updated_by: user?.id }])
    .select()
    .single();

  if (error) throw error;

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

  if (toDbNumber(payload.card_amount) > 0 && payload.bank_name) {
    const { error: bankError } = await supabase.from("bank_movements").insert([{
      movement_type: "Bankaya Giden",
      bank_name: payload.bank_name,
      amount: toDbNumber(payload.card_amount),
      note: `POSTAN Gelen - ${payload.bank_name} - ${payload.product_name}`,
      related_sale_id: sale.id,
      created_by: user?.id,
    }]);

    if (bankError) throw bankError;
  }

  return sale;
}

export async function createExpense(payload) {
  const user = await getCurrentUser();

  if (payload.category === "Borç" && !String(payload.note || "").trim()) {
    throw new Error("Borç giderinde Not zorunludur.");
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert([{ ...payload, created_by: user?.id, updated_by: user?.id }])
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

export async function softDelete(tableName, id) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from(tableName)
    .update({
      status: "deleted",
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelRecord(tableName, id) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from(tableName)
    .update({
      status: "cancelled",
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
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
  const { data, error } = await supabase.rpc("close_cash_day", {
    target_date: date || new Date().toISOString().slice(0, 10),
    closing_note: note || null,
  });

  if (error) throw error;
  return data;
}

export async function loadAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
