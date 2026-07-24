// Refresca la sesion de Supabase en cada request.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const rawPath = req.nextUrl.pathname;

  // --- Idioma en la URL (SEO bilingüe) ------------------------------------
  // El español canónico vive sin prefijo, así que /es/... redirige a /...
  if (rawPath === '/es' || rawPath.startsWith('/es/')) {
    const url = req.nextUrl.clone();
    url.pathname = rawPath.slice(3) || '/';
    return NextResponse.redirect(url, 308);
  }
  // /en/... se sirve reescribiendo a la ruta normal, pero marcando el idioma
  // con una cabecera para que el servidor renderice en inglés.
  const isEn = rawPath === '/en' || rawPath.startsWith('/en/');
  const path = isEn ? (rawPath.slice(3) || '/') : rawPath;

  const fwd = new Headers(req.headers);
  if (isEn) fwd.set('x-onyx-lang', 'en');

  let res: NextResponse;
  if (isEn) {
    const url = req.nextUrl.clone();
    url.pathname = path;
    res = NextResponse.rewrite(url, { request: { headers: fwd } });
    res.cookies.set({ name: 'onyx_lang', value: 'en', path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  } else {
    res = NextResponse.next({ request: { headers: fwd } });
  }

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
  const PROTECTED = ['/dashboard', '/account', '/admin', '/onboarding'];
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
