import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase bilgileri eksik. .env dosyasına VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ekle.");
}

function missingSupabaseConfigError() {
  return new Error("Supabase bağlantı bilgileri eksik. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlanmalı.");
}

function makeMissingSupabaseClient() {
  const throwMissingConfig = async () => {
    throw missingSupabaseConfigError();
  };

  const queryBuilder = {
    select: () => queryBuilder,
    insert: () => queryBuilder,
    update: () => queryBuilder,
    upsert: () => queryBuilder,
    delete: () => queryBuilder,
    eq: () => queryBuilder,
    neq: () => queryBuilder,
    or: () => queryBuilder,
    order: () => queryBuilder,
    limit: () => queryBuilder,
    single: throwMissingConfig,
    maybeSingle: throwMissingConfig,
    then: (resolve, reject) => throwMissingConfig().then(resolve, reject),
  };

  return {
    auth: {
      getUser: throwMissingConfig,
      signInWithPassword: throwMissingConfig,
      signOut: throwMissingConfig,
    },
    from: () => queryBuilder,
    rpc: throwMissingConfig,
  };
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : makeMissingSupabaseClient();
