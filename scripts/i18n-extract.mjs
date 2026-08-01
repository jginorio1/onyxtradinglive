// Extrae TODOS los textos traducibles de la app → scripts/i18n-strings.json
// (clave = español, valor = inglés). Dos fuentes:
//   1) Llamadas L('español','english').
//   2) Diccionarios por-componente { es:{...}, en:{...} } y { es:'..', en:'..' }
//      (los que ahora leen con dictFor). Empareja por clave es↔en.
//
//   node scripts/i18n-extract.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'lib'];
const out = {};
function add(es, en) {
  es = String(es); en = String(en);
  if (!es || es.length > 600) return;
  if (!(es in out)) out[es] = en;
}

// ---- 1) L('...','...') ----
const RE_L = /\bL\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3\s*\)/g;
const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');

// ---- 2) diccionarios { es: ..., en: ... } ----
// Devuelve el índice justo tras la llave/valor que empieza en `open`.
function matchValue(src, i) {
  // salta espacios
  while (i < src.length && /\s/.test(src[i])) i++;
  const c = src[i];
  if (c === '{' || c === '[') {
    const openCh = c, closeCh = c === '{' ? '}' : ']';
    let depth = 0, q = null;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
      if (ch === openCh) depth++;
      else if (ch === closeCh) { depth--; if (depth === 0) return i + 1; }
    }
    return i;
  }
  if (c === "'" || c === '"' || c === '`') {
    const q = c; i++;
    for (; i < src.length; i++) { if (src[i] === '\\') i++; else if (src[i] === q) return i + 1; }
    return i;
  }
  // valor simple hasta , } o \n
  while (i < src.length && !/[,}\n]/.test(src[i])) i++;
  return i;
}
// Extrae pares clave→string de un bloque de objeto (texto entre llaves).
function stringPairs(block) {
  const m = {};
  const re = /(?:([A-Za-z0-9_$]+)|'([^']*)'|"([^"]*)")\s*:\s*('(?:\\.|[^'])*'|"(?:\\.|[^"])*")/g;
  let x;
  while ((x = re.exec(block))) {
    const key = x[1] || x[2] || x[3];
    const val = unesc(x[4].slice(1, -1));
    if (key && val) m[key] = val;
  }
  return m;
}
function scanDicts(src) {
  // busca "es :" seguido de un valor; luego el siguiente "en :"
  const re = /\bes\s*:/g;
  let x;
  while ((x = re.exec(src))) {
    const esValStart = x.index + x[0].length;
    const esEnd = matchValue(src, esValStart);
    // busca en: dentro de los ~40 chars siguientes (mismo objeto)
    const after = src.slice(esEnd, esEnd + 40);
    const enM = /^[\s,]*en\s*:/.exec(after);
    if (!enM) continue;
    const enValStart = esEnd + enM[0].length;
    const enEnd = matchValue(src, enValStart);
    const esRaw = src.slice(esValStart, esEnd).trim();
    const enRaw = src.slice(enValStart, enEnd).trim();
    if (esRaw[0] === '{' && enRaw[0] === '{') {
      const em = stringPairs(esRaw), nm = stringPairs(enRaw);
      for (const k of Object.keys(em)) if (nm[k]) add(em[k], nm[k]);
    } else if ((esRaw[0] === "'" || esRaw[0] === '"') && (enRaw[0] === "'" || enRaw[0] === '"')) {
      add(unesc(esRaw.slice(1, -1)), unesc(enRaw.slice(1, -1)));
    }
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.includes('fuse_hidden')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(name)) {
      const src = readFileSync(p, 'utf8');
      let m;
      RE_L.lastIndex = 0;
      while ((m = RE_L.exec(src))) add(unesc(m[2]), unesc(m[4]));
      scanDicts(src);
    }
  }
}
for (const r of ROOTS) { try { walk(r); } catch {} }
writeFileSync('scripts/i18n-strings.json', JSON.stringify(out, null, 2));
console.log('[i18n-extract] textos únicos:', Object.keys(out).length, '→ scripts/i18n-strings.json');
