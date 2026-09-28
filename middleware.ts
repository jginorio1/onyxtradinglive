// Refresca la sesion de Supabase en cada request.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ¿La sesión pasó el 2FA por CÓDIGO DE RESPALDO? (cookie firmada onyx_2fa que pone
// lib/adminSecurity.set2faOk tras validar un código). Verificamos la firma HMAC con
// Web Crypto para no aceptar una cookie falsificada. Debe coincidir con la firma del
// servidor: HMAC-SHA256(secreto, `${userId}.${exp}`), en hex, y sin caducar.
async function backupMfaOk(cookieVal: string | undefined, userId: string): Promise<boolean> {
  try {
    if (!cookieVal) return false;
    const dot = cookieVal.indexOf('.');
    if (dot < 0) return false;
    const exp = parseInt(cookieVal.slice(0, dot), 10);
    const sig = cookieVal.slice(dot + 1);
    if (!exp || Number.isNaN(exp) || Date.now() > exp) return false;
    const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'onyx-2fa';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${userId}.${exp}`));
    const good = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (good.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ sig.charCodeAt(i);   // comparación en tiempo constante
    return diff === 0;
  } catch { return false; }
}

export async function middleware(req: NextRequest) {
  const rawPath = req.nextUrl.pathname;

  // --- Idioma en la URL (SEO bilingüe) ------------------------------------
  // El español canónico vive sin prefijo, así que /es/... redirige a /...
  if (rawPath === '/es' || rawPath.startsWith('/es/')) {
    const url = req.nextUrl.clone();
    url.pathname = rawPath.slice(3) || '/';
    return NextResponse.redirect(url, 308);
  }
  // /en, /zh, /ja, /pt, /vi se sirven reescribiendo a la ruta normal, pero
  // marcando el idioma con una cabecera para que el servidor renderice traducido.
  const PREFIXES = ['en']; // idiomas activos con URL propia (ver lib/navText LANGS); pt/zh/ja/vi desactivados
  const seg = rawPath.split('/')[1];
  const urlLang = PREFIXES.includes(seg) ? seg : '';
  const path = urlLang ? (rawPath.slice(urlLang.length + 1) || '/') : rawPath;

  const fwd = new Headers(req.headers);
  if (urlLang) fwd.set('x-onyx-lang', urlLang);
  fwd.set('x-onyx-path', path);   // para que el layout sepa en qué página está (barra de promo)
  // Previsualización de espacios publicitarios (?adpreview=…): la página se
  // renderiza como VISITANTE (sin usar la sesión del que previsualiza), para
  // que el vendedor/anunciante vea la web tal cual la ve un visitante.
  const isAdPreview = req.nextUrl.searchParams.has('adpreview');
  if (isAdPreview) fwd.set('x-onyx-preview', '1');

  let res: NextResponse;
  if (urlLang) {
    const url = req.nextUrl.clone();
    url.pathname = path;
    res = NextResponse.rewrite(url, { request: { headers: fwd } });
    res.cookies.set({ name: 'onyx_lang', value: urlLang, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  } else {
    res = NextResponse.next({ request: { headers: fwd } });
  }

  // Atribución de embajador: ?ref=codigo se guarda 60 días.
  // No se sobrescribe si ya hay uno (gana el primero que lo trajo).
  const ref = req.nextUrl.searchParams.get('ref');
  if (ref && /^[a-zA-Z0-9_-]{2,30}$/.test(ref) && !req.cookies.get('onyx_ref')) {
    res.cookies.set({ name: 'onyx_ref', value: ref.toLowerCase(), maxAge: 60 * 60 * 24 * 60, path: '/', sameSite: 'lax' });
  }

  // Atribución de VENDEDOR: ?sv=codigo se guarda 60 días (gana el primero).
  const sv = req.nextUrl.searchParams.get('sv');
  if (sv && /^[a-zA-Z0-9_-]{2,30}$/.test(sv) && !req.cookies.get('onyx_sv')) {
    res.cookies.set({ name: 'onyx_sv', value: sv.toLowerCase(), maxAge: 60 * 60 * 24 * 60, path: '/', sameSite: 'lax' });
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
    // El admin no debe ni "existir" para quien no ha entrado: en vez de
    // mandar a /login (que confirma que la ruta existe), respondemos 404.
    if (path === '/admin' || path.startsWith('/admin/')) {
      return new NextResponse(null, { status: 404 });
    }
    // Conservamos pathname + query (p. ej. ?join=CODE de la academia de un mentor)
    // para que, tras registrarse/entrar, el prospecto vuelva aquí y se auto-inscriba.
    const dest = path + (req.nextUrl.search || '');
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';                       // limpiamos params heredados
    url.searchParams.set('next', dest);    // para volver aquí (con su query) tras entrar
    return NextResponse.redirect(url);
  }

  // PUERTA 2FA (servidor): con contraseña correcta Supabase ya crea sesión, pero
  // en nivel aal1. Si la cuenta tiene un autenticador verificado, EXIGIMOS aal2
  // (haber escrito el código) antes de servir cualquier ruta protegida. Sin esto,
  // pulsar "atrás" desde la pantalla del código dejaba ver el panel sin escribirlo.
  // El chequeo solo pega a Supabase cuando la sesión aún es aal1 (rápido en aal2).
  if (needsAuth && user) {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      let pendingMfa = !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
      // Excepción: sesión que ya pasó el 2FA por código de respaldo (cookie firmada).
      if (pendingMfa && await backupMfaOk(req.cookies.get('onyx_2fa')?.value, user.id)) pendingMfa = false;
      if (pendingMfa) {
        if (path === '/admin' || path.startsWith('/admin/')) {
          return new NextResponse(null, { status: 404 });
        }
        const dest = path + (req.nextUrl.search || '');
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('next', dest);
        url.searchParams.set('mfa', '1');   // la página de login abre directo el paso del código
        return NextResponse.redirect(url);
      }
    } catch { /* si el chequeo falla de forma transitoria, no encerramos a todos */ }
  }

  // Panel bloqueado por inactividad: si la marca de actividad (onyx_seen) está
  // vieja, cortamos las APIs de admin (menos la de seguridad, que desbloquea).
  // Así los datos NO salen aunque alguien llame la API directo con la sesión viva.
  // La marca solo existe para quien tiene PIN, así que a los demás no les afecta.
  if (path.startsWith('/api/admin/') && path !== '/api/admin/security' && path !== '/api/admin/2fa-backup') {
    const seen = req.cookies.get('onyx_seen')?.value;
    const t = seen ? parseInt(seen, 10) : 0;
    if (t && !Number.isNaN(t) && Date.now() - t > 20 * 60 * 1000) {   // 20 min de inactividad
      return NextResponse.json({ error: 'Panel bloqueado. Desbloquea con tu PIN.' }, { status: 423 });
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/v1/sync).*)'],
};
