import { serverLang } from '@/lib/locale';

// Franja permanente que avisa cuando la web NO es producción, para que nadie
// se confunda: en el despliegue de BETA se pone NEXT_PUBLIC_APP_ENV=beta.
// En producción esta variable va vacía o 'production' y no se muestra nada.
export default function EnvBanner() {
  const env = (process.env.NEXT_PUBLIC_APP_ENV || 'production').toLowerCase();
  if (env !== 'beta' && env !== 'staging') return null;
  const es = serverLang() === 'es';
  const msg = es
    ? '🧪 ENTORNO DE PRUEBAS — los datos y los pagos NO son reales'
    : '🧪 TESTING ENVIRONMENT — data and payments are NOT real';
  return (
    <div style={{
      background: 'repeating-linear-gradient(45deg,#7a3cff,#7a3cff 14px,#5b2fbf 14px,#5b2fbf 28px)',
      color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '.4px',
      padding: '6px 12px', position: 'sticky', top: 0, zIndex: 999,
    }}>
      {msg}
    </div>
  );
}
