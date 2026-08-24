/**
 * Client de données — branché sur PocketBase.
 * L'ancien client Supabase est conservé dans client.supabase.bak
 *
 * L'API exposée reste identique (supabase.from, .auth, .storage, .rpc),
 * ce qui évite de modifier les composants de l'application.
 */
export { supabase, pb } from "./pocketbase-compat";
export { supabase as default } from "./pocketbase-compat";
