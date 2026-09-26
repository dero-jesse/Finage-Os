// js/supabaseClient.js
// Initialize Supabase Client

const SUPABASE_URL = 'https://fcnutxowcvccrfytiwya.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AcP9DrNY06W_RPxbuQgNXQ_DVOgXHI1';

// Create a single supabase client for interacting with your database
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
