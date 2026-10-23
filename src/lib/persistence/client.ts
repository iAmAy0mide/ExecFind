import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SupabaseLeadRepository, type PersistenceDatabase } from "./repository";

export class PersistenceConfigurationError extends Error {
  constructor() { super("Persistence is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server."); }
}

export function createLeadRepository() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new PersistenceConfigurationError();
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { "X-Client-Info": "execfind-server" } } });
  const database: PersistenceDatabase = { rpc: async (name, params) => {
    const { data, error } = await client.rpc(name, params);
    return { data, error: error ? { message: error.message, code: error.code } : null };
  } };
  return new SupabaseLeadRepository(database);
}
