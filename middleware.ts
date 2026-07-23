// Refresca la sesion de Supabase en cada request.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  // Atribución de embajador: ?ref=codigo se guarda 60 días.
  // No se sobrescribe si ya hay uno (gana el primero que lo trajo).
  const ref = req.nextUrl.searchParams.get('ref');
  if (ref && /^[a-zA-Z0-9_-]{2,30}$/.test(ref) && !req.cookies.get('onyx_ref')) {
    res.cookies.set({ name: 'onyx_ref', value: ref.toLowerCase(), maxAge: 60 * 60 * 24 * 60, path: '/', sameSite: 'lax' });
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value; },
        set(name: string, value: string, options: any) { res.cookies.set({ name, value, ...options }); },
        remove(name: string, options: any) { res.cookies.set({ name, value: '', ...options }); },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  // Puerta única: todo lo que cuelga de estas rutas exige sesión. Así no
  // dependemos de que cada página se acuerde de comprobarlo — que fue justo
  // lo que falló con /dashboard/keys, que era 'use client' y no miraba nada.
  const path = req.nextUrl.pathname;
  const PROTECTED = ['/dashboard', '/account', '/admin'];
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(p + '/'));

  if (needsAuth && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);   // para volver aquí tras entrar
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/v1/sync).*)'],
};
