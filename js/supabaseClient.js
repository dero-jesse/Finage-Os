// js/supabaseClient.js
// Initialize Supabase Client

const appConfig = window.FINAGE_CONFIG || {};
const supabaseConfig = appConfig.supabase || {};

const SUPABASE_URL = supabaseConfig.url || 'https://fcnutxowcvccrfytiwya.supabase.co';
const SUPABASE_ANON_KEY = supabaseConfig.anonKey || 'sb_publishable_AcP9DrNY06W_RPxbuQgNXQ_DVOgXHI1';

const authCallbackParams = new URLSearchParams(window.location.hash.slice(1));
window.FINAGE_AUTH_CALLBACK_TYPE = authCallbackParams.get('type');

// Create a single supabase client for interacting with your database
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
