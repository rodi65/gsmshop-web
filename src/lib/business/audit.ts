export interface AuditPayload {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export function buildAuditPayload(payload: AuditPayload): Record<string, unknown> {
  return {
    workspace_id: payload.workspaceId,
    actor_id: payload.actorId || null,
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId || null,
    before_data: payload.beforeData || null,
    after_data: payload.afterData || null,
    reason: payload.reason || null,
    metadata: payload.metadata || {},
  };
}

export async function writeAuditLog(supabaseClient: any, payload: AuditPayload): Promise<{ ok: boolean; error?: unknown }> {
  if (!supabaseClient) return { ok: false, error: new Error("Supabase client eksik.") };
  const { error } = await supabaseClient.from("audit_logs").insert(buildAuditPayload(payload));
  return error ? { ok: false, error } : { ok: true };
}
