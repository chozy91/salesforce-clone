// Public values (safe in the browser; RLS protects data). Env vars override them,
// so a missing Vercel env var no longer crashes every request.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tpycemxrvlpfzmleaysf.supabase.co";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_hyT2cY7hUB-ibRX8POK_Ig_oJAjdMNt";
