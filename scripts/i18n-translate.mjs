// ============================================================
// Onyx AI llena los diccionarios de idioma (zh/ja/pt/vi).
//
// Flujo:
//   1) node scripts/i18n-extract.mjs        → scripts/i18n-strings.json
//   2) ANTHROPIC_API_KEY=... node scripts/i18n-translate.mjs
//
// Lee las 1068+ cadenas en español (con su inglés de referencia) y le pide a
// Onyx AI (Claude) que las traduzca por lotes a cada idioma. Escribe/actualiza
// lib/i18n/{zh,ja,pt,vi}.ts SIN borrar lo que ya esté traducido (solo rellena
// lo que falte). Idempotente: puedes volver a correrlo cuando agregues textos.
//
// Opciones:
//   ONLY=zh,pt   → solo esos idiomas
//   FORCE=1      → retraduce todo, no solo lo que falta
//   MODEL=...    → override del modelo (por defecto claude-haiku-4-5)
// ============================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const MODEL = process.env.MODEL || 'claude-haiku-4-5';
const FORCE = process.env.FORCE === '1';
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);

const TARGETS = {
  zh: 'Simplified Chinese (简体中文)',
  ja: 'Japanese (日本語)',
  pt: 'Brazilian Portuguese (Português do Brasil)',
  vi: 'Vietnamese (Tiếng Việt)',
};
const langs = ONLY.length ? ONLY.filter((l) => TARGETS[l]) : Object.keys(TARGETS);

const STRINGS = JSON.parse(readFileSync('scripts/i18n-strings.json', 'utf8')); // { es: en }
const KEEP_BRAND = ['Onyx', 'Guardian', 'Copy', 'Onyx Academy', 'Onyx Coach', 'Onyx Guardian', 'Telegram', 'MetaTrader', 'cTrader'];

// Carga un diccionario existente (para no pisar traducciones ya hechas).
function loadDict(lang) {
  const path = `lib/i18n/${lang}.ts`;
  if (!existsSync(path)) return {};
  const src = readFileSync(path, 'utf8');
  const m = src.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return eval('(' + m[0] + ')'); } catch { return {}; }
}
function saveDict(lang, dict) {
  const entries = Object.entries(dict)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');
  const body = `// Diccionario ${lang} — clave = texto en español. Generado/rellenado por\n`
    + `// scripts/i18n-translate.mjs (Onyx AI). Puedes editar a mano cualquier valor.\n`
    + `const d: Record<string, string> = {\n${entries}\n};\nexport default d;\n`;
  writeFileSync(`lib/i18n/${lang}.ts`, body);
}

async function translateBatch(langName, pairs) {
  const system = `You are a professional UI localizer for "Onyx Trading Live", a trading SaaS (dashboard, trading academy, billing, copy-trading, risk manager). Translate each UI string into ${langName}.
Rules:
- Return ONLY a JSON array of strings, same length and order as the input, nothing else.
- Keep it natural and idiomatic for software UI, concise (UI labels/buttons).
- Preserve placeholders EXACTLY: {name}, {n}, %s, {{site}}, \${...}, <b>...</b>, emojis, numbers, and URLs.
- Do NOT translate brand names: ${KEEP_BRAND.join(', ')}.
- Match capitalization style of a native UI. No quotes around the whole thing, no commentary.`;
  const user = `Translate these ${pairs.length} strings to ${langName}. Spanish is the source; English is a reference for meaning.\n`
    + JSON.stringify(pairs.map(([es, en]) => ({ es, en })));
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error('API ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  const raw = (d.content || []).map((c) => c.text || '').join('').trim().replace(/^```json/i, '').replace(/```$/, '').trim();
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr) || arr.length !== pairs.length) throw new Error('respuesta desalineada');
  return arr.map((x) => String(x));
}

const allEs = Object.keys(STRINGS);
const BATCH = 5;

for (const lang of langs) {
  const langName = TARGETS[lang];
  const dict = loadDict(lang);
  const todo = allEs.filter((es) => FORCE || !dict[es]);
  console.log(`\n[${lang}] ${langName} — a traducir: ${todo.length} / ${allEs.length}`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const pairs = slice.map((es) => [es, STRINGS[es]]);
    let tries = 0;
    while (true) {
      try {
        const out = await translateBatch(langName, pairs);
        slice.forEach((es, k) => { dict[es] = out[k]; });
        saveDict(lang, dict); // guarda tras cada lote (resistente a cortes)
        console.log(`  [${lang}] ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
        break;
      } catch (e) {
        if (++tries >= 4) { console.error(`  [${lang}] lote ${i} falló: ${e.message}`); break; }
        await new Promise((res) => setTimeout(res, 1500 * tries));
      }
    }
  }
  console.log(`[${lang}] listo → lib/i18n/${lang}.ts (${Object.keys(dict).length} entradas)`);
}
console.log('\n✅ Traducción completa. Revisa lib/i18n/*.ts y haz commit.');
