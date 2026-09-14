import { createClient } from '@supabase/supabase-js'

// V3 keeps a safe public anon-key fallback so a Vercel deployment does not render a blank page
// when Environment Variables were forgotten. Replace with Vercel env vars in production.
const DEFAULT_URL = 'https://dxgethejsgqubzddupiz.supabase.co'
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z2V0aGVqc2dxdWJ6ZGR1cGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MTg1MzgsImV4cCI6MjEwMzQ5NDUzOH0.2KONLnT1OQh28_luroYWY4-XxrSNZR7IflSNHQGH9uY'

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})
