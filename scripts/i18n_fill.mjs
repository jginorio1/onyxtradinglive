#!/usr/bin/env node
// ============================================================
// Onyx i18n · Rellena los diccionarios de idioma con Claude (API).
//
// Escanea TODO el código buscando las claves en español de L('es','en') y de los
// diccionarios { es:'…' }, compara con lib/i18n/<lang>.ts, y traduce SOLO lo que
// falta llamando a la API de Anthropic por lotes. Reescribe el archivo del idioma
// conservando lo ya traducido (idempotente y reanudable).
//
// USO (en tu terminal, dentro de la carpeta del proyecto _work):
//   export ANTHROPIC_API_KEY=sk-ant-...
//   node scripts/i18n_fill.mjs pt            # solo portugués
//   node scripts/i18n_fill.mjs pt zh ja vi   # los cuatro
//   node scripts/i18n_fill.mjs pt --force    # retraduce TODO (no solo lo que falta)
//
// Requiere Node 18+ (usa fetch nativo). No instala nada.
// ============================================================
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MODEL = process.env.ONYX_I18N_MODEL || 'claude-haiku-4-5-20251001';
const BATCH = Number(process.env.ONYX_I18N_BATCH || 40);
const KEY = process.env.ANTHROPIC_API_KEY;

const LANG_NAME = {
  pt: 'Brazilian Portuguese (Português do Brasil)',
  zh: 'Simplified Chinese (简体中文)',
  ja: 'Japanese (日本語)',
  vi: 'Vietnamese (Tiếng Việt)',
};

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const langs = args.filter((a) => !a.startsWith('--'));
if (!KEY) { console.error('Falta ANTHROPIC_API_KEY. Haz:  export ANTHROPIC_API_KEY=sk-ant-...'); process.exit(1); }
if (!langs.length) { console.error('Indica idioma(s): node scripts/i18n_fill.mjs pt [zh ja vi] [--force]'); process.exit(1); }

// ---- 1) Recolectar TODAS las claves en español del código ----
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}
function collectKeys() {
  const keys = new Set();
  const reL = /\bL\(\s*(['"`])([\s\S]*?)\1\s*,\s*(['"`])([\s\S]*?)\3/g;   // L('es','en')
  const reEs = /\bes:\s*(['"`])([\s\S]*?)\1/g;                             // { es: '…' }
  for (const base of ['app', 'lib', 'components']) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const f of walk(dir)) {
      const s = fs.readFileSync(f, 'utf8');
      let m;
      while ((m = reL.exec(s))) { const k = m[2].trim(); if (k && /[a-záéíóúñ]/i.test(k) && !k.startsWith('{')) keys.add(k); }
      while ((m = reEs.exec(s))) { const k = m[2].trim(); if (k && /[a-záéíóúñ]/i.test(k)) keys.add(k); }
    }
  }
  return keys;
}

// ---- 2) Leer diccionario existente de un idioma ----
function dictPath(lang) { return path.join(ROOT, 'lib', 'i18n', `${lang}.ts`); }
function readDict(lang) {
  const p = dictPath(lang);
  const map = {};
  if (!fs.existsSync(p)) return map;
  const s = fs.readFileSync(p, 'utf8');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < 0) return map;
  const body = s.slice(start, end + 1);
  // Extrae pares "clave": "valor" (JSON-like); tolera comillas simples/dobles.
  const re = /(["'])((?:\\.|(?!\1)[\s\S])*?)\1\s*:\s*(["'])((?:\\.|(?!\3)[\s\S])*?)\3/g;
  let m;
  while ((m = re.exec(body))) {
    try { const k = JSON.parse('"' + m[2].replace(/"/g, '\\"') + '"'); const v = JSON.parse('"' + m[4].replace(/"/g, '\\"') + '"'); map[k] = v; } catch {}
  }
  return map;
}
function writeDict(lang, map) {
  const p = dictPath(lang);
  const keys = Object.keys(map).sort((a, b) => a.localeCompare(b, 'es'));
  const lines = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`);
  const header = `// Diccionario ${lang} — clave = texto en español. Generado por scripts/i18n_fill.mjs.\n// No edites a mano las líneas de abajo; vuelve a correr el script para actualizar.\nconst d: Record<string, string> = {\n`;
  fs.writeFileSync(p, header + lines.join('\n') + '\n};\nexport default d;\n', 'utf8');
}

// ---- 3) Traducir con Claude ----
const RULES = (langName) => `You are a professional software localizer for a retail trading web app (Onyx Trading Live). Translate each UI string from Spanish into ${langName}.
Rules:
- Keep it natural and idiomatic for native speakers; UI microcopy tone (concise).
- PRESERVE exactly: placeholders like \${...}, {x}, %s, %d, numbers, emojis, punctuation, line breaks, and leading/trailing symbols (→, ←, ·, ✓, 🔒, etc.).
- DO NOT translate brand/product names: Onyx, Onyx Trading Live, Bot Lab, Onyx Guardian, Onyx Copy, Onyx Academy, TradingView, MetaTrader, MT4, MT5, cTrader, Telegram, Stripe, Supabase, Vercel, Google, FTMO, The5ers.
- Keep trading terms accurate (drawdown, break-even, lote/lot, spread, swap, prop firm, payout, equity, take profit/TP, stop loss/SL).`;

async function callModel(sys, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, temperature: 0, system: sys, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error('API ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const j = await res.json();
  return (j.content || []).map((c) => c.text || '').join('');
}

// Traduce UNA frase suelta en texto plano (respaldo cuando el JSON de un lote falla).
async function translateOne(text, langName) {
  const sys = RULES(langName) + '\n- Return ONLY the translated string, nothing else (no quotes, no JSON, no notes).';
  const out = (await callModel(sys, 'Translate to ' + langName + ':\n' + text)).trim();
  return out.replace(/^["'`]|["'`]$/g, '');
}

// Traduce un grupo de frases y devuelve un Map(es -> traducción). Si el modelo
// devuelve JSON inválido, PARTE el grupo en mitades y reintenta; si baja a una
// sola frase, usa texto plano. Así un carácter raro nunca detiene todo.
async function translateChunk(items, langName) {
  const res = new Map();
  try {
    const inObj = {}; items.forEach((s, i) => { inObj[String(i)] = s; });
    const sys = RULES(langName) + '\n- Return ONLY a JSON object with the SAME keys as the input, each value the translation of the corresponding input value. No comments, no extra keys, no extra text.';
    const txt = await callModel(sys, 'Translate the VALUES of this JSON object into ' + langName + '. Keep the SAME keys. Return only the JSON object:\n' + JSON.stringify(inObj));
    const s = txt.indexOf('{'); const e = txt.lastIndexOf('}');
    const out = JSON.parse(txt.slice(s, e + 1));
    items.forEach((str, i) => { const t = out[String(i)]; if (typeof t === 'string' && t.length) res.set(str, t); });
    return res;
  } catch (e) {
    if (items.length <= 1) {
      try { const t = await translateOne(items[0], langName); if (t) res.set(items[0], t); } catch {}
      return res;
    }
    const mid = Math.ceil(items.length / 2);
    for (const [k, v] of await translateChunk(items.slice(0, mid), langName)) res.set(k, v);
    for (const [k, v] of await translateChunk(items.slice(mid), langName)) res.set(k, v);
    return res;
  }
}

(async () => {
  const allKeys = [...collectKeys()];
  console.log('Frases en español encontradas:', allKeys.length);
  for (const lang of langs) {
    const name = LANG_NAME[lang];
    if (!name) { console.error('Idioma no soportado:', lang, '(usa pt/zh/ja/vi)'); continue; }
    const dict = readDict(lang);
    const missing = FORCE ? allKeys : allKeys.filter((k) => !(k in dict));
    console.log(`\n[${lang}] ya traducidas: ${Object.keys(dict).length} · a traducir ahora: ${missing.length}`);
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      process.stdout.write(`  ${lang} ${i + 1}-${i + batch.length}/${missing.length}… `);
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const map = await translateChunk(batch, name);
          let n = 0;
          batch.forEach((k) => { const t = map.get(k); if (typeof t === 'string' && t.length) { dict[k] = t; n++; } });
          writeDict(lang, dict); // guarda tras cada lote (reanudable)
          ok = true; console.log(`ok (${n}/${batch.length})`);
        } catch (e) {
          console.log('reintento(' + (attempt + 1) + '): ' + e.message);
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (!ok) { console.error('  Lote falló 3 veces; me detengo. Vuelve a correr para reanudar.'); process.exit(1); }
    }
    console.log(`[${lang}] LISTO · total en diccionario: ${Object.keys(dict).length}`);
  }
  console.log('\nHecho. Revisa git diff de lib/i18n/*.ts. Para activar el idioma en la app, añádelo a LANGS (lib/navText.ts) y a PREFIXES (middleware.ts).');
})();
