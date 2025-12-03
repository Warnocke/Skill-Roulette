import { createClient } from '@supabase/supabase-js';

// Support both Create React App and Vite env var prefixes
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Friendly runtime warning so developers can see missing config in the console
  // (avoid throwing so dev server can start and show a clearer error later)
  // eslint-disable-next-line no-console
  console.warn('Missing Supabase env vars. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (or VITE_ equivalents).');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

export default supabase;
