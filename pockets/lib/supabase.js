import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bavxlshsoyscaevecynm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhdnhsc2hzb3lzY2FldmVjeW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTU1MDksImV4cCI6MjA5NDc5MTUwOX0.C8yldnVFUI-HhTh6KsywDUWENUca7L0_0JhzLQhMLbI';

// Create and export the Supabase client
// Any screen that needs to talk to Supabase imports this
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
