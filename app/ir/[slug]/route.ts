import { NextRequest, NextResponse } from 'next/server';
import { vpsInfo } from '@/lib/botlab';
import { recoBrokerSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Redirección de afiliados a través de NUESTRO dominio.
//   /ir/vps     → enlace de VPS recomendado (admin → Bot Lab)
//   /ir/broker  → enlace de bróker recomendado (admin → reco_broker)
//
// Por qué: dentro de la app (Capacitor con server.url remoto), un <a target="_blank">
// a un host externo NO abre (Android no activa onCreateWindow; iOS va por otra ruta)
// y el bridge JS puede no existir en la página remota. En cambio, navegar a una ruta
// de NUESTRO dominio (que sí está en allowNavigation) SIEMPRE funciona; el 302 a un
// host externo lo intercepta el lado nativo de Capacitor y lo abre en el navegador
// del sistema. Es la forma determinista de abrir un enlace externo desde la app.
// Solo acepta destinos conocidos (vps/broker) leídos de la config → sin open-redirect.
export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
  let url = '';
  try {
    if (slug === 'vps') url = (await vpsInfo()).url || '';
    else if (slug === 'broker') url = (await recoBrokerSettings()).url || '';
  } catch { /* si falla, caemos a home */ }
  url = (url || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (!/^https?:\/\//i.test(url)) {
    // Sin enlace configurado: volvemos a una página interna segura.
    return NextResponse.redirect(new URL('/bot-lab', req.url), 302);
  }
  return NextResponse.redirect(url, 302);
}
