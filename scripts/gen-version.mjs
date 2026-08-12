// Prebuild: escribe lib/version.ts con una versión única de este deploy.
// Prioridad: NEXT_PUBLIC_APP_VERSION → commit de Vercel → marca de tiempo.
// Así cada publicación cambia la versión y el service worker se renueva solo.
import { writeFileSync } from 'node:fs';

const v =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  (process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8) : '') ||
  new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12); // AAAAMMDDHHmm

writeFileSync(
  new URL('../lib/version.ts', import.meta.url),
  `// Autogenerado por scripts/gen-version.mjs en cada build. No editar a mano.\nexport const APP_VERSION = '${v}';\n`,
);
console.log('[gen-version] APP_VERSION =', v);
