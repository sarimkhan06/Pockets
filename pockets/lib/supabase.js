// Supabase is the backend-as-a-service that handles authentication for this app.
// It gives you sign up, log in, session management, and 2FA (MFA) out of the box.
//
// Credentials come from environment variables rather than being hardcoded, so the repo
// isn't tied to one specific Supabase project. Expo inlines any variable prefixed with
// EXPO_PUBLIC_ at build time — read from pockets/.env locally (see .env.example), or
// from EAS environment variables for cloud builds.
//
// The ANON_KEY is a public key — it's safe to ship in the frontend, but it only allows
// operations the database's Row Level Security (RLS) policies permit.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Fail loudly and early. Without this the app would start and then behave strangely
// (auth silently pointing at the wrong project), which is much harder to diagnose.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase config. Copy pockets/.env.example to pockets/.env and fill in ' +
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from your Supabase project.'
  );
}

// Create a single Supabase client instance and export it.
// Any screen that needs auth (login, check session, MFA) imports this.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
