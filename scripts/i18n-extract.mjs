// Extrae todos los textos L('español','english') únicos de la app y los saca a
// scripts/i18n-strings.json (clave = español, valor = inglés). Ese archivo se le
// pasa a Onyx AI para que devuelva zh/ja/pt/vi, que van en lib/i18n/*.ts.
//
//   node scripts/i18n-extract.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'lib'];
const out = {};
// L('...', '...') admitiendo comillas simples/dobles y escapes básicos.
const RE = /\bL\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3\s*\)/g;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.includes('fuse_hidden')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(name)) {
      const src = readFileSync(p, 'utf8');
      let m;
      while ((m = RE.exec(src))) {
        const es = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
        const en = m[4].replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (es && !(es in out)) out[es] = en;
      }
    }
  }
}
for (const r of ROOTS) { try { walk(r); } catch {} }
writeFileSync('scripts/i18n-strings.json', JSON.stringify(out, null, 2));
console.log('[i18n-extract] textos únicos:', Object.keys(out).length, '→ scripts/i18n-strings.json');
