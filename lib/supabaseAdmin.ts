// Cliente de Supabase con privilegios de servidor (service_role).
// SOLO se usa en el backend (API routes). Nunca lo expongas al navegador.
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
