import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { type Article, type Lang } from '@/lib/guide';
import { getAllArticles } from '@/lib/guideStore';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Aplana un bloque de guía a texto plano, cubriendo TODOS los tipos (incluidos
// los nuevos: walk, tip, img). Defensivo: nunca lanza.
function blockText(b: any): string {
  if (!b || typeof b !== 'object') return '';
  if (b.p) return String(b.p);
  if (b.h) return String(b.h);
  if (b.tip) return (b.title ? String(b.title) + ': ' : '') + String(b.tip);
  if (b.note) return (b.title ? String(b.title) + ': ' : '') + String(b.note);
  if (b.warn) return String(b.warn);
  if (Array.isArray(b.list)) return b.list.map(String).join(' · ');
  if (Array.isArray(b.steps)) return b.steps.map(String).join(' · ');
  if (Array.isArray(b.walk)) return b.walk.map((s: any) => [s?.t, s?.d, s?.tip].filter(Boolean).map(String).join(' — ')).join('\n');
  if (b.img) return b.caption ? String(b.caption) : String(b.alt || '');
  return '';
}

// Aplana un artículo de la Guía a texto plano para la Base IA.
function flatten(a: Article, lang: Lang): string {
  const blocks = Array.isArray(a.body?.[lang]) ? (a.body[lang] as any[]) : [];
  const parts = blocks.map(blockText).filter(Boolean);
  return `${a.summary?.[lang] || ''}\n${parts.join('\n')}`.slice(0, 8000);
}

// Saca la clave estable "guide:slug:lang" de la cadena de etiquetas de un artículo.
function guideKeyOf(tags: string | null | undefined): string | null {
  const tok = String(tags || '').split(',').map((s) => s.trim()).find((s) => s.startsWith('guide:'));
  return tok || null;
}

// Vuelca TODOS los artículos de la Guía a la Base de conocimiento (kb_articles), ES + EN.
// UPSERT de verdad, identificando cada entrada por su clave "guide:slug:lang":
//   · si ya existe  -> se ACTUALIZA (título, cuerpo, etiquetas)
//   · si no existe  -> se INSERTA
//   · duplicados de la misma clave -> se eliminan los sobrantes
//   · entradas de guía que ya no están en la Guía -> se eliminan (limpieza)
// Nunca toca los artículos que tú escribiste a mano (los que no llevan tag "guide:").
export async function POST() {
  try {
    const { ok, user } = await requirePerm('soporte', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    // 1) Lo que YA hay importado de la guía (por su tag). Mapa clave -> ids existentes.
    const { data: existing, error: readErr } = await supabaseAdmin
      .from('kb_articles').select('id,tags').ilike('tags', '%guide:%');
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const byKey: Record<string, string[]> = {};
    (existing || []).forEach((r: any) => {
      const k = guideKeyOf(r.tags);
      if (k) (byKey[k] = byKey[k] || []).push(r.id);
    });

    // 2) Lo que DEBERÍA haber según la Guía actual (código + tus guías del editor).
    const all = await getAllArticles();
    const desired = new Map<string, { title: string; body: string; tags: string }>();
    for (const a of all) {
      for (const lang of ['es', 'en'] as Lang[]) {
        const key = `guide:${a.slug}:${lang}`;
        desired.set(key, { title: a.title?.[lang] || a.slug, body: flatten(a, lang), tags: `${key}, ${a.cat}, ${lang}` });
      }
    }

    let added = 0, updated = 0, removed = 0;

    // 3) Actualizar o insertar cada entrada deseada.
    for (const [key, row] of desired) {
      const ids = byKey[key] || [];
      const payload = { title: row.title, body: row.body, tags: row.tags, published: true, updated_at: new Date().toISOString() };
      if (ids.length > 0) {
        const { error } = await supabaseAdmin.from('kb_articles').update(payload).eq('id', ids[0]);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        updated++;
        // Duplicados de esta misma clave: fuera.
        if (ids.length > 1) {
          const { error: delErr } = await supabaseAdmin.from('kb_articles').delete().in('id', ids.slice(1));
          if (!delErr) removed += ids.length - 1;
        }
      } else {
        const { error } = await supabaseAdmin.from('kb_articles').insert(payload);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        added++;
      }
    }

    // 4) Limpieza: entradas de guía que ya no existen en la Guía actual.
    const staleIds: string[] = [];
    for (const [key, ids] of Object.entries(byKey)) {
      if (!desired.has(key)) staleIds.push(...ids);
    }
    if (staleIds.length) {
      const { error: delErr } = await supabaseAdmin.from('kb_articles').delete().in('id', staleIds);
      if (!delErr) removed += staleIds.length;
    }

    await logAdmin(user?.email || '', 'kb_import_guide', 'guide', { count: desired.size, added, updated, removed });
    return NextResponse.json({ ok: true, count: desired.size, added, updated, removed });
  } catch (e: any) {
    await logError('kb_import_guide', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
