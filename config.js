// ============================================
// PEGA AQUÍ TUS DATOS DE SUPABASE
// Los encuentras en: Project Settings > API
// ============================================

const SUPABASE_URL = "PON_AQUI_TU_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PON_AQUI_TU_SUPABASE_ANON_KEY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
