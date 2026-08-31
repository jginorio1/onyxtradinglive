import { serverLang } from '@/lib/locale';

// Franja permanente que avisa cuando la web NO es producción, para que nadie
// se confunda: en el despliegue de BETA se pone NEXT_PUBLIC_APP_ENV=beta.
// En producción esta variable va vacía o 'production' y no se muestra nada.
export default function EnvBanner() {
  const env = (process.env.NEXT_PUBLIC_APP_ENV || 'production').toLowerCase();
  // En PRODUCCIÓN (stable) no se muestra nada. En cualquier otro entorno avisamos.
  if (env === 'production' || env === 'prod' || env === '') return null;
  const es = serverLang() === 'es';
  const isLocal = env === 'dev' || env === 'local' || env === 'development';
  const msg = isLocal
    ? (es ? '💻 ENTORNO LOCAL (dev) — datos y pagos NO reales' : '💻 LOCAL ENVIRONMENT (dev) — data and payments are NOT real')
    : (es ? '🧪 ENTORNO DE PRUEBAS (beta) — los datos y los pagos NO son reales' : '🧪 TESTING ENVIRONMENT (beta) — data and payments are NOT real');
  const stripes = isLocal
    ? 'repeating-linear-gradient(45deg,#0b93c9,#0b93c9 14px,#0a6f97 14px,#0a6f97 28px)'
    : 'repeating-linear-gradient(45deg,#7a3cff,#7a3cff 14px,#5b2fbf 14px,#5b2fbf 28px)';
  return (
    <div style={{
      background: stripes,
      color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '.4px',
      padding: '6px 12px', position: 'sticky', top: 0, zIndex: 999,
    }}>
      {msg}
    </div>
  );
}
