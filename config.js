// ============================================
// PEGA AQUÍ TUS DATOS DE SUPABASE
// Los encuentras en: Project Settings > API
// ============================================

const SUPABASE_URL = "https://hudssmuhvhumsqnvmeoz.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_07syWkJYrAHdm1mLuDSbbA_ynZo0y7L";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
