import { DuplicateTransactionError } from "./errors";

export function generateIdempotencyKey(prefix = "ceplog"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export async function getExistingTransactionByIdempotencyKey(supabaseClient: any, workspaceId: string, idempotencyKey: string): Promise<unknown | null> {
  if (!supabaseClient || !workspaceId || !idempotencyKey) return null;
  const { data, error } = await supabaseClient
    .from("business_transactions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function assertUniqueIdempotencyKey(supabaseClient: any, workspaceId: string, idempotencyKey: string): Promise<void> {
  const existing = await getExistingTransactionByIdempotencyKey(supabaseClient, workspaceId, idempotencyKey);
  if (existing) throw new DuplicateTransactionError("Bu idempotency_key ile islem zaten mevcut.", existing);
}
