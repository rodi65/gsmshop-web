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

export async function loadDashboardData() {
  const [stock, sales, expenses, bank, closings] = await Promise.all([
    supabase.from("stock_items").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("sales").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("bank_movements").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("cash_closings").select("*").order("closing_date", { ascending: false }),
  ]);

  for (const response of [stock, sales, expenses, bank, closings]) {
    if (response.error) throw response.error;
  }

  return {
    stock: stock.data || [],
    sales: sales.data || [],
    expenses: expenses.data || [],
    bankMovements: bank.data || [],
    cashClosings: closings.data || [],
  };
}

export async function createStockItem(payload) {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("stock_items")
    .insert([{ ...payload, created_by: user?.id, updated_by: user?.id }])
    .select()
    .single();

  if (error) throw error;
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
