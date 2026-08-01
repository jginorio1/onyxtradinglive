'use client';
// Cliente de Supabase para el navegador (login, lecturas con RLS).
import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );
