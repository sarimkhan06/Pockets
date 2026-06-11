// Supabase is the backend-as-a-service that handles authentication for this app.
// It gives you sign up, log in, session management, and 2FA (MFA) out of the box.
//
// createClient() sets up the connection to your specific Supabase project.
// The ANON_KEY is a public key — it's safe to be in the frontend, but it only
// allows operations the database's Row Level Security (RLS) policies permit.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bavxlshsoyscaevecynm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhdnhsc2hzb3lzY2FldmVjeW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTU1MDksImV4cCI6MjA5NDc5MTUwOX0.C8yldnVFUI-HhTh6KsywDUWENUca7L0_0JhzLQhMLbI';

// Create a single Supabase client instance and export it.
// Any screen that needs auth (login, check session, MFA) imports this.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
