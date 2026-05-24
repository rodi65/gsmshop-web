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

function isMissingRelationError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || message.includes("could not find the table") || message.includes("does not exist");
}

export async function loadDashboardData() {
  const [stock, sales, expenses, bank, closings, cash] = await Promise.all([
    supabase.from("stock_items").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("sales").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("bank_movements").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("cash_closings").select("*").order("closing_date", { ascending: false }),
    supabase.from("cash_movements").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
  ]);

  for (const response of [stock, sales, expenses, bank, closings]) {
    if (response.error) throw response.error;
  }

  if (cash.error && !isMissingRelationError(cash.error)) throw cash.error;

  return {
    stock: stock.data || [],
    sales: sales.data || [],
    expenses: expenses.data || [],
    bankMovements: bank.data || [],
    cashClosings: closings.data || [],
    cashMovements: cash.error ? [] : cash.data || [],
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
    .neq("status", "deleted")
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { data, error } = await supabase
      .from("contacts")
      .update({
        phone: phone || existing.phone,
        balance: Number(existing.balance || 0) + Number(balance || 0),
        balance_type: balanceType || existing.balance_type,
        note: note || existing.note,
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
      balance: Number(balance || 0),
      balance_type: balanceType,
      note,
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
      amount: Number(payload.amount || 0),
      note: payload.note || "",
      related_table: payload.related_table || null,
      related_id: payload.related_id || null,
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createStockItem(payload) {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("stock_items")
    .insert([{ ...payload, created_by: user?.id, updated_by: user?.id }])
    .select()
    .single();

  if (error) throw error;

  const paid = Number(payload.supplier_paid || 0);
  const buyTotal = Number(payload.buy_price || 0) * Number(payload.quantity || 1);
  const remaining = Math.max(buyTotal - paid, 0);

  if (paid > 0) {
    await createCashMovement({
      movement_type: "Stok Ödemesi",
      direction: "out",
      amount: paid,
      related_table: "stock_items",
      related_id: data.id,
      note: `${payload.product_name || "Stok"} alım ödemesi`,
    });
  }

  if (remaining > 0 && payload.acquisition_type === "Müşteri") {
    await findOrCreateContact({
      kind: "seller",
      name: payload.seller_person ? `SATICI ${String(payload.seller_person).trim().toUpperCase()}` : "SATICI",
      phone: payload.seller_phone || "",
      balance: remaining,
      balanceType: "payable",
      note: `${payload.product_name || "Cihaz"} alımından kalan borç`,
    });
  }

  if (remaining > 0 && payload.acquisition_type !== "Müşteri" && payload.supplier_name) {
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

  if (Number(payload.card_amount || 0) > 0 && payload.bank_name) {
    const { error: bankError } = await supabase.from("bank_movements").insert([{
      movement_type: "Bankaya Giden",
      bank_name: payload.bank_name,
      amount: payload.card_amount,
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
      amount: payload.amount,
      note: payload.note || `Bankadan Nakit Gelen - ${payload.bank_name}`,
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
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
