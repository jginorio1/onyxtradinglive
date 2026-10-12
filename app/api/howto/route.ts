import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { getHowto, saveHowto, resetHowto } from '@/lib/howtoStore';
import type { Cat } from '@/lib/howtoDefault';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const s = (v: any, n = 4000) => String(v ?? '').slice(0, n);
const num = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

// Limpia y acota la estructura para no guardar basura ni payloads enormes.
function clean(cats: any[]): Cat[] {
  return (Array.isArray(cats) ? cats : []).slice(0, 40).map((c: any) => ({
    es: s(c?.es, 80), en: s(c?.en, 80),
    guides: (Array.isArray(c?.guides) ? c.guides : []).slice(0, 40).map((g: any) => ({
      id: s(g?.id, 60), icon: s(g?.icon, 40),
      es: s(g?.es, 120), en: s(g?.en, 120),
      mins: Math.max(0, Math.min(999, Math.round(num(g?.mins)))),
      steps: (Array.isArray(g?.steps) ? g.steps : []).slice(0, 40).map((st: any) => ({
        es: s(st?.es, 200), en: s(st?.en, 200),
        des_es: s(st?.des_es, 6000), des_en: s(st?.des_en, 6000),
        img: s(st?.img, 400),
        markers: (Array.isArray(st?.markers) ? st.markers : []).slice(0, 20).map((m: any) => ({
          x: num(m?.x), y: num(m?.y),
          ...(m?.w != null ? { w: num(m.w) } : {}), ...(m?.h != null ? { h: num(m.h) } : {}),
          ...(m?.n != null ? { n: Math.round(num(m.n)) } : {}),
          es: s(m?.es, 120), en: s(m?.en, 120),
          ...(m?.dir ? { dir: s(m.dir, 6) as any } : {}),
        })),
      })),
    })),
  }));
}

// GET · público: la guía viva (editada o la del código).
export async function GET() {
  return NextResponse.json({ cats: await getHowto() });
}

// POST · dueño: guarda toda la guía editada.
export async function POST(req: Request) {
  try {
    const a = await getAdmin();
    if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    if (!Array.isArray(b?.cats)) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });
    await saveHowto(clean(b.cats));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('howto_save', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · dueño: vuelve a la versión del código.
export async function DELETE() {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  await resetHowto();
  return NextResponse.json({ ok: true });
}
