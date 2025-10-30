import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vnsvsruwvboxslkhsdrk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuc3ZzcnV3dmJveHNsa2hzZHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTk3MDAsImV4cCI6MjA3NjM3NTcwMH0.X_th80OtRcqa1N6a0zk3lALh5eKr8O6zc3EVJLR-QKY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
})