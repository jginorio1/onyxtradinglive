// Fusiona un lote de traducciones en los 4 diccionarios.
// Uso: node scripts/i18n-merge.mjs '<json>'
//   json = { "texto es": {"zh":"..","ja":"..","pt":"..","vi":".."}, ... }
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const idx = ['zh', 'ja', 'pt', 'vi'];
function load(lang){ const p=`lib/i18n/${lang}.ts`; if(!existsSync(p))return{}; const m=readFileSync(p,'utf8').match(/\{[\s\S]*\}/); try{return m?eval('('+m[0]+')'):{};}catch{return{};} }
function save(lang,d){ const e=Object.entries(d).map(([k,v])=>`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n'); writeFileSync(`lib/i18n/${lang}.ts`, `// Diccionario ${lang} — clave = texto en español. Traducción completa.\nconst d: Record<string, string> = {\n${e}\n};\nexport default d;\n`); }
const arg = process.argv[2];
const batch = JSON.parse(arg.startsWith('{') ? arg : readFileSync(arg, 'utf8'));
const dicts = Object.fromEntries(idx.map(l=>[l,load(l)]));
let n=0;
for(const [es,tr] of Object.entries(batch)){ for(const l of idx){ if(tr[l]){ dicts[l][es]=tr[l]; } } n++; }
for(const l of idx) save(l,dicts[l]);
console.log(`merged ${n} · zh:${Object.keys(dicts.zh).length} ja:${Object.keys(dicts.ja).length} pt:${Object.keys(dicts.pt).length} vi:${Object.keys(dicts.vi).length}`);
